import PragmaSystem from "@pragma/system";
import AssetManager from "@aurora/assetManager";
import { Draw } from "@aurora/urp/draw/draw";
import type { MaterialParams } from "@aurora/urp/draw/drawTypes";
import { Camera } from "@engine/camera/camera";
import { DECORATIONS, type DecoSupport } from "../../content/decorations";
import { LIGHTS, type LightsID } from "../../content/lights";
import { RENDER_SHEET, SORT_ORDER } from "../../content/render";
import { shine } from "../../components/common/lamp";
import Glow from "../../gpu/glow";
import StructurePlan from "../../gpu/structurePlan";
import { WORLD } from "../../sceneData";
import type World from "../../world/world";
import type { DecoPlacement } from "../../world/world";
import Discovery from "./discovery";
import GameEvents from "../core/gameEvents";
import Terrain from "./terrain";

const DECO_VIEW = {
  spriteMargin: 1,
  lightMargin: 4,
};

export default class Decos extends PragmaSystem {
  private readonly world: World;
  private readonly tile: number;
  private readonly glowMaskLayer: number;
  private readonly glowParams = new Map<LightsID, MaterialParams>();
  declare private terrain: Terrain;
  declare private discovery: Discovery;

  constructor(internal: InternalPSProps) {
    super(internal);
    this.world = this.scene.sharedData.require(WORLD);
    this.tile = this.world.meta.tileInPixels;
    this.glowMaskLayer = AssetManager.getTexture(RENDER_SHEET.decoGlow).index;
  }

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.discovery = this.scene.getSystem(Discovery);
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.terrain.mined, (tile) => this.updateAround(tile.gx, tile.gy));
    this.connect(events.terrain.changed, (tile) => this.updateAround(tile.gx, tile.gy));
  }

  public refreshGlow() {
    this.glowParams.clear();
  }

  render(): void {
    const world = this.world;
    if (world.decos.size === 0) return;
    const view = Camera.getViewBounds;
    const tile = this.tile;
    const size = world.mapInTiles;
    const spriteMinX = Math.max(Math.floor(view.min.x / tile) - DECO_VIEW.spriteMargin, 0);
    const spriteMaxX = Math.min(Math.floor(view.max.x / tile) + DECO_VIEW.spriteMargin, size.width - 1);
    const spriteMinY = Math.max(Math.floor(view.min.y / tile) - DECO_VIEW.spriteMargin, 0);
    const spriteMaxY = Math.min(Math.floor(view.max.y / tile) + DECO_VIEW.spriteMargin, size.height - 1);
    const fromX = Math.max(spriteMinX - DECO_VIEW.lightMargin, 0);
    const toX = Math.min(spriteMaxX + DECO_VIEW.lightMargin, size.width - 1);
    const fromY = Math.max(spriteMinY - DECO_VIEW.lightMargin, 0);
    const toY = Math.min(spriteMaxY + DECO_VIEW.lightMargin, size.height - 1);
    const blueprint = StructurePlan.isShown;
    const fogShown = this.discovery.fogShown;

    for (let gy = fromY; gy <= toY; gy++)
      for (let gx = fromX; gx <= toX; gx++) {
        const list = world.decos.get(gx + gy * size.width);
        if (!list) continue;
        const inView = gx >= spriteMinX && gx <= spriteMaxX && gy >= spriteMinY && gy <= spriteMaxY;
        let discovered: boolean | undefined;
        for (const deco of list) {
          const data = DECORATIONS[deco.id];
          const draw = inView && !(blueprint && deco.layer === "front");
          const canShine = !blueprint && data.light !== undefined && LIGHTS[data.light].intensity > 0;
          if (!draw && !canShine) continue;
          const box = this.boxOf(gx, gy, deco, data.anchor);
          if (draw)
            Draw.sprite({
              position: {
                x: box.x,
                y: box.y,
                z: deco.layer === "front" ? SORT_ORDER.decoFront : SORT_ORDER.decoBack,
              },
              size: { width: box.size, height: box.size },
              texture: RENDER_SHEET.items,
              crop: data.crop,
              flipX: deco.flipX,
              material: data.light !== undefined ? Glow.material : undefined,
              params: data.light !== undefined ? this.paramsFor(data.light) : undefined,
            });
          if (!canShine) continue;
          discovered ??= !fogShown || world.isTileDiscovered(gx, gy);
          if (discovered)
            shine(data.light!, { x: box.x + box.size / 2, y: box.y + box.size / 2 }, deco.phase);
        }
      }
  }

  private paramsFor(light: LightsID) {
    let params = this.glowParams.get(light);
    if (!params) {
      params = Glow.material.pack({
        intensity: LIGHTS[light].glow ?? 1,
        maskLayer: this.glowMaskLayer,
      });
      this.glowParams.set(light, params);
    }
    return params;
  }

  private boxOf(gx: number, gy: number, deco: DecoPlacement, anchor: Position2D) {
    const tile = this.tile;
    const size = tile * deco.scale;
    const pin = this.pinOf(gx, gy, deco.support, deco.offset);
    const anchorX = deco.flipX ? 1 - anchor.x : anchor.x;
    return {
      x: pin.x - anchorX * size,
      y: pin.y - anchor.y * size,
      size: size,
    };
  }

  private pinOf(gx: number, gy: number, support: DecoSupport, offset: number): Position2D {
    const tile = this.tile;
    switch (support) {
      case "floor":
        return { x: (gx + 0.5 + offset) * tile, y: (gy + 1) * tile };
      case "ceiling":
        return { x: (gx + 0.5 + offset) * tile, y: gy * tile };
      case "left":
        return { x: gx * tile, y: (gy + 0.5 + offset) * tile };
      case "right":
        return { x: (gx + 1) * tile, y: (gy + 0.5 + offset) * tile };
      case "topLeft":
        return { x: gx * tile, y: gy * tile };
      case "topRight":
        return { x: (gx + 1) * tile, y: gy * tile };
      case "none":
        return { x: (gx + 0.5 + offset) * tile, y: (gy + 0.5) * tile };
    }
  }

  private updateAround(gx: number, gy: number) {
    this.prune(gx, gy);
    this.prune(gx, gy - 1);
    this.prune(gx, gy + 1);
    this.prune(gx - 1, gy);
    this.prune(gx + 1, gy);
  }

  private prune(gx: number, gy: number) {
    this.world.removeDecos(gx, gy, (deco) => !this.hasSupport(gx, gy, deco.support));
  }

  private hasSupport(gx: number, gy: number, support: DecoSupport) {
    if (this.terrain.isSolid(gx, gy)) return false;
    switch (support) {
      case "floor":
        return this.terrain.isSolid(gx, gy + 1);
      case "ceiling":
        return this.terrain.isSolid(gx, gy - 1);
      case "left":
        return this.terrain.isSolid(gx - 1, gy);
      case "right":
        return this.terrain.isSolid(gx + 1, gy);
      case "topLeft":
        return this.terrain.isSolid(gx, gy - 1) && this.terrain.isSolid(gx - 1, gy);
      case "topRight":
        return this.terrain.isSolid(gx, gy - 1) && this.terrain.isSolid(gx + 1, gy);
      case "none":
        return true;
    }
  }
}
