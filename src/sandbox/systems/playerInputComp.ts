import { Draw } from "@aurora/urp/draw/draw";
import AxiomMath from "@axiom/math";
import Vec2 from "@axiom/vec2";
import InputManager from "@engine/inputManager";
import PragmaComponent from "@pragma/component";
import Dwarf from "@sandbox/bActors/dwarf";
import { ACTION } from "@sandbox/inputActions";
import { Camera } from "@engine/camera/camera";
import EntitiesObject, { DwarfsID } from "@sandbox/managers/entitiesObject";
import { RENDER_ORDER } from "@sandbox/managers/generalData";
import { GameMode } from "../scenes/gameScene";
export default class PlayerInputsComponent extends PragmaComponent {
  private mouseLocked: boolean = false;
  private mousePos: Position2D = { x: 0, y: 0 };
  constructor(internal: InternalPCProps) {
    super(internal);
  }
  preUpdate(): void {
    const gameMode = this.systemSharedData.get<GameMode>("gameMode");
    if (InputManager.isKeyPressed("KeyC")) console.log(1);
    if (!gameMode || gameMode.mode === "build") return;
    if (InputManager.onActionHold(ACTION.shoot) && !this.mouseLocked)
      this.saveMousePos();
    if (InputManager.onActionReleased(ACTION.shoot) && this.mouseLocked)
      this.shootDwarf();
  }
  private saveMousePos() {
    this.mouseLocked = true;
    const pos = InputManager.getMousePos();
    const worldPos = Camera.screenToWorld(pos);
    this.mousePos = worldPos;
  }
  private async shootDwarf() {
    const pos = InputManager.getMousePos();
    const worldPos = Camera.screenToWorld(pos);

    const delta = Vec2.sub(
      Vec2.create(this.mousePos.x, this.mousePos.y),
      Vec2.create(worldPos.x, worldPos.y),
    );
    const dragDistance = delta.length();
    const direction = delta.clone().normalize();
    const speed = AxiomMath.clamp(dragDistance, 500, 3500);
    const dwarfID = EntitiesObject.getRandomDwarfID();
    this.scene.spawnActor(
      new Dwarf({
        position: this.mousePos,
        launchSpeed: speed,
        velocity: direction,
        dwarfID: DwarfsID.scout,
      }),
    );
    this.mouseLocked = false;
  }
  render(): void {
    if (!this.mouseLocked) return;
    Draw.circle({
      position: {
        x: this.mousePos.x,
        y: this.mousePos.y,
        z: RENDER_ORDER.debug,
      },
      radius: 5,
    });
  }
}
