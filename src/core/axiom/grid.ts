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
