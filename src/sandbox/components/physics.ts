import Collision, { type SweepHit } from "@axiom/collision";
import Vec2 from "@axiom/vec2";
import PragmaComponent from "@pragma/component";
import { assert } from "@axiom/utils";
import Transform from "@pragma/transform";
import PhysBall from "@sandbox/systems/game/physBall";

type PhysicsBodyType = "static" | "kinetic" | "rigid";
export type ColliderBody =
  { type: "circle"; radius: number } | { type: "rect"; w: number; h: number };

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
    this.scene.getSystem(PhysBall).register(this);
  }

  destroy(): void {
    this.scene.findSystem(PhysBall)?.unregister(this);
  }

  // a turned rect is covered by the circle around it
  getBounds(): BoxAABB {
    assert(
      this.body !== undefined,
      `trying to access physics body on non-body component`,
    );
    const pos = this.transform.getWorldPosition();
    let halfW = 0;
    let halfH = 0;
    if (this.body.type === "circle") {
      halfW = this.body.radius;
      halfH = this.body.radius;
    } else if (this.transform.getWorldRotation() === 0) {
      halfW = this.body.w / 2;
      halfH = this.body.h / 2;
    } else {
      halfW = Math.hypot(this.body.w, this.body.h) / 2;
      halfH = halfW;
    }
    return {
      min: { x: pos.x - halfW, y: pos.y - halfH },
      max: { x: pos.x + halfW, y: pos.y + halfH },
    };
  }

  // a circle of the radius moving along the ray; result in out. Already overlapping = no hit, like tiles
  sweep(
    ray: { origin: Position2D; direction: Vec2 },
    radius: number,
    maxDistance: number,
    out: SweepHit,
  ) {
    assert(
      this.body !== undefined,
      `trying to access physics body on non-body component`,
    );
    const pos = this.transform.getWorldPosition();
    if (this.body.type === "rect") {
      const rect = {
        x: pos.x,
        y: pos.y,
        w: this.body.w,
        h: this.body.h,
        rotation: this.transform.getWorldRotation(),
      };
      return Collision.sweepCircleRect(ray, radius, rect, maxDistance, out);
    }
    const reach = this.body.radius + radius;
    const dx = ray.origin.x - pos.x;
    const dy = ray.origin.y - pos.y;
    if (dx * dx + dy * dy <= reach * reach) return false;
    const hit = Collision.raycastCircle(ray, { x: pos.x, y: pos.y, r: reach });
    if (!hit.hit || hit.distance > maxDistance) return false;
    out.distance = hit.distance;
    out.normal.x = hit.normal.x;
    out.normal.y = hit.normal.y;
    out.corner.x = 0;
    out.corner.y = 0;
    return true;
  }
}

export function bodyContains(body: ColliderBody, transform: Transform, point: Position2D) {
  const pos = transform.getWorldPosition();
  if (body.type === "circle")
    return Collision.pointVsCircle(point, { x: pos.x, y: pos.y, r: body.radius }).collided;
  return Collision.pointVsRect(point, {
    x: pos.x,
    y: pos.y,
    w: body.w,
    h: body.h,
    rotation: transform.getWorldRotation(),
  }).collided;
}
