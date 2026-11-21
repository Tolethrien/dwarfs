import { formatAmount, RESOURCES, type ResourcesID } from "../content/resources";
import { CAMP_STORE } from "../sceneData";
import type Condition from "./condition";

export function hasResource(id: ResourcesID, amount: number): Condition {
  return {
    watches: ["resources"],
    isMet(scene) {
      return scene.sharedData.require(CAMP_STORE).get(id) >= amount;
    },
    describe() {
      return `Needs ${formatAmount(id, amount)} ${RESOURCES[id].name}`;
    },
  };
}
