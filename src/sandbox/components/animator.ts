import PragmaComponent from "@pragma/component";
import Time from "@engine/time";
import Sprite from "./sprite";
import { ANIMATIONS, AnimsID } from "../content/animations";

export interface AnimationEvent {
  id: AnimsID;
}
interface AnimatorProps {
  stopOnEnd?: boolean;
}
export default class Animator extends PragmaComponent {
  declare private sprite: Sprite;

  private id: AnimsID = AnimsID.none;
  private frames = 0;
  private frameTime = 0;
  private firstX = 0;
  private frameWidth = 0;

  private frame = 0;
  private elapsed = 0;
  private playing = false;

  public loop = false;
  public stopOnEnd = true;

  constructor(internal: InternalPCProps, props?: AnimatorProps) {
    super(internal);
    this.stopOnEnd = props?.stopOnEnd ?? true;
  }

  start(): void {
    this.sprite = this.getSibling(Sprite)!;
  }

  public play(id: AnimsID, loop = this.loop) {
    const data = ANIMATIONS[id];
    this.id = id;
    this.loop = loop;
    this.frames = data.frames;
    this.frameTime = 1 / data.fps;
    this.firstX = data.crop.x;
    this.frameWidth = data.crop.width;

    this.sprite.crop = { ...data.crop };
    this.sprite.sprite = data.texture;

    this.frame = 0;
    this.elapsed = 0;
    this.playing = true;

    this.applyFrame();
    this.emitActorEvent<AnimationEvent>("animationStart", { id });
  }

  public stop() {
    this.playing = false;
  }

  public resume() {
    if (this.frames > 0) this.playing = true;
  }

  public rewind() {
    this.frame = 0;
    this.elapsed = 0;
    this.applyFrame();
  }

  public get isPlaying() {
    return this.playing;
  }

  update(): void {
    if (!this.playing) return;

    this.elapsed += Time.getDeltaTime();

    while (this.elapsed >= this.frameTime) {
      this.elapsed -= this.frameTime;
      this.frame++;

      if (this.frame < this.frames) continue;

      if (this.loop) {
        this.frame = 0;
        continue;
      }

      this.frame = this.stopOnEnd ? this.frames - 1 : 0;
      this.playing = false;
      this.emitActorEvent<AnimationEvent>("animationEnd", { id: this.id });
      break;
    }

    this.applyFrame();
  }

  private applyFrame() {
    this.sprite.crop.x = this.firstX + this.frame * this.frameWidth;
  }
}
