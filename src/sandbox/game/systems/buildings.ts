import PragmaSystem from "@pragma/system";
import Grid from "@axiom/grid";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { assert } from "@axiom/utils";
import { BlocksID } from "../content/blocks";
import { BUILDINGS, BuildingsID, STRUCTURES } from "../content/structures";
import Building from "../actors/building";
import Tavern from "../components/tavern";
import Market from "../components/market";
import Smelter from "../components/smelter";
import Headquarters, { shaftLimitAt } from "../components/headquarters";
import BuildingLook from "../components/buildingLook";
import Storage from "../components/storage";
import { shaftColumns } from "../world/shaftShape";
import { buildingSprite } from "../world/buildingShape";
import { SURFACE } from "../content/surface";
import GameGlobals from "../gpu/gameGlobals";
import Terrain from "./terrain";
import MapView from "./mapView";
import Rails from "./rails";
import Transport from "./transport";

export type ShaftSide = "left" | "right";

export interface BuildingPlace {
  side: ShaftSide;
  base: Box;
  reserve: Box;
}

export type BuildingProblem = "built" | "outsideMap" | "tooDeep" | "noShaft" | "taken" | "notDug";

export const BUILDING_PROBLEMS: Record<BuildingProblem, string> = {
  built: "It's built already",
  outsideMap: "It doesn't fit in the map",
  tooDeep: `Buildings stand only down to ${STRUCTURES.buildings.maxDepth} tiles`,
  noShaft: "It goes only by the shaft, not under it",
  taken: "Something else keeps this room",
  notDug: "Dig its room out first",
};

export interface BuildingRefusal {
  problem: BuildingProblem;
  tiles: Position2D[];
}

interface Built {
  place: BuildingPlace;
  actor: Building;
}

export default class Buildings extends PragmaSystem {
  private readonly built = new Map<BuildingsID, Built>();
  // pressed on this building: released on it too, it was a click
  private pressed: Building | undefined;
  // while set, the other buildings don't take clicks (the intro points at one, or at none)
  public clickOnly: BuildingsID | "none" | undefined;
  declare private terrain: Terrain;
  declare private mapView: MapView;
  declare private rails: Rails;
  declare private transport: Transport;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.mapView = this.scene.getSystem(MapView);
    this.rails = this.scene.getSystem(Rails);
    this.transport = this.scene.getSystem(Transport);
    this.build(BuildingsID.headquarters, this.surfacePlace(BuildingsID.headquarters, "right"), false);
  }

  update(): void {
    if (InputManager.onActionPressed("select")) this.pressed = this.underMouse();
    if (!InputManager.onActionReleased("select")) return;
    const target = this.underMouse();
    if (target && target === this.pressed) this.openWindow(target);
    this.pressed = undefined;
  }

  public placeOf(id: BuildingsID) {
    return this.built.get(id)?.place;
  }

  public actorOf(id: BuildingsID) {
    return this.built.get(id)?.actor;
  }

  public highlight(id: BuildingsID, on: boolean) {
    const built = this.built.get(id);
    assert(built !== undefined, `No ${BUILDINGS[id].name} is built to highlight`);
    const look = built.actor.getComponent(BuildingLook);
    assert(look !== undefined, `The ${BUILDINGS[id].name} has no BuildingLook`);
    look.highlighted = on;
    this.mapView.spotlight(on ? look.box : undefined);
  }

  public get builtIds() {
    return [...this.built.keys()];
  }

  public setMineLevel(level: number) {
    this.headquarters().level = level;
  }

  // nothing can be built before the headquarters stands
  public get mineLevel() {
    return this.isStanding(BuildingsID.headquarters) ? this.headquarters().level : 0;
  }

  // the headquarters is there from the start, hidden until the intro raises it: it's the camp's store
  public isStanding(id: BuildingsID) {
    return this.built.get(id)?.actor.getVisibility() ?? false;
  }

  public get store() {
    const built = this.built.get(BuildingsID.headquarters);
    assert(built !== undefined, "No headquarters to keep the store");
    const storage = built.actor.getComponent(Storage);
    assert(storage !== undefined, "The headquarters has no Storage");
    return storage.stock;
  }

  public show(id: BuildingsID, shown: boolean) {
    const built = this.built.get(id);
    assert(built !== undefined, `No ${BUILDINGS[id].name} is built to show`);
    built.actor.setVisibility(shown);
    this.transport.setDoor(id, shown ? built.place : undefined);
    this.maskMist();
  }

  // the deepest row the shaft may be dug to
  public get shaftLimit() {
    return shaftLimitAt(this.mineLevel);
  }

  private headquarters() {
    const built = this.built.get(BuildingsID.headquarters);
    assert(built !== undefined, "No headquarters is built");
    const headquarters = built.actor.getComponent(Headquarters);
    assert(headquarters !== undefined, "The headquarters has no Headquarters");
    return headquarters;
  }

  public get places(): BuildingPlace[] {
    return [...this.built.values()].map((built) => built.place);
  }

  private underMouse() {
    const tile = this.terrain.worldToTile(Camera.screenToWorld(InputManager.getMousePos()));
    for (const [id, built] of this.built) {
      if (this.clickOnly !== undefined && id !== this.clickOnly) continue;
      if (!built.actor.getVisibility()) continue;
      if (Grid.isTileInBox(built.place.base, tile)) return built.actor;
    }
    return undefined;
  }

  private openWindow(building: Building) {
    switch (building.id) {
      case BuildingsID.tavern: {
        const tavern = building.getComponent(Tavern);
        assert(tavern !== undefined, "The tavern has no Tavern");
        tavern.open();
        break;
      }
      case BuildingsID.market: {
        const market = building.getComponent(Market);
        assert(market !== undefined, "The market has no Market");
        market.open();
        break;
      }
      case BuildingsID.smelter: {
        const smelter = building.getComponent(Smelter);
        assert(smelter !== undefined, "The smelter has no Smelter");
        smelter.open();
        break;
      }
      case BuildingsID.headquarters:
        this.headquarters().open();
        break;
    }
  }

  public placeAt(id: BuildingsID, tile: Position2D): BuildingPlace {
    const data = BUILDINGS[id];
    const columns = shaftColumns(this.terrain.world);
    const side: ShaftSide = tile.x < (columns.from + columns.to + 1) / 2 ? "left" : "right";
    const width = data.size.width;
    const top = tile.y - Math.floor(data.size.height / 2);
    const baseX = side === "left" ? columns.from - width : columns.to + 1;
    const reserve = data.reserve;
    return {
      side: side,
      base: { x: baseX, y: top, w: width, h: data.size.height },
      reserve: {
        x: side === "left" ? baseX - reserve.away : baseX,
        y: top - reserve.up,
        w: width + reserve.away,
        h: data.size.height + reserve.up + reserve.down,
      },
    };
  }

  public buildMarket() {
    this.build(BuildingsID.market, this.surfacePlace(BuildingsID.market, "left"));
  }

  private surfacePlace(id: BuildingsID, side: ShaftSide): BuildingPlace {
    const size = BUILDINGS[id].size;
    const columns = shaftColumns(this.terrain.world);
    const x = side === "left" ? columns.from - size.width : columns.to + 1;
    const base = { x: x, y: -size.height, w: size.width, h: size.height };
    return { side: side, base: base, reserve: { ...base } };
  }

  public problem(id: BuildingsID, place: BuildingPlace, kept: Box[]): BuildingRefusal | undefined {
    if (this.built.has(id)) return { problem: "built", tiles: [] };
    const world = this.terrain.world;
    const reserve = place.reserve;
    const fits = reserve.x >= 0 && reserve.y >= 0 && reserve.x + reserve.w <= world.mapInTiles.width && reserve.y + reserve.h <= world.mapInTiles.height;
    if (!fits) return { problem: "outsideMap", tiles: [] };
    if (reserve.y + reserve.h > STRUCTURES.buildings.maxDepth) return { problem: "tooDeep", tiles: [] };
    if (place.base.y + place.base.h - 1 > world.shaftDepth) return { problem: "noShaft", tiles: [] };
    const joints = this.rails.joints.map((joint) => ({ x: joint.tile.x, y: joint.tile.y, w: 1, h: 1 }));
    const others = [...this.places.map((other) => other.reserve), ...kept, ...joints];
    const taken = Grid.tilesIn(reserve).filter((tile) => others.some((other) => Grid.isTileInBox(other, tile)));
    if (taken.length > 0) return { problem: "taken", tiles: taken };
    const rock = Grid.tilesIn(place.base).filter((tile) => world.getType(tile.x, tile.y) !== BlocksID.air);
    if (rock.length > 0) return { problem: "notDug", tiles: rock };
    return undefined;
  }

  public build(id: BuildingsID, place: BuildingPlace, shown = true) {
    const inMine = place.base.y >= 0;
    if (inMine) for (const tile of Grid.tilesIn(place.base)) this.terrain.place(tile.x, tile.y, BlocksID.building);
    const tile = this.terrain.tile;
    const base = place.base;
    const ground = inMine ? 0 : SURFACE.ground;
    const middle = { x: (base.x + base.w / 2) * tile, y: (base.y + base.h / 2) * tile - ground };
    const building = new Building({ id: id, place: place, position: middle });
    building.setVisibility(shown);
    this.built.set(id, { place: place, actor: building });
    this.maskMist();
    if (shown) this.transport.setDoor(id, place);
    this.scene.spawnActor(building);
  }

  // its room stays dug out; the headquarters only hides, it keeps the store
  public remove(id: BuildingsID) {
    if (id === BuildingsID.headquarters) {
      this.show(id, false);
      return;
    }
    const built = this.built.get(id);
    assert(built !== undefined, `No ${BUILDINGS[id].name} is built`);
    if (built.place.base.y >= 0)
      for (const tile of Grid.tilesIn(built.place.base)) this.terrain.place(tile.x, tile.y, BlocksID.air);
    this.built.delete(id);
    if (this.pressed === built.actor) this.pressed = undefined;
    this.maskMist();
    this.transport.setDoor(id, undefined);
    this.scene.deleteActor(built.actor);
  }

  private maskMist() {
    const tile = this.terrain.tile;
    const shown = [...this.built].filter(([, built]) => built.actor.getVisibility());
    GameGlobals.setBuildings(shown.map(([id, built]) => buildingSprite(id, built.place, tile)));
  }
}
