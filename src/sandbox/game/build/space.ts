import AABB, { type Bounds } from "@axiom/AABB";
import Collision from "@axiom/collision";
import Grid from "@axiom/grid";
import SpatialGrid from "@axiom/SpatialGrid";

export type BuildLayer = "main" | "deco";

export type SpaceShape =
  | { readonly kind: "box"; readonly box: Box }
  | { readonly kind: "rect"; readonly rect: Rect };

export interface Removable {
  label(): string;
  readonly confirm?: boolean;
  canRemove?(): string | undefined;
  warning?(): string | undefined;
  remove(): void;
}

export interface SpaceEntry {
  readonly id: symbol;
  readonly layer: BuildLayer;
  shape: SpaceShape;
  hitShape?: SpaceShape;
  showReserve?: Box;
  removable?: Removable;
}

const SPACE = {
  cellTiles: 8,
  epsilon: 1e-4,
};

export function boxShape(box: Box): SpaceShape {
  return { kind: "box", box: box };
}

export function rectShape(rect: Rect): SpaceShape {
  return { kind: "rect", rect: rect };
}

export function shapeToRect(shape: SpaceShape, tile: number): Rect {
  if (shape.kind === "rect") return shape.rect;
  const box = shape.box;
  return {
    x: (box.x + box.w / 2) * tile,
    y: (box.y + box.h / 2) * tile,
    w: box.w * tile,
    h: box.h * tile,
    rotation: 0,
  };
}

export function shapesOverlap(first: SpaceShape, second: SpaceShape, tile: number): boolean {
  if (first.kind === "box" && second.kind === "box") {
    return (
      first.box.x < second.box.x + second.box.w &&
      first.box.x + first.box.w > second.box.x &&
      first.box.y < second.box.y + second.box.h &&
      first.box.y + first.box.h > second.box.y
    );
  }
  const hit = Collision.rectVsRect(shapeToRect(first, tile), shapeToRect(second, tile));
  return hit.collided && hit.penetration > SPACE.epsilon;
}

export function tilesOfShape(shape: SpaceShape, tile: number): Position2D[] {
  if (shape.kind === "box") return Grid.tilesIn(shape.box);
  const rect = shape.rect;
  const bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  AABB.rotatedBounds(bounds, rect.x, rect.y, rect.w, rect.h, rect.rotation);
  const minX = Math.floor(bounds.minX / tile);
  const maxX = Math.floor((bounds.maxX - SPACE.epsilon) / tile);
  const minY = Math.floor(bounds.minY / tile);
  const maxY = Math.floor((bounds.maxY - SPACE.epsilon) / tile);
  const tiles: Position2D[] = [];
  const tileRect: Rect = { x: 0, y: 0, w: tile, h: tile, rotation: 0 };
  for (let gy = minY; gy <= maxY; gy++)
    for (let gx = minX; gx <= maxX; gx++) {
      tileRect.x = (gx + 0.5) * tile;
      tileRect.y = (gy + 0.5) * tile;
      const hit = Collision.rectVsRect(rect, tileRect);
      if (hit.collided && hit.penetration > SPACE.epsilon) tiles.push({ x: gx, y: gy });
    }
  return tiles;
}

export default class BuildSpace {
  private readonly grid: SpatialGrid<SpaceEntry>;
  private readonly entries = new Map<symbol, SpaceEntry>();
  private readonly bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  constructor(public readonly tile: number) {
    const cell = tile * SPACE.cellTiles;
    this.grid = new SpatialGrid({ width: cell, height: cell });
  }

  public add(entry: SpaceEntry) {
    if (this.entries.has(entry.id)) {
      this.move(entry.id, entry.shape, entry.hitShape, entry.showReserve);
      return;
    }
    this.entries.set(entry.id, entry);
    this.grid.insert({ id: entry.id, bounds: this.entryBounds(entry), data: entry });
  }

  public remove(id: symbol) {
    if (!this.entries.delete(id)) return;
    this.grid.remove(id);
  }

  public move(id: symbol, shape: SpaceShape, hitShape?: SpaceShape, showReserve?: Box) {
    const entry = this.entries.get(id);
    if (!entry) return;
    entry.shape = shape;
    entry.hitShape = hitShape;
    entry.showReserve = showReserve;
    this.grid.move(id, this.entryBounds(entry));
  }

  public overlaps(shape: SpaceShape, layer: BuildLayer = "main", ignore?: symbol) {
    let blocked = false;
    this.grid.queryEach(this.shapeBounds(shape), (entry) => {
      if (blocked || entry.layer !== layer || entry.id === ignore) return;
      if (shapesOverlap(shape, entry.shape, this.tile)) blocked = true;
    });
    return blocked;
  }

  public blockingTiles(shape: SpaceShape, layer: BuildLayer = "main", ignore?: symbol): Position2D[] {
    const overlapping: SpaceEntry[] = [];
    this.grid.queryEach(this.shapeBounds(shape), (entry) => {
      if (entry.layer !== layer || entry.id === ignore) return;
      if (shapesOverlap(shape, entry.shape, this.tile)) overlapping.push(entry);
    });
    if (overlapping.length === 0) return [];
    const tiles = tilesOfShape(shape, this.tile);
    const blocked = tiles.filter((pos) => {
      const cell = boxShape({ x: pos.x, y: pos.y, w: 1, h: 1 });
      return overlapping.some((entry) => shapesOverlap(cell, entry.shape, this.tile));
    });
    return blocked.length > 0 ? blocked : tiles;
  }

  public tileBlocked(pos: Position2D, layer: BuildLayer = "main", ignore?: symbol) {
    return this.overlaps(boxShape({ x: pos.x, y: pos.y, w: 1, h: 1 }), layer, ignore);
  }

  public removableAt(worldPoint: Position2D, layer: BuildLayer = "main"): SpaceEntry | undefined {
    let found: SpaceEntry | undefined;
    this.grid.queryEach({ x: worldPoint.x, y: worldPoint.y, w: 0, h: 0 }, (entry) => {
      if (found || entry.layer !== layer || entry.removable === undefined) return;
      const shape = entry.hitShape ?? entry.shape;
      if (Collision.pointVsRect(worldPoint, shapeToRect(shape, this.tile)).collided) found = entry;
    });
    return found;
  }

  public reserves(): Box[] {
    const list: Box[] = [];
    for (const entry of this.entries.values()) {
      if (entry.showReserve !== undefined) list.push(entry.showReserve);
    }
    return list;
  }

  private entryBounds(entry: SpaceEntry): BoxAABB {
    const main = this.shapeBounds(entry.shape);
    if (!entry.hitShape) return main;
    const hit = this.shapeBounds(entry.hitShape);
    return {
      min: { x: Math.min(main.min.x, hit.min.x), y: Math.min(main.min.y, hit.min.y) },
      max: { x: Math.max(main.max.x, hit.max.x), y: Math.max(main.max.y, hit.max.y) },
    };
  }

  private shapeBounds(shape: SpaceShape): BoxAABB {
    if (shape.kind === "box") {
      const box = shape.box;
      const tile = this.tile;
      return {
        min: { x: box.x * tile, y: box.y * tile },
        max: { x: (box.x + box.w) * tile, y: (box.y + box.h) * tile },
      };
    }
    const rect = shape.rect;
    const bounds = AABB.rotatedBounds(this.bounds, rect.x, rect.y, rect.w, rect.h, rect.rotation);
    return { min: { x: bounds.minX, y: bounds.minY }, max: { x: bounds.maxX, y: bounds.maxY } };
  }
}
