import PragmaComponent from "@pragma/component";
import AxiomMath from "@axiom/math";
import { LightsID } from "../content/lights";
import { shine } from "./shine";

export default class Headlight extends PragmaComponent {
  public light = LightsID.helmet;
  private readonly phase = AxiomMath.randomFloat(0, 1000);

  render(): void {
    shine(this.light, this.actor.transform.getPosition(), this.phase);
  }
}
