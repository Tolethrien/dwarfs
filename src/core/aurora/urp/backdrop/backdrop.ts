import AxiomMath from "@axiom/math";
import type { Bounds } from "@axiom/AABB";

// blur pyramid under gui backdrops: mip 0 is half the canvas, so a texel of level i spans 2^(i+1) px
export const BACKDROP = Object.freeze({
  temp: "backdrop",
  sceneTemp: "backdropScene",
  levels: 6,
  sigmaPerTexel: 0.8,
  reach: 2,
  margin: 6,
  cell: 32,
});

// must match the level pick in backdropColor in drawGuiShader.wgsl
export function backdropLevel(sigma: number) {
  const level = Math.log2(sigma / BACKDROP.sigmaPerTexel) - 1;
  return AxiomMath.clamp(level, 0, BACKDROP.levels - 1);
}

export type BackdropSource = "scene" | "join" | "open";
export interface BackdropRegion extends Bounds {
  top: number;
}
export interface BackdropGroup extends BackdropRegion {
  start: number;
}
class CellGrid {
  private words = new Uint32Array(1);
  private columns = 1;
  private rows = 1;

  public resize(columns: number, rows: number) {
    if (columns === this.columns && rows === this.rows) return;
    this.columns = columns;
    this.rows = rows;
    this.words = new Uint32Array(Math.ceil((columns * rows) / 32));
  }
  public clear() {
    this.words.fill(0);
  }
  // hot path, every gui instance marks its cells: plain int loops, no bounds objects
  public mark(minX: number, minY: number, maxX: number, maxY: number) {
    const left = Math.max(Math.floor(minX / BACKDROP.cell), 0);
    const top = Math.max(Math.floor(minY / BACKDROP.cell), 0);
    const right = Math.min(Math.floor(maxX / BACKDROP.cell), this.columns - 1);
    const bottom = Math.min(Math.floor(maxY / BACKDROP.cell), this.rows - 1);
    const words = this.words;
    for (let row = top; row <= bottom; row++) {
      const base = row * this.columns;
      for (let column = left; column <= right; column++) {
        const cell = base + column;
        words[cell >>> 5] |= 1 << (cell & 31);
      }
    }
  }
  public any(minX: number, minY: number, maxX: number, maxY: number) {
    const left = Math.max(Math.floor(minX / BACKDROP.cell), 0);
    const top = Math.max(Math.floor(minY / BACKDROP.cell), 0);
    const right = Math.min(Math.floor(maxX / BACKDROP.cell), this.columns - 1);
    const bottom = Math.min(Math.floor(maxY / BACKDROP.cell), this.rows - 1);
    const words = this.words;
    for (let row = top; row <= bottom; row++) {
      const base = row * this.columns;
      for (let column = left; column <= right; column++) {
        const cell = base + column;
        if (words[cell >>> 5] & (1 << (cell & 31))) return true;
      }
    }
    return false;
  }
}

export class BackdropTracker {
  private readonly frame = new CellGrid();
  private readonly group = new CellGrid();
  private readonly groups: BackdropGroup[] = [];
  private groupCount = 0;
  public readonly scene: BackdropRegion = emptyRegion();
  private sceneUsed = false;

  public get getGroups(): readonly BackdropGroup[] {
    return this.groups;
  }
  public get getGroupCount() {
    return this.groupCount;
  }
  public get hasScene() {
    return this.sceneUsed;
  }

  public reset(canvasWidth: number, canvasHeight: number) {
    const columns = Math.max(Math.ceil(canvasWidth / BACKDROP.cell), 1);
    const rows = Math.max(Math.ceil(canvasHeight / BACKDROP.cell), 1);
    this.frame.resize(columns, rows);
    this.group.resize(columns, rows);
    this.frame.clear();
    this.group.clear();
    this.groupCount = 0;
    this.sceneUsed = false;
  }

  public mark(bounds: Bounds) {
    const { minX, minY, maxX, maxY } = bounds;
    this.frame.mark(minX, minY, maxX, maxY);
    this.group.mark(minX, minY, maxX, maxY);
  }

  public classify(bounds: Bounds, sigma: number): BackdropSource {
    const reach = sigma * BACKDROP.reach;
    const minX = bounds.minX - reach;
    const minY = bounds.minY - reach;
    const maxX = bounds.maxX + reach;
    const maxY = bounds.maxY + reach;
    if (!this.frame.any(minX, minY, maxX, maxY)) return "scene";
    if (this.groupCount > 0 && !this.group.any(minX, minY, maxX, maxY)) {
      return "join";
    }
    return "open";
  }

  public add(
    source: BackdropSource,
    index: number,
    bounds: Bounds,
    sigma: number,
  ) {
    const level = backdropLevel(sigma);
    if (source === "scene") {
      if (!this.sceneUsed) {
        this.sceneUsed = true;
        setRegion(this.scene, bounds, level);
      } else {
        growRegion(this.scene, bounds, level);
      }
      return;
    }
    if (source === "join") {
      growRegion(this.groups[this.groupCount - 1], bounds, level);
      return;
    }
    if (this.groupCount === this.groups.length) {
      this.groups.push({ ...emptyRegion(), start: 0 });
    }
    const group = this.groups[this.groupCount++];
    group.start = index;
    setRegion(group, bounds, level);
    this.group.clear();
    this.group.mark(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  }
}

function emptyRegion(): BackdropRegion {
  return { minX: 0, minY: 0, maxX: 0, maxY: 0, top: 0 };
}
function setRegion(region: BackdropRegion, bounds: Bounds, level: number) {
  region.minX = bounds.minX;
  region.minY = bounds.minY;
  region.maxX = bounds.maxX;
  region.maxY = bounds.maxY;
  region.top = level;
}
function growRegion(region: BackdropRegion, bounds: Bounds, level: number) {
  region.minX = Math.min(region.minX, bounds.minX);
  region.minY = Math.min(region.minY, bounds.minY);
  region.maxX = Math.max(region.maxX, bounds.maxX);
  region.maxY = Math.max(region.maxY, bounds.maxY);
  region.top = Math.max(region.top, level);
}
