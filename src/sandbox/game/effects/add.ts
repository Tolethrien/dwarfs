import Effect, { STAT_NAMES, type StatModifiers, type StatName } from "./effect";

export default class Add extends Effect {
  constructor(
    public readonly stat: StatName,
    public readonly amount: number,
  ) {
    super();
  }

  public describe() {
    const sign = this.amount >= 0 ? "+" : "";
    return `${STAT_NAMES[this.stat]} ${sign}${this.amount}`;
  }

  public modify(modifiers: StatModifiers) {
    modifiers[this.stat].add += this.amount;
  }
}
