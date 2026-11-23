import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import Time from "@engine/time";
import { Camera } from "@engine/camera/camera";
import { STRUCTURES } from "../../game/content/structures";
import { RESOURCE_IDS, RESOURCES } from "../../game/content/resources";
import Terrain from "../../game/systems/world/terrain";
import Rails from "../../game/systems/mine/rails";
import Buildings from "../../game/systems/mine/buildings";
import Calendar, { CALENDAR } from "../../game/systems/core/calendar";
import { toast } from "../../game/ui/elements/toast";
import { action, choice, control, page, values } from "../pages";

const TOOLS = {
  // a click in a tool mode, bound here so the game's own actions know nothing of it
  click: { name: "debugToolClick", mouse: "LEFT", mods: "NoMod" } as const,
  modes: ["off", "dig", "rail damage", "rail repair"] as const,
  railHits: 3,
  speed: { max: 50, step: 0.5 },
};

type ToolMode = (typeof TOOLS.modes)[number];

const RESOURCE = choice(RESOURCE_IDS, (id) => RESOURCES[id].name);

export default class ToolsDebug extends PragmaSystem {
  private mode: ToolMode = "off";
  declare private terrain: Terrain;
  declare private rails: Rails;
  declare private buildings: Buildings;
  declare private calendar: Calendar;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.rails = this.scene.getSystem(Rails);
    this.buildings = this.scene.getSystem(Buildings);
    this.calendar = this.scene.getSystem(Calendar);
    InputManager.bindAction(TOOLS.click);

    page("tools", "mouse", "Mouse", "What a left click on the map does, on top of the game's own click: dig a block out, wear a rail down, or repair it.", () => [
      values("Click on the map", "game.tools.mode", [
        {
          key: "mode",
          label: "click does",
          control: control.select(TOOLS.modes),
          get: () => this.mode,
          set: (value) => this.setMode(TOOLS.modes.find((mode) => mode === value) ?? "off"),
        },
      ]),
    ]);
    page("tools", "resources", "Resources", "Put resources straight into the camp's store.", () => [
      action("res", "add", "Add", [
        { key: "resource", control: RESOURCE.control, value: RESOURCE.names[0] },
        { key: "amount", control: control.number(10), value: 100 },
      ], (args) => this.buildings.store.add(RESOURCE.id(args.resource), Number(args.amount))),
      action("res", "addAll", "Add to every resource", [{ key: "amount", control: control.number(10), value: 100 }], (args) => {
        for (const id of RESOURCE_IDS) this.buildings.store.add(id, Number(args.amount));
      }),
    ]);
    page("tools", "time", "Time", "The game clock: pause it, speed it up, or jump ahead.", () => [
      values("Clock", "game.time", [
        { key: "date", control: control.info, get: () => this.calendar.dateText },
        { key: "paused", control: control.toggle, get: () => Time.getPaused(), set: (on) => Time.setPaused(on === true) },
        {
          key: "speed",
          control: control.slider(0, TOOLS.speed.max, TOOLS.speed.step),
          get: () => Time.getTimeSpeed(),
          set: (speed) => Time.setTimeSpeed(Number(speed)),
        },
      ]),
      action("time", "skip", "Skip ahead", [
        { key: "days", control: control.number(1), value: 0 },
        { key: "hours", control: control.number(1), value: 1 },
      ], (args) => this.calendar.skip(Number(args.days) * CALENDAR.hoursPerDay + Number(args.hours))),
    ], true);
  }

  destroy(): void {
    InputManager.removeAction(TOOLS.click.name);
  }

  update(): void {
    if (this.mode === "off") return;
    const tile = this.terrain.worldToTile(Camera.screenToWorld(InputManager.getMousePos()));
    if (this.mode === "dig") {
      if (InputManager.onActionHold(TOOLS.click.name)) this.terrain.clear(tile.x, tile.y);
      return;
    }
    if (!InputManager.onActionPressed(TOOLS.click.name) || !this.rails.isRail(tile)) return;
    if (this.mode === "rail damage") this.rails.damage(tile, Math.ceil(STRUCTURES.rails.durability / TOOLS.railHits));
    else this.rails.repair(tile);
  }

  private setMode(mode: ToolMode) {
    if (mode === this.mode) return;
    this.mode = mode;
    toast(`Debug click: ${mode}`);
  }
}
