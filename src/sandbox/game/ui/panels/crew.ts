import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto } from "@navi/units";
import { assert } from "@axiom/utils";
import type Dwarf from "../../actors/dwarf";
import Drinker from "../../components/dwarfs/drinker";
import Effects from "../../components/dwarfs/effects";
import Equipment from "../../components/dwarfs/equipment";
import LayeredSprite from "../../components/common/layeredSprite";
import Morale from "../../components/dwarfs/morale";
import Outfit from "../../components/dwarfs/outfit";
import Shift from "../../components/dwarfs/shift";
import Traits from "../../components/dwarfs/traits";
import { SPECIAL_BEERS } from "../../content/beers";
import { BASE_GEAR, BaseGearID, GEAR_SLOT_NAMES, ITEMS } from "../../content/gear";
import { FOREMAN_TRAIT, MAIN_TRAITS, TRAITS, TraitsID, WORKER_TRAITS, type TraitData } from "../../content/traits";
import { UI_THEME } from "../../content/ui";
import { CALENDAR } from "../../systems/core/calendar";
import type GameUI from "../../systems/ui/gameUI";
import type { PanelDef } from "../../systems/ui/gameUI";
import type Roster from "../../systems/dwarfs/roster";
import type { DwarfState } from "../../systems/dwarfs/roster";
import type Workforce from "../../systems/dwarfs/workforce";
import { bar } from "../elements/bar";
import { button } from "../elements/button";
import { column } from "../elements/column";
import { dropdown, type DropdownItem } from "../elements/dropdown";
import { portrait } from "../elements/portrait";
import { row } from "../elements/row";
import { table, tableWindowWidth, type TableColumn, type UITable } from "../elements/table";
import { tabs, type TabItem } from "../elements/tabs";
import { text } from "../elements/text";
import { tooltip } from "../elements/tooltip";

const CREW_UI = {
  listHeight: 420,
  portraitSize: 32,
  moraleWidth: 84,
  chipPadding: { top: 2, right: 5, bottom: 2, left: 5 },
  chipTextSize: 11,
  columns: [
    { title: "", width: 32 },
    { title: "Name", width: 130 },
    { title: "Class", width: 96 },
    { title: "State", width: 148 },
    { title: "Shift", width: 52, align: "end" },
    { title: "DMG", width: 52, align: "end" },
    { title: "SPD", width: 48, align: "end" },
    { title: "BPH", width: 54, align: "end" },
    { title: "Morale", width: 84, align: "center" },
    { title: "Traits", width: 134 },
    { title: "Gear / Beer", width: 116 },
    { title: "", width: 56, align: "end" },
  ] as TableColumn[],
  assignColumns: [
    { title: "Class", width: 160 },
    { title: "Gear", width: 240 },
    { title: "Effects", width: 420 },
  ] as TableColumn[],
  assignDropdownWidth: 220,
};

// Object.keys gives enum numbers as strings
const BASE_GEAR_IDS = Object.keys(BASE_GEAR).map(Number) as BaseGearID[];

type CrewTab = "all" | "working" | "tavern" | "tired" | "assign";
type SortKey = "name" | "damage" | "speed" | "bph" | "morale" | "state";

const TABS: TabItem<CrewTab>[] = [
  { id: "all", title: "All" },
  { id: "working", title: "Working" },
  { id: "tavern", title: "Tavern" },
  { id: "tired", title: "Tired" },
  { id: "assign", title: "Assign" },
];

const SORT_ITEMS: { id: SortKey; title: string }[] = [
  { id: "name", title: "Sort: Name" },
  { id: "damage", title: "Sort: DMG" },
  { id: "speed", title: "Sort: SPD" },
  { id: "bph", title: "Sort: BPH" },
  { id: "morale", title: "Sort: Morale" },
  { id: "state", title: "Sort: State" },
];

const STATE_LABELS: Record<DwarfState, string> = {
  tavern: "Tavern",
  travelling: "On the way",
  waiting: "Waiting",
  working: "Working",
  returning: "Returning",
};

const STATE_ORDER: Record<DwarfState, number> = {
  working: 0,
  waiting: 1,
  travelling: 2,
  returning: 3,
  tavern: 4,
};

function roundOne(value: number) {
  return `${Math.round(value * 10) / 10}`;
}

function formatHour(hour: number | undefined) {
  if (hour === undefined) return "—";
  return `${String(Math.floor(hour) % CALENDAR.hoursPerDay).padStart(2, "0")}:00`;
}

function shortCode(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function describeTrait(data: TraitData, hours?: number) {
  const heading = hours === undefined ? data.name : `${data.name} (${hours}h left)`;
  const parts = [heading, data.description];
  for (const effect of data.effects) parts.push(`• ${effect.describe()}`);
  return parts.join("\n");
}

function traitsOf(dwarf: Dwarf) {
  const traits = dwarf.getComponent(Traits);
  assert(traits !== undefined, `Dwarf ${dwarf.name} has no Traits`);
  return traits;
}

function effectsOf(dwarf: Dwarf) {
  const effects = dwarf.getComponent(Effects);
  assert(effects !== undefined, `Dwarf ${dwarf.name} has no Effects`);
  return effects;
}

function moraleOf(dwarf: Dwarf) {
  const morale = dwarf.getComponent(Morale);
  assert(morale !== undefined, `Dwarf ${dwarf.name} has no Morale`);
  return morale;
}

function drinkerOf(dwarf: Dwarf) {
  const drinker = dwarf.getComponent(Drinker);
  assert(drinker !== undefined, `Dwarf ${dwarf.name} has no Drinker`);
  return drinker;
}

function shiftOf(dwarf: Dwarf) {
  const shift = dwarf.getComponent(Shift);
  assert(shift !== undefined, `Dwarf ${dwarf.name} has no Shift`);
  return shift;
}

function stateText(roster: Roster, dwarf: Dwarf) {
  const state = roster.stateOf(dwarf);
  const station = roster.stationOf(dwarf);
  return station ? `${STATE_LABELS[state]} · ${station.name}` : STATE_LABELS[state];
}

function gearSummary(dwarf: Dwarf) {
  const traits = traitsOf(dwarf);
  const drinker = drinkerOf(dwarf);
  const beer = drinker.specialBeer === undefined ? "" : ` + ${SPECIAL_BEERS[drinker.specialBeer].name}`;
  if (traits.foreman) {
    const equipment = dwarf.getComponent(Equipment);
    assert(equipment !== undefined, `Foreman ${dwarf.name} has no Equipment`);
    return `${equipment.list.size}/4 items${beer}`;
  }
  const outfit = dwarf.getComponent(Outfit);
  assert(outfit !== undefined, `Worker ${dwarf.name} has no Outfit`);
  const worn = outfit.worn;
  if (!worn) return `None${beer}`;
  return `${BASE_GEAR[worn.gear].name.replace(" Gear", "")} L${worn.level}${beer}`;
}

function gearTooltip(dwarf: Dwarf) {
  const traits = traitsOf(dwarf);
  const lines: string[] = [];
  if (traits.foreman) {
    const equipment = dwarf.getComponent(Equipment);
    assert(equipment !== undefined, `Foreman ${dwarf.name} has no Equipment`);
    if (equipment.list.size === 0) lines.push("No items equipped");
    for (const [slot, itemId] of equipment.list) {
      const item = ITEMS[itemId];
      lines.push(`${GEAR_SLOT_NAMES[slot]}: ${item.name}`);
      for (const effect of item.effects) lines.push(`  • ${effect.describe()}`);
    }
  } else {
    const outfit = dwarf.getComponent(Outfit);
    assert(outfit !== undefined, `Worker ${dwarf.name} has no Outfit`);
    const worn = outfit.worn;
    if (!worn) lines.push("No standard gear worn yet");
    else {
      const data = BASE_GEAR[worn.gear];
      lines.push(`${data.name} (Level ${worn.level})`);
      for (const effect of data.levels[worn.level - 1]) lines.push(`  • ${effect.describe()}`);
    }
  }
  const beer = drinkerOf(dwarf).specialBeer;
  if (beer !== undefined) {
    const data = SPECIAL_BEERS[beer];
    lines.push(`Beer: ${data.name}`);
    for (const effect of data.effects) lines.push(`  • ${effect.describe()}`);
  }
  return lines.join("\n");
}

function traitChip(parent: UINode, label: string, color: RGBA, tip: () => string) {
  const chip = Navi.append(
    new UINode({
      size: { width: auto(), height: auto() },
      style: {
        backgroundColor: color,
        padding: CREW_UI.chipPadding,
        layout: "stack",
        alignMain: "center",
        alignCross: "center",
      },
    }),
    parent,
  );
  text(chip, label, { size: CREW_UI.chipTextSize, color: UI_THEME.paper.inkCream });
  tooltip(chip, tip);
}

function buildTraitChips(cell: UINode, dwarf: Dwarf, workforce: Workforce) {
  const traits = traitsOf(dwarf);
  const holder = row(cell, { fit: true });
  let count = 0;
  if (traits.foreman) {
    traitChip(holder, "FM", UI_THEME.colors.selected, () => describeTrait(FOREMAN_TRAIT));
    count++;
  }
  for (const id of traits.list) {
    const data = TRAITS[id];
    const color = id === TraitsID.tired ? UI_THEME.colors.lacking : UI_THEME.colors.rowHover;
    traitChip(holder, shortCode(data.name), color, () => describeTrait(data, traits.hoursOf(id)));
    count++;
  }
  if (!traits.foreman) {
    for (const id of workforce.researched) {
      const data = WORKER_TRAITS[id];
      traitChip(holder, shortCode(data.name), UI_THEME.colors.barFill, () => describeTrait(data));
      count++;
    }
  }
  if (count === 0) text(holder, "—", { color: UI_THEME.colors.muted });
}

export function crewPanel(roster: Roster, workforce: Workforce, gameUI: GameUI): PanelDef {
  let tab: CrewTab = "all";
  let sortBy: SortKey = "name";
  let descending = false;
  let sortRow: UINode | undefined;
  let rosterView: UINode | undefined;
  let assignView: UINode | undefined;
  let list: UITable | undefined;
  let empty: UINode | undefined;
  let lastKey = "";
  let lastAssignVersion = -1;

  function filtered() {
    const all = roster.dwarfs;
    if (tab === "working") return all.filter((dwarf) => roster.stateOf(dwarf) !== "tavern");
    if (tab === "tavern") return all.filter((dwarf) => roster.stateOf(dwarf) === "tavern");
    if (tab === "tired") return all.filter((dwarf) => traitsOf(dwarf).has(TraitsID.tired));
    return [...all];
  }

  function sorted(dwarfs: Dwarf[]) {
    const direction = descending ? -1 : 1;
    return dwarfs.sort((first, second) => {
      if (sortBy === "name") return first.name.localeCompare(second.name) * direction;
      if (sortBy === "damage") return (effectsOf(first).power - effectsOf(second).power) * direction;
      if (sortBy === "speed") return (effectsOf(first).speed - effectsOf(second).speed) * direction;
      if (sortBy === "bph") return (effectsOf(first).bph - effectsOf(second).bph) * direction;
      if (sortBy === "morale") return (moraleOf(first).value - moraleOf(second).value) * direction;
      return (STATE_ORDER[roster.stateOf(first)] - STATE_ORDER[roster.stateOf(second)]) * direction;
    });
  }

  function listSignature() {
    const items = sorted(filtered());
    const traitsKey = items.map((dwarf) => `${dwarf.ID.description}:${[...traitsOf(dwarf).list].join(".")}`).join(",");
    return `${tab}|${sortBy}|${descending}|${roster.moraleOn}|${workforce.version}|${traitsKey}`;
  }

  function rebuildRows() {
    if (!list) return;
    lastKey = listSignature();
    Navi.clear(list.body);
    const items = sorted(filtered());
    empty?.setActive(items.length === 0);
    for (const dwarf of items) addDwarfRow(list, dwarf);
  }

  function addDwarfRow(target: UITable, dwarf: Dwarf) {
    const sprite = dwarf.getComponent(LayeredSprite);
    assert(sprite !== undefined, `Dwarf ${dwarf.name} has no LayeredSprite`);
    const traits = traitsOf(dwarf);
    const effects = effectsOf(dwarf);
    const main = MAIN_TRAITS[traits.main];
    const kindLabel = traits.foreman ? `${main.name} (F)` : main.name;
    target.row([
      { build: (cell) => portrait(cell, sprite.layers, CREW_UI.portraitSize) },
      dwarf.name,
      {
        build: (cell) => {
          const label = text(cell, kindLabel);
          tooltip(label, () => describeTrait(main));
        },
      },
      () => stateText(roster, dwarf),
      () => formatHour(shiftOf(dwarf).endsAt),
      () => roundOne(effects.power),
      () => roundOne(effects.speed),
      () => `${roundOne(effects.bph)} L`,
      {
        build: (cell) => {
          if (!roster.moraleOn) {
            text(cell, "—", { color: UI_THEME.colors.muted });
            return;
          }
          const morale = moraleOf(dwarf);
          const meter = bar(cell, {
            width: CREW_UI.moraleWidth,
            value: () => {
              const max = Math.max(morale.range.max, 1);
              return morale.value / max;
            },
            label: () => `${Math.round(morale.value)}`,
          });
          tooltip(meter, () => {
            const range = morale.range;
            return `Morale: ${Math.round(morale.value)} / ${Math.round(range.max)} (min ${Math.round(range.min)})`;
          });
        },
      },
      { build: (cell) => buildTraitChips(cell, dwarf, workforce) },
      {
        build: (cell) => {
          const label = text(cell, () => gearSummary(dwarf), { color: UI_THEME.colors.muted });
          tooltip(label, () => gearTooltip(dwarf));
        },
      },
      {
        build: (cell) =>
          button(cell, "Card", () => {
            gameUI.close("crew");
            roster.showCard(dwarf, () => gameUI.open("crew"));
          }),
      },
    ]);
  }

  function summaryText() {
    const counts = roster.counts();
    const total = roster.dwarfs.length;
    const active = total - counts.tavern;
    let activeBph = 0;
    let totalDamage = 0;
    for (const dwarf of roster.dwarfs) {
      const effects = effectsOf(dwarf);
      totalDamage += effects.power;
      if (roster.stateOf(dwarf) === "working") activeBph += effects.bph;
    }
    const averageDamage = total > 0 ? roundOne(totalDamage / total) : "0";
    return `Crew: ${total} · Active: ${active} · Tavern: ${counts.tavern} · Working BPH: ${roundOne(activeBph)} L/h · Avg DMG: ${averageDamage}`;
  }

  function gearEffectsText(gear: BaseGearID | undefined) {
    if (gear === undefined) return "None";
    const level = workforce.level(gear);
    const effects = BASE_GEAR[gear].levels[level - 1] ?? [];
    if (effects.length === 0) return "No bonuses";
    return effects.map((effect) => effect.describe()).join(", ");
  }

  function rebuildAssign() {
    if (!assignView) return;
    lastAssignVersion = workforce.version;
    Navi.clear(assignView);
    text(assignView, "Standard gear worn by each worker class on their next shift", {
      color: UI_THEME.colors.muted,
    });
    const gearItems: DropdownItem<BaseGearID>[] = BASE_GEAR_IDS.map((gear) => {
      const level = workforce.level(gear);
      const locked = !workforce.isUnlocked(gear);
      return {
        id: gear,
        title: locked ? `${BASE_GEAR[gear].name} (Locked)` : `${BASE_GEAR[gear].name} Lv.${level}`,
        locked: locked,
      };
    });
    const assignTable = table(assignView, CREW_UI.assignColumns);
    for (const main of roster.recruitable()) {
      const mainData = MAIN_TRAITS[main];
      const assigned = workforce.assignments.get(main) ?? BaseGearID.universal;
      assignTable.row([
        {
          build: (cell) => {
            const label = text(cell, mainData.name);
            tooltip(label, () => describeTrait(mainData));
          },
        },
        {
          build: (cell) => {
            dropdown(
              cell,
              gearItems,
              assigned,
              (picked) => {
                workforce.assign(main, picked);
                workforce.touch();
                rebuildAssign();
              },
              { width: CREW_UI.assignDropdownWidth },
            );
          },
        },
        () => gearEffectsText(workforce.assignments.get(main)),
      ]);
    }
  }

  function showTab() {
    const isAssign = tab === "assign";
    sortRow?.setActive(!isAssign);
    rosterView?.setActive(!isAssign);
    assignView?.setActive(isAssign);
    if (isAssign) rebuildAssign();
    else rebuildRows();
  }

  return {
    id: "crew",
    title: "Crew",
    label: "Crew",
    bar: "top",
    width: tableWindowWidth(CREW_UI.columns),
    badge: () => roster.tiredCount,
    onClose() {
      sortRow = undefined;
      rosterView = undefined;
      assignView = undefined;
      list = undefined;
      empty = undefined;
      lastKey = "";
      lastAssignVersion = -1;
    },
    build(content) {
      tabs(content, TABS, () => tab, (picked) => {
        tab = picked;
        showTab();
      });
      const controls = row(content, { align: "between" });
      text(controls, summaryText, { color: UI_THEME.colors.muted });
      sortRow = row(controls, { fit: true });
      dropdown(sortRow, SORT_ITEMS, sortBy, (picked) => {
        sortBy = picked;
        rebuildRows();
      });
      button(sortRow, () => (descending ? "Desc" : "Asc"), () => {
        descending = !descending;
        rebuildRows();
      });
      rosterView = column(content);
      list = table(rosterView, CREW_UI.columns, { height: CREW_UI.listHeight });
      empty = text(rosterView, "No dwarfs match this filter", { color: UI_THEME.colors.muted });
      assignView = column(content);
      showTab();
    },
    update() {
      if (tab === "assign") {
        if (assignView && workforce.version !== lastAssignVersion) rebuildAssign();
        return;
      }
      if (list && listSignature() !== lastKey) rebuildRows();
    },
  };
}
