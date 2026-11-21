import type Condition from "./condition";
import { missingOf, type WatchTopic } from "./condition";

export function all(...conditions: Condition[]): Condition {
  const watches = [...new Set(conditions.flatMap((condition) => condition.watches))] as WatchTopic[];
  return {
    watches: watches,
    isMet(scene) {
      return conditions.every((condition) => condition.isMet(scene));
    },
    describe() {
      return conditions.map((condition) => condition.describe()).join(", ");
    },
    missing(scene) {
      return conditions.flatMap((condition) => missingOf(condition, scene));
    },
  };
}
