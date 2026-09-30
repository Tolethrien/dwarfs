import InputManager from "@engine/inputManager";
import PragmaSystem from "@pragma/system";
import { ACTION } from "../inputActions";
import InteractiveElements from "./interactiveEvents";
import MapBuilder from "./mapBuilder";
import PlayerInputsComponent from "./playerInputComp";

// systems enabled only in their mode
const MODE_SYSTEMS = {
  game: [PlayerInputsComponent, InteractiveElements],
  build: [MapBuilder],
};
export type Mode = keyof typeof MODE_SYSTEMS;
export interface GameModeChangedEvent {
  mode: Mode;
  previous: Mode;
}

export default class GameMode extends PragmaSystem {
  private mode: Mode = "game";

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  start(): void {
    this.applySystems();
  }

  preUpdate(): void {
    if (InputManager.onActionPressed(ACTION.changeMode)) this.toggle();
  }

  public get current() {
    return this.mode;
  }

  public is(mode: Mode) {
    return this.mode === mode;
  }

  public set(mode: Mode) {
    if (mode === this.mode) return;
    const previous = this.mode;
    this.mode = mode;
    this.applySystems();
    this.emitSceneEvent<GameModeChangedEvent>("gameModeChanged", {
      mode,
      previous,
    });
  }

  public toggle() {
    this.set(this.mode === "game" ? "build" : "game");
  }

  private applySystems() {
    for (const [mode, systems] of Object.entries(MODE_SYSTEMS)) {
      for (const system of systems) {
        this.scene.getSystem(system).setEnabled(mode === this.mode);
      }
    }
  }
}
