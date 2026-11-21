import { Draw } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import { CULL_MARGIN } from "../../content/render";
import PragmaComponent from "@pragma/component";
import Transform from "@pragma/transform";
import StructurePlan, { type PlanLook } from "../../gpu/structurePlan";
import type { LightsID } from "../../content/lights";
import { glowMaterial, glowParams } from "./lamp";
export interface SpriteLayer {
  crop: Crop;
  tint?: RGBA;
  offset?: Position2D;
  size?: Size2D;
  repeat?: boolean;
  z?: number;
}
export type RectLayer = SpriteLayer & { offset: Position2D; size: Size2D };
interface LayeredSpriteProps {
  sprite: string;
  size: Size2D;
  layers: SpriteLayer[];
  zIndex: number;
  plan?: PlanLook;
  // a lamp: the sprite glows with its light's glow, unlit
  glow?: LightsID;
}
export default class LayeredSprite extends PragmaComponent {
  declare private transform: Transform;
  // one scratch box for all sprites: render is a hot path and the box is done with after the check
  private static readonly bounds: Box = { x: 0, y: 0, w: 0, h: 0 };
  public sprite: LayeredSpriteProps["sprite"];
  public size: LayeredSpriteProps["size"];
  public layers: LayeredSpriteProps["layers"];
  public zIndex: LayeredSpriteProps["zIndex"];
  public readonly plan: LayeredSpriteProps["plan"];
  public readonly glow: LayeredSpriteProps["glow"];
  public flipX = false;
  constructor(internal: InternalPCProps, props: LayeredSpriteProps) {
    super(internal);
    this.sprite = props.sprite;
    this.size = props.size;
    this.layers = props.layers;
    this.zIndex = props.zIndex;
    this.plan = props.plan;
    this.glow = props.glow;
  }
  start(): void {
    this.transform = this.actor.transform;
  }
  render(): void {
    const pos = this.transform.getRenderPosition();
    const scale = this.transform.getScale();
    const width = this.size.width * scale.x;
    const height = this.size.height * scale.y;
    const x = pos.x - width / 2;
    const y = pos.y - height / 2;
    const frameInView = this.inView(x, y, width, height);

    const rotation = this.transform.getRenderRotation();
    for (const layer of this.layers) {
      const z = this.zIndex + (layer.z ?? 0);
      if (!layer.size) {
        if (frameInView) this.draw(layer, x, y, width, height, z, rotation);
        continue;
      }
      const layerX = x + (layer.offset?.x ?? 0) * scale.x;
      const layerY = y + (layer.offset?.y ?? 0) * scale.y;
      const layerWidth = layer.size.width * scale.x;
      const layerHeight = layer.size.height * scale.y;
      if (!layer.repeat) {
        if (this.inView(layerX, layerY, layerWidth, layerHeight))
          this.draw(
            layer,
            layerX,
            layerY,
            layerWidth,
            layerHeight,
            z,
            rotation,
          );
        continue;
      }
      const step = layer.crop.height * scale.y;
      for (let pieceY = layerY; pieceY < layerY + layerHeight; pieceY += step) {
        if (this.inView(layerX, pieceY, layerWidth, step))
          this.draw(layer, layerX, pieceY, layerWidth, step, z, rotation);
      }
    }
  }

  public drawAt(position: Position3D, size: number) {
    for (const layer of this.layers) {
      Draw.sprite({
        position: position,
        size: { width: size, height: size },
        texture: this.sprite,
        crop: layer.crop,
        tint: layer.tint,
        flipX: this.flipX,
      });
    }
  }

  private inView(x: number, y: number, width: number, height: number) {
    const bounds = LayeredSprite.bounds;
    bounds.x = x;
    bounds.y = y;
    bounds.w = width;
    bounds.h = height;
    return Camera.isInView(bounds, CULL_MARGIN);
  }

  private draw(
    layer: SpriteLayer,
    x: number,
    y: number,
    width: number,
    height: number,
    z: number,
    rotation: number,
  ) {
    Draw.sprite({
      position: { x: x, y: y, z: z },
      crop: layer.crop,
      size: { height: height, width: width },
      texture: this.sprite,
      tint: layer.tint,
      rotation: rotation,
      flipX: this.flipX,
      material: this.materialOf(),
      params: this.paramsOf(),
    });
  }

  private materialOf() {
    if (this.glow === undefined) return StructurePlan.materialOf(this.plan);
    return glowMaterial(this.plan ?? "plan");
  }

  private paramsOf() {
    if (this.glow === undefined) return StructurePlan.paramsOf(this.plan);
    return glowParams(this.glow, this.plan ?? "plan");
  }
}
