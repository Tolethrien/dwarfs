import { Draw } from "@aurora/urp/draw/draw";
import AxiomMath from "@axiom/math";
import Vec2 from "@axiom/vec2";
import { COLOR } from "@axiom/color";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import type Coroutine from "@engine/coroutines/coroutine";
import type { CoroutineWait } from "@engine/coroutines/coroutine";
import PragmaSystem from "@pragma/system";
import Dwarf, { DWARF_BODY } from "@sandbox/bActors/dwarf";
import { GameResourcesID } from "@sandbox/content/resources";
import { ACTION } from "@sandbox/inputActions";
import type { DwarfsID } from "@sandbox/content/dwarfs";
import { RENDER_ORDER } from "@sandbox/configs";
import type { GameModeChangedEvent } from "./gameMode";
import type { BallBouncedEvent } from "./physBall";
import type { DwarfExhaustedEvent } from "@sandbox/components/stats";
import CameraController from "./cameraController";
import PhysBall from "./physBall";
import PlayerResources from "./resources";
import Research from "./research";
import Camp, { type LaunchSite } from "./camp";
import Terrain from "./terrain";
import Grid from "@axiom/grid";
import { BlocksID } from "@sandbox/content/blocks";

export interface DwarfLaunchedEvent {
  dwarf: Dwarf;
}

// ballista: shoots sideways, up to cone above or below horizontal, to both sides
const LAUNCHER = {
  cone: AxiomMath.degToRad(45),
  speed: { min: 500, max: 3500 },
  // screen pixels: the drag for full power, and below deadzone a release shoots nothing
  drag: { full: 300, deadzone: 12 },
  // world units the dwarf sinks back at full power
  pullBack: 110,
};
// what each research level adds (Research NODES)
const UPGRADES = { pickaxe: 0.15, draw: 500, scope: 0.5, lift: 1.5, ghost: 1.5 };
// the aim line: dots up to the first hit, never further than length; screen pixels, divided by the
// zoom when drawn
const AIM_LINE = {
  length: 1200,
  dot: 4,
  gap: 22,
  end: 9,
  alpha: { near: 230, far: 60 },
  color: COLOR.IVORY,
};
// the sling string, from two ends beside the launcher to the dwarf's back; world units
const SLING = {
  spread: 95,
  width: { slack: 6, taut: 3 },
  weak: COLOR.TAN,
  strong: COLOR.RED,
};
// homeSpeed: an exhausted dwarf going back to the nearest launch site, straight through the rock
// the search for the way home stops after this many tiles (the whole map is ~300k)
const HOME = { maxTiles: 400_000 };
const RIDE = {
  zoom: 0.5,
  walkSpeed: 350,
  liftSpeed: 700,
  homeSpeed: 700,
  cameraNear: 150,
  cameraWait: 2,
};

interface Leg {
  to: Position2D;
  speed: number;
}

// idle: the player's game; ride: the dwarf on its way, the scene has the camera; aim: in the
// launcher, waiting for the shot; follow: the camera rides with the shot
type Stage = "idle" | "ride" | "aim" | "follow";

// tavern → shaft → launcher → shot, one dwarf at a time; from the tavern click until the shot slows
// down the scene owns the camera. Where the shaft and tavern are comes from Camp
export default class Launcher extends PragmaSystem {
  private stage: Stage = "idle";
  private dwarf: Dwarf | null = null;
  // the beer it was bought for, given back when it goes home unshot
  private paid = 0;
  // where it rides to and shoots from
  private site: LaunchSite = { name: "", level: 0, point: { x: 0, y: 0 } };
  private running: Coroutine | null = null;
  // screen position where the drag started, null = not dragging
  private dragFrom: Position2D | null = null;
  private direction = Vec2.create(1, 0);
  private power = 0;
  private aimEnd: Position2D = { x: 0, y: 0 };
  // the shot hit something it did not go through: the camera lets go
  private bounced = false;
  declare private camera: CameraController;
  declare private physBall: PhysBall;
  declare private resources: PlayerResources;
  declare private research: Research;
  declare private camp: Camp;
  declare private terrain: Terrain;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  start(): void {
    this.camera = this.scene.getSystem(CameraController);
    this.physBall = this.scene.getSystem(PhysBall);
    this.resources = this.scene.getSystem(PlayerResources);
    this.research = this.scene.getSystem(Research);
    this.camp = this.scene.getSystem(Camp);
    this.terrain = this.scene.getSystem(Terrain);
    this.onSceneEvent<GameModeChangedEvent>("gameModeChanged", () => this.cancelAim());
    // only a bounce, a block the dwarf breaks through keeps the camera on it
    this.onSceneEvent<BallBouncedEvent>("ballBounced", (event) => {
      if (this.stage === "follow" && event.ball === this.dwarf?.ID) this.bounced = true;
    });
    this.onSceneEvent<DwarfExhaustedEvent>("dwarfExhausted", (event) => {
      if (event.actor instanceof Dwarf) this.walkHome(event.actor);
    });
  }

  public get isIdle() {
    return this.stage === "idle";
  }

  public cancelAim() {
    this.dragFrom = null;
  }

  private get launchPoint() {
    return this.site.point;
  }

  // down the shaft to the site's platform, then along the rails if it is a station
  private routeDown(site: LaunchSite): Leg[] {
    const platform = this.camp.launchPointAt(site.level);
    const legs: Leg[] = [
      { to: this.camp.shaftTop, speed: RIDE.walkSpeed },
      { to: platform, speed: this.liftSpeed },
    ];
    if (platform.x !== site.point.x) legs.push({ to: site.point, speed: this.camp.railSpeed });
    return legs;
  }

  // from the site the same way back: every leg reversed, ending at the door
  private routeHome(site: LaunchSite): Leg[] {
    const down = this.routeDown(site);
    const legs: Leg[] = [];
    for (let index = down.length - 1; index > 0; index--)
      legs.push({ to: down[index - 1].to, speed: down[index].speed });
    legs.push({ to: this.camp.door, speed: down[0].speed });
    return legs;
  }

  // out of beer: through the dug out tunnels to the nearest launch site, then home through the shaft,
  // gone in the tavern door. Not a scene, the camera stays the player's; any number at once
  private walkHome(dwarf: Dwarf) {
    dwarf.stop();
    const position = dwarf.transform.getPosition();
    const way = this.wayToSite(position);
    // shut in (nothing open leads to a site): the old way, straight through the rock
    const site = way?.site ?? this.nearestSite(position);
    const tunnel: Leg[] = (way?.corners ?? []).map((corner) => ({ to: corner, speed: RIDE.homeSpeed }));
    const legs = [...tunnel, { to: site.point, speed: RIDE.homeSpeed }, ...this.routeHome(site)];
    this.startCoroutine((co) => this.goHome(co, dwarf, legs), { phase: "fixedUpdate" });
  }

  // breadth-first over open tiles: the nearest site by the tunnels, and the turns of the way there
  private wayToSite(from: Position2D) {
    const world = this.terrain.world;
    const sites = new Map<number, LaunchSite>();
    for (const site of this.camp.launchSites()) {
      const tile = world.worldToTile(site.point);
      sites.set(world.tileIndex(tile.x, tile.y), site);
    }
    const path = Grid.findPath(
      world.mapInTiles,
      world.worldToTile(from),
      (x, y) => world.getType(x, y) === BlocksID.air,
      (x, y) => sites.has(world.tileIndex(x, y)),
      HOME.maxTiles,
    );
    if (!path) return null;
    const goal = path[path.length - 1];
    // only where the way turns: one leg per straight stretch
    const corners: Position2D[] = [];
    for (let index = 1; index < path.length - 1; index++) {
      const before = path[index - 1];
      const at = path[index];
      const after = path[index + 1];
      if (at.x - before.x !== after.x - at.x || at.y - before.y !== after.y - at.y)
        corners.push(world.tileCenterToWorld(at));
    }
    return { site: sites.get(world.tileIndex(goal.x, goal.y))!, corners };
  }

  private nearestSite(from: Position2D) {
    const distance = (site: LaunchSite) => Math.hypot(site.point.x - from.x, site.point.y - from.y);
    return this.camp.launchSites().reduce((best, site) => (distance(site) < distance(best) ? site : best));
  }

  private *goHome(_co: Coroutine, dwarf: Dwarf, legs: Leg[]) {
    for (const leg of legs) yield this.walk(dwarf, leg);
    dwarf.selfDestroy();
  }

  private get liftSpeed() {
    return RIDE.liftSpeed * UPGRADES.lift ** this.research.level("lift");
  }

  // paid beer is already taken from the stock; beer = what the dwarf carries
  public sendToWork(dwarfID: DwarfsID, paid: number, beer: number, site: LaunchSite) {
    if (this.stage !== "idle") return;
    this.site = site;
    const dwarf = new Dwarf({
      position: this.camp.door,
      dwarfID,
      beerLeft: beer,
      dmgMultiplier: 1 + UPGRADES.pickaxe * this.research.level("pickaxe"),
    });
    this.scene.spawnActor(dwarf);
    this.dwarf = dwarf;
    this.paid = paid;
    this.stage = "ride";
    Camera.setZoom(RIDE.zoom);
    this.camera.followScene(dwarf);
    const legs = this.routeDown(site);
    this.running = this.startCoroutine((co) => this.ride(co, dwarf, legs, true), {
      phase: "fixedUpdate",
    });
  }

  // aim: waiting in the launcher; leaves it the way it came, back into the tavern
  private sendBack(dwarf: Dwarf) {
    this.stage = "ride";
    this.cancelAim();
    const legs = this.routeHome(this.site);
    this.running = this.startCoroutine((co) => this.ride(co, dwarf, legs, false), {
      phase: "fixedUpdate",
    });
  }

  private *ride(co: Coroutine, dwarf: Dwarf, legs: Leg[], toWork: boolean) {
    // the camera bounds may keep it from getting close, so not forever
    yield co.race([
      co.waitUntil(() => this.cameraNear(dwarf)),
      co.waitSeconds(RIDE.cameraWait),
    ]);
    for (const leg of legs) yield this.walk(dwarf, leg);
    // a skipped ride lands at once, the camera with it
    if (co.isSkipping) Camera.snap();
    this.running = null;
    if (!toWork) {
      // back before the shot: what it was bought for goes back to the stock
      this.resources.addResource(GameResourcesID.beer, this.paid);
      dwarf.selfDestroy();
      this.endScene();
      return;
    }
    // from now on the shaft does not bounce it: it starts inside, the preview reads this too
    dwarf.body.passThrough = this.camp.shaft.physics;
    this.stage = "aim";
  }

  // a straight walk at a steady speed; skipped = there at once
  private walk(dwarf: Dwarf, leg: Leg): CoroutineWait {
    const transform = dwarf.transform;
    return {
      tick: (delta) => {
        const position = transform.getPosition();
        const dx = leg.to.x - position.x;
        const dy = leg.to.y - position.y;
        const distance = Math.hypot(dx, dy);
        const step = leg.speed * delta;
        if (distance <= step) {
          transform.setPosition(leg.to.x, leg.to.y);
          return true;
        }
        transform.translate((dx / distance) * step, (dy / distance) * step);
        return false;
      },
      skip: () => transform.teleport(leg.to.x, leg.to.y),
      describe: () => "dwarf walking",
    };
  }

  private cameraNear(dwarf: Dwarf) {
    const center = Camera.getCenter;
    const position = dwarf.transform.getPosition();
    return Math.hypot(center.x - position.x, center.y - position.y) <= RIDE.cameraNear;
  }

  // the camera rides with the shot up to its first bounce
  private *followShot(co: Coroutine, dwarf: Dwarf) {
    // or it ran dry before it bounced: it is walking home now
    yield co.waitUntil(() => this.bounced || !dwarf.launched || !dwarf.getAlive(), {
      skippable: true,
    });
    this.running = null;
    this.endScene();
  }

  private endScene() {
    this.stage = "idle";
    this.dwarf = null;
    this.camera.endScene();
  }

  preUpdate(): void {
    if (InputManager.onActionPressed(ACTION.skipScene)) this.running?.skip();
    if (this.stage !== "aim" || this.dwarf === null) return;
    if (InputManager.onActionPressed(ACTION.sendBack)) {
      const launchPoint = this.launchPoint;
      this.dwarf.transform.teleport(launchPoint.x, launchPoint.y);
      this.sendBack(this.dwarf);
      return;
    }
    this.updateAim(this.dwarf);
  }

  private updateAim(dwarf: Dwarf) {
    const mouse = InputManager.getMousePos();
    if (InputManager.onActionPressed(ACTION.shoot)) this.dragFrom = { x: mouse.x, y: mouse.y };
    if (this.dragFrom === null) return;

    // a sling: pulled back, it flies the other way
    const drag = Vec2.create(this.dragFrom.x - mouse.x, this.dragFrom.y - mouse.y);
    const dragLength = drag.length();
    if (dragLength > 0) this.clampToCone(drag.normalize(), this.direction);
    this.power = AxiomMath.clamp(dragLength / LAUNCHER.drag.full, 0, 1);
    const pull = this.power * LAUNCHER.pullBack;
    const launchPoint = this.launchPoint;
    dwarf.transform.teleport(
      launchPoint.x - this.direction.x * pull,
      launchPoint.y - this.direction.y * pull,
    );
    const reach = 1 + UPGRADES.scope * this.research.level("scope");
    this.physBall.predictHit(
      dwarf.body,
      launchPoint,
      this.direction,
      (AIM_LINE.length * reach) / Camera.getZoom,
      this.aimEnd,
    );

    if (!InputManager.onActionReleased(ACTION.shoot)) return;
    this.dragFrom = null;
    dwarf.transform.teleport(launchPoint.x, launchPoint.y);
    if (dragLength < LAUNCHER.drag.deadzone) return;
    this.shoot(dwarf);
  }

  private shoot(dwarf: Dwarf) {
    dwarf.launch(
      this.direction,
      AxiomMath.lerp(
        LAUNCHER.speed.min,
        LAUNCHER.speed.max + UPGRADES.draw * this.research.level("draw"),
        this.power,
      ),
    );
    dwarf.body.ghostTime = UPGRADES.ghost * this.research.level("ghost");
    this.emitSceneEvent<DwarfLaunchedEvent>("dwarfLaunched", { dwarf });
    this.bounced = false;
    this.stage = "follow";
    this.running = this.startCoroutine((co) => this.followShot(co, dwarf));
  }

  // to the side it points, then into horizontal ± cone
  private clampToCone(direction: Vec2, out: Vec2) {
    const side = direction.x < 0 ? -1 : 1;
    const angle = AxiomMath.clamp(
      Math.atan2(direction.y, direction.x * side),
      -LAUNCHER.cone,
      LAUNCHER.cone,
    );
    out.set(Math.cos(angle) * side, Math.sin(angle));
  }

  render(): void {
    if (this.stage !== "aim" || this.dwarf === null) return;
    this.drawSling(this.dwarf);
    if (this.dragFrom !== null) this.drawAimLine();
  }

  private drawSling(dwarf: Dwarf) {
    const direction = this.direction;
    const position = dwarf.transform.getRenderPosition();
    const back = {
      x: position.x - direction.x * DWARF_BODY.radius,
      y: position.y - direction.y * DWARF_BODY.radius,
    };
    const launchPoint = this.launchPoint;
    const color = AxiomMath.lerpRGBA(SLING.weak, SLING.strong, this.power);
    const width = AxiomMath.lerp(SLING.width.slack, SLING.width.taut, this.power);
    for (const side of [-1, 1]) {
      const end = {
        x: launchPoint.x - direction.y * SLING.spread * side,
        y: launchPoint.y + direction.x * SLING.spread * side,
      };
      // over the shaft, under the dwarf
      Draw.line({ from: end, to: back, z: RENDER_ORDER.solidTiles, width, cap: "round", color });
    }
  }

  private drawAimLine() {
    const zoom = Camera.getZoom;
    const from = this.launchPoint;
    const length = Math.hypot(this.aimEnd.x - from.x, this.aimEnd.y - from.y);
    const gap = AIM_LINE.gap / zoom;
    const color = AIM_LINE.color;
    // the first dots sit under the dwarf
    for (let distance = DWARF_BODY.radius + gap; distance < length; distance += gap) {
      const t = distance / length;
      Draw.circle({
        position: {
          x: from.x + this.direction.x * distance,
          y: from.y + this.direction.y * distance,
          z: RENDER_ORDER.overlay,
        },
        radius: AIM_LINE.dot / zoom,
        color: [color[0], color[1], color[2], AxiomMath.lerp(AIM_LINE.alpha.near, AIM_LINE.alpha.far, t)],
      });
    }
    Draw.circle({
      position: { x: this.aimEnd.x, y: this.aimEnd.y, z: RENDER_ORDER.overlay },
      radius: AIM_LINE.end / zoom,
      color: [color[0], color[1], color[2], AIM_LINE.alpha.near],
    });
  }
}
