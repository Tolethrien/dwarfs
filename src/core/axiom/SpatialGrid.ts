const CELL_KEY_OFFSET = 1 << 15;
type SpatialGridEntry<T> = { cellKeys: number[]; item: SpatialGridItem<T>; stamp: number };
type SpatialGridItem<T> = {
  id: symbol;
  bounds: Box | BoxAABB;
  data: T;
};
export default class SpatialGrid<T> {
  private cellSize: Size2D;
  private cells: Map<number, SpatialGridEntry<T>[]> = new Map();
  private registry: Map<symbol, SpatialGridEntry<T>> = new Map();
  private stamp = 0;

  constructor(cellSize: Size2D) {
    this.cellSize = cellSize;
  }

  public get size() {
    return this.registry.size;
  }

  private computeCellKeys(shape: Box | BoxAABB): number[] {
    const { minCellX, minCellY, maxCellX, maxCellY } = SpatialGrid.getCellRange(
      shape,
      this.cellSize,
    );
    const keys: number[] = [];
    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        keys.push(SpatialGrid.cellKey(cx, cy));
      }
    }
    return keys;
  }

  private addToCell(key: number, entry: SpatialGridEntry<T>) {
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(entry);
  }

  private removeFromCell(key: number, entry: SpatialGridEntry<T>) {
    const cell = this.cells.get(key);
    if (!cell) return;
    const index = cell.indexOf(entry);
    if (index !== -1) cell.splice(index, 1);
    if (cell.length === 0) this.cells.delete(key);
  }

  insert(item: SpatialGridItem<T>) {
    const cellKeys = this.computeCellKeys(item.bounds);
    const entry: SpatialGridEntry<T> = { cellKeys, item, stamp: 0 };
    for (const key of cellKeys) this.addToCell(key, entry);
    this.registry.set(item.id, entry);
  }

  remove(id: symbol) {
    const entry = this.registry.get(id);
    if (!entry) return false;
    for (const key of entry.cellKeys) this.removeFromCell(key, entry);
    this.registry.delete(id);
    return true;
  }

  move(id: symbol, newBounds: Box | BoxAABB) {
    const entry = this.registry.get(id);
    if (!entry) return false;

    const newKeys = this.computeCellKeys(newBounds);
    const oldKeysSet = new Set(entry.cellKeys);
    const newKeysSet = new Set(newKeys);

    for (const key of entry.cellKeys) {
      if (!newKeysSet.has(key)) this.removeFromCell(key, entry);
    }
    for (const key of newKeys) {
      if (!oldKeysSet.has(key)) this.addToCell(key, entry);
    }

    entry.item.bounds = newBounds;
    entry.cellKeys = newKeys;
    return true;
  }

  queryEach(range: Box | BoxAABB, visit: (data: T) => void) {
    if (this.registry.size === 0) return;
    const minX = "min" in range ? range.min.x : range.x;
    const minY = "min" in range ? range.min.y : range.y;
    const maxX = "min" in range ? range.max.x : range.x + range.w;
    const maxY = "min" in range ? range.max.y : range.y + range.h;
    const minCellX = Math.floor(minX / this.cellSize.width);
    const minCellY = Math.floor(minY / this.cellSize.height);
    const maxCellX = Math.floor(maxX / this.cellSize.width);
    const maxCellY = Math.floor(maxY / this.cellSize.height);
    const stamp = ++this.stamp;

    for (let cx = minCellX; cx <= maxCellX; cx++) {
      for (let cy = minCellY; cy <= maxCellY; cy++) {
        const cell = this.cells.get(SpatialGrid.cellKey(cx, cy));
        if (!cell) continue;
        for (const entry of cell) {
          if (entry.stamp === stamp) continue;
          entry.stamp = stamp;
          visit(entry.item.data);
        }
      }
    }
  }

  query(range: Box | BoxAABB): T[] {
    const result: T[] = [];
    this.queryEach(range, (data) => result.push(data));
    return result;
  }
  private static cellKey(x: number, y: number) {
    return (
      (((x + CELL_KEY_OFFSET) & 0xffff) << 16) |
      ((y + CELL_KEY_OFFSET) & 0xffff)
    );
  }

  private static getCellRange(shape: Box | BoxAABB, cellSize: Size2D) {
    const bounds =
      "min" in shape
        ? {
            minX: shape.min.x,
            minY: shape.min.y,
            maxX: shape.max.x,
            maxY: shape.max.y,
          }
        : {
            minX: shape.x,
            minY: shape.y,
            maxX: shape.x + shape.w,
            maxY: shape.y + shape.h,
          };

    return {
      minCellX: Math.floor(bounds.minX / cellSize.width),
      minCellY: Math.floor(bounds.minY / cellSize.height),
      maxCellX: Math.floor(bounds.maxX / cellSize.width),
      maxCellY: Math.floor(bounds.maxY / cellSize.height),
    };
  }
  forEachCell(cb: (cx: number, cy: number, count: number) => void) {
    for (const [key, cell] of this.cells) {
      const cx = ((key >>> 16) & 0xffff) - CELL_KEY_OFFSET;
      const cy = (key & 0xffff) - CELL_KEY_OFFSET;
      cb(cx, cy, cell.length);
    }
  }
}
