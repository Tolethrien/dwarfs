import AxiomMath from "@axiom/math";
import type Drop from "./drop";
import { formatPercent, rollAmount, toRange, type AmountInput } from "./drop";

export function chance<T>(id: T, amount: AmountInput, probability: number): Drop<T> {
  const range = toRange(amount);
  return {
    roll(options) {
      if (!AxiomMath.randomBool(probability)) return [];
      return [{ id: id, amount: rollAmount(range, options?.step) }];
    },
    describe(format) {
      return `${format(id, range)} (${formatPercent(probability)})`;
    },
  };
}
