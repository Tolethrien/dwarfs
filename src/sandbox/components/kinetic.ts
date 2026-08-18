import Vec2 from "@/core/axiom/vec2";
import PragmaComponent, { InternalPCProps } from "@/core/pragma/component";

interface KineticProps {}

export default class Kinetic extends PragmaComponent {
  constructor(internal: InternalPCProps, props: KineticProps) {
    super(internal);
  }

  start(): void {
    this.emitSceneEvent("kineticRegister", { kinetic: this });
  }

  awake(): void {}

  destroy(): void {
    this.emitSceneEvent("kineticUnregister", { kinetic: this });
  }
  step() {}
}
