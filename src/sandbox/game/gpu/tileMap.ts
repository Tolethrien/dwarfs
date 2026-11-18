import Material from "@aurora/material";
import tileMapShader from "../shaders/tileMap.wgsl?raw";
import GameGlobals from "./gameGlobals";

// layer: which part of the map a rect draws, must match TILE_MAP_* in tileMap.wgsl
export const TILE_MAP_LAYER = { blocks: 0, backgrounds: 1, glow: 2, blueprint: 3 };

export default class TileMap {
  declare public static material: Material<"layer">;
  declare public static glow: Material<"layer">;
  declare public static blueprint: Material<"layer" | "radius" | "center">;

  public static register() {
    this.material = Material.create({
      name: "tileMap",
      fragment: GameGlobals.shader + tileMapShader,
      gui: false,
      params: { layer: TILE_MAP_LAYER.blocks },
    });
    this.glow = Material.create({
      name: "tileGlow",
      fragment: GameGlobals.shader + tileMapShader,
      gui: false,
      transparent: true,
      params: { layer: TILE_MAP_LAYER.glow },
    });
    this.blueprint = Material.create({
      name: "tileBlueprint",
      fragment: GameGlobals.shader + tileMapShader,
      gui: false,
      transparent: true,
      emissive: true,
      params: { layer: TILE_MAP_LAYER.blueprint, radius: 0, center: 0 },
    });
  }
}
