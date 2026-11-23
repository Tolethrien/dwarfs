import PragmaSystem from "@pragma/system";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import type Dwarf from "../../game/actors/dwarf";
import Traits from "../../game/components/dwarfs/traits";
import Effects from "../../game/components/dwarfs/effects";
import Drinker from "../../game/components/dwarfs/drinker";
import Shift from "../../game/components/dwarfs/shift";
import Equipment from "../../game/components/dwarfs/equipment";
import { MAIN_TRAITS, TRAITS, WORKER_IDS, WORKER_TRAITS, type MainTraitsID, type TraitsID } from "../../game/content/traits";
import { SPECIAL_BEERS } from "../../game/content/beers";
import { BASE_GEAR, GEAR_SLOT_NAMES, GEAR_SLOTS, ITEMS, type BaseGearID, type GearSlot, type ItemID } from "../../game/content/gear";
import { BUFFS, type BuffID } from "../../game/content/buffs";
import { DwarfRank } from "../../game/content/dwarfs";
import { STAT_NAMES, STATS } from "../../game/effects/effect";
import Roster, { type DwarfGroup } from "../../game/systems/dwarfs/roster";
import Workforce from "../../game/systems/dwarfs/workforce";
import Buffs from "../../game/systems/dwarfs/buffs";
import Calendar from "../../game/systems/core/calendar";
import { action, choice, control, idsOf, page, values, type Value } from "../pages";

const CREW = {
  ranks: ["worker", "foreman"],
  none: "—",
  groups: ["all", "mine"] as DwarfGroup[],
  morale: { max: 100, step: 5 },
};

const IDS = {
  classes: idsOf<MainTraitsID>(MAIN_TRAITS),
  gear: idsOf<BaseGearID>(BASE_GEAR),
  traits: idsOf<TraitsID>(TRAITS),
  items: idsOf<ItemID>(ITEMS),
  buffs: idsOf<BuffID>(BUFFS),
};

const CHOICE = {
  classes: choice(IDS.classes, (id) => MAIN_TRAITS[id].name),
  traits: choice(IDS.traits, (id) => TRAITS[id].name),
  items: choice(IDS.items, (id) => ITEMS[id].name),
  slots: choice(GEAR_SLOTS, (slot) => GEAR_SLOT_NAMES[slot]),
  groups: choice(CREW.groups, (group) => String(group)),
};

export default class CrewDebug extends PragmaSystem {
  // what "Spawn" makes, and every new dwarf while apply is on
  private readonly template = {
    apply: false,
    main: IDS.classes[0],
    foreman: false,
    traits: new Set<TraitsID>(),
    items: new Map<GearSlot, ItemID>(),
  };
  declare private roster: Roster;
  declare private workforce: Workforce;
  declare private buffs: Buffs;
  declare private calendar: Calendar;

  awake(): void {
    this.roster = this.scene.getSystem(Roster);
    this.workforce = this.scene.getSystem(Workforce);
    this.buffs = this.scene.getSystem(Buffs);
    this.calendar = this.scene.getSystem(Calendar);
    this.reports();
    this.spawnPage();
    this.dwarfPage();
    this.moralePage();
    this.buffsPage();
    this.workforcePage();
  }

  private reports() {
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
        researched: this.workforce.isResearched(id),
      })),
    }));
    debug.game.connect("buffs", () => ({
      totals: STATS.filter((stat) => this.buffs.stats[stat].add !== 0 || this.buffs.stats[stat].multiply !== 1).map(
        (stat) => {
          const modifiers = this.buffs.stats[stat];
          const sign = modifiers.add >= 0 ? "+" : "";
          return { stat: STAT_NAMES[stat], text: `${sign}${modifiers.add} ×${Math.round(modifiers.multiply * 100) / 100}` };
        },
      ),
      active: [...this.buffs.list].map(([id, hoursLeft]: [BuffID, number]) => ({
        name: BUFFS[id].name,
        hours: BUFFS[id].hours,
        hoursLeft: hoursLeft,
      })),
    }));
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
      morale: this.roster.moraleOn ? Math.round(this.roster.moraleOf(dwarf).value) : null,
      beer: drinker.specialBeer === undefined ? null : SPECIAL_BEERS[drinker.specialBeer].name,
      speed: Math.round(effects.speed),
      power: Math.round(effects.power * 10) / 10,
      bph: Math.round(effects.bph * 10) / 10,
      traits: [...traits.list].map((trait) => TRAITS[trait].name),
      gear: equipment ? [...equipment.list.values()].map((item) => ITEMS[item].name) : [],
    };
  }

  private spawn() {
    const template = this.template;
    const dwarf = this.roster.make(template.main, template.foreman ? DwarfRank.foreman : DwarfRank.worker);
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    for (const trait of template.traits) traits.add(trait);
    if (!template.foreman) return dwarf;
    const equipment = dwarf.getComponent(Equipment);
    assert(equipment !== undefined, `Dwarf ${dwarf.name} is a foreman without Equipment`);
    for (const item of template.items.values()) equipment.equip(item);
    return dwarf;
  }

  private spawnPage() {
    const template = this.template;
    const itemsFor = (slot: GearSlot) => IDS.items.filter((id) => ITEMS[id].slot === slot);
    page("crew", "spawn", "Spawn", "Make dwarfs straight into the tavern from a template; with 'every new dwarf' on, recruits in the game come out like the template too.", () => [
      action("dwarf", "spawn", "Spawn into the tavern", [{ key: "count", control: control.number(1), value: 1 }], (args) => {
        for (let index = 0; index < Number(args.count); index++) this.roster.enlist(this.spawn());
      }),
      values("Template", "game.dwarf", [
        {
          key: "apply",
          label: "every new dwarf",
          control: control.toggle,
          get: () => template.apply,
          set: (on) => {
            template.apply = on === true;
            this.roster.createInstead = template.apply ? () => this.spawn() : undefined;
          },
        },
        {
          key: "class",
          control: CHOICE.classes.control,
          get: () => MAIN_TRAITS[template.main].name,
          set: (name) => (template.main = CHOICE.classes.id(name)),
        },
        {
          key: "rank",
          control: control.select(CREW.ranks),
          get: () => CREW.ranks[template.foreman ? 1 : 0],
          set: (rank) => (template.foreman = rank === CREW.ranks[1]),
        },
      ]),
      values(
        "Template traits",
        "game.dwarf",
        IDS.traits.map((id) => ({
          key: String(id),
          label: TRAITS[id].name,
          control: control.toggle,
          get: () => template.traits.has(id),
          set: (on) => (on === true ? template.traits.add(id) : template.traits.delete(id)),
        })),
      ),
      values(
        "Template items (foreman)",
        "game.dwarf",
        GEAR_SLOTS.map((slot) => ({
          key: String(slot),
          label: GEAR_SLOT_NAMES[slot],
          control: control.select([CREW.none, ...itemsFor(slot).map((id) => ITEMS[id].name)]),
          get: () => {
            const item = template.items.get(slot);
            return item === undefined ? CREW.none : ITEMS[item].name;
          },
          set: (name) => {
            const item = itemsFor(slot).find((id) => ITEMS[id].name === name);
            if (item === undefined) template.items.delete(slot);
            else template.items.set(slot, item);
          },
        })),
      ),
    ]);
  }

  // the dwarf select follows the roster, so the page is live
  private dwarfPage() {
    page(
      "crew",
      "dwarf",
      "Dwarf",
      "One dwarf at a time, picked from the roster (number: name), and traits for a whole group. Items fit only foremen.",
      () => {
        const dwarfs = choice(
          this.roster.dwarfs.map((_, index) => index),
          (index) => `${index}: ${this.roster.dwarfs[index].name}`,
        );
        const dwarf = { key: "dwarf", control: dwarfs.control, value: dwarfs.names[0] };
        const of = (args: Record<string, unknown>) => this.roster.dwarfs[dwarfs.id(args.dwarf)];
        return [
          action("dwarf", "card", "Show card", [dwarf], (args) => this.roster.showCard(of(args))),
          action("dwarf", "addTrait", "Add trait", [
            dwarf,
            { key: "trait", control: CHOICE.traits.control, value: CHOICE.traits.names[0] },
            { key: "hours", label: "hours (0 = for good)", control: control.number(1), value: 0 },
          ], (args) => {
            const hours = Number(args.hours);
            this.traitsOf(of(args)).add(CHOICE.traits.id(args.trait), hours > 0 ? hours : undefined);
          }),
          action("dwarf", "removeTrait", "Remove trait", [
            dwarf,
            { key: "trait", control: CHOICE.traits.control, value: CHOICE.traits.names[0] },
          ], (args) => this.traitsOf(of(args)).remove(CHOICE.traits.id(args.trait))),
          action("dwarf", "setMorale", "Set morale", [
            dwarf,
            { key: "value", control: control.slider(0, CREW.morale.max, CREW.morale.step), value: CREW.morale.max },
          ], (args) => this.roster.setMorale(of(args), Number(args.value))),
          action("dwarf", "equip", "Equip item (foreman)", [
            dwarf,
            { key: "item", control: CHOICE.items.control, value: CHOICE.items.names[0] },
          ], (args) => this.equipmentOf(of(args)).equip(CHOICE.items.id(args.item))),
          action("dwarf", "unequip", "Take item off (foreman)", [
            dwarf,
            { key: "slot", control: CHOICE.slots.control, value: CHOICE.slots.names[0] },
          ], (args) => this.equipmentOf(of(args)).unequip(CHOICE.slots.id(args.slot))),
          action("dwarf", "addTraitAll", "Add trait to a group", [
            { key: "trait", control: CHOICE.traits.control, value: CHOICE.traits.names[0] },
            { key: "group", control: CHOICE.groups.control, value: "all" },
          ], (args) => this.roster.addTraitAll(CHOICE.traits.id(args.trait), CHOICE.groups.id(args.group))),
          action("dwarf", "removeTraitAll", "Remove trait from everyone", [
            { key: "trait", control: CHOICE.traits.control, value: CHOICE.traits.names[0] },
          ], (args) => this.roster.removeTraitAll(CHOICE.traits.id(args.trait))),
        ];
      },
      true,
    );
  }

  private moralePage() {
    const group = { key: "group", control: CHOICE.groups.control, value: "all" };
    page("crew", "morale", "Morale", "Morale of the whole crew at once: Set puts it at a value, Change works as hours of work or rest would (with each dwarf's rate).", () => [
      values("State", "game.morale", [
        { key: "on", label: "morale counts", control: control.info, get: () => (this.roster.moraleOn ? "yes" : "no") },
      ]),
      action("morale", "begin", "Turn morale on", [], () => this.roster.beginMorale()),
      action("morale", "setAll", "Set for a group", [
        { key: "value", control: control.slider(0, CREW.morale.max, CREW.morale.step), value: CREW.morale.max },
        group,
      ], (args) => this.roster.setMoraleAll(Number(args.value), CHOICE.groups.id(args.group))),
      action("morale", "changeAll", "Change for a group (as an hour of work would)", [
        { key: "points", control: control.number(1), value: -10 },
        group,
      ], (args) => this.roster.changeMoraleAll(Number(args.points), CHOICE.groups.id(args.group))),
    ], true);
  }

  private buffsPage() {
    page("crew", "buffs", "Buffs", "Turn crew-wide buffs on and off; one turned on runs its full time.", () => [
      values(
        "On",
        "game.buff",
        IDS.buffs.map((id) => ({
          key: String(id),
          label: BUFFS[id].name,
          control: control.toggle,
          get: () => this.buffs.has(id),
          set: (on) => {
            if (on === true && !this.buffs.has(id)) this.buffs.add(id);
            if (on === false && this.buffs.has(id)) this.buffs.remove(id);
          },
        })),
      ),
    ], true);
  }

  private workforcePage() {
    const gear = choice(IDS.gear, (id) => BASE_GEAR[id].name);
    page("crew", "workforce", "Workforce", "Worker gear and research: the level of each gear piece, which class wears which piece, and what the AGH has researched.", () => [
      values(
        "Gear level",
        "game.workforce.setLevel",
        IDS.gear.map((id) => ({
          key: String(id),
          label: BASE_GEAR[id].name,
          control: control.slider(0, BASE_GEAR[id].levels.length, 1),
          get: () => this.workforce.level(id),
          set: (level) => this.workforce.setLevel(id, Number(level)),
        })),
      ),
      values(
        "Gear given to",
        "game.workforce.assign",
        IDS.classes.map((main): Value => ({
          key: String(main),
          label: MAIN_TRAITS[main].name,
          control: control.select([CREW.none, ...gear.names]),
          get: () => {
            const assigned = this.workforce.assignments.get(main);
            return assigned === undefined ? CREW.none : BASE_GEAR[assigned].name;
          },
          set: (name) => {
            if (name !== CREW.none) this.workforce.assign(main, gear.id(name));
          },
        })),
      ),
      values(
        "Researched",
        "game.workforce.research",
        WORKER_IDS.map((id) => ({
          key: String(id),
          label: WORKER_TRAITS[id].name,
          control: control.toggle,
          get: () => this.workforce.isResearched(id),
          set: (on) => (on === true ? this.workforce.research(id) : this.workforce.forget(id)),
        })),
      ),
    ], true);
  }

  private traitsOf(dwarf: Dwarf) {
    const traits = dwarf.getComponent(Traits);
    assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
    return traits;
  }

  private equipmentOf(dwarf: Dwarf) {
    const equipment = dwarf.getComponent(Equipment);
    assert(equipment !== undefined, `Dwarf ${dwarf.name} is no foreman, only foremen wear items`);
    return equipment;
  }
}
