import type { CornerRadius } from "@aurora/urp/draw/drawInternal";

// must match struct Clip and MAX_CLIP_DEPTH in shaders/drawWorldShader.wgsl
export const CLIP = Object.freeze({
  words: 12,
  idBits: 16,
  materialMask: 0xffff,
  maxDepth: 8,
});

export interface DrawClip {
  position: Position2D;
  size: Size2D;
  rotation?: number;
  rounded?: CornerRadius;
  inset?: number;
}
export interface ClipShape {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  radius: [number, number, number, number];
}

export function packMaterialClip(material: number, clip: number) {
  return (material | (clip << CLIP.idBits)) >>> 0;
}
export function materialOf(word: number) {
  return word & CLIP.materialMask;
}
