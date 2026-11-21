import PragmaSystem from "@pragma/system";
import { Post } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import Time from "@engine/time";
import { MAP_LOOK } from "../../gpu/gameGlobals";
import { WORLD } from "../../sceneData";
import type World from "../../world/world";
import DebrisLayer from "../../vfx/debris";
import FlashesLayer from "../../vfx/flashes";
import SparksLayer from "../../vfx/sparks";
import SpotlightLayer from "../../vfx/spotlight";
import type { FlashProps, VfxContext, VfxLayer } from "../../vfx/vfx";
import GameEvents from "../core/gameEvents";

export default class Vfx extends PragmaSystem {
  private readonly world: World;
  private readonly tile: number;
  private readonly viewBox: Box = { x: 0, y: 0, w: 0, h: 0 };
  private readonly flashes = new FlashesLayer();
  private readonly spotlightLayer = new SpotlightLayer();
  private readonly layers: VfxLayer[];
  declare private ctx: VfxContext;

  constructor(internal: InternalPSProps) {
    super(internal);
    this.world = this.scene.sharedData.require(WORLD);
    this.tile = this.world.meta.tileInPixels;
    this.layers = [new DebrisLayer(), new SparksLayer(), this.flashes, this.spotlightLayer];
  }

  awake(): void {
    Post.setVignette(MAP_LOOK.post.vignette);
    Post.setColor(MAP_LOOK.post.color);
    Post.setDiffusion(MAP_LOOK.post.diffusion);
    const events = this.scene.getSystem(GameEvents);
    this.ctx = {
      world: this.world,
      tile: this.tile,
      events: events,
      inView: (x, y, width, height, margin) => {
        const box = this.viewBox;
        box.x = x;
        box.y = y;
        box.w = width;
        box.h = height;
        return Camera.isInView(box, margin);
      },
      flash: (props) => this.flashes.add(props),
    };
    for (const layer of this.layers) {
      layer.attach?.(this.ctx, (signal, cb) => this.connect(signal, cb));
    }
  }

  update(): void {
    const delta = Time.getDeltaTime();
    const rawDelta = Time.getRawDeltaTime();
    for (const layer of this.layers) layer.update?.(delta, rawDelta, this.ctx);
  }

  render(): void {
    for (const layer of this.layers) layer.render?.(this.ctx);
  }

  destroy(): void {
    for (const layer of this.layers) layer.clear?.();
  }

  public addLayer(layer: VfxLayer) {
    this.layers.push(layer);
    layer.attach?.(this.ctx, (signal, cb) => this.connect(signal, cb));
  }

  public flash(props: FlashProps) {
    this.flashes.add(props);
  }

  public spotlight(target: Box | undefined) {
    this.spotlightLayer.set(target);
  }
}
