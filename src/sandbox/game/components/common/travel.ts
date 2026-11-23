import PragmaComponent from "@pragma/component";
import Time from "@engine/time";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import type { RideOrder, RouteLeg } from "../../systems/mine/transport";
import LayeredSprite from "./layeredSprite";

export const TRAVEL_LOOK = { turnSpeed: 14, flipDeadzone: 1 };

export interface RoutePoint {
  position: Position2D;
  speed: number;
  leg: RouteLeg;
}

interface Ride {
  route: RoutePoint[];
  onArrive: () => void;
  onPoint: ((index: number) => boolean) | undefined;
  next: number;
}

export default class Travel extends PragmaComponent {
  public order: RideOrder | undefined;
  private current: Ride | undefined;
  private last: RoutePoint | undefined;
  private started = false;

  // the first point is where it stands; a destroyed actor can't start coroutines until it's
  // spawned again, so off the scene the ride waits for start
  public ride(route: RoutePoint[], onArrive: () => void, onPoint?: (index: number) => boolean) {
    this.actor.transform.teleport(route[0].position.x, route[0].position.y);
    this.current = { route: route, onArrive: onArrive, onPoint: onPoint, next: 1 };
    this.started = false;
    if (this.actor.getAlive()) this.go();
  }

  public redirect(route: RoutePoint[]) {
    const ride = this.current;
    assert(ride !== undefined, `${this.actor.ID.description} is redirected on no ride`);
    this.ride(route, ride.onArrive, ride.onPoint);
  }

  public turnBack(onArrive: () => void, onPoint?: (index: number) => boolean) {
    const ride = this.current;
    assert(ride !== undefined, `${this.actor.ID.description} turns back on no ride`);
    const at = this.actor.transform.getPosition();
    const back: RoutePoint[] = [{ position: { x: at.x, y: at.y }, speed: 0, leg: ride.route[ride.next].leg }];
    for (let index = ride.next - 1; index >= 0; index--)
      back.push({
        position: ride.route[index].position,
        speed: ride.route[index + 1].speed,
        leg: ride.route[index + 1].leg,
      });
    this.ride(back, onArrive, onPoint);
  }

  public get riding() {
    return this.current;
  }

  public get lastPoint() {
    return this.last;
  }

  start(): void {
    if (this.current && !this.started) this.go();
  }

  private go() {
    const ride = this.current;
    if (!ride) return;
    this.started = true;
    const transform = this.actor.transform;
    const travel = this;
    this.startCoroutine(
      function* travelling() {
        for (; ride.next < ride.route.length; ride.next++) {
          const point = ride.route[ride.next];
          const goal = point.position;
          while (true) {
            const at = transform.getPosition();
            const left = AxiomMath.distance2d(at, goal);
            const step = point.speed * Time.getDeltaTime();
            const dx = goal.x - at.x;
            const dy = goal.y - at.y;
            const sprite = travel.getSibling(LayeredSprite);
            if (sprite && Math.abs(dx) > TRAVEL_LOOK.flipDeadzone) {
              sprite.flipX = dx < 0;
            }
            if (point.leg.kind === "tunnel" && left > 0.01) {
              const flipped = sprite?.flipX ?? false;
              const target = flipped ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx);
              const step = Math.min(1, Time.getDeltaTime() * TRAVEL_LOOK.turnSpeed);
              transform.setRotation(AxiomMath.lerpAngle(transform.getRotation(), target, step));
            } else {
              transform.setRotation(0);
            }
            if (step >= left) {
              transform.setPosition(goal.x, goal.y);
              break;
            }
            transform.translate((dx / left) * step, (dy / left) * step);
            yield;
          }
          if (ride.next < ride.route.length - 1 && ride.onPoint?.(ride.next)) return;
        }
        transform.setRotation(0);
        travel.current = undefined;
        travel.last = ride.route[ride.route.length - 1];
        ride.onArrive();
      },
      { key: "travel" },
    );
  }
}
