import PragmaComponent from "@pragma/component";
import AxiomMath from "@axiom/math";
import type { LightsID } from "../content/lights";
import Discovery from "../systems/discovery";
import { shine } from "./shine";

interface LampLightProps {
  light: LightsID;
}

export default class LampLight extends PragmaComponent {
  public readonly light: LightsID;
  private readonly phase = AxiomMath.randomFloat(0, 1000);
  declare private discovery: Discovery;

  constructor(internal: InternalPCProps, props: LampLightProps) {
    super(internal);
    this.light = props.light;
  }

  awake(): void {
    this.discovery = this.scene.getSystem(Discovery);
  }

  start(): void {
    this.discovery.revealLight(this.actor.transform.getPosition(), this.light);
  }

  render(): void {
    shine(this.light, this.actor.transform.getPosition(), this.phase);
  }
}
