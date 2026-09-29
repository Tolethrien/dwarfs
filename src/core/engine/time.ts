import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";

export interface TimeWarpOptions {
  blend: number;
}
export interface TimeWarp {
  release(blend?: number): void;
}
interface WarpEntry {
  octaves: number;
  blend: number;
  weight: number;
  releasing: boolean;
}

export default class Time {
  private static readonly MAX_DELTA_TIME: number = 1000 / 10; //10FPS
  private static readonly FIXED_DT: number = 1000 / 60; // 60FPS
  private static readonly FIXED_DT_S: number = 1000 / 60 / 1000;
  //fps counter
  private static fps = 0;
  private static fpsFrames = 0;
  private static fpsElapsedMs = 0;
  private static cpuTimeMs = 0;
  private static frameStart = 0;
  //
  private static paused: boolean = false;
  private static deltaTime: number = 0;
  private static frameTime: number = 0;
  private static alpha: number = 0;
  private static currentTime: number = 0;
  private static lastTime: number = 0;
  private static accumulator: number = 0;
  private static timeSpeed: number = 1;
  private static frame = 0;

  private static speedLerp: {
    from: number;
    to: number;
    duration: number;
    elapsed: number;
  } | null = null;
  private static readonly warps: WarpEntry[] = [];
  private static warpFactor = 1;

  public static getFrame() {
    return this.frame;
  }
  public static getFrameTime() {
    return this.frameTime;
  }
  public static getDeltaTime() {
    if (this.paused) return 0;
    return this.deltaTime * this.getSpeed();
  }

  public static getUnscaledDeltaTime() {
    if (this.paused) return 0;
    return this.deltaTime;
  }
  public static getRawDeltaTime() {
    return this.deltaTime;
  }

  public static getFixedDeltaTime() {
    if (this.paused) return 0;
    return this.FIXED_DT_S * this.getSpeed();
  }
  public static setPaused(paused: boolean) {
    this.paused = paused;
  }
  public static getPaused() {
    return this.paused;
  }
  public static getAlpha() {
    return this.alpha;
  }
  public static getTime() {
    return this.currentTime;
  }
  public static getTimeInSeconds() {
    return this.currentTime / 1000;
  }

  public static initTimer(startTime: number) {
    this.lastTime = startTime;
  }
  public static setTimeSpeed(speed: number) {
    this.timeSpeed = speed;
    this.speedLerp = null;
  }
  public static getSpeed() {
    return this.timeSpeed * this.warpFactor;
  }
  public static warp(factor: number, options?: Partial<TimeWarpOptions>): TimeWarp {
    assert(factor > 0, `Time.warp: factor must be > 0, got ${factor} (use setPaused to stop time)`);
    const blend = options?.blend ?? 0;
    const entry: WarpEntry = {
      octaves: Math.log2(factor),
      blend,
      weight: blend > 0 ? 0 : 1,
      releasing: false,
    };
    this.warps.push(entry);
    this.updateWarps(0);
    return { release: (releaseBlend = blend) => this.releaseWarp(entry, releaseBlend) };
  }
  public static clearWarps(blend = 0) {
    for (const warp of this.warps) this.startRelease(warp, blend);
    this.updateWarps(0);
  }
  public static setLerpTimeSpeed(target: number, duration: number) {
    this.speedLerp = { from: this.timeSpeed, to: target, duration, elapsed: 0 };
  }
  public static update(currentTime: number) {
    this.frameStart = performance.now();
    this.frame++;

    const raw = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.countFps(raw);

    let dt = raw > this.MAX_DELTA_TIME ? this.MAX_DELTA_TIME : raw;
    this.accumulator += dt;
    this.deltaTime = dt / 1000;
    this.frameTime = dt;
    this.currentTime += dt;
    this.updateSpeedLerp(dt);
    this.updateWarps(dt / 1000);
  }

  public static requestFixedUpdate() {
    if (this.accumulator >= this.FIXED_DT) {
      this.accumulator -= this.FIXED_DT;
      return true;
    }
    return false;
  }

  public static updateAlpha() {
    this.alpha = this.accumulator / this.FIXED_DT;
  }
  private static updateSpeedLerp(dtMs: number) {
    if (!this.speedLerp || this.paused) return;
    this.speedLerp.elapsed += dtMs / 1000;
    const t = Math.min(this.speedLerp.elapsed / this.speedLerp.duration, 1);
    this.timeSpeed =
      this.speedLerp.from + (this.speedLerp.to - this.speedLerp.from) * t;
    if (t >= 1) this.speedLerp = null;
  }
  private static releaseWarp(entry: WarpEntry, blend: number) {
    if (entry.releasing) return;
    this.startRelease(entry, blend);
    this.updateWarps(0);
  }
  private static startRelease(entry: WarpEntry, blend: number) {
    entry.releasing = true;
    entry.blend = blend;
    if (blend <= 0) entry.weight = 0;
  }
  private static updateWarps(seconds: number) {
    for (let index = this.warps.length - 1; index >= 0; index--) {
      const warp = this.warps[index];
      if (warp.blend > 0) {
        const step = seconds / warp.blend;
        warp.weight = AxiomMath.clamp(warp.releasing ? warp.weight - step : warp.weight + step, 0, 1);
      }
      if (warp.releasing && warp.weight <= 0) this.warps.splice(index, 1);
    }
    let octaves = 0;
    // mixed in octaves, so 0.2 → 1 feels as even as 1 → 5
    for (const warp of this.warps) octaves = AxiomMath.lerp(octaves, warp.octaves, warp.weight);
    this.warpFactor = 2 ** octaves;
  }
  public static endFrame() {
    this.cpuTimeMs = performance.now() - this.frameStart;
  }

  private static countFps(rawDtMs: number) {
    this.fpsFrames++;
    this.fpsElapsedMs += rawDtMs;
    if (this.fpsElapsedMs < 1000) return;
    this.fps = this.fpsFrames;
    this.fpsFrames = 0;
    this.fpsElapsedMs -= 1000;
  }

  public static getFps() {
    return this.fps;
  }
  public static getCpuTime() {
    return this.cpuTimeMs;
  }
}
