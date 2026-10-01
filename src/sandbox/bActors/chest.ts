import PragmaActor from "@pragma/actor";
import type Coroutine from "@engine/coroutines/coroutine";
import type { ByteReader, ByteWriter } from "@axiom/bytes";
import { debug } from "@debug";
import Animator from "../components/animator";
import Sprite from "../components/sprite";
import Physics from "../components/physics";
import Interactive from "../components/interactive";
import { ANIMATIONS, AnimsID } from "../content/animations";
import { SPRITES } from "../content/sprites";
import AxiomMath from "@axiom/math";
import { LOOT, OBJECTS, ObjectsID, type LootTable } from "../content/objects";
import { RENDER_ORDER } from "../configs";
import PlayerResources from "../systems/game/resources";

// a revealed chest gets only the position: turned 0, loot rolled now so a reload does not roll again
interface ChestProps {
  position: Position2D;
  rotation?: number;
  // [resource id, amount]
  loot?: [number, number][];
}

const CHEST = {
  pingCooldown: 5,
  // how long the open chest stays before it goes away
  openedSeconds: 0.5,
};

// a ball flying through pings it, a click opens it
export default class Chest extends PragmaActor {
  private anim: Animator;
  private loot: [number, number][];
  private opened = false;
  // game time, stops with the pause; runtime only, a reload may ping again at once
  private pingCooldown: Coroutine | null = null;

  constructor(props: ChestProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    this.transform.setRotation(props.rotation ?? 0);
    this.loot = props.loot ?? rollLoot(LOOT.chest);
    const shape = OBJECTS[ObjectsID.chest].shape;

    this.anim = this.addComponent(Animator);
    this.addComponent(Sprite, {
      crop: ANIMATIONS[AnimsID.chest].crop,
      sprite: SPRITES.anims,
      zIndex: RENDER_ORDER.decoBack,
    });
    this.addComponent(Physics, {
      type: "static",
      body: shape,
      isTrigger: true,
    });
    this.addComponent(Interactive, { body: shape });

    this.events.on("triggerEntered", () => this.ping());
    this.events.on("clicked", () => this.open());
  }

  private ping() {
    if (this.pingCooldown && !this.pingCooldown.done) return;
    this.pingCooldown = this.startCoroutine((co) => this.waitPingCooldown(co));
    debug.log.log("chest pinged");
  }

  private *waitPingCooldown(co: Coroutine) {
    yield co.waitSeconds(CHEST.pingCooldown);
  }

  private open() {
    this.opened = true;
    const resources = this.scene.getSystem(PlayerResources);
    for (const [resource, amount] of this.loot)
      resources.addResource(resource, amount);
    debug.log.log("chest opened", this.loot);
    this.destroyComponent(Physics);
    this.destroyComponent(Interactive);
    this.startCoroutine((co) => this.playOpen(co));
  }

  private *playOpen(co: Coroutine) {
    this.anim.play(AnimsID.chest, false);
    yield co.waitUntil(() => !this.anim.isPlaying);
    yield co.waitSeconds(CHEST.openedSeconds);
    this.selfDestroy();
  }

  // an opened chest is only finishing its animation, nothing to keep
  public save(writer: ByteWriter) {
    if (this.opened) return false;
    const position = this.transform.getPosition();
    writer.f64(position.x);
    writer.f64(position.y);
    writer.f32(this.transform.getWorldRotation());
    writer.u16(this.loot.length);
    for (const [resource, amount] of this.loot) {
      writer.u16(resource);
      writer.u32(amount);
    }
    return true;
  }

  public static load(reader: ByteReader) {
    const position = { x: reader.f64(), y: reader.f64() };
    const rotation = reader.f32();
    const loot: [number, number][] = [];
    const count = reader.u16();
    for (let pair = 0; pair < count; pair++)
      loot.push([reader.u16(), reader.u32()]);
    return new Chest({ position, rotation, loot });
  }
}

// [resource id, amount], a resource rolled twice is summed
function rollLoot(loot: LootTable): [number, number][] {
  const rolled = new Map<number, number>();
  const weights = loot.table.map((entry) => entry.weight);
  const rolls = AxiomMath.randomInt(loot.rolls.min, loot.rolls.max);
  for (let roll = 0; roll < rolls; roll++) {
    const entry = AxiomMath.weightedRandom(loot.table, weights);
    const amount = AxiomMath.randomInt(entry.amount.min, entry.amount.max);
    rolled.set(entry.resource, (rolled.get(entry.resource) ?? 0) + amount);
  }
  return [...rolled];
}
