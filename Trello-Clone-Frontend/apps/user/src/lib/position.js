// Fractional/midpoint positioning so inserts don't reindex the whole list.
const STEP = 65536;

export function midpoint(before, after) {
  if (before == null && after == null) return STEP;
  if (before == null) return after / 2;
  if (after == null) return before + STEP;
  return (before + after) / 2;
}
