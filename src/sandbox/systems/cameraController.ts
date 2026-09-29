import { Camera } from "@engine/camera/camera";
import AxiomMath from "@axiom/math";
import Cello from "@cello/cello";
import InputManager from "@engine/inputManager";
import Time from "@engine/time";
import PragmaComponent from "@pragma/component";
import { ACTION } from "@sandbox/inputActions";

const ZOOM = {
  keyOctavesPerSecond: Math.log2(1.8),
  silent: 0.15,
  audible: 0.42,
};
export default class CameraController extends PragmaComponent {
  private lastZoom: number = -1;

  constructor(internal: InternalPCProps) {
    super(internal);
  }

  preUpdate(): void {
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
    if (dirX !== 0 || dirY !== 0) Camera.pan({ x: dirX, y: dirY });
  }

  private updateZoomKeys() {
    const keyDir =
      (InputManager.onActionHold(ACTION.zoomIn) ? 1 : 0) -
      (InputManager.onActionHold(ACTION.zoomOut) ? 1 : 0);
    if (keyDir === 0) return;
    Camera.zoomBy(keyDir * ZOOM.keyOctavesPerSecond * Time.getRawDeltaTime());
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
