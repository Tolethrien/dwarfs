import { BUILDINGS, type BuildingsID } from "../content/structures";
import type { BuildingPlace } from "../systems/buildings";
import { SURFACE } from "../content/surface";

export interface BuildingSprite {
  box: Box;
  crop: Crop;
  flip: boolean;
  // world pixels, mirrored with the sprite
  door: Position2D | undefined;
}

// where a building's sprite lies in the world, for its look and for the mist's mask: drawn for the
// left side of the shaft (the wall beam at the right, on the shaft's post), mirrored for the right
export function buildingSprite(id: BuildingsID, place: BuildingPlace, tile: number): BuildingSprite {
  const data = BUILDINGS[id];
  const base = place.base;
  const beam = data.wallBeam ? tile : 0;
  const flip = place.side === "right";
  const ground = base.y < 0 ? SURFACE.ground : 0;
  const box = {
    x: flip ? base.x * tile - beam : (base.x + base.w) * tile + beam - data.sprite.width,
    y: (base.y + base.h) * tile - data.sprite.height - ground,
    w: data.sprite.width,
    h: data.sprite.height,
  };
  const door = data.door;
  return {
    box: box,
    crop: data.sprite,
    flip: flip,
    door: door && { x: box.x + (flip ? box.w - door.x : door.x), y: box.y + door.y },
  };
}
