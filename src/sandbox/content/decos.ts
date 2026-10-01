import { COLOR } from "@axiom/color";
import { assert } from "@axiom/utils";

// written into saves: never change or reuse a number
export enum DecosID {
  none = 0,
  mushroom = 1,
  stalactite = 2,
  moss = 3,
  chains = 4,
  torch = 5,
}
export type DecoName = Exclude<keyof typeof DecosID, "none">;

// back: behind the rock and the balls, front: over them
export type DecoLayer = "back" | "front";
// where it stands: self = on its own tile (a rock face), below = on the floor under it,
// above = hanging from the ceiling over it
export type DecoAttached = "self" | "below" | "above";

interface DecoDefinition {
  layer: DecoLayer;
  attached: DecoAttached;
  // stays when the tile it is attached to goes
  permanent: boolean;
  clickable: boolean;
  // where it is inside the tile, from its top-left: drawn there and clicked there
  area: { x: number; y: number; width: number; height: number };
  // placeholder until there are graphics
  color: RGBA;
}

export const DECOS: Record<Exclude<DecosID, DecosID.none>, DecoDefinition> = {
  [DecosID.mushroom]: {
    layer: "back",
    attached: "below",
    permanent: false,
    clickable: true,
    area: { x: 32, y: 56, width: 32, height: 40 },
    color: COLOR.CRIMSON,
  },
  [DecosID.stalactite]: {
    layer: "front",
    attached: "above",
    permanent: false,
    clickable: false,
    area: { x: 36, y: 0, width: 24, height: 60 },
    color: COLOR.GRAY,
  },
  [DecosID.moss]: {
    layer: "front",
    attached: "self",
    permanent: false,
    clickable: false,
    area: { x: 0, y: 0, width: 96, height: 16 },
    color: COLOR.FOREST_GREEN,
  },
  [DecosID.chains]: {
    layer: "back",
    attached: "above",
    permanent: true,
    clickable: false,
    area: { x: 40, y: 0, width: 8, height: 96 },
    color: COLOR.DARK_GRAY,
  },
  // drawn by its actor (DecoView), not by the chunk batch
  [DecosID.torch]: {
    layer: "back",
    attached: "below",
    permanent: false,
    clickable: false,
    area: { x: 40, y: 40, width: 16, height: 56 },
    color: COLOR.ORANGE,
  },
};

export function getDeco(type: number) {
  const deco = DECOS[type as Exclude<DecosID, DecosID.none>];
  assert(deco !== undefined, `no deco with id ${type}`);
  return deco;
}
