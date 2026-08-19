import Vec2 from "@/core/axiom/vec2";
import PragmaComponent from "@/core/pragma/component";
import SpatialGrid from "@/core/axiom/SpatialGrid";
import Collision from "@/core/axiom/collision";
import Physics from "@/sandbox/components/physics";
import Time from "@/core/engine/time";
import Stats from "@/sandbox/components/stats";
import Transform from "@/sandbox/components/transform";
import MapObject from "@/sandbox/managers/mapObject";
import { BLOCK_NAMES } from "@/sandbox/data";
import MapComponent, { MapSystemReady } from "../map/mapComponent";

type Hit =
  | { kind: "entity"; physics: Physics; distance: number; normal: Vec2 }
  | {
      kind: "tile";
      gx: number;
      gy: number;
      type: number;
      distance: number;
      normal: Vec2;
    };

const MAX_BOUNCES_PER_TICK = 4;
const SKIN = 0.01;
const DECAY_RATE = 1;
const AIR = BLOCK_NAMES.indexOf("air");

export default class PhysBallComponent extends PragmaComponent {
  private grid = new SpatialGrid<Physics>({ width: 256, height: 256 });
  private movingBodies = new Set<Physics>();
  private triggeredThisFrame = new Map<Symbol, Set<Symbol>>();
  declare private map: MapComponent;
  constructor(internal: InternalPCProps) {
    super(internal);
  }

  awake(): void {
    this.onSceneEvent<{ physics: Physics }>("physRegister", ({ physics }) =>
      this.register(physics),
    );
    this.onSceneEvent<{ physics: Physics }>("physUnregister", ({ physics }) =>
      this.unregister(physics),
    );
    this.onSceneEvent<MapSystemReady>(
      "mapReady",
      ({ map }) => (this.map = map),
    );
  }

  private register(physics: Physics) {
    if (physics.body) {
      this.grid.insert({
        id: physics.actor.ID,
        bounds: physics.getBounds(),
        data: physics,
      });
    }
    if (physics.type !== "static") this.movingBodies.add(physics);
  }

  private unregister(physics: Physics) {
    this.grid.remove(physics.actor.ID);
    this.movingBodies.delete(physics);
  }

  preUpdate(): void {
    this.triggeredThisFrame.clear();
  }

  preFixedUpdate(): void {
    const dt = Time.getFixedDeltaTime();
    for (const physics of this.movingBodies) {
      if (physics.type !== "rigid") continue;
      const speed = physics.velocity.length();
      if (speed === 0) continue;
      const newSpeed =
        speed + (physics.baseSpeed - speed) * Math.min(DECAY_RATE * dt, 1);
      physics.velocity.normalize().scale(newSpeed);
    }
  }

  fixedUpdate(): void {
    const dt = Time.getFixedDeltaTime();

    for (const physics of this.movingBodies) {
      if (physics.type !== "kinetic") continue;
      const transform = physics.actor.transform;
      transform.translate(physics.velocity.x * dt, physics.velocity.y * dt);
      if (physics.body) this.grid.move(physics.actor.ID, physics.getBounds());
    }

    for (const physics of this.movingBodies) {
      if (physics.type !== "rigid") continue;
      this.stepRigid(physics, dt);
    }
  }

  private stepRigid(physics: Physics, dt: number) {
    if (physics.velocity.isZero()) return;
    const transform = physics.actor.transform;
    let remaining = physics.velocity.length() * dt;
    let direction = physics.velocity.clone().normalize();
    let bounces = 0;

    while (remaining > 0 && bounces < MAX_BOUNCES_PER_TICK) {
      const origin = transform.getPosition().value;
      const hit = this.findClosestHit(physics, origin, direction, remaining);

      if (!hit) {
        transform.translate(direction.x * remaining, direction.y * remaining);
        break;
      }

      const traveled = Math.max(hit.distance - SKIN, 0);
      transform.translate(direction.x * traveled, direction.y * traveled);
      remaining -= traveled;

      if (hit.kind === "tile") {
        const result = this.resolveTileHit(physics, hit.gx, hit.gy);
        if (result === "penetrate") continue;
      } else {
        if (hit.physics.isTrigger) {
          this.handleTrigger(physics, hit.physics);
          continue;
        }
        if (this.resolveEntityHit(physics, hit.physics) === "penetrate")
          continue;
      }

      physics.velocity.reflect(hit.normal);
      direction = physics.velocity.clone().normalize();
      bounces++;
    }

    if (physics.body) this.grid.move(physics.actor.ID, physics.getBounds());
  }

  private findClosestHit(
    self: Physics,
    origin: Position2D,
    direction: Vec2,
    maxDistance: number,
  ): Hit | null {
    const selfRadius = self.body?.type === "circle" ? self.body.radius : 0;
    const ray = { origin, direction };
    let closest: Hit | null = null;

    const tiles = MapObject.getTilesForRaycast(
      origin,
      direction,
      maxDistance,
      selfRadius,
    );
    for (const tile of tiles) {
      const hit = Collision.raycastRect(ray, {
        x: tile.rect.x,
        y: tile.rect.y,
        w: tile.rect.w + selfRadius * 2,
        h: tile.rect.h + selfRadius * 2,
        rotation: 0,
      });
      if (!hit.hit || hit.distance > maxDistance) continue;
      if (closest && hit.distance >= closest.distance) continue;

      // ścianka wewnętrzna — sąsiad po tej stronie też jest lity, więc
      // z zewnątrz nie da się w nią trafić (fix na fałszywe odbicia od gładkiej ściany)
      const nx = tile.gx + Math.sign(hit.normal.x);
      const ny = tile.gy + Math.sign(hit.normal.y);
      if (MapObject.getTileType(nx, ny) !== AIR) continue;

      closest = {
        kind: "tile",
        gx: tile.gx,
        gy: tile.gy,
        type: tile.type,
        distance: hit.distance,
        normal: hit.normal,
      };
    }

    const end = {
      x: origin.x + direction.x * maxDistance,
      y: origin.y + direction.y * maxDistance,
    };
    const queryBounds: BoxAABB = {
      min: {
        x: Math.min(origin.x, end.x) - selfRadius,
        y: Math.min(origin.y, end.y) - selfRadius,
      },
      max: {
        x: Math.max(origin.x, end.x) + selfRadius,
        y: Math.max(origin.y, end.y) + selfRadius,
      },
    };
    const alreadyTriggered = this.triggeredThisFrame.get(self.actor.ID);

    for (const candidate of this.grid.query(queryBounds)) {
      if (candidate === self) continue;
      if (!candidate.isTrigger && this.isSameFaction(self, candidate)) continue;
      if (candidate.isTrigger && alreadyTriggered?.has(candidate.actor.ID))
        continue;

      const hit = candidate.raycastAgainst(ray, selfRadius);
      if (!hit.hit || hit.distance > maxDistance) continue;
      if (closest && hit.distance >= closest.distance) continue;

      closest = {
        kind: "entity",
        physics: candidate,
        distance: hit.distance,
        normal: hit.normal,
      };
    }

    return closest;
  }

  private isSameFaction(a: Physics, b: Physics): boolean {
    return (
      (a.actor.tags.has("friendly") && b.actor.tags.has("friendly")) ||
      (a.actor.tags.has("enemy") && b.actor.tags.has("enemy"))
    );
  }

  private handleTrigger(self: Physics, trigger: Physics) {
    const selfId = self.actor.ID;
    let seen = this.triggeredThisFrame.get(selfId);
    if (!seen) {
      seen = new Set();
      this.triggeredThisFrame.set(selfId, seen);
    }
    seen.add(trigger.actor.ID);
    self.emitActorEvent("triggerHit", { other: trigger.actor });
  }

  private resolveTileHit(
    ball: Physics,
    gx: number,
    gy: number,
  ): "penetrate" | "bounce" {
    const ballStats = ball.getSibling(Stats);
    if (ballStats?.data.kind !== "dwarf" || !this.map) return "bounce";

    const power =
      ballStats.data.baseDmg * (ball.velocity.length() / ball.baseSpeed);

    return this.map.applyHit(gx, gy, power);
  }

  private resolveEntityHit(
    _ball: Physics,
    _other: Physics,
  ): "penetrate" | "bounce" {
    return "bounce"; // TODO: moby/bossy
  }
}
