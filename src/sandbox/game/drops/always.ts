import type Drop from "./drop";
import { rollAmount, toRange, type AmountInput } from "./drop";

export function always<T>(id: T, amount: AmountInput): Drop<T> {
  const range = toRange(amount);
  const main = { id: id, amount: range };
  return {
    main: main,
    roll(options) {
      return [{ id: id, amount: rollAmount(range, options?.step) }];
    },
    describe(format) {
      return format(id, range);
    },
  };
}
