import auroraConfig from "@/core/aurora/renderer/config";
import Renderer from "@/core/aurora/renderer/renderer";
import Engine from "@/core/engine/engine";
import Pragma from "@/core/pragma/pragma";
import chars from "@sandbox/assets/chars.png";
import stones from "@sandbox/assets/stones.png";
import blockDamage from "@sandbox/assets/blockDamage.mp3";
import mineAmbient from "@sandbox/assets/mineAmbient1.mp3";
import bg from "@sandbox/assets/bg.png";
import anims from "@sandbox/assets/anims.png";
import PhysBall from "./systems/physics/physBall";
import PlayerInputs from "./systems/inputs/playerInput";
import MapSystem from "./systems/map/mapSystem";
import MapObject from "./managers/mapObject";
import CameraActor from "./systems/camera/cameraActor";
import CameraObject from "./managers/cameraObject";
import { registerInputsBindings } from "./inputActions";
import Cello from "@/core/cello/cello";
import SoundBank, { SoundsID } from "./managers/soundbank";

async function preload() {
  const aurora = auroraConfig({
    userTextures: [
      { name: "chars", url: chars },
      { name: "stones", url: stones },
      { name: "bg", url: bg },
      { name: "anims", url: anims },
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
      { name: "mineAmbient", url: mineAmbient },
    ],
    masterVolume: 1,
  });
}
function setup() {
  registerInputsBindings();
  Object.entries(SoundBank.categories).forEach(([name, volume]) =>
    Cello.addCategory(name, volume),
  );
  // Renderer.setGlobalIllumination([25, 25, 80]);
  const world = Pragma.addScene("testSetup");
  world.spawnActor(new PhysBall());
  world.spawnActor(new PlayerInputs());
  world.spawnActor(new MapSystem());
  CameraObject.setZoom(0.05);
  CameraObject.setPosition(9216, 1500);
  world.spawnActor(new CameraActor());
  SoundBank.loopSound(SoundsID.ambientOne);
}
Engine.initialize({ setup, preload });
