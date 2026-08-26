import Aurora from "../aurora/core";
import Draw from "../aurora/draw";
import AABB from "../axiom/AABB";
import AxiomMath from "../axiom/math";
import InputManager from "../engine/inputManager";
import { KEY_GROUP } from "../engine/keys";
import Time from "../engine/time";
import UINode from "./node";

const DESIGN_W = 1920;
const DESIGN_H = 1080;
const DOUBLE_CLICK_MS = 280;
const SCROLL_FACTOR = 0.5;
interface Transform {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
}
const NO_TRANSFORM: Transform = { sx: 1, sy: 1, tx: 0, ty: 0 };
export default class Navi {
  public static readonly root: UINode = new UINode();
  private static appendQueue: { node: UINode; target: UINode }[] = [];
  private static removeQueue: { node: UINode; target: UINode }[] = [];
  private static lastMouse: Position2D = { x: 0, y: 0 };
  private static userScale = 1;
  private static scale = 1;
  private static layoutDirty = true;
  private static reflowRequested = false;
  private static hoveredNode: UINode | undefined;
  private static hoverPath: UINode[] = [];
  private static touched: UINode[] = [];
  private static pressTarget: UINode | undefined;
  private static rightPressTarget: UINode | undefined;
  private static clickedNode: UINode | undefined;
  private static rightClickedNode: UINode | undefined;
  private static lastClickNode: UINode | undefined;
  private static lastClickTime = 0;
  private static focusedNode: UINode | undefined;
  private static focusPath: UINode[] = [];
  private static styleAnimated: Set<UINode> = new Set();
  public static initialize() {
    this.root.tags.add("root");
    this.root.input = "none";
    this.resize();
  }

  public static get getScale() {
    return this.scale;
  }

  public static setUserScale(value: number) {
    this.userScale = AxiomMath.clamp(value, 0.5, 2);
    this.resize();
  }
  public static get getClicked() {
    return this.clickedNode;
  }
  public static get getRightClicked() {
    return this.rightClickedNode;
  }
  public static get getHovered() {
    return this.hoveredNode;
  }
  public static get getFocused() {
    return this.focusedNode;
  }
  public static registerAnimated(node: UINode) {
    this.styleAnimated.add(node);
  }
  public static resize() {
    const auto = Math.min(
      Aurora.canvas.width / DESIGN_W,
      Aurora.canvas.height / DESIGN_H,
    );
    this.scale = auto * this.userScale;
    this.root.pixelBox = {
      x: 0,
      y: 0,
      w: Aurora.canvas.width,
      h: Aurora.canvas.height,
    };
    this.layoutDirty = true;
  }

  public static append(node: UINode, target: UINode = this.root) {
    this.appendQueue.push({ node, target });
    return node;
  }
  public static remove(node: UINode, target: UINode) {
    this.removeQueue.push({ node, target });
  }
  public static markLayoutDirty() {
    this.layoutDirty = true;
  }

  public static updateSystem() {
    InputManager.suspendClaim();
    this.nodeManipulationPhase();
    this.contentPhase();
    this.dragPhase();
    this.scrollPhase();
    this.measurePhase();
    this.arrangePhase();
    this.reflowPhase();
    this.hitTestPhase();
    this.animationPhase();
    InputManager.setMouseClaim(this.hoveredNode !== undefined);
  }

  public static drawSystem() {
    this.drawPhase();
  }

  //=============================== Phases

  private static nodeManipulationPhase() {
    if (!this.appendQueue.length && !this.removeQueue.length) return;

    for (const { node, target } of this.appendQueue) {
      target.children.push(node);
      node.parent = target;
    }
    this.appendQueue.length = 0;

    for (const { node, target } of this.removeQueue) {
      const i = target.children.indexOf(node);
      if (i === -1) {
        console.warn("there is no child to remove");
        continue;
      }
      this.releaseNode(node);
      target.children.splice(i, 1);
      node.parent = undefined;
    }
    this.removeQueue.length = 0;

    this.layoutDirty = true;
  }

  private static contentPhase() {
    this.contentTree(this.root);
  }

  private static measurePhase() {
    if (!this.layoutDirty) return;
    this.measureTree(this.root);
  }

  private static arrangePhase() {
    if (!this.layoutDirty) return;
    this.arrangeTree(this.root);
    this.layoutDirty = false;
  }
  /** wrapped nodes only learn their real extent while being arranged */
  private static reflowPhase() {
    if (!this.reflowRequested) return;
    this.reflowRequested = false;
    this.measureTree(this.root);
    this.arrangeTree(this.root);
  }
  private static hitTestPhase() {
    this.clearOneFrameFlags();
    this.clickedNode = undefined;
    this.rightClickedNode = undefined;
    const mouse = InputManager.getMousePos();
    const screen: Box = {
      x: 0,
      y: 0,
      w: Aurora.canvas.width,
      h: Aurora.canvas.height,
    };
    let target = this.hitTree(this.root, mouse, screen, { x: 0, y: 0 });
    if (this.pressTarget && target !== this.pressTarget) target = undefined;
    if (this.rightPressTarget && target !== this.rightPressTarget)
      target = undefined;
    this.applyHover(target);
    this.applyFocus(target);
    this.applyLeftButton(target);
    this.applyRightButton(target);
  }
  private static drawPhase() {
    const screen: Box = {
      x: 0,
      y: 0,
      w: Aurora.canvas.width,
      h: Aurora.canvas.height,
    };
    this.drawTree(this.root, { x: 0, y: 0 }, screen, NO_TRANSFORM);
    Draw.popClip();
  }
  private static scrollPhase() {
    const wheel = InputManager.getMouseScroll();
    let dx = wheel.x;
    let dy = wheel.y;

    if (InputManager.isAnyKeyHold(KEY_GROUP.shift)) {
      dx += dy;
      dy = 0;
    } else if (dy !== 0 && !this.findScrollable(this.hoveredNode, "y")) {
      // nothing here scrolls vertically, so a sideways-only strip takes it
      dx += dy;
      dy = 0;
    }

    this.applyWheel("y", dy);
    this.applyWheel("x", dx);
  }
  private static dragPhase() {
    const mouse = InputManager.getMousePos();
    const dx = mouse.x - this.lastMouse.x;
    const dy = mouse.y - this.lastMouse.y;
    this.lastMouse.x = mouse.x;
    this.lastMouse.y = mouse.y;

    if (!this.pressTarget) return;
    if (dx === 0 && dy === 0) return;
    this.pressTarget.onDrag({ x: dx, y: dy });
  }
  private static animationPhase() {
    const dt = Time.getRawDeltaTime();
    for (const node of this.styleAnimated) node.tickStyle(dt);
  }

  private static contentTree(node: UINode) {
    if (!node.active) return;
    if (node.contentChanged()) this.layoutDirty = true;
    for (const child of node.children) this.contentTree(child);
  }

  private static measureTree(node: UINode) {
    for (const child of node.children) this.measureTree(child);
    node.measureSelf(this.scale);
  }

  private static arrangeTree(node: UINode) {
    node.layoutChildren(this.scale);
    for (const child of node.children) this.arrangeTree(child);
  }

  private static drawTree(
    node: UINode,
    offset: Position2D,
    clip: Box,
    transform: Transform,
  ) {
    if (!node.active) return;

    // clipping stays on the layout box, so it never disagrees with the hit test
    const childClip = this.resolveChildClip(node, clip, offset);
    if (childClip === null) return;

    const style = node.paintStyle;
    const uiScale = this.scale;

    const laid: Box = {
      x: node.pixelBox.x + offset.x + style.nudge.x * uiScale,
      y: node.pixelBox.y + offset.y + style.nudge.y * uiScale,
      w: node.pixelBox.w,
      h: node.pixelBox.h,
    };

    // layout space → screen space
    const outer: Box = {
      x: laid.x * transform.sx + transform.tx,
      y: laid.y * transform.sy + transform.ty,
      w: laid.w * transform.sx,
      h: laid.h * transform.sy,
    };

    const sx = style.scale.x;
    const sy = style.scale.y;
    const cx = outer.x + outer.w / 2;
    const cy = outer.y + outer.h / 2;
    const visual: Box = {
      x: cx - (outer.w * sx) / 2,
      y: cy - (outer.h * sy) / 2,
      w: outer.w * sx,
      h: outer.h * sy,
    };

    if (node.parent && AABB.overlaps(visual, clip)) {
      const x0 = Math.round(clip.x);
      const y0 = Math.round(clip.y);
      const x1 = Math.round(clip.x + clip.w);
      const y1 = Math.round(clip.y + clip.h);

      Draw.popClip();
      Draw.clip({
        position: { x: x0, y: y0 },
        size: { width: x1 - x0, height: y1 - y0 },
      });
      node.draw(visual);
    }

    // scaling about our own centre folds into the map the children get
    const childTransform: Transform =
      sx === 1 && sy === 1
        ? transform
        : {
            sx: transform.sx * sx,
            sy: transform.sy * sy,
            tx: (transform.tx - cx) * sx + cx,
            ty: (transform.ty - cy) * sy + cy,
          };

    const childOffset = {
      x: offset.x + node.scrollOffset.x + style.nudge.x * uiScale,
      y: offset.y + node.scrollOffset.y + style.nudge.y * uiScale,
    };
    for (const child of node.children) {
      this.drawTree(child, childOffset, childClip, childTransform);
    }
  }

  private static resolveChildClip(
    node: UINode,
    clip: Box,
    offset: Position2D,
  ): Box | null {
    const clipsX = node.style.overflowX !== "visible";
    const clipsY = node.style.overflowY !== "visible";
    if (!clipsX && !clipsY) return clip;

    const own: Box = { x: clip.x, y: clip.y, w: clip.w, h: clip.h };
    if (clipsX) {
      own.x = node.pixelBox.x + offset.x;
      own.w = node.pixelBox.w;
    }
    if (clipsY) {
      own.y = node.pixelBox.y + offset.y;
      own.h = node.pixelBox.h;
    }

    const hit = AABB.getIntersection(clip, own);
    if (hit === null) return null;
    return {
      x: hit.min.x,
      y: hit.min.y,
      w: hit.max.x - hit.min.x,
      h: hit.max.y - hit.min.y,
    };
  }
  public static requestReflow() {
    this.reflowRequested = true;
  }
  private static clearOneFrameFlags() {
    for (const node of this.touched) {
      node.entered = false;
      node.left = false;
      node.enteredWithin = false;
      node.leftWithin = false;
      node.clicked = false;
      node.clickedWithin = false;
      node.doubleClicked = false;
      node.doubleClickedWithin = false;
      node.rightClicked = false;
      node.rightClickedWithin = false;
      node.focusGained = false;
      node.focusLost = false;
    }
    this.touched.length = 0;
  }
  private static hitTree(
    node: UINode,
    mouse: Position2D,
    clip: Box,
    offset: Position2D,
  ): UINode | undefined {
    if (!node.active) return undefined;
    if (node.input === "disabled") return undefined;

    const childClip = this.resolveChildClip(node, clip, offset);
    if (childClip === null) return undefined;

    if (node.input === "absorb") {
      if (this.pointInside(node, mouse, clip, offset)) return node;
      return undefined;
    }

    const childOffset = {
      x: offset.x + node.scrollOffset.x,
      y: offset.y + node.scrollOffset.y,
    };

    // last child is drawn on top, so it gets asked first
    for (let i = node.children.length - 1; i >= 0; i--) {
      const hit = this.hitTree(node.children[i], mouse, childClip, childOffset);
      if (hit) return hit;
    }

    if (node.input === "none") return undefined;
    if (this.pointInside(node, mouse, clip, offset)) return node;
    return undefined;
  }
  private static pointInside(
    node: UINode,
    mouse: Position2D,
    clip: Box,
    offset: Position2D,
  ) {
    const visible = AABB.getIntersection(this.shifted(node, offset), clip);
    if (visible === null) return false;
    return AABB.containsPoint(visible, mouse);
  }
  private static applyHover(target: UINode | undefined) {
    const path: UINode[] = [];
    let walk = target;
    while (walk) {
      path.push(walk);
      walk = walk.parent;
    }
    path.reverse();

    // direct hover belongs to the target alone
    if (this.hoveredNode !== target) {
      if (this.hoveredNode) {
        this.hoveredNode.hovered = false;
        this.hoveredNode.left = true;
        this.touched.push(this.hoveredNode);
      }
      if (target) {
        target.hovered = true;
        target.entered = true;
        this.touched.push(target);
      }
      this.hoveredNode = target;
    }

    // "within" follows the path, so a shared ancestor never blinks
    let common = 0;
    while (
      common < path.length &&
      common < this.hoverPath.length &&
      path[common] === this.hoverPath[common]
    ) {
      common++;
    }

    for (let i = common; i < this.hoverPath.length; i++) {
      const old = this.hoverPath[i];
      old.hoveredWithin = false;
      old.leftWithin = true;
      this.touched.push(old);
    }
    for (let i = common; i < path.length; i++) {
      path[i].hoveredWithin = true;
      path[i].enteredWithin = true;
      this.touched.push(path[i]);
    }

    this.hoverPath = path;
  }
  private static applyLeftButton(target: UINode | undefined) {
    // isMouseClicked is the press edge, despite the name
    if (InputManager.isMouseClicked("LEFT")) {
      this.pressTarget = target;
      if (target) target.onPress(InputManager.getMousePos());
    }

    if (InputManager.isMouseReleased("LEFT")) {
      if (this.pressTarget && this.pressTarget === target) {
        this.fireClick(target);
      }
      if (this.pressTarget) this.pressTarget.pressed = false;
      this.pressTarget = undefined;
    }

    // a held button looks pressed only while the cursor is still on its target
    if (this.pressTarget) {
      this.pressTarget.pressed = this.pressTarget === this.hoveredNode;
    }
  }

  private static applyRightButton(target: UINode | undefined) {
    if (InputManager.isMouseClicked("RIGHT")) this.rightPressTarget = target;

    if (InputManager.isMouseReleased("RIGHT")) {
      if (this.rightPressTarget && this.rightPressTarget === target) {
        target.rightClicked = true;
        this.rightClickedNode = target;
        this.touch(target);
        let walk: UINode | undefined = target;
        while (walk) {
          walk.rightClickedWithin = true;
          this.touch(walk);
          walk = walk.parent;
        }
      }
      if (this.rightPressTarget) this.rightPressTarget.rightPressed = false;
      this.rightPressTarget = undefined;
    }

    if (this.rightPressTarget) {
      this.rightPressTarget.rightPressed =
        this.rightPressTarget === this.hoveredNode;
    }
  }
  private static fireClick(node: UINode) {
    this.clickedNode = node;
    node.clicked = true;
    this.touch(node);

    const now = Time.getTime();
    const isDouble =
      node === this.lastClickNode &&
      now - this.lastClickTime <= DOUBLE_CLICK_MS;

    if (isDouble) {
      node.doubleClicked = true;
      this.lastClickNode = undefined; // a third click must not chain
    } else {
      this.lastClickNode = node;
      this.lastClickTime = now;
    }

    let walk: UINode | undefined = node;
    while (walk) {
      walk.clickedWithin = true;
      if (isDouble) walk.doubleClickedWithin = true;
      this.touch(walk);
      walk = walk.parent;
    }
  }
  private static touch(node: UINode) {
    this.touched.push(node);
  }
  private static applyFocus(target: UINode | undefined) {
    if (!InputManager.isMouseClicked("LEFT")) return;

    const next = this.findFocusable(target);
    if (next === this.focusedNode) return;

    if (this.focusedNode) {
      this.focusedNode.focused = false;
      this.focusedNode.focusLost = true;
      this.touch(this.focusedNode);
    }
    if (next) {
      next.focused = true;
      next.focusGained = true;
      this.touch(next);
    }
    this.focusedNode = next;
    this.applyFocusPath(next);
  }
  private static findFocusable(target: UINode | undefined) {
    let walk = target;
    while (walk) {
      if (walk.focusable) return walk;
      walk = walk.parent;
    }
    return undefined;
  }

  private static applyFocusPath(node: UINode | undefined) {
    const path: UINode[] = [];
    let walk = node;
    while (walk) {
      path.push(walk);
      walk = walk.parent;
    }
    path.reverse();

    let common = 0;
    while (
      common < path.length &&
      common < this.focusPath.length &&
      path[common] === this.focusPath[common]
    ) {
      common++;
    }

    for (let i = common; i < this.focusPath.length; i++) {
      this.focusPath[i].focusedWithin = false;
    }
    for (let i = common; i < path.length; i++) {
      path[i].focusedWithin = true;
    }
    this.focusPath = path;
  }
  private static pointsInto(ref: UINode | undefined, root: UINode) {
    if (!ref) return false;
    if (ref === root) return true;
    return ref.isDescendantOf(root);
  }
  public static releaseNode(node: UINode) {
    this.styleAnimated.delete(node);
    if (this.pointsInto(this.hoveredNode, node)) {
      this.hoveredNode!.hovered = false;
      this.hoveredNode = undefined;
    }

    if (this.pointsInto(this.pressTarget, node)) {
      this.pressTarget!.pressed = false;
      this.pressTarget = undefined;
    }

    if (this.pointsInto(this.rightPressTarget, node)) {
      this.rightPressTarget!.rightPressed = false;
      this.rightPressTarget = undefined;
    }

    if (this.pointsInto(this.lastClickNode, node)) {
      this.lastClickNode = undefined;
    }

    if (this.pointsInto(this.focusedNode, node)) {
      this.focusedNode!.focused = false;
      this.focusedNode!.focusLost = true;
      this.touch(this.focusedNode!);
      this.focusedNode = undefined;
      this.applyFocusPath(undefined);
    }
  }
  private static findScrollable(node: UINode | undefined, axis: "x" | "y") {
    let walk = node;
    while (walk) {
      if (axis === "y" && walk.style.overflowY === "scroll") return walk;
      if (axis === "x" && walk.style.overflowX === "scroll") return walk;
      walk = walk.parent;
    }
    return undefined;
  }
  private static shifted(node: UINode, offset: Position2D): Box {
    return {
      x: node.pixelBox.x + offset.x,
      y: node.pixelBox.y + offset.y,
      w: node.pixelBox.w,
      h: node.pixelBox.h,
    };
  }
  private static applyWheel(axis: "x" | "y", amount: number) {
    if (amount === 0) return;

    const target = this.findScrollable(this.hoveredNode, axis);
    if (!target) return;

    const max = target.maxScroll(axis);
    if (max === 0) return;

    const offset = target.scrollOffset;
    const current = axis === "y" ? offset.y : offset.x;
    const next = AxiomMath.clamp(
      current - amount * SCROLL_FACTOR * this.scale,
      -max,
      0,
    );
    if (next === current) return;

    if (axis === "y") offset.y = next;
    else offset.x = next;
    this.markLayoutDirty();
  }
}
