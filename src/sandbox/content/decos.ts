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
  // the whole tile takes the click
  clickable: boolean;
  // index = variant bits of the deco, whole tile crops in SPRITES.deco; empty = no graphics yet,
  // not drawn (still clickable)
  variants: Crop[];
}

export const DECOS: Record<Exclude<DecosID, DecosID.none>, DecoDefinition> = {
  [DecosID.mushroom]: {
    layer: "back",
    attached: "below",
    permanent: false,
    clickable: true,
    variants: [],
  },
  [DecosID.stalactite]: {
    layer: "front",
    attached: "above",
    permanent: false,
    clickable: false,
    variants: [
      { x: 576, y: 0, width: 96, height: 96 },
      { x: 672, y: 0, width: 96, height: 96 },
    ],
  },
  [DecosID.moss]: {
    layer: "front",
    attached: "self",
    permanent: false,
    clickable: false,
    variants: [
      { x: 192, y: 0, width: 96, height: 96 },
      { x: 288, y: 0, width: 96, height: 96 },
      { x: 384, y: 0, width: 96, height: 96 },
      { x: 480, y: 0, width: 96, height: 96 },
    ],
  },
  [DecosID.chains]: {
    layer: "back",
    attached: "above",
    permanent: true,
    clickable: false,
    variants: [
      { x: 768, y: 0, width: 96, height: 96 },
      { x: 864, y: 0, width: 96, height: 96 },
    ],
  },
  // drawn by its actor (DecoView), not by the chunk batch
  [DecosID.torch]: {
    layer: "back",
    attached: "below",
    permanent: false,
    clickable: false,
    variants: [
      { x: 0, y: 0, width: 96, height: 96 }, // torch
      { x: 96, y: 0, width: 96, height: 96 }, // lantern
    ],
  },
};

export function getDeco(type: number) {
  const deco = DECOS[type as Exclude<DecosID, DecosID.none>];
  assert(deco !== undefined, `no deco with id ${type}`);
  return deco;
}

// undefined: no graphics yet; a save can hold a variant the table no longer has
export function getDecoCrop(type: number, variant: number): Crop | undefined {
  const variants = getDeco(type).variants;
  return variants[variant] ?? variants[0];
}
