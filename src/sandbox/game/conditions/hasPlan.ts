import PlayerStats from "../systems/core/playerStats";
import type Condition from "./condition";

export function hasPlan(plan: string, description: string): Condition {
  return {
    watches: ["plans"],
    isMet(scene) {
      return scene.getSystem(PlayerStats).hasPlan(plan);
    },
    describe() {
      return description;
    },
  };
}
