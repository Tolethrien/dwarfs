import { Camera } from "@engine/camera/camera";
import AxiomMath from "@axiom/math";
import Cello from "@cello/cello";
import InputManager from "@engine/inputManager";
import PragmaSystem from "@pragma/system";
import { ACTION } from "@sandbox/inputActions";
import type Dwarf from "@sandbox/bActors/dwarf";
import type { DwarfClickedEvent } from "@sandbox/bActors/dwarf";
import type { DwarfLaunchedEvent } from "./playerInput";

const ZOOM = {
  keyOctaves: 0.25,
  reset: 0.5,
  silent: 0.15,
  audible: 0.42,
};
// click: zooms in on the clicked dwarf, letting it go zooms back out to where it was
const FOLLOW = { smoothing: 6, clickZoom: 1 };

// free: the camera is the player's; onShot: rides along with every launched dwarf;
// click: rides along with the dwarf clicked
export type CameraLock = "free" | "onShot" | "click";
export const CAMERA_LOCKS: Record<CameraLock, string> = {
  free: "Wolna",
  onShot: "Za strzałem",
  click: "Po kliknięciu",
};

export default class CameraController extends PragmaSystem {
  private lastZoom: number = -1;
  private lock: CameraLock = "free";
  private followed: Dwarf | null = null;
  // the zoom before a click zoomed in, NaN = nothing to go back to
  private zoomBefore = NaN;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  start(): void {
    this.onSceneEvent<DwarfLaunchedEvent>("dwarfLaunched", (event) => {
      if (this.lock === "onShot") this.follow(event.dwarf);
    });
    this.onSceneEvent<DwarfClickedEvent>("dwarfClicked", (event) => {
      if (this.lock !== "click") return;
      if (Number.isNaN(this.zoomBefore)) this.zoomBefore = Camera.getZoomTarget;
      Camera.setZoom(FOLLOW.clickZoom);
      this.follow(event.dwarf);
    });
  }

  public get currentLock() {
    return this.lock;
  }

  public setLock(lock: CameraLock) {
    this.lock = lock;
    this.release();
  }

  public cycleLock() {
    const locks = Object.keys(CAMERA_LOCKS) as CameraLock[];
    this.setLock(locks[(locks.indexOf(this.lock) + 1) % locks.length]);
  }

  public follow(dwarf: Dwarf) {
    this.followed = dwarf;
    Camera.setSmoothing(FOLLOW.smoothing);
    Camera.setTarget(() => dwarf.transform.getRenderPosition());
    Camera.setMode("follow");
  }

  // the view stays where it was, free again; false = nothing was followed
  public stopFollow() {
    if (this.followed === null) return false;
    this.followed = null;
    Camera.setTarget(null);
    Camera.setMode("free");
    return true;
  }

  // stops the follow and takes back a click's zoom; false = there was nothing to let go
  public release() {
    const stopped = this.stopFollow();
    if (Number.isNaN(this.zoomBefore)) return stopped;
    Camera.setZoom(this.zoomBefore);
    this.zoomBefore = NaN;
    return true;
  }

  preUpdate(): void {
    if (this.followed !== null && !this.followed.getAlive()) this.release();
    this.updatePan();
    this.updateZoomKeys();
    this.updateZoomVolume();
  }

  private updatePan() {
    const dirX =
      (InputManager.onActionHold(ACTION.cameraRight) ? 1 : 0) -
      (InputManager.onActionHold(ACTION.cameraLeft) ? 1 : 0);
    const dirY =
      (InputManager.onActionHold(ACTION.cameraDown) ? 1 : 0) -
      (InputManager.onActionHold(ACTION.cameraUp) ? 1 : 0);
    if (dirX === 0 && dirY === 0) return;
    // steering by hand takes the camera back from the follow, the zoom stays as it is
    if (this.stopFollow()) this.zoomBefore = NaN;
    Camera.pan({ x: dirX, y: dirY });
  }

  private updateZoomKeys() {
    if (InputManager.onActionPressed(ACTION.zoomReset)) Camera.setZoom(ZOOM.reset);
    // with zoom levels every zoomBy moves at least one level, so one press is one level
    const keyDir =
      (InputManager.onActionPressed(ACTION.zoomIn) ? 1 : 0) -
      (InputManager.onActionPressed(ACTION.zoomOut) ? 1 : 0);
    if (keyDir === 0) return;
    Camera.zoomBy(keyDir * ZOOM.keyOctaves);
  }

  private updateZoomVolume() {
    const zoom = Camera.getZoom;
    if (zoom === this.lastZoom) return;
    this.lastZoom = zoom;
    const effect = Cello.getEffectNode("zoomVolume");
    if (!effect) return;
    const gainNode = effect.output as GainNode;
    gainNode.gain.value = AxiomMath.clamp(
      AxiomMath.inverseLerp(ZOOM.silent, ZOOM.audible, zoom),
      0,
      1,
    );
  }
}
