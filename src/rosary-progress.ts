// One persisted value avoids inconsistencies between rounds and the current bead.
export const BEADS_PER_ROUND = 108;
export const MAX_BEADS = Number.MAX_SAFE_INTEGER - BEADS_PER_ROUND;
export function validBeadTotal(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_BEADS ? value : 0;
}
export function beadProgress(total: number) {
  return { current: total === 0 ? 0 : (total - 1) % BEADS_PER_ROUND + 1, rounds: Math.floor(total / BEADS_PER_ROUND) };
}
