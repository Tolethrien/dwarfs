import Aurora from "@aurora/core";
import WorldView from "@aurora/worldView";
import AxiomMath from "@axiom/math";
import { Signal } from "@axiom/events";
import Spring from "@axiom/spring";
import { debug } from "@debug";
import type { CameraDebugData, CameraView } from "@/core/debugger/interfaces";
import InputManager from "../inputManager";
import Time from "../time";
import {
  CameraEffects,
  type EffectSettings,
  type KickOptions,
  type ShakeSettings,
  type SwaySettings,
  type ZoomPunchOptions,
} from "./effects";
import { Vcam, VCAM_DEFAULTS, type ClaimOptions } from "./vcam";
import { BoundsMix, type BoundsOptions, type BoundsTransition, type CameraBounds } from "./bounds";

export type { BoundsOptions, BoundsTransition, CameraBounds };

export type CameraOrigin = "topLeft" | "center";
export type CameraMode = "manual" | "follow" | "free";
export type CameraTarget = Position2D | (() => Position2D);
// view units (world units at zoom 1), so the zone keeps its size on screen at any zoom
export type Deadzone = Size2D | { radius: number };
// speed in view units per second, acceleration and deceleration are damp rates, 0 = instant
export interface FreeSettings {
  speed: number;
  acceleration: number;
  deceleration: number;
}
// pull 0..1 draws the anchor toward the view center: 0 keeps it in place, 1 halves its distance
// from the center per octave zoomed in (zooming out pushes it back, so in and out cancel)
// lead = target velocity × time, per axis up to max (view units), eased at the smoothing rate:
// spring keeps its velocity (on a stop the camera halts first, then eases back), exponential
// heads back at once
export interface LookaheadSettings {
  enabled: boolean;
  time: number;
  max: Position2D;
  smoothing: number;
  smoothingMode: "spring" | "exponential";
}
// shifts the view toward the aim: weight of the way from the target, up to max (view units);
// "cursor" = the cursor's offset from the screen center, never read through the moving camera
export interface AimSettings {
  enabled: boolean;
  at: "cursor" | CameraTarget;
  weight: number;
  max: number;
}
// platformer: the camera height stays where the target last stood (setGrounded), so jumps do not
// bob the view; past band (view units above / below that height) it follows at once, like a fall
export interface PlatformLockSettings {
  enabled: boolean;
  band: { up: number; down: number };
}
export interface ZoomOptions {
  at: CameraTarget;
  pull: number;
}
// blend = seconds of the blend in (claimed) or back to the game camera (released)
export interface ClaimSignal {
  vcam: Vcam;
  blend: number;
}
export interface ClaimEndSignal {
  vcam: Vcam;
}
// what a save needs, the settings (smoothing, bounds, deadzone...) stay with the game code
export interface CameraState {
  origin: CameraOrigin;
  mode: CameraMode;
  position: Position2D;
  zoom: number;
}
// "pixel" = zoom × renderScale whole (n) or a whole fraction (1 / n), pixel art stays sharp
export type ZoomLevels = number[] | "pixel" | null;
// step in octaves per wheel notch; at "cursor" takes the point under the cursor on every notch
export interface WheelZoomSettings {
  enabled: boolean;
  at: "cursor" | "center";
  step: number;
  pull: number;
}

// an eased move or zoom never goes slower than minTexelsPerSecond: a long sub-texel tail makes
// pixel art edges crawl, so it rides the floor to the goal and lands exactly
const SETTLE = { minTexelsPerSecond: 30, restTexels: 0.01 };
// Chromium reports 100 per mouse wheel notch, a touchpad sends fractions of it
const WHEEL = { notch: 100 };
// a misuse called every frame shows up again after this, the repeats counted on the entry
const WARNING = { repeatMs: 2000 };

export default class GameCamera {
  public static readonly signals = {
    claimed: new Signal<ClaimSignal>(),
    released: new Signal<ClaimSignal>(),
    ended: new Signal<ClaimEndSignal>(),
  };
  private static origin: CameraOrigin = "topLeft";
  private static mode: CameraMode = "manual";
  private static target: CameraTarget | null = null;
  private static readonly smoothing: Position2D = { x: 0, y: 0 };
  private static deadzone: Deadzone | null = null;
  private static readonly offset: Position2D = { x: 0, y: 0 };
  private static readonly lookahead: LookaheadSettings = {
    enabled: false,
    time: 0.35,
    max: { x: 220, y: 80 },
    smoothing: 3,
    smoothingMode: "spring",
  };
  // view units ahead of the target, and where the target was a frame ago (NaN = no motion yet)
  private static readonly lead: Position2D = { x: 0, y: 0 };
  private static readonly leadSprings = { x: new Spring(1, 1), y: new Spring(1, 1) };
  private static readonly leadGoal: Position2D = { x: 0, y: 0 };
  private static readonly aimSettings: AimSettings = {
    enabled: false,
    at: "cursor",
    weight: 0.3,
    max: 250,
  };
  // view units, like the lead
  private static readonly aim: Position2D = { x: 0, y: 0 };
  private static readonly platformLock: PlatformLockSettings = {
    enabled: false,
    band: { up: 240, down: 80 },
  };
  private static grounded = false;
  // world height the camera follows while locked, NaN = take the target's
  private static lockedY = NaN;
  private static readonly lockedSource: Position2D = { x: 0, y: 0 };
  private static readonly targetBefore: Position2D = { x: NaN, y: NaN };
  private static readonly freeSettings: FreeSettings = {
    speed: 600,
    acceleration: 0,
    deceleration: 0,
  };
  // view units per second, so a zoom during the glide keeps its pace on screen
  private static readonly velocity: Position2D = { x: 0, y: 0 };
  private static zoom = 1;
  private static zoomTarget = 1;
  private static zoomSmoothing = 0;
  private static readonly zoomLimits = { min: 0.25, max: 4 };
  // world point kept in place on screen until the zoom lands, null = the origin (corner or center)
  private static zoomAnchor: CameraTarget | null = null;
  private static zoomPull = 0;
  private static zoomLevels: ZoomLevels = null;
  // touchpad delta not yet worth a whole notch, levels move one per notch
  private static wheelRest = 0;
  private static readonly wheelZoom: WheelZoomSettings = {
    enabled: false,
    at: "cursor",
    step: 0.25,
    pull: 0.5,
  };
  // kept in the origin convention, so a top left scene stays pinned when the canvas aspect changes
  private static readonly position: Position2D = { x: 0, y: 0 };
  private static readonly center: Position2D = { x: 0, y: 0 };
  private static readonly point: Position2D = { x: 0, y: 0 };
  private static readonly goal: Position2D = { x: 0, y: 0 };
  private static readonly panIntent: Position2D = { x: 0, y: 0 };
  private static teleportTo: Position2D | null = null;
  private static snapNext = false;
  private static readonly bounds = new BoundsMix();
  // "zoom" narrow places: the view zoom is the game zoom times this
  private static boundsZoom = 1;
  // the center before this frame's follow step, the bounds judge its progress by it
  private static readonly centerBefore: Position2D = { x: 0, y: 0 };
  // bottom to top, the view mixes each one in over what is below it
  private static readonly vcams: Vcam[] = [];
  // claims happen in the game update, their signals go out with the rest in the camera update
  private static readonly queuedSignals: (() => void)[] = [];
  // what the view showed last frame, a claim starts from it
  private static readonly shown = { center: { x: 0, y: 0 }, zoom: 1 };
  private static readonly effects = new CameraEffects();
  // shown plus the effects, what goes to the renderer; shown stays clean for the next claim
  private static readonly view = { center: { x: 0, y: 0 }, zoom: 1, rotation: 0 };
  // shown the frame before: unchanged = the camera rests, whatever the effects do over it
  private static readonly shownBefore = { center: { x: NaN, y: NaN }, zoom: NaN };
  private static readonly noTargetWarning = debug.log.scope("camera").once();
  private static readonly followAnchorWarning = debug.log.scope("camera").once();
  private static readonly followPositionWarning = debug.log
    .scope("camera")
    .throttle(WARNING.repeatMs);
  private static readonly followTeleportWarning = debug.log
    .scope("camera")
    .throttle(WARNING.repeatMs);

  static {
    debug.camera.connect(this.debugSource());
  }

  public static setOrigin(origin: CameraOrigin) {
    this.origin = origin;
  }
  public static setMode(mode: CameraMode) {
    if (mode !== "free") this.stopVelocity();
    this.resetLead();
    this.lockedY = NaN;
    this.bounds.resetTravel();
    this.mode = mode;
  }
  public static setTarget(target: CameraTarget | null) {
    this.resetLead();
    this.lockedY = NaN;
    this.target = target;
  }
  public static setPlatformLock(settings: Partial<PlatformLockSettings>) {
    const { band, ...rest } = settings;
    Object.assign(this.platformLock, rest);
    if (band !== undefined) this.platformLock.band = { up: band.up, down: band.down };
    if (!this.platformLock.enabled) this.lockedY = NaN;
  }
  // from the game's physics, every frame or on change
  public static setGrounded(grounded: boolean) {
    this.grounded = grounded;
  }
  public static setAim(settings: Partial<AimSettings>) {
    Object.assign(this.aimSettings, settings);
  }
  public static setLookahead(settings: Partial<LookaheadSettings>) {
    const { max, ...rest } = settings;
    Object.assign(this.lookahead, rest);
    if (max !== undefined) this.lookahead.max = { x: max.x, y: max.y };
  }
  public static setSmoothing(rate: number | Position2D) {
    this.smoothing.x = typeof rate === "number" ? rate : rate.x;
    this.smoothing.y = typeof rate === "number" ? rate : rate.y;
  }
  // view units, like the deadzone
  public static setOffset({ x, y }: Position2D) {
    this.offset.x = x;
    this.offset.y = y;
  }
  public static setDeadzone(deadzone: Deadzone | null) {
    this.deadzone = deadzone;
  }
  public static setFree(settings: Partial<FreeSettings>) {
    Object.assign(this.freeSettings, settings);
  }
  public static pan({ x, y }: Position2D) {
    this.panIntent.x += x;
    this.panIntent.y += y;
  }
  public static setPosition(point: Position2D) {
    if (this.mode === "follow")
      this.followPositionWarning.warn(
        "Camera.setPosition in follow mode is overwritten by the follow, use Camera.snap() to jump to the target or change the mode first",
      );
    this.placeAt(point);
  }
  public static setZoom(level: number, options: Partial<ZoomOptions> = {}) {
    this.zoomTarget = this.clampZoom(level);
    this.setZoomAnchor(options.at ?? null);
    this.zoomPull = options.pull ?? 0;
  }
  // with levels: at least one level on, then the one nearest to where the octaves lead
  public static zoomBy(octaves: number, options: Partial<ZoomOptions> = {}) {
    if (octaves === 0) return;
    const goal = this.zoomTarget * 2 ** octaves;
    const levels = this.resolveLevels();
    this.setZoom(levels === null ? goal : this.nearestLevel(levels, goal, octaves > 0), options);
  }
  // only zoomBy and the wheel, setZoom stays exact
  public static setZoomLevels(levels: ZoomLevels) {
    this.zoomLevels = Array.isArray(levels) ? [...levels].sort((a, b) => a - b) : levels;
  }
  public static setZoomLimits(min: number, max: number) {
    this.zoomLimits.min = min;
    this.zoomLimits.max = max;
    this.zoomTarget = this.clampZoom(this.zoomTarget);
  }
  public static setWheelZoom(settings: Partial<WheelZoomSettings>) {
    Object.assign(this.wheelZoom, settings);
  }
  public static setZoomSmoothing(rate: number) {
    this.zoomSmoothing = rate;
  }
  // narrow, maxZoom and margin only for a polygon, a box keeps the old rule (narrower than the
  // view = centered); blend / easing / cut for both
  public static setBounds(
    bounds: CameraBounds | null,
    options: Partial<BoundsOptions & BoundsTransition> = {},
  ) {
    this.bounds.set(bounds, options);
    if (options.cut) this.snap();
  }
  // skips the smoothing for one frame
  public static teleport({ x, y }: Position2D) {
    if (this.mode === "follow")
      this.followTeleportWarning.warn(
        "Camera.teleport in follow mode is pulled back to the target, use Camera.snap() for a respawn",
      );
    this.teleportTo = { x, y };
  }
  // the next frame lands where the mode heads, unsmoothed: follow on its target (no deadzone),
  // the zoom on its target; a respawn in follow, where a teleport would be pulled back
  public static snap() {
    this.snapNext = true;
  }
  // restores at once, a loaded game does not glide in
  public static setState({ origin, mode, position, zoom }: Partial<CameraState>) {
    if (origin !== undefined) this.origin = origin;
    if (mode !== undefined) this.setMode(mode);
    if (position !== undefined) this.placeAt(position);
    if (zoom !== undefined) this.setZoom(zoom);
    this.snap();
  }

  // the game camera keeps running under the vcams; a release takes only its own vcam off the
  // stack, the view goes back to the vcam below as it is now, or to the game
  public static claim(options: Partial<ClaimOptions> = {}) {
    const vcam = new Vcam(this.shown, { ...VCAM_DEFAULTS.claim, ...options });
    this.vcams.push(vcam);
    this.queuedSignals.push(() => this.signals.claimed.emit({ vcam, blend: vcam.blendIn }));
    return vcam;
  }
  // adds up to 1, decays over game time
  public static shake(trauma: number) {
    this.effects.addTrauma(trauma);
  }
  public static setShake(settings: Partial<ShakeSettings>) {
    this.effects.setShake(settings);
  }
  public static get getTrauma() {
    return this.effects.getTrauma;
  }
  // direction is normalized, strength = the peak of the swing in view units
  public static kick(direction: Position2D, strength: number, options?: Partial<KickOptions>) {
    this.effects.kick(direction, strength, options);
  }
  // strength = the peak in octaves (+ in, - out), options.at = world point kept in place
  public static zoomPunch(strength: number, options?: Partial<ZoomPunchOptions>) {
    this.effects.zoomPunch(strength, options);
  }
  // amount 0..1, faded to over settings.fade seconds; 0 turns it off
  public static setSway(settings: Partial<SwaySettings>) {
    this.effects.setSway(settings);
  }
  public static get getSwayStrength() {
    return this.effects.getSwayStrength;
  }
  // angle = the peak in radians, + turns clockwise
  public static tilt(angle: number, options?: Partial<KickOptions>) {
    this.effects.tilt(angle, options);
  }
  public static setEffects(settings: Partial<EffectSettings>) {
    this.effects.setEffects(settings);
  }
  public static get isClaimed() {
    return this.vcams.length > 0;
  }
  // 0..1, how much any vcam is in the view (blend easing included): drive letterboxes with it
  public static get getClaimWeight() {
    let weight = 0;
    for (const vcam of this.vcams) weight = AxiomMath.lerp(weight, 1, vcam.weight);
    return weight;
  }
  public static get getPosition(): Readonly<Position2D> {
    return this.position;
  }
  public static get getCenter(): Readonly<Position2D> {
    return this.center;
  }
  public static get getZoom() {
    return this.zoom;
  }
  // the extra zoom of "zoom" narrow places, 1 elsewhere; the view shows getZoom × this
  public static get getBoundsZoom() {
    return this.boundsZoom;
  }
  public static get getZoomTarget() {
    return this.zoomTarget;
  }
  public static get getState(): CameraState {
    const { origin, mode, position } = this;
    return { origin, mode, position: { x: position.x, y: position.y }, zoom: this.zoomTarget };
  }
  public static get getMode() {
    return this.mode;
  }
  public static get getTarget() {
    return this.target;
  }
  public static get getViewBounds() {
    return WorldView.getBounds;
  }
  public static worldToScreen(point: Position2D) {
    return WorldView.worldToScreen(point);
  }
  public static screenToWorld(point: Position2D) {
    return WorldView.screenToWorld(point);
  }

  public static update() {
    this.flushSignals();
    this.bounds.update(Time.getDeltaTime());
    this.readWheel();
    const teleport = this.teleportTo;
    this.teleportTo = null;
    const snap = this.snapNext;
    this.snapNext = false;
    const zoomBefore = this.zoom;
    this.updateZoom(teleport !== null || snap);

    const view = Aurora.getViewSize;
    const halfWidth = view.width / 2 / this.zoom;
    const halfHeight = view.height / 2 / this.zoom;
    const topLeft = this.origin === "topLeft";
    const originX = topLeft ? halfWidth : 0;
    const originY = topLeft ? halfHeight : 0;
    const center = this.center;
    center.x = this.position.x + originX;
    center.y = this.position.y + originY;
    if (this.zoomAnchor !== null && teleport === null && this.mode !== "follow")
      this.zoomAround(this.zoomAnchor, zoomBefore);
    if (this.zoom === this.zoomTarget) this.zoomAnchor = null;

    if (teleport !== null) {
      this.stopVelocity();
      center.x = teleport.x;
      center.y = teleport.y;
    } else if (this.mode === "follow") {
      this.follow(halfWidth, halfHeight, snap);
    } else if (this.mode === "free") {
      if (snap) this.stopVelocity();
      this.free();
    }
    this.panIntent.x = this.panIntent.y = 0;
    // follow confines its own center
    if (this.mode !== "follow" || teleport !== null) this.bounds.clamp(center, halfWidth, halfHeight);
    this.boundsZoom = this.bounds.zoom(center, halfWidth, halfHeight);

    this.position.x = center.x - originX;
    this.position.y = center.y - originY;
    this.updateShown();
    // the profiler's free cam, the game camera keeps running under it
    const shown = debug.camera.override(this.shown);
    const affected = this.updateView(shown);
    WorldView.setCamera(this.view, this.isStill(shown) && !affected);
  }

  private static updateShown() {
    const shown = this.shown;
    shown.center.x = this.center.x;
    shown.center.y = this.center.y;
    shown.zoom = this.zoom * this.boundsZoom;
    const vcams = this.vcams;
    const delta = Time.getRawDeltaTime();
    // a listener may claim again, the new vcam starts next update
    const count = vcams.length;
    for (let index = 0; index < count; index++) {
      const vcam = vcams[index];
      vcam.update(delta);
      // a zero blend back goes out and ends in one update, released still comes first
      if (vcam.announceRelease()) this.signals.released.emit({ vcam, blend: vcam.blendOut });
      if (vcam.isDone) continue;
      const weight = vcam.weight;
      shown.center.x = AxiomMath.lerp(shown.center.x, vcam.view.center.x, weight);
      shown.center.y = AxiomMath.lerp(shown.center.y, vcam.view.center.y, weight);
      shown.zoom *= (vcam.view.zoom / shown.zoom) ** weight;
    }
    // from the top, so a vcam claimed by an ended listener is past the index
    for (let index = vcams.length - 1; index >= 0; index--) {
      const vcam = vcams[index];
      if (!vcam.isDone) continue;
      vcams.splice(index, 1);
      this.signals.ended.emit({ vcam });
    }
  }

  private static updateView(shown: Readonly<CameraView>) {
    const view = this.view;
    view.center.x = shown.center.x;
    view.center.y = shown.center.y;
    view.zoom = shown.zoom;
    view.rotation = 0;
    this.effects.update(Time.getDeltaTime());
    return this.effects.apply(view);
  }
  // effects snap on their own; the frame one ends the view is already on the resting texel
  private static isStill(shown: Readonly<CameraView>) {
    const shownBefore = this.shownBefore;
    const still =
      shown.center.x === shownBefore.center.x &&
      shown.center.y === shownBefore.center.y &&
      shown.zoom === shownBefore.zoom;
    shownBefore.center.x = shown.center.x;
    shownBefore.center.y = shown.center.y;
    shownBefore.zoom = shown.zoom;
    return still;
  }

  // in octaves, so zooming out feels as fast as zooming in; the floor is measured at the view
  // edge, which moves furthest: an octave shifts it by half the render height times ln 2 texels
  private static updateZoom(instant: boolean) {
    const target = this.zoomTarget;
    const rest = Math.log2(target / this.zoom);
    const delta = Time.getRawDeltaTime();
    const minStep =
      (SETTLE.minTexelsPerSecond * delta) / ((Aurora.getRenderSize.height / 2) * Math.LN2);
    if (instant || Math.abs(rest) <= minStep) {
      this.zoom = target;
      return;
    }
    const step = rest * AxiomMath.damp(this.zoomSmoothing, delta);
    this.zoom *= 2 ** (Math.sign(rest) * Math.max(Math.abs(step), minStep));
  }
  // a wheel claimed by the gui reads as no scroll; while a vcam runs the game zoom stays put
  private static readWheel() {
    const { enabled, at, step, pull } = this.wheelZoom;
    // the profiler's free cam takes the wheel
    if (!enabled || this.vcams.length > 0 || debug.camera.isHijacked) return;
    const scroll = InputManager.getMouseScroll().y;
    if (scroll === 0) return;
    // follow anchors on its target, the cursor would only raise the warning
    const options =
      at === "center" || this.mode === "follow"
        ? {}
        : { at: WorldView.screenToWorld(InputManager.getMousePos()), pull };
    const levels = this.resolveLevels();
    if (levels === null) {
      this.zoomBy((-scroll / WHEEL.notch) * step, options);
      return;
    }
    if (Math.sign(scroll) !== Math.sign(this.wheelRest)) this.wheelRest = 0;
    this.wheelRest += scroll;
    const notches = Math.trunc(this.wheelRest / WHEEL.notch);
    if (notches === 0) return;
    this.wheelRest -= notches * WHEEL.notch;
    this.setZoom(this.nextLevel(levels, -notches), options);
  }
  private static resolveLevels(): number[] | null {
    const levels = this.zoomLevels;
    if (levels === null) return null;
    const { min, max } = this.zoomLimits;
    if (levels !== "pixel") {
      const inside = levels.filter((level) => level >= min && level <= max);
      return inside.length > 0 ? inside : null;
    }
    // recomputed per call, the render scale can change in game
    const scale = Aurora.getRenderScale;
    const pixel: number[] = [];
    for (let parts = Math.floor(1 / (min * scale)); parts >= 2; parts--)
      pixel.push(1 / (parts * scale));
    for (let texels = 1; texels / scale <= max; texels++)
      if (texels / scale >= min) pixel.push(texels / scale);
    return pixel.length > 0 ? pixel : null;
  }
  // the zoom target itself is not a step: a level counts only past it in that direction
  private static levelsBeyond(levels: number[], zoomIn: boolean) {
    const current = this.zoomTarget;
    return levels.filter((level) => Math.log2(level / current) * (zoomIn ? 1 : -1) > 1e-6);
  }
  private static nearestLevel(levels: number[], goal: number, zoomIn: boolean) {
    let best = this.zoomTarget;
    let bestDistance = Infinity;
    for (const level of this.levelsBeyond(levels, zoomIn)) {
      const distance = Math.abs(Math.log2(level / goal));
      if (distance >= bestDistance) continue;
      best = level;
      bestDistance = distance;
    }
    return best;
  }
  private static nextLevel(levels: number[], steps: number) {
    const zoomIn = steps > 0;
    const beyond = this.levelsBeyond(levels, zoomIn);
    if (beyond.length === 0) return this.zoomTarget;
    const index = Math.min(Math.abs(steps), beyond.length) - 1;
    return zoomIn ? beyond[index] : beyond[beyond.length - 1 - index];
  }
  private static flushSignals() {
    const queued = this.queuedSignals;
    // a listener may claim again, its signals wait for the next frame
    const count = queued.length;
    for (let index = 0; index < count; index++) queued[index]();
    queued.splice(0, count);
  }
  private static placeAt({ x, y }: Position2D) {
    this.stopVelocity();
    this.position.x = x;
    this.position.y = y;
  }
  private static clampZoom(level: number) {
    return AxiomMath.clamp(level, this.zoomLimits.min, this.zoomLimits.max);
  }
  private static setZoomAnchor(at: CameraTarget | null) {
    if (at !== null && this.mode === "follow") {
      this.followAnchorWarning.warn("zoom anchor is ignored in follow mode, the target anchors it");
      at = null;
    }
    this.zoomAnchor = at;
  }
  // scales the offset from the anchor by the zoom step, starting from the center before the step:
  // the anchor keeps its screen spot (less the pull), and a pan, bounds or a moving anchor compose
  private static zoomAround(anchor: CameraTarget, zoomBefore: number) {
    const point = typeof anchor === "function" ? anchor() : anchor;
    const view = Aurora.getViewSize;
    const topLeft = this.origin === "topLeft";
    const center = this.center;
    const beforeX = this.position.x + (topLeft ? view.width / 2 / zoomBefore : 0);
    const beforeY = this.position.y + (topLeft ? view.height / 2 / zoomBefore : 0);
    const ratio = (zoomBefore / this.zoom) ** (1 + this.zoomPull);
    center.x = point.x - (point.x - beforeX) * ratio;
    center.y = point.y - (point.y - beforeY) * ratio;
  }
  // bounds move the goal first: heading straight for a goal inside a convex area never touches
  // the edge, clamping only the center made it slide along it (confine is for concave ones)
  private static follow(halfWidth: number, halfHeight: number, snap: boolean) {
    const target = this.target;
    if (target === null) {
      this.noTargetWarning.warn("camera mode is follow but there is no target, Camera.setTarget");
      return;
    }
    const source = this.lockSource(typeof target === "function" ? target() : target, snap);
    // after the lock: a jump moves neither the reference nor the lead
    this.updateLead(source, snap);
    this.updateAim(source);
    const { offset, lead, aim } = this;
    const point = this.point;
    point.x = source.x + (offset.x + lead.x + aim.x) / this.zoom;
    point.y = source.y + (offset.y + lead.y + aim.y) / this.zoom;
    const goal = this.goal;
    goal.x = point.x;
    goal.y = point.y;
    if (this.deadzone !== null && !snap) this.applyDeadzone(point, this.deadzone);
    this.bounds.placeGoal(source, goal, halfWidth, halfHeight, this.zoom);
    if (snap) {
      this.center.x = goal.x;
      this.center.y = goal.y;
      this.bounds.resetTravel();
      return;
    }

    this.centerBefore.x = this.center.x;
    this.centerBefore.y = this.center.y;
    const delta = Time.getDeltaTime();
    const minStep = (SETTLE.minTexelsPerSecond * delta) / (this.zoom * Aurora.getRenderScale);
    this.approach(
      this.center,
      goal,
      AxiomMath.damp(this.smoothing.x, delta),
      AxiomMath.damp(this.smoothing.y, delta),
      minStep,
    );
    this.bounds.confine(this.center, this.centerBefore, halfWidth, halfHeight);
  }
  // from the target's own motion (game time), so the game passes nothing; a jump of the target
  // gives a huge velocity that max cuts, a snap starts over from no lead
  private static updateLead(source: Position2D, snap: boolean) {
    const { lead, leadSprings, targetBefore, lookahead } = this;
    const delta = Time.getDeltaTime();
    const moved = !Number.isNaN(targetBefore.x) && delta > 0;
    const velocityX = moved ? (source.x - targetBefore.x) / delta : 0;
    const velocityY = moved ? (source.y - targetBefore.y) / delta : 0;
    targetBefore.x = source.x;
    targetBefore.y = source.y;
    if (!lookahead.enabled || snap) {
      this.resetLead();
      targetBefore.x = source.x;
      targetBefore.y = source.y;
      return;
    }
    // paused: the lead holds
    if (delta === 0) return;
    const { time, max, smoothing, smoothingMode } = lookahead;
    const goal = this.leadGoal;
    goal.x = AxiomMath.clamp(velocityX * this.zoom * time, -max.x, max.x);
    goal.y = AxiomMath.clamp(velocityY * this.zoom * time, -max.y, max.y);
    if (smoothingMode === "spring") {
      lead.x = this.springLead(leadSprings.x, lead.x, goal.x, smoothing, delta);
      lead.y = this.springLead(leadSprings.y, lead.y, goal.y, smoothing, delta);
      return;
    }
    leadSprings.x.reset();
    leadSprings.y.reset();
    // view units on screen are render texels over the render scale, zoom cancels out
    const minStep = (SETTLE.minTexelsPerSecond * delta) / Aurora.getRenderScale;
    const blend = AxiomMath.damp(smoothing, delta);
    this.approach(lead, goal, blend, blend, minStep);
  }
  // the cursor through the camera would chase itself: the view moves, the point under it moves on
  private static updateAim(source: Position2D) {
    const aim = this.aim;
    const { enabled, at, weight, max } = this.aimSettings;
    aim.x = aim.y = 0;
    if (!enabled) return;
    if (at === "cursor") {
      const mouse = InputManager.getMousePos();
      const canvas = Aurora.canvas;
      const unitsPerPixel = Aurora.getViewSize.height / canvas.height;
      aim.x = (mouse.x - canvas.width / 2) * unitsPerPixel;
      aim.y = (mouse.y - canvas.height / 2) * unitsPerPixel;
    } else {
      const point = typeof at === "function" ? at() : at;
      aim.x = (point.x - source.x) * this.zoom;
      aim.y = (point.y - source.y) * this.zoom;
    }
    const length = Math.hypot(aim.x, aim.y) * weight;
    const scale = length > max ? (max / length) * weight : weight;
    aim.x *= scale;
    aim.y *= scale;
  }
  // the spring holds lead − goal: a new goal shifts it and keeps the velocity, so the lead never
  // turns sharply; its slowing tail rides the SETTLE floor to land exactly (no sub-texel crawl)
  private static springLead(
    spring: Spring,
    lead: number,
    goal: number,
    rate: number,
    delta: number,
  ) {
    if (rate <= 0) {
      spring.reset();
      return goal;
    }
    spring.set(rate / (Math.PI * 2), 1);
    spring.value = lead - goal;
    // view units on screen are render texels over the render scale, zoom cancels out
    const minSpeed = SETTLE.minTexelsPerSecond / Aurora.getRenderScale;
    const { value, velocity } = spring;
    const acceleration = -rate * rate * value - 2 * rate * velocity;
    const slowingIn = velocity * value < 0 && acceleration * velocity < 0;
    // <=: once on the floor it stays there, handing the tail back to the spring at the floor
    // speed made it overshoot and swing around the goal
    if (value !== 0 && slowingIn && Math.abs(velocity) <= minSpeed) {
      const step = minSpeed * delta;
      if (Math.abs(value) <= step) spring.reset();
      else {
        spring.value -= Math.sign(value) * step;
        spring.velocity = -Math.sign(value) * minSpeed;
      }
    } else spring.update(delta, SETTLE.restTexels / Aurora.getRenderScale);
    return goal + spring.value;
  }
  private static resetLead() {
    this.lead.x = this.lead.y = 0;
    this.leadSprings.x.reset();
    this.leadSprings.y.reset();
    this.targetBefore.x = this.targetBefore.y = NaN;
  }
  // standing = the reference follows (landing, walking a slope); in the air it holds until the
  // target leaves the band, then drags along with it on the band edge
  private static lockSource(source: Position2D, snap: boolean): Position2D {
    const { enabled, band } = this.platformLock;
    if (!enabled) return source;
    if (Number.isNaN(this.lockedY) || this.grounded || snap) this.lockedY = source.y;
    else
      this.lockedY = AxiomMath.clamp(
        this.lockedY,
        source.y - band.down / this.zoom,
        source.y + band.up / this.zoom,
      );
    const locked = this.lockedSource;
    locked.x = source.x;
    locked.y = this.lockedY;
    return locked;
  }
  // inside the zone the camera stays, outside it moves only until the target is on the edge
  private static applyDeadzone(point: Position2D, deadzone: Deadzone) {
    const { center, goal, zoom } = this;
    const offsetX = point.x - center.x;
    const offsetY = point.y - center.y;
    if ("radius" in deadzone) {
      const radius = deadzone.radius / zoom;
      const distance = Math.hypot(offsetX, offsetY);
      const kept = distance <= radius ? 1 : radius / distance;
      goal.x = point.x - offsetX * kept;
      goal.y = point.y - offsetY * kept;
      return;
    }
    const halfWidth = deadzone.width / 2 / zoom;
    const halfHeight = deadzone.height / 2 / zoom;
    goal.x = point.x - AxiomMath.clamp(offsetX, -halfWidth, halfWidth);
    goal.y = point.y - AxiomMath.clamp(offsetY, -halfHeight, halfHeight);
  }
  private static free() {
    let { x, y } = this.panIntent;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    const { speed, acceleration, deceleration } = this.freeSettings;
    const delta = Time.getRawDeltaTime();
    const goalX = x * speed;
    const goalY = y * speed;
    const velocity = this.velocity;
    const blend = AxiomMath.damp(length > 0 ? acceleration : deceleration, delta);
    velocity.x += (goalX - velocity.x) * blend;
    velocity.y += (goalY - velocity.y) * blend;
    // view units per second are render texels per second over the render scale, zoom cancels out
    const minSpeed = SETTLE.minTexelsPerSecond / Aurora.getRenderScale;
    if (Math.hypot(goalX - velocity.x, goalY - velocity.y) < minSpeed) {
      velocity.x = goalX;
      velocity.y = goalY;
    }
    const step = delta / this.zoom;
    this.center.x += velocity.x * step;
    this.center.y += velocity.y * step;
  }
  // read by the profiler only, the production connect never calls it
  private static debugSource(): CameraDebugData {
    return {
      state: () => ({
        view: {
          mode: this.mode,
          origin: this.origin,
          position: this.position,
          center: this.center,
          zoom: this.zoom,
          zoomTarget: this.zoomTarget,
          boundsZoom: this.boundsZoom,
          target: this.target,
          grounded: this.grounded,
        },
        claim: {
          claimed: this.vcams.length > 0,
          weight: this.getClaimWeight,
        },
        effects: {
          trauma: this.effects.getTrauma,
          sway: this.effects.getSwayStrength,
        },
      }),
      settings: () => ({
        follow: { smoothing: this.smoothing, deadzone: this.deadzone, offset: this.offset },
        lookahead: this.lookahead,
        aim: this.aimSettings,
        platformLock: this.platformLock,
        free: this.freeSettings,
        zoom: {
          limits: this.zoomLimits,
          levels: this.zoomLevels,
          smoothing: this.zoomSmoothing,
          wheel: this.wheelZoom,
        },
        bounds: this.bounds.getInfo,
        effectSettings: this.effects.getSettings,
      }),
      canvas: () => Aurora.canvas,
      viewHeight: () => Aurora.getViewSize.height,
      delta: () => Time.getRawDeltaTime(),
      shake: (trauma) => this.shake(trauma),
      kick: (direction, strength) => this.kick(direction, strength),
      zoomPunch: (strength) => this.zoomPunch(strength),
      tilt: (angle) => this.tilt(angle),
      sway: () => this.effects.getSettings.sway.amount,
      setSway: (amount) => this.setSway({ amount }),
    };
  }
  private static stopVelocity() {
    this.velocity.x = this.velocity.y = 0;
  }
  // the floor is taken along the whole path, so on a diagonal both axes arrive together
  private static approach(
    point: Position2D,
    goal: Position2D,
    blendX: number,
    blendY: number,
    minStep: number,
  ) {
    const restX = goal.x - point.x;
    const restY = goal.y - point.y;
    const rest = Math.hypot(restX, restY);
    if (rest <= minStep) {
      point.x = goal.x;
      point.y = goal.y;
      return;
    }
    let stepX = restX * blendX;
    let stepY = restY * blendY;
    const step = Math.hypot(stepX, stepY);
    if (step < minStep) {
      stepX = (restX / rest) * minStep;
      stepY = (restY / rest) * minStep;
    }
    point.x += stepX;
    point.y += stepY;
  }
}
