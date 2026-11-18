import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { STRUCTURES } from "../content/structures";
import { toast } from "../ui/elements/toast";
import { gameSwitch } from "../debugCommands";
import Terrain from "./terrain";
import Rails from "./rails";

// the mouse tools switched on from the profiler (🎮 Game → View)
const PROFILER = { railHits: 3 };

type ToolMode = "dig" | "railDamage" | "railRepair";

const MODE_NAMES: Record<ToolMode, string> = {
  dig: "Dig mode",
  railDamage: "Rail damage mode",
  railRepair: "Rail repair mode",
};

export default class Profiler extends PragmaSystem {
  private mode: ToolMode | undefined;
  declare private terrain: Terrain;
  declare private rails: Rails;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.rails = this.scene.getSystem(Rails);
    gameSwitch("dig", "dig mode (F5)", () => this.mode === "dig", (on) => this.turn("dig", on));
    gameSwitch("railDamage", "rail damage mode", () => this.mode === "railDamage", (on) => this.turn("railDamage", on));
    gameSwitch("railRepair", "rail repair mode", () => this.mode === "railRepair", (on) => this.turn("railRepair", on));
  }

  update(): void {
    if (InputManager.onActionPressed("toggleDig")) this.turn("dig", this.mode !== "dig");
    if (!this.mode) return;
    const tile = this.terrain.worldToTile(Camera.screenToWorld(InputManager.getMousePos()));
    if (this.mode === "dig") {
      if (InputManager.onActionHold("dig")) this.terrain.clear(tile.x, tile.y);
      return;
    }
    if (!InputManager.onActionPressed("dig") || !this.rails.isRail(tile)) return;
    if (this.mode === "railDamage") this.rails.damage(tile, Math.ceil(STRUCTURES.rails.durability / PROFILER.railHits));
    else this.rails.repair(tile);
  }

  private turn(mode: ToolMode, on: boolean) {
    if (on === (this.mode === mode)) return;
    this.mode = on ? mode : undefined;
    toast(`${MODE_NAMES[mode]} ${on ? "on" : "off"}`);
  }
}
