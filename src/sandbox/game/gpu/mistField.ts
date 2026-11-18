import AxiomMath from "@axiom/math";
import { BLOCKS, type BlocksID } from "../content/blocks";
import type World from "../world/world";
import { MAP_LOOK } from "./gameGlobals";

type Box = { fromX: number; toX: number; fromY: number; toY: number };

// dust is simulated only in chunks of the map that hold some; under the cutoff a tile is clean
const DUST_FIELD = { chunk: 16, cutoff: 0.5 / 255 };

export default class MistField {
  // per tile: the mist's thickness in the low byte, the dust in the next one (globals.wgsl)
  public readonly words: Uint32Array;
  // 1 rock, 0 open, outside the map counts as rock
  private readonly rock: Uint8Array;
  private readonly target: Uint8Array;
  private readonly shown: Float32Array;
  private readonly dirty: Box = MistField.emptyBox();
  private readonly settling: Box = MistField.emptyBox();
  private readonly dust: Float32Array;
  private readonly dustChunks = new Set<number>();
  private readonly woken: number[] = [];
  private readonly chunksWide: number;

  constructor(private readonly world: World) {
    this.words = new Uint32Array(world.totalTiles);
    this.rock = new Uint8Array(world.totalTiles);
    this.target = new Uint8Array(world.totalTiles);
    this.shown = new Float32Array(world.totalTiles);
    this.dust = new Float32Array(world.totalTiles);
    this.chunksWide = Math.ceil(world.mapInTiles.width / DUST_FIELD.chunk);
    for (let gy = 0; gy < world.mapInTiles.height; gy++)
      for (let gx = 0; gx < world.mapInTiles.width; gx++)
        this.rock[gx + gy * world.mapInTiles.width] = MistField.isRock(world.getType(gx, gy));
    this.count(0, world.mapInTiles.width - 1, 0, world.mapInTiles.height - 1);
    this.shown.set(this.target);
    this.words.set(this.target);
  }

  public markChanged(gx: number, gy: number) {
    const index = this.world.tileIndex(gx, gy);
    if (index === -1) return;
    this.rock[index] = MistField.isRock(this.world.getType(gx, gy));
    const around = MAP_LOOK.mist.around;
    MistField.grow(this.dirty, gx - around.side, gx + around.side, gy - around.below, gy + around.above);
  }

  public settle(delta: number) {
    const size = this.world.mapInTiles;
    const dirty = this.dirty;
    if (dirty.fromX <= dirty.toX) {
      const fromX = Math.max(dirty.fromX, 0);
      const toX = Math.min(dirty.toX, size.width - 1);
      const fromY = Math.max(dirty.fromY, 0);
      const toY = Math.min(dirty.toY, size.height - 1);
      this.count(fromX, toX, fromY, toY);
      MistField.grow(this.settling, fromX, toX, fromY, toY);
      MistField.clear(dirty);
    }
    const settling = this.settling;
    if (settling.fromX > settling.toX || delta <= 0) return undefined;

    // exponential: quick at first, then slower and slower, so it thins out rather than fades
    const step = 1 - Math.exp(-delta / MAP_LOOK.mist.flow);
    let flowing = false;
    for (let gy = settling.fromY; gy <= settling.toY; gy++)
      for (let gx = settling.fromX; gx <= settling.toX; gx++) {
        const index = gx + gy * size.width;
        const target = this.target[index];
        let shown = this.shown[index];
        if (shown === target) continue;
        shown += (target - shown) * step;
        // under half a step of 255 it would round to the target anyway
        if (Math.abs(target - shown) < 0.5) shown = target;
        else flowing = true;
        this.shown[index] = shown;
        this.pack(index);
      }
    const rows = { from: settling.fromY * size.width, count: (settling.toY - settling.fromY + 1) * size.width };
    if (!flowing) MistField.clear(settling);
    return rows;
  }

  public addDust(gx: number, gy: number, amount: number) {
    const index = this.world.tileIndex(gx, gy);
    if (index === -1) return;
    this.dust[index] = Math.min(this.dust[index] + amount, 1);
    this.pack(index);
    this.dustChunks.add(this.chunkOf(gx, gy));
  }

  // every tile of a dusty chunk evens out with its open neighbours and thins; a chunk with no dust
  // left drops out, one its dust spills into joins. Returns the rows to upload
  public spreadDust(delta: number) {
    if (this.dustChunks.size === 0 || delta <= 0) return undefined;
    const look = MAP_LOOK.dust;
    const size = this.world.mapInTiles;
    const chunk = DUST_FIELD.chunk;
    const keep = Math.exp(-delta / look.fade);
    const even = 1 - Math.exp(-delta * look.spread);
    let fromRow = Infinity;
    let toRow = -Infinity;

    for (const chunkIndex of this.dustChunks) {
      const fromX = (chunkIndex % this.chunksWide) * chunk;
      const fromY = Math.floor(chunkIndex / this.chunksWide) * chunk;
      const toX = Math.min(fromX + chunk, size.width) - 1;
      const toY = Math.min(fromY + chunk, size.height) - 1;
      fromRow = Math.min(fromRow, fromY);
      toRow = Math.max(toRow, toY);
      let dusty = false;
      for (let gy = fromY; gy <= toY; gy++)
        for (let gx = fromX; gx <= toX; gx++) {
          const index = gx + gy * size.width;
          if (this.rock[index] === 1) {
            if (this.dust[index] === 0) continue;
            this.dust[index] = 0;
            this.pack(index);
            continue;
          }
          // inline instead of a neighbour list: per tile per frame, no array per call
          let sum = 0;
          let open = 0;
          for (let side = 0; side < 4; side++) {
            const neighbour = this.neighbourOf(gx, gy, index, side);
            if (neighbour === -1 || this.rock[neighbour] === 1) continue;
            sum += this.dust[neighbour];
            open++;
          }
          let dust = this.dust[index];
          if (dust === 0 && sum === 0) continue;
          if (open > 0) dust += (sum / open - dust) * even;
          dust *= keep;
          if (dust < DUST_FIELD.cutoff) dust = 0;
          this.dust[index] = dust;
          this.pack(index);
          if (dust === 0) continue;
          dusty = true;
          if (gx === fromX || gx === toX || gy === fromY || gy === toY) this.wakeAround(gx, gy);
        }
      if (!dusty) this.dustChunks.delete(chunkIndex);
    }
    for (const chunkIndex of this.woken) this.dustChunks.add(chunkIndex);
    this.woken.length = 0;
    if (fromRow > toRow) return undefined;
    return { from: fromRow * size.width, count: (toRow - fromRow + 1) * size.width };
  }

  // left, right, up, down; -1 off the map
  private neighbourOf(gx: number, gy: number, index: number, side: number) {
    const size = this.world.mapInTiles;
    if (side === 0) return gx > 0 ? index - 1 : -1;
    if (side === 1) return gx < size.width - 1 ? index + 1 : -1;
    if (side === 2) return gy > 0 ? index - size.width : -1;
    return gy < size.height - 1 ? index + size.width : -1;
  }

  // a tile on a chunk's edge spills into the chunks next to it
  private wakeAround(gx: number, gy: number) {
    const size = this.world.mapInTiles;
    if (gx > 0) this.woken.push(this.chunkOf(gx - 1, gy));
    if (gx < size.width - 1) this.woken.push(this.chunkOf(gx + 1, gy));
    if (gy > 0) this.woken.push(this.chunkOf(gx, gy - 1));
    if (gy < size.height - 1) this.woken.push(this.chunkOf(gx, gy + 1));
  }

  private chunkOf(gx: number, gy: number) {
    return Math.floor(gx / DUST_FIELD.chunk) + Math.floor(gy / DUST_FIELD.chunk) * this.chunksWide;
  }

  private pack(index: number) {
    const dust = Math.round(this.dust[index] * 255);
    this.words[index] = (Math.round(this.shown[index]) | (dust << 8)) >>> 0;
  }

  private count(fromX: number, toX: number, fromY: number, toY: number) {
    const mist = MAP_LOOK.mist;
    const around = mist.around;
    const width = this.world.mapInTiles.width;
    const boxTiles = (around.side * 2 + 1) * (around.above + around.below + 1);
    for (let gy = fromY; gy <= toY; gy++)
      for (let gx = fromX; gx <= toX; gx++) {
        if (BLOCKS[this.world.getType(gx, gy)].noMist) {
          this.target[gx + gy * width] = 0;
          continue;
        }
        let rock = 0;
        for (let y = gy - around.above; y <= gy + around.below; y++)
          for (let x = gx - around.side; x <= gx + around.side; x++) {
            const index = this.world.tileIndex(x, y);
            rock += index === -1 ? 1 : this.rock[index];
          }
        const tight = AxiomMath.clamp(rock / boxTiles / mist.full, 0, 1);
        const thickness = mist.least + (1 - mist.least) * tight;
        this.target[gx + gy * width] = Math.round(thickness * 255);
      }
  }

  private static isRock(type: BlocksID) {
    const block = BLOCKS[type];
    return block.solid && block.mistFlows !== true ? 1 : 0;
  }

  private static emptyBox(): Box {
    return { fromX: Infinity, toX: -Infinity, fromY: Infinity, toY: -Infinity };
  }

  private static grow(box: Box, fromX: number, toX: number, fromY: number, toY: number) {
    box.fromX = Math.min(box.fromX, fromX);
    box.toX = Math.max(box.toX, toX);
    box.fromY = Math.min(box.fromY, fromY);
    box.toY = Math.max(box.toY, toY);
  }

  private static clear(box: Box) {
    box.fromX = Infinity;
    box.toX = -Infinity;
    box.fromY = Infinity;
    box.toY = -Infinity;
  }
}
