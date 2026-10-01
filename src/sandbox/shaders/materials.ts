import Material from "@aurora/material";
import tileDissolveShader from "./tileDissolve.wgsl?raw";
import sparksShader from "./sparks.wgsl?raw";

// materials of the game, created once at start (before the render graph is built)
export default class Materials {
  declare public static tileDissolve: Material;
  declare public static sparks: Material;

  public static register() {
    this.tileDissolve = Material.create({
      name: "tileDissolve",
      fragment: tileDissolveShader,
      gui: false,
      params: { deathTime: -1000, duration: 1 },
    });
    this.sparks = Material.create({
      name: "sparks",
      fragment: sparksShader,
      blend: "additive",
      emissive: true,
      gui: false,
      params: { bornAt: -1000, duration: 1, seed: 0 },
    });
  }
}
