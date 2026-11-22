import PragmaSystem from "@pragma/system";
import InputManager from "@engine/inputManager";
import { Camera } from "@engine/camera/camera";
import Navi from "@navi/navi";
import Cello from "@cello/cello";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import type Dwarf from "../../actors/dwarf";
import { STATION } from "../../actors/station";
import Drinker from "../../components/dwarfs/drinker";
import Haul from "../../components/mine/haul";
import Effects from "../../components/dwarfs/effects";
import Equipment from "../../components/dwarfs/equipment";
import Shift from "../../components/dwarfs/shift";
import Traits from "../../components/dwarfs/traits";
import Tavern, { TAVERN } from "../../components/buildings/tavern";
import { HEADQUARTERS } from "../../components/buildings/headquarters";
import { SMELTER } from "../../components/buildings/smelter";
import type Effect from "../../effects/effect";
import { STAT_NAMES, STATS, type StatName } from "../../effects/effect";
import { BLOCKS, BlocksID, GLOW_STYLES } from "../../content/blocks";
import { LIGHT_FALLOFF, LIGHTS, LightsID, MUSHROOM_LIGHTS } from "../../content/lights";
import { BUFFS, type BuffID } from "../../content/buffs";
import { SPECIAL_BEERS, type SpecialBeerID } from "../../content/beers";
import { BASE_GEAR, BaseGearID, GEAR_SLOT_NAMES, GEAR_SLOTS, ITEMS, type GearSlot, type ItemID } from "../../content/gear";
import { DwarfRank } from "../../content/dwarfs";
import { formatAmount, RESOURCE_IDS, RESOURCES, ResourcesID } from "../../content/resources";
import { BUILDINGS, BuildingsID, STRUCTURES } from "../../content/structures";
import { StoryEventID } from "../../content/events/storyEvents";
import {
  FOREMAN_TRAIT,
  MAIN_TRAITS,
  TRAITS,
  WORKER_IDS,
  WORKER_TRAITS,
  type MainTraitsID,
  type TraitsID,
  type WorkerTraitID,
} from "../../content/traits";
import { MARKET_GOODS } from "../../content/market";
import { RECIPE_IDS, RECIPES, RecipeID } from "../../content/smelter";
import GameGlobals, { MAP_LOOK } from "../../gpu/gameGlobals";
import { toast } from "../../ui/elements/toast";
import Terrain from "../world/terrain";
import Rails from "../mine/rails";
import MapView from "../world/mapView";
import Decos from "../world/decos";
import Discovery from "../world/discovery";
import Buffs from "../dwarfs/buffs";
import Workforce from "../dwarfs/workforce";
import Roster, { type DwarfGroup } from "../dwarfs/roster";
import Stations from "../mine/stations";
import Buildings from "../mine/buildings";
import Calendar from "./calendar";
import PlayerStats from "./playerStats";
import StoryEvents from "./storyEvents";

const PROFILER = {
  railHits: 3,
  tuningStep: 0.1,
  panels: { group: "game", prefix: "game." },
  view: { name: "view", title: "View" },
  spawn: { none: "—", ranks: ["worker", "foreman"] },
  hint: "game.dwarf, game.morale, game.buff, game.workforce, game.time, game.res, game.station, game.rail, game.building, game.delivery, game.player, game.story",
};

// Object.keys gives enum numbers as strings
const IDS = {
  buffs: Object.keys(BUFFS).map(Number) as BuffID[],
  buildings: Object.keys(BUILDINGS).map(Number) as BuildingsID[],
  classes: Object.keys(MAIN_TRAITS).map(Number) as MainTraitsID[],
  traits: Object.keys(TRAITS).map(Number) as TraitsID[],
  items: Object.keys(ITEMS).map(Number) as ItemID[],
  gear: Object.keys(BASE_GEAR).map(Number) as BaseGearID[],
  blocks: Object.keys(BLOCKS).map(Number) as BlocksID[],
  storyEvents: Object.values(StoryEventID).filter((id) => typeof id === "number") as StoryEventID[],
};

type ToolMode = "dig" | "railDamage" | "railRepair";

const MODE_NAMES: Record<ToolMode, string> = {
  dig: "Dig mode",
  railDamage: "Rail damage mode",
  railRepair: "Rail repair mode",
};

type TweakPanel = Parameters<typeof debug.tweak.register>[1];
type GamePanel = Pick<TweakPanel, "title" | "sections" | "live">;
type Section = TweakPanel["sections"][number];
type Numbers = Record<string, number>;

interface GameSwitch {
  key: string;
  label: string;
  read: () => boolean;
  write: (on: boolean) => void;
}

interface NumberRef {
  key: string;
  owner: Record<string, unknown>;
  name: string;
}

function numberRefs(target: object): NumberRef[] {
  const refs: NumberRef[] = [];
  for (const [name, value] of Object.entries(target)) {
    if (typeof value === "number" && Number.isFinite(value))
      refs.push({ key: name, owner: target as Record<string, unknown>, name: name });
    else if (name === "props" && typeof value === "object" && value !== null)
      for (const [inner, innerValue] of Object.entries(value))
        if (typeof innerValue === "number" && Number.isFinite(innerValue))
          refs.push({ key: inner, owner: value as Record<string, unknown>, name: inner });
  }
  return refs;
}

function effectTitle(owner: string, effect: Effect) {
  return `${owner} · ${effect.name}`;
}

function boxText(box: Box) {
  return `${box.x}, ${box.y} · ${box.w}×${box.h}`;
}

export default class Profiler extends PragmaSystem {
  private mode: ToolMode | undefined;
  private pages = 0;
  private readonly commands: Record<string, object> = {};
  private readonly switches: GameSwitch[] = [];
  private readonly template = {
    apply: false,
    main: IDS.classes[0],
    foreman: false,
    count: 1,
    traits: new Set<TraitsID>(),
    items: new Map<GearSlot, ItemID>(),
  };
  declare private terrain: Terrain;
  declare private rails: Rails;
  declare private mapView: MapView;
  declare private decos: Decos;
  declare private discovery: Discovery;
  declare private buffs: Buffs;
  declare private workforce: Workforce;
  declare private roster: Roster;
  declare private stations: Stations;
  declare private buildings: Buildings;
  declare private calendar: Calendar;
  declare private player: PlayerStats;
  declare private story: StoryEvents;

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.rails = this.scene.getSystem(Rails);
    this.mapView = this.scene.getSystem(MapView);
    this.decos = this.scene.getSystem(Decos);
    this.discovery = this.scene.getSystem(Discovery);
    this.buffs = this.scene.getSystem(Buffs);
    this.workforce = this.scene.getSystem(Workforce);
    this.roster = this.scene.getSystem(Roster);
    this.stations = this.scene.getSystem(Stations);
    this.buildings = this.scene.getSystem(Buildings);
    this.calendar = this.scene.getSystem(Calendar);
    this.player = this.scene.getSystem(PlayerStats);
    this.story = this.scene.getSystem(StoryEvents);

    this.soundPage();
    this.viewPage();
    this.glowPage();
    this.buffsPage();
    this.tuningPages();
    this.spawnPage();
    this.buildingsPage();
    this.storyPage();

    this.reports();
    this.gameCommands();
    debug.command.expose("game", () => this.commands, { editable: true, hint: PROFILER.hint });
  }

  update(): void {
    if (InputManager.onActionPressed("toggleDig")) this.turn("dig", this.mode !== "dig");
    if (!this.mode) return;
    const tile = this.terrain.worldToTile(Camera.screenToWorld(InputManager.getMousePos()));
    if (this.mode === "dig") {
      if (InputManager.onActionHold("dig")) this.terrain.clear(tile.x, tile.y);
      return;
    }
    if (!InputManager.onActionPressed("dig") || !this.rails.isRail(tile)) return;
    if (this.mode === "railDamage") this.rails.damage(tile, Math.ceil(STRUCTURES.rails.durability / PROFILER.railHits));
    else this.rails.repair(tile);
  }

  private turn(mode: ToolMode, on: boolean) {
    if (on === (this.mode === mode)) return;
    this.mode = on ? mode : undefined;
    toast(`${MODE_NAMES[mode]} ${on ? "on" : "off"}`);
  }

  private reports() {
    debug.game.connect("date", () => this.calendar.dateText);
    debug.game.connect("resources", () =>
      RESOURCE_IDS.map((id) => ({ name: RESOURCES[id].name, amount: formatAmount(id, this.buildings.store.get(id)) })),
    );
    debug.game.connect("player", () => ({
      name: this.player.name,
      minedTotal: this.player.minedTotal,
      mined: [...this.player.minedList]
        .sort((a, b) => b[1] - a[1])
        .map(([block, count]) => ({ block: BlocksID[block], count: count })),
    }));
    debug.game.connect("dwarfs", () => ({
      counts: this.roster.counts(),
      rows: this.roster.dwarfs.map((dwarf) => this.dwarfRow(dwarf)),
    }));
    debug.game.connect("workforce", () => ({
      gear: IDS.gear.map((gear) => ({
        name: BASE_GEAR[gear].name,
        level: this.workforce.level(gear),
        max: BASE_GEAR[gear].levels.length,
        classes: IDS.classes
          .filter((main) => this.workforce.assignments.get(main) === gear)
          .map((main) => MAIN_TRAITS[main].name),
      })),
      research: WORKER_IDS.map((id) => ({
        name: WORKER_TRAITS[id].name,
        description: WORKER_TRAITS[id].description,
        researched: this.workforce.isResearched(id),
      })),
    }));
    debug.game.connect("buffs", () =>
      IDS.buffs.map((id) => ({
        name: BUFFS[id].name,
        description: BUFFS[id].description,
        hours: BUFFS[id].hours,
        hoursLeft: this.buffs.list.get(id) ?? null,
      })),
    );
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
    debug.game.connect("buildings", () => ({
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
        hireCost: Object.entries(TAVERN.hireCost)
          .map(([id, amount]) => formatAmount(Number(id) as ResourcesID, amount ?? 0))
          .join(", "),
      };
    });
  }

  private dwarfRow(dwarf: Dwarf) {
    const traits = dwarf.getComponent(Traits);
    const effects = dwarf.getComponent(Effects);
    const drinker = dwarf.getComponent(Drinker);
    const shift = dwarf.getComponent(Shift);
    assert(
      traits !== undefined && effects !== undefined && drinker !== undefined && shift !== undefined,
      `Dwarf ${dwarf.name} lacks a component the debug report reads`,
    );
    const station = this.roster.stationOf(dwarf);
    const equipment = dwarf.getComponent(Equipment);
    return {
      name: dwarf.name,
      rank: traits.foreman ? "foreman" : "worker",
      class: MAIN_TRAITS[traits.main].name,
      state: this.roster.stateOf(dwarf),
      station: station ? station.name : null,
      shiftHoursLeft: shift.endsAt === undefined ? null : shift.endsAt - this.calendar.time,
      beer: drinker.specialBeer === undefined ? null : SPECIAL_BEERS[drinker.specialBeer].name,
      speed: Math.round(effects.speed),
      power: Math.round(effects.power * 10) / 10,
      bph: Math.round(effects.bph * 10) / 10,
      traits: [...traits.list].map((trait) => TRAITS[trait].name),
      gear: equipment ? [...equipment.list.values()].map((item) => ITEMS[item].name) : [],
    };
  }

  private gameCommands() {
    const profiler = this;
    this.commands.dwarf = {
      get list() {
        return profiler.roster.dwarfs;
      },
      get states() {
        return profiler.roster.counts();
      },
      card: (index: number = 0) => profiler.roster.showCard(this.dwarfAt(index)),
      spawn: (count: number = 1, foreman: boolean = false) => profiler.roster.spawnRandom(count, foreman),
      pourBeer: (beer: SpecialBeerID, index: number = 0) => this.drinkerOf(index).pour(beer),
      emptyBeer: (index: number = 0) => this.drinkerOf(index).empty(),
      equip: (index: number, item: ItemID) => this.equipmentOf(index).equip(item),
      unequip: (index: number, slot: GearSlot) => this.equipmentOf(index).unequip(slot),
      addTrait: (index: number, trait: TraitsID, hours?: number) => this.traitsOf(index).add(trait, hours),
      removeTrait: (index: number, trait: TraitsID) => this.traitsOf(index).remove(trait),
      addTraitAll: (trait: TraitsID, where: DwarfGroup = "all", hours?: number) =>
        profiler.roster.addTraitAll(trait, where, hours),
      removeTraitAll: (trait: TraitsID) => profiler.roster.removeTraitAll(trait),
    };
    this.commands.morale = {
      get isOn() {
        return profiler.roster.moraleOn;
      },
      begin: () => profiler.roster.beginMorale(),
      range: (index: number) => profiler.roster.moraleOf(this.dwarfAt(index)).range,
      set: (index: number, value: number) => profiler.roster.setMorale(this.dwarfAt(index), value),
      change: (index: number, points: number) => profiler.roster.changeMorale(this.dwarfAt(index), points),
      setAll: (value: number, where: DwarfGroup = "all") => profiler.roster.setMoraleAll(value, where),
      changeAll: (points: number, where: DwarfGroup = "all") => profiler.roster.changeMoraleAll(points, where),
      give: (index: number, points: number) => profiler.roster.giveMorale(this.dwarfAt(index), points),
      giveAll: (points: number, where: DwarfGroup = "all") => profiler.roster.giveMoraleAll(points, where),
    };
    this.commands.buff = {
      get active() {
        return profiler.buffs.list;
      },
      add: (id: BuffID) => profiler.buffs.add(id),
      remove: (id: BuffID) => profiler.buffs.remove(id),
    };
    this.commands.workforce = {
      get levels() {
        return new Map(IDS.gear.map((gear) => [gear, profiler.workforce.level(gear)]));
      },
      get assigned() {
        return profiler.workforce.assignments;
      },
      get researched() {
        return profiler.workforce.researched;
      },
      setLevel: (gear: BaseGearID, level: number) => profiler.workforce.setLevel(gear, level),
      assign: (main: MainTraitsID, gear: BaseGearID) => profiler.workforce.assign(main, gear),
      research: (id: WorkerTraitID) => profiler.workforce.research(id),
      forget: (id: WorkerTraitID) => profiler.workforce.forget(id),
    };
    this.commands.time = {
      get date() {
        return profiler.calendar.dateText;
      },
      skip: (hours: number) => profiler.calendar.skip(hours),
    };
    this.commands.res = {
      get amounts() {
        return Object.fromEntries(RESOURCE_IDS.map((id) => [RESOURCES[id].name, profiler.buildings.store.get(id)]));
      },
      add: (amount: number) => {
        for (const id of RESOURCE_IDS) profiler.buildings.store.add(id, amount);
      },
      addBeer: (amount: number) => profiler.buildings.store.add(ResourcesID.beer, amount),
      addStone: (amount: number) => profiler.buildings.store.add(ResourcesID.stone, amount),
    };
    this.commands.station = {
      get list() {
        return profiler.stations.stations;
      },
      order: (
        main: MainTraitsID,
        hours: number = STATION.shift.start,
        beer: SpecialBeerID | undefined = undefined,
        index: number = 0,
      ) => profiler.stations.tryOrder(main, hours, beer, this.stationAt(index)),
      recall: (working: boolean = false, index: number = 0) => profiler.stations.recall(this.stationAt(index), working),
    };
    // x, y: a tile's corner; step: one of RAIL_STEPS; no checks, it goes over anything
    this.commands.rail = {
      get list() {
        return profiler.rails.segments;
      },
      build: (x: number, y: number, stepX: number, stepY: number, length: number) =>
        profiler.rails.build({ from: { x: x, y: y }, step: { x: stepX, y: stepY }, length: length }),
      break: (x: number, y: number) => profiler.rails.damage({ x: x, y: y }, STRUCTURES.rails.durability),
      repair: (x: number, y: number) => profiler.rails.repair({ x: x, y: y }),
    };
    this.commands.building = {
      get built() {
        return profiler.buildings.builtIds.map((id) => BUILDINGS[id].name);
      },
      get mineLevel() {
        return profiler.buildings.mineLevel;
      },
      remove: (id: BuildingsID) => profiler.buildings.remove(id),
      setMineLevel: (level: number) => profiler.buildings.setMineLevel(level),
    };
    this.commands.delivery = {
      send: () => {
        for (const station of profiler.stations.stations) {
          const haul = station.getComponent(Haul);
          assert(haul !== undefined, `${station.name} has no Haul`);
          haul.send();
        }
      },
    };
    this.commands.player = {
      get name() {
        return profiler.player.name;
      },
      rename: (name: string) => (profiler.player.name = name),
    };
    this.commands.story = {
      get fired() {
        return [...profiler.story.firedList].map((id) => StoryEventID[id]);
      },
      get pending() {
        return [...profiler.story.pendingList].map(([id, alarm]) => `${StoryEventID[id]} in ${(alarm.at ?? 0) - profiler.calendar.time} h`);
      },
      play: (id: StoryEventID) => profiler.story.playNow(id),
      jump: (target: "intro" | "hq2" | "agh") => profiler.jumpTo(target),
    };
  }

  private dwarfAt(index: number) {
    const dwarf = this.roster.dwarfs[index];
    assert(dwarf !== undefined, `No dwarf number ${index}, the roster has ${this.roster.dwarfs.length}`);
    return dwarf;
  }

  private traitsOf(index: number) {
    const dwarf = this.dwarfAt(index);
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    return traits;
  }

  private drinkerOf(index: number) {
    const dwarf = this.dwarfAt(index);
    const drinker = dwarf.getComponent(Drinker);
    assert(drinker !== undefined, `Dwarf ${dwarf.name} has no Drinker`);
    return drinker;
  }

  private equipmentOf(index: number) {
    const dwarf = this.dwarfAt(index);
    const equipment = dwarf.getComponent(Equipment);
    assert(equipment !== undefined, `Dwarf ${dwarf.name} is no foreman, only foremen wear items`);
    return equipment;
  }

  private stationAt(index: number) {
    const station = this.stations.stations[index];
    assert(station !== undefined, `No station number ${index}, there are ${this.stations.stations.length}`);
    return station;
  }

  private page(name: string, panel: GamePanel) {
    debug.tweak.register(PROFILER.panels.prefix + name, {
      ...panel,
      group: PROFILER.panels.group,
      order: this.pages++,
      command: false,
      exportable: false,
      presets: false,
    });
  }

  private soundPage() {
    const categories = [...Cello.getCategoryNames()];
    this.page("sound", {
      title: "Sound",
      sections: [
        {
          title: "Volume",
          call: "Cello.setCategoryVolume",
          arg: "object",
          fields: categories.map((name) => ({ key: name, control: { kind: "slider" as const, min: 0, max: 1, step: 0.01 } })),
          get: () => Object.fromEntries(categories.map((name) => [name, Cello.getCategoryVolumeValue(name) ?? 0])),
          set: (values) => {
            for (const name of categories) {
              const volume = values[name];
              if (typeof volume === "number") Cello.setCategoryVolume(name, volume);
            }
          },
        },
      ],
    });
  }

  private viewPage() {
    const toggle = (key: string, label: string, read: () => boolean, write: (on: boolean) => void) =>
      this.switches.push({ key: key, label: label, read: read, write: write });
    toggle("mist", "tunnel mist", () => this.mapView.mistShown, (on) => (this.mapView.mistShown = on));
    toggle("ao", "background AO", () => this.mapView.aoShown, (on) => this.mapView.showAo(on));
    toggle("hideUi", "hide ui", () => !Navi.root.active, (on) => Navi.root.setActive(!on));
    toggle("fog", "fog of war", () => this.discovery.fogShown, (on) => this.discovery.showFog(on));
    toggle("fullLight", "full light", () => this.discovery.fullLight, (on) => this.discovery.setFullLight(on));
    toggle("dig", "dig mode (F5)", () => this.mode === "dig", (on) => this.turn("dig", on));
    toggle("railDamage", "rail damage mode", () => this.mode === "railDamage", (on) => this.turn("railDamage", on));
    toggle("railRepair", "rail repair mode", () => this.mode === "railRepair", (on) => this.turn("railRepair", on));
    this.page(PROFILER.view.name, {
      title: PROFILER.view.title,
      sections: [
        {
          title: PROFILER.view.title,
          call: PROFILER.panels.prefix + PROFILER.view.name,
          arg: "object",
          fields: this.switches.map((entry) => ({ key: entry.key, label: entry.label, control: { kind: "toggle" } })),
          get: () => Object.fromEntries(this.switches.map((entry) => [entry.key, entry.read()])),
          set: (values) => {
            for (const entry of this.switches)
              if (typeof values[entry.key] === "boolean") entry.write(values[entry.key] === true);
          },
        },
      ],
    });
  }

  private glowPage() {
    const look = MAP_LOOK.glow;
    const glowing = IDS.blocks.filter((id) => BLOCKS[id].glow);
    const slider = (min: number, max: number, step: number) => ({ kind: "slider" as const, min, max, step });
    const glowOf = (id: BlocksID) => {
      const glow = BLOCKS[id].glow;
      assert(glow !== undefined, `${BlocksID[id]} lost its glow`);
      return glow;
    };
    this.page("glow", {
      title: "Ore glow",
      sections: [
        {
          title: "All ores",
          call: "MAP_LOOK.glow",
          arg: "object",
          fields: [
            { key: "sparkles", control: slider(0, 0.5, 0.01) },
            { key: "sparkleSpeed", label: "sparkle speed", control: slider(0, 5, 0.05) },
            { key: "breathe", control: slider(0, 0.5, 0.01) },
            { key: "breatheSpeed", label: "breathe speed", control: slider(0, 2, 0.01) },
          ],
          get: () => ({
            sparkles: look.sparkle.density,
            sparkleSpeed: look.sparkle.speed,
            breathe: look.breathe.amount,
            breatheSpeed: look.breathe.speed,
          }),
          set: (values) => {
            if (typeof values.sparkles === "number") look.sparkle.density = values.sparkles;
            if (typeof values.sparkleSpeed === "number") look.sparkle.speed = values.sparkleSpeed;
            if (typeof values.breathe === "number") look.breathe.amount = values.breathe;
            if (typeof values.breatheSpeed === "number") look.breathe.speed = values.breatheSpeed;
            GameGlobals.refreshGlowLook();
          },
        },
        ...glowing.map((id) => ({
          title: BlocksID[id],
          call: `BLOCKS.${BlocksID[id]}.glow`,
          arg: "object" as const,
          fields: [
            { key: "color", control: { kind: "color" as const } },
            { key: "blend", control: slider(0, 1, 0.01) },
            { key: "shine", control: slider(0, 6, 0.05) },
            { key: "style", control: { kind: "select" as const, options: GLOW_STYLES } },
            { key: "sparkles", control: slider(0, 0.5, 0.005) },
            { key: "sparkleSpeed", label: "sparkle speed", control: slider(0, 8, 0.05) },
          ],
          get: () => {
            const glow = glowOf(id);
            const sparkle = glow.sparkle ?? look.sparkle;
            return {
              color: [...glow.color, 255],
              blend: glow.blend,
              shine: glow.shine,
              style: glow.style ?? "glow",
              sparkles: sparkle.density,
              sparkleSpeed: sparkle.speed,
            };
          },
          set: (values: Record<string, unknown>) => {
            const glow = glowOf(id);
            if (Array.isArray(values.color)) glow.color = [values.color[0], values.color[1], values.color[2]];
            if (typeof values.blend === "number") glow.blend = values.blend;
            if (typeof values.shine === "number") glow.shine = values.shine;
            const style = GLOW_STYLES.find((name) => name === values.style);
            if (style) glow.style = style;
            if (typeof values.sparkles === "number") glow.sparkle = { ...(glow.sparkle ?? look.sparkle), density: values.sparkles };
            if (typeof values.sparkleSpeed === "number") glow.sparkle = { ...(glow.sparkle ?? look.sparkle), speed: values.sparkleSpeed };
            GameGlobals.refreshMaterials();
          },
        })),
      ],
    });
  }

  private mushroomsPage() {
    const slider = (min: number, max: number, step: number) => ({ kind: "slider" as const, min, max, step });
    const all = [...MUSHROOM_LIGHTS.floor, ...MUSHROOM_LIGHTS.shelf];
    const sampleFloor = LIGHTS[MUSHROOM_LIGHTS.floor[0]];
    const sampleShelf = LIGHTS[MUSHROOM_LIGHTS.shelf[0]];
    this.page("tuneMushrooms", {
      title: "Tune: mushrooms",
      sections: [
        {
          title: "All mushrooms",
          call: "MUSHROOM_LIGHT",
          arg: "object",
          fields: [
            { key: "floorRadius", label: "floor radius", control: slider(0, 500, 5) },
            { key: "floorIntensity", label: "floor intensity", control: slider(0, 1.5, 0.01) },
            { key: "shelfRadius", label: "shelf radius", control: slider(0, 400, 5) },
            { key: "shelfIntensity", label: "shelf intensity", control: slider(0, 1.5, 0.01) },
            { key: "flickerAmount", label: "flicker amount", control: slider(0, 0.5, 0.01) },
            { key: "flickerSpeed", label: "flicker speed", control: slider(0, 3, 0.05) },
          ],
          get: () => ({
            floorRadius: sampleFloor.radius,
            floorIntensity: sampleFloor.intensity,
            shelfRadius: sampleShelf.radius,
            shelfIntensity: sampleShelf.intensity,
            flickerAmount: sampleFloor.flicker?.amount ?? 0,
            flickerSpeed: sampleFloor.flicker?.speed ?? 0,
          }),
          set: (values) => {
            for (const id of MUSHROOM_LIGHTS.floor) {
              if (typeof values.floorRadius === "number") LIGHTS[id].radius = values.floorRadius;
              if (typeof values.floorIntensity === "number") LIGHTS[id].intensity = values.floorIntensity;
            }
            for (const id of MUSHROOM_LIGHTS.shelf) {
              if (typeof values.shelfRadius === "number") LIGHTS[id].radius = values.shelfRadius;
              if (typeof values.shelfIntensity === "number") LIGHTS[id].intensity = values.shelfIntensity;
            }
            for (const id of all) {
              const flicker = LIGHTS[id].flicker ?? { amount: 0, speed: 0 };
              if (typeof values.flickerAmount === "number") flicker.amount = values.flickerAmount;
              if (typeof values.flickerSpeed === "number") flicker.speed = values.flickerSpeed;
              LIGHTS[id].flicker = flicker;
            }
          },
        },
        ...all.map((id) => ({
          title: LightsID[id],
          call: `LIGHTS.${LightsID[id]}`,
          arg: "object" as const,
          fields: [
            { key: "color", control: { kind: "color" as const } },
            { key: "glow", control: slider(0, 15, 0.1) },
            { key: "radius", control: slider(0, 500, 5) },
            { key: "intensity", control: slider(0, 1.5, 0.01) },
            { key: "falloff", control: slider(0.1, 4, 0.05) },
            { key: "flickerAmount", label: "flicker amount", control: slider(0, 0.5, 0.01) },
            { key: "flickerSpeed", label: "flicker speed", control: slider(0, 3, 0.05) },
          ],
          get: () => {
            const light = LIGHTS[id];
            return {
              color: [...light.color],
              glow: light.glow ?? 1,
              radius: light.radius,
              intensity: light.intensity,
              falloff: light.falloff ?? LIGHT_FALLOFF,
              flickerAmount: light.flicker?.amount ?? 0,
              flickerSpeed: light.flicker?.speed ?? 0,
            };
          },
          set: (values: Record<string, unknown>) => {
            const light = LIGHTS[id];
            if (Array.isArray(values.color))
              light.color = [values.color[0], values.color[1], values.color[2], 255];
            if (typeof values.glow === "number") light.glow = values.glow;
            if (typeof values.radius === "number") light.radius = values.radius;
            if (typeof values.intensity === "number") light.intensity = values.intensity;
            if (typeof values.falloff === "number") light.falloff = values.falloff;
            if (typeof values.flickerAmount === "number" || typeof values.flickerSpeed === "number") {
              const flicker = light.flicker ?? { amount: 0, speed: 0 };
              if (typeof values.flickerAmount === "number") flicker.amount = values.flickerAmount;
              if (typeof values.flickerSpeed === "number") flicker.speed = values.flickerSpeed;
              light.flicker = flicker;
            }
            this.decos.refreshGlow();
          },
        })),
      ],
    });
  }

  private buffsPage() {
    const left = (id: BuffID) => {
      const hours = this.buffs.list.get(id);
      return hours === undefined ? "off" : `${Math.ceil(hours)} h`;
    };
    const total = (stat: StatName) => {
      const modifiers = this.buffs.stats[stat];
      const sign = modifiers.add >= 0 ? "+" : "";
      return `${sign}${modifiers.add} ×${Math.round(modifiers.multiply * 100) / 100}`;
    };
    this.page("buffs", {
      title: "Buffs",
      live: true,
      sections: [
        {
          title: "Working",
          call: "game.buff",
          arg: "object",
          fields: IDS.buffs.map((id) => ({ key: String(id), label: BUFFS[id].name, control: { kind: "toggle" } })),
          get: () => Object.fromEntries(IDS.buffs.map((id) => [String(id), this.buffs.has(id)])),
          set: (values) => {
            for (const id of IDS.buffs) {
              const on = values[String(id)];
              if (on === true && !this.buffs.has(id)) this.buffs.add(id);
              if (on === false && this.buffs.has(id)) this.buffs.remove(id);
            }
          },
        },
        {
          title: "Time left",
          call: "game.buff",
          arg: "object",
          fields: IDS.buffs.map((id) => ({ key: String(id), label: BUFFS[id].name, control: { kind: "info" } })),
          get: () => Object.fromEntries(IDS.buffs.map((id) => [String(id), left(id)])),
          set: () => {},
        },
        {
          title: "Total",
          call: "game.buff",
          arg: "object",
          fields: STATS.map((stat) => ({ key: stat, label: STAT_NAMES[stat], control: { kind: "info" } })),
          get: () => Object.fromEntries(STATS.map((stat) => [stat, total(stat)])),
          set: () => {},
        },
      ],
    });
  }

  private spawnPage() {
    const template = this.template;
    const itemsFor = (slot: GearSlot) => IDS.items.filter((id) => ITEMS[id].slot === slot);
    const spawn = () => {
      const dwarf = this.roster.make(template.main, template.foreman ? DwarfRank.foreman : DwarfRank.worker);
      const traits = dwarf.getComponent(Traits);
      assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
      for (const trait of template.traits) traits.add(trait);
      if (!template.foreman) return dwarf;
      const equipment = dwarf.getComponent(Equipment);
      assert(equipment !== undefined, `Dwarf ${dwarf.name} is a foreman without Equipment`);
      for (const item of template.items.values()) equipment.equip(item);
      return dwarf;
    };
    this.page("spawn", {
      title: "Spawn template",
      live: true,
      sections: [
        {
          title: "Dwarf",
          call: "game.dwarf",
          arg: "object",
          fields: [
            { key: "apply", label: "every new dwarf looks like this", control: { kind: "toggle" } },
            { key: "class", control: { kind: "select", options: IDS.classes.map((id) => MAIN_TRAITS[id].name) } },
            { key: "rank", control: { kind: "select", options: PROFILER.spawn.ranks } },
          ],
          get: () => ({
            apply: template.apply,
            class: MAIN_TRAITS[template.main].name,
            rank: PROFILER.spawn.ranks[template.foreman ? 1 : 0],
          }),
          set: (values) => {
            if (typeof values.apply === "boolean") {
              template.apply = values.apply;
              this.roster.createInstead = template.apply ? spawn : undefined;
            }
            const main = IDS.classes.find((id) => MAIN_TRAITS[id].name === values.class);
            if (main !== undefined) template.main = main;
            if (typeof values.rank === "string") template.foreman = values.rank === PROFILER.spawn.ranks[1];
          },
        },
        {
          title: "Traits",
          call: "game.dwarf",
          arg: "object",
          fields: IDS.traits.map((id) => ({ key: String(id), label: TRAITS[id].name, control: { kind: "toggle" } })),
          get: () => Object.fromEntries(IDS.traits.map((id) => [String(id), template.traits.has(id)])),
          set: (values) => {
            for (const id of IDS.traits) {
              if (values[String(id)] === true) template.traits.add(id);
              if (values[String(id)] === false) template.traits.delete(id);
            }
          },
        },
        {
          title: "Items (foreman only)",
          call: "game.dwarf",
          arg: "object",
          fields: GEAR_SLOTS.map((slot) => ({
            key: String(slot),
            label: GEAR_SLOT_NAMES[slot],
            control: { kind: "select", options: [PROFILER.spawn.none, ...itemsFor(slot).map((id) => ITEMS[id].name)] },
          })),
          get: () =>
            Object.fromEntries(
              GEAR_SLOTS.map((slot) => {
                const item = template.items.get(slot);
                return [String(slot), item === undefined ? PROFILER.spawn.none : ITEMS[item].name];
              }),
            ),
          set: (values) => {
            for (const slot of GEAR_SLOTS) {
              const name = values[String(slot)];
              const item = itemsFor(slot).find((id) => ITEMS[id].name === name);
              if (item === undefined) template.items.delete(slot);
              else template.items.set(slot, item);
            }
          },
        },
        {
          title: "Spawn",
          call: "game.dwarf",
          arg: "object",
          fields: [
            { key: "count", control: { kind: "number", step: 1 } },
            { key: "spawn", label: "", control: { kind: "button", text: "Spawn into the tavern" } },
          ],
          get: () => ({ count: template.count, spawn: false }),
          set: (values) => {
            if (typeof values.count === "number") template.count = Math.max(1, Math.round(values.count));
            if (values.spawn !== true) return;
            for (let index = 0; index < template.count; index++) this.roster.enlist(spawn());
          },
        },
      ],
    });
  }

  private buildingsPage() {
    this.page("buildings", {
      title: "Buildings",
      live: true,
      sections: [
        {
          title: "Built",
          call: "game.building.remove",
          arg: "object",
          fields: IDS.buildings.map((id) => ({
            key: String(id),
            label: BUILDINGS[id].name,
            control: { kind: "button", text: "Remove" },
          })),
          get: () => Object.fromEntries(IDS.buildings.map((id) => [String(id), false])),
          set: (values) => {
            const built = this.buildings.builtIds;
            for (const id of IDS.buildings) if (values[String(id)] === true && built.includes(id)) this.buildings.remove(id);
          },
        },
      ],
    });
  }

  private storyPage() {
    this.page("story", {
      title: "Story & jump",
      live: true,
      sections: [
        {
          title: "Jump to",
          call: "game.story.jump",
          arg: "object",
          fields: [
            { key: "intro", label: "After intro (HQ 1)", control: { kind: "button", text: "Jump" } },
            { key: "hq2", label: "Ready for HQ 2", control: { kind: "button", text: "Jump" } },
            { key: "agh", label: "HQ 2 + AGH built", control: { kind: "button", text: "Jump" } },
          ],
          get: () => ({ intro: false, hq2: false, agh: false }),
          set: (values) => {
            if (values.intro === true) this.jumpTo("intro");
            if (values.hq2 === true) this.jumpTo("hq2");
            if (values.agh === true) this.jumpTo("agh");
          },
        },
        {
          title: "Play event",
          call: "game.story.play",
          arg: "object",
          fields: IDS.storyEvents.map((id) => ({
            key: String(id),
            label: StoryEventID[id],
            control: { kind: "button", text: "Play" },
          })),
          get: () => Object.fromEntries(IDS.storyEvents.map((id) => [String(id), false])),
          set: (values) => {
            for (const id of IDS.storyEvents) if (values[String(id)] === true) this.story.playNow(id);
          },
        },
      ],
    });
  }

  private jumpTo(target: "intro" | "hq2" | "agh") {
    this.story.skipEvent(StoryEventID.intro);
    if (target === "hq2") {
      const cost = HEADQUARTERS.levels[1]?.cost;
      if (cost) for (const [id, missing] of this.buildings.store.missing(cost)) this.buildings.store.add(id, missing);
      toast("Jumped to HQ 2 ready", "info");
      return;
    }
    if (target === "agh") {
      this.story.markDone(StoryEventID.marketOpens);
      this.story.markDone(StoryEventID.aghOpens);
      if (this.buildings.mineLevel < 2) this.buildings.setMineLevel(2);
      if (!this.buildings.isStanding(BuildingsID.market)) this.buildings.buildMarket();
      if (!this.buildings.isStanding(BuildingsID.agh)) this.buildings.buildAgh();
      toast("Jumped to HQ 2 + AGH", "info");
      return;
    }
    toast("Jumped past intro", "info");
  }

  private tuningPages() {
    const traits: Section[] = [];
    for (const data of Object.values(MAIN_TRAITS)) traits.push(...this.tuneEntry(data.name, data, data.effects));
    traits.push(...this.tuneEntry(FOREMAN_TRAIT.name, {}, FOREMAN_TRAIT.effects));
    for (const data of Object.values(TRAITS)) traits.push(...this.tuneEntry(data.name, {}, data.effects));
    for (const data of Object.values(WORKER_TRAITS)) traits.push(...this.tuneEntry(data.name, {}, data.effects));
    this.page("tuneTraits", { title: "Tune: traits", sections: traits });

    const beers: Section[] = [];
    for (const data of Object.values(SPECIAL_BEERS)) beers.push(...this.tuneEntry(data.name, {}, data.effects));
    this.page("tuneBeers", { title: "Tune: special beers", sections: beers });

    const buffs: Section[] = [];
    for (const data of Object.values(BUFFS)) buffs.push(...this.tuneEntry(data.name, data, data.effects));
    this.page("tuneBuffs", { title: "Tune: buffs", sections: buffs });

    const gear: Section[] = [];
    for (const data of Object.values(ITEMS)) gear.push(...this.tuneEntry(data.name, {}, data.effects));
    for (const base of Object.values(BASE_GEAR))
      base.levels.forEach((effects, index) => gear.push(...this.tuneEntry(`${base.name} · level ${index + 1}`, {}, effects)));
    this.page("tuneGear", { title: "Tune: gear", sections: gear });

    this.miningPage();
    this.tradePage();
    this.mushroomsPage();
  }

  private tuned() {
    this.workforce.touch();
    this.buffs.touch();
  }

  private tuneSection(title: string, call: string, refs: NumberRef[]): Section | undefined {
    if (refs.length === 0) return undefined;
    const defaults: Numbers = {};
    for (const ref of refs) defaults[ref.key] = ref.owner[ref.name] as number;
    return {
      title: title,
      call: call,
      arg: "object",
      fields: refs.map((ref) => ({ key: ref.key, control: { kind: "number", step: PROFILER.tuningStep } })),
      defaults: defaults,
      get: () => Object.fromEntries(refs.map((ref) => [ref.key, ref.owner[ref.name]])),
      set: (values) => {
        for (const ref of refs) {
          const value = values[ref.key];
          if (typeof value === "number" && Number.isFinite(value)) ref.owner[ref.name] = value;
        }
        this.tuned();
      },
      format: (values) => `// ${title}: ${Object.entries(values).map(([key, value]) => `${key} ${value}`).join(", ")}`,
    };
  }

  private tuneEntry(title: string, data: object, effects: readonly Effect[]) {
    const sections = [this.tuneSection(`${title} · stats`, title, numberRefs(data))];
    for (const effect of effects) sections.push(this.tuneSection(effectTitle(title, effect), title, numberRefs(effect)));
    return sections.filter((section) => section !== undefined);
  }

  private miningPage() {
    const dropRefs = IDS.blocks.flatMap((id) => {
      const drop = BLOCKS[id].drops;
      return drop ? [{ key: BlocksID[id], owner: drop as unknown as Record<string, unknown>, name: "amount" }] : [];
    });
    const amounts = this.tuneSection("Drop amounts", "BLOCKS.<block>.drops.amount", dropRefs);
    const strengthRefs = IDS.blocks
      .filter((id) => BLOCKS[id].solid && Number.isFinite(BLOCKS[id].str) && BLOCKS[id].str > 0)
      .map((id) => ({ key: BlocksID[id], owner: BLOCKS[id] as unknown as Record<string, unknown>, name: "str" }));
    const strength = this.tuneSection("Block strength", "BLOCKS.<block>.str", strengthRefs);
    const names = RESOURCE_IDS.map((id) => RESOURCES[id].name);
    const drops: Section = {
      title: "Block drops",
      call: "BLOCKS.<block>.drops.id",
      arg: "object",
      fields: dropRefs.map((ref) => ({ key: ref.key, control: { kind: "select", options: names } })),
      get: () => Object.fromEntries(dropRefs.map((ref) => [ref.key, RESOURCES[ref.owner.id as ResourcesID].name])),
      set: (values) => {
        for (const ref of dropRefs) {
          const id = RESOURCE_IDS.find((resource) => RESOURCES[resource].name === values[ref.key]);
          if (id !== undefined) ref.owner.id = id;
        }
      },
    };
    const sections = [amounts, strength, drops].filter((section) => section !== undefined);
    this.page("tuneEconomy", { title: "Tune: mining", sections: sections });
  }

  private tradePage() {
    const goodRefs = (name: "price" | "pack") =>
      MARKET_GOODS.map((good) => ({ key: RESOURCES[good.id].name, owner: good as unknown as Record<string, unknown>, name: name }));
    const sections = [
      this.tuneSection("Market prices (beer a pack)", "MARKET_GOODS.<good>.price", goodRefs("price")),
      this.tuneSection("Market packs", "MARKET_GOODS.<good>.pack", goodRefs("pack")),
      this.tuneSection("Smelter", "SMELTER", numberRefs(SMELTER)),
      ...RECIPE_IDS.map((id) =>
        this.tuneSection(`Recipe · ${RECIPES[id].name}`, `RECIPES.${RecipeID[id]}`, numberRefs(RECIPES[id])),
      ),
    ].filter((section) => section !== undefined);
    this.page("tuneTrade", { title: "Tune: market & smelter", sections: sections });
  }
}
