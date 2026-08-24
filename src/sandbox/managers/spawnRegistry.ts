import PragmaActor from "@/core/pragma/actor";
import { BlocksID } from "./entitiesObject";
import Chest from "../bActors/chest";

export interface SpawnContext {
  position: Position2D;
  type: BlocksID;
}

/** nazwa z BlockData.spawns -> builder aktora */
export const SPAWN_REGISTRY: Record<
  string,
  (ctx: SpawnContext) => PragmaActor
> = {
  chest: (ctx) => new Chest({ position: ctx.position }),
};
