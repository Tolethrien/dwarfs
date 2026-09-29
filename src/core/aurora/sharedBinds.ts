import { assert } from "@axiom/utils";
import Time from "@engine/time";
import AssetManager, { AssetName } from "./assetManager";
import Aurora from "./core";
import WorldView from "./worldView";
export interface GlobalBinding {
  binding: number;
  visibility?: GPUShaderStageFlags;
  layout: Pick<
    GPUBindGroupLayoutEntry,
    "buffer" | "texture" | "sampler" | "storageTexture"
  >;
  resource: GPUBindingResource;
}
export type SamplerName =
  | "nearestClamp"
  | "linearClamp"
  | "trilinearClamp"
  | "nearestRepeat"
  | "linearRepeat";

const ASSET_BINDINGS: Record<AssetName, number> = {
  albedo: 0,
  normal: 1,
  height: 2,
  ui: 3,
  fonts: 4,
};
const FIRST_GLOBAL_BINDING = 4;
const SAMPLER_BINDING = 5;
// fixed samplers for fonts, independent of the sampler a pass picks
const FONT_SAMPLER_BINDINGS: [number, SamplerName][] = [
  [6, "nearestClamp"],
  [7, "linearClamp"],
];
export const ALL_STAGES =
  GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE;
const TIME_WRAP = 3600;

export default class SharedBinds {
  declare private static frameLayout: GPUBindGroupLayout;
  declare private static frameBindGroup: GPUBindGroup;
  declare private static assetsLayout: GPUBindGroupLayout;
  private static samplers: Map<SamplerName, GPUSampler> = new Map();
  private static assetsBindGroups: Map<SamplerName, GPUBindGroup> = new Map();
  declare private static frameBuffer: GPUBuffer;
  declare private static cameraBuffer: GPUBuffer;
  private static cameraGpu = new Float32Array(4);
  private static frameData = new ArrayBuffer(40);
  private static frameFloats = new Float32Array(this.frameData);
  private static frameUints = new Uint32Array(this.frameData);
  private static gameTime = 0;
  private static frameIndex = 0;
  private static globals: Map<number, GlobalBinding> = new Map();
  private static frameDirty = false;
  public static init() {
    this.frameBuffer = Aurora.device.createBuffer({
      label: "frameBuffer",
      size: this.frameData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.cameraBuffer = Aurora.device.createBuffer({
      label: "cameraBuffer",
      size: this.cameraGpu.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.samplers.set(
      "nearestClamp",
      Aurora.device.createSampler({ label: "nearestClamp" }),
    );
    this.samplers.set(
      "linearClamp",
      Aurora.device.createSampler({
        label: "linearClamp",
        magFilter: "linear",
        minFilter: "linear",
      }),
    );
    // blends mip levels too, for sprites drawn smaller than their texels; linearClamp keeps
    // nearest mips, a fractional level there picks one level (backdrop pyramid)
    this.samplers.set(
      "trilinearClamp",
      Aurora.device.createSampler({
        label: "trilinearClamp",
        magFilter: "linear",
        minFilter: "linear",
        mipmapFilter: "linear",
      }),
    );
    this.samplers.set(
      "nearestRepeat",
      Aurora.device.createSampler({
        label: "nearestRepeat",
        addressModeU: "repeat",
        addressModeV: "repeat",
      }),
    );
    this.samplers.set(
      "linearRepeat",
      Aurora.device.createSampler({
        label: "linearRepeat",
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "repeat",
        addressModeV: "repeat",
      }),
    );
  }
  public static get isFrameDirty() {
    return this.frameDirty;
  }

  public static clearFrameDirty() {
    this.frameDirty = false;
  }
  public static buildFrame() {
    const layoutEntries: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: ALL_STAGES, buffer: { type: "uniform" } },
      { binding: 1, visibility: ALL_STAGES, buffer: { type: "uniform" } },
    ];
    const entries: GPUBindGroupEntry[] = [
      { binding: 0, resource: { buffer: this.frameBuffer } },
      { binding: 1, resource: { buffer: this.cameraBuffer } },
    ];

    this.globals.forEach((global) => {
      layoutEntries.push({
        binding: global.binding,
        visibility: global.visibility ?? ALL_STAGES,
        ...global.layout,
      });
      entries.push({ binding: global.binding, resource: global.resource });
    });

    this.frameLayout = Aurora.device.createBindGroupLayout({
      label: "frameLayout",
      entries: layoutEntries,
    });
    this.frameBindGroup = Aurora.device.createBindGroup({
      label: "frameBind",
      layout: this.frameLayout,
      entries,
    });
  }
  public static addGlobal(global: GlobalBinding) {
    assert(
      global.binding >= FIRST_GLOBAL_BINDING,
      `Global binding ${global.binding} is reserved by the engine, use ${FIRST_GLOBAL_BINDING} or higher`,
    );
    assert(
      !this.globals.has(global.binding),
      `Global binding ${global.binding} is already used`,
    );
    this.globals.set(global.binding, global);

    if (this.frameLayout === undefined) return;
    this.buildFrame();
    this.frameDirty = true;
  }
  public static buildAssets() {
    const layoutEntries: GPUBindGroupLayoutEntry[] = [];
    const entries: GPUBindGroupEntry[] = [];

    for (const name of Object.keys(ASSET_BINDINGS) as AssetName[]) {
      if (!AssetManager.hasAsset(name)) continue;
      const binding = ASSET_BINDINGS[name];
      layoutEntries.push({
        binding,
        visibility:
          GPUShaderStage.VERTEX |
          GPUShaderStage.FRAGMENT |
          GPUShaderStage.COMPUTE,
        texture: { viewDimension: "2d-array", sampleType: "float" },
      });
      entries.push({ binding, resource: AssetManager.getView(name) });
    }
    layoutEntries.push({
      binding: SAMPLER_BINDING,
      visibility:
        GPUShaderStage.VERTEX |
        GPUShaderStage.FRAGMENT |
        GPUShaderStage.COMPUTE,
      sampler: { type: "filtering" },
    });
    for (const [binding, samplerName] of FONT_SAMPLER_BINDINGS) {
      layoutEntries.push({
        binding,
        visibility: ALL_STAGES,
        sampler: { type: "filtering" },
      });
      entries.push({ binding, resource: this.samplers.get(samplerName)! });
    }

    this.assetsLayout = Aurora.device.createBindGroupLayout({
      label: "assetsLayout",
      entries: layoutEntries,
    });
    this.assetsBindGroups.clear();
    this.samplers.forEach((sampler, samplerName) => {
      this.assetsBindGroups.set(
        samplerName,
        Aurora.device.createBindGroup({
          label: `assetsBind:${samplerName}`,
          layout: this.assetsLayout,
          entries: entries.concat({
            binding: SAMPLER_BINDING,
            resource: sampler,
          }),
        }),
      );
    });
  }

  public static pipelineLayout(label: string, passLayout?: GPUBindGroupLayout) {
    const bindGroupLayouts = passLayout
      ? [this.frameLayout, this.assetsLayout, passLayout]
      : [this.frameLayout, this.assetsLayout];
    return Aurora.device.createPipelineLayout({ label, bindGroupLayouts });
  }

  public static get getFrame() {
    return this.frameBindGroup;
  }

  public static getAssets(sampler: SamplerName) {
    return this.assetsBindGroups.get(sampler)!;
  }
  public static updateFrame() {
    this.gameTime += Time.getDeltaTime();
    const renderSize = Aurora.getRenderSize;

    this.frameFloats[0] = this.gameTime % TIME_WRAP;
    this.frameFloats[1] = Time.getTimeInSeconds() % TIME_WRAP;
    this.frameFloats[2] = Time.getDeltaTime();
    this.frameFloats[3] = Time.getRawDeltaTime();
    this.frameFloats[4] = renderSize.width;
    this.frameFloats[5] = renderSize.height;
    this.frameFloats[6] = Aurora.canvas.width;
    this.frameFloats[7] = Aurora.canvas.height;
    this.frameUints[8] = this.frameIndex++;
    this.frameFloats[9] = Aurora.getRenderScale;

    Aurora.device.queue.writeBuffer(this.frameBuffer, 0, this.frameData);
    const transform = WorldView.getTransform;
    this.cameraGpu[0] = transform.x;
    this.cameraGpu[1] = transform.y;
    this.cameraGpu[2] = transform.scale;
    this.cameraGpu[3] = transform.rotation;
    Aurora.device.queue.writeBuffer(this.cameraBuffer, 0, this.cameraGpu);
  }
}
