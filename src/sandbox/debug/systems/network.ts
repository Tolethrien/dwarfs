import PragmaSystem from "@pragma/system";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import { STATION } from "../../game/actors/station";
import Haul from "../../game/components/mine/haul";
import { STRUCTURES } from "../../game/content/structures";
import { MAIN_TRAITS, type MainTraitsID } from "../../game/content/traits";
import Rails from "../../game/systems/mine/rails";
import Stations from "../../game/systems/mine/stations";
import Roster from "../../game/systems/dwarfs/roster";
import { railTiles } from "../../game/world/railShape";
import { action, choice, control, idsOf, page } from "../pages";

const CLASS = choice(idsOf<MainTraitsID>(MAIN_TRAITS), (id) => MAIN_TRAITS[id].name);

export default class NetworkDebug extends PragmaSystem {
  declare private rails: Rails;
  declare private stations: Stations;
  declare private roster: Roster;

  awake(): void {
    this.rails = this.scene.getSystem(Rails);
    this.stations = this.scene.getSystem(Stations);
    this.roster = this.scene.getSystem(Roster);
    this.reports();
    this.stationsPage();
    this.railsPage();
  }

  private reports() {
    debug.game.connect("rails", () => this.rails.stats);
    debug.game.connect("stations", () =>
      this.stations.stations.map((station) => {
        const launcher = this.stations.launcherOf(station);
        return {
          name: station.name,
          position: `${launcher.tiles.x}, ${launcher.tiles.y}`,
          atShaft: station.atShaft,
          connected: this.stations.isConnected(station),
          priority: station.priority,
          queue: launcher.queue.length,
          ordered: this.roster.assignedTo(station).length,
          manualLimit: STATION.manualLimit,
        };
      }),
    );
  }

  // the station select follows the stations built, so the page is live
  private stationsPage() {
    page(
      "network",
      "stations",
      "Stations",
      "Order dwarfs to a station as the stations menu would (with its checks), call them back, or send every station's haul to the camp now.",
      () => {
        const stations = choice(this.stations.stations, (station) => station.name);
        const station = { key: "station", control: stations.control, value: stations.names[0] };
        return [
          action("station", "order", "Order a dwarf", [
            { key: "class", control: CLASS.control, value: CLASS.names[0] },
            { key: "hours", control: control.number(1), value: STATION.shift.start },
            station,
          ], (args) =>
            this.stations.tryOrder(CLASS.id(args.class), Number(args.hours), undefined, stations.id(args.station)),
          ),
          action("station", "recall", "Recall", [
            station,
            { key: "working", label: "the working ones too", control: control.toggle, value: false },
          ], (args) => this.stations.recall(stations.id(args.station), args.working === true)),
          action("station", "send", "Send every station's haul up", [], () => {
            for (const each of this.stations.stations) {
              const haul = each.getComponent(Haul);
              assert(haul !== undefined, `${each.name} has no Haul`);
              haul.send();
            }
          }),
        ];
      },
      true,
    );
  }

  // single rails are damaged and repaired with a click (Tools → Mouse), laid in the build mode
  private railsPage() {
    const everyTile = () => this.rails.segments.flatMap((segment) => railTiles(segment));
    page("network", "rails", "Rails", "The whole rail network at once. Single rails: Tools → Mouse.", () => [
      action("rail", "repairAll", "Repair every rail", [], () => {
        for (const tile of everyTile()) this.rails.repair(tile);
      }),
      action("rail", "damageAll", "Damage every rail", [
        { key: "share", label: "share of durability", control: control.slider(0, 1, 0.05), value: 0.5 },
      ], (args) => {
        for (const tile of everyTile()) this.rails.damage(tile, STRUCTURES.rails.durability * Number(args.share));
      }),
    ]);
  }
}
