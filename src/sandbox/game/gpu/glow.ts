import Material from "@aurora/material";
import glowShader from "../shaders/glow.wgsl?raw";
import GameGlobals from "./gameGlobals";

export default class Glow {
  declare public static material: Material<"intensity" | "maskLayer">;

  public static register() {
    this.material = Material.create({
      name: "glow",
      fragment: GameGlobals.shader + glowShader,
      gui: false,
      params: { intensity: 1, maskLayer: -1 },
    });
  }
}
