/**
 * Plain zoom-interpolated pixel radii, no latitude math — good enough to read as
 * roughly an 8 m halo (the click target) and a 2–3 m core (about one parked car) at
 * German latitudes. Doubling every 6 zoom levels (14 → 20) mirrors how many meters a
 * pixel covers doubling with each zoom level, so the disk holds its real-world size
 * reasonably well across the zoom range counters actually work at.
 *
 * Kept as plain numbers, not a maplibre `ExpressionSpecification`, so callers build the
 * `['interpolate', ['exponential', 2], ['zoom'], 14, at14, 20, at20]` array inline —
 * the exact expression tuple type isn't part of this package's public API surface.
 */
export const MANUAL_POINT_HALO_RADIUS_AT_Z14 = 1.2
export const MANUAL_POINT_HALO_RADIUS_AT_Z20 = 77

export const MANUAL_POINT_CORE_RADIUS_AT_Z14 = 0.4
export const MANUAL_POINT_CORE_RADIUS_AT_Z20 = 25

export const MANUAL_POINT_SELECTED_RADIUS_AT_Z14 = 2
export const MANUAL_POINT_SELECTED_RADIUS_AT_Z20 = 128
