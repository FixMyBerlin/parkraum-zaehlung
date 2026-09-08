-- Prototype of the "counting edges" (Zähl-Kanten) SQL for TILDA's parking topic.
--
-- Read-only query against a TILDA processing database *after* `parking.sql` ran, i.e. the tables
-- `_parking_roads`, `_parking_node_road_mapping`, `_parking_parkings_cutted` and
-- `_parking_parkings_merged` exist. Emits one GeoJSON FeatureCollection (Contract 1 of the plan).
--
-- Intended future home: tilda-geo `processing/topics/parking/11_create_edges.sql` writing into a
-- public table `parkings_edges`. Here it only produces a test dataset for the SPA:
--
--   psql "$DATABASE_URL" -At -v dataset="'bietigheim-bissingen-2026-09'" -v region="'Bietigheim-Bissingen'" \
--     -f fixtures/counting-edges-prototype.sql > fixtures/bietigheim-bissingen-edges.geojson
--
-- Definitions (see plan):
-- * network: TILDA `is_road` ways (`is_parking_road AND NOT is_driveway`), driveways excluded
-- * vertex: node with weighted degree <> 2 (terminal node counts 1, through node counts 2);
--   3+ = intersection, 1 = dead end. Degree-2 joins between ways are merged through.
-- * edge direction = OSM direction of the longest constituent way; `way_reversed[i]` per way
-- * capacity per side: final merged parking capacities apportioned back to their pre-merge
--   `(way, side)` pieces by length share, then flipped where the way is reversed on the edge.

WITH
  network AS (
    SELECT nrm.way_id, nrm.node_id, nrm.idx, nrm.is_terminal_node
    FROM _parking_node_road_mapping nrm
    JOIN _parking_roads r ON r.osm_id = nrm.way_id
    WHERE r.is_parking_road AND NOT r.is_driveway
  ),
  degree AS (
    SELECT node_id, SUM(1 + (NOT is_terminal_node)::int) AS degree
    FROM network
    GROUP BY node_id
  ),
  cuts AS (
    SELECT n.way_id, n.idx, n.node_id
    FROM network n
    JOIN degree d USING (node_id)
    WHERE n.is_terminal_node OR d.degree <> 2
  ),
  seg_bounds AS (
    SELECT
      way_id,
      node_id AS from_node,
      idx AS from_idx,
      LEAD(node_id) OVER (PARTITION BY way_id ORDER BY idx) AS to_node,
      LEAD(idx) OVER (PARTITION BY way_id ORDER BY idx) AS to_idx
    FROM cuts
  ),
  segments AS (
    SELECT
      row_number() OVER () AS seg_id,
      s.way_id,
      s.from_node,
      s.to_node,
      -- position range of the segment along its way (0..1), used to attribute parking pieces
      ST_LineLocatePoint(r.geom, ST_PointN(r.geom, s.from_idx)) AS frac_from,
      CASE WHEN s.to_idx = ST_NPoints(r.geom) THEN 1.0
           ELSE ST_LineLocatePoint(r.geom, ST_PointN(r.geom, s.to_idx)) END AS frac_to,
      ST_MakeLine(ARRAY(
        SELECT ST_PointN(r.geom, i) FROM generate_series(s.from_idx, s.to_idx) AS i
      )) AS geom
    FROM seg_bounds s
    JOIN _parking_roads r ON r.osm_id = s.way_id
    WHERE s.to_idx IS NOT NULL
  ),
  -- Merge at nodes where exactly two segment endpoints meet (degree-2 joins). Vertices have 1 or
  -- 3+ endpoints and therefore stay edge ends.
  merged AS (
    SELECT (ST_Dump(ST_LineMerge(ST_Collect(geom)))).geom AS geom
    FROM segments
  ),
  merged_ids AS (
    SELECT row_number() OVER () AS edge_no, geom FROM merged
  ),
  -- Recover which segments make up each merged edge and in which order/direction.
  seg_on_edge AS (
    SELECT
      m.edge_no,
      s.seg_id,
      s.way_id,
      s.from_node,
      s.to_node,
      ST_Length(s.geom) AS seg_len,
      ST_LineLocatePoint(m.geom, ST_LineInterpolatePoint(s.geom, 0.5)) AS pos,
      ST_LineLocatePoint(m.geom, ST_StartPoint(s.geom)) > ST_LineLocatePoint(m.geom, ST_EndPoint(s.geom)) AS reversed
    FROM merged_ids m
    JOIN segments s
      ON ST_DWithin(ST_LineInterpolatePoint(s.geom, 0.5), m.geom, 0.01)
     AND ST_DWithin(ST_StartPoint(s.geom), m.geom, 0.01)
     AND ST_DWithin(ST_EndPoint(s.geom), m.geom, 0.01)
  ),
  -- Orientation: follow the OSM direction of the longest way on the edge.
  edge_orientation AS (
    SELECT DISTINCT ON (edge_no) edge_no, reversed AS flip
    FROM seg_on_edge
    ORDER BY edge_no, seg_len DESC
  ),
  edge_parts AS (
    SELECT
      s.edge_no,
      o.flip,
      array_agg(s.seg_id ORDER BY CASE WHEN o.flip THEN -s.pos ELSE s.pos END) AS seg_ids,
      array_agg(s.way_id ORDER BY CASE WHEN o.flip THEN -s.pos ELSE s.pos END) AS way_ids,
      array_agg((s.reversed <> o.flip) ORDER BY CASE WHEN o.flip THEN -s.pos ELSE s.pos END) AS way_reversed,
      array_agg(CASE WHEN (s.reversed <> o.flip) THEN s.to_node ELSE s.from_node END
                ORDER BY CASE WHEN o.flip THEN -s.pos ELSE s.pos END) AS entry_nodes,
      array_agg(CASE WHEN (s.reversed <> o.flip) THEN s.from_node ELSE s.to_node END
                ORDER BY CASE WHEN o.flip THEN -s.pos ELSE s.pos END) AS exit_nodes,
      (array_agg(s.way_id ORDER BY s.seg_len DESC))[1] AS longest_way_id
    FROM seg_on_edge s
    JOIN edge_orientation o USING (edge_no)
    GROUP BY s.edge_no, o.flip
  ),
  edges AS (
    SELECT
      p.edge_no,
      CASE WHEN p.flip THEN ST_Reverse(m.geom) ELSE m.geom END AS geom,
      p.seg_ids,
      p.way_ids,
      p.way_reversed,
      p.entry_nodes[1] AS start_node,
      p.exit_nodes[array_length(p.exit_nodes, 1)] AS end_node,
      r.tags ->> 'name' AS name,
      r.tags ->> 'highway' AS highway,
      r.tags ->> 'road' AS road
    FROM edge_parts p
    JOIN merged_ids m USING (edge_no)
    JOIN _parking_roads r ON r.osm_id = p.longest_way_id
  ),
  -- Bearing of the longest straight segment, in edge direction (degrees, 0-360).
  edge_azimuth AS (
    SELECT DISTINCT ON (e.edge_no)
      e.edge_no,
      degrees(ST_Azimuth(ST_StartPoint(d.geom), ST_EndPoint(d.geom))) AS azimuth
    FROM edges e, ST_DumpSegments(e.geom) d
    ORDER BY e.edge_no, ST_Length(d.geom) DESC
  ),
  -- Merged parkings (post estimate) apportioned back to their pre-merge (way, side) pieces by
  -- length share. Capacity only from rows that made it into the final `parkings` table (this
  -- excludes `parking=no|missing` rows that live in `parkings_no`); the `parking` value is kept
  -- for all rows so the SPA can show "missing" / "no" per side.
  merged_pieces AS (
    SELECT
      m.id AS merged_id,
      CASE WHEN EXISTS (SELECT 1 FROM parkings p WHERE p.id = m.id)
           THEN (m.tags ->> 'capacity')::numeric ELSE 0 END AS capacity,
      m.tags ->> 'parking' AS parking,
      unnest(string_to_array(m.original_ids, '-')) AS cutted_id
    FROM _parking_parkings_merged m
    WHERE m.tags ->> 'source' = 'parkings'
  ),
  -- Each piece is located along its road way as a position range (0..1) so it can be split
  -- between the segments of that way.
  pieces AS (
    SELECT
      c.osm_id AS way_id,
      c.side,
      mp.parking,
      ST_Length(c.geom) AS piece_len,
      mp.capacity * ST_Length(c.geom) / NULLIF(SUM(ST_Length(c.geom)) OVER (PARTITION BY mp.merged_id), 0) AS capacity_share,
      LEAST(ST_LineLocatePoint(r.geom, ST_StartPoint(c.geom)), ST_LineLocatePoint(r.geom, ST_EndPoint(c.geom))) AS f0,
      GREATEST(ST_LineLocatePoint(r.geom, ST_StartPoint(c.geom)), ST_LineLocatePoint(r.geom, ST_EndPoint(c.geom))) AS f1
    FROM merged_pieces mp
    JOIN _parking_parkings_cutted c ON c.id = mp.cutted_id
    JOIN _parking_roads r ON r.osm_id = c.osm_id
  ),
  -- Piece capacity split onto the segments it overlaps (by overlap share of the piece range).
  seg_side AS (
    SELECT
      s.seg_id,
      p.side,
      p.parking,
      p.capacity_share * ov.share AS capacity,
      p.piece_len * ov.share AS len
    FROM pieces p
    JOIN segments s ON s.way_id = p.way_id
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN p.f1 - p.f0 < 1e-9 THEN (CASE WHEN p.f0 >= s.frac_from AND p.f0 <= s.frac_to THEN 1.0 ELSE 0.0 END)
        ELSE GREATEST(0, LEAST(p.f1, s.frac_to) - GREATEST(p.f0, s.frac_from)) / (p.f1 - p.f0)
      END AS share
    ) ov
    WHERE ov.share > 0
  ),
  edge_sides AS (
    SELECT
      e.edge_no,
      CASE WHEN w.reversed THEN (CASE ss.side WHEN 'left' THEN 'right' ELSE 'left' END) ELSE ss.side END AS edge_side,
      ss.capacity,
      ss.len,
      ss.parking
    FROM edges e
    CROSS JOIN LATERAL unnest(e.seg_ids, e.way_reversed) WITH ORDINALITY AS w(seg_id, reversed, ord)
    JOIN seg_side ss ON ss.seg_id = w.seg_id
  ),
  edge_side_parking AS (
    SELECT DISTINCT ON (edge_no, edge_side) edge_no, edge_side, parking
    FROM (
      SELECT edge_no, edge_side, parking, SUM(len) AS len
      FROM edge_sides
      GROUP BY edge_no, edge_side, parking
    ) x
    ORDER BY edge_no, edge_side, len DESC
  ),
  edge_capacity AS (
    SELECT
      es.edge_no,
      SUM(es.capacity) FILTER (WHERE es.edge_side = 'left') AS capacity_left,
      SUM(es.capacity) FILTER (WHERE es.edge_side = 'right') AS capacity_right,
      (SELECT parking FROM edge_side_parking sp WHERE sp.edge_no = es.edge_no AND sp.edge_side = 'left') AS parking_left,
      (SELECT parking FROM edge_side_parking sp WHERE sp.edge_no = es.edge_no AND sp.edge_side = 'right') AS parking_right
    FROM edge_sides es
    GROUP BY es.edge_no
  ),
  features AS (
    SELECT
      'ce-' || left(md5(
        least(e.start_node, e.end_node)::text || '-' || greatest(e.start_node, e.end_node)::text
        || '|' || array_to_string((SELECT array_agg(x ORDER BY x) FROM unnest(e.way_ids) x), ',')
      ), 12) AS id,
      e.*,
      a.azimuth,
      c.capacity_left,
      c.capacity_right,
      c.parking_left,
      c.parking_right
    FROM edges e
    LEFT JOIN edge_azimuth a USING (edge_no)
    LEFT JOIN edge_capacity c USING (edge_no)
  )
SELECT json_build_object(
  'type', 'FeatureCollection',
  'metadata', json_build_object(
    'schema', 'counting-edges/v1',
    'dataset', :dataset,
    'region', :region,
    'generated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'source', 'tilda parking processing (prototype query fixtures/counting-edges-prototype.sql)'
  ),
  'features', COALESCE(json_agg(
    json_build_object(
      'type', 'Feature',
      'id', f.id,
      'geometry', ST_AsGeoJSON(ST_Transform(f.geom, 4326), 6)::json,
      'properties', json_strip_nulls(json_build_object(
        'id', f.id,
        'name', f.name,
        'highway', f.highway,
        'road', f.road,
        'way_ids', to_json(f.way_ids),
        'way_reversed', to_json(f.way_reversed),
        'start_node', f.start_node,
        'end_node', f.end_node,
        'length', ROUND(ST_Length(f.geom)::numeric, 1),
        'azimuth', ROUND(f.azimuth::numeric, 1),
        'capacity_left', ROUND(COALESCE(f.capacity_left, 0)),
        'capacity_right', ROUND(COALESCE(f.capacity_right, 0)),
        'parking_left', f.parking_left,
        'parking_right', f.parking_right
      ))
    ) ORDER BY f.id
  ), '[]'::json)
)
FROM features f;
