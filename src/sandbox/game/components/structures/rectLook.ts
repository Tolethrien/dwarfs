import PragmaComponent from "@pragma/component";
import AABB, { type Bounds } from "@axiom/AABB";
import AxiomMath from "@axiom/math";
import { Draw } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import { SORT_ORDER } from "../../content/render";
import Terrain from "../../systems/world/terrain";
import Durability from "./durability";

export interface RectLookStyle {
  readonly fill: RGBA;
  readonly border: RGBA;
  readonly borderWidth: number;
  readonly damagedShade: number;
}

export interface RectLookProps {
  rect: Rect;
  look: RectLookStyle;
  zIndex?: number;
}

export default class RectLook extends PragmaComponent {
  private readonly rect: Rect;
  private readonly look: RectLookStyle;
  private readonly zIndex: number;
  private readonly bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  declare private terrain: Terrain;

  constructor(internal: InternalPCProps, props: RectLookProps) {
    super(internal);
    this.rect = { ...props.rect };
    this.look = props.look;
    this.zIndex = props.zIndex ?? SORT_ORDER.buildings;
    AABB.rotatedBounds(this.bounds, this.rect.x, this.rect.y, this.rect.w, this.rect.h, this.rect.rotation);
  }

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
  }

  render(): void {
    const view = Camera.getViewBounds;
    if (
      this.bounds.maxX < view.min.x ||
      this.bounds.minX > view.max.x ||
      this.bounds.maxY < view.min.y ||
      this.bounds.minY > view.max.y
    )
      return;
    const durability = this.getSibling(Durability);
    const hurt = durability ? durability.hurt : 0;
    const look = this.look;
    const shade = AxiomMath.lerp(1, look.damagedShade, hurt);
    const fill: RGBA = [look.fill[0] * shade, look.fill[1] * shade, look.fill[2] * shade, look.fill[3]];
    const border: RGBA = [look.border[0] * shade, look.border[1] * shade, look.border[2] * shade, look.border[3]];
    const rect = this.rect;
    Draw.rect({
      position: { x: rect.x - rect.w / 2, y: rect.y - rect.h / 2, z: this.zIndex },
      size: { width: rect.w, height: rect.h },
      rotation: rect.rotation,
      color: fill,
      outline: { width: look.borderWidth * this.terrain.tile, color: border },
    });
  }
}
