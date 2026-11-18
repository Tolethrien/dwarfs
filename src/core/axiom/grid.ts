interface GridCallbackProps {
  tilePixelPos: Position2D;
  tileGridPos: Position2D;
  index: number;
}
interface GridProps<T> {
  tileSize: Size2D;
  gridSize: Size2D;
  callback?: (props: GridCallbackProps) => T;
}
export default class Grid {
  static worldToTile(position: Position2D, tileSize: Size2D): Position2D {
    return {
      x: Math.floor(position.x / tileSize.width),
      y: Math.floor(position.y / tileSize.height),
    };
  }

  static tileToWorld(tile: Position2D, tileSize: Size2D): Position2D {
    return {
      x: tile.x * tileSize.width,
      y: tile.y * tileSize.height,
    };
  }

  static tileCenterToWorld(tile: Position2D, tileSize: Size2D): Position2D {
    return {
      x: tile.x * tileSize.width + tileSize.width / 2,
      y: tile.y * tileSize.height + tileSize.height / 2,
    };
  }

  static snapToGrid(position: Position2D, tileSize: Size2D): Position2D {
    const tile = Grid.worldToTile(position, tileSize);
    return Grid.tileToWorld(tile, tileSize);
  }

  static snapToGridCenter(position: Position2D, tileSize: Size2D): Position2D {
    const tile = Grid.worldToTile(position, tileSize);
    return Grid.tileCenterToWorld(tile, tileSize);
  }

  // every tile of a box in tiles, row by row
  static tilesIn(box: Box): Position2D[] {
    const tiles: Position2D[] = [];
    for (let y = box.y; y < box.y + box.h; y++)
      for (let x = box.x; x < box.x + box.w; x++) tiles.push({ x: x, y: y });
    return tiles;
  }

  // a box in tiles: its far edges are outside it
  static isTileInBox(box: Box, tile: Position2D) {
    return tile.x >= box.x && tile.x < box.x + box.w && tile.y >= box.y && tile.y < box.y + box.h;
  }

  static tileToIndex(tile: Position2D, gridWidth: number) {
    return tile.y * gridWidth + tile.x;
  }

  //ISO
  static isoWorldToTile(position: Position2D, tileSize: Size2D): Position2D {
    const halfW = tileSize.width / 2;
    const halfH = tileSize.height / 2;
    const x = (position.x / halfW + position.y / halfH) / 2;
    const y = (position.y / halfH - position.x / halfW) / 2;
    return { x: Math.floor(x), y: Math.floor(y) };
  }

  static isoTileToWorld(tile: Position2D, tileSize: Size2D): Position2D {
    return {
      x: (tile.x - tile.y) * (tileSize.width / 2),
      y: (tile.x + tile.y) * (tileSize.height / 2),
    };
  }

  static isoTileCenterToWorld(tile: Position2D, tileSize: Size2D): Position2D {
    const top = Grid.isoTileToWorld(tile, tileSize);
    return { x: top.x, y: top.y + tileSize.height / 2 };
  }

  static isoSnapToGrid(position: Position2D, tileSize: Size2D): Position2D {
    const tile = Grid.isoWorldToTile(position, tileSize);
    return Grid.isoTileToWorld(tile, tileSize);
  }

  static isoSnapToGridCenter(
    position: Position2D,
    tileSize: Size2D,
  ): Position2D {
    const tile = Grid.isoWorldToTile(position, tileSize);
    return Grid.isoTileCenterToWorld(tile, tileSize);
  }

  static indexToTile(index: number, gridWidth: number): Position2D {
    return {
      x: index % gridWidth,
      y: Math.floor(index / gridWidth),
    };
  }

  // breadth-first from start to the nearest tile isGoal accepts, through passable tiles, 8 ways but
  // never across a blocked corner. The tiles on the way, start and goal included; null = no goal
  // reachable within maxVisited tiles. The start itself need not be passable
  static findPath(
    size: Size2D,
    start: Position2D,
    passable: (x: number, y: number) => boolean,
    isGoal: (x: number, y: number) => boolean,
    maxVisited = Infinity,
  ): Position2D[] | null {
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < size.width && y < size.height;
    if (!inside(start.x, start.y)) return null;
    const width = size.width;
    const count = width * size.height;
    // -1 = not reached; the start points at itself
    const cameFrom = new Int32Array(count).fill(-1);
    const queue = new Int32Array(count);
    const startIndex = start.y * width + start.x;
    cameFrom[startIndex] = startIndex;
    queue[0] = startIndex;
    let head = 0;
    let tail = 1;
    const open = (x: number, y: number) => inside(x, y) && passable(x, y);

    while (head < tail && head < maxVisited) {
      const index = queue[head++];
      const x = index % width;
      const y = (index - x) / width;
      if (isGoal(x, y)) {
        const path: Position2D[] = [];
        for (let at = index; ; at = cameFrom[at]) {
          path.push({ x: at % width, y: Math.floor(at / width) });
          if (at === startIndex) break;
        }
        return path.reverse();
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!open(nx, ny) || cameFrom[ny * width + nx] !== -1) continue;
          if (dx !== 0 && dy !== 0 && (!open(x + dx, y) || !open(x, y + dy))) continue;
          cameFrom[ny * width + nx] = index;
          queue[tail++] = ny * width + nx;
        }
      }
    }
    return null;
  }

  // the shortest way by length (a diagonal √2) from start toward target (fractional tiles), through
  // passable tiles, 8 ways but never across a blocked corner; it ends on the tile isGoal accepts
  // whose way plus the straight line from its middle to target is shortest, so target itself may be
  // blocked. The tiles on the way, start and goal included; null = no goal reachable
  static findShortestPath(
    size: Size2D,
    start: Position2D,
    passable: (x: number, y: number) => boolean,
    isGoal: (x: number, y: number) => boolean,
    target: Position2D,
  ): Position2D[] | null {
    const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < size.width && y < size.height;
    if (!inside(start.x, start.y)) return null;
    const width = size.width;
    const count = width * size.height;
    const costs = new Float64Array(count).fill(Infinity);
    const cameFrom = new Int32Array(count).fill(-1);
    const closed = new Uint8Array(count);
    const open = (x: number, y: number) => inside(x, y) && passable(x, y);
    const toTarget = (x: number, y: number) => Math.hypot(x + 0.5 - target.x, y + 0.5 - target.y);
    // a binary min-heap of tile indices by cost + the straight line to target
    const heap: number[] = [];
    const priorities: number[] = [];
    const push = (index: number, priority: number) => {
      let at = heap.length;
      heap.push(index);
      priorities.push(priority);
      while (at > 0) {
        const parent = (at - 1) >> 1;
        if (priorities[parent] <= priorities[at]) break;
        [heap[parent], heap[at]] = [heap[at], heap[parent]];
        [priorities[parent], priorities[at]] = [priorities[at], priorities[parent]];
        at = parent;
      }
    };
    const pop = () => {
      const top = heap[0];
      const lastIndex = heap.pop() as number;
      const lastPriority = priorities.pop() as number;
      if (heap.length > 0) {
        heap[0] = lastIndex;
        priorities[0] = lastPriority;
        let at = 0;
        while (true) {
          const left = at * 2 + 1;
          const right = left + 1;
          let smallest = at;
          if (left < heap.length && priorities[left] < priorities[smallest]) smallest = left;
          if (right < heap.length && priorities[right] < priorities[smallest]) smallest = right;
          if (smallest === at) break;
          [heap[smallest], heap[at]] = [heap[at], heap[smallest]];
          [priorities[smallest], priorities[at]] = [priorities[at], priorities[smallest]];
          at = smallest;
        }
      }
      return top;
    };

    const startIndex = start.y * width + start.x;
    costs[startIndex] = 0;
    cameFrom[startIndex] = startIndex;
    push(startIndex, toTarget(start.x, start.y));
    let best = Infinity;
    let goal = -1;
    while (heap.length > 0 && priorities[0] < best) {
      const index = pop();
      if (closed[index]) continue;
      closed[index] = 1;
      const x = index % width;
      const y = (index - x) / width;
      if (isGoal(x, y) && costs[index] + toTarget(x, y) < best) {
        best = costs[index] + toTarget(x, y);
        goal = index;
      }
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (!open(nx, ny)) continue;
          if (dx !== 0 && dy !== 0 && (!open(x + dx, y) || !open(x, y + dy))) continue;
          const next = ny * width + nx;
          const cost = costs[index] + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
          if (closed[next] || cost >= costs[next]) continue;
          costs[next] = cost;
          cameFrom[next] = index;
          push(next, cost + toTarget(nx, ny));
        }
      }
    }
    if (goal === -1) return null;
    const path: Position2D[] = [];
    for (let at = goal; ; at = cameFrom[at]) {
      path.push({ x: at % width, y: Math.floor(at / width) });
      if (at === startIndex) break;
    }
    return path.reverse();
  }

  // whether the straight line between two points (fractional tiles) crosses only passable tiles;
  // through a corner both tiles beside it must be passable
  static hasLineOfSight(from: Position2D, to: Position2D, passable: (x: number, y: number) => boolean) {
    let x = Math.floor(from.x);
    let y = Math.floor(from.y);
    const endX = Math.floor(to.x);
    const endY = Math.floor(to.y);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const deltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
    const deltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
    let nextX = dx === 0 ? Infinity : (dx > 0 ? x + 1 - from.x : from.x - x) * deltaX;
    let nextY = dy === 0 ? Infinity : (dy > 0 ? y + 1 - from.y : from.y - y) * deltaY;
    while (true) {
      if (!passable(x, y)) return false;
      if (x === endX && y === endY) return true;
      if (Math.min(nextX, nextY) > 1) return true;
      if (Math.abs(nextX - nextY) < 1e-9) {
        if (!passable(x + stepX, y) || !passable(x, y + stepY)) return false;
        x += stepX;
        y += stepY;
        nextX += deltaX;
        nextY += deltaY;
      } else if (nextX < nextY) {
        x += stepX;
        nextX += deltaX;
      } else {
        y += stepY;
        nextY += deltaY;
      }
    }
  }

  // the points (fractional tiles) kept only where the way has to turn: from each kept one straight
  // to the furthest one still in sight
  static smoothPath(points: Position2D[], passable: (x: number, y: number) => boolean) {
    if (points.length <= 2) return [...points];
    const kept = [points[0]];
    let anchor = 0;
    for (let index = 2; index < points.length; index++) {
      if (Grid.hasLineOfSight(points[anchor], points[index], passable)) continue;
      anchor = index - 1;
      kept.push(points[anchor]);
    }
    kept.push(points[points.length - 1]);
    return kept;
  }

  static generateGrid<T = Position2D>({
    gridSize,
    tileSize,
    callback,
  }: GridProps<T>): T[] {
    const result: T[] = [];

    for (let y = 0; y < gridSize.height; y++) {
      for (let x = 0; x < gridSize.width; x++) {
        const tile = { x, y };
        const position = Grid.tileToWorld(tile, tileSize);
        const index = Grid.tileToIndex(tile, gridSize.width);
        result.push(
          callback
            ? callback({ tilePixelPos: position, tileGridPos: tile, index })
            : (position as T),
        );
      }
    }

    return result;
  }
  static generateIsoGrid<T = Position2D>({
    gridSize,
    tileSize,
    callback,
  }: GridProps<T>): T[] {
    const result: T[] = [];

    for (let y = 0; y < gridSize.height; y++) {
      for (let x = 0; x < gridSize.width; x++) {
        const tile = { x, y };
        const position = Grid.isoTileToWorld(tile, tileSize);
        const index = Grid.tileToIndex(tile, gridSize.width);
        result.push(
          callback
            ? callback({ tilePixelPos: position, tileGridPos: tile, index })
            : (position as T),
        );
      }
    }

    return result;
  }
}
