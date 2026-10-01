import { SPRITES } from "./sprites";

export enum AnimsID {
  none,
  sparks,
  explode,
  chest,
}

export interface AnimData {
  crop: Crop; // of 1 frame
  frames: number;
  fps: number;
  texture: string;
}

export const ANIMATIONS: Record<AnimsID, AnimData> = {
  [AnimsID.none]: {
    crop: { x: 0, y: 0, width: 0, height: 0 },
    fps: 0,
    frames: 0,
    texture: SPRITES.base,
  },
  [AnimsID.sparks]: {
    crop: { x: 0, y: 0, width: 94, height: 79 },
    fps: 30,
    frames: 8,
    texture: SPRITES.anims,
  },
  [AnimsID.explode]: {
    crop: { x: 0, y: 79, width: 94, height: 79 },
    fps: 30,
    frames: 8,
    texture: SPRITES.anims,
  },
  [AnimsID.chest]: {
    crop: { x: 0, y: 158, width: 96, height: 96 },
    fps: 30,
    frames: 4,
    texture: SPRITES.anims,
  },
};
