import Aurora from "@/core/aurora/core";
import Mat4 from "@/core/axiom/mat4";

export default class CameraObject {
  private static position: Position2D = { x: 0, y: 0 };
  private static zoom: number = 1;
  private static viewBox: Box = { x: 0, y: 0, w: 0, h: 0 };

  public static setPosition(x: number, y: number) {
    this.position.x = x;
    this.position.y = y;
  }

  public static setZoom(zoom: number) {
    this.zoom = zoom;
  }

  /**DO NOT MUTATE THIS */
  public static get getPosition(): Position2D {
    return this.position;
  }

  public static get getZoom() {
    return this.zoom;
  }

  public static getViewBox(): Box {
    const { width, height } = Aurora.canvas;
    this.viewBox.w = width / this.zoom;
    this.viewBox.h = height / this.zoom;
    this.viewBox.x = this.position.x - this.viewBox.w / 2;
    this.viewBox.y = this.position.y - this.viewBox.h / 2;
    return this.viewBox;
  }

  public static screenToWorld(pos: Position2D): Position2D {
    const { width, height } = Aurora.canvas;
    return {
      x: this.position.x + (pos.x - width / 2) / this.zoom,
      y: this.position.y + (pos.y - height / 2) / this.zoom,
    };
  }

  public static worldToScreen(pos: Position2D): Position2D {
    const { width, height } = Aurora.canvas;
    return {
      x: width / 2 + (pos.x - this.position.x) * this.zoom,
      y: height / 2 + (pos.y - this.position.y) * this.zoom,
    };
  }

  public static getProjectionViewMatrix(): Mat4 {
    const { width, height } = Aurora.canvas;
    return Mat4.ortho(0, width, height, 0, 0, 1)
      .translate([width / 2, height / 2, 0])
      .scale(this.zoom)
      .translate([-this.position.x, -this.position.y, 0]);
  }
}
