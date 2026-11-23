import type Drop from "./drop";

export function all<T>(...drops: Drop<T>[]): Drop<T> {
  const main = drops.find((drop) => drop.main !== undefined)?.main;
  return {
    main: main,
    roll(options) {
      return drops.flatMap((drop) => drop.roll(options));
    },
    describe(format) {
      return drops.map((drop) => drop.describe(format)).join(", ");
    },
  };
}
