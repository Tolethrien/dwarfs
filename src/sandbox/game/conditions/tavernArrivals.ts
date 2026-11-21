import { assert } from "@axiom/utils";
import { BuildingsID } from "../content/structures";
import Tavern from "../components/buildings/tavern";
import { CAMP_BUILDINGS } from "../sceneData";
import type Condition from "./condition";

export function tavernArrivals(count: number): Condition {
  return {
    watches: ["tavern"],
    isMet(scene) {
      const actor = scene.sharedData.require(CAMP_BUILDINGS).actorOf(BuildingsID.tavern);
      if (!actor) return false;
      const tavern = actor.getComponent(Tavern);
      assert(tavern !== undefined, "The tavern has no Tavern");
      return tavern.arrivalsCount >= count;
    },
    describe() {
      return count === 1 ? "Wait for new recruits in the tavern" : `Wait for ${count} recruit arrivals in the tavern`;
    },
  };
}
