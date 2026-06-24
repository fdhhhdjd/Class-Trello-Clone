export const POSITION_STEP = 1024;

// Position for a new item appended to the end of a set.
export function endPosition(maxPosition) {
  return (maxPosition ?? 0) + POSITION_STEP;
}

// Midpoint between two neighbor positions (fractional indexing).
export function midpoint(before, after) {
  if (before == null && after == null) return POSITION_STEP;
  if (before == null) return after / 2;
  if (after == null) return before + POSITION_STEP;
  return (before + after) / 2;
}
