import AxiomMath from "@axiom/math";
import Easing, { type EasingName } from "@axiom/easing";
import type Effect from "./effect";
import { STAT_NAMES, type StatName } from "./effect";

interface TimedStatProps {
  stat: StatName;
  from: number;
  to: number;
  seconds: number;
  ease?: EasingName;
}

export function timedStat(props: TimedStatProps): Effect {
  return {
    name: `TimedStat ${props.stat}`,
    props: props,
    describe() {
      return `${STAT_NAMES[props.stat]} ×${props.from} → ×${props.to} over ${props.seconds} s`;
    },
    modifyAt(modifiers, seconds) {
      const progress = AxiomMath.clamp(seconds / props.seconds, 0, 1);
      const eased = Easing[props.ease ?? "linear"](progress);
      modifiers[props.stat].multiply *= AxiomMath.lerp(props.from, props.to, eased);
    },
  };
}
