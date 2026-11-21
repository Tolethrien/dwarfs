import PragmaSystem from "@pragma/system";
import Grid from "@axiom/grid";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import { assert } from "@axiom/utils";
import { BlocksID } from "../../content/blocks";
import { BUILDINGS, BuildingsID } from "../../content/structures";
import Building from "../../actors/building";
import BuildFootprint from "../../components/structures/buildFootprint";
import Headquarters, { shaftLimitAt } from "../../components/buildings/headquarters";
import BuildingLook from "../../components/buildings/buildingLook";
import { CAMP_BUILDINGS, CAMP_STORE } from "../../sceneData";
import { shaftColumns } from "../../world/shaftShape";
import { buildingSprite, type BuildingPlace, type ShaftSide } from "../../world/buildingShape";
import { SURFACE } from "../../content/surface";
import GameGlobals from "../../gpu/gameGlobals";
import Terrain from "../world/terrain";
import Transport from "./transport";
import Vfx from "../world/vfx";

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
  declare private transport: Transport;
  declare private vfx: Vfx;

  constructor(internal: InternalPSProps) {
    super(internal);
    this.scene.sharedData.add(CAMP_BUILDINGS, this);
  }

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.transport = this.scene.getSystem(Transport);
    this.vfx = this.scene.getSystem(Vfx);
    this.build(BuildingsID.headquarters, this.surfacePlace(BuildingsID.headquarters, "right"), false);
  }

  update(): void {
    if (InputManager.onActionPressed("select")) this.pressed = this.underMouse();
    if (!InputManager.onActionReleased("select")) return;
    const target = this.underMouse();
    if (target && target === this.pressed) target.events.emit("open", undefined);
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
    this.vfx.spotlight(on ? look.box : undefined);
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
    return this.scene.sharedData.require(CAMP_STORE);
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

  private underMouse() {
    const tile = this.terrain.worldToTile(Camera.screenToWorld(InputManager.getMousePos()));
    for (const [id, built] of this.built) {
      if (this.clickOnly !== undefined && id !== this.clickOnly) continue;
      if (!built.actor.getVisibility()) continue;
      if (Grid.isTileInBox(built.place.base, tile)) return built.actor;
    }
    return undefined;
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
    built.actor.getComponent(BuildFootprint)?.detach();
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
