import Aurora from "@aurora/core";
import AxiomMath from "@axiom/math";
import Easing, { type EasingName } from "@axiom/easing";
import Polygon from "@axiom/polygon";

// a polygon may be concave and have holes, the whole view stays inside it
export type CameraBounds = BoxAABB | Polygon;
// polygon bounds, where the view does not fit (a corridor lower than the view, a sharp corner):
// "center" keeps the full view and shows outside only as much as keeping the target in needs,
// "zoom" first zooms in, up to maxZoom × the game zoom; margin (view units) = the floor around
// the followed target that stays in view, nothing behind a wall counts
export interface BoundsOptions {
  narrow: "center" | "zoom";
  maxZoom: number;
  margin: number;
}
// blend = seconds from the old bounds to the new (game time), 0 = at once; cut = at once and the
// camera snaps there. The camera result is blended, not the shapes, so a change of the options
// alone blends too
export interface BoundsTransition {
  blend: number;
  easing: EasingName;
  cut: boolean;
}

// margin left out = this share of the view height; past maxLayers a transition drops the
// weakest old bounds
export const BOUNDS_DEFAULTS = {
  narrow: "center" as const,
  maxZoom: 2,
  marginOfViewHeight: 1 / 8,
  easing: "easeInOutSine" as EasingName,
  maxLayers: 4,
};

// one bounds with its own follow state, several run side by side during a transition
class BoundsLayer {
  // share among the old bounds of a transition, frozen when a newer one came
  weight = 1;
  readonly goal: Position2D = { x: 0, y: 0 };
  // how well the full view fits at the goal: the smoothed center keeps at least that
  goalFit = 1;
  // world box follow keeps in view (the target and its margin of floor)
  readonly need: BoxAABB = { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  hasNeed = false;
  // follow rides straight through a gap in the allowed area, see confine
  travelling = false;
  readonly center: Position2D = { x: 0, y: 0 };
  private readonly clamped: Position2D = { x: 0, y: 0 };

  constructor(
    readonly bounds: CameraBounds | null,
    readonly settings: BoundsOptions,
  ) {}

  beginFrame() {
    this.hasNeed = false;
    this.goalFit = 1;
  }
  // free, manual and a teleport: the plain clamp; an area the view fits nowhere keeps the point
  // in view with as little outside as it can
  // TODO: free cannot enter a narrow place (it pans from the clamped center), bounds plan step 3
  clamp(point: Position2D, halfWidth: number, halfHeight: number) {
    const bounds = this.bounds;
    if (bounds === null) return;
    if (!(bounds instanceof Polygon)) {
      point.x = BoundsLayer.clampAxis(point.x, bounds.min.x, bounds.max.x, halfWidth);
      point.y = BoundsLayer.clampAxis(point.y, bounds.min.y, bounds.max.y, halfHeight);
      return;
    }
    const erosion = bounds.erode(halfWidth, halfHeight);
    if (!erosion.isEmpty) {
      erosion.clamp(point, point);
      return;
    }
    bounds.placeBox(point, halfWidth, halfHeight, point);
  }
  // the goal keeps the target and its margin of floor in view first, then shows as little
  // outside as it can, then heads where the follow wants (offset, lookahead, aim, deadzone)
  placeGoal(source: Position2D, preferred: Position2D, halfWidth: number, halfHeight: number, zoom: number) {
    const { bounds, goal, need } = this;
    goal.x = preferred.x;
    goal.y = preferred.y;
    if (!(bounds instanceof Polygon)) {
      this.clamp(goal, halfWidth, halfHeight);
      return;
    }
    const margin = this.settings.margin / zoom;
    this.goalFit = Math.min(1, bounds.placeBox(source, halfWidth, halfHeight, goal, margin, preferred));
    if (margin <= 0 || !bounds.boundsWithin(source, margin, margin, need)) {
      need.min.x = need.max.x = source.x;
      need.min.y = need.max.y = source.y;
    }
    this.hasNeed = true;
  }
  // the smoothed center keeps a view at least as good as the goal's (in a corridor the goal sits
  // on its middle line, so the center rides that line too). In a concave corner the straight
  // way to the goal cuts across outside, so the center slides along the wall, but only while that
  // brings it closer to the goal: where the clamp would pull it back every frame it rides
  // straight on until it is inside again. Reads and writes this.center
  confine(centerBefore: Position2D, halfWidth: number, halfHeight: number) {
    const { bounds, center, goal } = this;
    if (!(bounds instanceof Polygon)) {
      this.clamp(center, halfWidth, halfHeight);
      return;
    }
    const level = this.goalFit;
    const erosion = bounds.erode(halfWidth * level, halfHeight * level);
    if (erosion.isEmpty || erosion.contains(center)) {
      this.travelling = false;
      return;
    }
    if (this.travelling) return;
    const clamped = erosion.nearestPoint(center, this.clamped);
    const closer =
      Math.hypot(clamped.x - goal.x, clamped.y - goal.y) <
      Math.hypot(centerBefore.x - goal.x, centerBefore.y - goal.y) - 1e-6;
    if (!closer) {
      this.travelling = true;
      return;
    }
    center.x = clamped.x;
    center.y = clamped.y;
  }
  // enough to hide the outside at the center, never so much that the kept box leaves the view
  zoom(center: Position2D, halfWidth: number, halfHeight: number) {
    const { bounds, settings, need } = this;
    if (!(bounds instanceof Polygon) || settings.narrow !== "zoom") return 1;
    const hides = 1 / Math.max(bounds.fit(center, halfWidth, halfHeight), 1e-6);
    let keeps = Infinity;
    if (this.hasNeed) {
      const reachX = Math.max(Math.abs(need.min.x - center.x), Math.abs(need.max.x - center.x));
      const reachY = Math.max(Math.abs(need.min.y - center.y), Math.abs(need.max.y - center.y));
      if (reachX > 0) keeps = Math.min(keeps, halfWidth / reachX);
      if (reachY > 0) keeps = Math.min(keeps, halfHeight / reachY);
    }
    return AxiomMath.clamp(Math.min(hides, keeps), 1, settings.maxZoom);
  }

  // bounds narrower than the view center it on that axis
  private static clampAxis(value: number, min: number, max: number, half: number) {
    if (max - min <= half * 2) return (min + max) / 2;
    return AxiomMath.clamp(value, min + half, max - half);
  }
}

// the bounds the camera keeps to, and the old ones still blending out: every layer computes its
// own result, the camera takes their weighted sum (the zoom in octaves), so a transition is a
// pure blend of results and a change mid way goes on smoothly from the mix it froze
export class BoundsMix {
  // the last one is the newest; no bounds needs no settings (the view size is not known yet)
  private layers: BoundsLayer[] = [new BoundsLayer(null, { narrow: "center", maxZoom: 1, margin: 0 })];
  private progress = 1;
  private duration = 0;
  private easing: EasingName = BOUNDS_DEFAULTS.easing;
  private readonly preferred: Position2D = { x: 0, y: 0 };

  set(bounds: CameraBounds | null, options: Partial<BoundsOptions & BoundsTransition>) {
    const layer = new BoundsLayer(bounds, BoundsMix.resolve(options));
    const blend = options.cut ? 0 : (options.blend ?? 0);
    if (blend <= 0) {
      this.layers = [layer];
      this.progress = 1;
      return;
    }
    this.freeze();
    this.layers.push(layer);
    this.progress = 0;
    this.duration = blend;
    this.easing = options.easing ?? BOUNDS_DEFAULTS.easing;
  }
  // game time, a pause holds the transition
  update(delta: number) {
    for (const layer of this.layers) layer.beginFrame();
    if (this.progress >= 1) return;
    this.progress = Math.min(1, this.progress + delta / this.duration);
    if (this.progress < 1) return;
    const newest = this.layers[this.layers.length - 1];
    newest.weight = 1;
    this.layers = [newest];
  }
  resetTravel() {
    for (const layer of this.layers) layer.travelling = false;
  }
  // plain data for the debugger, the newest bounds
  get getInfo() {
    const { bounds, settings } = this.layers[this.layers.length - 1];
    const shape =
      bounds === null
        ? "none"
        : bounds instanceof Polygon
          ? `polygon: ${bounds.outer.length} points, ${bounds.holes.length} holes`
          : { min: { ...bounds.min }, max: { ...bounds.max } };
    return {
      shape,
      ...settings,
      layers: this.layers.length,
      transition: this.progress < 1 ? this.progress : "none",
    };
  }

  // one layer (no transition running) goes straight through, no blending closures
  clamp(point: Position2D, halfWidth: number, halfHeight: number) {
    if (this.layers.length === 1) {
      this.layers[0].clamp(point, halfWidth, halfHeight);
      return;
    }
    this.mix(point, (layer) => {
      layer.center.x = point.x;
      layer.center.y = point.y;
      layer.clamp(layer.center, halfWidth, halfHeight);
      return layer.center;
    });
  }
  // goal in: where the follow wants to be; out: the blended goal
  placeGoal(source: Position2D, goal: Position2D, halfWidth: number, halfHeight: number, zoom: number) {
    const preferred = this.preferred;
    preferred.x = goal.x;
    preferred.y = goal.y;
    if (this.layers.length === 1) {
      const layer = this.layers[0];
      layer.placeGoal(source, preferred, halfWidth, halfHeight, zoom);
      goal.x = layer.goal.x;
      goal.y = layer.goal.y;
      return;
    }
    this.mix(goal, (layer) => {
      layer.placeGoal(source, preferred, halfWidth, halfHeight, zoom);
      return layer.goal;
    });
  }
  confine(center: Position2D, centerBefore: Position2D, halfWidth: number, halfHeight: number) {
    if (this.layers.length === 1) {
      const layer = this.layers[0];
      layer.center.x = center.x;
      layer.center.y = center.y;
      layer.confine(centerBefore, halfWidth, halfHeight);
      center.x = layer.center.x;
      center.y = layer.center.y;
      return;
    }
    this.mix(center, (layer) => {
      layer.center.x = center.x;
      layer.center.y = center.y;
      layer.confine(centerBefore, halfWidth, halfHeight);
      return layer.center;
    });
  }
  zoom(center: Position2D, halfWidth: number, halfHeight: number) {
    if (this.layers.length === 1) return this.layers[0].zoom(center, halfWidth, halfHeight);
    let octaves = 0;
    this.forEachWeight((layer, weight) => {
      octaves += Math.log2(layer.zoom(center, halfWidth, halfHeight)) * weight;
    });
    return 2 ** octaves;
  }

  private mix(out: Position2D, result: (layer: BoundsLayer) => Position2D) {
    let x = 0;
    let y = 0;
    this.forEachWeight((layer, weight) => {
      const point = result(layer);
      x += point.x * weight;
      y += point.y * weight;
    });
    out.x = x;
    out.y = y;
  }
  // the newest by the eased progress, the old ones share the rest by their frozen weights
  private forEachWeight(visit: (layer: BoundsLayer, weight: number) => void) {
    const layers = this.layers;
    const newest = layers.length - 1;
    const eased = this.progress >= 1 ? 1 : Easing[this.easing](this.progress);
    for (let index = 0; index < newest; index++) visit(layers[index], layers[index].weight * (1 - eased));
    visit(layers[newest], eased);
  }
  // the current mix becomes the old side of a new transition
  private freeze() {
    const layers = this.layers;
    const newest = layers.length - 1;
    const eased = this.progress >= 1 ? 1 : Easing[this.easing](this.progress);
    for (let index = 0; index < newest; index++) layers[index].weight *= 1 - eased;
    layers[newest].weight = eased;
    const kept = layers.filter((layer) => layer.weight > 1e-4);
    while (kept.length >= BOUNDS_DEFAULTS.maxLayers) {
      let weakest = 0;
      for (let index = 1; index < kept.length; index++)
        if (kept[index].weight < kept[weakest].weight) weakest = index;
      kept.splice(weakest, 1);
    }
    const total = kept.reduce((sum, layer) => sum + layer.weight, 0);
    for (const layer of kept) layer.weight /= total;
    this.layers = kept;
  }
  private static resolve(options: Partial<BoundsOptions>): BoundsOptions {
    return {
      narrow: options.narrow ?? BOUNDS_DEFAULTS.narrow,
      maxZoom: options.maxZoom ?? BOUNDS_DEFAULTS.maxZoom,
      margin: options.margin ?? Aurora.getViewSize.height * BOUNDS_DEFAULTS.marginOfViewHeight,
    };
  }
}
