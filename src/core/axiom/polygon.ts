import { assert } from "./utils";

const STRIDE = { edge: 6, segment: 4 };
const SLAB = 8;
const ERODE_CACHE = 20;
const PLACE = { minScale: 0.001, steps: 14 };

interface HexagonSide {
  startX: number;
  startY: number;
  deltaX: number;
  deltaY: number;
}

export default class Polygon {
  readonly outer: readonly Position2D[];
  readonly holes: readonly (readonly Position2D[])[];
  readonly bounds: BoxAABB;
  readonly edgeCount: number;
  // ax, ay, b, by, nx, ny per edge of every ring; n = unit normal pointing out of the filled area
  private readonly edges: Float64Array;
  private readonly erosions = new Map<string, PolygonErosion>();

  constructor(outer: Position2D[], holes: Position2D[][] = []) {
    const outerRing = Polygon.cleanRing(outer, "outer");
    const holeRings = holes.map((hole, index) =>
      Polygon.cleanRing(hole, `hole ${index}`),
    );
    if (Polygon.signedArea(outerRing) < 0) outerRing.reverse();
    for (const hole of holeRings)
      if (Polygon.signedArea(hole) > 0) hole.reverse();
    this.outer = outerRing;
    this.holes = holeRings;

    const rings = [outerRing, ...holeRings];
    this.edgeCount = rings.reduce((count, ring) => count + ring.length, 0);
    this.edges = new Float64Array(this.edgeCount * STRIDE.edge);
    let offset = 0;
    for (const ring of rings) {
      for (let index = 0; index < ring.length; index++) {
        const a = ring[index];
        const b = ring[(index + 1) % ring.length];
        const length = Math.hypot(b.x - a.x, b.y - a.y);
        this.edges.set(
          [a.x, a.y, b.x, b.y, (b.y - a.y) / length, -(b.x - a.x) / length],
          offset,
        );
        offset += STRIDE.edge;
      }
    }
    this.assertSimple();
    for (const [index, hole] of holeRings.entries())
      assert(
        Polygon.ringContains(outerRing, hole[0]),
        `Polygon: hole ${index} lies outside the outer ring`,
      );

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const { x, y } of outerRing) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    this.bounds = { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
  }

  contains(point: Position2D) {
    const { x, y } = point;
    const edges = this.edges;
    let inside = false;
    for (let offset = 0; offset < edges.length; offset += STRIDE.edge) {
      const ay = edges[offset + 1];
      const by = edges[offset + 3];
      if (ay > y === by > y) continue;
      const ax = edges[offset];
      const crossX = ax + ((edges[offset + 2] - ax) * (y - ay)) / (by - ay);
      if (x < crossX) inside = !inside;
    }
    return inside;
  }
  nearestPoint(point: Position2D, out: Position2D = { x: 0, y: 0 }) {
    Polygon.nearestOnSegments(
      this.edges,
      STRIDE.edge,
      this.edgeCount,
      point,
      out,
    );
    return out;
  }
  distance(point: Position2D) {
    const nearest = Polygon.scratch;
    this.nearestPoint(point, nearest);
    return Math.hypot(point.x - nearest.x, point.y - nearest.y);
  }
  signedDistance(point: Position2D) {
    const distance = this.distance(point);
    return this.contains(point) ? -distance : distance;
  }

  fit(point: Position2D, halfWidth: number, halfHeight: number) {
    if (!this.contains(point)) return 0;
    const { x, y } = point;
    const edges = this.edges;
    let fit = Infinity;
    for (let offset = 0; offset < edges.length; offset += STRIDE.edge) {
      const ax = edges[offset];
      const ay = edges[offset + 1];
      const bx = edges[offset + 2];
      const by = edges[offset + 3];
      const nx = edges[offset + 4];
      const ny = edges[offset + 5];
      const gapX =
        Math.max(Math.min(ax, bx) - x, x - Math.max(ax, bx), 0) / halfWidth;
      const gapY =
        Math.max(Math.min(ay, by) - y, y - Math.max(ay, by), 0) / halfHeight;
      const gapNormal =
        Math.abs(nx * (x - ax) + ny * (y - ay)) /
        (Math.abs(nx) * halfWidth + Math.abs(ny) * halfHeight);
      const edgeFit = Math.max(gapX, gapY, gapNormal);
      if (edgeFit < fit) fit = edgeFit;
    }
    return fit;
  }

  placeBox(
    target: Position2D,
    halfWidth: number,
    halfHeight: number,
    out: Position2D = { x: 0, y: 0 },
    margin = 0,
    prefer?: Position2D,
  ) {
    const need = Polygon.need;
    if (margin <= 0 || !this.boundsWithin(target, margin, margin, need)) {
      need.min.x = need.max.x = target.x;
      need.min.y = need.max.y = target.y;
    }
    const aim = Polygon.aim;
    aim.x = prefer?.x ?? (need.min.x + need.max.x) / 2;
    aim.y = prefer?.y ?? (need.min.y + need.max.y) / 2;
    const reaches = (scale: number) => {
      const erosion = this.erode(halfWidth * scale, halfHeight * scale);
      if (erosion.isEmpty) return false;
      erosion.clamp(aim, out);
      return (
        out.x - halfWidth <= need.min.x &&
        out.x + halfWidth >= need.max.x &&
        out.y - halfHeight <= need.min.y &&
        out.y + halfHeight >= need.max.y
      );
    };
    if (reaches(1)) return this.fit(out, halfWidth, halfHeight);
    const keepNeed = () => {
      out.x = Math.min(
        Math.max(out.x, need.max.x - halfWidth),
        need.min.x + halfWidth,
      );
      out.y = Math.min(
        Math.max(out.y, need.max.y - halfHeight),
        need.min.y + halfHeight,
      );
    };
    let low = PLACE.minScale;
    let high = 1;
    for (let step = 0; step < PLACE.steps; step++) {
      const middle = (low + high) / 2;
      if (reaches(middle)) low = middle;
      else high = middle;
    }
    if (!reaches(low)) {
      out.x = aim.x;
      out.y = aim.y;
    }
    const aimFit = this.fit(aim, halfWidth, halfHeight);
    const toAim = aimFit >= low ? 1 : (1 - low) / (1 - aimFit);
    out.x += (aim.x - out.x) * toAim;
    out.y += (aim.y - out.y) * toAim;
    keepNeed();
    return this.fit(out, halfWidth, halfHeight);
  }

  boundsWithin(
    center: Position2D,
    halfWidth: number,
    halfHeight: number,
    out: BoxAABB,
  ) {
    const left = center.x - halfWidth;
    const right = center.x + halfWidth;
    const top = center.y - halfHeight;
    const bottom = center.y + halfHeight;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const add = (x: number, y: number) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };
    const corner = Polygon.scratch;
    for (const [x, y] of [
      [left, top],
      [right, top],
      [right, bottom],
      [left, bottom],
    ]) {
      corner.x = x;
      corner.y = y;
      if (this.contains(corner)) add(x, y);
    }
    const edges = this.edges;
    for (let offset = 0; offset < edges.length; offset += STRIDE.edge) {
      const ax = edges[offset];
      const ay = edges[offset + 1];
      const deltaX = edges[offset + 2] - ax;
      const deltaY = edges[offset + 3] - ay;
      if (ax >= left && ax <= right && ay >= top && ay <= bottom) add(ax, ay);
      for (const side of [left, right]) {
        if (deltaX === 0) continue;
        const t = (side - ax) / deltaX;
        const y = ay + deltaY * t;
        if (t >= 0 && t <= 1 && y >= top && y <= bottom) add(side, y);
      }
      for (const side of [top, bottom]) {
        if (deltaY === 0) continue;
        const t = (side - ay) / deltaY;
        const x = ax + deltaX * t;
        if (t >= 0 && t <= 1 && x >= left && x <= right) add(x, side);
      }
    }
    if (minX > maxX) return false;
    out.min.x = minX;
    out.min.y = minY;
    out.max.x = maxX;
    out.max.y = maxY;
    return true;
  }

  erode(halfWidth: number, halfHeight: number) {
    assert(
      halfWidth > 0 && halfHeight > 0,
      "Polygon.erode: half size must be positive",
    );
    const key = `${halfWidth}:${halfHeight}`;
    const cache = this.erosions;
    const cached = cache.get(key);
    if (cached !== undefined) {
      cache.delete(key);
      cache.set(key, cached);
      return cached;
    }
    const erosion = new PolygonErosion(
      this,
      halfWidth,
      halfHeight,
      this.erodedOutline(halfWidth, halfHeight),
    );
    cache.set(key, erosion);
    if (cache.size > ERODE_CACHE)
      cache.delete(cache.keys().next().value as string);
    return erosion;
  }

  private erodedOutline(halfWidth: number, halfHeight: number) {
    const count = this.edgeCount;
    const slabs = Polygon.slabsFor(this.edges, count, halfWidth, halfHeight);
    const epsilon = (halfWidth + halfHeight) * 1e-9;
    const segments: number[] = [];
    const side = Polygon.side;
    const midpoint = Polygon.scratch;
    for (let owner = 0; owner < count; owner++) {
      for (let line = 0; line < 6; line++) {
        if (!Polygon.hexagonSide(slabs, owner, line, side)) continue;
        const { startX, startY, deltaX, deltaY } = side;
        let pieces = Polygon.pieces;
        let spare = Polygon.spare;
        pieces[0] = 0;
        pieces[1] = 1;
        let length = 2;
        for (let other = 0; other < count && length > 0; other++) {
          if (other === owner) continue;
          length = Polygon.cutBySlabs(
            slabs,
            other,
            side,
            epsilon,
            pieces,
            length,
            spare,
          );
          const swap = pieces;
          pieces = spare;
          spare = swap;
        }
        const sideLength = Math.hypot(deltaX, deltaY);
        for (let piece = 0; piece < length; piece += 2) {
          const from = pieces[piece];
          const to = pieces[piece + 1];
          if ((to - from) * sideLength <= epsilon) continue;
          midpoint.x = startX + deltaX * ((from + to) / 2);
          midpoint.y = startY + deltaY * ((from + to) / 2);
          if (!this.contains(midpoint)) continue;
          segments.push(
            startX + deltaX * from,
            startY + deltaY * from,
            startX + deltaX * to,
            startY + deltaY * to,
          );
        }
      }
    }
    return new Float64Array(segments);
  }

  private static slabsFor(
    edges: Float64Array,
    count: number,
    halfWidth: number,
    halfHeight: number,
  ) {
    if (Polygon.slabs.length < count * SLAB) {
      Polygon.slabs = new Float64Array(count * SLAB);
      Polygon.pieces = new Float64Array(count * 2 + 4);
      Polygon.spare = new Float64Array(count * 2 + 4);
    }
    const slabs = Polygon.slabs;
    for (let index = 0; index < count; index++) {
      const offset = index * STRIDE.edge;
      const ax = edges[offset];
      const ay = edges[offset + 1];
      const bx = edges[offset + 2];
      const by = edges[offset + 3];
      const nx = edges[offset + 4];
      const ny = edges[offset + 5];
      const slab = index * SLAB;
      slabs[slab] = Math.min(ax, bx) - halfWidth;
      slabs[slab + 1] = Math.max(ax, bx) + halfWidth;
      slabs[slab + 2] = Math.min(ay, by) - halfHeight;
      slabs[slab + 3] = Math.max(ay, by) + halfHeight;
      slabs[slab + 4] = nx;
      slabs[slab + 5] = ny;
      const aligned = Math.abs(nx) < 1e-12 || Math.abs(ny) < 1e-12;
      const middle = nx * ax + ny * ay;
      const extent = Math.abs(nx) * halfWidth + Math.abs(ny) * halfHeight;
      slabs[slab + 6] = aligned ? -Infinity : middle - extent;
      slabs[slab + 7] = aligned ? Infinity : middle + extent;
    }
    return slabs;
  }

  private static hexagonSide(
    slabs: Float64Array,
    index: number,
    line: number,
    out: HexagonSide,
  ) {
    const slab = index * SLAB;
    const minX = slabs[slab];
    const maxX = slabs[slab + 1];
    const minY = slabs[slab + 2];
    const maxY = slabs[slab + 3];
    const nx = slabs[slab + 4];
    const ny = slabs[slab + 5];
    const low = slabs[slab + 6];
    const high = slabs[slab + 7];
    let enter = 0;
    let exit = 1;
    if (line < 4) {
      const vertical = line < 2;
      out.startX = vertical ? (line === 0 ? minX : maxX) : minX;
      out.startY = vertical ? minY : line === 2 ? minY : maxY;
      out.deltaX = vertical ? 0 : maxX - minX;
      out.deltaY = vertical ? maxY - minY : 0;
      if (low !== -Infinity) {
        const start = nx * out.startX + ny * out.startY;
        const speed = nx * out.deltaX + ny * out.deltaY;
        const first = (low - start) / speed;
        const second = (high - start) / speed;
        enter = Math.max(enter, Math.min(first, second));
        exit = Math.min(exit, Math.max(first, second));
      }
    } else {
      if (low === -Infinity) return false;
      const value = line === 4 ? low : high;
      // along the edge over the x slab's span, then cut to the y slab
      const tangentX = -ny;
      const tangentY = nx;
      const baseX = nx * value;
      const baseY = ny * value;
      const fromX = (minX - baseX) / tangentX;
      const toX = (maxX - baseX) / tangentX;
      const from = Math.min(fromX, toX);
      const to = Math.max(fromX, toX);
      out.startX = baseX + tangentX * from;
      out.startY = baseY + tangentY * from;
      out.deltaX = tangentX * (to - from);
      out.deltaY = tangentY * (to - from);
      const first = (minY - out.startY) / out.deltaY;
      const second = (maxY - out.startY) / out.deltaY;
      enter = Math.max(enter, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
    }
    if (exit <= enter) return false;
    out.startX += out.deltaX * enter;
    out.startY += out.deltaY * enter;
    out.deltaX *= exit - enter;
    out.deltaY *= exit - enter;
    return true;
  }

  private static cutBySlabs(
    slabs: Float64Array,
    index: number,
    side: HexagonSide,
    epsilon: number,
    pieces: Float64Array,
    length: number,
    kept: Float64Array,
  ) {
    const slab = index * SLAB;
    const { startX, startY, deltaX, deltaY } = side;
    const nx = slabs[slab + 4];
    const ny = slabs[slab + 5];
    let enter = -Infinity;
    let exit = Infinity;
    for (let axis = 0; axis < 3; axis++) {
      const low = slabs[slab + (axis === 2 ? 6 : axis * 2)] + epsilon;
      const high = slabs[slab + (axis === 2 ? 7 : axis * 2 + 1)] - epsilon;
      if (low === -Infinity) continue;
      const start =
        axis === 0 ? startX : axis === 1 ? startY : nx * startX + ny * startY;
      const speed =
        axis === 0 ? deltaX : axis === 1 ? deltaY : nx * deltaX + ny * deltaY;
      if (speed === 0) {
        if (start <= low || start >= high) enter = Infinity;
        continue;
      }
      const first = (low - start) / speed;
      const second = (high - start) / speed;
      enter = Math.max(enter, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
    }
    let written = 0;
    for (let piece = 0; piece < length; piece += 2) {
      const from = pieces[piece];
      const to = pieces[piece + 1];
      if (enter >= exit || exit <= from || enter >= to) {
        kept[written++] = from;
        kept[written++] = to;
        continue;
      }
      if (enter > from) {
        kept[written++] = from;
        kept[written++] = enter;
      }
      if (exit < to) {
        kept[written++] = exit;
        kept[written++] = to;
      }
    }
    return written;
  }

  static nearestOnSegments(
    segments: Float64Array,
    stride: number,
    count: number,
    point: Position2D,
    out: Position2D,
  ) {
    const { x, y } = point;
    let best = Infinity;
    out.x = x;
    out.y = y;
    for (let offset = 0; offset < count * stride; offset += stride) {
      const ax = segments[offset];
      const ay = segments[offset + 1];
      const deltaX = segments[offset + 2] - ax;
      const deltaY = segments[offset + 3] - ay;
      const lengthSquared = deltaX * deltaX + deltaY * deltaY;
      let t =
        lengthSquared === 0
          ? 0
          : ((x - ax) * deltaX + (y - ay) * deltaY) / lengthSquared;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const nearX = ax + deltaX * t;
      const nearY = ay + deltaY * t;
      const distance = (x - nearX) * (x - nearX) + (y - nearY) * (y - nearY);
      if (distance >= best) continue;
      best = distance;
      out.x = nearX;
      out.y = nearY;
    }
    return best;
  }

  private static readonly scratch: Position2D = { x: 0, y: 0 };
  private static readonly side: HexagonSide = {
    startX: 0,
    startY: 0,
    deltaX: 0,
    deltaY: 0,
  };
  private static slabs = new Float64Array(0);
  private static pieces = new Float64Array(0);
  private static spare = new Float64Array(0);
  private static readonly need: BoxAABB = {
    min: { x: 0, y: 0 },
    max: { x: 0, y: 0 },
  };
  private static readonly aim: Position2D = { x: 0, y: 0 };

  private static cleanRing(points: Position2D[], name: string) {
    const ring: Position2D[] = [];
    for (const { x, y } of points) {
      assert(
        Number.isFinite(x) && Number.isFinite(y),
        `Polygon: ${name} has a non-finite point`,
      );
      const last = ring[ring.length - 1];
      if (last === undefined || last.x !== x || last.y !== y)
        ring.push({ x, y });
    }
    if (
      ring.length > 1 &&
      ring[0].x === ring[ring.length - 1].x &&
      ring[0].y === ring[ring.length - 1].y
    )
      ring.pop();
    for (let index = 0; index < ring.length && ring.length >= 3;) {
      const previous = ring[(index + ring.length - 1) % ring.length];
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      const cross =
        (current.x - previous.x) * (next.y - current.y) -
        (current.y - previous.y) * (next.x - current.x);
      const forward =
        (current.x - previous.x) * (next.x - current.x) +
        (current.y - previous.y) * (next.y - current.y);
      if (cross === 0 && forward > 0) ring.splice(index, 1);
      else index++;
    }
    assert(
      ring.length >= 3,
      `Polygon: ${name} needs at least 3 distinct points`,
    );
    return ring;
  }
  private static signedArea(ring: Position2D[]) {
    let area = 0;
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index];
      const b = ring[(index + 1) % ring.length];
      area += a.x * b.y - b.x * a.y;
    }
    return area / 2;
  }
  private static ringContains(ring: Position2D[], { x, y }: Position2D) {
    let inside = false;
    for (let index = 0; index < ring.length; index++) {
      const a = ring[index];
      const b = ring[(index + 1) % ring.length];
      if (a.y > y === b.y > y) continue;
      if (x < a.x + ((b.x - a.x) * (y - a.y)) / (b.y - a.y)) inside = !inside;
    }
    return inside;
  }
  private assertSimple() {
    const edges = this.edges;
    const ringOf: number[] = [];
    const ringStart: number[] = [];
    const ringLength: number[] = [];
    let start = 0;
    for (const [ring, points] of [this.outer, ...this.holes].entries()) {
      for (let index = 0; index < points.length; index++) {
        ringOf.push(ring);
        ringStart.push(start);
        ringLength.push(points.length);
      }
      start += points.length;
    }
    for (let first = 0; first < this.edgeCount; first++) {
      for (let second = first + 1; second < this.edgeCount; second++) {
        if (ringOf[first] === ringOf[second]) {
          const length = ringLength[first];
          const local = first - ringStart[first];
          const otherLocal = second - ringStart[second];
          if (
            otherLocal === local + 1 ||
            (local === 0 && otherLocal === length - 1)
          )
            continue;
        }
        const a = first * STRIDE.edge;
        const b = second * STRIDE.edge;
        assert(
          !Polygon.segmentsTouch(
            edges[a],
            edges[a + 1],
            edges[a + 2],
            edges[a + 3],
            edges[b],
            edges[b + 1],
            edges[b + 2],
            edges[b + 3],
          ),
          `Polygon: edges cross or touch (ring ${ringOf[first]} edge ${first - ringStart[first]}, ring ${ringOf[second]} edge ${second - ringStart[second]})`,
        );
      }
    }
  }
  private static segmentsTouch(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number,
  ) {
    const orient = (
      px: number,
      py: number,
      qx: number,
      qy: number,
      rx: number,
      ry: number,
    ) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
    const onSegment = (
      px: number,
      py: number,
      qx: number,
      qy: number,
      rx: number,
      ry: number,
    ) =>
      Math.min(px, qx) <= rx &&
      rx <= Math.max(px, qx) &&
      Math.min(py, qy) <= ry &&
      ry <= Math.max(py, qy);
    const first = orient(ax, ay, bx, by, cx, cy);
    const second = orient(ax, ay, bx, by, dx, dy);
    const third = orient(cx, cy, dx, dy, ax, ay);
    const fourth = orient(cx, cy, dx, dy, bx, by);
    if (first !== second && third !== fourth) return true;
    return (
      (first === 0 && onSegment(ax, ay, bx, by, cx, cy)) ||
      (second === 0 && onSegment(ax, ay, bx, by, dx, dy)) ||
      (third === 0 && onSegment(cx, cy, dx, dy, ax, ay)) ||
      (fourth === 0 && onSegment(cx, cy, dx, dy, bx, by))
    );
  }
}

export class PolygonErosion {
  readonly count: number;

  constructor(
    readonly polygon: Polygon,
    readonly halfWidth: number,
    readonly halfHeight: number,
    readonly segments: Float64Array,
  ) {
    this.count = segments.length / STRIDE.segment;
  }

  get isEmpty() {
    return this.count === 0;
  }
  contains(point: Position2D) {
    return this.polygon.fit(point, this.halfWidth, this.halfHeight) >= 1 - 1e-9;
  }
  nearestPoint(point: Position2D, out: Position2D = { x: 0, y: 0 }) {
    Polygon.nearestOnSegments(
      this.segments,
      STRIDE.segment,
      this.count,
      point,
      out,
    );
    return out;
  }
  // an empty erosion leaves the point as it is, the caller decides what then
  clamp(point: Position2D, out: Position2D = { x: 0, y: 0 }) {
    if (this.isEmpty || this.contains(point)) {
      out.x = point.x;
      out.y = point.y;
      return out;
    }
    return this.nearestPoint(point, out);
  }
}
