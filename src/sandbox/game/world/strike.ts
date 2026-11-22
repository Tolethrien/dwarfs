export const MAX_DAMAGE = 65535;

export type StrikeOutcome = "break" | "damage" | "none";

export interface Strike {
  outcome: StrikeOutcome;
  damage: number;
}

// whether the ball goes on through a broken block is up to its effects (Pierce, Penetrate)
export function strike(power: number, strength: number): Strike {
  if (power <= 0 || strength === Infinity) return { outcome: "none", damage: 0 };
  const ratio = power / strength;
  if (ratio >= 1) return { outcome: "break", damage: 1 };
  return { outcome: "damage", damage: ratio * ratio };
}
