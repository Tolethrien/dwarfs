import { BUILDINGS, type BuildingsID } from "../content/structures";
import { SURFACE } from "../content/surface";
import { shaftColumns } from "./shaftShape";
import type World from "./world";

export type ShaftSide = "left" | "right";

export interface BuildingPlace {
  side: ShaftSide;
  base: Box;
  reserve: Box;
}

export interface BuildingSprite {
  box: Box;
  crop: Crop;
  flip: boolean;
  // world pixels, mirrored with the sprite
  door: Position2D | undefined;
}

export function buildingPlaceAt(world: World, id: BuildingsID, tile: Position2D): BuildingPlace {
  const data = BUILDINGS[id];
  const columns = shaftColumns(world);
  const side: ShaftSide = tile.x < (columns.from + columns.to + 1) / 2 ? "left" : "right";
  const width = data.size.width;
  const top = tile.y - Math.floor(data.size.height / 2);
  const baseX = side === "left" ? columns.from - width : columns.to + 1;
  const reserve = data.reserve;
  return {
    side: side,
    base: { x: baseX, y: top, w: width, h: data.size.height },
    reserve: {
      x: side === "left" ? baseX - reserve.away : baseX,
      y: top - reserve.up,
      w: width + reserve.away,
      h: data.size.height + reserve.up + reserve.down,
    },
  };
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
