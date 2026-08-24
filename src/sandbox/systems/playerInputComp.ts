import Draw from "@/core/aurora/draw";
import AxiomMath from "@/core/axiom/math";
import Vec2 from "@/core/axiom/vec2";
import InputManager from "@/core/engine/inputManager";
import PragmaComponent from "@/core/pragma/component";
import Dwarf from "@/sandbox/bActors/dwarf";
import { ACTION } from "@/sandbox/inputActions";
import CameraObject from "@/sandbox/managers/cameraObject";
import EntitiesObject, { DwarfsID } from "@/sandbox/managers/entitiesObject";
export default class PlayerInputsComponent extends PragmaComponent {
  private mouseLocked: boolean = false;
  private mousePos: Position2D = { x: 0, y: 0 };
  constructor(internal: InternalPCProps) {
    super(internal);
  }
  preUpdate(): void {
    if (InputManager.isKeyPressed("Digit1")) console.log(1);
    if (InputManager.onActionHold(ACTION.shoot) && !this.mouseLocked)
      this.saveMousePos();
    if (InputManager.onActionReleased(ACTION.shoot) && this.mouseLocked)
      this.shootDwarf();
  }
  private saveMousePos() {
    this.mouseLocked = true;
    const pos = InputManager.getMousePos();
    const worldPos = CameraObject.screenToWorld(pos);
    this.mousePos = worldPos;
  }
  private async shootDwarf() {
    const pos = InputManager.getMousePos();
    const worldPos = CameraObject.screenToWorld(pos);

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
      position: { x: this.mousePos.x, y: this.mousePos.y, z: 1 },
      size: { width: 10, height: 10 },
    });
  }
}
