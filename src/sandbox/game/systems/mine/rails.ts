import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import type { Signal } from "@axiom/events";
import type BuildSpace from "../../build/space";
import { boxShape } from "../../build/space";
import { STRUCTURES } from "../../content/structures";
import { MAP_LOOK } from "../../gpu/gameGlobals";
import { BlocksID } from "../../content/blocks";
import { BUILD_SPACE } from "../../sceneData";
import {
  RAILS,
  drawRail,
  isRailStep,
  railEnd,
  railPoint,
  railTile,
  railTiles,
  stepsTo,
  type RailSegment,
  type ShaftJoint,
} from "../../world/railShape";
import Terrain from "../world/terrain";
import GameEvents from "../core/gameEvents";

export type { ShaftJoint } from "../../world/railShape";

export interface RailsSignals {
  changed: Signal<void>;
}

export interface RailStart {
  corner: Position2D;
  cost: number;
}

export default class Rails extends PragmaSystem {
  public readonly segments: RailSegment[] = [];
  public readonly joints: ShaftJoint[] = [];
  private readonly jointIds = new Map<ShaftJoint, symbol>();
  declare private terrain: Terrain;
  declare private events: GameEvents;
  declare private space: BuildSpace;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.events = this.scene.getSystem(GameEvents);
    this.space = this.scene.sharedData.require(BUILD_SPACE);
  }

  destroy(): void {
    for (const id of this.jointIds.values()) this.space.remove(id);
    this.jointIds.clear();
  }

  render(): void {
    const tile = this.terrain.tile;
    for (const segment of this.segments) {
      drawRail(segment.from, railEnd(segment), tile);
      for (let steps = 0; steps < segment.length; steps++) {
        const from = railPoint(segment, steps);
        const color = this.damagedColor(railTile(from, segment.step));
        if (color) drawRail(from, railPoint(segment, steps + 1), tile, color);
      }
    }
    for (const joint of this.joints) {
      const color = this.damagedColor(joint.tile) ?? STRUCTURES.rails.look.color;
      drawRail({ x: joint.tile.x, y: joint.tile.y + 1 }, { x: joint.tile.x + 1, y: joint.tile.y + 1 }, tile, color);
    }
  }

  private damagedColor(tile: Position2D): RGBA | undefined {
    const damage = this.terrain.world.getDamage(tile.x, tile.y);
    if (damage <= 0) return undefined;
    const look = STRUCTURES.rails.look;
    if (this.isBroken(tile)) return look.broken;
    const shade = AxiomMath.lerp(1, MAP_LOOK.damagedShade, damage / STRUCTURES.rails.durability);
    return [look.color[0] * shade, look.color[1] * shade, look.color[2] * shade, look.color[3]];
  }

  public get jointAnchors() {
    return this.joints.map((joint) => joint.anchor);
  }

  public get workingJoints() {
    return this.joints.filter((joint) => !this.isBroken(joint.tile));
  }

  public isBroken(tile: Position2D) {
    return this.terrain.world.getDamage(tile.x, tile.y) >= STRUCTURES.rails.durability;
  }

  public canRide(from: Position2D, to: Position2D) {
    const step = { x: to.x - from.x, y: to.y - from.y };
    if (!isRailStep(step) || this.isBroken(railTile(from, step))) return false;
    return this.segments.some((segment) => {
      const at = stepsTo(segment, from);
      const next = stepsTo(segment, to);
      return at !== undefined && next !== undefined && Math.abs(at - next) === 1;
    });
  }

  public get stats() {
    let tiles = 0;
    let damaged = 0;
    let broken = 0;
    for (const segment of this.segments)
      for (const tile of railTiles(segment)) {
        tiles++;
        if (this.terrain.world.getDamage(tile.x, tile.y) > 0) damaged++;
        if (this.isBroken(tile)) broken++;
      }
    return {
      segments: this.segments.length,
      tiles: tiles,
      joints: this.joints.length,
      damaged: damaged,
      broken: broken,
    };
  }

  public isRail(tile: Position2D) {
    return this.terrain.world.getType(tile.x, tile.y) === BlocksID.rail;
  }

  public damage(tile: Position2D, amount: number) {
    this.setDamage(tile, this.terrain.world.getDamage(tile.x, tile.y) + amount);
  }

  public repair(tile: Position2D) {
    this.setDamage(tile, 0);
  }

  private setDamage(tile: Position2D, damage: number) {
    assert(this.isRail(tile), `No rail on ${tile.x}, ${tile.y}`);
    const wasBroken = this.isBroken(tile);
    this.terrain.world.setDamage(tile.x, tile.y, Math.min(damage, STRUCTURES.rails.durability));
    if (this.isBroken(tile) !== wasBroken) this.events.rails.changed.emit();
  }

  public remove(tiles: Position2D[]) {
    const painted = new Set(tiles.map(keyOf));
    const cleared: Position2D[] = [];
    for (const joint of this.joints.filter((joint) => painted.has(keyOf(joint.tile)))) {
      this.joints.splice(this.joints.indexOf(joint), 1);
      const id = this.jointIds.get(joint);
      if (id !== undefined) {
        this.space.remove(id);
        this.jointIds.delete(joint);
      }
      cleared.push(joint.tile);
    }
    for (const segment of [...this.segments]) {
      const own = railTiles(segment);
      if (!own.some((tile) => painted.has(keyOf(tile)))) continue;
      this.segments.splice(this.segments.indexOf(segment), 1);
      let start: number | undefined;
      own.forEach((tile, index) => {
        if (painted.has(keyOf(tile))) {
          cleared.push(tile);
          if (start !== undefined) this.segments.push(piece(segment, start, index));
          start = undefined;
        } else if (start === undefined) start = index;
      });
      if (start !== undefined) this.segments.push(piece(segment, start, own.length));
    }
    for (const tile of cleared) this.terrain.place(tile.x, tile.y, BlocksID.air);
    this.events.rails.changed.emit();
  }

  public buildJoint(joint: ShaftJoint) {
    this.joints.push(joint);
    const id = Symbol("shaftJoint");
    this.jointIds.set(joint, id);
    this.space.add({
      id: id,
      layer: "main",
      shape: boxShape({ x: joint.tile.x, y: joint.tile.y, w: 1, h: 1 }),
    });
    this.terrain.place(joint.tile.x, joint.tile.y, BlocksID.rail);
    this.events.rails.changed.emit();
  }

  public nearestAnchor(spot: Position2D, anchors: Position2D[], reach: number) {
    let nearest: Position2D | undefined;
    let best = reach;
    const consider = (point: Position2D) => {
      const distance = AxiomMath.distance2d(point, spot);
      if (distance > best) return;
      best = distance;
      nearest = point;
    };
    for (const anchor of [...anchors, ...this.jointAnchors]) consider(anchor);
    for (const segment of this.segments)
      for (let steps = 0; steps <= segment.length; steps++) consider(railPoint(segment, steps));
    return nearest;
  }

  public leads(from: Position2D[], to: Position2D[], links: Position2D[][]) {
    const free = (corner: Position2D) => ({ corner: corner, cost: 0 });
    return this.route(from.map(free), to.map(free), links) !== undefined;
  }

  public route(
    starts: RailStart[],
    goals: RailStart[],
    links: Position2D[][],
    shaft: Position2D[] = [],
  ): Position2D[] | undefined {
    const ways = this.ways(links, shaft);
    const goalCosts = new Map<string, number>();
    for (const goal of goals)
      goalCosts.set(keyOf(goal.corner), Math.min(goal.cost, goalCosts.get(keyOf(goal.corner)) ?? Infinity));
    const costs = new Map<string, number>();
    const corners = new Map<string, Position2D>();
    const cameFrom = new Map<string, string>();
    const done = new Set<string>();
    const open: string[] = [];
    let best = Infinity;
    let found: string | undefined;
    const reach = (corner: Position2D, cost: number, from: string | undefined) => {
      const key = keyOf(corner);
      if (cost >= (costs.get(key) ?? Infinity)) return;
      costs.set(key, cost);
      corners.set(key, corner);
      if (from === undefined) cameFrom.delete(key);
      else cameFrom.set(key, from);
      open.push(key);
    };
    for (const start of starts) reach(start.corner, start.cost, undefined);
    while (open.length > 0) {
      let cheapest = 0;
      for (let index = 1; index < open.length; index++)
        if ((costs.get(open[index]) as number) < (costs.get(open[cheapest]) as number)) cheapest = index;
      const key = open.splice(cheapest, 1)[0];
      const cost = costs.get(key) as number;
      if (cost >= best) break;
      if (done.has(key)) continue;
      done.add(key);
      const goalCost = goalCosts.get(key);
      if (goalCost !== undefined && cost + goalCost < best) {
        best = cost + goalCost;
        found = key;
      }
      const corner = corners.get(key) as Position2D;
      for (const next of ways.get(key) ?? [])
        if (!done.has(keyOf(next))) reach(next, cost + AxiomMath.distance2d(corner, next), key);
    }
    if (found === undefined) return undefined;
    const path: Position2D[] = [];
    for (let at: string | undefined = found; at !== undefined; at = cameFrom.get(at))
      path.push(corners.get(at) as Position2D);
    return path.reverse();
  }

  private ways(links: Position2D[][], shaft: Position2D[]) {
    const ways = new Map<string, Position2D[]>();
    const join = (first: Position2D, second: Position2D) => {
      for (const [one, other] of [
        [first, second],
        [second, first],
      ]) {
        const known = ways.get(keyOf(one));
        if (known) known.push(other);
        else ways.set(keyOf(one), [other]);
      }
    };
    for (const segment of this.segments)
      for (let steps = 0; steps < segment.length; steps++) {
        const from = railPoint(segment, steps);
        if (!this.isBroken(railTile(from, segment.step))) join(from, railPoint(segment, steps + 1));
      }
    for (const group of links) for (const corner of group.slice(1)) join(group[0], corner);
    shaft.forEach((corner, index) => {
      for (const other of shaft.slice(index + 1)) join(corner, other);
    });
    return ways;
  }

  public build(segment: RailSegment) {
    assert(isRailStep(segment.step), `A rail goes flat or at 45°, not by ${segment.step.x}, ${segment.step.y}`);
    this.segments.push(segment);
    for (const tile of railTiles(segment)) this.terrain.place(tile.x, tile.y, BlocksID.rail);
    this.events.rails.changed.emit();
  }

  public isJunction(corner: Position2D) {
    return this.arms(corner, []) >= RAILS.arms;
  }

  public arms(point: Position2D, anchors: Position2D[]) {
    let arms = [...anchors, ...this.jointAnchors].filter((anchor) => isSame(anchor, point)).length;
    for (const segment of this.segments) {
      const steps = stepsTo(segment, point);
      if (steps === undefined) continue;
      arms += steps === 0 || steps === segment.length ? 1 : 2;
    }
    return arms;
  }

  public nearBranch(point: Position2D, anchors: Position2D[]) {
    for (const segment of this.segments) {
      const steps = stepsTo(segment, point);
      if (steps === undefined) continue;
      const from = Math.max(steps - RAILS.spacing + 1, 0);
      const to = Math.min(steps + RAILS.spacing - 1, segment.length);
      for (let near = from; near <= to; near++)
        if (near !== steps && this.arms(railPoint(segment, near), anchors) >= RAILS.arms) return true;
    }
    return false;
  }

  public isTileFreeForRail(tile: Position2D, end: Position2D | undefined) {
    const type = this.terrain.world.getType(tile.x, tile.y);
    if (type === BlocksID.air) return true;
    if (type !== BlocksID.rail || end === undefined) return false;
    const owners = this.segments.filter((segment) =>
      railTiles(segment).some((owned) => isSame(owned, tile)),
    );
    return owners.length > 0 && owners.every((owner) => stepsTo(owner, end) !== undefined);
  }
}

function isSame(first: Position2D, second: Position2D) {
  return first.x === second.x && first.y === second.y;
}

function keyOf(corner: Position2D) {
  return `${corner.x},${corner.y}`;
}

function piece(segment: RailSegment, from: number, to: number): RailSegment {
  return { from: railPoint(segment, from), step: segment.step, length: to - from };
}
