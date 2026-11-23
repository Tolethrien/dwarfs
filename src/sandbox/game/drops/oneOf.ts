import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import type Drop from "./drop";
import { formatPercent, rollAmount, toRange, type AmountInput, type AmountRange } from "./drop";

export interface WeightedDropInput<T> {
  id: T;
  amount: AmountInput;
  weight: number;
}

interface WeightedDropEntry<T> {
  id: T;
  amount: AmountRange;
  weight: number;
}

export function oneOf<T>(probability: number, entries: WeightedDropInput<T>[]): Drop<T> {
  assert(entries.length > 0, "oneOf drop needs at least one entry");
  const normalized: WeightedDropEntry<T>[] = entries.map((entry) => ({
    id: entry.id,
    amount: toRange(entry.amount),
    weight: entry.weight,
  }));
  const weights = normalized.map((entry) => entry.weight);
  return {
    roll(options) {
      if (!AxiomMath.randomBool(probability)) return [];
      const picked = AxiomMath.weightedRandom(normalized, weights);
      return [{ id: picked.id, amount: rollAmount(picked.amount, options?.step) }];
    },
    describe(format) {
      const items = normalized.map((entry) => format(entry.id, entry.amount)).join(" / ");
      return `${items} (${formatPercent(probability)})`;
    },
  };
}
