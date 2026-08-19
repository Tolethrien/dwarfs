import auroraConfig from "@/core/aurora/renderer/config";
import Renderer from "@/core/aurora/renderer/renderer";
import Engine from "@/core/engine/engine";
import Pragma from "@/core/pragma/pragma";
import chars from "@sandbox/assets/chars.png";
import stones from "@sandbox/assets/stones.png";
import PhysBall from "./systems/physics/physBall";
import PlayerInputs from "./systems/inputs/playerInput";
import MapSystem from "./systems/map/mapSystem";
import MapObject from "./managers/mapObject";
import CameraActor from "./systems/camera/cameraActor";
import CameraObject from "./managers/cameraObject";
import { registerInputsBindings } from "./inputActions";

async function preload() {
  const aurora = auroraConfig({
    userTextures: [
      { name: "chars", url: chars },
      { name: "stones", url: stones },
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
}
function setup() {
  registerInputsBindings();
  const world = Pragma.addScene("testSetup");
  world.spawnActor(new PhysBall());
  world.spawnActor(new PlayerInputs());
  world.spawnActor(new MapSystem());
  CameraObject.setZoom(0.05);
  world.spawnActor(new CameraActor());
}
Engine.initialize({ setup, preload });
