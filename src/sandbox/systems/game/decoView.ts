import PragmaSystem from "@pragma/system";
import type PragmaActor from "@pragma/actor";
import { DecosID, type DecoLayer } from "@sandbox/content/decos";
import Torch from "@sandbox/bActors/torch";
import type World from "@sandbox/world/world";
import Terrain, { type DecoRemovedEvent } from "./terrain";
import type { ChunkHiddenEvent, ChunkShownEvent } from "./chunkView";

// decos drawn by an actor instead of the chunk batch (ChunkView skips them); position = tile centre
export const DECO_ACTORS: Partial<
  Record<DecosID, (position: Position2D, variant: number) => PragmaActor>
> = {
  [DecosID.torch]: (position, variant) => new Torch({ position, variant }),
};

export default class DecoView extends PragmaSystem {
  declare private world: World;
  private actors = new Map<number, Map<string, PragmaActor>>();

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  awake(): void {
    this.world = this.scene.getSystem(Terrain).world;
    this.onSceneEvent<ChunkShownEvent>("chunkShown", (event) =>
      this.show(event.chunk),
    );
    this.onSceneEvent<ChunkHiddenEvent>("chunkHidden", (event) =>
      this.hide(event.chunk),
    );
    this.onSceneEvent<DecoRemovedEvent>("decoRemoved", (event) => {
      const chunk = this.world.chunkOfTile(event.gx, event.gy);
      const key = this.key(event.layer, event.gx, event.gy);
      const actor = this.actors.get(chunk)?.get(key);
      if (!actor) return;
      actor.selfDestroy();
      this.actors.get(chunk)?.delete(key);
    });
  }

  destroy(): void {}

  private show(chunk: number) {
    const origin = this.world.chunkOrigin(chunk);
    const chunkInTiles = this.world.meta.chunkInTiles;
    const actors = new Map<string, PragmaActor>();
    for (const layer of ["back", "front"] as const) {
      for (let ly = 0; ly < chunkInTiles.height; ly++) {
        for (let lx = 0; lx < chunkInTiles.width; lx++) {
          const gx = origin.x + lx;
          const gy = origin.y + ly;
          const type = this.world.getDecoType(layer, gx, gy) as DecosID;
          const spawn = DECO_ACTORS[type];
          if (!spawn) continue;
          const position = this.world.tileCenterToWorld({ x: gx, y: gy });
          const actor = spawn(position, this.world.getDecoVariant(layer, gx, gy));
          this.scene.spawnActor(actor);
          actors.set(this.key(layer, gx, gy), actor);
        }
      }
    }
    if (actors.size > 0) this.actors.set(chunk, actors);
  }

  private hide(chunk: number) {
    const actors = this.actors.get(chunk);
    if (!actors) return;
    for (const actor of actors.values()) actor.selfDestroy();
    this.actors.delete(chunk);
  }

  private key(layer: DecoLayer, gx: number, gy: number) {
    return `${layer}:${gx}:${gy}`;
  }
}
