const STRIKE = { break: 1, damage: 0.5 };

export const MAX_DAMAGE = 65535;

export type StrikeOutcome = "break" | "damage" | "none";

export interface Strike {
  outcome: StrikeOutcome;
  damage: number;
}

// whether the ball goes on through a broken block is up to its effects (Pierce, Penetrate)
export function strike(power: number, strength: number): Strike {
  const ratio = power / strength;
  if (ratio >= STRIKE.break) return { outcome: "break", damage: 0 };
  if (ratio >= STRIKE.damage)
    return {
      outcome: "damage",
      damage: (ratio - STRIKE.damage) / (STRIKE.break - STRIKE.damage),
    };
  return { outcome: "none", damage: 0 };
}
