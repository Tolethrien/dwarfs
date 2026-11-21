import type Effect from "./effect";
import { STAT_NAMES, type StatName } from "./effect";

export function multiply(stat: StatName, factor: number): Effect {
  const props = { factor: factor };
  return {
    name: `Multiply ${stat}`,
    props: props,
    describe() {
      return `${STAT_NAMES[stat]} ×${props.factor}`;
    },
    modify(modifiers) {
      modifiers[stat].multiply *= props.factor;
    },
  };
}
