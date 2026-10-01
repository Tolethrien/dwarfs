import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { ACTION } from "../../inputActions";
import { getDeco, type DecoLayer } from "../../content/decos";
import type World from "../../world/world";
import type Interactive from "../../components/interactive";
import type { ClickedEvent } from "../../components/interactive";
import Terrain from "./terrain";

export interface TileClickedEvent {
  gx: number;
  gy: number;
  type: number;
}
export interface DecoClickedEvent {
  gx: number;
  gy: number;
  layer: DecoLayer;
  type: number;
}

// input: one click, one target, front to back: the front deco, an actor (its Interactive gets the
// actor event "clicked"), the back deco, the tile. Tiles and decos are data, they get scene events
export default class InteractiveElements extends PragmaSystem {
  declare private world: World;
  // a click is rare and there are few of them, a scan is enough (actors move, a grid would need updating)
  private targets = new Set<Interactive>();

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  start(): void {
    this.world = this.scene.getSystem(Terrain).world;
  }

  public register(interactive: Interactive) {
    this.targets.add(interactive);
  }

  public unregister(interactive: Interactive) {
    this.targets.delete(interactive);
  }

  preUpdate(): void {
    if (!InputManager.onActionPressed(ACTION.interact)) return;
    const point = Camera.screenToWorld(InputManager.getMousePos());
    const tile = this.world.worldToTile(point);

    if (this.clickDeco("front", tile, point)) return;
    for (const target of this.targets) {
      if (!target.getEnabled() || !target.contains(point)) continue;
      target.emitActorEvent<ClickedEvent>("clicked", { point });
      return;
    }
    if (this.clickDeco("back", tile, point)) return;
    if (!this.world.inside(tile.x, tile.y)) return;

    const type = this.world.getType(tile.x, tile.y);
    this.emitSceneEvent<TileClickedEvent>("tileClicked", {
      gx: tile.x,
      gy: tile.y,
      type,
    });
  }

  // only a clickable deco, and only inside its area: a mushroom at the bottom of the tile does not
  // take a click on the top half
  private clickDeco(layer: DecoLayer, tile: Position2D, point: Position2D) {
    const type = this.world.getDecoType(layer, tile.x, tile.y);
    if (type === 0) return false;
    const deco = getDeco(type);
    if (!deco.clickable) return false;
    const origin = this.world.tileToWorld(tile);
    const x = point.x - origin.x - deco.area.x;
    const y = point.y - origin.y - deco.area.y;
    if (x < 0 || y < 0 || x > deco.area.width || y > deco.area.height)
      return false;
    this.emitSceneEvent<DecoClickedEvent>("decoClicked", {
      gx: tile.x,
      gy: tile.y,
      layer,
      type,
    });
    return true;
  }
}
