import { BiomesID } from "./biomes";
import { BlocksID } from "./blocks";
import { formatAmount, RESOURCES, ResourcesID } from "./resources";
import { RecipeID, RECIPES } from "./smelter";
import { describeResourceDrop } from "../drops/resources";

export type GlossaryCategoryID = "mine" | "crew" | "structures" | "recipes" | "world";

export type GlossarySubcategoryID =
  | "blocks"
  | "resources"
  | "biomes"
  | "classes"
  | "traits"
  | "buildings"
  | "constructs"
  | "smelter"
  | "kingdom"
  | "mission";

export type GlossaryUnlock =
  | { kind: "mine"; block: BlocksID }
  | { kind: "deflect"; block: BlocksID }
  | { kind: "resource"; resource: ResourcesID }
  | { kind: "biome"; biome: BiomesID }
  | { kind: "plan"; plan: string };

export interface GlossaryCategoryData {
  id: GlossaryCategoryID;
  title: string;
}

export interface GlossarySubcategoryData {
  id: GlossarySubcategoryID;
  category: GlossaryCategoryID;
  title: string;
}

export interface GlossaryEntryData {
  id: string;
  subcategory: GlossarySubcategoryID;
  title: string;
  lore: string;
  facts?: string[];
  startsUnlocked?: boolean;
  unlock?: GlossaryUnlock;
}

export const GLOSSARY_CATEGORIES: GlossaryCategoryData[] = [
  { id: "mine", title: "Mine" },
  { id: "crew", title: "Crew" },
  { id: "structures", title: "Structures" },
  { id: "recipes", title: "Recipes" },
  { id: "world", title: "World" },
];

export const GLOSSARY_SUBCATEGORIES: GlossarySubcategoryData[] = [
  { id: "blocks", category: "mine", title: "Blocks" },
  { id: "resources", category: "mine", title: "Resources" },
  { id: "biomes", category: "mine", title: "Biomes" },
  { id: "classes", category: "crew", title: "Classes" },
  { id: "traits", category: "crew", title: "Traits" },
  { id: "buildings", category: "structures", title: "Buildings" },
  { id: "constructs", category: "structures", title: "Constructs" },
  { id: "smelter", category: "recipes", title: "Smelter" },
  { id: "kingdom", category: "world", title: "Kingdom" },
  { id: "mission", category: "world", title: "Our Mission" },
];

function smelterFacts(id: RecipeID) {
  const recipe = RECIPES[id];
  const inputs = Object.entries(recipe.input)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([resource, amount]) => {
      const resourceId = Number(resource) as ResourcesID;
      return `${formatAmount(resourceId, amount!)} ${RESOURCES[resourceId].name}`;
    });
  return [
    "Building: Smelter",
    `Input: ${inputs.join(" + ")}`,
    `Time: ${recipe.hours} h`,
    `Output: ${describeResourceDrop(recipe.output)}`,
  ];
}

// test entries to verify unlocking, unread highlights, and layout
export const GLOSSARY_ENTRIES: GlossaryEntryData[] = [
  {
    id: "block.dirt",
    subcategory: "blocks",
    title: "Dirt",
    lore: "Loose, damp earth packed near the upper crust. Even the greenest intern breaks through it without breaking a sweat.",
    facts: ["HP: 3", "Yield: none"],
    unlock: { kind: "mine", block: BlocksID.dirt },
  },
  {
    id: "block.sandstone",
    subcategory: "blocks",
    title: "Sandstone",
    lore: "Warm, layered rock just beneath the topsoil. Crumbles easily enough for early crews and yields usable stone.",
    facts: ["HP: 4.5", "Yield: 0.5 kg Stone"],
    unlock: { kind: "mine", block: BlocksID.sandstone },
  },
  {
    id: "block.stone",
    subcategory: "blocks",
    title: "Stone",
    lore: "The stubborn grey backbone of the mountain. Loud under the pick, reliable in mortar, endless in supply.",
    facts: ["HP: 6", "Yield: 0.5 kg Stone"],
    unlock: { kind: "mine", block: BlocksID.stone },
  },
  {
    id: "block.coal",
    subcategory: "blocks",
    title: "Coal Vein",
    lore: "Black seams that smoulder in the lamp-light. Without coal, the smelters go cold and the whole camp stalls.",
    facts: ["HP: 6.5", "Yield: 0.25 kg Coal"],
    unlock: { kind: "mine", block: BlocksID.coal },
  },
  {
    id: "block.iron",
    subcategory: "blocks",
    title: "Iron Ore",
    lore: "Heavy, metallic veins prized by smiths and bureaucrats alike. Tougher than plain rock — bring proper miners.",
    facts: ["HP: 7.2", "Yield: 1 kg Iron ore"],
    unlock: { kind: "mine", block: BlocksID.iron },
  },
  {
    id: "block.obsidian",
    subcategory: "blocks",
    title: "Obsidian",
    lore: "Volcanic glass cooled under immense pressure. Ordinary picks glance right off its surface with a dull spark.",
    facts: ["Indestructible", "Deflects every strike"],
    unlock: { kind: "deflect", block: BlocksID.obsidian },
  },
  {
    id: "resource.stone",
    subcategory: "resources",
    title: "Stone",
    lore: "Cut and hauled out by the tonne. Good for walls, mortar, and daily quotas shipped back to the crown.",
    facts: ["Mined from most rock types", "Can be shipped at Headquarters for beer"],
    unlock: { kind: "resource", resource: ResourcesID.stone },
  },
  {
    id: "resource.ironBars",
    subcategory: "resources",
    title: "Iron Bars",
    lore: "Smelted from raw ore and cast into stamped ingots. The real measure of a productive outpost.",
    facts: ["Produced in the Smelter", "Used for upgrades and directives"],
    unlock: { kind: "resource", resource: ResourcesID.ironBars },
  },
  {
    id: "biome.overgrown",
    subcategory: "biomes",
    title: "Overgrown Grotto",
    lore: "Subterranean pockets where damp moss and pale roots cling to the stone far below the sun.",
    facts: ["Replaces plain rock with soft Moss (HP: 2)"],
    unlock: { kind: "biome", biome: BiomesID.overgrown },
  },
  {
    id: "biome.frozen",
    subcategory: "biomes",
    title: "Frozen Depths",
    lore: "Drafty caverns coated in ancient ice. Cold enough to freeze a tankard if a shift drags on.",
    facts: ["Replaces plain rock with Ice (HP: 4)"],
    unlock: { kind: "biome", biome: BiomesID.frozen },
  },
  {
    id: "crew.intern",
    subcategory: "classes",
    title: "Intern",
    lore: "Fresh off the surface lift with a cheap pick and big ambitions. Cheap to keep in beer, slow on hard ore.",
    facts: ["Base DMG: 3", "Speed: 3", "Wage: 2 L/h"],
    startsUnlocked: true,
  },
  {
    id: "crew.miner",
    subcategory: "classes",
    title: "Miner",
    lore: "Seasoned hands who know how to read a seam and keep their footing when the tunnel shakes.",
    facts: ["Base DMG: 4", "Speed: 3", "Wage: 4 L/h"],
    startsUnlocked: true,
  },
  {
    id: "crew.pyro",
    subcategory: "classes",
    title: "Pyro",
    lore: "Smells of saltpetre and singed beard. Every swing of his pick cracks the rock around it too, so stand well back.",
    facts: ["Base DMG: 3", "Speed: 3", "Wage: 5 L/h", "Each strike also deals 3 DMG to adjacent blocks"],
    unlock: { kind: "plan", plan: "pyro" },
  },
  {
    id: "trait.tired",
    subcategory: "traits",
    title: "Tired",
    lore: "Push a dwarf past his limits and he will simply sit down with an empty mug until morale returns.",
    facts: ["Triggers below 30 morale", "Clears at 60 morale in the Tavern"],
    startsUnlocked: true,
  },
  {
    id: "structure.hq",
    subcategory: "buildings",
    title: "Headquarters",
    lore: "The administrative heart of the outpost: desks, ledgers, and the direct line to royal inspectors.",
    facts: ["Handles upgrades and shipments"],
    startsUnlocked: true,
  },
  {
    id: "structure.palisade",
    subcategory: "constructs",
    title: "Palisade",
    lore: "Timber beams wedged across a tunnel to redirect flying dwarfs and hold back unwanted guests.",
    facts: ["HP: 10", "Friendly bounces wear 1 HP regardless of DMG"],
    unlock: { kind: "plan", plan: "palisade" },
  },
  {
    id: "recipe.ironBars",
    subcategory: "smelter",
    title: "Iron Bars",
    lore: "Raw iron ore roasted with coal until the slag separates and clean metal pours into ingot moulds.",
    facts: smelterFacts(RecipeID.ironBars),
    unlock: { kind: "resource", resource: ResourcesID.ironOre },
  },
  {
    id: "recipe.concrete",
    subcategory: "smelter",
    title: "Concrete",
    lore: "Crushed mountain rock kilned into sturdy binding mix for reinforcing deep shafts and camp foundations.",
    facts: smelterFacts(RecipeID.concrete),
    unlock: { kind: "resource", resource: ResourcesID.stone },
  },
  {
    id: "world.kingdom",
    subcategory: "kingdom",
    title: "The Dwarven Kingdom",
    lore: "Built on deep shafts, strict ledgers, and rivers of ale. Every outpost answers to the crown's auditors.",
    startsUnlocked: true,
  },
  {
    id: "world.mission",
    subcategory: "mission",
    title: "Our Mission",
    lore: "Establish a self-sustaining mine around the Great Shaft, meet the quotas, and keep the crew fed with beer.",
    startsUnlocked: true,
  },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntryData> = Object.fromEntries(
  GLOSSARY_ENTRIES.map((entry) => [entry.id, entry]),
);
