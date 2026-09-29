import type Material from "@aurora/material";
import type ScreenEffect from "../effects/screenEffect";
import type { CornerRadius, DrawAtlas } from "./drawInternal";

export type { CornerRadius, DrawAtlas };
export type { DrawClip } from "../clip/clip";
export type MaterialParams = [number, number, number, number];
export type LineCap = "butt" | "round" | "square";
export type UvScope = "glyph" | "text";

export interface Outline {
  width: number;
  color: RGBA;
}
export interface DrawShadow {
  color: RGBA;
  offset?: Position2D;
  blur?: number;
  spread?: number;
  inset?: boolean;
}

export interface DrawBackdrop {
  blur: number;
}

export interface Outlined {
  outline?: Outline;
}
export interface Materialed {
  material?: Material;
  params?: MaterialParams;
}
export interface ShapeStyle extends Outlined, Materialed {}
export interface Filled extends ShapeStyle {
  color?: RGBA;
}

export interface RectBase extends Filled {
  position: Position2D;
  size: Size2D;
  rotation?: number;
  rounded?: CornerRadius;
}
export interface CircleBase extends Filled {
  position: Position2D;
  radius: number;
}
export interface EllipseBase extends Filled {
  position: Position2D;
  size: Size2D;
  rotation?: number;
}
export interface LineBase extends Filled {
  from: Position2D;
  to: Position2D;
  width: number;
  cap?: LineCap;
}
export interface SpriteBase extends ShapeStyle {
  position: Position2D;
  size?: Size2D;
  tint?: RGBA;
  texture: string;
  atlas?: DrawAtlas;
  crop?: Crop;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  rounded?: CornerRadius;
}
export interface QuadBase extends Materialed {
  points: [Position2D, Position2D, Position2D, Position2D];
  color?: RGBA;
  texture?: string;
  atlas?: DrawAtlas;
  crop?: Crop;
}
export interface TextStyleBase extends ShapeStyle {
  position: Position2D;
  color?: RGBA;
  uvScope?: UvScope;
}
export interface TextBase extends TextStyleBase {
  text: string;
  font?: string;
  size?: number;
  letterSpacing?: number;
  kerning?: boolean;
}
export interface TextBoxBase extends TextStyleBase {
  scale?: number;
}
export interface CharBase extends TextStyleBase {
  char: string;
  font?: string;
  size?: number;
}

export interface Sortable {
  sort?: Position3D;
}
export interface Rect extends RectBase, Sortable {
  position: Position3D;
}
export interface Circle extends CircleBase, Sortable {
  position: Position3D;
}
export interface Ellipse extends EllipseBase, Sortable {
  position: Position3D;
}
export interface Line extends LineBase, Sortable {
  z: number;
}
export interface Sprite extends SpriteBase, Sortable {
  position: Position3D;
}
export interface Quad extends QuadBase, Sortable {
  z: number;
}
export interface Text extends TextBase, Sortable {
  position: Position3D;
}
export interface TextBoxStyle extends TextBoxBase, Sortable {
  position: Position3D;
}
export interface Char extends CharBase, Sortable {
  position: Position3D;
}

// gui: drawn in call order, no z and no sort
export interface Shadowed {
  shadow?: DrawShadow | DrawShadow[];
}
// blurs everything drawn under the shape, the scene and earlier gui
export interface Backdropped {
  backdrop?: DrawBackdrop;
}
export interface GuiRect extends RectBase, Shadowed, Backdropped {}
export interface GuiCircle extends CircleBase, Shadowed, Backdropped {}
export type GuiEllipse = EllipseBase;
export type GuiLine = LineBase;
export interface GuiSprite extends SpriteBase, Shadowed, Backdropped {}
export type GuiQuad = QuadBase;
export interface GuiText extends TextBase, Shadowed {}
export interface GuiTextBoxStyle extends TextBoxBase, Shadowed {}
export interface GuiChar extends CharBase, Shadowed {}

export interface AmbientLight {
  enabled: boolean;
  from: RGBA;
  to: RGBA;
  angle: number;
  intensity: number;
}
export interface LightBase {
  color?: RGBA;
  intensity?: number;
  falloff?: number;
}
export interface PointLight extends LightBase {
  position: Position2D;
  radius: number;
}
export interface RectLight extends LightBase {
  position: Position2D;
  size: Size2D;
  rotation?: number;
  rounded?: CornerRadius;
  softness?: number;
}
export interface EllipseLight extends LightBase {
  position: Position2D;
  size: Size2D;
  rotation?: number;
  softness?: number;
}

export interface DiffusionProps {
  amount: number;
  radius: number;
  haze: number;
  hazeColor: RGBA;
}
export type ToneMapMode = "none" | "reinhard" | "aces" | "filmic" | "agx";
export type AgxLook = "none" | "punchy" | "golden";
export interface ColorGrading {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  hueShift: number;
  filter: RGBA;
  sepia: number;
  invert: number;
}
export interface RadialBlur {
  strength: number;
  center: Position2D;
  samples: number;
}
export interface ChromaticAberration {
  intensity: number;
  center: Position2D;
}
export type ScreenBlend = "multiply" | "mix" | "additive";
export interface Vignette {
  intensity: number;
  smoothness: number;
  roundness: number;
  center: Position2D;
  color: RGBA;
  blend: ScreenBlend;
}
export interface Flash {
  color: RGBA;
  amount: number;
}
export type EffectStage = "world" | "hdr" | "screen";
export type EffectMask = "full" | "vignette";
export interface EffectLayer {
  effect: ScreenEffect;
  params?: MaterialParams;
  intensity?: number;
  blend?: ScreenBlend;
  color?: RGBA;
  mask?: EffectMask;
  reach?: number;
  smoothness?: number;
  roundness?: number;
  center?: Position2D;
}
export interface FlashOptions {
  amount?: number;
  rise?: number;
}
export interface FilmGrain {
  intensity: number;
  response: number;
  size: number;
}
export interface SceneBlur {
  sigma: number;
  amount: number;
  mask: EffectMask;
  reach: number;
  smoothness: number;
  roundness: number;
  center: Position2D;
}
export interface BloomProps {
  enabled: boolean;
  threshold: number;
  knee: number;
  intensity: number;
  scatter: number;
  passes: number;
}
