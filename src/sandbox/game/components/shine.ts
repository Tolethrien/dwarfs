import { Light } from "@aurora/urp/draw/draw";
import { EMISSIVE_MATERIAL } from "@aurora/urp/draw/materials";
import type { MaterialParams } from "@aurora/urp/draw/drawTypes";
import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import Time from "@engine/time";
import { LIGHT_FALLOFF, LIGHTS, type LightsID } from "../content/lights";
import StructurePlan, { type PlanLook } from "../gpu/structurePlan";

// fbm rarely leaves ±0.5, stretched to ±1 so amount is the real swing; radius: the share of the
// swing the radius takes, the moving edge shows a slow pulse better than the brightness
const FLICKER = { stretch: 2, radius: 0.5 };

const noise = new Noise(7);

// packed once a kind: drawn every frame
const glows = new Map<LightsID, MaterialParams>();

// a lamp's own sprite: unlit and past 1, so it blooms; in build mode the plan's look, like the rest
export function glowMaterial(plan: PlanLook) {
  return StructurePlan.materialOf(plan) ?? EMISSIVE_MATERIAL;
}

export function glowParams(kind: LightsID, plan: PlanLook) {
  const planParams = StructurePlan.paramsOf(plan);
  if (planParams) return planParams;
  let params = glows.get(kind);
  if (!params) {
    params = EMISSIVE_MATERIAL.pack({ intensity: LIGHTS[kind].glow ?? 1 });
    glows.set(kind, params);
  }
  return params;
}

export function shine(kind: LightsID, position: Position2D, phase: number) {
  const light = LIGHTS[kind];
  let swing = 0;
  if (light.flicker) {
    const wander = noise.fractal1D(Time.getTimeInSeconds() * light.flicker.speed + phase);
    swing = light.flicker.amount * AxiomMath.clamp(wander * FLICKER.stretch, -1, 1);
  }
  Light.point({
    position: position,
    radius: light.radius * (1 + swing * FLICKER.radius),
    color: light.color,
    intensity: light.intensity * (1 + swing),
    falloff: light.falloff ?? LIGHT_FALLOFF,
    occluded: true,
  });
}
