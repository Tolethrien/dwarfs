import Aurora from "@aurora/core";
import AssetManager from "@aurora/assetManager";
import { ByteWriter } from "@axiom/bytes";
import AxiomColor from "@axiom/color";
import { assert } from "@axiom/utils";
import AxiomMath from "@axiom/math";
import {
  BLOCK_CROPS,
  BLOCK_LOOKS,
  BLOCKS,
  blocksSight,
  BlocksID,
  GLOW_STYLES,
  type BlockData,
} from "../content/blocks";
import { RENDER_SHEET } from "../content/render";
import { BACKGROUNDS, BackgroundsID } from "../content/backgrounds";
import type { WorldMeta } from "../world/world";
import type { BuildingSprite } from "../world/buildingShape";
import { Light } from "@aurora/urp/draw/draw";
import globalsShader from "../shaders/globals.wgsl?raw";
import occlusionShader from "../shaders/occlusion.wgsl?raw";
import ambientShader from "../shaders/ambient.wgsl?raw";

// must match shaders/globals.wgsl: the bindings, TileMaterial (32 bytes in an array), Map and the
// flags; perTile: the globals sized by the map's tiles (biomeLooks: two u32 a tile). A shader stage
// takes at most 8 storage buffers on common hardware and the engine needs one: what goes together
// shares a buffer (the backgrounds' materials after the blocks', a biome's tint with its ambient)
const GAME_GLOBALS = {
  binding: {
    tiles: 4,
    materials: 5,
    map: 6,
    backgrounds: 7,
    biomeLooks: 8,
    fog: 9,
    mist: 10,
  },
  perTile: ["tiles", "backgrounds", "biomeLooks", "mist"] as const,
  materialBytes: 32,
  // the placeholder before the map: as big as a tile's widest entry (biomeLooks' vec2u), the
  // lights draw with it in the menu
  placeholderBytes: 8,
  mapBytes: 848,
  buildingMasks: 16,
  flags: { solid: 1, ownColors: 2, glowStyleShift: 2 },
  sparkleSpeedMax: 8,
};

type PerTile = (typeof GAME_GLOBALS.perTile)[number];

export const MAP_LOOK = {
  damagedShade: 0.7,
  lightIntoRock: 96,
  // cool and readable, so the lamps' warm light stands out of it
  ambient: { color: [175, 192, 230] as RGB, level: 0.32 },
  post: {
    vignette: { intensity: 0.35, smoothness: 0.6 },
    color: { temperature: 0.12, saturation: 1.08 },
    // dusty air: the lamps' light spreads into it, warm
    diffusion: { amount: 0.12, radius: 5, haze: 0.04, hazeColor: [255, 214, 170, 255] as RGBA },
  },
  ao: { width: 0.5, strength: 0.55 },
  background: { shade: 0.58, saturation: 0.5 },
  mist: {
    around: { side: 4, above: 3, below: 5 },
    full: 0.6,
    least: 0.04,
    flow: 2.5,
    color: [170, 180, 195] as RGB,
    scatter: 2.5,
    opacity: 0.5,
    depth: { top: 0.35, bottom: 1 },
    frequency: 0.12,
    // toward the shaft and up it, tiles a second: lazy, the banks mostly curl in place
    draft: 0.25,
  },
  // the dust a break throws into the air (mistField.ts): fade, seconds for it to thin to about a
  // third with no new dust; spread, how fast a tile evens out with its open neighbours, a second;
  // perBreak, the dust of a barely broken block and of one broken with full force, 1 a full tile;
  // zoom: camera zoom where it is gone and where it shows whole, a view of the whole mine skips it;
  // farMotes: at this zoom and further out the specks shrink to this share, to single pixels
  dust: {
    zoom: { hidden: 0.17, whole: 0.25 },
    farMotes: { zoom: 0.25, size: 0.5 },
    fade: 15,
    spread: 1.5,
    fullForce: 2,
    perBreak: { weak: 0.25, strong: 0.8 },
  },
  glow: {
    sparkle: { density: 0.01, speed: 0.45 },
    breathe: { amount: 0.15, speed: 0.2 },
  },
  blueprint: {
    paper: [39, 89, 153] as RGB,
    line: [225, 237, 255] as RGB,
    rockDark: [26, 52, 92] as RGB,
    rockLight: [84, 118, 166] as RGB,
    rockLine: [150, 180, 220] as RGB,
    unknown: [22, 44, 78] as RGB,
    hatch: [48, 80, 124] as RGB,
    hatchPerTile: 2,
    strength: { open: 1, blocks: 0.7 },
    structureDark: [16, 50, 110] as RGB,
    structureLight: [110, 180, 240] as RGB,
    token: [70, 130, 200] as RGB,
    structureLines: { from: 0.08, to: 0.25, inner: 0.6, outline: 1 },
    tokenLines: { inner: 0.3, outline: 1 },
  },
};

export default class GameGlobals {
  // in front of a shader that reads the globals, WGSL has no include
  public static readonly shader = globalsShader;
  private static readonly perTile = new Map<PerTile, GPUBuffer>();
  declare private static fog: GPUBuffer;
  private static readonly word = new Uint32Array(1);
  declare private static mapBuffer: GPUBuffer;
  declare private static materialsBuffer: GPUBuffer;
  private static fullLightOffset = 0;
  private static glowLookOffset = 0;
  private static aoStrengthOffset = 0;
  private static buildingsOffset = 0;

  public static register(world: WorldMeta) {
    // a buffer can't be empty: a placeholder until the map uploads the whole of it
    for (const name of GAME_GLOBALS.perTile) {
      const buffer = this.createBuffer(name, GAME_GLOBALS.placeholderBytes, GPUBufferUsage.STORAGE);
      this.perTile.set(name, buffer);
      this.add(GAME_GLOBALS.binding[name], "read-only-storage", buffer);
    }
    this.fog = this.createBuffer("fog", GAME_GLOBALS.placeholderBytes, GPUBufferUsage.STORAGE);
    this.add(GAME_GLOBALS.binding.fog, "read-only-storage", this.fog);
    this.materialsBuffer = this.uploadBuffer(
      "materials",
      this.materials(),
      GPUBufferUsage.STORAGE,
    );
    this.add(
      GAME_GLOBALS.binding.materials,
      "read-only-storage",
      this.materialsBuffer,
    );
    this.mapBuffer = this.uploadBuffer(
      "map",
      this.map(world),
      GPUBufferUsage.UNIFORM,
    );
    this.add(GAME_GLOBALS.binding.map, "uniform", this.mapBuffer);
    Light.setOcclusion(this.shader + occlusionShader);
    Light.setAmbientMap(this.shader + ambientShader);
  }

  public static upload(name: PerTile, words: Uint32Array) {
    const previous = this.perTile.get(name);
    const buffer = this.uploadBuffer(
      name,
      words.buffer,
      GPUBufferUsage.STORAGE,
    );
    this.perTile.set(name, buffer);
    Aurora.setGlobalResource(GAME_GLOBALS.binding[name], { buffer: buffer });
    previous?.destroy();
  }

  public static uploadFog(discovered: Uint8Array) {
    const previous = this.fog;
    this.fog = this.uploadBuffer(
      "fog",
      discovered.buffer,
      GPUBufferUsage.STORAGE,
    );
    Aurora.setGlobalResource(GAME_GLOBALS.binding.fog, { buffer: this.fog });
    previous.destroy();
  }

  public static writeFogRows(
    discovered: Uint8Array,
    rowBytes: number,
    fromRow: number,
    toRow: number,
  ) {
    const offset = fromRow * rowBytes;
    Aurora.device.queue.writeBuffer(
      this.fog,
      offset,
      discovered,
      offset,
      (toRow - fromRow + 1) * rowBytes,
    );
  }

  public static writeRange(
    name: PerTile,
    words: Uint32Array,
    from: number,
    count: number,
    sourceOffset = from,
  ) {
    const buffer = this.perTile.get(name);
    assert(buffer !== undefined, `No ${name} global, register first`);
    Aurora.device.queue.writeBuffer(buffer, from * 4, words, sourceOffset, count);
  }

  public static refreshMaterials() {
    Aurora.device.queue.writeBuffer(this.materialsBuffer, 0, this.materials());
  }

  public static setAo(on: boolean) {
    const strength = on ? MAP_LOOK.ao.strength : 0;
    Aurora.device.queue.writeBuffer(
      this.mapBuffer,
      this.aoStrengthOffset,
      new Float32Array([strength]),
    );
  }

  // the camp buildings' sprites, the mist leaves out what they cover; a mirrored crop runs backwards
  public static setBuildings(sprites: readonly BuildingSprite[]) {
    assert(
      sprites.length <= GAME_GLOBALS.buildingMasks,
      `The mist masks ${GAME_GLOBALS.buildingMasks} buildings at most, not ${sprites.length}`,
    );
    const writer = new ByteWriter(16 + sprites.length * 32);
    writer.u32(sprites.length);
    writer.u32(0);
    writer.u32(0);
    for (const sprite of sprites) {
      const box = sprite.box;
      const crop = sprite.crop;
      for (const value of [box.x, box.y, box.w, box.h]) writer.f32(value);
      writer.f32(sprite.flip ? crop.x + crop.width : crop.x);
      writer.f32(crop.y);
      writer.f32(sprite.flip ? -crop.width : crop.width);
      writer.f32(crop.height);
    }
    Aurora.device.queue.writeBuffer(this.mapBuffer, this.buildingsOffset, writer.finish());
  }

  public static setFullLight(on: boolean) {
    Aurora.device.queue.writeBuffer(
      this.mapBuffer,
      this.fullLightOffset,
      new Float32Array([on ? 1 : 0]),
    );
  }

  public static write(name: PerTile, index: number, word: number) {
    const buffer = this.perTile.get(name);
    assert(buffer !== undefined, `No ${name} global, register first`);
    this.word[0] = word;
    Aurora.device.queue.writeBuffer(buffer, index * 4, this.word);
  }

  // the blocks' by BlocksID (materials[type]), then the backgrounds' by BackgroundsID (materials[blocks + type]);
  // crop: the first look, the rest lie to the right of it; width 0 = not drawn
  private static materials() {
    const blocks = Object.keys(BLOCKS).map(Number) as BlocksID[];
    const backgrounds = this.backgroundIds();
    const writer = new ByteWriter(
      (blocks.length + backgrounds.length) * GAME_GLOBALS.materialBytes,
    );
    blocks.forEach((id, index) => {
      assert(
        id === index,
        `BlocksID ${BlocksID[id]} is not ${index}, the shader indexes by id`,
      );
      const block = BLOCKS[id];
      let flags = 0;
      if (blocksSight(id)) flags |= GAME_GLOBALS.flags.solid;
      if (block.ownColors) flags |= GAME_GLOBALS.flags.ownColors;
      flags |=
        GLOW_STYLES.indexOf(block.glow?.style ?? "glow") <<
        GAME_GLOBALS.flags.glowStyleShift;
      this.writeMaterial(writer, BLOCK_CROPS[id]?.[0], flags, block.glow);
    });
    backgrounds.forEach((id, index) => {
      assert(
        id === index,
        `BackgroundsID ${BackgroundsID[id]} is not ${index}, the shader indexes by id`,
      );
      this.writeMaterial(
        writer,
        id === BackgroundsID.none ? undefined : BACKGROUNDS[id].first,
        0,
        undefined,
      );
    });
    return writer.finish();
  }

  // a struct in an array is padded to its vec4 alignment: the rest of the 32 bytes empty
  private static writeMaterial(
    writer: ByteWriter,
    crop: Crop | undefined,
    flags: number,
    glow: BlockData["glow"],
  ) {
    const start = writer.offset;
    const rect = crop ?? { x: 0, y: 0, width: 0, height: 0 };
    for (const value of [rect.x, rect.y, rect.width, rect.height])
      writer.f32(value);
    writer.u32(flags);
    writer.u32(this.glowWord(glow));
    writer.f32(glow?.shine ?? 0);
    writer.u32(this.sparkleWord(glow));
    while (writer.offset < start + GAME_GLOBALS.materialBytes) writer.u32(0);
  }

  // the block's own sparkle or the shared one: density 0-1 and speed 0-sparkleSpeedMax, 16 bits each
  // (unpack2x16unorm in the shader)
  private static sparkleWord(glow: BlockData["glow"]) {
    const sparkle = glow?.sparkle ?? MAP_LOOK.glow.sparkle;
    const half = (value: number) =>
      Math.round(AxiomMath.clamp(value, 0, 1) * 0xffff);
    const speed = half(sparkle.speed / GAME_GLOBALS.sparkleSpeedMax);
    return (half(sparkle.density) | (speed << 16)) >>> 0;
  }

  // linear rgb and the blend, a byte each (unpack4x8unorm in the shader); shine 0: doesn't glow
  private static glowWord(glow: BlockData["glow"]) {
    if (glow === undefined) return 0;
    const byte = (value: number) =>
      Math.round(AxiomMath.clamp(value, 0, 1) * 255);
    const [red, green, blue] = glow.color.map((channel) =>
      byte(AxiomColor.srgbToLinear(channel)),
    );
    return (red | (green << 8) | (blue << 16) | (byte(glow.blend) << 24)) >>> 0;
  }

  private static backgroundIds() {
    return Object.keys(BackgroundsID)
      .map(Number)
      .filter((id) => !Number.isNaN(id)) as BackgroundsID[];
  }

  private static map(world: WorldMeta) {
    const writer = new ByteWriter(GAME_GLOBALS.mapBytes);
    writer.f32(world.mapInTiles.width);
    writer.f32(world.mapInTiles.height);
    writer.f32(world.tileInPixels);
    writer.u32(AssetManager.getTexture(RENDER_SHEET.rocks).index);
    writer.u32(BLOCK_LOOKS);
    writer.f32(MAP_LOOK.damagedShade);
    writer.u32(AssetManager.getTexture(RENDER_SHEET.backgrounds).index);
    writer.f32(MAP_LOOK.lightIntoRock);
    writer.f32(MAP_LOOK.ao.width);
    this.aoStrengthOffset = writer.offset;
    writer.f32(MAP_LOOK.ao.strength);
    writer.f32(MAP_LOOK.background.shade);
    writer.f32(MAP_LOOK.background.saturation);
    const mist = MAP_LOOK.mist;
    for (let channel = 0; channel < 3; channel++)
      writer.f32(AxiomColor.srgbToLinear(mist.color[channel]) * mist.scatter);
    writer.f32(mist.opacity);
    for (const value of [
      mist.depth.top,
      mist.depth.bottom,
      mist.frequency,
      mist.draft,
    ])
      writer.f32(value);
    writer.u32(Object.keys(BLOCKS).length);
    this.fullLightOffset = writer.offset;
    writer.f32(0);
    writer.u32(AssetManager.getTexture(RENDER_SHEET.rocksGlow).index);
    // a vec4 starts on 16 bytes
    writer.u32(0);
    this.glowLookOffset = writer.offset;
    for (const value of this.glowLook()) writer.f32(value);
    const blueprint = MAP_LOOK.blueprint;
    const colors = [
      blueprint.paper,
      blueprint.line,
      blueprint.rockDark,
      blueprint.rockLight,
      blueprint.rockLine,
      blueprint.unknown,
      blueprint.hatch,
    ];
    for (const color of colors) {
      for (let channel = 0; channel < 3; channel++) writer.f32(AxiomColor.srgbToLinear(color[channel]));
      writer.f32(1);
    }
    for (const value of [blueprint.strength.open, blueprint.strength.blocks, blueprint.hatchPerTile, 0]) writer.f32(value);
    for (const color of [blueprint.structureDark, blueprint.structureLight, blueprint.token]) {
      for (let channel = 0; channel < 3; channel++) writer.f32(AxiomColor.srgbToLinear(color[channel]));
      writer.f32(1);
    }
    const lines = blueprint.structureLines;
    const tokenLines = blueprint.tokenLines;
    for (const value of [lines.from, lines.to, lines.inner, lines.outline]) writer.f32(value);
    for (const value of [lines.from, lines.to, tokenLines.inner, tokenLines.outline]) writer.f32(value);
    writer.u32(AssetManager.getTexture(RENDER_SHEET.buildings).index);
    this.buildingsOffset = writer.offset;
    for (let word = 0; word < 3 + GAME_GLOBALS.buildingMasks * 8; word++) writer.u32(0);
    return writer.finish();
  }

  private static glowLook() {
    const glow = MAP_LOOK.glow;
    return [
      glow.sparkle.density,
      glow.sparkle.speed,
      glow.breathe.amount,
      glow.breathe.speed,
    ];
  }

  public static refreshGlowLook() {
    Aurora.device.queue.writeBuffer(
      this.mapBuffer,
      this.glowLookOffset,
      new Float32Array(this.glowLook()),
    );
    this.refreshMaterials();
  }

  private static add(
    binding: number,
    type: GPUBufferBindingType,
    buffer: GPUBuffer,
  ) {
    Aurora.addGlobal({
      binding: binding,
      layout: { buffer: { type: type } },
      resource: { buffer: buffer },
    });
  }

  private static uploadBuffer(
    label: string,
    data: ArrayBufferLike,
    usage: GPUBufferUsageFlags,
  ) {
    const buffer = this.createBuffer(label, data.byteLength, usage);
    Aurora.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  private static createBuffer(
    label: string,
    size: number,
    usage: GPUBufferUsageFlags,
  ) {
    return Aurora.device.createBuffer({
      label: label,
      size: size,
      usage: usage | GPUBufferUsage.COPY_DST,
    });
  }
}
