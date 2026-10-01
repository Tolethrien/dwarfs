// "Siła penetracji" (krasiokulki.md): the ratio of hit power to the target's strength.
// Shared by tiles and (later) destructible objects
const STRIKE = { penetrate: 1.5, break: 1, damage: 0.5 };

// full durability: damage at this value destroys the target (u16 in the save)
export const MAX_DAMAGE = 65535;

export type StrikeOutcome = "penetrate" | "break" | "damage" | "none";

export interface Strike {
  outcome: StrikeOutcome;
  // "damage" only: share of the target's full durability, 0-1
  damage: number;
}

export function strike(power: number, strength: number): Strike {
  const ratio = power / strength;
  if (ratio >= STRIKE.penetrate) return { outcome: "penetrate", damage: 0 };
  if (ratio >= STRIKE.break) return { outcome: "break", damage: 0 };
  if (ratio >= STRIKE.damage)
    return {
      outcome: "damage",
      damage: (ratio - STRIKE.damage) / (STRIKE.break - STRIKE.damage),
    };
  return { outcome: "none", damage: 0 };
}
