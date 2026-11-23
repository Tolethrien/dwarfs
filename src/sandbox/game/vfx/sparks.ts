import AxiomMath from "@axiom/math";
import { Draw } from "@aurora/urp/draw/draw";
import { isNatural } from "../content/blocks";
import { SORT_ORDER } from "../content/render";
import Glow from "../gpu/glow";
import type { Hit } from "../systems/world/terrain";
import ParticlePool from "./pool";
import { solidAt, type VfxConnect, type VfxContext, type VfxLayer } from "./vfx";

// strength: 0-1 of a hit that didn't break its block; a deflected one is weak, a wound grows with
// the share of the strength it took. Sparks fly out of the face along its normal, streak behind by
// streak seconds of their flight, cool from hot to cool and go out; one that reaches rock goes out at once
export const SPARKS = {
  capacity: 1500,
  viewMargin: 200,
  deflected: 0.15,
  wound: { weak: 0.35, strong: 1 },
  mined: 1,
  count: [2, 15],
  speed: [400, 900],
  spread: 0.6,
  gravity: 900,
  life: [0.2, 0.4],
  streak: 0.025,
  width: [3, 1],
  hot: [255, 240, 190] as RGB,
  cool: [255, 110, 30] as RGB,
  intensity: 6,
  flash: { seconds: 0.1, radius: [80, 200], intensity: 2, color: [255, 200, 140, 255] as RGBA },
};

const FIELDS = ["x", "y", "vx", "vy", "age", "life", "strength"] as const;

export default class SparksLayer implements VfxLayer {
  private readonly pool = new ParticlePool(SPARKS.capacity, FIELDS);
  // one props object for every spark: render is a hot path, Draw copies what it needs
  private readonly line = {
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    z: SORT_ORDER.sparks,
    width: 0,
    cap: "round" as const,
    color: [255, 255, 255, 255] as RGBA,
    material: Glow.material,
    params: Glow.material.pack({ intensity: SPARKS.intensity }),
  };

  public attach(ctx: VfxContext, connect: VfxConnect) {
    connect(ctx.events.terrain.deflected, (tile) => {
      if (!isNatural(tile.type)) return;
      this.burst(tile.hit, SPARKS.deflected, ctx);
    });
    connect(ctx.events.terrain.damaged, (tile) => {
      if (!tile.hit || !isNatural(tile.type)) return;
      const dealt = AxiomMath.clamp(tile.dealt, 0, 1);
      this.burst(tile.hit, AxiomMath.lerp(SPARKS.wound.weak, SPARKS.wound.strong, dealt), ctx);
    });
    connect(ctx.events.terrain.mined, (tile) => {
      if (!isNatural(tile.type)) return;
      this.burst(tile.hit, SPARKS.mined, ctx);
    });
  }

  // the saltpetre of a pyro and blasts get their own look, the sparks are a pick's
  public burst(hit: Hit, strength: number, ctx: VfxContext) {
    if (hit.cause !== "strike") return;
    if (!ctx.inView(hit.point.x, hit.point.y, 0, 0, SPARKS.viewMargin)) return;

    const flash = SPARKS.flash;
    ctx.flash({
      x: hit.point.x,
      y: hit.point.y,
      seconds: flash.seconds,
      radius: AxiomMath.lerp(flash.radius[0], flash.radius[1], strength),
      intensity: flash.intensity * strength,
      color: flash.color,
      occluded: true,
    });

    const count = Math.round(AxiomMath.lerp(SPARKS.count[0], SPARKS.count[1], strength));
    const normal = Math.atan2(hit.normal.y, hit.normal.x);
    const sparks = this.pool.data;
    for (let spark = 0; spark < count; spark++) {
      const angle = normal + AxiomMath.randomFloat(-SPARKS.spread, SPARKS.spread);
      const speed = AxiomMath.randomFloat(SPARKS.speed[0], SPARKS.speed[1]) * AxiomMath.lerp(0.6, 1, strength);
      const index = this.pool.alloc();
      // off the face a little: the contact lies on the block's edge
      sparks.x[index] = hit.point.x + hit.normal.x * 2;
      sparks.y[index] = hit.point.y + hit.normal.y * 2;
      sparks.vx[index] = Math.cos(angle) * speed;
      sparks.vy[index] = Math.sin(angle) * speed;
      sparks.age[index] = 0;
      sparks.life[index] = AxiomMath.randomFloat(SPARKS.life[0], SPARKS.life[1]);
      sparks.strength[index] = strength;
    }
  }

  public update(delta: number, _rawDelta: number, ctx: VfxContext) {
    if (delta === 0 || this.pool.count === 0) return;
    const sparks = this.pool.data;
    const world = ctx.world;
    const tile = ctx.tile;
    let index = 0;
    while (index < this.pool.count) {
      sparks.age[index] += delta;
      sparks.vy[index] += SPARKS.gravity * delta;
      sparks.x[index] += sparks.vx[index] * delta;
      sparks.y[index] += sparks.vy[index] * delta;
      if (sparks.age[index] >= sparks.life[index] || solidAt(world, tile, sparks.x[index], sparks.y[index])) {
        this.pool.remove(index);
        continue;
      }
      index++;
    }
  }

  public render() {
    if (this.pool.count === 0) return;
    const sparks = this.pool.data;
    const line = this.line;
    for (let index = 0; index < this.pool.count; index++) {
      const cooled = sparks.age[index] / sparks.life[index];
      const left = (1 - cooled) * AxiomMath.lerp(0.5, 1, sparks.strength[index]);
      line.from.x = sparks.x[index];
      line.from.y = sparks.y[index];
      line.to.x = sparks.x[index] - sparks.vx[index] * SPARKS.streak;
      line.to.y = sparks.y[index] - sparks.vy[index] * SPARKS.streak;
      line.width = AxiomMath.lerp(SPARKS.width[0], SPARKS.width[1], cooled);
      for (let channel = 0; channel < 3; channel++)
        line.color[channel] = Math.round(AxiomMath.lerp(SPARKS.hot[channel], SPARKS.cool[channel], cooled) * left);
      Draw.line(line);
    }
  }

  public clear() {
    this.pool.clear();
  }
}
