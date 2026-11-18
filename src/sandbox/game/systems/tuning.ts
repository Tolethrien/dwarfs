import PragmaSystem from "@pragma/system";
import { debug } from "@debug";
import { gamePanel } from "../debugCommands";
import type Effect from "../effects/effect";
import { BLOCKS, BlocksID } from "../content/blocks";
import { BUFFS } from "../content/buffs";
import { SPECIAL_BEERS } from "../content/beers";
import { BASE_GEAR, ITEMS } from "../content/gear";
import { RESOURCE_IDS, RESOURCES, type ResourcesID } from "../content/resources";
import { FOREMAN_TRAIT, MAIN_TRAITS, TRAITS, WORKER_TRAITS } from "../content/traits";
import { MARKET_GOODS } from "../content/market";
import { RECIPE_IDS, RECIPES, RecipeID } from "../content/smelter";
import { SMELTER } from "../components/smelter";
import Buffs from "./buffs";
import Workforce from "./workforce";

const TUNING = { step: 0.1 };

type Section = Parameters<typeof debug.tweak.register>[1]["sections"][number];
type Numbers = Record<string, number>;

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
  const stat = (effect as unknown as { stat?: string }).stat;
  return `${owner} · ${effect.constructor.name}${stat ? ` ${stat}` : ""}`;
}

export default class Tuning extends PragmaSystem {
  declare private workforce: Workforce;
  declare private buffs: Buffs;

  awake(): void {
    this.workforce = this.scene.getSystem(Workforce);
    this.buffs = this.scene.getSystem(Buffs);
    this.traitsPanel();
    this.beersPanel();
    this.buffsPanel();
    this.gearPanel();
    this.economyPanel();
    this.tradePanel();
  }

  private touch() {
    this.workforce.touch();
    this.buffs.touch();
  }

  private section(title: string, call: string, refs: NumberRef[]): Section | undefined {
    if (refs.length === 0) return undefined;
    const defaults: Numbers = {};
    for (const ref of refs) defaults[ref.key] = ref.owner[ref.name] as number;
    return {
      title: title,
      call: call,
      arg: "object",
      fields: refs.map((ref) => ({ key: ref.key, control: { kind: "number", step: TUNING.step } })),
      defaults: defaults,
      get: () => Object.fromEntries(refs.map((ref) => [ref.key, ref.owner[ref.name]])),
      set: (values) => {
        for (const ref of refs) {
          const value = values[ref.key];
          if (typeof value === "number" && Number.isFinite(value)) ref.owner[ref.name] = value;
        }
        this.touch();
      },
      format: (values) => `// ${title}: ${Object.entries(values).map(([key, value]) => `${key} ${value}`).join(", ")}`,
    };
  }

  private entry(title: string, data: object, effects: readonly Effect[]) {
    const sections = [this.section(`${title} · stats`, title, numberRefs(data))];
    for (const effect of effects) sections.push(this.section(effectTitle(title, effect), title, numberRefs(effect)));
    return sections.filter((section) => section !== undefined);
  }

  private traitsPanel() {
    const sections: Section[] = [];
    for (const data of Object.values(MAIN_TRAITS)) sections.push(...this.entry(data.name, data, data.effects));
    sections.push(...this.entry(FOREMAN_TRAIT.name, {}, FOREMAN_TRAIT.effects));
    for (const data of Object.values(TRAITS)) sections.push(...this.entry(data.name, {}, data.effects));
    for (const data of Object.values(WORKER_TRAITS)) sections.push(...this.entry(data.name, {}, data.effects));
    gamePanel("tuneTraits", { title: "Tune: traits", sections: sections });
  }

  private beersPanel() {
    const sections: Section[] = [];
    for (const data of Object.values(SPECIAL_BEERS)) sections.push(...this.entry(data.name, {}, data.effects));
    gamePanel("tuneBeers", { title: "Tune: special beers", sections: sections });
  }

  private buffsPanel() {
    const sections: Section[] = [];
    for (const data of Object.values(BUFFS)) sections.push(...this.entry(data.name, data, data.effects));
    gamePanel("tuneBuffs", { title: "Tune: buffs", sections: sections });
  }

  private gearPanel() {
    const sections: Section[] = [];
    for (const data of Object.values(ITEMS)) sections.push(...this.entry(data.name, {}, data.effects));
    for (const gear of Object.values(BASE_GEAR))
      gear.levels.forEach((effects, index) =>
        sections.push(...this.entry(`${gear.name} · level ${index + 1}`, {}, effects)),
      );
    gamePanel("tuneGear", { title: "Tune: gear", sections: sections });
  }

  private economyPanel() {
    const blocks = Object.keys(BLOCKS).map(Number) as BlocksID[];
    const dropRefs = blocks.flatMap((id) => {
      const drop = BLOCKS[id].drops;
      return drop ? [{ key: BlocksID[id], owner: drop as unknown as Record<string, unknown>, name: "amount" }] : [];
    });
    const amounts = this.section("Drop amounts", "BLOCKS.<block>.drops.amount", dropRefs);
    const strengthRefs = blocks
      .filter((id) => BLOCKS[id].solid && Number.isFinite(BLOCKS[id].str) && BLOCKS[id].str > 0)
      .map((id) => ({ key: BlocksID[id], owner: BLOCKS[id] as unknown as Record<string, unknown>, name: "str" }));
    const strength = this.section("Block strength", "BLOCKS.<block>.str", strengthRefs);
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
    gamePanel("tuneEconomy", { title: "Tune: mining", sections: sections });
  }

  private tradePanel() {
    const goodRefs = (name: "price" | "pack") =>
      MARKET_GOODS.map((good) => ({ key: RESOURCES[good.id].name, owner: good as unknown as Record<string, unknown>, name: name }));
    const sections = [
      this.section("Market prices (beer a pack)", "MARKET_GOODS.<good>.price", goodRefs("price")),
      this.section("Market packs", "MARKET_GOODS.<good>.pack", goodRefs("pack")),
      this.section("Smelter", "SMELTER", numberRefs(SMELTER)),
      ...RECIPE_IDS.map((id) => this.section(`Recipe · ${RECIPES[id].name}`, `RECIPES.${RecipeID[id]}`, numberRefs(RECIPES[id]))),
    ].filter((section) => section !== undefined);
    gamePanel("tuneTrade", { title: "Tune: market & smelter", sections: sections });
  }
}
