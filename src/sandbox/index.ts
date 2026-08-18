import auroraConfig from "@/core/aurora/renderer/config";
import Renderer from "@/core/aurora/renderer/renderer";
import Engine from "@/core/engine/engine";
import Pragma from "@/core/pragma/pragma";
import chars from "@sandbox/assets/chars.png";
import stones from "@sandbox/assets/stones.png";
import Deposit from "./bActors/deposit";
import AuroraCamera from "@/core/aurora/camera";
import PragmaScene from "@/core/pragma/scene";
import Grid from "@/core/axiom/grid";
import PhysBall from "./systems/physics/physBall";
import PlayerInputs from "./systems/inputs/playerInput";
import MapSystem from "./systems/map/mapSystem";
import MapObject from "./managers/mapObject";
import map from "@sandbox/assets/map.json";
interface MapTileData {
  index: number;
  type: number;
}
interface MapGrid {
  width: number;
  height: number;
  tiles: MapTileData[];
}
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
    camera: { builtInCameraInputs: true, speed: 15 },
    rendering: {
      sortOrder: "y",
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
  const world = Pragma.addScene("testSetup");
  AuroraCamera.scale(0.05);
  world.spawnActor(new PhysBall());
  world.spawnActor(new PlayerInputs());
  world.spawnActor(new MapSystem());
  // const dwarf = new Dwarf({ position: { x: 150, y: 150 } });
  //reszta
  // world.spawnActor(dwarf);
  // spawnMapFromJson(world, map, { height: 96, width: 96 });
}
Engine.initialize({ setup, preload });

export function spawnMapFromJson(
  scene: PragmaScene,
  map: MapGrid,
  tileSize: Size2D,
) {
  for (const tile of map.tiles) {
    const gridPos = Grid.indexToTile(tile.index, map.width);
    const worldPos = Grid.tileCenterToWorld(gridPos, tileSize);

    const deposit = new Deposit({ position: worldPos, type: tile.type });
    scene.spawnActor(deposit);
  }
}
