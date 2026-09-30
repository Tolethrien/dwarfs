import type { MapGenConfig } from "@sandbox/mapGen/mapGenerator";
import type { VeinConfig, VeinShape } from "@sandbox/mapGen/passes/veins";
import type { Range } from "@sandbox/mapGen/context";
import type {
  MapGenDebugData,
  TweakFieldsSection,
  TweakListSection,
  TweakPanel,
} from "../../interfaces";
import type { TweakControl, TweakField } from "../tweak/report";

export const MAP_GEN_PAGES = {
  group: "mapGen",
  order: {
    mapGenerate: 1,
    mapShape: 2,
    mapRock: 3,
    mapCaves: 4,
    mapVeins: 5,
    mapCrater: 6,
    mapChests: 7,
  },
} as const;

export interface MapGenDraft {
  seed: number;
  config: MapGenConfig;
}

export interface MapGenActions {
  generate(): void;
  randomize(): void;
  reset(): void;
  logCode(): void;
  source(): string;
  pending(): boolean;
}

type Node = Record<string | number, unknown>;

// the key doubles as the label, so two knobs for the same prop in one section just get different labels
interface Knob {
  key: string;
  control: TweakControl;
  parent: (config: MapGenConfig) => unknown;
  prop: string | number;
}

const VEIN_SHAPES: readonly VeinShape[] = ["seam", "vein", "cluster", "geode"];
const NO_SHELL = "none";

const slider = (min: number, max: number, step: number): TweakControl => ({
  kind: "slider",
  min,
  max,
  step,
});
const CONTROL = {
  share: slider(0, 1, 0.01),
  frequency: slider(0.001, 0.5, 0.001),
  tiles: slider(0, 40, 1),
  bigTiles: slider(0, 120, 1),
  radius: slider(0.5, 12, 0.1),
  turn: slider(0, 1, 0.01),
  count: slider(0, 60, 1),
  perChunk: slider(0, 3, 0.01),
};

function page(name: keyof typeof MAP_GEN_PAGES.order, title: string) {
  return {
    title,
    group: MAP_GEN_PAGES.group,
    order: MAP_GEN_PAGES.order[name],
    command: false,
    exportable: false,
  };
}

function knob(prop: string, parent: Knob["parent"], control: TweakControl, label = prop): Knob {
  return { key: label, control, parent, prop };
}

function rangeKnobs(
  prop: string,
  parent: Knob["parent"],
  control: TweakControl,
  label = prop,
): Knob[] {
  const range = (config: MapGenConfig) => (parent(config) as Node)[prop];
  return [
    { key: `${label} min`, control, parent: range, prop: 0 },
    { key: `${label} max`, control, parent: range, prop: 1 },
  ];
}

const read = (knob: Knob, config: MapGenConfig) => (knob.parent(config) as Node)[knob.prop];

function knobSection(
  title: string,
  knobs: Knob[],
  draft: MapGenDraft,
  defaults: MapGenConfig,
): TweakFieldsSection {
  return {
    title,
    call: "mapGen",
    arg: "object",
    fields: knobs.map((knob) => ({ key: knob.key, control: knob.control })),
    defaults: Object.fromEntries(knobs.map((knob) => [knob.key, read(knob, defaults)])),
    get: () => Object.fromEntries(knobs.map((knob) => [knob.key, read(knob, draft.config)])),
    set(values) {
      for (const knob of knobs)
        if (knob.key in values) (knob.parent(draft.config) as Node)[knob.prop] = values[knob.key];
    },
  };
}

// a list the game keeps as plain data (ranges, numbers), edited through item objects
function listSection<Stored, Item extends Record<string, unknown>>(options: {
  title: string;
  owner: (config: MapGenConfig) => unknown;
  prop: string;
  fields: TweakField[];
  toItem: (stored: Stored, index: number) => Item;
  fromItems: (items: Item[], current: readonly Stored[]) => Stored[];
  create: Item;
  label?: (item: Item) => string;
  draft: MapGenDraft;
  defaults: MapGenConfig;
}): TweakListSection {
  const label = options.label;
  const list = (config: MapGenConfig) =>
    (options.owner(config) as Node)[options.prop] as readonly Stored[];
  return {
    title: options.title,
    call: "mapGen",
    arg: "list",
    item: {
      fields: () => options.fields,
      create: () => ({ ...options.create }),
      label: label ? (value) => label(value as Item) : undefined,
    },
    defaults: list(options.defaults).map(options.toItem),
    get: () => list(options.draft.config).map(options.toItem),
    set(items) {
      const current = list(options.draft.config);
      (options.owner(options.draft.config) as Node)[options.prop] = options.fromItems(
        items as Item[],
        current,
      );
    },
  };
}

function rangeList(
  title: string,
  owner: (config: MapGenConfig) => unknown,
  control: TweakControl,
  draft: MapGenDraft,
  defaults: MapGenConfig,
): TweakListSection {
  return listSection<Range, { min: number; max: number }>({
    title,
    owner,
    prop: "perBand",
    fields: [
      { key: "min", control },
      { key: "max", control },
    ],
    toItem: (range) => ({ min: range[0], max: range[1] }),
    fromItems: (items) => items.map((item) => [item.min, item.max] as const),
    create: { min: 1, max: 2 },
    draft,
    defaults,
  });
}

function generatePanel(draft: MapGenDraft, source: MapGenDebugData, actions: MapGenActions): TweakPanel {
  const passes = Object.keys(source.config.passes) as (keyof MapGenConfig["passes"])[];
  return {
    ...page("mapGenerate", "Generate"),
    presets: false,
    sections: [
      {
        title: "Seed",
        call: "mapGen",
        arg: "object",
        fields: [
          { key: "seed", control: { kind: "number", step: 1 } },
          { key: "shown", label: "seed on the map", control: { kind: "info" } },
          { key: "source", control: { kind: "info" } },
          { key: "pending", label: "not generated yet", control: { kind: "info" } },
          { key: "generate", label: "", control: { kind: "button", text: "generate (restarts the game)" } },
          { key: "random", label: "", control: { kind: "button", text: "random seed + generate" } },
          { key: "reset", label: "", control: { kind: "button", text: "back to MAP_SEED / MAP_GEN_CONFIG" } },
          { key: "code", label: "", control: { kind: "button", text: "log seed + config as code" } },
        ],
        get: () => ({
          seed: draft.seed,
          shown: source.seed,
          source: actions.source(),
          pending: actions.pending() ? "yes" : "no",
          generate: false,
          random: false,
          reset: false,
          code: false,
        }),
        set(values) {
          if (values.seed !== undefined) draft.seed = Math.round(values.seed as number);
          if (values.generate) actions.generate();
          if (values.random) actions.randomize();
          if (values.reset) actions.reset();
          if (values.code) actions.logCode();
        },
      },
      knobSection(
        "Passes",
        passes.map((pass) => knob(pass, (config) => config.passes, { kind: "toggle" })),
        draft,
        source.defaults,
      ),
    ],
  };
}

function shapePanel(draft: MapGenDraft, defaults: MapGenConfig): TweakPanel {
  const shape = (config: MapGenConfig) => config.shape;
  const intrusions = (config: MapGenConfig) => config.shape.intrusions;
  const intrusionKnobs = (group: (config: MapGenConfig) => unknown) => [
    ...rangeKnobs("length", group, CONTROL.bigTiles),
    ...rangeKnobs("width", group, slider(1, 30, 1)),
    knob("turn", group, CONTROL.turn),
    knob("tip", group, slider(0.3, 4, 0.1)),
  ];
  return {
    ...page("mapShape", "Shape"),
    sections: [
      knobSection(
        "Margin",
        [
          knob("min", (config) => config.shape.margin, CONTROL.tiles),
          knob("base", (config) => config.shape.margin, CONTROL.tiles),
          knob("amplitude", (config) => config.shape.margin, CONTROL.tiles),
          knob("frequency", (config) => config.shape.margin, CONTROL.frequency),
          knob("top", shape, CONTROL.tiles),
        ],
        draft,
        defaults,
      ),
      knobSection(
        "Teeth and corners",
        [
          knob("amplitude", (config) => config.shape.teeth, CONTROL.bigTiles, "teeth amplitude"),
          knob("frequency", (config) => config.shape.teeth, CONTROL.frequency, "teeth frequency"),
          knob("threshold", (config) => config.shape.teeth, slider(-1, 1, 0.01), "teeth threshold"),
          knob("size", (config) => config.shape.corners, CONTROL.bigTiles, "corner size"),
          knob("depth", (config) => config.shape.corners, CONTROL.tiles, "corner depth"),
        ],
        draft,
        defaults,
      ),
      knobSection(
        "Obsidian band",
        [
          knob("min", (config) => config.shape.border, slider(1, 6, 1), "band min"),
          knob("max", (config) => config.shape.border, slider(1, 6, 1), "band max"),
          knob("frequency", (config) => config.shape.border, CONTROL.frequency, "band frequency"),
          knob("depth", (config) => config.shape.ragged, slider(0, 6, 0.1), "wave depth"),
          knob("frequency", (config) => config.shape.ragged, CONTROL.frequency, "wave frequency"),
        ],
        draft,
        defaults,
      ),
      knobSection(
        "Intrusion limits",
        [knob("safeTop", intrusions, CONTROL.bigTiles), knob("reach", intrusions, CONTROL.share)],
        draft,
        defaults,
      ),
      knobSection("Tongues", intrusionKnobs((config) => config.shape.intrusions.tongues), draft, defaults),
      rangeList("Tongues per band", (config) => config.shape.intrusions.tongues, CONTROL.count, draft, defaults),
      knobSection("Spikes", intrusionKnobs((config) => config.shape.intrusions.spikes), draft, defaults),
      rangeList("Spikes per band", (config) => config.shape.intrusions.spikes, CONTROL.count, draft, defaults),
      knobSection(
        "Islands",
        [
          ...rangeKnobs("radius", (config) => config.shape.islands, CONTROL.radius),
          knob("clearance", (config) => config.shape.islands, CONTROL.tiles),
        ],
        draft,
        defaults,
      ),
      rangeList("Islands per band", (config) => config.shape.islands, CONTROL.count, draft, defaults),
    ],
  };
}

function rockPanel(draft: MapGenDraft, defaults: MapGenConfig): TweakPanel {
  type Layer = MapGenConfig["rock"]["layers"][number];
  return {
    ...page("mapRock", "Rock"),
    sections: [
      knobSection(
        "Layers",
        [
          knob("warp", (config) => config.rock.boundary, CONTROL.bigTiles, "boundary warp"),
          knob("frequency", (config) => config.rock.boundary, CONTROL.frequency, "boundary frequency"),
        ],
        draft,
        defaults,
      ),
      knobSection(
        "Patches",
        [knob("frequency", (config) => config.rock.patches, CONTROL.frequency, "patch frequency")],
        draft,
        defaults,
      ),
      // the rock types stay in code, a new layer copies the ones of the last layer
      listSection<Layer, { until: number }>({
        title: "Layer ends (depth 0-1)",
        owner: (config) => config.rock,
        prop: "layers",
        fields: [{ key: "until", control: CONTROL.share }],
        toItem: (layer) => ({ until: layer.until }),
        fromItems: (items, current) =>
          items.map((item, index) => ({
            until: item.until,
            rocks: (current[index] ?? current[current.length - 1]).rocks,
          })),
        create: { until: 1 },
        draft,
        defaults,
      }),
    ],
  };
}

function cavesPanel(draft: MapGenDraft, defaults: MapGenConfig): TweakPanel {
  const chambers = (config: MapGenConfig) => config.caves.chambers;
  const tunnels = (config: MapGenConfig) => config.caves.tunnels;
  const caves = (config: MapGenConfig) => config.caves;
  return {
    ...page("mapCaves", "Caves"),
    sections: [
      knobSection(
        "Chambers",
        [
          ...rangeKnobs("frequency", chambers, slider(0.002, 0.05, 0.001)),
          knob("stretch", chambers, slider(0.3, 4, 0.05)),
          knob("warp", chambers, slider(0, 4, 0.05)),
        ],
        draft,
        defaults,
      ),
      listSection<number, { coverage: number }>({
        title: "Air per band",
        owner: chambers,
        prop: "coverage",
        fields: [{ key: "coverage", control: slider(0, 0.5, 0.01) }],
        toItem: (coverage) => ({ coverage }),
        fromItems: (items) => items.map((item) => item.coverage),
        create: { coverage: 0.1 },
        draft,
        defaults,
      }),
      knobSection(
        "Tunnels",
        [
          ...rangeKnobs("length", tunnels, slider(0, 300, 1)),
          ...rangeKnobs("radius", tunnels, slider(0.5, 5, 0.1)),
          knob("turn", tunnels, CONTROL.turn),
          knob("turnFrequency", tunnels, CONTROL.frequency),
        ],
        draft,
        defaults,
      ),
      rangeList("Tunnels per band", tunnels, CONTROL.count, draft, defaults),
      knobSection(
        "Cleanup",
        [
          knob("smoothing", caves, slider(0, 8, 1)),
          knob("minWidth", caves, slider(0, 3, 1)),
          knob("minArea", caves, slider(0, 400, 1)),
          knob("minRockArea", caves, slider(0, 200, 1)),
        ],
        draft,
        defaults,
      ),
    ],
  };
}

type VeinItem = {
  type: string;
  shape: string;
  perChunk: number;
  depthFrom: number;
  depthTo: number;
  sizeMin: number;
  sizeMax: number;
  density: number;
  wallBias: number;
  district: number;
  shell: string;
};

function veinsPanel(draft: MapGenDraft, source: MapGenDebugData): TweakPanel {
  const blocks = source.blocks as unknown as Record<string, number | string>;
  const names = Object.keys(blocks).filter((key) => Number.isNaN(Number(key)));
  const nameOf = (type: number) => String(blocks[type]);
  return {
    ...page("mapVeins", "Veins"),
    sections: [
      listSection<VeinConfig, VeinItem>({
        title: "Ores",
        owner: (config) => config,
        prop: "veins",
        fields: [
          { key: "type", control: { kind: "select", options: names } },
          { key: "shape", control: { kind: "select", options: VEIN_SHAPES } },
          { key: "perChunk", label: "per chunk", control: CONTROL.perChunk },
          { key: "depthFrom", label: "depth from", control: CONTROL.share },
          { key: "depthTo", label: "depth to", control: CONTROL.share },
          { key: "sizeMin", label: "size min", control: CONTROL.tiles },
          { key: "sizeMax", label: "size max", control: CONTROL.tiles },
          { key: "density", control: CONTROL.share },
          { key: "wallBias", label: "near caves", control: CONTROL.share },
          { key: "district", control: CONTROL.share },
          { key: "shell", label: "geode shell", control: { kind: "select", options: [NO_SHELL, ...names] } },
        ],
        toItem: (vein) => ({
          type: nameOf(vein.type),
          shape: vein.shape,
          perChunk: vein.perChunk,
          depthFrom: vein.depth[0],
          depthTo: vein.depth[1],
          sizeMin: vein.size[0],
          sizeMax: vein.size[1],
          density: vein.density,
          wallBias: vein.wallBias,
          district: vein.district,
          shell: vein.shell === undefined ? NO_SHELL : nameOf(vein.shell),
        }),
        fromItems: (items) =>
          items.map((item) => ({
            type: blocks[item.type] as number,
            shape: item.shape as VeinShape,
            perChunk: item.perChunk,
            depth: [item.depthFrom, item.depthTo],
            size: [item.sizeMin, item.sizeMax],
            density: item.density,
            wallBias: item.wallBias,
            district: item.district,
            ...(item.shell === NO_SHELL ? {} : { shell: blocks[item.shell] as number }),
          })),
        create: {
          type: nameOf(source.defaults.veins[0].type),
          shape: "cluster",
          perChunk: 0.3,
          depthFrom: 0,
          depthTo: 1,
          sizeMin: 1,
          sizeMax: 3,
          density: 0.8,
          wallBias: 0.3,
          district: 0.5,
          shell: NO_SHELL,
        },
        label: (item) => `${item.type} (${item.shape})`,
        draft,
        defaults: source.defaults,
      }),
    ],
  };
}

function craterPanel(draft: MapGenDraft, defaults: MapGenConfig): TweakPanel {
  const crater = (config: MapGenConfig) => config.crater;
  return {
    ...page("mapCrater", "Crater"),
    sections: [
      knobSection(
        "Shaft",
        [
          knob("chunk", crater, slider(0, 9, 1)),
          knob("width", (config) => config.crater.shaft, slider(1, 9, 1), "shaft width"),
          knob("depth", (config) => config.crater.shaft, CONTROL.tiles, "shaft depth"),
        ],
        draft,
        defaults,
      ),
      knobSection(
        "Blast",
        [
          knob("width", (config) => config.crater.radius, slider(2, 30, 1), "radius x"),
          knob("height", (config) => config.crater.radius, slider(2, 30, 1), "radius y"),
          knob("roughness", crater, CONTROL.share),
          ...rangeKnobs("count", (config) => config.crater.cracks, slider(0, 15, 1), "cracks"),
          ...rangeKnobs("length", (config) => config.crater.cracks, CONTROL.tiles, "crack length"),
        ],
        draft,
        defaults,
      ),
      knobSection(
        "Rubble and coal",
        [
          ...rangeKnobs("count", (config) => config.crater.rubble, slider(0, 10, 1), "rubble"),
          ...rangeKnobs("count", (config) => config.crater.coal, slider(0, 6, 1), "coal patches"),
          ...rangeKnobs("radius", (config) => config.crater.coal, slider(1, 6, 1), "coal radius"),
        ],
        draft,
        defaults,
      ),
    ],
  };
}

function chestsPanel(draft: MapGenDraft, defaults: MapGenConfig): TweakPanel {
  const chests = (config: MapGenConfig) => config.chests;
  return {
    ...page("mapChests", "Chests"),
    sections: [
      knobSection(
        "Chests",
        [
          knob("spacing", chests, slider(5, 150, 1)),
          knob("searchRadius", chests, CONTROL.tiles, "search radius"),
          knob("fallbackChance", chests, CONTROL.share, "in plain rock chance"),
          ...rangeKnobs("nearStart", chests, slider(0, 10, 1)),
        ],
        draft,
        defaults,
      ),
    ],
  };
}

export function mapGenPanels(
  draft: MapGenDraft,
  source: MapGenDebugData,
  actions: MapGenActions,
): Record<keyof typeof MAP_GEN_PAGES.order, TweakPanel> {
  return {
    mapGenerate: generatePanel(draft, source, actions),
    mapShape: shapePanel(draft, source.defaults),
    mapRock: rockPanel(draft, source.defaults),
    mapCaves: cavesPanel(draft, source.defaults),
    mapVeins: veinsPanel(draft, source),
    mapCrater: craterPanel(draft, source.defaults),
    mapChests: chestsPanel(draft, source.defaults),
  };
}
