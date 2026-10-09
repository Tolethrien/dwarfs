import PragmaSystem from "@pragma/system";
import Navi from "@navi/navi";
import UINode from "@navi/node";
import { px } from "@navi/units";
import { DrawGui } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import AxiomColor from "@axiom/color";
import { DecosID } from "@sandbox/content/decos";
import Minimap from "@sandbox/shaders/minimap";
import type World from "@sandbox/world/world";
import { tileType } from "@sandbox/world/tile";
import Terrain, {
  type DecoRemovedEvent,
  type TileMinedEvent,
  type TilePlacedEvent,
  type TileRevealedEvent,
} from "./terrain";

const LOOK = {
  plate: [22, 17, 14, 215] as RGBA,
  rim: [120, 88, 56, 230] as RGBA,
  shadow: AxiomColor.withAlpha([0, 0, 0, 255], 140),
  view: [242, 228, 204, 200] as RGBA,
  dwarf: [255, 225, 170, 255] as RGBA,
  torch: [255, 150, 60, 255] as RGBA,
  // design pixels
  size: { width: 250, height: 190 },
  padding: 6,
  // tiles across the window's width, it follows the camera
  tilesAcross: 110,
};

// the minimap's window: the map texture (Minimap.material) around the camera, the screen's view
// as a frame, torches and dwarfs as dots
class MinimapWindow extends UINode {
  constructor(private readonly owner: MinimapView) {
    super({
      size: { width: px(LOOK.size.width), height: px(LOOK.size.height) },
      input: "none",
      style: { backgroundColor: [0, 0, 0, 0] },
    });
  }

  public draw(box: Box) {
    this.owner.drawWindow(box);
  }
}

export default class MinimapView extends PragmaSystem {
  declare private world: World;
  private panel!: UINode;
  // tile index -> tile position of each torch deco
  private torches = new Map<number, Position2D>();

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  awake(): void {
    const refresh = (event: { gx: number; gy: number }) => Minimap.setTile(event.gx, event.gy);
    this.onSceneEvent<TileMinedEvent>("tileMined", refresh);
    this.onSceneEvent<TilePlacedEvent>("tilePlaced", refresh);
    this.onSceneEvent<TileRevealedEvent>("tileRevealed", refresh);
    this.onSceneEvent<DecoRemovedEvent>("decoRemoved", (event) => {
      if (event.type === DecosID.torch) this.torches.delete(this.world.tileIndex(event.gx, event.gy));
    });
    this.buildPanel();
  }

  start(): void {
    this.world = this.scene.getSystem(Terrain).world;
    const width = this.world.mapInTiles.width;
    for (const layer of ["back", "front"] as const)
      for (const [index, deco] of this.world.decos[layer])
        if (tileType(deco) === DecosID.torch)
          this.torches.set(index, { x: index % width, y: Math.floor(index / width) });
  }

  destroy(): void {
    Navi.remove(this.panel, Navi.root);
  }

  public drawWindow(box: Box) {
    const scale = Navi.getScale;
    const tile = this.world.meta.tileInPixels;
    const origin = this.world.meta.origin;
    const view = Camera.getViewBounds;
    // in tiles: where the window looks, how many pixels a tile gets
    const center = {
      x: ((view.min.x + view.max.x) / 2 - origin.x) / tile.width,
      y: ((view.min.y + view.max.y) / 2 - origin.y) / tile.height,
    };
    const pixelsPerTile = box.w / LOOK.tilesAcross;
    const middle = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const toWindow = (tileX: number, tileY: number) => ({
      x: middle.x + (tileX - center.x) * pixelsPerTile,
      y: middle.y + (tileY - center.y) * pixelsPerTile,
    });

    DrawGui.rect({
      position: { x: box.x, y: box.y },
      size: { width: box.w, height: box.h },
      rounded: 8 * scale,
      material: Minimap.material,
      params: [center.x, center.y, LOOK.tilesAcross, 0],
    });

    DrawGui.pushClip({
      position: { x: Math.floor(box.x), y: Math.floor(box.y) },
      size: { width: Math.ceil(box.w), height: Math.ceil(box.h) },
      rounded: 8 * scale,
    });
    for (const torch of this.torches.values()) {
      const at = toWindow(torch.x + 0.5, torch.y + 0.5);
      DrawGui.circle({
        position: at,
        radius: 1.6 * scale,
        color: LOOK.torch,
        shadow: { color: AxiomColor.withAlpha(LOOK.torch, 160), blur: 5 * scale },
      });
    }
    for (const actor of this.scene.getAllActors) {
      if (!actor.tags.has("dwarf")) continue;
      const position = actor.transform.getRenderPosition();
      const at = toWindow((position.x - origin.x) / tile.width, (position.y - origin.y) / tile.height);
      DrawGui.circle({
        position: at,
        radius: 2.4 * scale,
        color: LOOK.dwarf,
        shadow: { color: AxiomColor.withAlpha(LOOK.dwarf, 180), blur: 6 * scale },
      });
    }
    // what the screen shows right now
    const viewMin = toWindow((view.min.x - origin.x) / tile.width, (view.min.y - origin.y) / tile.height);
    const viewMax = toWindow((view.max.x - origin.x) / tile.width, (view.max.y - origin.y) / tile.height);
    DrawGui.rect({
      position: viewMin,
      size: { width: viewMax.x - viewMin.x, height: viewMax.y - viewMin.y },
      color: [0, 0, 0, 0],
      rounded: 3 * scale,
      outline: { width: 1.5 * scale, color: LOOK.view },
    });
    DrawGui.popClip();
  }

  private buildPanel() {
    this.panel = Navi.append(
      new UINode({
        position: { x: px(16), y: px(16) },
        size: { width: px(LOOK.size.width + LOOK.padding * 2), height: px(LOOK.size.height + LOOK.padding * 2) },
        input: "absorb",
        style: {
          anchorX: "end",
          anchorY: "end",
          backgroundColor: LOOK.plate,
          rounded: 12,
          outline: { width: 2, color: LOOK.rim },
          shadow: { color: LOOK.shadow, offset: { x: 0, y: 4 }, blur: 14 },
          padding: { top: LOOK.padding, right: LOOK.padding, bottom: LOOK.padding, left: LOOK.padding },
        },
      }),
    );
    Navi.append(new MinimapWindow(this), this.panel);
  }
}
