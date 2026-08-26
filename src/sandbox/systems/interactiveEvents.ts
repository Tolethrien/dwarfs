import PragmaActor from "@/core/pragma/actor";
import PragmaComponent from "@/core/pragma/component";
import Interactive from "../components/interactive";
import { GameMode } from "../scenes/gameScene";
import InputManager from "@/core/engine/inputManager";
import { ACTION } from "../inputActions";
import Collision from "@/core/axiom/collision";
import CameraObject from "../managers/cameraObject";

export interface InteractiveActor {
  component: Interactive;
}
export default class InteractiveElements extends PragmaComponent {
  private registered: Set<Interactive> = new Set();
  constructor(internal: InternalPCProps) {
    super(internal);
  }
  awake(): void {
    this.onSceneEvent<InteractiveActor>(
      "interactiveRegister",
      ({ component }) => this.registered.add(component),
    );
    this.onSceneEvent<InteractiveActor>(
      "interactiveUnregister",
      ({ component }) => this.registered.delete(component),
    );
  }
  preUpdate(): void {
    const gameMode = this.systemSharedData.get<GameMode>("gameMode");
    if (!gameMode || gameMode.mode === "build") return;
    if (InputManager.onActionPressed(ACTION.interact)) {
      const mousePos = InputManager.getMousePos();
      const worldPos = CameraObject.screenToWorld(mousePos);
      for (const register of this.registered) {
        const hit = this.containsPoint(worldPos, register);
        if (!hit) continue;
        register.emitActorEvent("interactiveClicked", {});
      }
    }
  }
  private containsPoint(point: Position2D, component: Interactive): boolean {
    const pos = component.actor.transform.getWorldPosition();
    const body = component.bodyType;
    if (body.type === "circle") {
      return Collision.pointVsCircle(point, {
        x: pos.x,
        y: pos.y,
        r: body.radius,
      }).collided;
    }
    return Collision.pointVsRect(point, {
      x: pos.x,
      y: pos.y,
      w: body.w,
      h: body.h,
      rotation: 0,
    }).collided;
  }
}
