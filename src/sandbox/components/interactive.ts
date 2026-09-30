import PragmaComponent from "@pragma/component";
import InteractiveElements from "../systems/interactiveEvents";
import type { ColliderBody } from "./physics";

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
    this.scene.getSystem(InteractiveElements).register(this);
  }
  destroy(): void {
    this.scene.findSystem(InteractiveElements)?.unregister(this);
  }
}
