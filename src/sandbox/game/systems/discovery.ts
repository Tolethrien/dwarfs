import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import type Ball from "../components/ball";
import Headlight from "../components/headlight";
import { blocksSight } from "../content/blocks";
import { LIGHTS, type LightsID } from "../content/lights";
import { STRUCTURES } from "../content/structures";
import { craterCenter } from "../world/shaftShape";
import GameGlobals from "../gpu/gameGlobals";
import { WORLD_FOG } from "../world/world";
import type World from "../world/world";
import { gameSwitch } from "../debugCommands";
import BallPhysics from "./ballPhysics";
import Terrain from "./terrain";

const DISCOVERY = {
  edge: 0.8,
  ball: { reach: 2.5, intoRock: 30 },
};

export default class Discovery extends PragmaSystem {
  private readonly lastTile = new WeakMap<Ball, number>();
  private readonly dirty = { from: Infinity, to: -Infinity };
  private fogShown = true;
  private fullLight = false;
  declare private physics: BallPhysics;
  declare private terrain: Terrain;

  constructor(
    internal: InternalPSProps,
    private readonly world: World,
  ) {
    super(internal);
  }

  awake(): void {
    this.physics = this.scene.getSystem(BallPhysics);
    this.terrain = this.scene.getSystem(Terrain);
    gameSwitch(
      "fog",
      "fog of war",
      () => this.fogShown,
      (on) => this.showFog(on),
    );
    gameSwitch(
      "fullLight",
      "full light",
      () => this.fullLight,
      (on) => {
        this.fullLight = on;
        GameGlobals.setFullLight(on);
      },
    );
  }

  start(): void {
    this.uploadFogMask();
    GameGlobals.setFullLight(this.fullLight);
  }

  update(): void {
    for (const ball of this.physics.all) {
      const position = ball.actor.transform.getPosition();
      const tile = this.world.worldToTile(position);
      const index = this.world.tileIndex(tile.x, tile.y);
      if (this.lastTile.get(ball) === index) continue;
      this.lastTile.set(ball, index);
      const headlight = ball.actor.getComponent(Headlight);
      assert(
        headlight !== undefined,
        `Ball ${ball.actor.ID.description} has no Headlight`,
      );
      this.revealLight(position, headlight.light);
    }
  }

  render(): void {
    if (!this.fogShown || this.dirty.from > this.dirty.to) return;
    GameGlobals.writeFogRows(
      this.world.discovered,
      this.world.fogSize.width,
      this.dirty.from,
      this.dirty.to,
    );
    this.dirty.from = Infinity;
    this.dirty.to = -Infinity;
  }

  private showFog(on: boolean) {
    if (on === this.fogShown) return;
    this.fogShown = on;
    this.uploadFogMask();
  }

  private uploadFogMask() {
    GameGlobals.uploadFog(
      this.fogShown
        ? this.world.discovered
        : new Uint8Array(this.world.discovered.length).fill(255),
    );
    this.dirty.from = Infinity;
    this.dirty.to = -Infinity;
  }

  public revealLight(center: Position2D, light: LightsID) {
    this.reveal(center, LIGHTS[light].radius * DISCOVERY.ball.reach, false);
  }

  public revealTiles(tiles: Position2D[]) {
    const rows = this.world.discoverTiles(tiles);
    this.dirty.from = Math.min(this.dirty.from, rows.from);
    this.dirty.to = Math.max(this.dirty.to, rows.to);
  }

  public revealCrater(
    center = craterCenter(this.world, this.world.shaftDepth),
    radius = STRUCTURES.station.crater.radius,
  ) {
    const crater = STRUCTURES.station.crater;
    const tile = this.world.meta.tileInPixels;
    const full = radius * (1 + crater.jag) * tile;
    const fade = crater.fade * tile;
    this.reveal(
      { x: center.x * tile, y: center.y * tile },
      full + fade,
      true,
      fade,
    );
  }

  public reveal(
    center: Position2D,
    radius: number,
    throughRock: boolean,
    fade = radius * DISCOVERY.edge,
  ) {
    const world = this.world;
    const point = world.meta.tileInPixels / WORLD_FOG.perTile;
    const size = world.fogSize;
    const fromX = Math.max(Math.floor((center.x - radius) / point), 0);
    const toX = Math.min(
      Math.floor((center.x + radius) / point),
      size.width - 1,
    );
    const fromY = Math.max(Math.floor((center.y - radius) / point), 0);
    const toY = Math.min(
      Math.floor((center.y + radius) / point),
      size.height - 1,
    );
    const target = { x: 0, y: 0 };
    for (let py = fromY; py <= toY; py++)
      for (let px = fromX; px <= toX; px++) {
        target.x = (px + 0.5) * point;
        target.y = (py + 0.5) * point;
        const distance = Math.hypot(target.x - center.x, target.y - center.y);
        if (distance >= radius) continue;
        const rim = AxiomMath.clamp((radius - distance) / fade, 0, 1);
        const index = px + py * size.width;
        if (world.discovered[index] >= Math.round(rim * 255)) continue;
        const reach = throughRock ? 1 : this.visibility(center, target);
        const value = Math.round(rim * reach * 255);
        if (value <= world.discovered[index]) continue;
        world.discovered[index] = value;
        this.dirty.from = Math.min(this.dirty.from, py);
        this.dirty.to = Math.max(this.dirty.to, py);
      }
  }

  // the same walk as lightVisibility in shaders/occlusion.wgsl: the tiles on the line from the
  // light to the point (Amanatides-Woo), fading linearly over DISCOVERY.ball.intoRock tiles of rock
  private visibility(from: Position2D, to: Position2D) {
    const tile = this.world.meta.tileInPixels;
    const depth = DISCOVERY.ball.intoRock * tile;
    const startX = from.x / tile;
    const startY = from.y / tile;
    const deltaX = to.x / tile - startX;
    const deltaY = to.y / tile - startY;
    const endX = Math.floor(to.x / tile);
    const endY = Math.floor(to.y / tile);
    const total = Math.hypot(to.x - from.x, to.y - from.y);
    const stepX = Math.sign(deltaX);
    const stepY = Math.sign(deltaY);
    const perTileX = 1 / Math.max(Math.abs(deltaX), 1e-6);
    const perTileY = 1 / Math.max(Math.abs(deltaY), 1e-6);
    let nextX =
      (deltaX < 0
        ? startX - Math.floor(startX)
        : 1 - (startX - Math.floor(startX))) * perTileX;
    let nextY =
      (deltaY < 0
        ? startY - Math.floor(startY)
        : 1 - (startY - Math.floor(startY))) * perTileY;
    let cellX = Math.floor(startX);
    let cellY = Math.floor(startY);
    let t = 0;
    let rock = 0;
    for (;;) {
      const last = cellX === endX && cellY === endY;
      const exit = last ? 1 : Math.min(nextX, nextY, 1);
      if (blocksSight(this.world.getType(cellX, cellY))) {
        rock += (exit - t) * total;
        if (rock >= depth) return 0;
      }
      if (last || exit >= 1) break;
      t = exit;
      if (nextX < nextY) {
        cellX += stepX;
        nextX += perTileX;
      } else {
        cellY += stepY;
        nextY += perTileY;
      }
    }
    return 1 - rock / depth;
  }
}
