import Aurora from "@aurora/core";
import WorldView, { type CameraData } from "@aurora/worldView";
import AxiomMath from "@axiom/math";
import Noise, { type FractalOptions } from "@axiom/noise";
import Spring from "@axiom/spring";

// offset in view units (the same on screen at any zoom), angle in radians, frequency in noise
// cells per second, decay in trauma per second
export interface ShakeSettings {
  offset: number;
  angle: number;
  frequency: number;
  decay: number;
}
// the spring a kick swings back on: frequency in Hz, damping 1 = no overshoot, below = bounce
export interface KickOptions {
  frequency: number;
  damping: number;
}
// at = world point kept in place while zooming, the view center when left out
export interface ZoomPunchOptions extends KickOptions {
  at?: Position2D;
}
// amount 0..1 = target strength (0 = off), reached linearly over fade seconds; offset and angle at
// amount 1, like the shake; frequency in noise cells per second
export interface SwaySettings {
  amount: number;
  offset: number;
  angle: number;
  frequency: number;
  fade: number;
}
// snap puts the view with every effect on whole texels (render or canvas, the coarser); scale 0..1 multiplies every
// effect (accessibility: less screen shake), 0 = the view is exactly the camera's
export interface EffectSettings {
  snap: boolean;
  scale: number;
}

export const SHAKE_DEFAULTS: ShakeSettings = {
  offset: 16,
  angle: 0.05,
  frequency: 15,
  decay: 1,
};
export const KICK_DEFAULTS: KickOptions = { frequency: 6, damping: 0.5 };
export const ZOOM_PUNCH_DEFAULTS: KickOptions = { frequency: 5, damping: 0.6 };
export const TILT_DEFAULTS: KickOptions = { frequency: 4, damping: 0.5 };
// a small angle: slow constant turning grinds pixel art all the time, not for a moment
export const SWAY_DEFAULTS: SwaySettings = {
  amount: 0,
  offset: 12,
  angle: 0.01,
  frequency: 0.4,
  fade: 1,
};
// pixel art first: a sub-texel offset blurs the whole frame at one texel per pixel
export const EFFECT_DEFAULTS: EffectSettings = { snap: true, scale: 1 };

// fbm, not plain perlin: perlin crosses zero on every cell, a steady beat the eye catches;
// peaks sit a bit under 1, so offset and angle are near maximums
const SHAKE_NOISE: Partial<FractalOptions> = { octaves: 3 };
// slow and smooth, fewer fine octaves
const SWAY_NOISE: Partial<FractalOptions> = { octaves: 2 };
// strength = trauma^2: a small hit barely trembles, a big one shakes and dies down fast
const TRAUMA_POWER = 2;
// a spring closer to rest than this (render texels, for zoom at the view edge) lands exactly on it
const REST_TEXELS = 0.01;
// kicks or punches in flight at once, a new one past it takes the oldest's slot
const MAX_SWINGS = 8;

// one kick, punch or tilt: its own spring, so each keeps its own feel while they add up;
// x, y = kick direction (unit) or punch focus, unused by a tilt
interface Swing {
  spring: Spring;
  x: number;
  y: number;
  focused: boolean;
  started: number;
}

// layered over the shown view, never written back to the camera state
export class CameraEffects {
  private readonly settings: EffectSettings = { ...EFFECT_DEFAULTS };
  private readonly shake: ShakeSettings = { ...SHAKE_DEFAULTS };
  private trauma = 0;
  private time = 0;
  private readonly channels = {
    x: new Noise(1),
    y: new Noise(2),
    angle: new Noise(3),
  };
  private readonly sway: SwaySettings = { ...SWAY_DEFAULTS };
  // the strength now, heading to sway.amount; linear, so it lands on 0 exactly
  private swayStrength = 0;
  // own seeds, the sway must not move in step with the shake
  private readonly swayChannels = {
    x: new Noise(4),
    y: new Noise(5),
    angle: new Noise(6),
  };
  // kick springs in view units like the shake offset, punch springs in octaves, so a punch in
  // and out of the same strength look alike
  private readonly kicks = CameraEffects.swings();
  private readonly punches = CameraEffects.swings();
  // radians
  private readonly tilts = CameraEffects.swings();
  private swingCount = 0;

  public setEffects(settings: Partial<EffectSettings>) {
    Object.assign(this.settings, settings);
    this.settings.scale = AxiomMath.clamp(this.settings.scale, 0, 1);
  }
  public addTrauma(amount: number) {
    this.trauma = AxiomMath.clamp(this.trauma + amount, 0, 1);
  }
  public setShake(settings: Partial<ShakeSettings>) {
    Object.assign(this.shake, settings);
  }
  public get getTrauma() {
    return this.trauma;
  }
  public setSway(settings: Partial<SwaySettings>) {
    Object.assign(this.sway, settings);
    this.sway.amount = AxiomMath.clamp(this.sway.amount, 0, 1);
  }
  public get getSwayStrength() {
    return this.swayStrength;
  }
  public get getSettings() {
    return { effects: this.settings, shake: this.shake, sway: this.sway } as const;
  }
  // strength = the peak of the swing in view units, kicks in flight add up
  public kick(
    direction: Position2D,
    strength: number,
    options: Partial<KickOptions> = {},
  ) {
    const length = Math.hypot(direction.x, direction.y);
    if (length === 0) return;
    const swing = this.takeSwing(this.kicks, { ...KICK_DEFAULTS, ...options });
    swing.x = direction.x / length;
    swing.y = direction.y / length;
    swing.spring.impulse(swing.spring.velocityForPeak(strength));
  }
  // strength = the peak in octaves: + zooms in, - out
  public zoomPunch(strength: number, options: Partial<ZoomPunchOptions> = {}) {
    const swing = this.takeSwing(this.punches, {
      ...ZOOM_PUNCH_DEFAULTS,
      ...options,
    });
    swing.focused = options.at !== undefined;
    swing.x = options.at?.x ?? 0;
    swing.y = options.at?.y ?? 0;
    swing.spring.impulse(swing.spring.velocityForPeak(strength));
  }

  // angle = the peak in radians, + turns clockwise
  public tilt(angle: number, options: Partial<KickOptions> = {}) {
    const swing = this.takeSwing(this.tilts, { ...TILT_DEFAULTS, ...options });
    swing.spring.impulse(swing.spring.velocityForPeak(angle));
  }

  public update(delta: number) {
    this.time += delta;
    this.trauma = Math.max(0, this.trauma - this.shake.decay * delta);
    const { amount, fade } = this.sway;
    const step = fade > 0 ? delta / fade : 1;
    this.swayStrength =
      this.swayStrength < amount
        ? Math.min(amount, this.swayStrength + step)
        : Math.max(amount, this.swayStrength - step);
    const kickRest = REST_TEXELS / Aurora.getRenderScale;
    for (const { spring } of this.kicks) spring.update(delta, kickRest);
    // an octave moves the view edge by half the render height times ln 2 texels
    const punchRest =
      REST_TEXELS / ((Aurora.getRenderSize.height / 2) * Math.LN2);
    for (const { spring } of this.punches) spring.update(delta, punchRest);
    // a turn moves the view corner by half the render diagonal texels per radian
    const render = Aurora.getRenderSize;
    const tiltRest = REST_TEXELS / (Math.hypot(render.width, render.height) / 2);
    for (const { spring } of this.tilts) spring.update(delta, tiltRest);
  }
  // false = no effect running, the view is untouched and exactly the camera's
  public apply(view: CameraData) {
    const scale = this.settings.scale;
    if (scale === 0) return false;
    const punched = this.applyZoomPunch(view, scale);
    const shaken = this.applyShake(view, scale);
    const swayed = this.applySway(view, scale);
    const kicked = this.applyKick(view, scale);
    const tilted = this.applyTilt(view, scale);
    const affected = punched || shaken || swayed || kicked || tilted;
    // the whole view, not the offsets: a camera resting between texels would stay blurred
    if (affected && this.settings.snap) WorldView.snapCenter(view.center, view.zoom);
    return affected;
  }

  private static swings(): Swing[] {
    return Array.from({ length: MAX_SWINGS }, () => ({
      spring: new Spring(1, 1),
      x: 0,
      y: 0,
      focused: false,
      started: 0,
    }));
  }
  // a settled slot, or the oldest one when all are in flight
  private takeSwing(swings: Swing[], { frequency, damping }: KickOptions) {
    let slot = swings[0];
    for (const candidate of swings) {
      if (candidate.spring.isSettled) {
        slot = candidate;
        break;
      }
      if (candidate.started < slot.started) slot = candidate;
    }
    slot.spring.reset();
    slot.spring.set(frequency, damping);
    slot.started = ++this.swingCount;
    return slot;
  }
  // each punch scales around its own focus, one after another
  private applyZoomPunch(view: CameraData, scale: number) {
    let applied = false;
    for (const { spring, x, y, focused } of this.punches) {
      if (spring.isSettled) continue;
      const zoom = 2 ** (spring.value * scale);
      if (focused) {
        view.center.x = x + (view.center.x - x) / zoom;
        view.center.y = y + (view.center.y - y) / zoom;
      }
      view.zoom *= zoom;
      applied = true;
    }
    return applied;
  }
  private applyShake(view: CameraData, scale: number) {
    if (this.trauma === 0) return false;
    const { offset, angle, frequency } = this.shake;
    const strength = this.trauma ** TRAUMA_POWER * scale;
    const phase = this.time * frequency;
    const { x, y, angle: turn } = this.channels;
    const reach = (offset * strength) / view.zoom;
    view.center.x += x.fractal1D(phase, SHAKE_NOISE) * reach;
    view.center.y += y.fractal1D(phase, SHAKE_NOISE) * reach;
    view.rotation += turn.fractal1D(phase, SHAKE_NOISE) * angle * strength;
    return true;
  }
  private applySway(view: CameraData, scale: number) {
    const strength = this.swayStrength * scale;
    if (strength === 0) return false;
    const { offset, angle, frequency } = this.sway;
    const phase = this.time * frequency;
    const { x, y, angle: turn } = this.swayChannels;
    const reach = (offset * strength) / view.zoom;
    view.center.x += x.fractal1D(phase, SWAY_NOISE) * reach;
    view.center.y += y.fractal1D(phase, SWAY_NOISE) * reach;
    view.rotation += turn.fractal1D(phase, SWAY_NOISE) * angle * strength;
    return true;
  }
  private applyKick(view: CameraData, scale: number) {
    let applied = false;
    for (const { spring, x, y } of this.kicks) {
      if (spring.isSettled) continue;
      const reach = (spring.value * scale) / view.zoom;
      view.center.x += x * reach;
      view.center.y += y * reach;
      applied = true;
    }
    return applied;
  }
  private applyTilt(view: CameraData, scale: number) {
    let applied = false;
    for (const { spring } of this.tilts) {
      if (spring.isSettled) continue;
      view.rotation += spring.value * scale;
      applied = true;
    }
    return applied;
  }
}
