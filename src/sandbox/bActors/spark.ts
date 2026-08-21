import PragmaActor from "@/core/pragma/actor";
import Animator from "../components/animator";
import Sprite from "../components/sprite";
import EntitiesObject, { AnimsID } from "../managers/entitiesObject";
interface SparkProps {
  position: Position2D;
}
export default class Spark extends PragmaActor {
  private anim: Animator;
  constructor(props: SparkProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    this.transform.setScale(1.5, 1.5);
    this.anim = this.addComponent(Animator);
    this.addComponent(Sprite, {
      tint: [184, 115, 51, 255],
      crop: EntitiesObject.animations[AnimsID.sparks].crop,
      sprite: EntitiesObject.sprites.anims,
      zIndex: EntitiesObject.renderOrder.decoFront,
    });
    this.events.on("animationEnd", () => this.selfDestroy());
  }

  public onStart(): void {
    super.onStart();
    this.anim.play(AnimsID.sparks, false);
  }
}
