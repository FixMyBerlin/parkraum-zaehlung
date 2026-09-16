import { EDGE_LINE_WIDTH, EDGE_SIDE_LINE_WIDTH_ACTIVE } from './edge-side-style'

/**
 * Manual points borrow their size from the edge lines, so a point reads as the dot
 * version of a counted edge: the solid core is as wide as the grey edge line, and the
 * glow around it spans twice a highlighted side line, wide enough to hit on a phone.
 * Plain pixel radii, no zoom interpolation — the lines they match are plain pixels too.
 */
export const MANUAL_POINT_CORE_RADIUS = EDGE_LINE_WIDTH / 2

export const MANUAL_POINT_HALO_RADIUS = EDGE_SIDE_LINE_WIDTH_ACTIVE

/** Selection sits under the halo, so it fills the same disk rather than growing past it. */
export const MANUAL_POINT_SELECTED_RADIUS = MANUAL_POINT_HALO_RADIUS

/** Marker drag handle: the grabbable middle of the glow, not the whole disk. */
export const MANUAL_POINT_MARKER_SIZE = EDGE_SIDE_LINE_WIDTH_ACTIVE
