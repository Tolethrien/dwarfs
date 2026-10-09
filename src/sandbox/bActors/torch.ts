import PragmaActor from "@pragma/actor";
import type Coroutine from "@engine/coroutines/coroutine";
import AxiomMath from "@axiom/math";
import { COLOR } from "@axiom/color";
import { assert } from "@axiom/utils";
import { DecosID, getDecoCrop } from "../content/decos";
import { SPRITES } from "../content/sprites";
import Sprite from "../components/sprite";
import PointLight from "../components/pointLight";
import Embers from "../components/embers";
import { RENDER_ORDER } from "../configs";

interface TorchProps {
  // tile centre
  position: Position2D;
  variant: number;
}

const FLAME = {
  seconds: { min: 0.05, max: 0.15 },
  light: { radius: 320, intensity: { min: 0.8, max: 1.2 } },
  embers: { width: 60, height: 120 },
};
// per variant (decos.ts): where the fire is on the sprite, from the tile centre; only an open
// flame throws embers, the lantern's glass keeps them in
const FIRE: { at: Position2D; embers: boolean }[] = [
  { at: { x: 0, y: -26 }, embers: true },
  { at: { x: -3, y: 20 }, embers: false },
];

// the view of a torch deco: exists only while its chunk is shown, keeps nothing worth saving
export default class Torch extends PragmaActor {
  private light: PointLight;

  constructor(props: TorchProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    const crop = getDecoCrop(DecosID.torch, props.variant);
    assert(crop !== undefined, "Torch: the torch deco has no graphics");
    this.addComponent(Sprite, { sprite: SPRITES.deco, crop, zIndex: RENDER_ORDER.decoBackTiles });
    const fire = FIRE[props.variant] ?? FIRE[0];
    this.light = this.addComponent(PointLight, {
      radius: FLAME.light.radius,
      color: COLOR.AMBER,
      intensity: FLAME.light.intensity.max,
      offset: fire.at,
      occluded: true,
    });
    if (fire.embers)
      this.addComponent(Embers, {
        from: fire.at,
        size: { width: FLAME.embers.width, height: FLAME.embers.height },
        zIndex: RENDER_ORDER.decoBack,
      });
  }

  public onStart() {
    super.onStart();
    this.startCoroutine((co) => this.flicker(co));
  }

  // the light changes its strength at random, a few times a second
  private *flicker(co: Coroutine) {
    while (true) {
      this.light.intensity = AxiomMath.randomFloat(FLAME.light.intensity.min, FLAME.light.intensity.max);
      yield co.waitSeconds(AxiomMath.randomFloat(FLAME.seconds.min, FLAME.seconds.max));
    }
  }
}
