import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import { ACTIONS, type ActionName } from "../../content/actions";

export type GameModeName = "cutscene" | "game" | "build" | "shoot";

export const VIEW: ActionName[] = ["cameraUp", "cameraDown", "cameraLeft", "cameraRight", "zoomIn", "zoomOut"];

// the actions each mode lets through, the rest do nothing in it
const MODE_ACTIONS: Record<GameModeName, Set<ActionName>> = {
  cutscene: new Set(),
  game: new Set([...VIEW, "select", "toggleBuild"]),
  build: new Set([...VIEW, "toggleBuild", "cancelBuild", "place", "rotateBuild"]),
  shoot: new Set([...VIEW, "aim", "stopShooting"]),
};

const ACTION_NAMES = Object.keys(ACTIONS) as ActionName[];

export default class GameMode extends PragmaSystem {
  private mode: GameModeName = "game";
  private onExit: (() => void) | undefined;
  // single actions a cutscene lets through, until the mode changes
  private readonly cutsceneAllows = new Set<ActionName>();
  // held through mode changes, until lifted
  private readonly blocked = new Set<ActionName>();

  awake(): void {
    for (const name of ACTION_NAMES) InputManager.setCondition(name, () => this.allows(name));
  }

  destroy(): void {
    this.onExit = undefined;
    for (const name of ACTION_NAMES) InputManager.clearCondition(name);
  }

  public is(mode: GameModeName) {
    return this.mode === mode;
  }

  public set(mode: GameModeName, onExit?: () => void) {
    if (mode === this.mode) {
      this.onExit = onExit;
      return;
    }
    const exit = this.onExit;
    this.onExit = onExit;
    this.mode = mode;
    this.cutsceneAllows.clear();
    exit?.();
  }

  public allowInCutscene(action: ActionName) {
    this.cutsceneAllows.add(action);
  }

  public block(actions: ActionName[]) {
    for (const action of actions) this.blocked.add(action);
  }

  // all of them when none are named
  public unblock(actions?: ActionName[]) {
    if (actions === undefined) this.blocked.clear();
    else for (const action of actions) this.blocked.delete(action);
  }

  private allows(action: ActionName) {
    if (this.blocked.has(action)) return false;
    return MODE_ACTIONS[this.mode].has(action) || (this.mode === "cutscene" && this.cutsceneAllows.has(action));
  }
}
