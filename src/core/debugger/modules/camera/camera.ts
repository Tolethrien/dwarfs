import type {
  CameraDebugData,
  CameraView,
  ICameraModule,
  ICommandModule,
  ILogHandle,
  ITweakModule,
} from "../../interfaces";
import { profilerState } from "../../profilerState";
import { FreeCam } from "./freeCam";
import { CAMERA_PAGES, controlPanel, statePanel } from "./panels";

export class CameraDevModule implements ICameraModule {
  private source: CameraDebugData | null = null;
  private readonly freeCam = new FreeCam(() => this.source);

  constructor(
    private readonly tweak: ITweakModule,
    command: ICommandModule,
    private readonly log: ILogHandle,
  ) {
    // frozen, so camera.config cannot be replaced from the console
    const root = Object.freeze({
      config: (page?: string) =>
        page === undefined ? this.tweak.openGroup(CAMERA_PAGES.group) : this.tweak.open(page),
      hijack: (on?: boolean) => this.setHijacked(on ?? !this.freeCam.hijacked),
    });
    command.expose("camera", () => root, {
      hint: `camera debug window: camera.config(page?), pages: ${Object.keys(CAMERA_PAGES.order).join(", ")}; camera.hijack(on?) = free cam`,
    });
  }

  public get isHijacked() {
    return this.freeCam.hijacked;
  }

  public connect(source: CameraDebugData) {
    this.source = source;
    const setHijacked = (on: boolean) => this.setHijacked(on);
    this.tweak.register("cameraState", statePanel(source));
    this.tweak.register("cameraControl", controlPanel(source, this.freeCam, setHijacked));
  }

  // the free cam is steered from the profiler, closing it gives the camera back
  public override(shown: CameraView) {
    this.freeCam.track(shown);
    if (!this.freeCam.hijacked) return shown;
    if (!profilerState.isOpen) {
      this.setHijacked(false);
      return shown;
    }
    return this.freeCam.update();
  }

  private setHijacked(on: boolean) {
    if (on === this.freeCam.hijacked) return;
    if (on) this.freeCam.hijack();
    else this.freeCam.release();
    this.log.notify(on ? "camera hijacked, free cam" : "camera back to the game");
  }
}

export const prodCamera: ICameraModule = {
  connect: () => {},
  override: (shown) => shown,
  isHijacked: false,
};
