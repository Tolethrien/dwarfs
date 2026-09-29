import {
  MultiPass,
  MultiPassContext,
  PassFormats,
  PassResources,
} from "@aurora/pass";
import Aurora from "@aurora/core";
import PassBinds, { PassBindEntries } from "@aurora/passBinds";
import FixedBuffer from "@aurora/utils/fixedBuffer";
import { AuroraUsage } from "@aurora/utils/usage";
import FullScreenQuad from "@aurora/utils/fullScreenQuad/fullScreen";
import effectShader from "../effects/effectShader.wgsl?raw";
import ScreenEffect from "../effects/screenEffect";
import { postDraw, ResolvedLayer } from "../draw/drawPost";
import { SCREEN_BLEND } from "./postPass";
import type { EffectMask, EffectStage } from "../draw/drawTypes";

// must match MASK_* in effects/effectShader.wgsl
export const EFFECT_MASK = Object.freeze({
  full: 0,
  vignette: 1,
} satisfies Record<EffectMask, number>);
const EFFECT_SLOT = "// EFFECT";
const EFFECT_PASS = Object.freeze({
  scratch: "scratch",
  layerWords: 16,
  bindCache: 8,
});
const EFFECT_BINDS = {
  source: { binding: 0, type: "texture" },
  layer: { binding: 1, type: "uniform" },
  lightMap: { binding: 2, type: "texture" },
} satisfies PassBindEntries;

export default class EffectPass extends MultiPass {
  readonly name: string;
  category = "world";
  private readonly stage: EffectStage;
  private readonly readsLight: boolean;
  private readonly pipelines: Map<number, GPURenderPipeline> = new Map();
  private readonly uniforms: FixedBuffer[] = [];
  private readonly labels: string[] = [];
  declare private binds: PassBinds<typeof EFFECT_BINDS>;

  constructor(stage: EffectStage) {
    super();
    this.stage = stage;
    this.name = `EffectPass:${stage}`;
    this.readsLight = stage === "world";
  }
  enabled() {
    return this.runnable().length > 0;
  }
  destroy() {
    for (const uniform of this.uniforms) uniform.destroy();
  }
  async setup(targets: PassFormats) {
    this.binds = new PassBinds(
      `effectPass:${this.stage}`,
      EFFECT_BINDS,
      EFFECT_PASS.bindCache,
    );
    const colors = [targets.formats.get("offscreenCanvas")!];
    const effects = ScreenEffect.getAll;
    const pipelines = await Promise.all(
      effects.map((effect) =>
        FullScreenQuad.createPipeline(
          { colors },
          {
            label: `EffectPass:${this.stage}:${effect.name}`,
            shader: effectShader.replace(EFFECT_SLOT, effect.fragment),
            binds: this.binds.layout,
          },
        ),
      ),
    );
    effects.forEach((effect, index) =>
      this.pipelines.set(effect.id, pipelines[index]),
    );
  }
  resources(res: PassResources) {
    res.modify("offscreenCanvas", { clear: false });
    res.temp(
      EFFECT_PASS.scratch,
      { format: "rgba16float", size: { scale: 1, base: "render" } },
      { clear: false },
    );
    if (this.readsLight) res.read("lightMap");
    res.sampler("linearClamp");
  }
  execute(_encoder: GPUCommandEncoder, ctx: MultiPassContext) {
    const layers = this.runnable();
    let source = ctx.view("offscreenCanvas");
    const lightMap = this.readsLight ? ctx.view("lightMap") : source;
    let toScratch = layers.length % 2 === 0;
    layers.forEach((layer, index) => {
      const target = toScratch ? EFFECT_PASS.scratch : "offscreenCanvas";
      const step = ctx.beginRender(this.label(index), {
        colors: [{ name: target }],
      });
      step.setPipeline(this.pipelines.get(layer.effect.id)!);
      step.setBindGroup(
        2,
        this.binds.get({
          source,
          layer: this.writeLayer(index, layer).getBuffer,
          lightMap,
        }),
      );
      FullScreenQuad.draw(step);
      step.end();
      source = ctx.output(target);
      toScratch = !toScratch;
    });
  }

  private runnable() {
    return postDraw
      .getEffectLayers(this.stage)
      .filter((layer) => this.pipelines.has(layer.effect.id));
  }
  private writeLayer(index: number, layer: ResolvedLayer) {
    let uniform = this.uniforms[index];
    if (!uniform) {
      uniform = new FixedBuffer({
        label: `effectPass:${this.stage}:${index}`,
        words: EFFECT_PASS.layerWords,
        usage: AuroraUsage.uniform,
      });
      this.uniforms[index] = uniform;
    }
    const { floats, uints } = uniform;
    floats[0] = Aurora.colorChannel(layer.color[0]);
    floats[1] = Aurora.colorChannel(layer.color[1]);
    floats[2] = Aurora.colorChannel(layer.color[2]);
    floats[3] = layer.intensity;
    floats.set(layer.params, 4);
    floats[8] = layer.center.x;
    floats[9] = layer.center.y;
    floats[10] = layer.smoothness;
    floats[11] = layer.roundness;
    floats[12] = layer.reach;
    uints[13] = EFFECT_MASK[layer.mask];
    uints[14] = SCREEN_BLEND[layer.blend];
    uints[15] = this.readsLight ? 1 : 0;
    uniform.upload();
    return uniform;
  }
  private label(index: number) {
    return (this.labels[index] ??= `layer:${index}`);
  }
}
