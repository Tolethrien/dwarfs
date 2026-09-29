import Mat2 from "@axiom/mat2";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import Vec2 from "@axiom/vec2";
import Time from "@engine/time";
import PragmaComponent from "./component";

export default class Transform extends PragmaComponent {
  private position: Vec2 = Vec2.Zero;
  private previousPosition: Vec2 = Vec2.Zero;
  private z: number = 0;
  private rotation: number = 0; // radian
  private previousRotation: number = 0;
  private scale: Vec2 = Vec2.One;
  private interpolating: boolean = false;
  private parent: Transform | null = null;
  private readonly children: Set<Transform> = new Set();

  private worldMatrixCache: Mat2 | null = null;
  private worldPositionCache: Vec2 | null = null;
  private worldRotationCache: number | null = null;
  private worldScaleCache: Vec2 | null = null;
  private worldZCache: number | null = null;

  fixedUpdate(): void {
    this.previousPosition.copy(this.position);
    this.previousRotation = this.rotation;
    this.interpolating = true;
  }

  /**DO NOT MUTATE THIS */
  public getPosition(): Vec2 {
    return this.position;
  }
  /**DO NOT MUTATE THIS */
  public getScale(): Vec2 {
    return this.scale;
  }
  /**DO NOT MUTATE THIS */
  public getWorldPosition(): Vec2 {
    if (!this.worldPositionCache)
      this.worldPositionCache = this.getWorldMatrix().getPosition();
    return this.worldPositionCache;
  }
  /**DO NOT MUTATE THIS */
  public getWorldScale(): Vec2 {
    if (!this.worldScaleCache)
      this.worldScaleCache = this.getWorldMatrix().getScale();
    return this.worldScaleCache;
  }
  /**Interpolate to render! do not use in phys or anything else */
  public getRenderPosition(): Vec2 {
    if (!this.parent) {
      return Vec2.lerp(this.previousPosition, this.position, Time.getAlpha());
    }
    return this.getRenderMatrix().getPosition();
  }
  /**Interpolate to render! do not use in phys or anything else */
  public getRenderRotation(): number {
    if (!this.parent) {
      return AxiomMath.lerpAngle(
        this.previousRotation,
        this.rotation,
        Time.getAlpha(),
      );
    }
    return this.getRenderMatrix().getRotation();
  }
  private getRenderMatrix(): Mat2 {
    const alpha = Time.getAlpha();
    const localRenderPos = Vec2.lerp(
      this.previousPosition,
      this.position,
      alpha,
    );
    const localRenderRotation = AxiomMath.lerpAngle(
      this.previousRotation,
      this.rotation,
      alpha,
    );
    const local = Mat2.fromTRS(localRenderPos, localRenderRotation, this.scale);
    if (!this.parent) return local;
    return this.parent.getRenderMatrix().multiply(local);
  }
  public setPosition(x: number, y: number) {
    this.position.set(x, y);
    if (!this.interpolating) this.previousPosition.set(x, y);
    this.markDirty();
  }
  public teleport(x: number, y: number) {
    this.position.set(x, y);
    this.snap();
    this.markDirty();
  }
  public snap() {
    this.previousPosition.copy(this.position);
    this.previousRotation = this.rotation;
  }
  public translate(dx: number, dy: number) {
    this.position.add(dx, dy);
    if (!this.interpolating) this.previousPosition.copy(this.position);
    this.markDirty();
  }
  public setZ(z: number) {
    this.z = z;
    this.markDirty();
  }
  public setRotation(radians: number) {
    this.rotation = radians;
    if (!this.interpolating) this.previousRotation = radians;
    this.markDirty();
  }
  public rotateBy(deltaRadians: number) {
    this.rotation += deltaRadians;
    if (!this.interpolating) this.previousRotation = this.rotation;
    this.markDirty();
  }
  public setScale(x: number, y: number) {
    this.scale.set(x, y);
    this.markDirty();
  }

  public setParent(parent: Transform | null) {
    for (let ancestor = parent; ancestor !== null; ancestor = ancestor.parent) {
      assert(
        ancestor !== this,
        `Transform of ${this.actor.constructor.name} can't be parented to itself or its own descendant`,
      );
    }
    const scene = this.actor.scene;
    const parentScene = parent?.actor.scene;
    assert(
      scene === undefined || parentScene === undefined || scene === parentScene,
      `Transform of ${this.actor.constructor.name} (scene ${scene?.getName}) can't get a parent from scene ${parentScene?.getName}`,
    );
    this.parent?.children.delete(this);
    this.parent = parent;
    parent?.children.add(this);
    this.markDirty();
  }
  public getParent() {
    return this.parent;
  }
  public getChildren(): ReadonlySet<Transform> {
    return this.children;
  }

  private markDirty() {
    this.worldMatrixCache = null;
    this.worldPositionCache = null;
    this.worldRotationCache = null;
    this.worldScaleCache = null;
    this.worldZCache = null;
    this.children.forEach((child) => child.markDirty());
  }

  public getWorldMatrix(): Mat2 {
    if (this.worldMatrixCache) return this.worldMatrixCache;
    const local = Mat2.fromTRS(this.position, this.rotation, this.scale);
    this.worldMatrixCache = this.parent
      ? this.parent.getWorldMatrix().clone().multiply(local)
      : local;
    return this.worldMatrixCache;
  }

  public getWorldRotation(): number {
    if (this.worldRotationCache === null)
      this.worldRotationCache = this.getWorldMatrix().getRotation();
    return this.worldRotationCache;
  }

  public getWorldZ(): number {
    if (this.worldZCache === null) {
      this.worldZCache = this.parent
        ? this.parent.getWorldZ() + this.z
        : this.z;
    }
    return this.worldZCache;
  }

  destroy() {
    for (const child of this.children)
      child.actor.scene?.deleteActor(child.actor);
    this.parent?.children.delete(this);
  }
  cascadeActorEnabled(enable: boolean) {
    this.actor.setEnabled(enable);
    for (const child of this.children) child.cascadeActorEnabled(enable);
  }
  cascadeActorVisible(enable: boolean) {
    this.actor.setVisibility(enable);
    for (const child of this.children) child.cascadeActorVisible(enable);
  }
}
