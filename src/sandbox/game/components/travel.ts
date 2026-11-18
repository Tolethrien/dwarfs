import PragmaComponent from "@pragma/component";
import Time from "@engine/time";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import type { RouteLeg } from "../systems/transport";

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
  private current: Ride | undefined;
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
            if (step >= left) {
              transform.setPosition(goal.x, goal.y);
              break;
            }
            transform.translate(((goal.x - at.x) / left) * step, ((goal.y - at.y) / left) * step);
            yield;
          }
          if (ride.next < ride.route.length - 1 && ride.onPoint?.(ride.next)) return;
        }
        travel.current = undefined;
        ride.onArrive();
      },
      { key: "travel" },
    );
  }
}
