import PragmaActor from "@pragma/actor";
import type Coroutine from "@engine/coroutines/coroutine";
import AxiomMath from "@axiom/math";
import { COLOR } from "@axiom/color";
import Shape from "../components/shape";
import PointLight from "../components/pointLight";
import { RENDER_ORDER } from "../configs";

interface TorchProps {
  position: Position2D;
  size: Size2D;
}

const FLAME = {
  colors: [COLOR.ORANGE, COLOR.DARK_ORANGE, COLOR.AMBER, COLOR.GOLD],
  seconds: { min: 0.05, max: 0.15 },
  light: { radius: 320, intensity: { min: 0.8, max: 1.2 } },
};

// the view of a torch deco: exists only while its chunk is shown, keeps nothing worth saving
export default class Torch extends PragmaActor {
  private shape: Shape;
  private light: PointLight;

  constructor(props: TorchProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    this.shape = this.addComponent(Shape, {
      size: props.size,
      color: FLAME.colors[0],
      zIndex: RENDER_ORDER.decoBackTiles,
    });
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

  // the flame changes its colour and the light its strength at random, a few times a second
  private *flicker(co: Coroutine) {
    while (true) {
      this.shape.color = FLAME.colors[AxiomMath.randomInt(0, FLAME.colors.length - 1)];
      this.light.intensity = AxiomMath.randomFloat(FLAME.light.intensity.min, FLAME.light.intensity.max);
      yield co.waitSeconds(AxiomMath.randomFloat(FLAME.seconds.min, FLAME.seconds.max));
    }
  }
}
