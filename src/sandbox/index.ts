import Aurora from "@aurora/core";
import URP from "@aurora/urp/urp";
import { COLOR } from "@axiom/color";
import Engine from "@engine/engine";
import chars from "@sandbox/assets/chars.png";
import stones from "@sandbox/assets/stones.png";
import blockDamage from "@sandbox/assets/blockDamage.mp3";
import blockDestroy from "@sandbox/assets/blockDestroy.mp3";
import mineAmbient from "@sandbox/assets/mineAmbient1.mp3";
import bg from "@sandbox/assets/bg.png";
import anims from "@sandbox/assets/anims.png";
import decos from "@sandbox/assets/deco.png";
import icons from "@sandbox/assets/icons.png";
import lato from "@sandbox/assets/fonts/Lato-Regular.ttf";
import TileMask from "./shaders/tileMask";
import Materials from "./shaders/materials";
import { registerInputsBindings } from "./inputActions";
import Cello from "@cello/cello";
import { SOUND_CATEGORIES } from "./content/sounds";
import { registerSoundEffects } from "./audio/soundEffects";
import SaveGame from "./world/saveGame";
import MenuScene from "./scenes/menuScene";
import { debug } from "@debug";
import { Light } from "@/core/aurora/urp/draw/draw";

const MAP_SEED = 1778679494;

async function preload() {
  await Aurora.config({
    userTextures: [
      { name: "chars", albedo: chars },
      { name: "stones", albedo: stones },
      { name: "bg", albedo: bg },
      { name: "anims", albedo: anims },
      { name: "decos", albedo: decos },
    ],
    userUI: [{ name: "icons", url: icons }],
    fonts: [{ name: "lato", type: "dynamic", url: lato }],
    rendering: {
      renderRes: "1080p",
      canvasColor: COLOR.BLACK,
    },
    camera: { viewHeight: 1080 },
  });
  await URP.init({
    sortMode: "layer",
    toneMapping: { mode: "none" },
    bloom: { enabled: true },
    lighting: { enabled: true },
    pixelSnap: "world",
  });
  TileMask.register();
  Materials.register();

  await Cello.initialize({
    preloadSounds: [
      { name: "blockDamage", url: blockDamage },
      { name: "blockDestroy", url: blockDestroy },
      { name: "mineAmbient", url: mineAmbient },
    ],
    masterVolume: 1,
    categoryTree: SOUND_CATEGORIES,
  });
}
function setup() {
  registerInputsBindings();
  registerSoundEffects();
  SaveGame.registerCommands();
  Light.setAmbient({ enabled: true, intensity: 0.2 });
  // the mapGen panel's Generate goes straight into the new map, a normal start opens the menu
  if (debug.mapGen.requested())
    void SaveGame.newGame({ seed: debug.mapGen.seed(MAP_SEED) });
  else MenuScene.open();
}
Engine.initialize({ setup, preload });
