import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import { ACTIONS, type ActionName } from "../content/actions";

export type GameModeName = "cutscene" | "game" | "build";

const VIEW: ActionName[] = ["cameraUp", "cameraDown", "cameraLeft", "cameraRight", "zoomIn", "zoomOut"];

// the actions each mode lets through, the rest do nothing in it
const MODE_ACTIONS: Record<GameModeName, Set<ActionName>> = {
  cutscene: new Set(),
  game: new Set([...VIEW, "aim", "select", "stopShooting", "toggleDig", "dig", "toggleBuild"]),
  build: new Set([...VIEW, "toggleBuild", "cancelBuild", "place"]),
};

const ACTION_NAMES = Object.keys(ACTIONS) as ActionName[];

export default class GameMode extends PragmaSystem {
  private mode: GameModeName = "game";
  // single actions a cutscene lets through, until the mode changes
  private readonly cutsceneAllows = new Set<ActionName>();

  awake(): void {
    for (const name of ACTION_NAMES) InputManager.setCondition(name, () => this.allows(name));
  }

  destroy(): void {
    for (const name of ACTION_NAMES) InputManager.clearCondition(name);
  }

  public is(mode: GameModeName) {
    return this.mode === mode;
  }

  public set(mode: GameModeName) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.cutsceneAllows.clear();
  }

  public allowInCutscene(action: ActionName) {
    this.cutsceneAllows.add(action);
  }

  private allows(action: ActionName) {
    return MODE_ACTIONS[this.mode].has(action) || (this.mode === "cutscene" && this.cutsceneAllows.has(action));
  }
}
