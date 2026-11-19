export const PANEL_GAP = 16;
export const PANEL_CLOSE_GAP = PANEL_GAP / 4;
export const PANEL_SNAP_GAPS = [PANEL_GAP, PANEL_CLOSE_GAP] as const;
// Ten percent narrower than the previous 18-point magnetic range.
export const SNAP_THRESHOLD = 18 * 0.9;
export const PANEL_PADDING = 12;
// A slightly wider capture for the closer, edge-alignment snap only.
export const CLOSE_SNAP_THRESHOLD = SNAP_THRESHOLD * 1.2;
