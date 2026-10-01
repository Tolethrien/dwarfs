import InputManager from "@engine/inputManager";
import Time from "@engine/time";
import PragmaSystem from "@pragma/system";
import { ACTION } from "../../inputActions";
import MenuPanel from "../../ui/menuPanel";
import SaveGame from "../../world/saveGame";
import GameMode from "./gameMode";
import CameraController from "./cameraController";
import MapBuilder from "./mapBuilder";
import PlayerInput from "./playerInput";
import InteractiveElements from "./interactiveElements";

// the modal takes the mouse; these read the keyboard, so they sleep while paused
const INPUT_SYSTEMS = [
  GameMode,
  CameraController,
  MapBuilder,
  PlayerInput,
  InteractiveElements,
];

export default class PauseMenu extends PragmaSystem {
  private panel: MenuPanel | null = null;
  private enabledBefore: boolean[] = [];
  private saveLabel = "Zapisz";

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  preUpdate(): void {
    if (InputManager.onActionPressed(ACTION.pause)) {
      if (this.panel) this.close();
      else this.open();
    }
    this.panel?.update();
  }

  destroy(): void {
    if (this.panel) this.close();
  }

  private open() {
    Time.setPaused(true);
    this.enabledBefore = INPUT_SYSTEMS.map((system) =>
      this.scene.getSystem(system).getEnabled(),
    );
    for (const system of INPUT_SYSTEMS) this.scene.getSystem(system).setEnabled(false);
    this.scene.getSystem(PlayerInput).cancelAim();

    this.saveLabel = "Zapisz";
    this.panel = new MenuPanel({ blur: 8 });
    this.panel.title("Pauza");
    this.panel.button("Wznów", () => this.close());
    this.panel.button(() => this.saveLabel, () => void this.save());
    this.panel.button("Wyjdź do menu", () => {
      this.close();
      void SaveGame.exitToMenu();
    });
  }

  private close() {
    this.panel?.destroy();
    this.panel = null;
    INPUT_SYSTEMS.forEach((system, index) =>
      this.scene.getSystem(system).setEnabled(this.enabledBefore[index]),
    );
    Time.setPaused(false);
  }

  private async save() {
    this.saveLabel = "Zapisuję...";
    await SaveGame.save("manual");
    this.saveLabel = "Zapisano";
  }
}
