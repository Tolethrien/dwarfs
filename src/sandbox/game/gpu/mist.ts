import Material from "@aurora/material";
import mistShader from "../shaders/mist.wgsl?raw";
import GameGlobals from "./gameGlobals";

export default class Mist {
  declare public static material: Material<"opacity" | "dust" | "moteScale" | "moteSize">;

  public static register() {
    this.material = Material.create({
      name: "mist",
      fragment: GameGlobals.shader + mistShader,
      gui: false,
      transparent: true,
      params: { opacity: 1, dust: 1, moteScale: 1, moteSize: 1 },
    });
  }
}
