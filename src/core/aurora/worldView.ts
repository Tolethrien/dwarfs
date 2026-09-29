import Aurora from "./core";

export interface CameraData {
  center: Position2D;
  zoom: number;
  rotation: number;
}
// must match struct Camera in the world, light and effect shaders
export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export default class WorldView {
  private static readonly camera: CameraData = {
    center: { x: 0, y: 0 },
    zoom: 1,
    rotation: 0,
  };
  private static readonly transform: ViewTransform = {
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
  };
  private static readonly snap = { enabled: false, resting: false };

  public static setSnap(enabled: boolean) {
    this.snap.enabled = enabled;
  }
  public static setCamera(
    { center, zoom, rotation }: Partial<CameraData>,
    still?: boolean,
  ) {
    const camera = this.camera;
    const x = center?.x ?? camera.center.x;
    const y = center?.y ?? camera.center.y;
    const nextZoom = zoom ?? camera.zoom;
    const nextRotation = rotation ?? camera.rotation;
    this.snap.resting =
      still ??
      (x === camera.center.x &&
        y === camera.center.y &&
        nextZoom === camera.zoom &&
        nextRotation === camera.rotation);
    camera.center.x = x;
    camera.center.y = y;
    camera.zoom = nextZoom;
    camera.rotation = nextRotation;
  }
  public static get getCamera(): CameraData {
    const { center, zoom, rotation } = this.camera;
    return { center: { x: center.x, y: center.y }, zoom, rotation };
  }
  public static get getTransform(): Readonly<ViewTransform> {
    const { center, zoom, rotation } = this.camera;
    const transform = this.transform;
    transform.x = center.x;
    transform.y = center.y;
    if (this.snap.enabled && this.snap.resting && rotation === 0)
      this.snapCenter(transform, zoom);
    transform.scale = zoom * Aurora.getRenderScale;
    transform.rotation = rotation;
    return transform;
  }
  public static snapCenter(center: Position2D, zoom: number) {
    const scale = zoom * Aurora.getRenderScale;
    const render = Aurora.getRenderSize;
    const canvas = Aurora.canvas;
    center.x = this.snapAxis(center.x, scale, render.width, canvas.width);
    center.y = this.snapAxis(center.y, scale, render.height, canvas.height);
  }
  public static get getBounds(): BoxAABB {
    const transform = this.getTransform;
    const render = Aurora.getRenderSize;
    const halfWidth = render.width / 2 / transform.scale;
    const halfHeight = render.height / 2 / transform.scale;
    const cos = Math.abs(Math.cos(transform.rotation));
    const sin = Math.abs(Math.sin(transform.rotation));
    const reachX = halfWidth * cos + halfHeight * sin;
    const reachY = halfWidth * sin + halfHeight * cos;
    return {
      min: { x: transform.x - reachX, y: transform.y - reachY },
      max: { x: transform.x + reachX, y: transform.y + reachY },
    };
  }
  public static worldToScreen({ x, y }: Position2D): Position2D {
    const transform = this.getTransform;
    let right = (x - transform.x) * transform.scale;
    let down = (y - transform.y) * transform.scale;
    if (transform.rotation !== 0) {
      const cos = Math.cos(transform.rotation);
      const sin = Math.sin(transform.rotation);
      [right, down] = [right * cos - down * sin, right * sin + down * cos];
    }
    const render = Aurora.getRenderSize;
    const canvas = Aurora.canvas;
    return {
      x: ((right + Math.floor(render.width / 2)) * canvas.width) / render.width,
      y:
        ((down + Math.floor(render.height / 2)) * canvas.height) /
        render.height,
    };
  }
  public static screenToWorld({ x, y }: Position2D): Position2D {
    const transform = this.getTransform;
    const render = Aurora.getRenderSize;
    const canvas = Aurora.canvas;
    let right =
      (x * render.width) / canvas.width - Math.floor(render.width / 2);
    let down =
      (y * render.height) / canvas.height - Math.floor(render.height / 2);
    if (transform.rotation !== 0) {
      const cos = Math.cos(transform.rotation);
      const sin = Math.sin(transform.rotation);
      [right, down] = [right * cos + down * sin, down * cos - right * sin];
    }
    return {
      x: right / transform.scale + transform.x,
      y: down / transform.scale + transform.y,
    };
  }
  private static snapAxis(
    value: number,
    scale: number,
    render: number,
    canvas: number,
  ) {
    const step = Math.max(1, render / canvas);
    const origin = Math.floor(render / 2);
    return (
      (Math.round((value * scale - origin) / step) * step + origin) / scale
    );
  }
}
