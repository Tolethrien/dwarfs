import Aurora from "@aurora/core";
import URP from "@aurora/urp/urp";
import { COLOR } from "@axiom/color";
import Engine from "@engine/engine";
import Pragma from "@pragma/pragma";
import chars from "@sandbox/assets/chars.png";
import stones from "@sandbox/assets/stones.png";
import blockDamage from "@sandbox/assets/blockDamage.mp3";
import blockDestroy from "@sandbox/assets/blockDestroy.mp3";
import mineAmbient from "@sandbox/assets/mineAmbient1.mp3";
import bg from "@sandbox/assets/bg.png";
import anims from "@sandbox/assets/anims.png";
import icons from "@sandbox/assets/icons.png";
import lato from "@sandbox/assets/fonts/Lato-Regular.ttf";
import MapObject from "./managers/mapObject";
import { registerInputsBindings } from "./inputActions";
import Cello from "@cello/cello";
import SoundBank, { SoundsID } from "./managers/soundbank";
import { registerSoundEffects } from "./soundEffects";
import GameScene from "./scenes/gameScene";

async function preload() {
  await Aurora.config({
    userTextures: [
      { name: "chars", albedo: chars },
      { name: "stones", albedo: stones },
      { name: "bg", albedo: bg },
      { name: "anims", albedo: anims },
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
    bloom: { enabled: false },
    lighting: { enabled: false },
    pixelSnap: "world",
  });
  await MapObject.loadMap("test.dwb");

  await Cello.initialize({
    preloadSounds: [
      { name: "blockDamage", url: blockDamage },
      { name: "blockDestroy", url: blockDestroy },
      { name: "mineAmbient", url: mineAmbient },
    ],
    masterVolume: 1,
    categoryTree: SoundBank.categoryTree,
  });
}
function setup() {
  registerInputsBindings();
  registerSoundEffects();

  // Renderer.setGlobalIllumination([25, 25, 80]);
  new GameScene();
}
Engine.initialize({ setup, preload });
