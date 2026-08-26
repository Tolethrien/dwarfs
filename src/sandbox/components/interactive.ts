import PragmaComponent from "@/core/pragma/component";
import { InteractiveActor } from "../systems/interactiveEvents";
import { ColliderBody } from "./physics";

interface InteractiveProps {
  bodyType: ColliderBody;
}

export default class Interactive extends PragmaComponent {
  public bodyType: ColliderBody;

  constructor(internal: InternalPCProps, props: InteractiveProps) {
    super(internal);
    this.bodyType = props.bodyType;
  }
  start(): void {
    this.emitSceneEvent<InteractiveActor>("interactiveRegister", {
      component: this,
    });
  }
  destroy(): void {
    this.emitSceneEvent<InteractiveActor>("interactiveUnregister", {
      component: this,
    });
  }
}
