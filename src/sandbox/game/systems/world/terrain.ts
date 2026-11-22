import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import { BLOCKS, BlocksID } from "../../content/blocks";
import { WORLD } from "../../sceneData";
import type World from "../../world/world";
import { startTile } from "../../world/shaftShape";
import type { Signal } from "@axiom/events";
import { MAX_DAMAGE, strike } from "../../world/strike";
import type Ball from "../../components/dwarfs/ball";
import GameEvents from "../core/gameEvents";

export type HitCause = "strike" | "splash" | "blast";

// one contact of a ball with the rock; splash and blast tiles share the contact of the block the
// ball touched, point and normal are that block's face
export interface Hit {
  by: Ball;
  cause: HitCause;
  point: Position2D;
  normal: Position2D;
  direction: Position2D;
  piercing: boolean;
}

// ratio: the power that reached this tile over its strength
export interface TileStruck {
  gx: number;
  gy: number;
  type: BlocksID;
  ratio: number;
  hit: Hit;
}
// no hit: not a ball's (a station's crater)
export interface TileDamaged extends Omit<TileStruck, "hit"> {
  damage: number;
  dealt: number;
  hit?: Hit;
}
export interface TileChanged {
  gx: number;
  gy: number;
}
export interface TerrainSignals {
  damaged: Signal<TileDamaged>;
  mined: Signal<TileStruck>;
  deflected: Signal<TileStruck>;
  changed: Signal<TileChanged>;
}

export interface BlastOptions {
  radius: number;
  power: number;
  edge: number;
  jag: number;
  // a ball's blast mines, the rest (a station's crater) only clears
  hit?: Hit;
}

const TERRAIN = {
  blastBumps: 1.5,
};

export default class Terrain extends PragmaSystem {
  public readonly world: World;
  public readonly tile: number;
  private readonly noise = new Noise(1);
  // a different ring of noise for every blast
  private blasts = 0;
  declare private events: GameEvents;

  constructor(internal: InternalPSProps) {
    super(internal);
    this.world = this.scene.sharedData.require(WORLD);
    this.tile = this.world.meta.tileInPixels;
  }

  awake(): void {
    this.events = this.scene.getSystem(GameEvents);
  }

  // outside the map counts as a block (void), nothing flies out
  public isSolid(gx: number, gy: number) {
    return BLOCKS[this.world.getType(gx, gy)].solid;
  }

  // a ball goes on through a block it breaks only if piercing (Pierce) or the hit is penetrateRatio
  // times the block's strength (Penetrate); otherwise the block still breaks and the ball bounces
  public hit(
    gx: number,
    gy: number,
    power: number,
    piercing: boolean,
    penetrateRatio: number,
    hit: Hit,
  ): "penetrate" | "bounce" {
    if (!this.world.inside(gx, gy) || !this.isSolid(gx, gy)) return "bounce";

    const strength = this.strengthAt(gx, gy);
    const ratio = power / strength;
    const result = strike(power, strength);
    if (result.outcome === "break") {
      this.open(gx, gy, hit, ratio);
      const goesThrough = piercing || ratio >= penetrateRatio;
      return goesThrough ? "penetrate" : "bounce";
    }
    if (result.outcome === "damage") {
      const damage = Math.max(1, Math.round(result.damage * MAX_DAMAGE));
      this.addDamage(gx, gy, damage, result.damage, hit, ratio);
    } else {
      this.deflect(gx, gy, hit, ratio);
    }
    return "bounce";
  }

  public blast(center: Position2D, options: BlastOptions) {
    const reached: Position2D[] = [];
    const reach = Math.ceil(options.radius * (1 + options.jag)) + 1;
    const ring = this.blasts++;
    const fromX = Math.floor(center.x - reach);
    const fromY = Math.floor(center.y - reach);
    for (let gy = fromY; gy <= fromY + reach * 2; gy++)
      for (let gx = fromX; gx <= fromX + reach * 2; gx++) {
        if (!this.world.inside(gx, gy)) continue;
        const dx = gx + 0.5 - center.x;
        const dy = gy + 0.5 - center.y;
        const angle = Math.atan2(dy, dx);
        const stray = this.noise.simplex3D(
          Math.cos(angle) * TERRAIN.blastBumps,
          Math.sin(angle) * TERRAIN.blastBumps,
          ring,
        );
        const limit = options.radius * (1 + options.jag * stray);
        const distance = Math.hypot(dx, dy);
        if (distance > limit) continue;
        reached.push({ x: gx, y: gy });
        if (!this.isSolid(gx, gy) || this.strengthAt(gx, gy) === Infinity) continue;
        if (options.power === Infinity) {
          this.open(gx, gy, options.hit, Infinity);
          continue;
        }
        const power = options.power * AxiomMath.lerp(1, options.edge, distance / limit);
        const strength = this.strengthAt(gx, gy);
        const ratio = power / strength;
        const result = strike(power, strength);
        if (result.outcome === "break") this.open(gx, gy, options.hit, ratio);
        else if (result.outcome === "damage")
          this.addDamage(
            gx,
            gy,
            Math.max(1, Math.round(result.damage * MAX_DAMAGE)),
            result.damage,
            options.hit,
            ratio,
          );
        else if (options.hit) this.deflect(gx, gy, options.hit, ratio);
      }
    return reached;
  }

  // with no ball (a station's crater) the block only clears when it breaks
  public addDamage(gx: number, gy: number, amount: number, dealt: number, hit: Hit | undefined, ratio: number) {
    if (!this.world.inside(gx, gy) || !this.isSolid(gx, gy) || amount <= 0) return;
    const damage = this.world.getDamage(gx, gy) + amount;
    if (damage >= MAX_DAMAGE) {
      this.open(gx, gy, hit, ratio);
      return;
    }
    this.world.setDamage(gx, gy, damage);
    const type = this.world.getType(gx, gy);
    this.events.terrain.damaged.emit({ gx: gx, gy: gy, type: type, damage: damage, dealt: dealt, ratio: ratio, hit: hit });
  }

  public clear(gx: number, gy: number) {
    if (this.world.inside(gx, gy) && this.strengthAt(gx, gy) === Infinity) return;
    this.open(gx, gy, undefined, Infinity);
  }

  public place(gx: number, gy: number, type: BlocksID) {
    if (!this.world.inside(gx, gy) || this.world.getType(gx, gy) === type) return;
    this.world.setTile(gx, gy, type);
    this.events.terrain.changed.emit({ gx: gx, gy: gy });
  }

  private open(gx: number, gy: number, hit: Hit | undefined, ratio: number) {
    if (!this.world.inside(gx, gy) || !this.isSolid(gx, gy)) return;
    const type = this.world.getType(gx, gy);
    this.world.setTile(gx, gy, BlocksID.air);
    if (hit) this.events.terrain.mined.emit({ gx: gx, gy: gy, type: type, ratio: ratio, hit: hit });
    else this.events.terrain.changed.emit({ gx: gx, gy: gy });
  }

  private deflect(gx: number, gy: number, hit: Hit, ratio: number) {
    const type = this.world.getType(gx, gy);
    this.events.terrain.deflected.emit({ gx: gx, gy: gy, type: type, ratio: ratio, hit: hit });
  }

  private strengthAt(gx: number, gy: number) {
    return BLOCKS[this.world.getType(gx, gy)].str;
  }

  public worldToTile(position: Position2D): Position2D {
    return this.world.worldToTile(position);
  }

  public get startPoint(): Position2D {
    const tile = startTile(this.world);
    return { x: (tile.x + 0.5) * this.tile, y: (tile.y + 0.5) * this.tile };
  }
}
