import PragmaActor from "@pragma/actor";
import type Coroutine from "@engine/coroutines/coroutine";
import AxiomMath from "@axiom/math";
import { COLOR } from "@axiom/color";
import { assert } from "@axiom/utils";
import { DecosID, getDecoCrop } from "../content/decos";
import { SPRITES } from "../content/sprites";
import Sprite from "../components/sprite";
import PointLight from "../components/pointLight";
import { RENDER_ORDER } from "../configs";

interface TorchProps {
  // tile centre
  position: Position2D;
  variant: number;
}

const FLAME = {
  seconds: { min: 0.05, max: 0.15 },
  light: { radius: 320, intensity: { min: 0.8, max: 1.2 } },
};

// the view of a torch deco: exists only while its chunk is shown, keeps nothing worth saving
export default class Torch extends PragmaActor {
  private light: PointLight;

  constructor(props: TorchProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    const crop = getDecoCrop(DecosID.torch, props.variant);
    assert(crop !== undefined, "Torch: the torch deco has no graphics");
    this.addComponent(Sprite, { sprite: SPRITES.deco, crop, zIndex: RENDER_ORDER.decoBackTiles });
    this.light = this.addComponent(PointLight, {
      radius: FLAME.light.radius,
      color: COLOR.AMBER,
      intensity: FLAME.light.intensity.max,
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
