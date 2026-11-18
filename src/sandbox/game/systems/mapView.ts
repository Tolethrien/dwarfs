import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import { Draw, Light, Post } from "@aurora/urp/draw/draw";
import type { MaterialParams } from "@aurora/urp/draw/drawTypes";
import type Material from "@aurora/material";
import type World from "../world/world";
import TileMap, { TILE_MAP_LAYER } from "../gpu/tileMap";
import GameGlobals, { MAP_LOOK } from "../gpu/gameGlobals";
import { biomeLooks } from "../gpu/biomeLooks";
import MistField from "../gpu/mistField";
import Mist from "../gpu/mist";
import StructurePlan from "../gpu/structurePlan";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import { assert } from "@axiom/utils";
import { BLOCKS, BlocksID, GLOW_STYLES } from "../content/blocks";
import { gamePanel, gameSwitch } from "../debugCommands";
import GameEvents from "./gameEvents";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import AxiomMath from "@axiom/math";
import Easing from "@axiom/easing";
import { SURFACE } from "../content/surface";
import { shaftColumns } from "../world/shaftShape";

const BLUEPRINT = {
  openSeconds: 0.5,
  closeSeconds: 0.25,
  everywhere: 1e6,
};

export default class MapView extends PragmaSystem {
  private readonly changed = new Set<number>();
  private readonly layers = {
    blocks: TileMap.material.pack({ layer: TILE_MAP_LAYER.blocks }),
    backgrounds: TileMap.material.pack({ layer: TILE_MAP_LAYER.backgrounds }),
    glow: TileMap.glow.pack({ layer: TILE_MAP_LAYER.glow }),
    blueprint: TileMap.blueprint.pack({ layer: TILE_MAP_LAYER.blueprint, radius: 0, center: 0 }),
  };
  private readonly blueprint = { progress: 0, opening: false, center: { x: 0, y: 0 }, reach: 0 };
  declare private mist: MistField;
  private mistShown = true;
  private aoShown = true;

  constructor(
    internal: InternalPSProps,
    private readonly world: World,
  ) {
    super(internal);
  }

  awake(): void {
    Post.setVignette(MAP_LOOK.post.vignette);
    Post.setColor(MAP_LOOK.post.color);
    Post.setDiffusion(MAP_LOOK.post.diffusion);
    const events = this.scene.getSystem(GameEvents);
    events.terrain.mined.connect((tile) => this.markOpened(tile.gx, tile.gy));
    events.terrain.damaged.connect((tile) => this.markChanged(tile.gx, tile.gy));
    events.terrain.changed.connect((tile) => this.markOpened(tile.gx, tile.gy));
    gameSwitch(
      "mist",
      "tunnel mist",
      () => this.mistShown,
      (on) => (this.mistShown = on),
    );
    gameSwitch(
      "ao",
      "background AO",
      () => this.aoShown,
      (on) => {
        this.aoShown = on;
        GameGlobals.setAo(on);
      },
    );
    this.glowPanel();
  }

  private glowPanel() {
    const look = MAP_LOOK.glow;
    const glowing = (Object.keys(BLOCKS).map(Number) as BlocksID[]).filter((id) => BLOCKS[id].glow);
    const slider = (min: number, max: number, step: number) => ({ kind: "slider" as const, min, max, step });
    const glowOf = (id: BlocksID) => {
      const glow = BLOCKS[id].glow;
      assert(glow !== undefined, `${BlocksID[id]} lost its glow`);
      return glow;
    };
    gamePanel("glow", {
      title: "Ore glow",
      sections: [
        {
          title: "All ores",
          call: "MAP_LOOK.glow",
          arg: "object",
          fields: [
            { key: "sparkles", control: slider(0, 0.5, 0.01) },
            { key: "sparkleSpeed", label: "sparkle speed", control: slider(0, 5, 0.05) },
            { key: "breathe", control: slider(0, 0.5, 0.01) },
            { key: "breatheSpeed", label: "breathe speed", control: slider(0, 2, 0.01) },
          ],
          get: () => ({
            sparkles: look.sparkle.density,
            sparkleSpeed: look.sparkle.speed,
            breathe: look.breathe.amount,
            breatheSpeed: look.breathe.speed,
          }),
          set: (values) => {
            if (typeof values.sparkles === "number") look.sparkle.density = values.sparkles;
            if (typeof values.sparkleSpeed === "number") look.sparkle.speed = values.sparkleSpeed;
            if (typeof values.breathe === "number") look.breathe.amount = values.breathe;
            if (typeof values.breatheSpeed === "number") look.breathe.speed = values.breatheSpeed;
            GameGlobals.refreshGlowLook();
          },
        },
        ...glowing.map((id) => ({
          title: BlocksID[id],
          call: `BLOCKS.${BlocksID[id]}.glow`,
          arg: "object" as const,
          fields: [
            { key: "color", control: { kind: "color" as const } },
            { key: "blend", control: slider(0, 1, 0.01) },
            { key: "shine", control: slider(0, 6, 0.05) },
            { key: "style", control: { kind: "select" as const, options: GLOW_STYLES } },
            { key: "sparkles", control: slider(0, 0.5, 0.005) },
            { key: "sparkleSpeed", label: "sparkle speed", control: slider(0, 8, 0.05) },
          ],
          get: () => {
            const glow = glowOf(id);
            const sparkle = glow.sparkle ?? look.sparkle;
            return {
              color: [...glow.color, 255],
              blend: glow.blend,
              shine: glow.shine,
              style: glow.style ?? "glow",
              sparkles: sparkle.density,
              sparkleSpeed: sparkle.speed,
            };
          },
          set: (values: Record<string, unknown>) => {
            const glow = glowOf(id);
            if (Array.isArray(values.color)) glow.color = [values.color[0], values.color[1], values.color[2]];
            if (typeof values.blend === "number") glow.blend = values.blend;
            if (typeof values.shine === "number") glow.shine = values.shine;
            const style = GLOW_STYLES.find((name) => name === values.style);
            if (style) glow.style = style;
            if (typeof values.sparkles === "number") glow.sparkle = { ...(glow.sparkle ?? look.sparkle), density: values.sparkles };
            if (typeof values.sparkleSpeed === "number") glow.sparkle = { ...(glow.sparkle ?? look.sparkle), speed: values.sparkleSpeed };
            GameGlobals.refreshMaterials();
          },
        })),
      ],
    });
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

  update(): void {
    this.spreadBlueprint();
  }

  // amount: 1 fills the tile's air
  public addDust(gx: number, gy: number, amount: number) {
    this.mist.addDust(gx, gy, amount);
  }

  public showBlueprint(from?: Position2D) {
    this.aimBlueprint(true, from);
  }

  // back to the point (the mouse as it is now): the camera may have gone far from where it opened
  public hideBlueprint(to?: Position2D) {
    this.aimBlueprint(false, to);
  }

  private aimBlueprint(opening: boolean, point = Camera.screenToWorld(InputManager.getMousePos())) {
    const world = this.world;
    const blueprint = this.blueprint;
    const tile = world.worldToTile(point);
    blueprint.center.x = AxiomMath.clamp(tile.x, 0, world.mapInTiles.width - 1);
    blueprint.center.y = AxiomMath.clamp(tile.y, 0, world.mapInTiles.height - 1);
    const view = Camera.getViewBounds;
    const min = world.worldToTile(view.min);
    const max = world.worldToTile(view.max);
    const width = Math.max(blueprint.center.x - min.x, max.x - blueprint.center.x);
    const height = Math.max(blueprint.center.y - min.y, max.y - blueprint.center.y);
    blueprint.reach = Math.hypot(width, height) + 1;
    blueprint.opening = opening;
  }

  // on real time: the bullet time doesn't slow the wave
  private spreadBlueprint() {
    const blueprint = this.blueprint;
    const target = blueprint.opening ? 1 : 0;
    if (blueprint.progress === target) return;
    const seconds = blueprint.opening ? BLUEPRINT.openSeconds : BLUEPRINT.closeSeconds;
    const step = Time.getRawDeltaTime() / seconds;
    blueprint.progress = AxiomMath.clamp(blueprint.progress + (blueprint.opening ? step : -step), 0, 1);
    const radius = blueprint.progress === 1 ? BLUEPRINT.everywhere : Easing.easeOutCubic(blueprint.progress) * blueprint.reach;
    const center = this.world.tileIndex(blueprint.center.x, blueprint.center.y);
    this.layers.blueprint = TileMap.blueprint.pack({ layer: TILE_MAP_LAYER.blueprint, radius: radius, center: center });
    StructurePlan.pack(radius, center);
  }

  render(): void {
    for (const index of this.changed) GameGlobals.write("tiles", index, this.word(index));
    this.changed.clear();
    const mistRows = this.mist.settle(Time.getDeltaTime());
    if (mistRows) GameGlobals.writeRange("mist", this.mist.words, mistRows.from, mistRows.count);
    const dustRows = this.mist.spreadDust(Time.getDeltaTime());
    if (dustRows) GameGlobals.writeRange("mist", this.mist.words, dustRows.from, dustRows.count);
    this.drawSurface();
    this.drawLayer(SORT_ORDER.background, TileMap.material, this.layers.backgrounds);
    this.drawLayer(SORT_ORDER.blocks, TileMap.material, this.layers.blocks);
    this.drawLayer(SORT_ORDER.glow, TileMap.glow, this.layers.glow);
    if (this.blueprint.progress > 0) this.drawLayer(SORT_ORDER.blueprint, TileMap.blueprint, this.layers.blueprint);
    if (!this.mistShown || this.blueprint.progress === 1) return;
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
      Mist.material.pack({ opacity: 1 - this.blueprint.progress, dust: dust, moteScale: moteScale, moteSize: moteSize }),
    );
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

  private markChanged(gx: number, gy: number) {
    this.changed.add(this.world.tileIndex(gx, gy));
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
