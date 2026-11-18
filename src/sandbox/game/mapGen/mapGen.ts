import Noise from "@axiom/noise";
import { BLOCK_LOOKS, BlocksID } from "../content/blocks";
import { BACKGROUNDS, BackgroundsID } from "../content/backgrounds";
import type World from "../world/world";
import { generateShape, ShapeTile } from "./shape";
import { rockAt } from "./rocks";
import { carveCaves } from "./caves";
import { placeBiomes } from "./biomes";
import { placeOres } from "./ores";

export const MAP_GEN = {
  world: { mapInTiles: { width: 320, height: 1280 }, tileInPixels: 96 },
};

const SALT = { look: 1, backgroundLook: 2 };

export function generateMap(world: World, seed: number) {
  const noise = new Noise(seed);
  const shape = generateShape(world.mapInTiles, seed);
  const backgroundLooks = BACKGROUNDS[BackgroundsID.rock].looks;
  for (let gy = 0; gy < world.mapInTiles.height; gy++)
    for (let gx = 0; gx < world.mapInTiles.width; gx++) {
      const tile = shape[gx + gy * world.mapInTiles.width];
      if (tile === ShapeTile.void) {
        world.setTile(gx, gy, BlocksID.void);
        continue;
      }
      const look = pickIndex(BLOCK_LOOKS, noise.white3D(gx, gy, SALT.look));
      world.setTile(
        gx,
        gy,
        tile === ShapeTile.map ? rockAt(noise, gx, gy) : BlocksID.obsidian,
        look,
      );
      if (tile === ShapeTile.map)
        world.setBackground(
          gx,
          gy,
          BackgroundsID.rock,
          pickIndex(
            backgroundLooks,
            noise.white3D(gx, gy, SALT.backgroundLook),
          ),
        );
    }
  placeBiomes(world, seed);
  carveCaves(world, seed);
  placeOres(world, seed);
}

function pickIndex(count: number, share: number) {
  return Math.min(Math.floor(share * count), count - 1);
}
