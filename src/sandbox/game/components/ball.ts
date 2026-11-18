import Vec2 from "@axiom/vec2";
import type Effect from "../effects/effect";
import { assert } from "@axiom/utils";
import PragmaComponent from "@pragma/component";
import Effects from "./effects";
import type Haul from "./haul";
import BallPhysics from "../systems/ballPhysics";

const BALL = { pixelsPerSpeed: 200 };

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
  // where what it mines goes: its station's haul
  declare public haul: Haul;
  declare private effects: Effects;
  declare private physics: BallPhysics;

  constructor(internal: InternalPCProps, props: BallProps) {
    super(internal);
    this.radius = props.radius;
  }

  public launch(direction: Position2D, speedScale: number, passThrough: Box | null, haul: Haul) {
    this.velocity.set(direction.x, direction.y);
    this.launchScale = speedScale;
    this.passThrough = passThrough;
    this.haul = haul;
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
  }

  destroy(): void {
    this.land();
  }
}
