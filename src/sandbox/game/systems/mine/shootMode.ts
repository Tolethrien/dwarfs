import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import ShootingBarUI from "../../ui/shootingBar";
import GameMode from "../core/gameMode";

export interface Shooter {
  canShoot(): boolean;
  label(): string;
  pull(from: Position2D, to: Position2D): void;
  release(): void;
  dropAim(): void;
}

export default class ShootMode extends PragmaSystem {
  private shooter: Shooter | undefined;
  private from: Position2D | null = null;
  declare private gameMode: GameMode;
  declare private bar: ShootingBarUI;

  awake(): void {
    this.gameMode = this.scene.getSystem(GameMode);
    this.bar = new ShootingBarUI({ stop: () => this.leave() });
  }

  update(): void {
    this.bar.update();
    if (!this.shooter) return;
    if (InputManager.onActionPressed("stopShooting") || !this.shooter.canShoot()) {
      this.leave();
      return;
    }
    if (!this.from && InputManager.onActionPressed("aim")) {
      const mouse = InputManager.getMousePos();
      this.from = { x: mouse.x, y: mouse.y };
    }
    if (!this.from) return;
    if (InputManager.onActionHold("aim")) {
      this.shooter.pull(this.from, InputManager.getMousePos());
      return;
    }
    this.from = null;
    this.shooter.release();
  }

  public enter(shooter: Shooter) {
    if (!shooter.canShoot()) return false;
    if (this.shooter) this.cleanup();
    this.gameMode.set("shoot", () => this.cleanup());
    this.shooter = shooter;
    this.from = null;
    this.bar.show(() => shooter.label());
    return true;
  }

  public leave() {
    if (this.gameMode.is("shoot")) this.gameMode.set("game");
  }

  private cleanup() {
    this.shooter?.dropAim();
    this.shooter = undefined;
    this.from = null;
    this.bar.hide();
  }
}
