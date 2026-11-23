import type { Pass } from "@aurora/pass";
import type { GraphTexture } from "@aurora/renderGraph";
import type { GpuSteps } from "@aurora/timer";
import type { AuroraConfig, ChangeableRenderConfig } from "@aurora/config";
import type ScreenEffect from "@aurora/urp/effects/screenEffect";
import type Material from "@aurora/material";
import type { RenderPreset } from "@aurora/preset";
import type { LogScopeKey } from "./modules/log/scopes";
import type { WatchCells } from "./modules/watch/report";
import type { PostDraw } from "@aurora/urp/draw/drawPost";
import type { LightDraw } from "@aurora/urp/draw/drawLight";
import type { SortProps, URPProps } from "@aurora/urp/urp";
import type { TexturePreview } from "@aurora/urp/passes/previewPass";
import type {
  TweakCategory,
  TweakCategoryTab,
  TweakActionSectionInfo,
  TweakField,
  TweakFieldsSectionInfo,
} from "./modules/tweak/report";
import type Coroutine from "@engine/coroutines/coroutine";
import type { GameReport } from "./modules/game/report";

export interface ILogHandle {
  log(...args: unknown[]): void;
  success(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  notify(...args: unknown[]): void;
  throttle(ms: number): ILogHandle;
  changed(): ILogHandle;
  // with a key: the same handle on every call, so it can be used inline
  once(key?: string): ILogHandle;
}
export interface ILogger extends ILogHandle {
  scope(key: LogScopeKey): ILogHandle;
  endFrame(): void;
}
export interface IPerformanceModule {
  endFrame(frameTimeMs: number): void;
}
export interface AuroraDebugData {
  steps: Readonly<GpuSteps>;
  activePasses: readonly Pass[];
  textures: () => GraphTexture[];
  pool: () => {
    used: ReadonlyMap<GPUTexture, string>;
    free: ReadonlyMap<string, readonly GPUTexture[]>;
  };
  settings: () => DeepReadonly<AuroraConfig>;
  renderSize: () => Size2D;
  canvas: () => { width: number; height: number; format: GPUTextureFormat };
  materials: () => readonly Material[];
  preset: () => RenderPreset | null;
  // the settings pages edit through these: a debugger module importing the engine would be an import cycle
  setParameter: (props: DeepPartial<ChangeableRenderConfig>) => void;
}
export interface IAuroraModule {
  connect(source: () => AuroraDebugData): void;
  endFrame(): void;
  beginPass(pass: Pass): void;
  watchDevice(device: GPUDevice, adapter: GPUAdapter): void;
  watchShader(label: string, module: GPUShaderModule, code: string): void;
  watchPipeline(
    pipeline: GPURenderPipeline,
    topology: GPUPrimitiveTopology,
  ): void;
  watchRender(encoder: GPURenderPassEncoder): GPURenderPassEncoder;
  watchCompute(encoder: GPUComputePassEncoder): GPUComputePassEncoder;
  watchClear(): void;
  poolAcquire(texture: GPUTexture): void;
  poolRelease(texture: GPUTexture): void;
  mood(post: PostDraw, light: LightDraw, urp: UrpDebugData): void;
  texturePreview(preview: TexturePreview): () => void;
}
export interface UrpDebugData {
  get(): SortProps;
  // a new URP.init keeping the live post and light state, so the mood is not reset
  apply(props: DeepPartial<URPProps>): void;
  effects(): readonly ScreenEffect[];
  effect(name: string): ScreenEffect;
}
export interface WatchOptions {
  scope?: LogScopeKey;
  size?: WatchCells;
  // false for getters building a new object (() => ({ hp, pos })): editing the copy changes nothing
  editable?: boolean;
}
export interface IWatchModule {
  add(name: string, getter: () => unknown, options?: WatchOptions): () => void;
  set(name: string, value: unknown, options?: WatchOptions): void;
  remove(name: string): void;
  endFrame(): void;
}
export interface CommandOptions {
  hint?: string;
}
export interface ExposeOptions extends CommandOptions {
  editable?: boolean;
}
export interface CommandVariable<Value> extends CommandOptions {
  get: () => Value;
  set: (value: Value) => void;
  options?: readonly Value[];
}
export interface ICommandModule {
  expose(name: string, getter: () => unknown, options?: ExposeOptions): () => void;
  variable<Value>(name: string, definition: CommandVariable<Value>): () => void;
  action(
    name: string,
    action: (...args: any[]) => unknown,
    options?: CommandOptions,
  ): () => void;
  endFrame(): void;
}
export interface TweakFieldsSection extends TweakFieldsSectionInfo {
  // game side only, "export changed" leaves out fields equal to these (arg "value": { [field.key]: value })
  defaults?: Record<string, unknown>;
  // arg "value": { [field.key]: value }
  get(): Record<string, unknown>;
  set(values: Record<string, unknown>): void;
  // arg "object": the whole export line from the exported fields, default call(formatLiteral(values))
  format?(values: Record<string, unknown>): string;
}
export interface TweakListItem {
  // may depend on the element (other params per effect)
  fields(value: Record<string, unknown>): TweakField[];
  // null: nothing to add, the profiler disables "+ add"; with the current element for a reset of one field
  create(value?: Record<string, unknown>): Record<string, unknown> | null;
  label?(value: Record<string, unknown>): string;
}
export interface TweakListSection {
  title: string;
  call: string;
  arg: "list";
  group?: string;
  item: TweakListItem;
  get(): Record<string, unknown>[];
  // always the whole list, never a patch at an index
  set(items: Record<string, unknown>[]): void;
  // "export changed" skips a list equal to this
  defaults?: Record<string, unknown>[];
  // the whole export line, default call(formatLiteral(items))
  format?(items: Record<string, unknown>[]): string;
}
export interface TweakActionSection extends TweakActionSectionInfo {
  // starting argument values, a field without one starts at its control's empty value
  defaults?: Record<string, unknown>;
  run(args: Record<string, unknown>): void;
}
export type TweakSection = TweakFieldsSection | TweakListSection | TweakActionSection;
export type TuneRange = [min: number, max: number, step: number];
// ranges, labels, hints and skip are keyed by a field's key ("perDay") or by its path below the object
// with "*" for any element ("spikes.perBand.*.min"); the path wins
export interface TuneOptions {
  title: string;
  // what the object drives in the game, shown under the page's header
  description: string;
  category?: string;
  order?: number;
  // when an edit shows up in the game, if not at once (read only when a dwarf is made, when the map is generated)
  applies?: string;
  // number fields within a range become sliders
  ranges?: Record<string, TuneRange>;
  // instead of the key spelled out in words
  labels?: Record<string, string>;
  hints?: Record<string, string>;
  // left out with everything under them: ids, salts, looks that are no numbers to tune
  skip?: string[];
  // a nested object's section title, for elements known by an id (a rock layer by its block)
  nameOf?: (value: object, key: string) => string | undefined;
  // after every edit, for game state built from the object
  onChange?: () => void;
}
export interface TweakPanel {
  title: string;
  // what the page is for, shown under its header
  description?: string;
  // sections is a getter, the schema is rebuilt while the panel is open; the section count must stay the same
  live?: boolean;
  // default true, false hides the export buttons
  exportable?: boolean;
  // default true, false hides Revert and the preset bar
  presets?: boolean;
  // one of the registered categories, without it the page opens on its own
  category?: string;
  // page order inside the category
  order?: number;
  // default true, false skips the console command (code opens the panel)
  command?: boolean;
  sections: TweakSection[];
}
export interface ITweakModule {
  // an id registered again is replaced in place, the button keeps its spot
  categories(tab: TweakCategoryTab, categories: Readonly<Record<string, Readonly<TweakCategory>>>): void;
  register(name: string, panel: TweakPanel): () => void;
  // a page editing the object in place: numbers, toggles and colors, a section per nested object;
  // the export is the object's literal under name
  tune(name: string, target: object, options: TuneOptions): () => void;
  open(name: string): void;
  openCategory(category: string): void;
  endFrame(): void;
}
export interface CameraView {
  center: Position2D;
  zoom: number;
}
// sections of plain values for display, the keys of each section must stay the same
export type CameraDebugInfo = Record<string, object>;
export interface CameraDebugData {
  state(): CameraDebugInfo;
  settings(): CameraDebugInfo;
  canvas(): HTMLCanvasElement;
  // world units at zoom 1
  viewHeight(): number;
  // real time, the free cam moves on a paused game too
  delta(): number;
  shake(trauma: number): void;
  kick(direction: Position2D, strength: number): void;
  zoomPunch(strength: number): void;
  tilt(angle: number): void;
  sway(): number;
  setSway(amount: number): void;
}
export interface ICameraModule {
  connect(source: CameraDebugData): void;
  // the view the game camera shows this frame; while hijacked the free cam's instead
  override(shown: CameraView): CameraView;
  readonly isHijacked: boolean;
}
export interface CoroutineGroupInfo {
  group: string;
  phase: string;
  owner: string | null;
  key: string | null;
  active: (() => boolean) | null;
}
export interface ICoroutineModule {
  // every coroutine, from its constructor
  track(coroutine: Coroutine): void;
  // what a group knows about it
  describe(coroutine: Coroutine, info: CoroutineGroupInfo): void;
  endFrame(): void;
}
export interface IGameModule {
  connect<Key extends keyof GameReport>(key: Key, source: () => GameReport[Key]): void;
  endFrame(): void;
}
export interface IDebug {
  performance: IPerformanceModule;
  aurora: IAuroraModule;
  log: ILogger;
  watch: IWatchModule;
  command: ICommandModule;
  tweak: ITweakModule;
  camera: ICameraModule;
  coroutines: ICoroutineModule;
  game: IGameModule;
}
