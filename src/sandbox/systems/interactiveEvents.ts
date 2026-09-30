import PragmaSystem from "@pragma/system";
import type Interactive from "../components/interactive";
import InputManager from "@engine/inputManager";
import { ACTION } from "../inputActions";
import Collision from "@axiom/collision";
import { Camera } from "@engine/camera/camera";

export default class InteractiveElements extends PragmaSystem {
  private registered: Set<Interactive> = new Set();
  constructor(internal: InternalPSProps) {
    super(internal);
  }
  public register(component: Interactive) {
    this.registered.add(component);
  }
  public unregister(component: Interactive) {
    this.registered.delete(component);
  }
  preUpdate(): void {
    if (InputManager.onActionPressed(ACTION.interact)) {
      const mousePos = InputManager.getMousePos();
      const worldPos = Camera.screenToWorld(mousePos);
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
