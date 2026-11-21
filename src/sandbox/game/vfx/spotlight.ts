import AxiomMath from "@axiom/math";
import Easing from "@axiom/easing";
import { Post } from "@aurora/urp/draw/draw";
import { Camera } from "@engine/camera/camera";
import Time from "@engine/time";
import { MAP_LOOK } from "../gpu/gameGlobals";
import type { VfxLayer } from "./vfx";

// the screen dims and blurs everywhere but around a point; vignette and blur share one shape,
// intensity is the vignette's reach: a bigger number is a smaller clear window
const SPOTLIGHT = {
  seconds: { in: 0.4, out: 0.3 },
  home: { center: { x: 0.5, y: 0.5 }, roundness: 1 },
  vignette: { intensity: 1.4, smoothness: 0.5 },
  blur: { sigma: 6, reach: 1.4, smoothness: 0.5 },
  breath: { seconds: 2.2, amount: 0.12 },
};

export default class SpotlightLayer implements VfxLayer {
  private target: Box | undefined;
  private progress = 0;
  private readonly center = { x: 0.5, y: 0.5 };

  public set(target: Box | undefined) {
    this.target = target;
  }

  // on real time: the bullet time doesn't slow it; runs in render so it follows this frame's camera
  public render() {
    const shown = this.target !== undefined && Camera.isInView(this.target);
    if (!shown && this.progress === 0) return;
    if (this.target !== undefined) this.aim(this.target);
    const seconds = shown ? SPOTLIGHT.seconds.in : SPOTLIGHT.seconds.out;
    const step = Time.getRawDeltaTime() / seconds;
    this.progress = AxiomMath.clamp(this.progress + (shown ? step : -step), 0, 1);
    const home = SPOTLIGHT.home;
    if (this.progress === 0) {
      this.resetPost();
      return;
    }
    const eased = Easing.easeOutCubic(this.progress);
    const breath = (Math.sin((Time.getTimeInSeconds() / SPOTLIGHT.breath.seconds) * Math.PI * 2) + 1) / 2;
    const swell = 1 + (breath - 0.5) * SPOTLIGHT.breath.amount;
    const vignette = SPOTLIGHT.vignette;
    const base = MAP_LOOK.post.vignette;
    Post.setVignette({
      intensity: AxiomMath.lerp(base.intensity, vignette.intensity * swell, eased),
      smoothness: AxiomMath.lerp(base.smoothness, vignette.smoothness, eased),
      roundness: home.roundness,
      center: {
        x: AxiomMath.lerp(home.center.x, this.center.x, eased),
        y: AxiomMath.lerp(home.center.y, this.center.y, eased),
      },
    });
    const blur = SPOTLIGHT.blur;
    Post.setBlur({
      sigma: blur.sigma,
      amount: eased,
      mask: "vignette",
      reach: blur.reach * swell,
      smoothness: blur.smoothness,
      roundness: home.roundness,
      center: this.center,
    });
  }

  public clear() {
    this.target = undefined;
    if (this.progress > 0) {
      this.progress = 0;
      this.resetPost();
    }
  }

  private resetPost() {
    const home = SPOTLIGHT.home;
    Post.setVignette({ ...MAP_LOOK.post.vignette, roundness: home.roundness, center: home.center });
    Post.setBlur({ sigma: 0 });
  }

  private aim(box: Box) {
    const view = Camera.getViewBounds;
    this.center.x = (box.x + box.w / 2 - view.min.x) / (view.max.x - view.min.x);
    this.center.y = (box.y + box.h / 2 - view.min.y) / (view.max.y - view.min.y);
  }
}
