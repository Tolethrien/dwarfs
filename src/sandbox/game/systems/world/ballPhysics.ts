import PragmaSystem from "@pragma/system";
import AABB, { type Bounds } from "@axiom/AABB";
import Vec2 from "@axiom/vec2";
import Collision, { type SweepHit } from "@axiom/collision";
import SpatialGrid from "@axiom/SpatialGrid";
import Time from "@engine/time";
import type Ball from "../../components/dwarfs/ball";
import { BLOCKS } from "../../content/blocks";
import GameEvents from "../core/gameEvents";
import Terrain, { type Hit } from "./terrain";

// decayRate: how fast a shot slows back to the base speed; a break through costs no speed
const PHYS = {
  maxBouncesPerStep: 4,
  skin: 0.01,
  decayRate: 1,
  bodyCellTiles: 8,
};

export interface SolidBody {
  readonly id: symbol;
  readonly rect: Rect;
  // true: the ball goes on through
  onHit(ball: Ball, hit: Hit): boolean;
}

export default class BallPhysics extends PragmaSystem {
  private readonly balls = new Set<Ball>();
  declare private bodies: SpatialGrid<SolidBody>;
  private readonly scratch = {
    direction: Vec2.create(0, 0),
    sweep: {
      distance: 0,
      normal: { x: 0, y: 0 },
      corner: { x: 0, y: 0 },
    } as SweepHit,
    rect: { x: 0, y: 0, w: 0, h: 0, rotation: 0 } as Rect,
    hit: { gx: 0, gy: 0, distance: 0, normal: Vec2.create(0, 0) },
    bodyHit: { body: null as SolidBody | null, distance: 0, normal: Vec2.create(0, 0) },
    bodyRange: { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } } as BoxAABB,
    bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } as Bounds,
    ray: { origin: { x: 0, y: 0 } as Position2D, direction: Vec2.create(0, 0) },
    cast: { radius: 0, maxDistance: 0 },
  };
  declare private terrain: Terrain;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    const cell = this.terrain.tile * PHYS.bodyCellTiles;
    this.bodies = new SpatialGrid({ width: cell, height: cell });
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.terrain.mined, (tile) => {
      const drop = BLOCKS[tile.type].drops;
      if (drop) tile.hit.by.storage.stock.add(drop.id, drop.amount);
    });
  }

  public get all(): ReadonlySet<Ball> {
    return this.balls;
  }

  public register(ball: Ball) {
    this.balls.add(ball);
  }

  public unregister(ball: Ball) {
    this.balls.delete(ball);
  }

  public registerBody(body: SolidBody) {
    const rect = body.rect;
    const bounds = AABB.rotatedBounds(this.scratch.bounds, rect.x, rect.y, rect.w, rect.h, rect.rotation);
    this.bodies.insert({
      id: body.id,
      bounds: { min: { x: bounds.minX, y: bounds.minY }, max: { x: bounds.maxX, y: bounds.maxY } },
      data: body,
    });
  }

  public unregisterBody(id: symbol) {
    this.bodies.remove(id);
  }

  fixedUpdate(): void {
    const delta = Time.getFixedDeltaTime();
    if (delta === 0) return;
    for (const ball of this.balls) this.step(ball, delta);
  }

  private step(ball: Ball, delta: number) {
    const transform = ball.actor.transform;
    const direction = this.scratch.direction.copy(ball.velocity).normalize();
    const speed = this.slowDown(ball, delta);
    ball.boostCooldown = Math.max(ball.boostCooldown - delta, 0);
    ball.flightSeconds += delta;
    for (const effect of ball.inFlight) effect.onFlight?.(ball, delta);
    let remaining = speed * delta;
    let bounces = 0;

    while (remaining > 0 && bounces < PHYS.maxBouncesPerStep) {
      const origin = transform.getPosition();
      const tileHit = this.castTiles(origin, direction, remaining, ball.radius, ball.passThrough);
      const bodyLimit = tileHit ? tileHit.distance : remaining;
      const bodyHit = this.castBodies(origin, direction, bodyLimit, ball.radius);
      if (bodyHit && bodyHit.body) {
        const travelled = Math.max(bodyHit.distance - PHYS.skin, 0);
        transform.translate(direction.x * travelled, direction.y * travelled);
        remaining -= travelled;
        if (this.strikeBody(ball, bodyHit.body, bodyHit.normal, direction)) continue;
        ball.velocity.reflect(bodyHit.normal);
      } else if (tileHit) {
        const travelled = Math.max(tileHit.distance - PHYS.skin, 0);
        transform.translate(direction.x * travelled, direction.y * travelled);
        remaining -= travelled;
        if (this.strike(ball, tileHit.gx, tileHit.gy, tileHit.normal, direction)) continue;
        ball.velocity.reflect(tileHit.normal);
      } else {
        transform.translate(direction.x * remaining, direction.y * remaining);
        this.leaveSpan(ball);
        return;
      }

      this.boost(ball);
      direction.copy(ball.velocity).normalize();
      bounces++;
    }
    this.leaveSpan(ball);
  }

  private leaveSpan(ball: Ball) {
    const box = ball.passThrough;
    if (!box) return;
    const position = ball.actor.transform.getPosition();
    const tile = this.terrain.tile;
    const left = Math.floor((position.x - ball.radius) / tile);
    const right = Math.floor((position.x + ball.radius) / tile);
    const top = Math.floor((position.y - ball.radius) / tile);
    const bottom = Math.floor((position.y + ball.radius) / tile);
    const outside = right < box.x || left >= box.x + box.w || bottom < box.y || top >= box.y + box.h;
    if (outside) ball.passThrough = null;
  }

  private collides(gx: number, gy: number, skip: Box | null) {
    if (skip && gx >= skip.x && gx < skip.x + skip.w && gy >= skip.y && gy < skip.y + skip.h) return false;
    return this.terrain.isSolid(gx, gy);
  }

  // true: the ball goes on through; a blast (Blast) lets it through only while piercing
  private strike(ball: Ball, gx: number, gy: number, normal: Position2D, direction: Position2D) {
    const position = ball.actor.transform.getPosition();
    const hit: Hit = {
      by: ball,
      cause: ball.flight.blastRadius === 0 ? "strike" : "blast",
      point: { x: position.x - normal.x * ball.radius, y: position.y - normal.y * ball.radius },
      normal: { x: normal.x, y: normal.y },
      direction: { x: direction.x, y: direction.y },
      piercing: ball.piercing,
    };
    const goesThrough = hit.cause === "strike" ? this.hit(ball, gx, gy, hit) : this.blast(ball, gx, gy, hit);
    this.splash(ball, gx, gy, hit);
    return goesThrough;
  }

  private strikeBody(ball: Ball, body: SolidBody, normal: Position2D, direction: Position2D) {
    const position = ball.actor.transform.getPosition();
    const hit: Hit = {
      by: ball,
      cause: "strike",
      point: { x: position.x - normal.x * ball.radius, y: position.y - normal.y * ball.radius },
      normal: { x: normal.x, y: normal.y },
      direction: { x: direction.x, y: direction.y },
      piercing: ball.piercing,
    };
    return body.onHit(ball, hit);
  }

  private hit(ball: Ball, gx: number, gy: number, hit: Hit) {
    return this.terrain.hit(gx, gy, ball.power, ball.piercing, ball.penetrateRatio, hit) === "penetrate";
  }

  private blast(ball: Ball, gx: number, gy: number, hit: Hit) {
    const flight = ball.flight;
    this.terrain.blast(
      { x: gx + 0.5, y: gy + 0.5 },
      {
        radius: flight.blastRadius,
        power: ball.power,
        edge: flight.blastEdge,
        jag: 0,
        hit: hit,
      },
    );
    return ball.piercing && !this.terrain.isSolid(gx, gy);
  }

  // every block in the square around the hit one gets the same damage (Splash)
  private splash(ball: Ball, gx: number, gy: number, hit: Hit) {
    const radius = ball.flight.splashRadius;
    if (radius === 0) return;
    const splash: Hit = { ...hit, cause: "splash", piercing: false };
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx === 0 && dy === 0) continue;
        this.terrain.hit(gx + dx, gy + dy, ball.flight.splashDamage, false, Infinity, splash);
      }
  }

  private boost(ball: Ball) {
    const bounceSpeed = ball.bounceSpeed;
    if (ball.boostCooldown > 0 || ball.velocity.length() >= bounceSpeed) return;
    ball.velocity.normalize().scale(bounceSpeed);
    ball.boostCooldown = ball.bounceCooldown;
  }

  private slowDown(ball: Ball, delta: number) {
    const speed = ball.velocity.length();
    const slowed =
      speed + (ball.baseSpeed - speed) * Math.min(PHYS.decayRate * delta, 1);
    ball.velocity.normalize().scale(slowed);
    return slowed;
  }

  private castTiles(
    origin: Position2D,
    direction: Vec2,
    maxDistance: number,
    radius: number,
    skip: Box | null,
  ) {
    const tile = this.terrain.tile;
    const endX = origin.x + direction.x * maxDistance;
    const endY = origin.y + direction.y * maxDistance;
    // inline instead of worldToTile - no object per call
    const minX = Math.floor((Math.min(origin.x, endX) - radius) / tile);
    const minY = Math.floor((Math.min(origin.y, endY) - radius) / tile);
    const maxX = Math.floor((Math.max(origin.x, endX) + radius) / tile);
    const maxY = Math.floor((Math.max(origin.y, endY) + radius) / tile);

    const ray = this.scratch.ray;
    ray.origin = origin;
    ray.direction = direction;
    const rect = this.scratch.rect;
    const sweep = this.scratch.sweep;
    const best = this.scratch.hit;
    rect.w = tile;
    rect.h = tile;
    best.distance = Infinity;

    for (let gy = minY; gy <= maxY; gy++) {
      for (let gx = minX; gx <= maxX; gx++) {
        if (!this.collides(gx, gy, skip)) continue;

        rect.x = (gx + 0.5) * tile;
        rect.y = (gy + 0.5) * tile;
        const limit = Math.min(maxDistance, best.distance);
        if (!Collision.sweepCircleRect(ray, radius, rect, limit, sweep))
          continue;
        if (sweep.distance >= best.distance) continue;

        if (sweep.corner.x !== 0) {
          // a solid neighbour turns the corner into a flat wall, its own face takes the hit
          if (
            this.collides(gx + sweep.corner.x, gy, skip) ||
            this.collides(gx, gy + sweep.corner.y, skip)
          )
            continue;
        } else if (
          this.collides(gx + sweep.normal.x, gy + sweep.normal.y, skip)
        ) {
          // inner face: the neighbour on that side is solid too, it can't be hit from outside
          continue;
        }

        best.gx = gx;
        best.gy = gy;
        best.distance = sweep.distance;
        best.normal.set(sweep.normal.x, sweep.normal.y);
      }
    }

    if (best.distance === Infinity) return null;
    return best;
  }

  private readonly testBody = (body: SolidBody) => {
    const best = this.scratch.bodyHit;
    const sweep = this.scratch.sweep;
    const limit = Math.min(this.scratch.cast.maxDistance, best.distance);
    if (!Collision.sweepCircleRect(this.scratch.ray, this.scratch.cast.radius, body.rect, limit, sweep)) return;
    if (sweep.distance >= best.distance) return;
    best.body = body;
    best.distance = sweep.distance;
    best.normal.set(sweep.normal.x, sweep.normal.y);
  };

  private castBodies(
    origin: Position2D,
    direction: Vec2,
    maxDistance: number,
    radius: number,
  ) {
    if (this.bodies.size === 0) return null;
    const endX = origin.x + direction.x * maxDistance;
    const endY = origin.y + direction.y * maxDistance;
    const range = this.scratch.bodyRange;
    range.min.x = Math.min(origin.x, endX) - radius;
    range.min.y = Math.min(origin.y, endY) - radius;
    range.max.x = Math.max(origin.x, endX) + radius;
    range.max.y = Math.max(origin.y, endY) + radius;

    this.scratch.ray.origin = origin;
    this.scratch.ray.direction = direction;
    this.scratch.cast.radius = radius;
    this.scratch.cast.maxDistance = maxDistance;
    const best = this.scratch.bodyHit;
    best.body = null;
    best.distance = Infinity;
    this.bodies.queryEach(range, this.testBody);
    return best.body ? best : null;
  }
}
