import PragmaComponent from "@pragma/component";
import { Light } from "@aurora/urp/draw/draw";
import type { MaterialParams } from "@aurora/urp/draw/drawTypes";
import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import Time from "@engine/time";
import { LIGHT_FALLOFF, LIGHTS, type LightsID } from "../../content/lights";
import Glow from "../../gpu/glow";
import StructurePlan, { type PlanLook } from "../../gpu/structurePlan";

// fbm rarely leaves ±0.5, stretched to ±1 so amount is the real swing; radius: the share of the
// swing the radius takes, the moving edge shows a slow pulse better than the brightness
const FLICKER = { stretch: 2, radius: 0.5 };

const noise = new Noise(7);

// packed once a kind: drawn every frame
const glows = new Map<LightsID, MaterialParams>();

// a lamp's own sprite: unlit and past 1, so it blooms; in build mode the plan's look, like the rest
export function glowMaterial(plan: PlanLook) {
  return StructurePlan.materialOf(plan) ?? Glow.material;
}

function lightGlowParams(kind: LightsID) {
  let params = glows.get(kind);
  if (!params) {
    params = Glow.material.pack({ intensity: LIGHTS[kind].glow ?? 1 });
    glows.set(kind, params);
  }
  return params;
}

export function glowParams(kind: LightsID, plan: PlanLook) {
  return StructurePlan.paramsOf(plan) ?? lightGlowParams(kind);
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

interface LampProps {
  light: LightsID;
}

export default class Lamp extends PragmaComponent {
  public light: LightsID;
  private readonly phase = AxiomMath.randomFloat(0, 1000);

  constructor(internal: InternalPCProps, props: LampProps) {
    super(internal);
    this.light = props.light;
  }

  render(): void {
    shine(this.light, this.actor.transform.getPosition(), this.phase);
  }
}
