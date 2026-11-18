import AxiomMath from "@axiom/math";
import Easing, { type EasingName } from "@axiom/easing";
import Effect, { STAT_NAMES, type StatModifiers, type StatName } from "./effect";

interface TimedStatProps {
  stat: StatName;
  from: number;
  to: number;
  seconds: number;
  ease?: EasingName;
}

export default class TimedStat extends Effect {
  public readonly timed = true;

  constructor(private readonly props: TimedStatProps) {
    super();
  }

  public describe() {
    const props = this.props;
    return `${STAT_NAMES[props.stat]} ×${props.from} → ×${props.to} over ${props.seconds} s`;
  }

  public modifyAt(modifiers: StatModifiers, seconds: number) {
    const props = this.props;
    const progress = AxiomMath.clamp(seconds / props.seconds, 0, 1);
    const eased = Easing[props.ease ?? "linear"](progress);
    modifiers[props.stat].multiply *= AxiomMath.lerp(props.from, props.to, eased);
  }
}
