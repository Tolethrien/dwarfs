import PragmaSystem from "@pragma/system";
import { assert } from "@axiom/utils";
import { BlocksID, getBlock } from "@sandbox/content/blocks";
import type World from "@sandbox/world/world";
import type PragmaActor from "@pragma/actor";
import { ObjectsID } from "@sandbox/content/objects";
import { getDeco, type DecoAttached, type DecoLayer } from "@sandbox/content/decos";
import Chest from "@sandbox/bActors/chest";
import { MAX_DAMAGE, strike } from "@sandbox/world/strike";

export interface TileDamagedEvent {
  gx: number;
  gy: number;
  type: number;
  damage: number;
}
// sent after the tile is already air
export interface TileMinedEvent {
  gx: number;
  gy: number;
  type: BlocksID;
  variant: number;
}
export interface TilePlacedEvent {
  gx: number;
  gy: number;
  type: BlocksID;
  variant: number;
}
// a surprise block was hit: it is air now, `reveals` says what came out of it
export interface TileRevealedEvent {
  gx: number;
  gy: number;
  type: BlocksID;
  reveals: ObjectsID;
}

// sent after the deco is gone from the World, before the tile it depended on goes
export interface DecoRemovedEvent {
  gx: number;
  gy: number;
  layer: DecoLayer;
  type: number;
}

// a tile gone: the decos that needed it, on it (self) or next to it (a floor, a ceiling)
const DEPENDENTS: { dy: number; attached: DecoAttached }[] = [
  { dy: 0, attached: "self" },
  { dy: -1, attached: "below" },
  { dy: 1, attached: "above" },
];

// what comes out of a revealed tile, only some objects do
const REVEALED: Partial<Record<ObjectsID, (position: Position2D) => PragmaActor>> = {
  [ObjectsID.chest]: (position) => new Chest({ position }),
};

// simulation: the only place that changes the terrain by the game rules; no drawing, no sound
export default class Terrain extends PragmaSystem {
  constructor(
    internal: InternalPSProps,
    public readonly world: World,
  ) {
    super(internal);
  }

  public hit(gx: number, gy: number, power: number): "penetrate" | "bounce" {
    const type = this.world.getType(gx, gy);
    if (type === BlocksID.air) return "bounce";
    const block = getBlock(type);

    if (block.reveals !== undefined) {
      this.removeDependentDecos(gx, gy);
      this.world.setTile(gx, gy, BlocksID.air);
      const reveal = REVEALED[block.reveals];
      assert(reveal !== undefined, `Terrain: nothing comes out of ${ObjectsID[block.reveals]}, add it to REVEALED`);
      this.scene.spawnActor(reveal(this.world.tileCenterToWorld({ x: gx, y: gy })));
      this.emitSceneEvent<TileRevealedEvent>("tileRevealed", {
        gx,
        gy,
        type,
        reveals: block.reveals,
      });
      return "bounce";
    }

    const result = strike(power, block.str);
    if (result.outcome === "penetrate") {
      this.mine(gx, gy);
      return "penetrate";
    }
    if (result.outcome === "break") this.mine(gx, gy);
    else if (result.outcome === "damage")
      this.damage(gx, gy, Math.round(result.damage * MAX_DAMAGE));
    return "bounce";
  }

  public damage(gx: number, gy: number, amount: number) {
    const type = this.world.getType(gx, gy);
    if (type === BlocksID.air || !this.world.inside(gx, gy) || amount <= 0) return;

    const damage = this.world.getDamage(gx, gy) + amount;
    if (damage >= MAX_DAMAGE) {
      this.mine(gx, gy);
      return;
    }
    this.world.setDamage(gx, gy, damage);
    this.emitSceneEvent<TileDamagedEvent>("tileDamaged", { gx, gy, type, damage });
  }

  public mine(gx: number, gy: number) {
    const type = this.world.getType(gx, gy);
    if (type === BlocksID.air || !this.world.inside(gx, gy)) return;
    const variant = this.world.getVariant(gx, gy);

    this.removeDependentDecos(gx, gy);
    this.world.setTile(gx, gy, BlocksID.air);
    this.emitSceneEvent<TileMinedEvent>("tileMined", { gx, gy, type, variant });
  }

  public place(gx: number, gy: number, type: BlocksID, variant = 0) {
    if (!this.world.inside(gx, gy)) return;
    this.world.setTile(gx, gy, type, variant);
    this.emitSceneEvent<TilePlacedEvent>("tilePlaced", { gx, gy, type, variant });
  }

  private removeDependentDecos(gx: number, gy: number) {
    for (const dependent of DEPENDENTS) {
      const decoY = gy + dependent.dy;
      for (const layer of ["back", "front"] as const) {
        const type = this.world.getDecoType(layer, gx, decoY);
        if (type === 0) continue;
        const deco = getDeco(type);
        if (deco.permanent || deco.attached !== dependent.attached) continue;
        this.world.setDeco(layer, gx, decoY, 0);
        this.emitSceneEvent<DecoRemovedEvent>("decoRemoved", { gx, gy: decoY, layer, type });
      }
    }
  }
}
