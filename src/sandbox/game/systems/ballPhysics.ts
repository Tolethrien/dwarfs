import PragmaSystem from "@pragma/system";
import Vec2 from "@axiom/vec2";
import Collision, { type SweepHit } from "@axiom/collision";
import Time from "@engine/time";
import type Ball from "../components/ball";
import Terrain, { type Hit } from "./terrain";

// decayRate: how fast a shot slows back to the base speed; a break through costs no speed
const PHYS = {
  maxBouncesPerStep: 4,
  skin: 0.01,
  decayRate: 1,
};

export default class BallPhysics extends PragmaSystem {
  private readonly balls = new Set<Ball>();
  private readonly scratch = {
    direction: Vec2.create(0, 0),
    sweep: {
      distance: 0,
      normal: { x: 0, y: 0 },
      corner: { x: 0, y: 0 },
    } as SweepHit,
    rect: { x: 0, y: 0, w: 0, h: 0, rotation: 0 } as Rect,
    hit: { gx: 0, gy: 0, distance: 0, normal: Vec2.create(0, 0) },
    ray: { origin: { x: 0, y: 0 } as Position2D, direction: Vec2.create(0, 0) },
  };
  declare private terrain: Terrain;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
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
    for (const effect of ball.inFlight) effect.onFlight(ball, delta);
    let remaining = speed * delta;
    let bounces = 0;

    while (remaining > 0 && bounces < PHYS.maxBouncesPerStep) {
      const hit = this.castTiles(
        transform.getPosition(),
        direction,
        remaining,
        ball.radius,
        ball.passThrough,
      );
      if (!hit) {
        transform.translate(direction.x * remaining, direction.y * remaining);
        this.leaveSpan(ball);
        return;
      }

      const travelled = Math.max(hit.distance - PHYS.skin, 0);
      transform.translate(direction.x * travelled, direction.y * travelled);
      remaining -= travelled;

      if (this.strike(ball, hit.gx, hit.gy, hit.normal, direction)) continue;

      ball.velocity.reflect(hit.normal);
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
}
