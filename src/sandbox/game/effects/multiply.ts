import Effect, { STAT_NAMES, type StatModifiers, type StatName } from "./effect";

export default class Multiply extends Effect {
  constructor(
    public readonly stat: StatName,
    public readonly factor: number,
  ) {
    super();
  }

  public describe() {
    return `${STAT_NAMES[this.stat]} ×${this.factor}`;
  }

  public modify(modifiers: StatModifiers) {
    modifiers[this.stat].multiply *= this.factor;
  }
}
