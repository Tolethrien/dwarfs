import PragmaSystem from "@pragma/system";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import Tavern, { TAVERN } from "../../game/components/buildings/tavern";
import { BUILDINGS, BuildingsID } from "../../game/content/structures";
import { formatAmount, RESOURCE_IDS, RESOURCES } from "../../game/content/resources";
import { costText } from "../format";
import Buildings from "../../game/systems/mine/buildings";
import Terrain from "../../game/systems/world/terrain";
import { HEADQUARTERS } from "../../game/components/buildings/headquarters";
import { action, choice, control, idsOf, page, values } from "../pages";

const BUILDING = choice(idsOf<BuildingsID>(BUILDINGS), (id) => BUILDINGS[id].name);

function boxText(box: Box) {
  return `${box.x}, ${box.y} · ${box.w}×${box.h}`;
}

export default class CampDebug extends PragmaSystem {
  declare private buildings: Buildings;
  declare private terrain: Terrain;

  awake(): void {
    this.buildings = this.scene.getSystem(Buildings);
    this.terrain = this.scene.getSystem(Terrain);
    this.reports();
    page("camp", "buildings", "Buildings", "Raise the mine level and add or remove camp buildings without paying for them.", () => [
      values("Mine", "game.building", [
        {
          key: "mineLevel",
          label: "mine level",
          control: control.slider(1, HEADQUARTERS.levels.length, 1),
          get: () => this.buildings.mineLevel,
          set: (level) => this.buildings.setMineLevel(Number(level)),
        },
        { key: "built", control: control.info, get: () => this.buildings.builtIds.map((id) => BUILDINGS[id].name).join(", ") },
      ]),
      action("building", "remove", "Remove", [{ key: "building", control: BUILDING.control, value: BUILDING.names[0] }], (args) => {
        const id = BUILDING.id(args.building);
        if (this.buildings.builtIds.includes(id)) this.buildings.remove(id);
      }),
      action("building", "market", "Build the market", [], () => {
        if (!this.buildings.isStanding(BuildingsID.market)) this.buildings.buildMarket();
      }),
      action("building", "agh", "Build the AGH", [], () => {
        if (!this.buildings.isStanding(BuildingsID.agh)) this.buildings.buildAgh();
      }),
    ], true);
  }

  private reports() {
    debug.game.connect("resources", () =>
      RESOURCE_IDS.map((id) => ({ name: RESOURCES[id].name, amount: formatAmount(id, this.buildings.store.get(id)) })),
    );
    debug.game.connect("buildings", () => ({
      mineLevel: this.buildings.mineLevel,
      shaftDepth: this.terrain.world.shaftDepth,
      rows: this.buildings.builtIds.map((id) => {
        const place = this.buildings.placeOf(id);
        assert(place !== undefined, `${BUILDINGS[id].name} is built without a place`);
        return { name: BUILDINGS[id].name, side: place.side, base: boxText(place.base), reserve: boxText(place.reserve) };
      }),
    }));
    debug.game.connect("tavern", () => {
      const tavern = this.buildings.actorOf(BuildingsID.tavern)?.getComponent(Tavern);
      if (tavern === undefined) return undefined;
      return {
        applications: tavern.applications.length,
        limit: TAVERN.applications,
        perDay: TAVERN.perDay,
        arrivalHour: TAVERN.arrivalHour,
        hireCost: costText(TAVERN.hireCost),
      };
    });
  }
}
