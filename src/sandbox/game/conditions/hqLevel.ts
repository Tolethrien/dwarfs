import { CAMP_BUILDINGS } from "../sceneData";
import type Condition from "./condition";

export function hqLevel(level: number): Condition {
  return {
    watches: ["headquarters"],
    isMet(scene) {
      return scene.sharedData.require(CAMP_BUILDINGS).mineLevel >= level;
    },
    describe() {
      return `Needs headquarters level ${level}`;
    },
  };
}
