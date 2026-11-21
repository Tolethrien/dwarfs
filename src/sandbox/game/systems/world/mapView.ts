import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import { Draw, Light } from "@aurora/urp/draw/draw";
import type { MaterialParams } from "@aurora/urp/draw/drawTypes";
import type Material from "@aurora/material";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import AxiomMath from "@axiom/math";
import Easing from "@axiom/easing";
import type World from "../../world/world";
import { WORLD } from "../../sceneData";
import TileMap, { TILE_MAP_LAYER } from "../../gpu/tileMap";
import GameGlobals, { MAP_LOOK } from "../../gpu/gameGlobals";
import { biomeLooks } from "../../gpu/biomeLooks";
import MistField from "../../gpu/mistField";
import Mist from "../../gpu/mist";
import StructurePlan from "../../gpu/structurePlan";
import { RENDER_SHEET, SORT_ORDER } from "../../content/render";
import { SURFACE } from "../../content/surface";
import { shaftColumns } from "../../world/shaftShape";
import GameEvents from "../core/gameEvents";
import type { TileStruck } from "./terrain";

const BLUEPRINT = {
  openSeconds: 0.5,
  closeSeconds: 0.25,
  everywhere: 1e6,
};

const UPLOAD = {
  initialScratch: 256,
};

export default class MapView extends PragmaSystem {
  private readonly changed = new Set<number>();
  private uploadScratch = new Uint32Array(UPLOAD.initialScratch);
  private readonly layers = {
    blocks: TileMap.material.pack({ layer: TILE_MAP_LAYER.blocks }),
    backgrounds: TileMap.material.pack({ layer: TILE_MAP_LAYER.backgrounds }),
    glow: TileMap.glow.pack({ layer: TILE_MAP_LAYER.glow }),
    blueprint: TileMap.blueprint.pack({ layer: TILE_MAP_LAYER.blueprint, radius: 0, center: 0 }),
  };
  private blueprintProgress = 0;
  declare private mist: MistField;
  public mistShown = true;
  private ao = true;
  private readonly world: World;

  constructor(internal: InternalPSProps) {
    super(internal);
    this.world = this.scene.sharedData.require(WORLD);
  }

  awake(): void {
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.terrain.mined, (tile) => this.onMined(tile));
    this.connect(events.terrain.damaged, (tile) => this.markChanged(tile.gx, tile.gy));
    this.connect(events.terrain.changed, (tile) => this.markOpened(tile.gx, tile.gy));
  }

  destroy(): void {
    this.stopAllCoroutines();
  }

  public get aoShown() {
    return this.ao;
  }

  public showAo(on: boolean) {
    this.ao = on;
    GameGlobals.setAo(on);
  }

  start(): void {
    const words = new Uint32Array(this.world.totalTiles);
    for (let index = 0; index < words.length; index++) words[index] = this.word(index);
    GameGlobals.upload("tiles", words);
    GameGlobals.upload("backgrounds", Uint32Array.from(this.world.backgrounds));
    GameGlobals.upload("biomeLooks", biomeLooks(this.world));
    this.mist = new MistField(this.world);
    GameGlobals.upload("mist", this.mist.words);
  }

  // amount: 1 fills the tile's air
  public addDust(gx: number, gy: number, amount: number) {
    this.mist.addDust(gx, gy, amount);
  }

  public showBlueprint(from?: Position2D) {
    this.spreadBlueprint(true, from);
  }

  // back to the point (the mouse as it is now): the camera may have gone far from where it opened
  public hideBlueprint(to?: Position2D) {
    this.spreadBlueprint(false, to);
  }

  // on real time: the bullet time doesn't slow the wave; a reversal takes the key over
  private spreadBlueprint(opening: boolean, point = Camera.screenToWorld(InputManager.getMousePos())) {
    const target = opening ? 1 : 0;
    if (this.blueprintProgress === target) {
      this.stopCoroutine("blueprint");
      return;
    }
    const world = this.world;
    const tile = world.worldToTile(point);
    const centerX = AxiomMath.clamp(tile.x, 0, world.mapInTiles.width - 1);
    const centerY = AxiomMath.clamp(tile.y, 0, world.mapInTiles.height - 1);
    const view = Camera.getViewBounds;
    const min = world.worldToTile(view.min);
    const max = world.worldToTile(view.max);
    const width = Math.max(centerX - min.x, max.x - centerX);
    const height = Math.max(centerY - min.y, max.y - centerY);
    const reach = Math.hypot(width, height) + 1;
    const center = world.tileIndex(centerX, centerY);
    const seconds = opening ? BLUEPRINT.openSeconds : BLUEPRINT.closeSeconds;
    const mapView = this;
    this.startCoroutine(
      function* wave() {
        while (mapView.blueprintProgress !== target) {
          const step = Time.getRawDeltaTime() / seconds;
          mapView.blueprintProgress = AxiomMath.clamp(mapView.blueprintProgress + (opening ? step : -step), 0, 1);
          const radius =
            mapView.blueprintProgress === 1
              ? BLUEPRINT.everywhere
              : Easing.easeOutCubic(mapView.blueprintProgress) * reach;
          mapView.layers.blueprint = TileMap.blueprint.pack({
            layer: TILE_MAP_LAYER.blueprint,
            radius: radius,
            center: center,
          });
          StructurePlan.pack(radius, center);
          yield;
        }
      },
      { key: "blueprint", time: "real" },
    );
  }

  render(): void {
    this.flushChanged();
    const mistRows = this.mist.settle(Time.getDeltaTime());
    if (mistRows) GameGlobals.writeRange("mist", this.mist.words, mistRows.from, mistRows.count);
    const dustRows = this.mist.spreadDust(Time.getDeltaTime());
    if (dustRows) GameGlobals.writeRange("mist", this.mist.words, dustRows.from, dustRows.count);
    this.drawSurface();
    this.drawLayer(SORT_ORDER.background, TileMap.material, this.layers.backgrounds);
    this.drawLayer(SORT_ORDER.blocks, TileMap.material, this.layers.blocks);
    this.drawLayer(SORT_ORDER.glow, TileMap.glow, this.layers.glow);
    if (this.blueprintProgress > 0) this.drawLayer(SORT_ORDER.blueprint, TileMap.blueprint, this.layers.blueprint);
    if (!this.mistShown || this.blueprintProgress === 1) return;
    const zoom = MAP_LOOK.dust.zoom;
    const dust = AxiomMath.clamp(AxiomMath.inverseLerp(zoom.hidden, zoom.whole, Camera.getZoom), 0, 1);
    // the motes keep their count on screen: bigger and sparser in the world when zoomed out, by
    // whole zoom levels, so they reshuffle once a level instead of crawling through every zoom
    const moteScale = 2 ** Math.round(-Math.log2(Camera.getZoom));
    const farMotes = MAP_LOOK.dust.farMotes;
    const moteSize = moteScale >= 1 / farMotes.zoom ? farMotes.size : 1;
    this.drawLayer(
      SORT_ORDER.mist,
      Mist.material,
      Mist.material.pack({
        opacity: 1 - this.blueprintProgress,
        dust: dust,
        moteScale: moteScale,
        moteSize: moteSize,
      }),
    );
  }

  private flushChanged() {
    if (this.changed.size === 0) return;
    if (this.changed.size === 1) {
      const only = this.changed.values().next().value as number;
      GameGlobals.write("tiles", only, this.word(only));
      this.changed.clear();
      return;
    }
    const indices = [...this.changed].sort((first, second) => first - second);
    this.changed.clear();
    let runStart = indices[0];
    let runLength = 1;
    const upload = () => {
      if (this.uploadScratch.length < runLength) this.uploadScratch = new Uint32Array(runLength);
      for (let offset = 0; offset < runLength; offset++) this.uploadScratch[offset] = this.word(runStart + offset);
      GameGlobals.writeRange("tiles", this.uploadScratch, runStart, runLength, 0);
    };
    for (let cursor = 1; cursor < indices.length; cursor++) {
      if (indices[cursor] === runStart + runLength) {
        runLength++;
        continue;
      }
      upload();
      runStart = indices[cursor];
      runLength = 1;
    }
    upload();
  }

  private drawSurface() {
    Draw.rect({
      position: { x: 0, y: -SURFACE.height, z: SORT_ORDER.background },
      size: { width: this.world.mapInPixels.width, height: SURFACE.height },
      color: SURFACE.color,
    });
    this.drawStrip(RENDER_SHEET.caveCeiling, SURFACE.ceiling, -SURFACE.height);
    this.drawStrip(RENDER_SHEET.caveFloor, SURFACE.floor, -SURFACE.floor.height);
    const light = SURFACE.light;
    Light.rect({
      position: { x: 0, y: -SURFACE.height },
      size: { width: this.world.mapInPixels.width, height: SURFACE.height },
      color: light.hall.color,
      intensity: light.hall.intensity,
      softness: light.hall.softness,
    });
    const columns = shaftColumns(this.world);
    Light.point({
      position: { x: ((columns.from + columns.to + 1) / 2) * this.world.meta.tileInPixels, y: -SURFACE.ground },
      radius: light.mouth.radius,
      color: light.mouth.color,
      intensity: light.mouth.intensity,
    });
  }

  // every other copy mirrored: the copies meet edge to edge without a seam
  private drawStrip(texture: string, strip: Size2D, top: number) {
    const width = this.world.mapInPixels.width;
    for (let left = 0, copy = 0; left < width; left += strip.width, copy++) {
      const shown = Math.min(strip.width, width - left);
      const mirrored = copy % 2 === 1;
      Draw.sprite({
        position: { x: left, y: top, z: SORT_ORDER.background },
        size: { width: shown, height: strip.height },
        texture: texture,
        crop: { x: mirrored ? strip.width - shown : 0, y: 0, width: shown, height: strip.height },
        flipX: mirrored,
      });
    }
  }

  private drawLayer(z: number, material: Material, params: MaterialParams) {
    Draw.rect({
      position: { x: 0, y: 0, z: z },
      size: this.world.mapInPixels,
      material: material,
      params: params,
    });
  }

  // dust also off screen: it still hangs there when the camera comes
  private onMined(tile: TileStruck) {
    this.markOpened(tile.gx, tile.gy);
    const dust = MAP_LOOK.dust;
    const force = tile.hit.piercing ? 1 : AxiomMath.clamp(AxiomMath.inverseLerp(1, dust.fullForce, tile.ratio), 0, 1);
    this.mist.addDust(tile.gx, tile.gy, AxiomMath.lerp(dust.perBreak.weak, dust.perBreak.strong, force));
  }

  private markChanged(gx: number, gy: number) {
    const index = this.world.tileIndex(gx, gy);
    if (index !== -1) this.changed.add(index);
  }

  private markOpened(gx: number, gy: number) {
    this.markChanged(gx, gy);
    this.mist.markChanged(gx, gy);
  }

  // must match the tiles global in shaders/globals.wgsl
  private word(index: number) {
    return this.world.solid[index] | ((this.world.damage.get(index) ?? 0) << 16);
  }
}
