import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import Time from "@engine/time";
import { Camera } from "@engine/camera/camera";
import { Draw, Light } from "@aurora/urp/draw/draw";
import { EMISSIVE_MATERIAL } from "@aurora/urp/draw/materials";
import { BLOCKS, isNatural } from "../content/blocks";
import { SORT_ORDER } from "../content/render";
import type World from "../world/world";
import GameEvents from "./gameEvents";
import type { Hit } from "./terrain";

// strength: 0-1 of a hit that didn't break its block; a deflected one is weak, a wound grows with
// the share of the strength it took. Sparks fly out of the face along its normal (it always points
// into the open, ballPhysics hits no face with rock in front of it), streak behind by streak
// seconds of their flight, cool from hot to cool and go out; one that reaches rock goes out at once
const SPARKS = {
  capacity: 1500,
  viewMargin: 200,
  deflected: 0.15,
  wound: { weak: 0.35, strong: 1 },
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

export default class Sparks extends PragmaSystem {
  private readonly sparks = {
    x: new Float32Array(SPARKS.capacity),
    y: new Float32Array(SPARKS.capacity),
    vx: new Float32Array(SPARKS.capacity),
    vy: new Float32Array(SPARKS.capacity),
    age: new Float32Array(SPARKS.capacity),
    life: new Float32Array(SPARKS.capacity),
    strength: new Float32Array(SPARKS.capacity),
  };
  private readonly columns = Object.values(this.sparks);
  private count = 0;
  // with the pool full a new spark takes this slot, going round
  private replace = 0;
  private readonly flashes: { x: number; y: number; age: number; strength: number }[] = [];
  private readonly tile: number;
  // one props object for every spark: render is a hot path, Draw copies what it needs
  private readonly line = {
    from: { x: 0, y: 0 },
    to: { x: 0, y: 0 },
    z: SORT_ORDER.sparks,
    width: 0,
    cap: "round" as const,
    color: [255, 255, 255, 255] as RGBA,
    material: EMISSIVE_MATERIAL,
    params: EMISSIVE_MATERIAL.pack({ intensity: SPARKS.intensity }),
  };
  private readonly pointBox: Box = { x: 0, y: 0, w: 0, h: 0 };

  constructor(
    internal: InternalPSProps,
    private readonly world: World,
  ) {
    super(internal);
    this.tile = world.meta.tileInPixels;
  }

  awake(): void {
    const events = this.scene.getSystem(GameEvents);
    events.terrain.deflected.connect((tile) => {
      if (!isNatural(tile.type)) return;
      this.burst(tile.hit, SPARKS.deflected);
    });
    events.terrain.damaged.connect((tile) => {
      if (!tile.hit || !isNatural(tile.type)) return;
      const dealt = AxiomMath.clamp((tile.ratio - 0.5) / 0.5, 0, 1);
      this.burst(tile.hit, AxiomMath.lerp(SPARKS.wound.weak, SPARKS.wound.strong, dealt));
    });
  }

  // the saltpetre of a pyro gets its own look, the sparks are a pick's
  private burst(hit: Hit, strength: number) {
    if (hit.cause === "splash") return;
    const box = this.pointBox;
    box.x = hit.point.x;
    box.y = hit.point.y;
    if (!Camera.isInView(box, SPARKS.viewMargin)) return;

    this.flashes.push({ x: hit.point.x, y: hit.point.y, age: 0, strength: strength });
    const count = Math.round(AxiomMath.lerp(SPARKS.count[0], SPARKS.count[1], strength));
    const normal = Math.atan2(hit.normal.y, hit.normal.x);
    for (let spark = 0; spark < count; spark++) {
      const angle = normal + AxiomMath.randomFloat(-SPARKS.spread, SPARKS.spread);
      const speed = AxiomMath.randomFloat(SPARKS.speed[0], SPARKS.speed[1]) * AxiomMath.lerp(0.6, 1, strength);
      // off the face a little: the contact lies on the block's edge
      this.add(
        hit.point.x + hit.normal.x * 2,
        hit.point.y + hit.normal.y * 2,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        AxiomMath.randomFloat(SPARKS.life[0], SPARKS.life[1]),
        strength,
      );
    }
  }

  private add(x: number, y: number, vx: number, vy: number, life: number, strength: number) {
    let index = this.count;
    if (index < SPARKS.capacity) this.count++;
    else {
      index = this.replace;
      this.replace = (this.replace + 1) % SPARKS.capacity;
    }
    const sparks = this.sparks;
    sparks.x[index] = x;
    sparks.y[index] = y;
    sparks.vx[index] = vx;
    sparks.vy[index] = vy;
    sparks.age[index] = 0;
    sparks.life[index] = life;
    sparks.strength[index] = strength;
  }

  update(): void {
    const delta = Time.getDeltaTime();
    if (delta === 0) return;
    const sparks = this.sparks;
    let index = 0;
    while (index < this.count) {
      sparks.age[index] += delta;
      sparks.vy[index] += SPARKS.gravity * delta;
      sparks.x[index] += sparks.vx[index] * delta;
      sparks.y[index] += sparks.vy[index] * delta;
      if (sparks.age[index] >= sparks.life[index] || this.solidAt(sparks.x[index], sparks.y[index])) {
        this.remove(index);
        continue;
      }
      index++;
    }
    let kept = 0;
    for (const flash of this.flashes) {
      flash.age += delta;
      if (flash.age < SPARKS.flash.seconds) this.flashes[kept++] = flash;
    }
    this.flashes.length = kept;
  }

  // inline instead of worldToTile: per spark per frame, no object per call
  private solidAt(x: number, y: number) {
    return BLOCKS[this.world.getType(Math.floor(x / this.tile), Math.floor(y / this.tile))].solid;
  }

  private remove(index: number) {
    const last = --this.count;
    if (index !== last) for (const column of this.columns) column[index] = column[last];
    if (this.replace >= this.count) this.replace = 0;
  }

  render(): void {
    const sparks = this.sparks;
    const line = this.line;
    for (let index = 0; index < this.count; index++) {
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
    for (const flash of this.flashes) {
      const left = 1 - flash.age / SPARKS.flash.seconds;
      Light.point({
        position: { x: flash.x, y: flash.y },
        radius: AxiomMath.lerp(SPARKS.flash.radius[0], SPARKS.flash.radius[1], flash.strength),
        color: SPARKS.flash.color,
        intensity: SPARKS.flash.intensity * flash.strength * left * left,
        occluded: true,
      });
    }
  }
}
