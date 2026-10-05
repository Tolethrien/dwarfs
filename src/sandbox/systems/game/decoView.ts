import PragmaSystem from "@pragma/system";
import type PragmaActor from "@pragma/actor";
import { DecosID, getDeco, type DecoLayer } from "@sandbox/content/decos";
import Torch from "@sandbox/bActors/torch";
import type World from "@sandbox/world/world";
import Terrain, { type DecoRemovedEvent } from "./terrain";
import type { ChunkHiddenEvent, ChunkShownEvent } from "./chunkView";

// decos drawn by an actor instead of the chunk batch (ChunkView skips them)
export const DECO_ACTORS: Partial<
  Record<DecosID, (position: Position2D, size: Size2D) => PragmaActor>
> = {
  [DecosID.torch]: (position, size) => new Torch({ position, size }),
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
          const area = getDeco(type).area;
          const tile = this.world.tileToWorld({ x: gx, y: gy });
          const position = {
            x: tile.x + area.x + area.width / 2,
            y: tile.y + area.y + area.height / 2,
          };
          const actor = spawn(position, {
            width: area.width,
            height: area.height,
          });
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
