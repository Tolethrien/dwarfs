import auroraConfig from "@/core/aurora/renderer/config";
import Renderer from "@/core/aurora/renderer/renderer";
import Engine from "@/core/engine/engine";
import Pragma from "@/core/pragma/pragma";
import chars from "@sandbox/assets/chars.png";
import stones from "@sandbox/assets/stones.png";
import blockDamage from "@sandbox/assets/blockDamage.mp3";
import blockDestroy from "@sandbox/assets/blockDestroy.mp3";
import mineAmbient from "@sandbox/assets/mineAmbient1.mp3";
import bg from "@sandbox/assets/bg.png";
import anims from "@sandbox/assets/anims.png";
import icons from "@sandbox/assets/icons.png";
import MapObject from "./managers/mapObject";
import { registerInputsBindings } from "./inputActions";
import Cello from "@/core/cello/cello";
import SoundBank, { SoundsID } from "./managers/soundbank";
import { registerSoundEffects } from "./soundEffects";
import GameScene from "./scenes/gameScene";

async function preload() {
  const aurora = auroraConfig({
    userTextures: [
      { name: "chars", url: chars },
      { name: "stones", url: stones },
      { name: "bg", url: bg },
      { name: "anims", url: anims },
      { name: "icons", url: icons },
    ],
    userFonts: [],
    feature: {
      bloom: false,
      lighting: false,
    },
    debugger: "none",
    camera: { builtInCameraInputs: false, speed: 0 },
    rendering: {
      sortOrder: "y+x+z",
      renderRes: "1920x1080", // must be in fullHD
      toneMapping: "none",
      drawOrigin: "center", // don't work - must be like this
      canvasColor: [0, 0, 0, 255],
    },
  });
  await Renderer.initialize(aurora);
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
