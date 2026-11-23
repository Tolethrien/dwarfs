import PragmaComponent from "@pragma/component";
import { Draw, Light } from "@aurora/urp/draw/draw";
import type { MaterialParams } from "@aurora/urp/draw/drawTypes";
import AxiomMath from "@axiom/math";
import Noise from "@axiom/noise";
import Time from "@engine/time";
import { LIGHT_FALLOFF, LIGHTS, type LightsID } from "../../content/lights";
import LayeredSprite from "./layeredSprite";
import Glow from "../../gpu/glow";
import StructurePlan, { type PlanLook } from "../../gpu/structurePlan";

// fbm rarely leaves ±0.5, stretched to ±1 so amount is the real swing; radius: the share of the
// swing the radius takes, the moving edge shows a slow pulse better than the brightness
export const FLICKER = { stretch: 2, radius: 0.5 };

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

export function shine(kind: LightsID, position: Position2D, phase: number, direction?: number) {
  const light = LIGHTS[kind];
  let swing = 0;
  if (light.flicker) {
    const wander = noise.fractal1D(Time.getTimeInSeconds() * light.flicker.speed + phase);
    swing = light.flicker.amount * AxiomMath.clamp(wander * FLICKER.stretch, -1, 1);
  }
  const intensity = light.intensity * (1 + swing);
  const falloff = light.falloff ?? LIGHT_FALLOFF;
  if (light.cone && direction !== undefined) {
    Light.cone({
      position: position,
      direction: direction,
      length: light.cone.length * (1 + swing * FLICKER.radius),
      spread: light.cone.spread,
      softness: light.cone.softness,
      color: light.color,
      intensity: intensity,
      falloff: falloff,
      occluded: true,
    });
    if (light.radius > 0) {
      Light.point({
        position: position,
        radius: light.radius * (1 + swing * FLICKER.radius),
        color: light.color,
        intensity: intensity * (light.cone.auraIntensity ?? 0.4),
        falloff: falloff,
        occluded: true,
      });
    }
    return;
  }
  Light.point({
    position: position,
    radius: light.radius * (1 + swing * FLICKER.radius),
    color: light.color,
    intensity: intensity,
    falloff: falloff,
    occluded: true,
  });
}

interface LampProps {
  light: LightsID;
  offset?: Position2D;
  bulb?: { radius: number; zIndex: number };
}

export default class Lamp extends PragmaComponent {
  public light: LightsID;
  private readonly offset: Position2D | undefined;
  private readonly bulb: LampProps["bulb"];
  private readonly phase = AxiomMath.randomFloat(0, 1000);
  private readonly origin = { x: 0, y: 0 };

  constructor(internal: InternalPCProps, props: LampProps) {
    super(internal);
    this.light = props.light;
    this.offset = props.offset;
    this.bulb = props.bulb;
  }

  render(): void {
    const pos = this.actor.transform.getRenderPosition();
    const rotation = this.actor.transform.getRenderRotation();
    const sprite = this.getSibling(LayeredSprite);
    const flipped = sprite?.flipX ?? false;

    if (this.offset) {
      const localX = flipped ? -this.offset.x : this.offset.x;
      const localY = this.offset.y;
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      this.origin.x = pos.x + localX * cos - localY * sin;
      this.origin.y = pos.y + localX * sin + localY * cos;
    } else {
      this.origin.x = pos.x;
      this.origin.y = pos.y;
    }

    let direction: number | undefined;
    if (LIGHTS[this.light].cone) {
      direction = flipped ? rotation + Math.PI : rotation;
    }
    shine(this.light, this.origin, this.phase, direction);

    if (this.bulb) {
      Draw.circle({
        position: { x: this.origin.x, y: this.origin.y, z: this.bulb.zIndex },
        radius: this.bulb.radius,
        color: LIGHTS[this.light].color,
        material: Glow.material,
        params: lightGlowParams(this.light),
      });
    }
  }
}
