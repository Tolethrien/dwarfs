import Aurora from "@aurora/core";
import Material from "@aurora/material";
import { BlocksID, ROCK } from "@sandbox/content/blocks";
import { tileType, tileVariant } from "@sandbox/world/tile";
import type World from "@sandbox/world/world";
import minimapShader from "@sandbox/shaders/minimap.wgsl?raw";

// rgba8 srgb, one texel per map tile in the colour of its block; the next global after TileMask's
const MAP = { binding: 5 };

// srgb; a block missing here shows as rock
const BLOCK_COLORS: Partial<Record<BlocksID, RGBA>> = {
  [BlocksID.void]: [0, 0, 0, 0],
  [BlocksID.air]: [26, 20, 32, 255],
  [BlocksID.bones]: [205, 192, 160, 255],
  [BlocksID.obsidian]: [44, 30, 64, 255],
  [BlocksID.gold]: [245, 192, 60, 255],
  [BlocksID.diamonds]: [175, 240, 255, 255],
  [BlocksID.silver]: [205, 210, 222, 255],
  [BlocksID.sapphire]: [70, 115, 245, 255],
  [BlocksID.copper]: [205, 115, 60, 255],
  [BlocksID.coal]: [40, 40, 44, 255],
};
// rock by variant (ROCK in blocks.ts)
const ROCK_COLORS: Record<number, RGBA> = {
  [ROCK.brown]: [112, 82, 58, 255],
  [ROCK.gray]: [102, 100, 97, 255],
  [ROCK.darkGray]: [72, 70, 68, 255],
  [ROCK.lightGray]: [136, 133, 128, 255],
  [ROCK.lightBrown]: [142, 112, 82, 255],
};

// the map as a texture for the minimap material; the view (MinimapView) only draws it
export default class Minimap {
  declare private static texture: GPUTexture;
  declare private static world: World;
  declare public static material: Material;
  private static readonly texel = new Uint8Array(4);

  // once at start, before Aurora.build: the global (1×1 until a world is bound) and the material
  public static register() {
    this.texture = this.createTexture({ width: 1, height: 1 });
    Aurora.addGlobal({
      binding: MAP.binding,
      layout: { texture: { sampleType: "float", viewDimension: "2d" } },
      resource: this.texture.createView({ label: "minimapTilesView" }),
    });
    this.material = Material.create({
      name: "minimap",
      fragment: minimapShader.replace(
        "// MINIMAP_MAP",
        `@group(0) @binding(${MAP.binding}) var minimapTiles: texture_2d<f32>;`,
      ),
      transparent: true,
      params: { centerX: 0, centerY: 0, tilesAcross: 100 },
    });
  }

  // every loaded world: a texture of its size swapped under the same global
  public static bind(world: World) {
    this.world = world;
    const size = world.mapInTiles;
    const previous = this.texture;
    this.texture = this.createTexture(size);
    const bytes = new Uint8Array(size.width * size.height * 4);
    for (let index = 0; index < size.width * size.height; index++)
      bytes.set(this.colorOf(world.solid[index]), index * 4);
    Aurora.device.queue.writeTexture({ texture: this.texture }, bytes, { bytesPerRow: size.width * 4 }, size);
    Aurora.setGlobalResource(MAP.binding, this.texture.createView({ label: "minimapTilesView" }));
    previous.destroy();
  }

  // after the tile changed in the World
  public static setTile(gx: number, gy: number) {
    const index = this.world.tileIndex(gx, gy);
    if (index === -1) return;
    this.texel.set(this.colorOf(this.world.solid[index]));
    Aurora.device.queue.writeTexture(
      { texture: this.texture, origin: { x: gx, y: gy } },
      this.texel,
      { bytesPerRow: 4 },
      { width: 1, height: 1 },
    );
  }

  private static colorOf(tile: number): RGBA {
    const type = tileType(tile) as BlocksID;
    if (type === BlocksID.rock) return ROCK_COLORS[tileVariant(tile)] ?? ROCK_COLORS[ROCK.brown];
    return BLOCK_COLORS[type] ?? ROCK_COLORS[ROCK.brown];
  }

  private static createTexture(size: Size2D) {
    return Aurora.device.createTexture({
      label: "minimapTiles",
      format: "rgba8unorm-srgb",
      size,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
  }
}
