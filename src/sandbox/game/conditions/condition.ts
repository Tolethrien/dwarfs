import type PragmaScene from "@pragma/scene";

export type WatchTopic = "resources" | "headquarters" | "tavern" | "biomes" | "shaft" | "calendar" | "plans";

export default interface Condition {
  readonly watches: readonly WatchTopic[];
  isMet(scene: PragmaScene): boolean;
  describe(): string;
  missing?(scene: PragmaScene): string[];
}

export function missingOf(condition: Condition, scene: PragmaScene): string[] {
  if (condition.missing) return condition.missing(scene);
  return condition.isMet(scene) ? [] : [condition.describe()];
}
