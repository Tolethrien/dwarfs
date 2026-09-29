type Size2D = { width: number; height: number };
type Size3D = { width: number; height: number; depth: number };
type Position2D = { x: number; y: number };
type Position3D = { x: number; y: number; z: number };
type RGB = [number, number, number];
type RGBA = [number, number, number, number];
type HSL = [number, number, number];
type HSLA = [number, number, number, number];
type HEX = string;
type Color = RGB | RGBA | HSL | HSLA | HEX;
type Box = { x: number; y: number; w: number; h: number };
type BoxAABB = { min: { x: number; y: number }; max: { x: number; y: number } };
type Circle = { x: number; y: number; r: number };
type Rect = { x: number; y: number; w: number; h: number; rotation: number };
type Capsule = { a: Position2D; b: Position2D; radius: number };
type Crop = { x: number; y: number; width: number; height: number };
type DeepOmit<T, K extends string> =
  T extends Array<infer U>
    ? Array<DeepOmit<U, K>>
    : K extends `${infer Head}.${infer Tail}`
      ? {
          [P in keyof T]: P extends Head ? DeepOmit<T[P], Tail> : T[P];
        }
      : Omit<T, K>;
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepPartial<T[P]>
    : T[P];
};
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : DeepReadonly<T[P]>
    : T[P];
};
