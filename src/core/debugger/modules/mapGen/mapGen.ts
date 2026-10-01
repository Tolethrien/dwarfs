import type { MapGenConfig } from "@sandbox/mapGen/mapGenerator";
import { deepMerge } from "@axiom/utils";
import type {
  ICommandModule,
  ILogHandle,
  IMapGenModule,
  ITweakModule,
  MapGenDebugData,
} from "../../interfaces";
import { profilerState } from "../../profilerState";
import { MAP_GEN_PAGES, mapGenPanels, type MapGenDraft } from "./panels";
import type { MapGenConfigSection, MapGenItem, MapGenReport, MapGenTable } from "./report";

// sessionStorage: survives the restart the Generate button does, is gone once the game closes,
// so a fresh start always shows the map from the code
const STORAGE = { seed: "mapGen:seed", config: "mapGen:config" };
const FORMAT = { decimals: 4, codeWidth: 90, indent: "  " };
// fields holding a tile (type + variant), written by name
const BLOCK_KEYS = new Set(["type", "shell", "border", "placeholder", "rocks"]);
const GENERAL_KEYS = ["tileInPixels", "chunkInTiles", "mapInChunks", "start", "border", "placeholder"];

type Node = Record<string, unknown>;
type BlockName = (type: number) => string;

export class MapGenDevModule implements IMapGenModule {
  private overridden = { seed: false, config: false };
  private timeMs = 0;
  private source: MapGenDebugData | null = null;
  private draft: MapGenDraft | null = null;
  private report: MapGenReport | null = null;

  constructor(
    private readonly tweak: ITweakModule,
    command: ICommandModule,
    private readonly log: ILogHandle,
  ) {
    const root = Object.freeze({
      config: (page?: string) =>
        page === undefined ? this.tweak.openGroup(MAP_GEN_PAGES.group) : this.tweak.open(page),
      generate: (seed?: number) => {
        if (seed !== undefined && this.draft) this.draft.seed = seed;
        this.generate();
      },
      random: () => this.randomize(),
      reset: () => this.reset(),
      code: () => this.logCode(),
    });
    command.expose("mapGen", () => root, {
      hint: `map generator: mapGen.config(page?), mapGen.generate(seed?), mapGen.random(), mapGen.reset(), mapGen.code(); pages: ${Object.keys(MAP_GEN_PAGES.order).join(", ")}`,
    });
    // the report is sent once per map, a profiler opened later still has to get it
    window.API.DEBUG.onProfilerState((isOpen) => {
      if (isOpen) this.send();
    });
  }

  public seed(fallback: number) {
    const stored = readStorage(STORAGE.seed);
    if (stored === null) return fallback;
    this.overridden.seed = true;
    return Number(stored);
  }

  public config(fallback: MapGenConfig) {
    const stored = readStorage(STORAGE.config);
    if (stored === null) return fallback;
    try {
      const changes = JSON.parse(stored) as Node;
      this.overridden.config = Object.keys(changes).length > 0;
      return deepMerge(fallback, changes as DeepPartial<MapGenConfig>);
    } catch (error) {
      this.log.error("mapGen: saved config is broken, using MAP_GEN_CONFIG", error);
      return fallback;
    }
  }

  public requested() {
    return readStorage(STORAGE.seed) !== null || readStorage(STORAGE.config) !== null;
  }

  public measure<Result>(generate: () => Result) {
    const started = performance.now();
    const result = generate();
    this.timeMs = performance.now() - started;
    return result;
  }

  public connect(source: MapGenDebugData) {
    this.source = source;
    if (source.timeMs !== undefined) this.timeMs = source.timeMs;
    const draft: MapGenDraft = { seed: source.seed, config: structuredClone(source.config) };
    this.draft = draft;

    const panels = mapGenPanels(draft, source, {
      generate: () => this.generate(),
      randomize: () => this.randomize(),
      reset: () => this.reset(),
      logCode: () => this.logCode(),
      source: () => this.describeSource(),
      pending: () =>
        draft.seed !== source.seed || JSON.stringify(draft.config) !== JSON.stringify(source.config),
    });
    for (const [name, panel] of Object.entries(panels)) this.tweak.register(name, panel);

    this.report = buildReport(source, this.timeMs, this.describeSource());
    if (profilerState.isOpen) this.send();
    this.log.log(`seed ${source.seed} (${this.describeSource()}), ${Math.round(this.timeMs)} ms`);
  }

  private send() {
    if (this.report) window.API.DEBUG.sendMapGen(this.report);
  }

  private describeSource() {
    const parts = [
      this.overridden.seed ? "seed from the panel" : "MAP_SEED",
      this.overridden.config ? "config from the panel" : "MAP_GEN_CONFIG",
    ];
    return parts.join(", ");
  }

  // only what differs from MAP_GEN_CONFIG is saved, so later edits in the code still reach the other fields
  private generate() {
    if (!this.source || !this.draft) return;
    const changes = difference(this.draft.config, this.source.defaults) ?? {};
    writeStorage(STORAGE.seed, String(this.draft.seed));
    writeStorage(STORAGE.config, JSON.stringify(changes));
    window.location.reload();
  }

  private randomize() {
    if (!this.draft) return;
    this.draft.seed = Math.floor(Math.random() * 2 ** 31);
    this.generate();
  }

  private reset() {
    removeStorage(STORAGE.seed);
    removeStorage(STORAGE.config);
    window.location.reload();
  }

  private logCode() {
    if (!this.source || !this.draft) return;
    const tiles = this.source.tiles;
    const config = formatValue(
      this.draft.config,
      (value) => tiles.find((tile) => tile.value === value)?.code ?? String(value),
      "",
      0,
      FORMAT.codeWidth,
    );
    this.log.log(
      `const MAP_SEED = ${this.draft.seed};\n\nexport const MAP_GEN_CONFIG: MapGenConfig = ${config};`,
    );
  }
}

function readStorage(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

function removeStorage(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// arrays count as one value: a changed list is saved whole
function difference(current: unknown, base: unknown): unknown {
  if (isNode(current) && isNode(base)) {
    const changed: Node = {};
    for (const key of Object.keys(current)) {
      const inner = difference(current[key], base[key]);
      if (inner !== undefined) changed[key] = inner;
    }
    return Object.keys(changed).length > 0 ? changed : undefined;
  }
  return JSON.stringify(current) === JSON.stringify(base) ? undefined : current;
}

function formatValue(
  value: unknown,
  blockName: BlockName,
  key: string,
  depth: number,
  inlineWidth: number,
): string {
  if (typeof value === "number") {
    if (BLOCK_KEYS.has(key)) return blockName(value);
    const scale = 10 ** FORMAT.decimals;
    return String(Math.round(value * scale) / scale);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value !== "object" || value === null) return String(value);

  const isList = Array.isArray(value);
  const entries = isList
    ? value.map((item) => formatValue(item, blockName, key, depth + 1, inlineWidth))
    : Object.entries(value).map(
        ([inner, item]) => `${inner}: ${formatValue(item, blockName, inner, depth + 1, inlineWidth)}`,
      );
  const bracket = isList ? { open: "[", close: "]", pad: "" } : { open: "{", close: "}", pad: " " };
  const inline = `${bracket.open}${bracket.pad}${entries.join(", ")}${bracket.pad}${bracket.close}`;
  if (inline.length + depth * FORMAT.indent.length <= inlineWidth && !inline.includes("\n"))
    return inline;

  const pad = FORMAT.indent.repeat(depth + 1);
  return `${bracket.open}\n${entries.map((entry) => `${pad}${entry},`).join("\n")}\n${FORMAT.indent.repeat(depth)}${bracket.close}`;
}

// nested objects become dotted keys, a list of objects gets one row per element
function flatten(value: unknown, path: string, blockName: BlockName, items: MapGenItem[]) {
  const key = path.slice(path.lastIndexOf(".") + 1);
  if (isNode(value)) {
    for (const [inner, item] of Object.entries(value))
      flatten(item, path === "" ? inner : `${path}.${inner}`, blockName, items);
    return items;
  }
  if (Array.isArray(value) && value.some(isNode)) {
    value.forEach((item, index) =>
      items.push({ key: `${path}[${index}]`, value: formatValue(item, blockName, key, 0, Infinity) }),
    );
    return items;
  }
  items.push({ key: path, value: formatValue(value, blockName, key, 0, Infinity) });
  return items;
}

function configSections(config: MapGenConfig, blockName: BlockName): MapGenConfigSection[] {
  const sections: MapGenConfigSection[] = [
    {
      title: "General",
      items: GENERAL_KEYS.map((key) => ({
        key,
        value: formatValue((config as unknown as Node)[key], blockName, key, 0, Infinity),
      })),
    },
    { title: "Passes", items: flatten(config.passes, "", blockName, []) },
  ];
  for (const title of ["shape", "rock", "caves", "crater", "chests", "decos"] as const)
    sections.push({ title, items: flatten(config[title], "", blockName, []) });

  sections.push({
    title: "veins",
    table: {
      columns: ["type", "shape", "per chunk", "depth", "size", "density", "near caves", "district", "shell"],
      rows: config.veins.map((vein) => [
        blockName(vein.type),
        vein.shape,
        String(vein.perChunk),
        `${vein.depth[0]}-${vein.depth[1]}`,
        `${vein.size[0]}-${vein.size[1]}`,
        String(vein.density),
        String(vein.wallBias),
        String(vein.district),
        vein.shell === undefined ? "—" : blockName(vein.shell),
      ]),
    },
  });
  return sections;
}

// ore counts per rock layer (straight depth bands, without the boundary warp)
function oreTable(source: MapGenDebugData, blockName: BlockName) {
  const config = source.config;
  const world = source.world;
  const rocks = new Set<number>(config.rock.layers.flatMap((layer) => layer.rocks));
  rocks.add(config.border);
  rocks.add(config.placeholder);

  const layers = config.rock.layers;
  const counts = layers.map(() => new Map<number, number>());
  const oreTypes = new Set<number>();
  const tiles = { playable: 0, air: 0 };

  // the border band lies outside the mine shape, as before (it had no background there)
  for (let index = 0; index < world.solid.length; index++) {
    const type = world.solid[index];
    if (type === source.known.outside || type === config.border) continue;
    tiles.playable++;
    if (type === source.known.air) {
      tiles.air++;
      continue;
    }
    if (rocks.has(type)) continue;
    const gy = Math.floor(index / world.mapInTiles.width);
    const found = layers.findIndex((item) => gy / world.mapInTiles.height < item.until);
    const layer = found === -1 ? layers.length - 1 : found;
    counts[layer].set(type, (counts[layer].get(type) ?? 0) + 1);
    oreTypes.add(type);
  }

  const table: MapGenTable = {
    columns: [
      "ore",
      ...layers.map((layer, index) => {
        const from = index === 0 ? 0 : layers[index - 1].until;
        return `${Math.round(from * 100)}-${Math.round(layer.until * 100)}%`;
      }),
      "total",
    ],
    rows: [...oreTypes]
      .sort((a, b) => a - b)
      .map((type) => {
        const perLayer = counts.map((count) => count.get(type) ?? 0);
        const total = perLayer.reduce((sum, count) => sum + count, 0);
        return [blockName(type), ...perLayer.map(String), String(total)];
      }),
  };
  return { table, tiles };
}

function buildReport(source: MapGenDebugData, timeMs: number, origin: string): MapGenReport {
  const blockName: BlockName = (value) =>
    source.tiles.find((tile) => tile.value === value)?.name ?? `#${value}`;
  const ores = oreTable(source, blockName);
  const world = source.world;

  return {
    summary: [
      { key: "seed", value: String(source.seed) },
      { key: "source", value: origin },
      { key: "generated in", value: `${Math.round(timeMs)} ms` },
      { key: "size", value: `${world.meta.mapInChunks.width}×${world.meta.mapInChunks.height} chunks, ${world.mapInTiles.width}×${world.mapInTiles.height} tiles` },
      { key: "playable tiles", value: String(ores.tiles.playable) },
      { key: "air", value: `${Math.round((ores.tiles.air / Math.max(1, ores.tiles.playable)) * 1000) / 10}%` },
    ],
    ores: ores.table,
    config: configSections(source.config, blockName),
  };
}

export const prodMapGen: IMapGenModule = {
  seed: (fallback) => fallback,
  config: (fallback) => fallback,
  requested: () => false,
  measure: (generate) => generate(),
  connect: () => {},
};
