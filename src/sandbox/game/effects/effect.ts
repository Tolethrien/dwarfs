import type Ball from "../components/dwarfs/ball";

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
// its own dwarf (onFlight keeps per-ball timers in ball.timers)
export default interface Effect {
  readonly name: string;
  readonly props?: object;
  describe(): string;
  modify?(modifiers: StatModifiers): void;
  modifyAt?(modifiers: StatModifiers, seconds: number): void;
  modifyFlight?(flight: FlightModifiers): void;
  onFlight?(ball: Ball, delta: number): void;
}
