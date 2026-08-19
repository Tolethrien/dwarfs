import AuroraCamera from "@/core/aurora/camera";
import AxiomMath from "@/core/axiom/math";
import Vec2 from "@/core/axiom/vec2";
import InputManager from "@/core/engine/inputManager";
import Time from "@/core/engine/time";
import PragmaComponent from "@/core/pragma/component";
import { ACTION } from "@/sandbox/inputActions";
import CameraObject from "@/sandbox/managers/cameraObject";
import MapObject from "@/sandbox/managers/mapObject";

const MOVE_SPEED = 500;
const ACCEL_SMOOTH = 0.03;
const DECEL_SMOOTH = 0.09;

const ZOOM_STEP = 1.15;
const ZOOM_KEY_RATE = 1.8;
const ZOOM_SMOOTH = 0.12;
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;

export default class CameraController extends PragmaComponent {
  private velocity: Vec2 = Vec2.Zero;
  private moveTarget: Vec2 = Vec2.Zero;
  private targetZoom: number = 1;
  private anchorScreen: Position2D | null = null;
  private anchorWorld: Position2D | null = null;
  private bounds: Box | null = null;

  constructor(internal: InternalPCProps) {
    super(internal);
  }

  start(): void {
    this.targetZoom = CameraObject.getZoom;
    this.setBounds(MapObject.getWorldBounds());
  }

  preUpdate(): void {
    const dt = Time.getDeltaTime();
    if (dt === 0) return;

    this.updateZoom(dt);
    this.updateMove(dt);
    this.clampToBounds();

    AuroraCamera.setMatrix(CameraObject.getProjectionViewMatrix());
  }

  public setBounds(bounds: Box | null) {
    this.bounds = bounds;
  }

  private updateMove(dt: number) {
    const dirX =
      (InputManager.onActionHold(ACTION.cameraRight) ? 1 : 0) -
      (InputManager.onActionHold(ACTION.cameraLeft) ? 1 : 0);
    const dirY =
      (InputManager.onActionHold(ACTION.cameraDown) ? 1 : 0) -
      (InputManager.onActionHold(ACTION.cameraUp) ? 1 : 0);
    const moving = dirX !== 0 || dirY !== 0;

    this.moveTarget.set(dirX, dirY);
    if (moving)
      this.moveTarget.normalize().scale(MOVE_SPEED / CameraObject.getZoom);

    const smooth = moving ? ACCEL_SMOOTH : DECEL_SMOOTH;
    this.velocity.lerp(this.moveTarget, 1 - Math.exp(-dt / smooth));

    const pos = CameraObject.getPosition;
    CameraObject.setPosition(
      pos.x + this.velocity.x * dt,
      pos.y + this.velocity.y * dt,
    );
  }

  private updateZoom(dt: number) {
    if (InputManager.isMouseScrolled()) {
      const dir = -Math.sign(InputManager.getMouseScroll());
      this.setTargetZoom(this.targetZoom * Math.pow(ZOOM_STEP, dir));

      const mouse = InputManager.getMousePos();
      this.anchorScreen = { x: mouse.x, y: mouse.y };
      this.anchorWorld = CameraObject.screenToWorld(mouse);
    }

    const keyDir =
      (InputManager.onActionHold(ACTION.zoomIn) ? 1 : 0) -
      (InputManager.onActionHold(ACTION.zoomOut) ? 1 : 0);
    if (keyDir !== 0) {
      this.setTargetZoom(
        this.targetZoom * Math.pow(ZOOM_KEY_RATE, keyDir * dt),
      );
      this.anchorScreen = null;
      this.anchorWorld = null;
    }

    const current = CameraObject.getZoom;
    if (Math.abs(this.targetZoom - current) < 0.00001) {
      this.anchorScreen = null;
      this.anchorWorld = null;
      return;
    }

    const t = 1 - Math.exp(-dt / ZOOM_SMOOTH);
    CameraObject.setZoom(current + (this.targetZoom - current) * t);

    if (this.anchorScreen && this.anchorWorld) {
      const drifted = CameraObject.screenToWorld(this.anchorScreen);
      const pos = CameraObject.getPosition;
      CameraObject.setPosition(
        pos.x + (this.anchorWorld.x - drifted.x),
        pos.y + (this.anchorWorld.y - drifted.y),
      );
    }
  }

  private setTargetZoom(zoom: number) {
    this.targetZoom = AxiomMath.clamp(zoom, ZOOM_MIN, ZOOM_MAX);
  }

  private clampToBounds() {
    if (!this.bounds) return;
    const view = CameraObject.getViewBox();
    const pos = CameraObject.getPosition;
    const b = this.bounds;

    const x =
      view.w >= b.w
        ? b.x + b.w / 2
        : AxiomMath.clamp(pos.x, b.x + view.w / 2, b.x + b.w - view.w / 2);
    const y =
      view.h >= b.h
        ? b.y + b.h / 2
        : AxiomMath.clamp(pos.y, b.y + view.h / 2, b.y + b.h - view.h / 2);

    CameraObject.setPosition(x, y);
  }
}
