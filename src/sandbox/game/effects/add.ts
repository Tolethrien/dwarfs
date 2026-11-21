import type Effect from "./effect";
import { STAT_NAMES, type StatName } from "./effect";

export function add(stat: StatName, amount: number): Effect {
  const props = { amount: amount };
  return {
    name: `Add ${stat}`,
    props: props,
    describe() {
      const sign = props.amount >= 0 ? "+" : "";
      return `${STAT_NAMES[stat]} ${sign}${props.amount}`;
    },
    modify(modifiers) {
      modifiers[stat].add += props.amount;
    },
  };
}
