import { COLOR } from "@axiom/color";
import { debug } from "@debug";
import VertexLayout from "@aurora/utils/vertexLayout";
import RenderGraph from "@aurora/renderGraph";
import type LightPass from "../passes/lightPass";
import { clearShapeData, writeCorners } from "./drawInternal";
import type {
  AmbientLight,
  ConeLight,
  EllipseLight,
  LightBase,
  PointLight,
  RectLight,
} from "./drawTypes";

// must match InstanceIn in shaders/lightShader.wgsl, locations in field order
export const LIGHT_LAYOUT = new VertexLayout(
  {
    position: "float32x2",
    size: "float32x2",
    rotation: "float32",
    color: "unorm8x4",
    intensity: "float32",
    shape: "uint32",
    softness: "float32",
    falloff: "float32",
    // box: corner radii, like shapeData of a draw instance; cone: spread, softness
    shapeData: "float32x4",
  },
  { stepMode: "instance" },
);
export type LightWriter = ReturnType<typeof LIGHT_LAYOUT.createWriter>;

// must match SHAPE_* in shaders/lightShader.wgsl
export enum LightShape {
  Box = 0,
  Ellipse = 1,
  Cone = 2,
  OccludedBox = 3,
}
const DEFAULT_FALLOFF = 4;
const CONE = { softness: 0.35, maxSpread: Math.PI / 2 };

export class LightDraw {
  private target: LightPass | null = null;
  private readonly targetWarning = debug.log.scope("auroraURP").once();
  private readonly ambient: AmbientLight = {
    enabled: true,
    from: COLOR.WHITE,
    to: COLOR.WHITE,
    angle: 0,
    intensity: 1,
  };
  private occlusion = "fn lightVisibility(light: vec2f, pixel: vec2f) -> f32 { return 1.0; }";

  public setTarget(target: LightPass) {
    this.target = target;
  }
  public get getAmbient(): Readonly<AmbientLight> {
    return this.ambient;
  }

  public get getEnabled() {
    return this.ambient.enabled;
  }
  public setAmbient(props: Partial<AmbientLight>) {
    Object.assign(this.ambient, props);
  }
  public point(props: PointLight) {
    const { position, radius } = props;
    const size = radius * 2;
    const view = this.writeLight(props, size, size);
    if (!view) return;
    view.position(position.x - radius, position.y - radius);
    view.rotation(0);
    view.shape(props.occluded ? LightShape.OccludedBox : LightShape.Box);
    view.softness(radius);
    writeCorners(view, radius);
  }
  public rect(props: RectLight) {
    const { position, size } = props;
    const view = this.writeLight(props, size.width, size.height);
    if (!view) return;
    view.position(position.x, position.y);
    view.rotation(props.rotation ?? 0);
    view.shape(LightShape.Box);
    view.softness(props.softness ?? Math.min(size.width, size.height) / 2);
    writeCorners(view, props.rounded);
  }
  public ellipse(props: EllipseLight) {
    const { position, size } = props;
    const view = this.writeLight(props, size.width, size.height);
    if (!view) return;
    view.position(position.x - size.width / 2, position.y - size.height / 2);
    view.rotation(props.rotation ?? 0);
    view.shape(LightShape.Ellipse);
    view.softness(props.softness ?? Math.min(size.width, size.height) / 2);
    clearShapeData(view);
  }
  // the quad holds just the beam: length along the direction, as wide as the spread opens
  public cone(props: ConeLight) {
    const { position, direction, length } = props;
    const spread = Math.min(props.spread, CONE.maxSpread);
    const width = length;
    const height = 2 * length * Math.sin(spread);
    const view = this.writeLight(props, width, height);
    if (!view) return;
    const center = {
      x: position.x + (Math.cos(direction) * length) / 2,
      y: position.y + (Math.sin(direction) * length) / 2,
    };
    view.position(center.x - width / 2, center.y - height / 2);
    view.rotation(direction);
    view.shape(LightShape.Cone);
    view.softness(0);
    view.shapeData(spread, props.softness ?? CONE.softness, props.occluded ? 1 : 0, 0);
  }

  // what blocks occluded lights: WGSL defining fn lightVisibility(light: vec2f, pixel: vec2f) -> f32
  // (world points, 1 lit, 0 blocked); it may read the globals (Aurora.addGlobal)
  public setOcclusion(code: string) {
    this.occlusion = code;
    if (RenderGraph.isBuilt) void RenderGraph.rebuild();
  }
  public get getOcclusion() {
    return this.occlusion;
  }

  private writeLight(props: LightBase, width: number, height: number) {
    if (!this.ambient.enabled) return null;
    const color = props.color ?? COLOR.WHITE;
    const intensity = props.intensity ?? 1;
    if (color[3] === 0 || intensity <= 0 || width <= 0 || height <= 0) {
      return null;
    }
    const target = this.target;
    if (!target) {
      this.warnNoTarget();
      return null;
    }
    const view = target.push();
    view.size(width, height);
    view.color(color[0], color[1], color[2], color[3]);
    view.intensity(intensity);
    view.falloff(props.falloff ?? DEFAULT_FALLOFF);
    return view;
  }
  private warnNoTarget() {
    this.targetWarning.warn(
      "Light: nothing to draw into yet, call it after URP.init and Aurora.build",
    );
  }
}

export const lightDraw = new LightDraw();
