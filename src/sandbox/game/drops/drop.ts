import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";

export type AmountRange = readonly [min: number, max: number];
export type AmountInput = number | AmountRange;

export interface DropEntry<T> {
  readonly id: T;
  readonly amount: AmountRange;
}

export interface DropResult<T> {
  id: T;
  amount: number;
}

export interface RollOptions {
  step?: number;
}

export type DropFormatter<T> = (id: T, amount: AmountRange) => string;

export default interface Drop<T> {
  readonly main?: DropEntry<T>;
  roll(options?: RollOptions): DropResult<T>[];
  describe(format: DropFormatter<T>): string;
}

export function toRange(amount: AmountInput): AmountRange {
  if (typeof amount === "number") return [amount, amount];
  assert(amount[0] <= amount[1], `Drop amount range min (${amount[0]}) exceeds max (${amount[1]})`);
  return amount;
}

export function rollAmount(range: AmountRange, step = 1) {
  if (range[0] === range[1]) return range[0];
  const scale = 1 / step;
  const min = Math.round(range[0] * scale);
  const max = Math.round(range[1] * scale);
  return AxiomMath.randomInt(min, max) / scale;
}

export function formatPercent(probability: number) {
  return `${Math.round(probability * 1000) / 10}%`;
}
