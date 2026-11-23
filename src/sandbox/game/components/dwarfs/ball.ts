import AxiomMath from "@axiom/math";
import Vec2 from "@axiom/vec2";
import type Effect from "../../effects/effect";
import { assert } from "@axiom/utils";
import PragmaComponent from "@pragma/component";
import Time from "@engine/time";
import Effects from "./effects";
import LayeredSprite from "../common/layeredSprite";
import type Storage from "../common/storage";
import BallPhysics from "../../systems/world/ballPhysics";

export const BALL = {
  pixelsPerSpeed: 200,
  turnSpeed: 18,
  flipDeadzone: 10,
};

interface BallProps {
  radius: number;
}

export default class Ball extends PragmaComponent {
  public readonly radius: number;
  public readonly velocity = Vec2.create(0, 0);
  private launchScale = 1;
  public boostCooldown = 0;
  public flightSeconds = 0;
  public readonly timers = new Map<Effect, number>();
  public biomeArea = 0;
  public passThrough: Box | null = null;
  private launched = false;
  // where what it mines goes: its station's
  declare public storage: Storage;
  declare private effects: Effects;
  declare private physics: BallPhysics;

  constructor(internal: InternalPCProps, props: BallProps) {
    super(internal);
    this.radius = props.radius;
  }

  public launch(direction: Position2D, speedScale: number, passThrough: Box | null, storage: Storage) {
    this.velocity.set(direction.x, direction.y);
    this.launchScale = speedScale;
    this.passThrough = passThrough;
    this.storage = storage;
    this.launched = true;
  }

  awake(): void {
    this.physics = this.scene.getSystem(BallPhysics);
  }

  start(): void {
    if (!this.launched) return;
    const effects = this.getSibling(Effects);
    assert(effects !== undefined, `Ball needs Effects on actor: ${this.actor.ID.description}`);
    this.effects = effects;
    // start runs again on every spawn: keep the direction, reset the speed
    this.velocity.normalize().scale(this.baseSpeed * this.launchScale);
    this.boostCooldown = 0;
    this.flightSeconds = 0;
    this.timers.clear();
    this.biomeArea = 0;
    this.physics.register(this);
    this.orient(true);
  }

  fixedUpdate(): void {
    if (!this.launched) return;
    this.orient(false);
  }

  private orient(instant: boolean) {
    const vx = this.velocity.x;
    const vy = this.velocity.y;
    if (vx * vx + vy * vy < 0.01) return;
    const sprite = this.getSibling(LayeredSprite);
    if (sprite && Math.abs(vx) > BALL.flipDeadzone) {
      sprite.flipX = vx < 0;
    }
    const flipped = sprite?.flipX ?? false;
    const target = flipped ? Math.atan2(-vy, -vx) : Math.atan2(vy, vx);
    if (instant) {
      this.actor.transform.setRotation(target);
      return;
    }
    const current = this.actor.transform.getRotation();
    const step = Math.min(1, Time.getFixedDeltaTime() * BALL.turnSpeed);
    this.actor.transform.setRotation(AxiomMath.lerpAngle(current, target, step));
  }

  // read on every step: a beer poured mid-flight works at once
  public get baseSpeed() {
    return this.effects.speed * BALL.pixelsPerSpeed;
  }

  public get basePower() {
    return this.effects.power;
  }

  public get power() {
    const overSpeed = Math.max(this.velocity.length() / this.baseSpeed - 1, 0);
    return this.basePower * (1 + overSpeed * this.effects.flight.overSpeedPower);
  }

  public get penetrateRatio() {
    return this.effects.flight.penetrateRatio;
  }

  public get bounceSpeed() {
    return this.baseSpeed * this.effects.flight.bounceBoost;
  }

  public get bounceCooldown() {
    return this.effects.flight.bounceCooldown;
  }

  public get flight() {
    return this.effects.flight;
  }

  public get inFlight() {
    return this.effects.inFlight;
  }

  public get piercing() {
    return this.velocity.length() > this.baseSpeed * this.effects.flight.pierceAbove;
  }

  public land() {
    this.physics.unregister(this);
    this.launched = false;
    this.actor.transform.setRotation(0);
  }

  destroy(): void {
    this.land();
  }
}
