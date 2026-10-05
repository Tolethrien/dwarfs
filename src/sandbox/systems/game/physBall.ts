import Vec2 from "@axiom/vec2";
import PragmaSystem from "@pragma/system";
import SpatialGrid from "@axiom/SpatialGrid";
import Collision, { type SweepHit } from "@axiom/collision";
import type Physics from "@sandbox/components/physics";
import type PragmaActor from "@pragma/actor";
import Time from "@engine/time";
import { debug } from "@debug";
import Stats from "@sandbox/components/stats";
import type World from "@sandbox/world/world";
import { TILE_MASK } from "@sandbox/world/tile";
import { BLOCKS, BlocksID } from "@sandbox/content/blocks";
import { COLLIDES } from "@sandbox/content/objects";
import Terrain from "./terrain";

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
// x, y: where the ball is when it enters the chunk
export interface BallEnteredChunkEvent {
  chunk: number;
  x: number;
  y: number;
}
// x, y: contact point; speed and power from before the bounce; a penetrating hit sends tileMined instead
export type BallBouncedEvent = {
  ball: symbol;
  x: number;
  y: number;
  normal: Position2D;
  speed: number;
  power: number;
} & (
  | { target: "tile"; gx: number; gy: number; type: number }
  | { target: "entity"; other: symbol }
);

// triggerHit: on the ball, other = the trigger; triggerEntered: on the trigger, other = the ball
export interface TriggerEvent {
  other: PragmaActor;
}

const PHYS = { maxBouncesPerTick: 4, skin: 0.01, decayRate: 1 };

// per tile type; the tile cast reads this instead of getBlock(type).collides for every tile
const BALL_COLLIDES = new Uint8Array(TILE_MASK.type + 1);
for (const [type, block] of Object.entries(BLOCKS))
  BALL_COLLIDES[Number(type)] = block.collides & COLLIDES.ball ? 1 : 0;

export default class PhysBall extends PragmaSystem {
  private grid = new SpatialGrid<Physics>({ width: 256, height: 256 });
  private movingBodies = new Set<Physics>();
  private ballChunk = new Map<symbol, number>();
  // last position outside the void, where a lost ball goes back to
  private safePositions = new Map<symbol, Position2D>();
  private tileHit = { gx: 0, gy: 0, type: 0, distance: 0, nx: 0, ny: 0 };
  private tileRect: Rect = { x: 0, y: 0, w: 0, h: 0, rotation: 0 };
  private sweep: SweepHit = {
    distance: 0,
    normal: { x: 0, y: 0 },
    corner: { x: 0, y: 0 },
  };
  declare private terrain: Terrain;
  declare private world: World;

  start(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.world = this.terrain.world;
  }

  public register(physics: Physics) {
    if (physics.body) {
      this.grid.insert({
        id: physics.actor.ID,
        bounds: physics.getBounds(),
        data: physics,
      });
    }
    if (physics.type !== "static") this.movingBodies.add(physics);
  }

  public unregister(physics: Physics) {
    this.grid.remove(physics.actor.ID);
    this.movingBodies.delete(physics);
    this.ballChunk.delete(physics.actor.ID);
    this.safePositions.delete(physics.actor.ID);
  }

  preFixedUpdate(): void {
    const dt = Time.getFixedDeltaTime();
    for (const physics of this.movingBodies) {
      if (physics.type !== "rigid") continue;
      const speed = physics.velocity.length();
      if (speed === 0) continue;
      const newSpeed =
        speed + (physics.baseSpeed - speed) * Math.min(PHYS.decayRate * dt, 1);
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
    const radius = physics.body?.type === "circle" ? physics.body.radius : 0;
    let remaining = physics.velocity.length() * dt;
    let direction = physics.velocity.clone().normalize();
    let bounces = 0;
    const entered = new Set<symbol>();

    while (remaining > 0 && bounces < PHYS.maxBouncesPerTick) {
      const origin = transform.getPosition().value;
      const hit = this.findClosestHit(
        physics,
        origin,
        direction,
        remaining,
        entered,
      );

      if (!hit) {
        transform.translate(direction.x * remaining, direction.y * remaining);
        break;
      }

      // a trigger is crossed, not touched: the ball ends up inside, where the sweep no longer finds it
      const trigger = hit.kind === "entity" && hit.physics.isTrigger;
      const traveled = trigger
        ? Math.min(hit.distance + PHYS.skin, remaining)
        : Math.max(hit.distance - PHYS.skin, 0);
      transform.translate(direction.x * traveled, direction.y * traveled);
      remaining -= traveled;

      if (hit.kind === "entity" && trigger) {
        entered.add(hit.physics.actor.ID);
        this.handleTrigger(physics, hit.physics);
        continue;
      }

      const power = this.power(physics);
      if (hit.kind === "tile") {
        const position = transform.getPosition();
        const contact = {
          point: {
            x: position.x - hit.normal.x * radius,
            y: position.y - hit.normal.y * radius,
          },
          normal: { x: hit.normal.x, y: hit.normal.y },
        };
        // a ball without power never mines nor opens surprise blocks, it only bounces
        if (power <= 0) this.terrain.deflect(hit.gx, hit.gy, contact);
        else if (this.terrain.hit(hit.gx, hit.gy, power, contact) === "penetrate") continue;
      } else if (this.resolveEntityHit(physics, hit.physics) === "penetrate")
        continue;

      this.emitBounce(physics, hit, radius, power);
      physics.velocity.reflect(hit.normal);
      direction = physics.velocity.clone().normalize();
      bounces++;
    }

    if (this.catchInVoid(physics)) return;
    if (physics.body) this.grid.move(physics.actor.ID, physics.getBounds());
    this.checkChunkChange(physics);
  }

  private findClosestHit(
    self: Physics,
    origin: Position2D,
    direction: Vec2,
    maxDistance: number,
    entered: ReadonlySet<symbol>,
  ): Hit | null {
    const selfRadius = self.body?.type === "circle" ? self.body.radius : 0;
    const ray = { origin, direction };
    let closest: Hit | null = null;

    const tile = this.castTiles(origin, direction, maxDistance, selfRadius);
    if (tile) {
      closest = {
        kind: "tile",
        gx: tile.gx,
        gy: tile.gy,
        type: tile.type,
        distance: tile.distance,
        normal: Vec2.create(tile.nx, tile.ny),
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

    for (const candidate of this.grid.query(queryBounds)) {
      if (candidate === self || entered.has(candidate.actor.ID)) continue;
      if (!candidate.isTrigger && this.isSameFaction(self, candidate)) continue;
      if (!candidate.sweep(ray, selfRadius, maxDistance, this.sweep)) continue;
      if (closest && this.sweep.distance >= closest.distance) continue;

      closest = {
        kind: "entity",
        physics: candidate,
        distance: this.sweep.distance,
        normal: Vec2.create(this.sweep.normal.x, this.sweep.normal.y),
      };
    }

    return closest;
  }

  // the ball's circle swept against every colliding tile in range; the scratch rect and hit are reused,
  // runs for each tile every step
  private castTiles(
    origin: Position2D,
    direction: Vec2,
    maxDistance: number,
    radius: number,
  ) {
    const world = this.world;
    const tileSize = world.meta.tileInPixels;
    const endX = origin.x + direction.x * maxDistance;
    const endY = origin.y + direction.y * maxDistance;
    const min = world.worldToTile({
      x: Math.min(origin.x, endX) - radius,
      y: Math.min(origin.y, endY) - radius,
    });
    const max = world.worldToTile({
      x: Math.max(origin.x, endX) + radius,
      y: Math.max(origin.y, endY) + radius,
    });
    const ray = { origin, direction };
    const rect = this.tileRect;
    const sweep = this.sweep;
    rect.w = tileSize.width;
    rect.h = tileSize.height;
    const best = this.tileHit;
    best.distance = Infinity;

    for (let gy = min.y; gy <= max.y; gy++) {
      for (let gx = min.x; gx <= max.x; gx++) {
        const type = world.getType(gx, gy);
        if (!BALL_COLLIDES[type]) continue;

        rect.x = world.meta.origin.x + (gx + 0.5) * tileSize.width;
        rect.y = world.meta.origin.y + (gy + 0.5) * tileSize.height;
        const limit = Math.min(maxDistance, best.distance);
        if (!Collision.sweepCircleRect(ray, radius, rect, limit, sweep))
          continue;
        if (sweep.distance >= best.distance) continue;

        if (sweep.corner.x !== 0) {
          // a colliding neighbour turns the corner into a flat wall, its own face takes the hit
          if (
            this.collidesAt(gx + sweep.corner.x, gy) ||
            this.collidesAt(gx, gy + sweep.corner.y)
          )
            continue;
        } else if (this.collidesAt(gx + sweep.normal.x, gy + sweep.normal.y)) {
          // inner face: the neighbour on that side collides too, so it can't be hit from outside
          continue;
        }

        best.gx = gx;
        best.gy = gy;
        best.type = type;
        best.distance = sweep.distance;
        best.nx = sweep.normal.x;
        best.ny = sweep.normal.y;
      }
    }

    if (best.distance === Infinity) return null;
    return best;
  }

  private collidesAt(gx: number, gy: number) {
    return BALL_COLLIDES[this.world.getType(gx, gy)] === 1;
  }

  private power(ball: Physics) {
    const stats = ball.getSibling(Stats);
    if (stats?.data.kind !== "dwarf") return 0;
    return stats.data.baseDmg * (ball.velocity.length() / ball.baseSpeed);
  }

  private emitBounce(ball: Physics, hit: Hit, radius: number, power: number) {
    const position = ball.actor.transform.getPosition();
    const common = {
      ball: ball.actor.ID,
      x: position.x - hit.normal.x * radius,
      y: position.y - hit.normal.y * radius,
      normal: { x: hit.normal.x, y: hit.normal.y },
      speed: ball.velocity.length(),
      power,
    };
    if (hit.kind === "tile")
      this.emitSceneEvent<BallBouncedEvent>("ballBounced", {
        ...common,
        target: "tile",
        gx: hit.gx,
        gy: hit.gy,
        type: hit.type,
      });
    else
      this.emitSceneEvent<BallBouncedEvent>("ballBounced", {
        ...common,
        target: "entity",
        other: hit.physics.actor.ID,
      });
  }

  private isSameFaction(a: Physics, b: Physics): boolean {
    return (
      (a.actor.tags.has("friendly") && b.actor.tags.has("friendly")) ||
      (a.actor.tags.has("enemy") && b.actor.tags.has("enemy"))
    );
  }

  private handleTrigger(self: Physics, trigger: Physics) {
    self.emitActorEvent<TriggerEvent>("triggerHit", { other: trigger.actor });
    trigger.emitActorEvent<TriggerEvent>("triggerEntered", {
      other: self.actor,
    });
  }

  private resolveEntityHit(
    _ball: Physics,
    _other: Physics,
  ): "penetrate" | "bounce" {
    return "bounce"; // TODO: moby/bossy
  }

  // void is never reachable (obsidian band around the mine): a ball there went through a wall.
  // Back to its last good position, reversed; true when the ball is gone
  private catchInVoid(physics: Physics) {
    const position = physics.actor.transform.getPosition();
    const tile = this.world.worldToTile(position);
    const id = physics.actor.ID;
    const lost =
      !this.world.inside(tile.x, tile.y) ||
      this.world.getType(tile.x, tile.y) === BlocksID.void;

    const safe = this.safePositions.get(id);
    if (!lost) {
      if (safe) {
        safe.x = position.x;
        safe.y = position.y;
      } else this.safePositions.set(id, { x: position.x, y: position.y });
      return false;
    }

    if (!safe) {
      debug.log.warn(
        "PhysBall: ball in the void with no position to go back to, removed",
        tile,
      );
      physics.actor.selfDestroy();
      return true;
    }
    debug.log.warn("PhysBall: ball in the void, moved back", tile, safe);
    physics.actor.transform.setPosition(safe.x, safe.y);
    physics.velocity.negate();
    return false;
  }

  private checkChunkChange(physics: Physics) {
    const mapInChunks = this.world.meta.mapInChunks;
    const position = physics.actor.transform.getWorldPosition();
    const chunkPos = this.world.worldToChunk(position);

    if (
      chunkPos.x < 0 ||
      chunkPos.y < 0 ||
      chunkPos.x >= mapInChunks.width ||
      chunkPos.y >= mapInChunks.height
    )
      return;

    const chunk = this.world.chunkIndex(chunkPos.x, chunkPos.y);
    const id = physics.actor.ID;
    if (this.ballChunk.get(id) === chunk) return;

    this.ballChunk.set(id, chunk);
    this.emitSceneEvent<BallEnteredChunkEvent>("ballEnteredChunk", {
      chunk,
      x: position.x,
      y: position.y,
    });
  }
}
