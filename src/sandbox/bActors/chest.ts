import PragmaActor from "@pragma/actor";
import Animator from "../components/animator";
import Sprite from "../components/sprite";
import Physics from "../components/physics";
import Time from "@engine/time";
import EntitiesObject, { AnimsID } from "../managers/entitiesObject";
import SoundBank, { SoundsID } from "../managers/soundbank";
import { RENDER_ORDER, SPRITES } from "../managers/generalData";
import Interactive from "../components/interactive";

interface ChestProps {
  position: Position2D;
}

const PING_COOLDOWN = 5; // sekundy

export default class Chest extends PragmaActor {
  private anim: Animator;
  private lastPing = 0;
  private opened = false;

  constructor(props: ChestProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);

    this.anim = this.addComponent(Animator);
    this.addComponent(Sprite, {
      crop: EntitiesObject.animations[AnimsID.chest].crop,
      sprite: SPRITES.anims,
      zIndex: RENDER_ORDER.decoBack,
    });
    this.addComponent(Physics, {
      type: "static",
      body: { type: "rect", w: 96, h: 96 },
      isTrigger: true,
    });
    this.addComponent(Interactive, {
      bodyType: { type: "rect", w: 96, h: 96 },
    });
    this.events.on("triggerEntered", () => this.ping());
    this.events.on("interactiveClicked", () => this.open());
    // this.events.on("animationEnd", () => this.selfDestroy());
  }

  public onStart(): void {
    super.onStart();
  }

  public open() {
    if (this.opened) return;
    this.opened = true;

    // ...wylosuj loot i dodaj do zasobów gracza...

    this.anim.play(AnimsID.chest, false);
  }

  private ping() {
    if (this.opened) return;

    const now = Time.getTimeInSeconds();
    if (now - this.lastPing < PING_COOLDOWN) return;
    this.lastPing = now;
    console.log("CHEST PING!");
    // SoundBank.playSound(SoundsID.chestPing, {
    //   position: this.transform.getPosition(),
    // });
  }
}
