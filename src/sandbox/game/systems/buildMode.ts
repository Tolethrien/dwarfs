import PragmaSystem from "@pragma/system";
import Grid from "@axiom/grid";
import InputManager from "@engine/inputManager";
import Time, { type TimeWarp } from "@engine/time";
import { Camera } from "@engine/camera/camera";
import { Draw } from "@aurora/urp/draw/draw";
import Navi from "@navi/navi";
import { assert } from "@axiom/utils";
import AxiomMath from "@axiom/math";
import Easing from "@axiom/easing";
import {
  BUILD_ELEMENTS,
  BuildCategoryID,
  BuildElementID,
  categoriesOf,
  type BuildLayer,
} from "../content/structures";
import { formatAmount, RESOURCES, type ResourceCost, type ResourcesID } from "../content/resources";
import { SORT_ORDER } from "../content/render";
import { UI_THEME } from "../content/ui";
import { closeAllWindows, type UIWindow } from "../ui/elements/window";
import { confirm } from "../ui/elements/confirm";
import { text } from "../ui/elements/text";
import { cost, costEntries } from "../ui/elements/cost";
import { popAt } from "../ui/elements/pop";
import BuildMenu from "../ui/build/menu";
import { stationFootprint } from "../world/stationShape";
import { drawRail, railEnd, railToward, type RailSegment } from "../world/railShape";
import type Shaft from "../actors/shaft";
import ShaftDigging from "../components/shaftDigging";
import Buildings, { BUILDING_PROBLEMS } from "./buildings";
import GameEvents from "./gameEvents";
import GameMode from "./gameMode";
import MapView from "./mapView";
import Resources from "./resources";
import Stations, { REMOVE_PROBLEMS, STATION_PROBLEMS } from "./stations";
import type Station from "../actors/station";
import Rails, { JOINT_PROBLEMS, RAIL_PROBLEMS } from "./rails";
import Terrain from "./terrain";

const BUILD = {
  slowdown: 0.25,
  blend: 0.3,
  outline: {
    free: { fill: [120, 230, 140, 50] as RGBA, border: [150, 255, 170, 220] as RGBA },
    refused: { fill: [240, 90, 70, 50] as RGBA, border: [255, 110, 90, 220] as RGBA },
    inTheWay: [255, 60, 40, 150] as RGBA,
    width: 0.12,
  },
  reserve: {
    free: { fill: [120, 230, 140, 18] as RGBA, border: [150, 255, 170, 110] as RGBA },
    refused: { fill: [240, 90, 70, 18] as RGBA, border: [255, 110, 90, 110] as RGBA },
    built: { fill: [200, 200, 220, 18] as RGBA, border: [200, 200, 220, 90] as RGBA },
    width: 0.06,
  },
  focus: { share: 0.8, seconds: 0.6 },
  rail: { reach: 1.5, text: { size: 0.45, gap: 0.4 } },
};

interface OutlineLook {
  fill: RGBA;
  border: RGBA;
}

interface Refusal {
  reason: string;
  tiles: Position2D[];
}

interface Ghost {
  base: Box;
  reserve: Box | undefined;
  refusal: () => Refusal | undefined;
  build: () => void;
}

interface RailDrag {
  from: Position2D;
  segment: RailSegment | undefined;
  refusal: Refusal | undefined;
}

export default class BuildMode extends PragmaSystem {
  public layer: BuildLayer = "main";
  public category: BuildCategoryID | undefined = categoriesOf("main")[0];
  public selected: BuildElementID | undefined;
  public removing = false;
  public readonly free = new Set<BuildElementID>();
  private painted: Position2D[] | undefined;
  private warp: TimeWarp | undefined;
  private outline: Box | undefined;
  private ghost: Ghost | undefined;
  private refusal: Refusal | undefined;
  private drag: RailDrag | undefined;
  private dialog: UIWindow | undefined;
  declare private menu: BuildMenu;
  declare private mapView: MapView;
  declare private terrain: Terrain;
  declare private resources: Resources;
  declare private buildings: Buildings;
  declare private stations: Stations;
  declare private rails: Rails;
  declare private gameMode: GameMode;

  constructor(
    internal: InternalPSProps,
    private readonly shaft: Shaft,
  ) {
    super(internal);
  }

  awake(): void {
    this.mapView = this.scene.getSystem(MapView);
    this.terrain = this.scene.getSystem(Terrain);
    this.resources = this.scene.getSystem(Resources);
    this.buildings = this.scene.getSystem(Buildings);
    this.stations = this.scene.getSystem(Stations);
    this.rails = this.scene.getSystem(Rails);
    this.gameMode = this.scene.getSystem(GameMode);
    this.menu = new BuildMenu(this, this.resources);
    this.scene.getSystem(GameEvents).resources.changed.connect(() => {
      if (this.on) this.menu.showSelected();
    });
  }

  update(): void {
    if (this.on) {
      this.menu.update();
      this.dialog?.update();
      this.aimGhost();
      if (InputManager.onActionPressed("place") && !this.asking) this.tryPlace();
      this.dragRail();
      this.paint();
    }
    if (InputManager.onActionPressed("cancelBuild") && !this.asking) {
      if (this.removing) this.toggleRemoving();
      else if (this.selected !== undefined) this.pick(undefined);
      else this.leave();
    } else if (InputManager.onActionPressed("toggleBuild")) {
      if (this.on) this.leave();
      else this.enter();
    }
  }

  render(): void {
    if (!this.on) return;
    for (const place of this.buildings.places) this.drawBox(place.reserve, BUILD.reserve.built, BUILD.reserve.width);
    if (this.outline) this.drawBox(this.outline, BUILD.outline.free, BUILD.outline.width);
    this.drawDrag();
    this.drawRemoving();
    const ghost = this.ghost;
    if (!ghost || Navi.getHovered !== undefined) return;
    const refused = this.refusal !== undefined;
    if (ghost.reserve)
      this.drawBox(ghost.reserve, refused ? BUILD.reserve.refused : BUILD.reserve.free, BUILD.reserve.width);
    this.drawBox(ghost.base, refused ? BUILD.outline.refused : BUILD.outline.free, BUILD.outline.width);
    this.drawInTheWay(this.refusal?.tiles ?? []);
  }

  private drawInTheWay(tiles: Position2D[]) {
    const tile = this.terrain.tile;
    for (const inTheWay of tiles)
      Draw.rect({
        position: { x: inTheWay.x * tile, y: inTheWay.y * tile, z: SORT_ORDER.effects },
        size: { width: tile, height: tile },
        color: BUILD.outline.inTheWay,
      });
  }

  private drawDrag() {
    const segment = this.drag?.segment;
    if (!this.drag || !segment) return;
    const refusal = this.drag.refusal;
    const cost = this.railCost(segment);
    const short = refusal !== undefined || this.resources.missing(cost).length > 0;
    const tile = this.terrain.tile;
    const end = railEnd(segment);
    drawRail(segment.from, end, tile, refusal ? BUILD.outline.refused.border : BUILD.outline.free.border);
    this.drawInTheWay(refusal?.tiles ?? []);
    const text = BUILD.rail.text;
    const price = Object.entries(cost).map(([id, amount]) => {
      const resource = Number(id) as ResourcesID;
      return `${formatAmount(resource, amount)} ${RESOURCES[resource].name}`;
    });
    Draw.text({
      position: { x: end.x * tile, y: (end.y - text.gap - text.size) * tile, z: SORT_ORDER.effects },
      text: `${segment.length} tiles · ${price.join(", ")}`,
      size: text.size * tile,
      color: short ? BUILD.outline.refused.border : BUILD.outline.free.border,
    });
  }

  public pickLayer(layer: BuildLayer) {
    this.layer = layer;
    this.pickCategory(categoriesOf(layer)[0]);
  }

  public pickCategory(category: BuildCategoryID | undefined) {
    if (category !== this.category) this.pick(undefined);
    this.category = category;
  }

  public toggleRemoving() {
    const removing = !this.removing;
    this.pick(undefined);
    this.removing = removing;
    this.menu.showSelected();
  }

  public pick(element: BuildElementID | undefined) {
    if (element !== undefined) this.removing = false;
    this.painted = undefined;
    this.selected = element;
    this.outline = undefined;
    this.ghost = undefined;
    this.refusal = undefined;
    this.drag = undefined;
    this.menu.showSelected();
    if (element === undefined || BUILD_ELEMENTS[element].segment === undefined) return;
    const segment = this.segmentOf(element);
    if (!this.digging.fits(segment)) {
      popAt(InputManager.getMousePos(), "The shaft can't go that deep", UI_THEME.colors.lacking);
      this.selected = undefined;
      this.menu.showSelected();
      return;
    }
    this.outline = this.digging.outline(segment);
    this.focus(this.outline);
  }

  private aimGhost() {
    const element = this.selected;
    if (element === undefined) return;
    this.ghost = this.ghostOf(element);
    this.refusal = this.ghost?.refusal();
  }

  private ghostOf(element: BuildElementID): Ghost | undefined {
    const data = BUILD_ELEMENTS[element];
    const building = data.building;
    if (building !== undefined) {
      const place = this.buildings.placeAt(building, this.mouseTile());
      return {
        base: place.base,
        reserve: place.reserve,
        refusal: () => {
          const refusal = this.buildings.problem(building, place);
          return refusal && { reason: BUILDING_PROBLEMS[refusal.problem], tiles: refusal.tiles };
        },
        build: () => this.buildings.build(building, place),
      };
    }
    if (data.joint) {
      const joint = this.rails.jointAt(this.mouseTile());
      return {
        base: { x: joint.tile.x, y: joint.tile.y, w: 1, h: 1 },
        reserve: undefined,
        refusal: () => {
          const kept = [...this.buildings.places.map((place) => place.reserve), ...this.stations.footprints];
          const refusal = this.rails.jointProblem(joint, kept);
          return refusal && { reason: JOINT_PROBLEMS[refusal.problem], tiles: refusal.tiles };
        },
        build: () => this.rails.buildJoint(joint),
      };
    }
    if (!data.station) return undefined;
    const body = this.stations.placeAt(this.mouseTile());
    return {
      base: stationFootprint(body),
      reserve: undefined,
      refusal: () => {
        const kept = this.buildings.places.map((place) => place.reserve);
        const refusal = this.stations.problem(body, kept);
        return refusal && { reason: STATION_PROBLEMS[refusal.problem], tiles: refusal.tiles };
      },
      build: () => this.stations.build(body),
    };
  }

  private tryPlace() {
    if (this.removing) {
      if (Navi.getHovered === undefined) this.startRemoving();
      return;
    }
    const element = this.selected;
    if (Navi.getHovered !== undefined || element === undefined) return;
    const data = BUILD_ELEMENTS[element];
    if (data.rail) {
      this.startRail();
      return;
    }
    const box = this.outline ?? this.ghost?.base;
    if (!box || !Grid.isTileInBox(box, this.mouseTile())) return;
    if (this.refusal) {
      popAt(InputManager.getMousePos(), this.refusal.reason, UI_THEME.colors.lacking);
      return;
    }
    if (this.saysMissing(this.costOf(element))) return;
    // the ghost stays where it was asked for, the mouse moves on while the question is open
    const ghost = this.ghost;
    this.dialog = confirm(undefined, `Build ${data.title}?`, () => this.build(element, ghost), {
      details: (content) => cost(content, costEntries(this.costOf(element), [])),
    });
  }

  // paid at the yes: the resources and the room may have gone while the question was open
  private startRemoving() {
    const station = this.stations.underMouse();
    if (!station) {
      this.painted = [];
      return;
    }
    if (this.saysWhyNot(station)) return;
    const ordered = this.stations.orderedTo(station).length;
    this.dialog = confirm(undefined, `Remove ${station.name}?`, () => this.removeStation(station), {
      details: (content) => {
        if (ordered > 0) text(content, `${ordered} ordered dwarfs go back to the tavern`, { color: UI_THEME.colors.lacking });
        text(content, "Nothing comes back", { color: UI_THEME.colors.muted });
      },
    });
  }

  private saysWhyNot(station: Station) {
    const problem = this.stations.removeProblem(station);
    if (problem) popAt(InputManager.getMousePos(), REMOVE_PROBLEMS[problem], UI_THEME.colors.lacking);
    return problem !== undefined;
  }

  // asked again at the yes: someone may have been shot meanwhile
  private removeStation(station: Station) {
    if (!this.saysWhyNot(station)) this.stations.remove(station);
  }

  private paint() {
    const painted = this.painted;
    if (!painted) return;
    if (InputManager.onActionReleased("place")) {
      this.painted = undefined;
      this.rails.remove(painted);
      return;
    }
    const tile = this.mouseTile();
    if (!painted.some((other) => other.x === tile.x && other.y === tile.y)) painted.push(tile);
  }

  private drawRemoving() {
    if (!this.removing) return;
    if (this.painted) {
      this.drawInTheWay(this.painted);
      return;
    }
    const station = Navi.getHovered === undefined ? this.stations.underMouse() : undefined;
    if (!station) return;
    const box = stationFootprint(this.stations.launcherOf(station).tiles);
    this.drawBox(box, BUILD.outline.refused, BUILD.outline.width);
  }

  public costOf(element: BuildElementID): ResourceCost {
    return this.free.has(element) ? {} : BUILD_ELEMENTS[element].cost;
  }

  private saysMissing(cost: ResourceCost) {
    const missing = this.resources.missing(cost);
    if (missing.length === 0) return false;
    const list = missing.map(([id, amount]) => `${formatAmount(id, amount)} ${RESOURCES[id].name}`);
    popAt(InputManager.getMousePos(), `Missing: ${list.join(", ")}`, UI_THEME.colors.lacking);
    return true;
  }

  private startRail() {
    const from = this.rails.nearestAnchor(this.mouseSpot(), this.stations.railAnchors, BUILD.rail.reach);
    if (!from) {
      popAt(InputManager.getMousePos(), RAIL_PROBLEMS.notAnchored, UI_THEME.colors.lacking);
      return;
    }
    this.drag = { from: from, segment: undefined, refusal: undefined };
  }

  private dragRail() {
    const drag = this.drag;
    if (!drag) return;
    if (InputManager.onActionReleased("place")) {
      this.drag = undefined;
      this.layRail(drag);
      return;
    }
    drag.segment = railToward(drag.from, this.mouseSpot());
    const refusal = drag.segment && this.rails.problem(drag.segment, this.stations.railAnchors);
    drag.refusal = refusal && { reason: RAIL_PROBLEMS[refusal.problem], tiles: refusal.tiles };
  }

  private layRail(drag: RailDrag) {
    const segment = drag.segment;
    if (!segment) return;
    if (drag.refusal) {
      popAt(InputManager.getMousePos(), drag.refusal.reason, UI_THEME.colors.lacking);
      return;
    }
    const cost = this.railCost(segment);
    if (this.saysMissing(cost)) return;
    this.resources.pay(cost);
    this.rails.build(segment);
  }

  private railCost(segment: RailSegment) {
    const cost: ResourceCost = {};
    for (const [id, amount] of Object.entries(BUILD_ELEMENTS[BuildElementID.rail].cost))
      cost[Number(id) as ResourcesID] = amount * segment.length;
    return cost;
  }

  private build(element: BuildElementID, ghost: Ghost | undefined) {
    const data = BUILD_ELEMENTS[element];
    const refusal = ghost?.refusal();
    if (refusal) {
      popAt(InputManager.getMousePos(), refusal.reason, UI_THEME.colors.lacking);
      return;
    }
    if (!this.resources.pay(this.costOf(element))) {
      popAt(InputManager.getMousePos(), "Not enough resources any more", UI_THEME.colors.lacking);
      return;
    }
    if (ghost) ghost.build();
    else this.digging.deepen(this.segmentOf(element));
    this.pick(undefined);
  }

  private mouseSpot() {
    const world = Camera.screenToWorld(InputManager.getMousePos());
    return { x: world.x / this.terrain.tile, y: world.y / this.terrain.tile };
  }

  private mouseTile() {
    return this.terrain.world.worldToTile(Camera.screenToWorld(InputManager.getMousePos()));
  }

  private drawBox(box: Box, look: OutlineLook, border: number) {
    const tile = this.terrain.tile;
    Draw.rect({
      position: { x: box.x * tile, y: box.y * tile, z: SORT_ORDER.effects },
      size: { width: box.w * tile, height: box.h * tile },
      color: look.fill,
      outline: { width: border * tile, color: look.border },
    });
  }

  private focus(outline: Box) {
    const tile = this.terrain.tile;
    const width = outline.w * tile;
    const height = outline.h * tile;
    const view = Camera.getViewBounds;
    const zoom = Camera.getZoom;
    const screen = { width: (view.max.x - view.min.x) * zoom, height: (view.max.y - view.min.y) * zoom };
    const fit = Math.min(screen.width / width, screen.height / height) * BUILD.focus.share;
    Camera.setZoom(Math.min(Camera.getZoomTarget, fit));
    const from = { x: Camera.getPosition.x, y: Camera.getPosition.y };
    const to = { x: outline.x * tile + width / 2, y: outline.y * tile + height / 2 };
    // on real time: the bullet time doesn't slow it; a new focus takes the key over
    this.startCoroutine(
      function* glide() {
        let elapsed = 0;
        while (elapsed < BUILD.focus.seconds) {
          elapsed += Time.getRawDeltaTime();
          const progress = Easing.easeOutCubic(Math.min(elapsed / BUILD.focus.seconds, 1));
          Camera.setPosition(AxiomMath.lerpPos2D(from, to, progress));
          yield;
        }
      },
      { key: "glide", time: "real" },
    );
  }

  private segmentOf(element: BuildElementID) {
    const segment = BUILD_ELEMENTS[element].segment;
    assert(segment !== undefined, `Build element ${BuildElementID[element]} is no shaft segment`);
    return segment;
  }

  private get digging() {
    const digging = this.shaft.getComponent(ShaftDigging);
    assert(digging !== undefined, "The shaft has no ShaftDigging");
    return digging;
  }

  private get on() {
    return this.gameMode.is("build");
  }

  private get asking() {
    return this.dialog?.isOpen === true;
  }

  private enter() {
    closeAllWindows();
    this.gameMode.set("build");
    this.warp = Time.warp(BUILD.slowdown, { blend: BUILD.blend });
    this.mapView.showBlueprint();
    this.pick(undefined);
    this.menu.show();
  }

  public leave() {
    this.gameMode.set("game");
    this.warp?.release();
    this.warp = undefined;
    this.mapView.hideBlueprint();
    this.dialog?.close();
    this.dialog = undefined;
    this.selected = undefined;
    this.outline = undefined;
    this.ghost = undefined;
    this.refusal = undefined;
    this.drag = undefined;
    this.removing = false;
    this.painted = undefined;
    this.stopCoroutine("glide");
    this.menu.hide();
  }
}
