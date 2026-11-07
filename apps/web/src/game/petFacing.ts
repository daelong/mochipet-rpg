export type PetFacing = 'left' | 'right';
type Vector = { x: number; y: number };

/** Movement wins while walking; a stopped hunter turns toward its current opponent. */
export function petFacing(
  previous: PetFacing,
  motion: Vector,
  opponent: Vector | null = null,
): PetFacing {
  const dx = Math.hypot(motion.x, motion.y) > 0 ? motion.x : (opponent?.x ?? 0);
  // The preserved PNGs have no up/down views. Keep the last horizontal side on vertical paths.
  if (Math.abs(dx) <= 0.001) return previous;
  return dx > 0 ? 'right' : 'left';
}
