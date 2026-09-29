import { Draw } from "@aurora/urp/draw/draw";
import Collision from "@axiom/collision";
import Vec2 from "@axiom/vec2";
import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import Transform from "@pragma/transform";
import { RENDER_ORDER } from "@sandbox/managers/generalData";

type PhysicsBodyType = "static" | "kinetic" | "rigid";
export type ColliderBody =
  | { type: "circle"; radius: number }
  | { type: "rect"; w: number; h: number };

type PhysicsProps =
  | {
      type: "static";
      body?: ColliderBody;
      isTrigger?: boolean;
    }
  | {
      type: "kinetic" | "rigid";
      velocity: Vec2;
      body?: ColliderBody;
      isTrigger?: boolean;
      baseSpeed?: number;
    };

export default class Physics extends PragmaComponent {
  public type: PhysicsBodyType;
  public body?: ColliderBody;
  public velocity: Vec2;
  public isTrigger: boolean;
  public baseSpeed: number;
  declare private transform: Transform;
  static debugDraw = false;
  constructor(internal: InternalPCProps, props: PhysicsProps) {
    super(internal);
    this.type = props.type;
    this.body = props.body;
    this.velocity = props.type === "static" ? Vec2.Zero : props.velocity;
    this.isTrigger = props.isTrigger ?? false;
    this.baseSpeed = props.type === "rigid" ? (props.baseSpeed ?? 0) : 0;
  }
  start(): void {
    this.transform = this.actor.transform;
    this.emitSceneEvent("physRegister", { physics: this });
  }

  destroy(): void {
    this.emitSceneEvent("physUnregister", { physics: this });
  }
  render(): void {
    if (!Physics.debugDraw || !this.body) return;
    const pos = this.transform.getPosition();
    let tint: RGBA = [255, 200, 0, 100];
    if (this.type === "rigid") tint = [150, 250, 50, 255];
    else if (this.type === "kinetic") tint = [50, 150, 250, 255];

    if (this.body.type === "circle") {
      Draw.circle({
        position: { x: pos.x, y: pos.y, z: RENDER_ORDER.debug },
        radius: this.body.radius,
        color: tint,
      });
    } else {
      Draw.rect({
        position: {
          x: pos.x - this.body.w / 2,
          y: pos.y - this.body.h / 2,
          z: RENDER_ORDER.debug,
        },
        size: { width: this.body.w, height: this.body.h },
        color: tint,
      });
    }
  }

  getBounds(): BoxAABB {
    assert(
      this.body !== undefined,
      `trying to access physics body on non-body component`,
    );
    const pos = this.transform.getWorldPosition();
    if (this.body.type === "circle") {
      const r = this.body.radius;
      return {
        min: { x: pos.x - r, y: pos.y - r },
        max: { x: pos.x + r, y: pos.y + r },
      };
    }
    const halfW = this.body.w / 2;
    const halfH = this.body.h / 2;
    return {
      min: { x: pos.x - halfW, y: pos.y - halfH },
      max: { x: pos.x + halfW, y: pos.y + halfH },
    };
  }

  raycastAgainst(
    ray: { origin: Position2D; direction: Vec2 },
    sweepRadius = 0,
  ) {
    assert(
      this.body !== undefined,
      `trying to access physics body on non-body component`,
    );
    const pos = this.transform.getWorldPosition();
    if (this.body.type === "circle") {
      return Collision.raycastCircle(ray, {
        x: pos.x,
        y: pos.y,
        r: this.body.radius + sweepRadius,
      });
    }
    return Collision.raycastRect(ray, {
      x: pos.x,
      y: pos.y,
      w: this.body.w + sweepRadius * 2,
      h: this.body.h + sweepRadius * 2,
      rotation: 0,
    });
  }
}
