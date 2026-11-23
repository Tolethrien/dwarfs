import PragmaSystem from "@pragma/system";
import Pragma from "@pragma/pragma";
import AxiomMath from "@axiom/math";
import { MAP_GEN } from "../../game/mapGen/mapGen";
import { SHAPE } from "../../game/mapGen/shape";
import { CAVES } from "../../game/mapGen/caves";
import { ORES } from "../../game/mapGen/ores";
import { ROCKS } from "../../game/mapGen/rocks";
import { BIOME_GEN } from "../../game/mapGen/biomes";
import { DECO_GEN } from "../../game/mapGen/decorations";
import { BIOME_RULES, BiomesID } from "../../game/content/biomes";
import { BlocksID } from "../../game/content/blocks";
import { startGame } from "../../game/mapSetup";
import { action, control, page, tune, words } from "../pages";

const MAP_GEN_DEBUG = {
  scene: "game",
  seeds: { min: 0, max: 1_000_000 },
  applies: "the next map (Regenerate)",
  // ids of blocks and biomes, noise salts: no numbers to tune
  skip: ["block", "biome", "salt"],
};

// a rock layer, a patch or an ore by its block, a biome area by its biome
function nameOf(value: object, key: string) {
  const owner = value as { block?: BlocksID; biome?: BiomesID };
  if (owner.block !== undefined) return words(BlocksID[owner.block]);
  if (owner.biome !== undefined) return words(BiomesID[owner.biome]);
  return undefined;
}

// CAVES.biomes is keyed by the biome
function caveNameOf(value: object, key: string) {
  return /^\d+$/.test(key) ? words(BiomesID[Number(key)]) : nameOf(value, key);
}

export default class MapGenDebug extends PragmaSystem {
  awake(): void {
    page("mapGen", "regenerate", "Regenerate", "Throws the current game away and starts a new one on a new map; tune the generator first on the other MapGen pages.", () => [
      action("map", "regenerate", "New map (the game starts over, intro included)", [
        { key: "seed", control: control.number(1), value: AxiomMath.randomInt(MAP_GEN_DEBUG.seeds.min, MAP_GEN_DEBUG.seeds.max) },
      ], (args) => {
        Pragma.deleteScene(MAP_GEN_DEBUG.scene);
        startGame(Number(args.seed));
      }),
    ]);
    const common = { applies: MAP_GEN_DEBUG.applies, skip: MAP_GEN_DEBUG.skip, nameOf };
    tune("mapGen", "MAP_GEN", MAP_GEN, {
      title: "World",
      description: "The world's size in tiles and a tile's size in pixels.",
      applies: "only after the game is restarted, the GPU buffers are made for this size",
    });
    tune("mapGen", "SHAPE", SHAPE, {
      ...common,
      title: "Shape",
      description:
        "The map's outline in the world: the margin to the world's edge, the obsidian band around it, spikes of obsidian cutting in from the sides and the bottom, and floating islands. The middle stays free for the shaft.",
      hints: {
        top: "Rows of the world above the map",
        margin: "The map's distance from the world's sides and bottom",
        band: "Obsidian around everything that isn't map",
        shaftLane: "Free rock kept on each side of the shaft",
        perBand: "Spikes in each of the map's equal horizontal bands, from the top down",
        reach: "How far into the width a side spike may go",
        safeTop: "Rows at the top without spikes",
        clearance: "Least free tiles around an island",
      },
    });
    tune("mapGen", "CAVES", CAVES, {
      ...common,
      nameOf: caveNameOf,
      title: "Caves",
      description:
        "Chambers and tunnels carved in the rock. Chambers: the share of rock they take per band from the top down, their noise (lower frequency, bigger chambers) and kinds by stretch (width ÷ height). Tunnels: count per band, length and width.",
      hints: {
        coverage: "Share of rock turned into chambers in each band, from the top down",
        frequency: "Chamber noise at the top and the bottom: lower is bigger chambers",
        share: "Part of the map with this kind of chamber",
        stretch: "Width ÷ height of its chambers",
        blend: "How much two kinds mix at their border",
        smoothing: "Passes that round off the carved walls",
        minArea: "Smaller caves are filled back in",
        minRockArea: "Smaller lumps of rock left in a cave are removed",
      },
    });
    tune("mapGen", "ORES", ORES, {
      ...common,
      title: "Ores",
      description:
        "Where ores grow. Depth points give the amount by depth (linear between them); seams are flat beds, veins crooked cracks, nests small lumps (per 1000 rock tiles at amount 1). Walls: lumps grown into cave walls; starter: ore guaranteed around the first shaft.",
      hints: {
        coverage: "Share of rock at amount 1",
        perThousand: "Veins or nests per 1000 rock tiles at amount 1",
        lookAhead: "An ore may show up this many tiles above its own depth",
        chance: "Chance per cave wall tile",
        margin: "Tiles past the crater's edge the starter ring begins",
        reach: "How wide the starter ring is",
      },
    });
    tune("mapGen", "ROCKS", ROCKS, {
      ...common,
      title: "Rocks",
      description:
        "Rock layers by depth (tiles from the map's top) and patches of other rock inside the stone. Around a layer's start both layers mix over blend above and below; a patch's coverage is roughly the share of stone it takes within its depths.",
      hints: {
        from: "Depth the layer starts at",
        boundary: "How wavy the border between layers is",
        stretch: "How many times longer than tall the noise is drawn",
        patchFade: "Tiles a patch fades in and out over at its depth limits",
      },
    });
    tune("mapGen", "BIOME_GEN", BIOME_GEN, {
      ...common,
      title: "Biome areas",
      description:
        "Where biomes sit. Depth: the area's middle as a share of the map's height; across: where its middle may land across the width; warp pushes the whole area around and grows branches; fill: the share of rock turned into the biome's blocks, in the middle and at the edge.",
      hints: {
        depth: "The area's middle, share of the map's height",
        roughness: "How far the outline swings in and out",
        warp: "Tiles the area is pushed around by",
      },
    });
    tune("mapGen", "BIOME_RULES", BIOME_RULES, {
      ...common,
      title: "Biome tint",
      description: "How biomes color the rock.",
      hints: { transition: "Tiles the tint blends over on each side of a biome's border" },
    });
    tune("mapGen", "DECO_GEN", DECO_GEN, {
      ...common,
      title: "Decorations",
      description: "Mushrooms, stalactites and the rest placed on cave floors, ceilings and walls.",
      hints: {
        clusterFreq: "Noise of where decorations bunch up",
        speciesFreq: "Noise of which kind grows where",
        scale: "Random size of each decoration",
        offset: "Random shift off its tile",
        shallowDepth: "Share of the map's height counted as shallow",
      },
    });
  }
}
