import Aurora from "./core";
import Aurora2DRenderer from "./renderer/renderer";
import { AuroraConfig } from "./renderer/config";
import Time from "../engine/time";
import Mat4 from "../axiom/mat4";
type CameraZoom = { current: number; max: number; min: number };
type CameraPosition = { x: number; y: number };
const cameraData = {
  keyPressed: new Set(),
};
export default class AuroraCamera {
  private static position: CameraPosition = { x: 0, y: 0 };
  private static speed: number;
  private static zoom: CameraZoom = {
    current: 0,
    max: 0,
    min: 0,
  };
  private static cameraBounds = new Float32Array([0, 0, 0]);
  private static useInputs: boolean = false;
  private static projectionViewMatrix: Mat4;
  private static origin: Position2D;

  public static initialize(config: AuroraConfig["camera"]) {
    const width = Aurora.canvas.width;
    const height = Aurora.canvas.height;
    this.projectionViewMatrix = Mat4.ortho(0, width, height, 0, 0, 1);
    this.origin = { x: width / 2, y: height / 2 };
    this.position = { x: width / 2, y: height / 2 };
    this.speed = config.speed + 100;
    this.zoom = { current: 1, max: config.zoom.max, min: config.zoom.min };

    if (config.builtInCameraInputs) {
      window.onkeydown = (event: KeyboardEvent) => {
        const pressedKey = event.key === " " ? "space" : event.key;
        !event.repeat && cameraData.keyPressed.add(pressedKey);
      };
      window.onkeyup = (event: KeyboardEvent) => {
        const pressedKey = event.key === " " ? "space" : event.key;
        cameraData.keyPressed.has(pressedKey) &&
          cameraData.keyPressed.delete(pressedKey);
      };
      this.useInputs = true;
    }
    const bind = Aurora.createBindGroup({
      label: "cameraBind",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          layout: { buffer: { type: "uniform" } },
          resource: { buffer: Aurora2DRenderer.getBuffer("cameraMatrix") },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          layout: { buffer: { type: "uniform" } },
          resource: { buffer: Aurora2DRenderer.getBuffer("worldBound") },
        },
      ],
    });

    return bind;
    //===========================================
  }

  public static get getPosition() {
    return this.position;
  }
  public static get getZoom() {
    return this.zoom.current;
  }
  public static update(buffer: GPUBuffer) {
    const width = Aurora.canvas.width;
    const height = Aurora.canvas.height;
    if (this.useInputs) this.updateControls();

    // Zaokrąglij pozycję i zoom do pełnych wartości
    const snappedPosX = Math.round(this.position.x);
    const snappedPosY = Math.round(this.position.y);
    const snappedZoom = this.zoom.current;

    this.projectionViewMatrix = Mat4.ortho(0, width, height, 0, 0, 1)
      .translate([this.origin.x, this.origin.y, 0])
      .scale(this.zoom.current)
      .translate([-this.position.x, -this.position.y, 0]);

    Aurora.device.queue.writeBuffer(
      buffer,
      0,
      AuroraCamera.getProjectionViewMatrix.elements,
    );
  }

  private static updateControls() {
    const dt = Time.getDeltaTime();
    if (cameraData.keyPressed.has("d")) this.position.x += this.speed;
    else if (cameraData.keyPressed.has("a")) this.position.x -= this.speed;
    if (cameraData.keyPressed.has("w")) this.position.y -= this.speed;
    else if (cameraData.keyPressed.has("s")) this.position.y += this.speed;
    if (cameraData.keyPressed.has("ArrowDown")) {
      const factor = Math.pow(1 / 1.02, dt * 30); // smooth multiplicative change
      this.zoom.current = Math.max(this.zoom.min, this.zoom.current * factor);
    } else if (cameraData.keyPressed.has("ArrowUp")) {
      const factor = Math.pow(1.02, dt * 30);
      this.zoom.current = Math.min(this.zoom.max, this.zoom.current * factor);
    }
  }
  public static updateCameraBound(buffer: GPUBuffer) {
    Aurora.device.queue.writeBuffer(buffer, 0, this.cameraBounds);
  }
  public static move(pos: Position2D) {
    this.position = pos;
  }
  public static setOrigin(pos: Position2D) {
    this.origin = pos;
  }
  public static scale(zoom: number) {
    this.zoom.current = zoom;
  }

  public static setCameraBounds(y: number, h: number) {
    const top = y;
    const bottom = y + h;
    this.cameraBounds[0] = Math.min(this.cameraBounds[0], top);
    this.cameraBounds[1] = Math.max(this.cameraBounds[1], bottom);
  }

  public static get getProjectionViewMatrix() {
    return this.projectionViewMatrix;
  }
  public static getViewBox(): Box {
    const width = Aurora.canvas.width;
    const height = Aurora.canvas.height;
    const zoom = this.zoom.current;
    return {
      x: this.position.x - this.origin.x / zoom,
      y: this.position.y - this.origin.y / zoom,
      w: width / zoom,
      h: height / zoom,
    };
  }
  public static worldToScreen(pos: Position2D): Position2D {
    const zoom = this.zoom.current;
    return {
      x: this.origin.x + (pos.x - this.position.x) * zoom,
      y: this.origin.y + (pos.y - this.position.y) * zoom,
    };
  }
  public static screenToWorld(pos: Position2D): Position2D {
    const zoom = this.zoom.current;
    return {
      x: this.position.x + (pos.x - this.origin.x) / zoom,
      y: this.position.y + (pos.y - this.origin.y) / zoom,
    };
  }
}
