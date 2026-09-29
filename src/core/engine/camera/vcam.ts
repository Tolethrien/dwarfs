import AxiomMath from "@axiom/math";
import Easing, { type EasingName } from "@axiom/easing";
import type { CoroutineWait } from "../coroutines/coroutine";
import type { CameraTarget } from "./gameCamera";

export interface VcamView {
  center: Position2D;
  zoom: number;
}
export interface VcamMove {
  duration: number;
  easing: EasingName;
}
// the zoom lands on at: the camera ends offset from it (view units, like setOffset in follow)
export interface VcamZoomOptions {
  at: CameraTarget;
  offset: Position2D;
}
export interface ClaimOptions {
  blend: number;
  release: number;
  easing: EasingName;
}
export interface VcamHandle extends CoroutineWait {
  readonly done: boolean;
  readonly interrupted: boolean;
}

export const VCAM_DEFAULTS = {
  move: { duration: 1, easing: "easeInOutSine" } as VcamMove,
  claim: { blend: 0.5, release: 1, easing: "easeInOutSine" } as ClaimOptions,
};

type TrackState = "running" | "done" | "interrupted";

class VcamTrack<Value> implements VcamHandle {
  public state: TrackState = "running";
  public elapsed = 0;
  constructor(
    public readonly from: Value,
    public readonly to: Value,
    public readonly move: VcamMove,
    private readonly land: () => void,
  ) {}
  public get done() {
    return this.state !== "running";
  }
  public get interrupted() {
    return this.state === "interrupted";
  }
  public tick() {
    return this.done;
  }
  public describe() {
    return `vcam ${this.elapsed.toFixed(2)} / ${this.move.duration} s`;
  }
  // lands at once, so a skipped cutscene ends where it would have
  public skip() {
    if (this.done) return;
    this.elapsed = this.move.duration;
    this.land();
  }
}

// one virtual camera on the claim stack, it keeps moving while a later vcam covers it
export class Vcam {
  public readonly view: VcamView;
  public readonly blendedIn: CoroutineWait;
  private readonly options: ClaimOptions;
  // 0..1 before the easing: a release during the blend in goes back from where it is
  private progress: number;
  private releasing = false;
  private releaseTime: number;
  private releaseAnnounced = false;
  private center: VcamTrack<Position2D> | null = null;
  private zoom: VcamTrack<number> | null = null;
  private zoomAnchor: CameraTarget | null = null;
  // the anchor on screen, view units from the center: where it starts and where it lands
  private readonly anchorFrom: Position2D = { x: 0, y: 0 };
  private readonly anchorTo: Position2D = { x: 0, y: 0 };

  constructor(start: VcamView, options: ClaimOptions) {
    this.view = { center: { ...start.center }, zoom: start.zoom };
    this.options = options;
    this.releaseTime = options.release;
    this.progress = options.blend <= 0 ? 1 : 0;
    this.blendedIn = {
      tick: () => this.progress >= 1 || this.releasing,
      skip: () => {
        if (!this.releasing) this.progress = 1;
      },
      describe: () => `vcam blend in ${Math.round(this.progress * 100)}%`,
    };
  }

  public moveTo(point: Position2D, move: Partial<VcamMove> = {}): VcamHandle {
    this.zoomAnchor = null;
    this.center = this.startTrack(this.center, { ...this.view.center }, { ...point }, move);
    return this.center;
  }
  // the later of moveTo and an anchored zoomTo owns the center, the other one gives it up
  public zoomTo(level: number, options: Partial<VcamMove & VcamZoomOptions> = {}): VcamHandle {
    const { at, offset, ...move } = options;
    this.zoom = this.startTrack(this.zoom, this.view.zoom, level, move);
    this.zoomAnchor = at ?? null;
    if (at !== undefined) {
      Vcam.interrupt(this.center);
      this.center = null;
      const point = typeof at === "function" ? at() : at;
      this.anchorFrom.x = (point.x - this.view.center.x) * this.view.zoom;
      this.anchorFrom.y = (point.y - this.view.center.y) * this.view.zoom;
      this.anchorTo.x = -(offset?.x ?? 0);
      this.anchorTo.y = -(offset?.y ?? 0);
    }
    return this.zoom;
  }
  // the vcam freezes where it is and only fades: a covered vcam still flying would drag the view
  public release(blend = this.options.release) {
    if (this.releasing) return;
    this.releasing = true;
    this.releaseTime = blend;
    Vcam.interrupt(this.center);
    Vcam.interrupt(this.zoom);
    this.center = null;
    this.zoom = null;
    this.zoomAnchor = null;
  }

  public get isReleased() {
    return this.releasing;
  }
  public get isDone() {
    return this.releasing && this.progress <= 0;
  }
  public get blendIn() {
    return this.options.blend;
  }
  public get blendOut() {
    return this.releaseTime;
  }
  // 0 = only what is below, 1 = only this vcam
  public get weight() {
    return Easing[this.options.easing](this.progress);
  }
  // true once, the update after the release
  public announceRelease() {
    if (!this.releasing || this.releaseAnnounced) return false;
    this.releaseAnnounced = true;
    return true;
  }

  public update(delta: number) {
    this.updateBlend(delta);
    this.updateTracks(delta);
    if (!this.isDone) return;
    Vcam.interrupt(this.center);
    Vcam.interrupt(this.zoom);
    this.center = null;
    this.zoom = null;
  }

  private updateBlend(delta: number) {
    if (this.releasing) {
      const step = this.releaseTime <= 0 ? 1 : delta / this.releaseTime;
      this.progress = Math.max(this.progress - step, 0);
      return;
    }
    const step = this.options.blend <= 0 ? 1 : delta / this.options.blend;
    this.progress = Math.min(this.progress + step, 1);
  }
  private updateTracks(delta: number) {
    if (this.center?.interrupted) this.center = null;
    if (this.zoom?.interrupted) {
      this.zoom = null;
      this.zoomAnchor = null;
    }
    const center = this.center;
    if (center !== null) {
      const eased = Vcam.advance(center, delta);
      this.view.center.x = AxiomMath.lerp(center.from.x, center.to.x, eased);
      this.view.center.y = AxiomMath.lerp(center.from.y, center.to.y, eased);
      if (center.done) this.center = null;
    }
    const zoom = this.zoom;
    if (zoom !== null) {
      const eased = Vcam.advance(zoom, delta);
      // in octaves, so zooming out feels as fast as zooming in
      this.view.zoom = zoom.from * (zoom.to / zoom.from) ** eased;
      if (this.zoomAnchor !== null) this.landOnAnchor(this.zoomAnchor, eased);
      if (zoom.done) {
        this.zoom = null;
        this.zoomAnchor = null;
      }
    }
  }
  // the anchor slides on screen from its start to the landing spot with the zoom easing; a pure
  // function of the track, so a moving anchor is hit exactly at the end
  private landOnAnchor(anchor: CameraTarget, eased: number) {
    const point = typeof anchor === "function" ? anchor() : anchor;
    const view = this.view;
    view.center.x = point.x - AxiomMath.lerp(this.anchorFrom.x, this.anchorTo.x, eased) / view.zoom;
    view.center.y = point.y - AxiomMath.lerp(this.anchorFrom.y, this.anchorTo.y, eased) / view.zoom;
  }
  // a new command on a busy track interrupts the old one; a released vcam moves nothing
  private startTrack<Value>(
    current: VcamTrack<Value> | null,
    from: Value,
    to: Value,
    move: Partial<VcamMove>,
  ) {
    Vcam.interrupt(current);
    const track = new VcamTrack(from, to, { ...VCAM_DEFAULTS.move, ...move }, () =>
      this.updateTracks(0),
    );
    if (this.releasing) track.state = "interrupted";
    return track;
  }

  private static advance<Value>(track: VcamTrack<Value>, delta: number) {
    track.elapsed += delta;
    const duration = track.move.duration;
    const progress = duration <= 0 ? 1 : Math.min(track.elapsed / duration, 1);
    if (progress >= 1) track.state = "done";
    return Easing[track.move.easing](progress);
  }
  private static interrupt<Value>(track: VcamTrack<Value> | null) {
    if (track !== null && track.state === "running") track.state = "interrupted";
  }
}
