import PragmaSystem from "@pragma/system";
import Navi from "@navi/navi";
import { debug } from "@debug";
import { UI_FONTS, UI_THEME } from "../../game/content/ui";
import { buyPrice, MARKET, MARKET_GOODS } from "../../game/content/market";
import { RECIPE_IDS, recipeCost, RECIPES, RecipeID } from "../../game/content/smelter";
import { BUILD_ELEMENTS, type BuildElementID } from "../../game/content/build";
import { formatAmount, RESOURCE_IDS, RESOURCES, ResourcesID, type ResourceCost } from "../../game/content/resources";
import { FOREMAN_TRAIT, MAIN_TRAITS, MainTraitsID, TRAITS, TraitsID, WORKER_TRAITS, type TraitData, type WorkerTraitID } from "../../game/content/traits";
import { BUFFS, type BuffID } from "../../game/content/buffs";
import { SPECIAL_BEERS, type SpecialBeerID } from "../../game/content/beers";
import { BASE_GEAR, BaseGearID, ITEMS, type ItemID } from "../../game/content/gear";
import { BLOCKS, BlocksID, type BlockData } from "../../game/content/blocks";
import { always } from "../../game/drops/always";
import { describeResourceDrop } from "../../game/drops/resources";
import { STRUCTURES } from "../../game/content/structures";
import { SMELTER } from "../../game/components/buildings/smelter";
import { HEADQUARTERS } from "../../game/components/buildings/headquarters";
import { TAVERN } from "../../game/components/buildings/tavern";
import { MORALE } from "../../game/components/dwarfs/morale";
import { BALL } from "../../game/components/dwarfs/ball";
import { LAUNCHER } from "../../game/components/mine/launcher";
import { STATION } from "../../game/actors/station";
import { PHYS } from "../../game/systems/world/ballPhysics";
import { TRAVEL } from "../../game/systems/mine/transport";
import { CALENDAR } from "../../game/systems/core/calendar";
import Workforce from "../../game/systems/dwarfs/workforce";
import Buffs from "../../game/systems/dwarfs/buffs";
import GameGlobals from "../../game/gpu/gameGlobals";
import type Effect from "../../game/effects/effect";
import { STAT_NAMES, STATS, type StatName } from "../../game/effects/effect";
import { add } from "../../game/effects/add";
import { multiply } from "../../game/effects/multiply";
import { amountText, costText } from "../format";
import { choice, control, effectRefs, idsOf, page, ref, tunePage, tuned, values, words, type Ref, type Section } from "../pages";

const IDS = {
  build: idsOf<BuildElementID>(BUILD_ELEMENTS),
  blocks: idsOf<BlocksID>(BLOCKS),
  classes: idsOf<MainTraitsID>(MAIN_TRAITS),
  traits: idsOf<TraitsID>(TRAITS),
  gear: idsOf<BaseGearID>(BASE_GEAR),
};

const RESOURCE = choice(RESOURCE_IDS, (id) => RESOURCES[id].name);

// prices, multipliers and kg: a whole number to start with does not mean a whole number only
const STEP = { decimal: 0.1 };

// add: the effect, its number and the value that changes nothing; gear: the stats a gear level has
const STAT_EFFECTS = {
  add: { make: add, key: "amount", neutral: 0, sign: "+" },
  multiply: { make: multiply, key: "factor", neutral: 1, sign: "×" },
  gear: ["power", "bph", "speed"] as StatName[],
};

type StatKind = "add" | "multiply";

// a stat's add or multiplier in a list of effects, also when the list has none: the neutral value
// shows, and only another value adds the effect, so the game never lists "+0"
function statSlot(effects: Effect[], stat: StatName, kind: StatKind) {
  const spec = STAT_EFFECTS[kind];
  const name = spec.make(stat, spec.neutral).name;
  const props = () => effects.find((effect) => effect.name === name)?.props as Record<string, number> | undefined;
  return {
    get value() {
      return props()?.[spec.key] ?? spec.neutral;
    },
    set value(value: number) {
      const found = props();
      if (found) found[spec.key] = value;
      else if (value !== spec.neutral) effects.push(spec.make(stat, value));
    },
  };
}

function statRefs(effects: Effect[], stats: readonly StatName[], kind: StatKind, path: string): Ref[] {
  return stats.map((stat) => ({
    owner: statSlot(effects, stat, kind),
    key: "value",
    path: `${path} ${kind} ${stat}`,
    label: `${STAT_NAMES[stat]} ${STAT_EFFECTS[kind].sign}`,
  }));
}

// the numbers of effects that are no plain add or multiplier (splash, pierce)
function otherEffectRefs(effects: Effect[], path: string) {
  const plain = new Set(effects.filter((effect) => /^(Add|Multiply) /.test(effect.name)).map((effect) => effect.props));
  return effectRefs(effects, path).filter((each) => !plain.has(each.owner));
}

// editable list of resources in a cost: only the present ones are shown, "+ add" picks an unused resource
function costSection(title: string, cost: ResourceCost, path: string, group?: string): Section {
  const read = () =>
    RESOURCE_IDS.filter((id) => cost[id] !== undefined).map((id) => ({
      resource: RESOURCE.name(id),
      amount: cost[id] as number,
    }));
  const write = (items: Record<string, unknown>[]) => {
    for (const id of RESOURCE_IDS) delete cost[id];
    for (const item of items) {
      const id = RESOURCE.id(String(item.resource));
      const amount = Math.max(0, Number(item.amount) || 0);
      cost[id] = (cost[id] ?? 0) + amount;
    }
  };
  return {
    title,
    call: path,
    arg: "list",
    group,
    defaults: structuredClone(read()),
    get: read,
    set: write,
    format: (items) =>
      items
        .map((item) => `${path}[${ResourcesID[RESOURCE.id(String(item.resource))]}] = ${JSON.stringify(item.amount)}`)
        .join("\n"),
    item: {
      fields: () => [
        { key: "resource", label: "Resource", control: control.select(RESOURCE.names) },
        { key: "amount", label: "Amount", control: control.number(STEP.decimal) },
      ],
      create: (current) => {
        if (current) return { resource: current.resource, amount: 1 };
        const free = RESOURCE_IDS.find((id) => cost[id] === undefined);
        if (free === undefined) return null;
        return { resource: RESOURCE.name(free), amount: 1 };
      },
      label: (item) => {
        const id = RESOURCE.id(String(item.resource));
        return `${RESOURCES[id].name} (${formatAmount(id, Number(item.amount) || 0)})`;
      },
    },
  };
}

// what a block drops, also when it drops nothing: "nothing" takes the drop away
const DROP = {
  nothing: "nothing",
  amount: 1,
};

function dropRefs(block: BlockData, path: string): Ref[] {
  const names = [DROP.nothing, ...RESOURCE.names];
  const slot = {
    get resource(): ResourcesID | undefined {
      return block.drops?.main?.id;
    },
    set resource(id: ResourcesID | undefined) {
      if (id === undefined) delete block.drops;
      else block.drops = always(id, block.drops?.main?.amount[0] ?? DROP.amount);
    },
    get amount() {
      return block.drops?.main?.amount[0] ?? 0;
    },
    set amount(value: number) {
      if (block.drops?.main) block.drops = always(block.drops.main.id, value);
    },
  };
  return [
    {
      owner: slot,
      key: "resource",
      path: `${path}.drops.id`,
      label: "Drops",
      hint: "The resource it gives when broken",
      choice: {
        names,
        id: (name) => (name === DROP.nothing ? undefined : RESOURCE.id(name)),
        name: (id) => (id === undefined ? DROP.nothing : RESOURCE.name(id)),
      },
    },
    { owner: slot, key: "amount", path: `${path}.drops.amount`, label: "Drop amount", hint: "How much a broken block gives; pick what it drops first" },
  ];
}

// strength, also of a block nothing breaks: Infinity shows as "unbreakable"
function strengthRefs(block: BlockData, path: string): Ref[] {
  let breakable = Number.isFinite(block.str) ? block.str : 1;
  const slot = {
    get unbreakable() {
      return !Number.isFinite(block.str);
    },
    set unbreakable(on: boolean) {
      if (Number.isFinite(block.str)) breakable = block.str;
      block.str = on ? Infinity : breakable;
    },
    get strength() {
      return Number.isFinite(block.str) ? block.str : breakable;
    },
    set strength(value: number) {
      breakable = value;
      if (Number.isFinite(block.str)) block.str = value;
    },
  };
  return [
    { owner: slot, key: "unbreakable", path: `${path}.unbreakable`, label: "Unbreakable", hint: "Nothing breaks it (str: Infinity)" },
    { owner: slot, key: "strength", path: `${path}.str`, label: "Strength", hint: "Damage it takes to break" },
  ];
}

export default class TuneDebug extends PragmaSystem {
  declare private workforce: Workforce;
  declare private buffs: Buffs;

  awake(): void {
    this.workforce = this.scene.getSystem(Workforce);
    this.buffs = this.scene.getSystem(Buffs);
    this.reports();
    this.crewPages();
    this.miningPages();
    this.campPages();
    this.flightPages();
  }

  // every dwarf's stats are summed from these: an edit makes them count again
  private readonly statsChanged = () => {
    this.workforce.touch();
    this.buffs.touch();
  };

  // under its name: what it changes on its own (extra, its other effects), then an add and a
  // multiplier of every stat, the ones it doesn't have at 0 and ×1
  private effectSections(data: TraitData, path: string, extra: Ref[] = [], withStats = true) {
    const own = [...extra, ...otherEffectRefs(data.effects, path)];
    return [
      ...(own.length > 0 ? [tuned("Own", own, this.statsChanged, data.name)] : []),
      ...(withStats
        ? [
            tuned("Adds", statRefs(data.effects, STATS, "add", path), this.statsChanged, data.name),
            tuned("Multipliers", statRefs(data.effects, STATS, "multiply", path), this.statsChanged, data.name),
          ]
        : []),
    ];
  }

  // traits, beers, items and buffs share the shape: every element with its effects
  private effectsTable<ID extends number>(
    name: string,
    title: string,
    description: string,
    table: Partial<Record<ID, TraitData>>,
    pathOf: (id: ID) => string,
    extra: (id: ID) => Ref[] = () => [],
    withStats = true,
  ) {
    const ids = idsOf<ID>(table);
    if (ids.length === 0) return;
    tunePage("tune", name, title, description, () =>
      ids.flatMap((id) => this.effectSections(table[id] as TraitData, pathOf(id), extra(id), withStats)),
    );
  }

  private crewPages() {
    tunePage(
      "tune",
      "classes",
      "Classes",
      "A dwarf's base stats by class, before gear, traits and buffs. The stat a dwarf ends with: (class + every add) × every multiplier.",
      () =>
        IDS.classes.map((id) => {
          const data = MAIN_TRAITS[id];
          const path = `MAIN_TRAITS[${MainTraitsID[id]}]`;
          return tuned(
            data.plan ? `${data.name} (plan: ${data.plan})` : data.name,
            [
              ref(data, "speed", path, "Speed", `How fast its ball flies: speed × ${BALL.pixelsPerSpeed} px a second (Ball page)`),
              ref(data, "power", path, "Damage", "Taken off a block's strength each hit"),
              ref(data, "bph", path, "Beer per hour", "Its wage: beer a game hour of its shift, paid when ordered"),
              ...effectRefs(data.effects, path),
            ],
            this.statsChanged,
          );
        }),
    );
    tunePage("tune", "foreman", "Foreman", `What a foreman has on top of its class. ${FOREMAN_TRAIT.description}`, () =>
      this.effectSections(FOREMAN_TRAIT, "FOREMAN_TRAIT"),
    );
    this.effectsTable<TraitsID>(
      "traits",
      "Traits",
      "Traits a dwarf gets or loses while playing. Tired comes and goes with morale, its thresholds are under its name.",
      TRAITS,
      (id) => `TRAITS[${TraitsID[id]}]`,
      (id) =>
        id === TraitsID.tired
          ? [
              ref(MORALE, "tiredBelow", "MORALE", "Tired below morale", "A dwarf whose morale falls under this gets Tired"),
              ref(MORALE, "restedAt", "MORALE", "Rested at morale", "A Tired dwarf loses it once its morale is back at this"),
            ]
          : [],
      false,
    );
    tunePage(
      "tune",
      "morale",
      "Morale",
      "How a dwarf's morale moves. It changes every full game hour; at 0 a working dwarf quits its shift. Traits, gear and buffs shift the lowest, highest and rate.",
      () => [
        tuned("Morale", [
          ref(MORALE, "start", "MORALE", "Start", "Morale of a new dwarf, and of everyone when morale turns on"),
          ref(MORALE, "min", "MORALE", "Lowest", "Base floor, before effects"),
          ref(MORALE, "max", "MORALE", "Highest", "Base ceiling, before effects"),
          ref(MORALE, "work", "MORALE", "Each hour working", "Points a full hour of a shift adds (negative: it wears down)"),
          ref(MORALE, "tavern", "MORALE", "Each hour in the tavern", "Points a full hour of rest in the tavern adds"),
          ref(MORALE, "rate", "MORALE", "Rate", "0.1 makes morale move 10% faster both ways"),
        ]),
      ],
    );
    tunePage(
      "tune",
      "gear",
      "Worker gear",
      "The gear every worker (not a foreman) wears, one piece per class. Level 0 is locked, the AGH unlocks the next one.",
      () =>
        IDS.gear.flatMap((id) => {
          const data = BASE_GEAR[id];
          return data.levels.map((effects, level) =>
            tuned(
              `Level ${level + 1}`,
              statRefs(effects, STAT_EFFECTS.gear, "add", `BASE_GEAR[${BaseGearID[id]}].levels[${level}]`),
              this.statsChanged,
              data.name,
            ),
          );
        }),
    );
    this.effectsTable<WorkerTraitID>(
      "workerTraits",
      "Research",
      "Worker traits the AGH researches for every worker.",
      WORKER_TRAITS,
      (id) => `WORKER_TRAITS[${id}]`,
    );
    this.effectsTable<ItemID>("items", "Foreman items", "Items a foreman wears, one a slot.", ITEMS, (id) => `ITEMS[${id}]`);
    this.effectsTable<SpecialBeerID>(
      "specialBeers",
      "Special beers",
      "Beers poured for a shift, on top of the wage.",
      SPECIAL_BEERS,
      (id) => `SPECIAL_BEERS[${id}]`,
    );
    this.effectsTable<BuffID>(
      "buffs",
      "Buffs",
      "Crew-wide effects that last some game hours.",
      BUFFS,
      (id) => `BUFFS[${id}]`,
      (id) => [ref(BUFFS[id], "hours", `BUFFS[${id}]`, "Lasts (hours)", "Game hours it stays on")],
    );
  }

  private miningPages() {
    tunePage(
      "tune",
      "blocks",
      "Blocks",
      "What it takes to break a block of the map and what it gives. Strength drops by a ball's damage each hit; the drop goes to the station of the dwarf that broke it.",
      () =>
        IDS.blocks
          .filter((id) => BLOCKS[id].sheet !== undefined)
          .map((id) => {
            const data = BLOCKS[id];
            const path = `BLOCKS[${BlocksID[id]}]`;
            return tuned(words(BlocksID[id]), [...strengthRefs(data, path), ...dropRefs(data, path)], () =>
              GameGlobals.refreshMaterials(),
            );
          }),
    );
    tunePage(
      "tune",
      "market",
      "Market",
      "What the market buys and sells, always in packs and for beer. Buying a pack costs its sell price times the buy markup.",
      () => [
        tuned("All goods", [
          { ...ref(MARKET, "buyMarkup", "MARKET", "Buy price × sell price", "Buying a pack costs this many times what selling it gives"), step: STEP.decimal },
        ]),
        ...MARKET_GOODS.map((good, index) =>
          tuned(RESOURCES[good.id].name, [
            { ...ref(good, "pack", `MARKET_GOODS[${index}]`, `Pack (${RESOURCES[good.id].unit})`, "How much goes in one pack"), step: STEP.decimal },
            { ...ref(good, "price", `MARKET_GOODS[${index}]`, "Sell price (beer)", "Beer selling a pack gives"), step: STEP.decimal },
          ]),
        ),
      ],
    );
    tunePage(
      "tune",
      "smelter",
      "Smelter",
      "The smelter works through its orders batch by batch: each recipe has its own time, and the furnace burns coal per game hour while working.",
      () => [
        tuned("Smelter", [{ ...ref(SMELTER, "coalPerHour", "SMELTER", "Coal per hour", "Kg of coal the furnace burns in 1 game hour of work"), step: STEP.decimal }]),
        ...RECIPE_IDS.flatMap((id) => {
          const recipe = RECIPES[id];
          const path = `RECIPES[${RecipeID[id]}]`;
          const refs: Ref[] = [
            { ...ref(recipe, "hours", path, "Hours a batch", "Game hours it takes to smelt one batch"), step: STEP.decimal },
          ];
          const main = recipe.output.main;
          if (main) {
            const slot = {
              get yield() {
                return recipe.output.main?.amount[0] ?? 0;
              },
              set yield(value: number) {
                recipe.output = always(main.id, value);
              },
            };
            refs.push({
              owner: slot,
              key: "yield",
              path: `${path}.output`,
              label: `${RESOURCES[main.id].name} a batch`,
              hint: `${RESOURCES[main.id].unit} of output a batch gives`,
              step: STEP.decimal,
            });
          }
          return [
            tuned("Recipe", refs, undefined, recipe.name),
            costSection("Inputs", recipe.input, `${path}.input`, recipe.name),
          ];
        }),
      ],
    );
  }

  private campPages() {
    tunePage("tune", "tavern", "Tavern", "Where new dwarfs apply and wait to be hired.", () => [
      tuned("Tavern", [
        ref(TAVERN, "applications", "TAVERN", "Most applications", "Applicants waiting at once, no new ones past it"),
        ref(TAVERN, "perDay", "TAVERN", "New a day", "Applicants arriving each day"),
        ref(TAVERN, "arrivalHour", "TAVERN", "Arrive at hour", "Game hour the day's applicants come", [0, CALENDAR.hoursPerDay - 1, 1]),
        {
          owner: TAVERN.hireCost,
          key: String(ResourcesID.beer),
          path: "TAVERN.hireCost[beer]",
          label: "Hire cost (beer)",
          hint: "Beer a new dwarf costs to hire",
        },
      ]),
    ]);
    tunePage(
      "tune",
      "headquarters",
      "Headquarters",
      "The camp's main building and its store. Each level costs its price and deepens the shaft; the Party sends beer every day until the mine stands on its own; the daily stone shipment sells the camp's stone for beer.",
      () => [
        ...HEADQUARTERS.levels.flatMap((level, index) => {
          const title = `Level ${index + 1}`;
          const shaft = tuned(
            index > 0 ? "Shaft" : title,
            [ref(level, "shaft", `HEADQUARTERS.levels[${index}]`, "Shaft depth (tiles)", "How deep the shaft reaches at this level")],
            undefined,
            index > 0 ? title : undefined,
          );
          if (index === 0) return [shaft];
          return [shaft, costSection("Cost", (level.cost ??= {}), `HEADQUARTERS.levels[${index}].cost`, title)];
        }),
        tuned("Party subsidy", [
          ref(HEADQUARTERS.subsidy, "hour", "HEADQUARTERS.subsidy", "At hour", "Game hour the beer arrives"),
          ref(HEADQUARTERS.subsidy, "beer", "HEADQUARTERS.subsidy", "Beer", "Beer it brings each day"),
          ref(HEADQUARTERS.subsidy, "untilLevel", "HEADQUARTERS.subsidy", "Until level", "It stops once the headquarters reach this level"),
        ]),
        tuned("Daily stone shipment", [
          ref(HEADQUARTERS.shipment, "hour", "HEADQUARTERS.shipment", "At hour", "Game hour the shipment leaves"),
          ref(HEADQUARTERS.shipment, "stone", "HEADQUARTERS.shipment", "Stone", "Kg of stone that sell for the beer below"),
          ref(HEADQUARTERS.shipment, "beer", "HEADQUARTERS.shipment", "Beer for it", "Beer that much stone sells for"),
          ref(HEADQUARTERS.shipment, "step", "HEADQUARTERS.shipment", "Window step (kg)", "How much one click changes the daily amount and the reserve in the headquarters window"),
        ]),
      ],
    );
    tunePage("tune", "stations", "Stations & shifts", "Ordering dwarfs to the mine's stations, and how long they work there.", () => [
      tuned("Stations", [
        ref(STATION, "manualLimit", "STATION", "Most dwarfs", "Most dwarfs ordered to one station at once (working, waiting or on the way)"),
        ref(STATION, "spacing", "STATION", "Spacing (tiles)", "Least distance between two stations"),
      ]),
      tuned("Shift (game hours)", [
        ref(STATION.shift, "min", "STATION.shift", "Shortest"),
        ref(STATION.shift, "max", "STATION.shift", "Longest"),
        ref(STATION.shift, "start", "STATION.shift", "Ordered by default"),
      ]),
    ]);
    tunePage("tune", "structures", "Structures", "How much the mine's structures take before they break.", () => [
      tuned("Durability", [
        ref(STRUCTURES.rails, "durability", "STRUCTURES.rails", "Rail", "Damage a rail tile takes before it breaks"),
        ref(STRUCTURES.palisade, "hp", "STRUCTURES.palisade", "Palisade", "Hits a palisade takes"),
        ref(STRUCTURES.metalPalisade, "hp", "STRUCTURES.metalPalisade", "Metal palisade", "Hits a metal palisade takes"),
      ]),
      tuned("Building", [
        ref(STRUCTURES.buildings, "maxDepth", "STRUCTURES.buildings", "Deepest building (tiles)", "How deep under the surface a building may stand"),
      ]),
    ]);
    tunePage("tune", "time", "Time", "How fast the game's clock runs.", () => [
      tuned("Calendar", [
        ref(CALENDAR, "hourLength", "CALENDAR", "Hour length (s)", "Real seconds a game hour lasts at speed 1"),
        ref(CALENDAR, "startHour", "CALENDAR", "Start hour", "Game hour a new game starts at", [0, CALENDAR.hoursPerDay - 1, 1]),
      ]),
    ]);
  }

  private flightPages() {
    tunePage(
      "tune",
      "ball",
      "Ball",
      "A dwarf shot from a station flies as a ball: the sling sets its speed and direction, it bounces off rock and slows back to its own speed.",
      () => [
        tuned("Flight", [
          ref(BALL, "pixelsPerSpeed", "BALL", "Px a second per speed", "A class's speed times this is its ball's speed"),
          ref(PHYS, "decayRate", "PHYS", "Slowing down", "How fast a boosted shot slows back to its base speed; breaking through costs no speed"),
        ]),
        tuned("Sling", [
          ref(LAUNCHER, "maxBoost", "LAUNCHER", "Strongest shot ×", "A full pull shoots at this many times the ball's speed"),
          ref(LAUNCHER.sling, "fullPull", "LAUNCHER.sling", "Full pull (px)", "How far to drag for the strongest shot"),
          ref(LAUNCHER.sling, "deadzone", "LAUNCHER.sling", "Dead zone (px)", "A drag shorter than this shoots nothing"),
          { ...ref(LAUNCHER, "shotCone", "LAUNCHER", "Shot cone", "Most a shot may tilt up or down from level"), angle: true },
        ]),
      ],
    );
    tunePage("tune", "transport", "Transport", "How fast dwarfs and cargo move around the mine, in tiles a second.", () => [
      tuned("Speed (tiles a second)", [
        ref(TRAVEL, "walk", "TRAVEL", "Walking", "On foot: out of buildings, to and from stations"),
        ref(TRAVEL, "lane", "TRAVEL", "Shaft lane", "Up and down the shaft"),
        ref(TRAVEL, "rail", "TRAVEL", "Rails"),
        ref(TRAVEL, "tunnel", "TRAVEL", "Tunnels"),
      ]),
      tuned("Leaving", [ref(TRAVEL, "leaveGap", "TRAVEL", "Gap between rides (s)", "Seconds between two rides leaving one station")]),
    ]);
    page("tune", "ui", "UI", "Fonts used across the UI.", () => [
      values("Fonts", "ui.font", [
        {
          key: "body",
          label: "Body font",
          control: control.select(UI_FONTS),
          get: () => UI_THEME.font.body,
          set: (next) => swapFont("body", String(next)),
        },
        {
          key: "display",
          label: "Display font",
          control: control.select(UI_FONTS),
          get: () => UI_THEME.font.display,
          set: (next) => swapFont("display", String(next)),
        },
      ]),
    ]);
  }

  private reports() {
    debug.game.connect("economy", () => ({
      market: MARKET_GOODS.map((good) => ({
        good: RESOURCES[good.id].name,
        pack: formatAmount(good.id, good.pack),
        sell: amountText(ResourcesID.beer, good.price),
        buy: amountText(ResourcesID.beer, buyPrice(good)),
      })),
      recipes: RECIPE_IDS.map((id) => ({
        name: RECIPES[id].name,
        takes: costText(recipeCost(id)),
        gives: describeResourceDrop(RECIPES[id].output),
        hours: RECIPES[id].hours,
      })),
      costs: [
        ...IDS.build.map((id) => ({ name: BUILD_ELEMENTS[id].title, cost: costText(BUILD_ELEMENTS[id].cost) })),
        ...HEADQUARTERS.levels.flatMap((level, index) =>
          level.cost ? [{ name: `Headquarters level ${index + 1}`, cost: costText(level.cost) }] : [],
        ),
        { name: "Hire a dwarf", cost: costText(TAVERN.hireCost) },
      ],
    }));
  }
}

function swapFont(slot: "body" | "display", next: string) {
  const prev = UI_THEME.font[slot];
  if (prev === next) return;
  UI_THEME.font[slot] = next;
  Navi.root.forEachDescendant((node) => {
    if (node.style.textFont === prev) node.style.textFont = next;
  });
  Navi.markLayoutDirty();
}
