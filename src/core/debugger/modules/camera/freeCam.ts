import AxiomMath from "@axiom/math";
import type { CameraDebugData, CameraView } from "../../interfaces";

// speed in view units per second (shown size, zoom cancels out), rates are damp rates;
// edge band in css pixels of the canvas, the pan waits dwellMs there so a pass of the mouse
// on the way to the profiler window does not jerk the view
export const FREE_CAM = {
  speed: 800,
  acceleration: 10,
  deceleration: 14,
  stickDeadzone: 0.08,
  edge: { band: 32, dwellMs: 200 },
  // octaves per wheel notch, Chromium reports 100 per notch
  wheel: { step: 0.25, notch: 100 },
  zoom: { min: 1 / 16, max: 16, smoothing: 14, rest: 1e-4 },
};

// the debug camera: starts from what the game showed, the game camera keeps running under it
export class FreeCam {
  public hijacked = false;
  public speed = FREE_CAM.speed;
  public edgePan = false;
  public zoomTarget = 1;
  public readonly stick: Position2D = { x: 0, y: 0 };
  public readonly view: CameraView = { center: { x: 0, y: 0 }, zoom: 1 };
  // the game camera's shown view (a live object), a hijack and a resync start from it
  private shown: Readonly<CameraView> | null = null;
  private readonly velocity: Position2D = { x: 0, y: 0 };
  // css pixels of the canvas kept in place until the zoom lands, null = the center
  private zoomAnchor: Position2D | null = null;
  private readonly mouse = {
    x: 0,
    y: 0,
    inside: false,
    dragging: false,
    edgeSince: NaN,
  };
  private readonly drag: Position2D = { x: 0, y: 0 };
  private wheel = 0;

  constructor(private readonly source: () => CameraDebugData | null) {
    window.addEventListener("mousemove", (event) => this.onMove(event));
    window.addEventListener("mousedown", (event) => this.onDown(event));
    window.addEventListener("mouseup", (event) => {
      if (event.button === 1) this.mouse.dragging = false;
    });
    window.addEventListener("wheel", (event) => this.onWheel(event), { passive: true });
    document.documentElement.addEventListener("mouseleave", () => {
      this.mouse.inside = false;
      this.mouse.dragging = false;
    });
    window.addEventListener("blur", () => (this.mouse.dragging = false));
  }

  public track(shown: Readonly<CameraView>) {
    this.shown = shown;
  }
  public hijack() {
    this.hijacked = true;
    this.resync();
  }
  public release() {
    this.hijacked = false;
    this.stick.x = this.stick.y = 0;
    this.stopVelocity();
  }
  public resync() {
    const shown = this.shown;
    if (shown === null) return;
    const view = this.view;
    view.center.x = shown.center.x;
    view.center.y = shown.center.y;
    view.zoom = this.zoomTarget = shown.zoom;
    this.zoomAnchor = null;
    this.stopVelocity();
  }
  public setZoom(level: number) {
    this.zoomTarget = AxiomMath.clamp(level, FREE_CAM.zoom.min, FREE_CAM.zoom.max);
    this.zoomAnchor = null;
  }
  public setStick({ x, y }: Position2D) {
    this.stick.x = x;
    this.stick.y = y;
  }

  public update() {
    const view = this.view;
    const source = this.source();
    if (source === null) return view;
    const delta = source.delta();
    const rect = source.canvas().getBoundingClientRect();
    if (rect.height === 0) return view;
    const unitsPerPixel = source.viewHeight() / rect.height;

    this.readWheel();
    this.updateZoom(delta, rect, unitsPerPixel);
    view.center.x -= (this.drag.x * unitsPerPixel) / view.zoom;
    view.center.y -= (this.drag.y * unitsPerPixel) / view.zoom;
    this.drag.x = this.drag.y = 0;
    this.pan(delta, rect);
    return view;
  }

  private readWheel() {
    if (this.wheel === 0) return;
    const { step, notch } = FREE_CAM.wheel;
    this.setZoom(this.zoomTarget * 2 ** ((-this.wheel / notch) * step));
    this.zoomAnchor = this.mouse.inside ? { x: this.mouse.x, y: this.mouse.y } : null;
    this.wheel = 0;
  }
  // in octaves, the anchor keeps the world point under it in place on screen
  private updateZoom(delta: number, rect: DOMRect, unitsPerPixel: number) {
    const view = this.view;
    const { smoothing, rest } = FREE_CAM.zoom;
    const zoomBefore = view.zoom;
    const octaves = Math.log2(this.zoomTarget / view.zoom);
    if (Math.abs(octaves) <= rest) view.zoom = this.zoomTarget;
    else view.zoom *= 2 ** (octaves * AxiomMath.damp(smoothing, delta));
    const anchor = this.zoomAnchor;
    if (anchor !== null) {
      const scale = unitsPerPixel * (1 / zoomBefore - 1 / view.zoom);
      view.center.x += (anchor.x - rect.width / 2) * scale;
      view.center.y += (anchor.y - rect.height / 2) * scale;
    }
    if (view.zoom === this.zoomTarget) this.zoomAnchor = null;
  }
  private pan(delta: number, rect: DOMRect) {
    let x = 0;
    let y = 0;
    const stickLength = Math.hypot(this.stick.x, this.stick.y);
    if (stickLength > FREE_CAM.stickDeadzone) {
      // squared response: fine moves near the center, full speed at the rim
      const response = Math.min(1, stickLength) ** 2 / stickLength;
      x += this.stick.x * response;
      y += this.stick.y * response;
    }
    const edge = this.edgeDirection(rect);
    x += edge.x;
    y += edge.y;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    const velocity = this.velocity;
    const rate = length > 0 ? FREE_CAM.acceleration : FREE_CAM.deceleration;
    const blend = AxiomMath.damp(rate, delta);
    velocity.x += (x * this.speed - velocity.x) * blend;
    velocity.y += (y * this.speed - velocity.y) * blend;
    if (length === 0 && Math.hypot(velocity.x, velocity.y) < 1) this.stopVelocity();
    this.view.center.x += (velocity.x * delta) / this.view.zoom;
    this.view.center.y += (velocity.y * delta) / this.view.zoom;
  }
  // deeper into the band = faster
  private edgeDirection(rect: DOMRect): Position2D {
    const mouse = this.mouse;
    const { band, dwellMs } = FREE_CAM.edge;
    if (!this.edgePan || !mouse.inside || mouse.dragging) {
      mouse.edgeSince = NaN;
      return { x: 0, y: 0 };
    }
    const x = FreeCam.edgeAxis(mouse.x, rect.width, band);
    const y = FreeCam.edgeAxis(mouse.y, rect.height, band);
    if (x === 0 && y === 0) {
      mouse.edgeSince = NaN;
      return { x, y };
    }
    const now = performance.now();
    if (Number.isNaN(mouse.edgeSince)) mouse.edgeSince = now;
    return now - mouse.edgeSince < dwellMs ? { x: 0, y: 0 } : { x, y };
  }
  private static edgeAxis(position: number, size: number, band: number) {
    if (position < band) return -(1 - position / band);
    if (position > size - band) return (position - (size - band)) / band;
    return 0;
  }
  private stopVelocity() {
    this.velocity.x = this.velocity.y = 0;
  }

  // only while hijacked: before Aurora.init there is no canvas yet
  private onMove(event: MouseEvent) {
    const source = this.source();
    if (!this.hijacked || source === null) return;
    const rect = source.canvas().getBoundingClientRect();
    const mouse = this.mouse;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (mouse.dragging) {
      this.drag.x += x - mouse.x;
      this.drag.y += y - mouse.y;
    }
    mouse.x = x;
    mouse.y = y;
    mouse.inside = x >= 0 && y >= 0 && x < rect.width && y < rect.height;
  }
  private onDown(event: MouseEvent) {
    if (!this.hijacked || event.button !== 1 || !this.mouse.inside) return;
    // no autoscroll cursor
    event.preventDefault();
    this.mouse.dragging = true;
  }
  private onWheel(event: WheelEvent) {
    if (!this.hijacked || !this.mouse.inside) return;
    this.wheel +=
      event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
        ? event.deltaY
        : Math.sign(event.deltaY) * FREE_CAM.wheel.notch;
  }
}
