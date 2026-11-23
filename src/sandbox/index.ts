import Aurora from "@aurora/core";
import URP from "@aurora/urp/urp";
import { COLOR } from "@axiom/color";
import Engine from "@engine/engine";
import dwarfLayers from "@sandbox/assets/dwarfs/dwarf-layers.png";
import rocks from "@sandbox/assets/rocks/rocks-spritesheet.png";
import rocksGlow from "@sandbox/assets/rocks/rocks-glow.png";
import blockDamage from "@sandbox/assets/sound/blockDamage.mp3";
import blockDestroy from "@sandbox/assets/sound/blockDestroy.mp3";
import mineAmbient from "@sandbox/assets/sound/mineAmbient.mp3";
import bg from "@sandbox/assets/bgs/bg.png";
import caveCeiling from "@sandbox/assets/bgs/cave-ceiling.png";
import caveFloor from "@sandbox/assets/bgs/cave-floor.png";
import items from "@sandbox/assets/deco/deco.png";
import decoGlow from "@sandbox/assets/deco/deco-glow.png";
import icons from "@sandbox/assets/icons/resources.png";
import buildings from "@sandbox/assets/structures/camp-buildings-spritesheet.png";
import dwarfCard from "@sandbox/assets/ui/dwarf-card-spritesheet.png";
import uiSheet from "@sandbox/assets/ui/ui-spritesheet.png";
import buffsIco from "@sandbox/assets/icons/buffs.png";
import bebas from "@sandbox/assets/fonts/BebasNeue-Regular.ttf";
import barlow from "@sandbox/assets/fonts/BarlowSemiCondensed-Regular.ttf";
import barlowBold from "@sandbox/assets/fonts/BarlowSemiCondensed-Bold.ttf";
import Cello from "@cello/cello";
import { MAP_GEN } from "./game/mapGen/mapGen";
import TileMap from "./game/gpu/tileMap";
import GameGlobals from "./game/gpu/gameGlobals";
import Glow from "./game/gpu/glow";
import Mist from "./game/gpu/mist";
import StructurePlan from "./game/gpu/structurePlan";
import { startGame } from "./game/mapSetup";
import { bindActions } from "./game/content/actions";
import { closeMenu, openMenu } from "./menu/menuSetup";
import { SPATIAL_EFFECT, ZOOM_VOLUME_EFFECT } from "./game/audio/spatial";
import {
  CAVE_REVERB_EFFECT,
  MINE_ECHO_EFFECT,
  RUBBLE_TONE_EFFECT,
} from "./game/audio/mineEffects";

async function preload() {
  await Aurora.config({
    userTextures: [
      { name: "dwarfLayers", albedo: dwarfLayers },
      { name: "rocks", albedo: rocks },
      { name: "rocksGlow", albedo: rocksGlow },
      { name: "bg", albedo: bg },
      { name: "caveCeiling", albedo: caveCeiling },
      { name: "caveFloor", albedo: caveFloor },
      { name: "items", albedo: items },
      { name: "decoGlow", albedo: decoGlow },
      { name: "buildings", albedo: buildings },
    ],
    userUI: [
      { name: "icons", url: icons },
      { name: "dwarfLayers", url: dwarfLayers },
      { name: "dwarfCard", url: dwarfCard },
      { name: "uiSheet", url: uiSheet },
      { name: "buffs", url: buffsIco },
    ],
    fonts: [
      { name: "bebas", type: "dynamic", url: bebas },
      { name: "barlow", type: "dynamic", url: barlow },
      { name: "barlowBold", type: "dynamic", url: barlowBold },
    ],
    rendering: {
      renderRes: "1080p",
      canvasColor: COLOR.BLACK,
    },
    camera: { viewHeight: 1080 },
  });
  await URP.init({
    sortMode: "layer",
    // SORT_ORDER layers are tenths: z is cut into cells of step.z, a coarser step merges them
    zRange: [0, 1],
    step: { x: 1, y: 1, z: 0.01 },
    toneMapping: { mode: "none" },
    bloom: { enabled: true },
    // a crowd of lamps bends toward a bright cap instead of a glare, a single one stays as it is
    lighting: { enabled: true, limit: { knee: 0.8, max: 1.2 } },
    pixelSnap: "none",
  });
  GameGlobals.register(MAP_GEN.world);
  TileMap.register();
  Glow.register();
  Mist.register();
  StructurePlan.register();

  await Cello.initialize({
    preloadSounds: [
      { name: "blockDamage", url: blockDamage },
      { name: "blockDestroy", url: blockDestroy },
      { name: "mineAmbient", url: mineAmbient },
    ],
    masterVolume: 1,
    categoryTree: { mineEffects: { initVol: 1 }, ambient: { initVol: 1 } },
    effects: {
      spatial: SPATIAL_EFFECT,
      caveReverb: CAVE_REVERB_EFFECT,
      mineEcho: MINE_ECHO_EFFECT,
      rubbleTone: RUBBLE_TONE_EFFECT,
      zoomVolume: ZOOM_VOLUME_EFFECT,
    },
  });
}

function setup() {
  bindActions();
  openMenu((seed) => {
    closeMenu();
    startGame(seed);
  });
}

Engine.initialize({ setup, preload });
