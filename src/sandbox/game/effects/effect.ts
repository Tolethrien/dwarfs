import type Ball from "../components/ball";

export type ClassStat = "speed" | "power" | "bph";
export type StatName = ClassStat | "moraleMin" | "moraleMax" | "moraleRate";

export const STAT_NAMES: Record<StatName, string> = {
  speed: "Speed",
  power: "Damage",
  bph: "Beer per hour",
  moraleMin: "Morale min",
  moraleMax: "Morale max",
  moraleRate: "Morale rate",
};

export const STATS = Object.keys(STAT_NAMES) as StatName[];

// summed over every effect of a dwarf, the stat is (base + add) * multiply
export type StatModifiers = Record<StatName, { add: number; multiply: number }>;

export interface FlightModifiers {
  pierceAbove: number;
  overSpeedPower: number;
  penetrateRatio: number;
  bounceBoost: number;
  bounceCooldown: number;
  blastRadius: number;
  blastEdge: number;
  splashRadius: number;
  splashDamage: number;
}

// what a trait, a beer or an item does; shared by every dwarf that has it, so it keeps no state of
// its own dwarf
export default abstract class Effect {
  public readonly timed: boolean = false;
  // true: onFlight runs at every physics step of a ball that has it; what it keeps between the
  // steps goes into ball.timers, the effect is shared
  public readonly inFlight: boolean = false;

  public abstract describe(): string;

  public modify(modifiers: StatModifiers): void {}

  public modifyAt(modifiers: StatModifiers, seconds: number): void {}

  public onFlight(ball: Ball, delta: number): void {}

  public modifyFlight(flight: FlightModifiers): void {}
}
