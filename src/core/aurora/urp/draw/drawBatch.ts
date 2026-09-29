import type { Bounds } from "@axiom/AABB";
import GrowingBuffer from "@aurora/utils/growingBuffer";
import { AuroraUsage } from "@aurora/utils/usage";
import { materialOf } from "../clip/clip";
import { WORLD_LAYOUT, WorldWriter } from "./drawInternal";
import { worldDraw } from "./drawWorld";

export interface DrawBatchOptions {
  capacity?: number;
  // world size of a culling cell, without it the whole batch is one cell
  cell?: number;
}
export interface BatchRange {
  cell: number;
  material: number;
  first: number;
  count: number;
}
interface BatchPart {
  buffer: GrowingBuffer;
  writer: WorldWriter;
  keys: number[];
  // shape bounds per instance: minX, minY, maxX, maxY
  extents: number[];
}
// packs cell coordinates into one map key, cells stay within ±CELL_KEY.offset
const CELL_KEY = { offset: 32768, base: 65536 };

// retained instances: recorded once through Draw.*, drawn every frame with Draw.batch.
// opaque instances stay on the gpu, split into cells the pass culls against the view;
// transparent ones join the frame stream and its sorting
export default class DrawBatch {
  public readonly label: string;
  private readonly capacity: number;
  private readonly cellSize: number;
  private readonly opaque: BatchPart;
  private transparent: BatchPart | null = null;
  // key -> opaque index, or -(transparent index + 1)
  private readonly slots: Map<number, number> = new Map();
  private ranges: BatchRange[] = [];
  private cells: Bounds[] = [];
  private readonly bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private front = 0;
  private dirty = { from: Infinity, to: -1 };
  private currentKey = -1;
  private lastPart: BatchPart | null = null;

  constructor(label: string, options: DrawBatchOptions = {}) {
    this.label = label;
    this.capacity = options.capacity ?? 64;
    this.cellSize = options.cell ?? 0;
    this.opaque = this.createPart("opaque");
  }

  public begin() {
    for (const part of [this.opaque, this.transparent]) {
      if (!part) continue;
      part.buffer.clear();
      part.keys.length = 0;
      part.extents.length = 0;
    }
    this.slots.clear();
    this.currentKey = -1;
    worldDraw.beginBatch(this);
  }

  // tags the next recorded instances, edit(key) finds them after end()
  public key(key: number) {
    this.currentKey = key;
  }

  public end() {
    worldDraw.endBatch(this);
    this.arrange();
    this.opaque.keys.forEach((key, index) => {
      if (key !== -1) this.slots.set(key, index);
    });
    this.transparent?.keys.forEach((key, index) => {
      if (key !== -1) this.slots.set(key, -(index + 1));
    });
    this.measure();
    this.dirty.from = Infinity;
    this.dirty.to = -1;
    this.opaque.buffer.upload();
  }

  // keep alpha at 255, the material and the position: the instance stays in its part and cell
  public edit(key: number): WorldWriter | null {
    const slot = this.slots.get(key);
    if (slot === undefined) return null;
    if (slot < 0) {
      this.transparent!.writer.at(-slot - 1);
      return this.transparent!.writer;
    }
    this.opaque.writer.at(slot);
    this.dirty.from = Math.min(this.dirty.from, slot);
    this.dirty.to = Math.max(this.dirty.to, slot);
    return this.opaque.writer;
  }

  public destroy() {
    this.opaque.buffer.destroy();
    this.transparent?.buffer.destroy();
  }

  public push(opaque: boolean): WorldWriter {
    if (!opaque && !this.transparent) {
      this.transparent = this.createPart("transparent");
    }
    const part = opaque ? this.opaque : this.transparent!;
    part.writer.at(part.buffer.push());
    part.keys.push(this.currentKey);
    this.lastPart = part;
    return part.writer;
  }

  // bounds of the instance pushed last
  public extend(bounds: Bounds) {
    this.lastPart!.extents.push(
      bounds.minX,
      bounds.minY,
      bounds.maxX,
      bounds.maxY,
    );
  }

  public upload() {
    if (this.dirty.to < 0) return;
    this.opaque.buffer.uploadRange(
      this.dirty.from,
      this.dirty.to - this.dirty.from + 1,
    );
    this.dirty.from = Infinity;
    this.dirty.to = -1;
  }

  public get getRanges(): readonly BatchRange[] {
    return this.ranges;
  }
  public get getCells(): readonly Readonly<Bounds>[] {
    return this.cells;
  }
  public get getBuffer() {
    return this.opaque.buffer.getBuffer;
  }
  public get getOpaqueCount() {
    return this.opaque.buffer.getCount;
  }
  public get getGpuBytes() {
    return this.opaque.buffer.getGpuBytes;
  }
  public get getTransparent() {
    return this.transparent?.buffer ?? null;
  }
  // highest z of the opaque part, the pass draws the nearest batches first
  public get getFront() {
    return this.front;
  }
  // of the sort points, for the pass sorter
  public get getBounds(): Readonly<Bounds> {
    return this.bounds;
  }

  private createPart(name: string): BatchPart {
    const buffer = new GrowingBuffer({
      label: `drawBatch:${this.label}:${name}`,
      stride: WORLD_LAYOUT.stride,
      usage: AuroraUsage.buffer.VERTEX,
      capacity: this.capacity,
    });
    return {
      buffer,
      writer: WORLD_LAYOUT.createWriter(buffer),
      keys: [],
      extents: [],
    };
  }

  private materialAt(uints: Uint32Array, index: number) {
    return materialOf(
      uints[index * WORLD_LAYOUT.stride + WORLD_LAYOUT.offsets.materialClip],
    );
  }

  // one draw per (cell, material) run: groups the opaque part cell by cell, material inside
  private arrange() {
    const count = this.opaque.buffer.getCount;
    const uints = this.opaque.buffer.getUints;
    const extents = this.opaque.extents;
    const cellOf = new Int32Array(count);
    const cellIds: Map<number, number> = new Map();
    this.cells = [];

    for (let i = 0; i < count; i++) {
      const minX = extents[i * 4];
      const minY = extents[i * 4 + 1];
      const maxX = extents[i * 4 + 2];
      const maxY = extents[i * 4 + 3];
      const key = this.cellKey((minX + maxX) / 2, (minY + maxY) / 2);
      let id = cellIds.get(key);
      if (id === undefined) {
        id = this.cells.length;
        cellIds.set(key, id);
        this.cells.push({
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity,
        });
      }
      cellOf[i] = id;
      const cell = this.cells[id];
      cell.minX = Math.min(cell.minX, minX);
      cell.minY = Math.min(cell.minY, minY);
      cell.maxX = Math.max(cell.maxX, maxX);
      cell.maxY = Math.max(cell.maxY, maxY);
    }

    const stride = WORLD_LAYOUT.stride;
    const order = Array.from({ length: count }, (_, index) => index).sort(
      (a, b) =>
        cellOf[a] - cellOf[b] ||
        this.materialAt(uints, a) - this.materialAt(uints, b) ||
        a - b,
    );
    const words = uints.slice(0, count * stride);
    const keys = this.opaque.keys.slice();
    order.forEach((from, to) => {
      uints.set(words.subarray(from * stride, (from + 1) * stride), to * stride);
      this.opaque.keys[to] = keys[from];
    });

    this.ranges = [];
    let first = 0;
    while (first < count) {
      const cell = cellOf[order[first]];
      const material = this.materialAt(uints, first);
      let end = first + 1;
      while (
        end < count &&
        cellOf[order[end]] === cell &&
        this.materialAt(uints, end) === material
      )
        end++;
      this.ranges.push({ cell, material, first, count: end - first });
      first = end;
    }
  }

  private cellKey(x: number, y: number) {
    if (this.cellSize === 0) return 0;
    const cellX = Math.floor(x / this.cellSize) + CELL_KEY.offset;
    const cellY = Math.floor(y / this.cellSize) + CELL_KEY.offset;
    return cellX * CELL_KEY.base + cellY;
  }

  private measure() {
    const bounds = this.bounds;
    bounds.minX = Infinity;
    bounds.minY = Infinity;
    bounds.maxX = -Infinity;
    bounds.maxY = -Infinity;
    this.front = -Infinity;
    const stride = WORLD_LAYOUT.stride;
    const offset = WORLD_LAYOUT.offsets.sortPoint;
    for (const part of [this.opaque, this.transparent]) {
      if (!part) continue;
      const floats = part.buffer.getFloats;
      for (let i = 0; i < part.buffer.getCount; i++) {
        const point = i * stride + offset;
        bounds.minX = Math.min(bounds.minX, floats[point]);
        bounds.minY = Math.min(bounds.minY, floats[point + 1]);
        bounds.maxX = Math.max(bounds.maxX, floats[point]);
        bounds.maxY = Math.max(bounds.maxY, floats[point + 1]);
        if (part === this.opaque) {
          this.front = Math.max(this.front, floats[point + 2]);
        }
      }
    }
  }
}
