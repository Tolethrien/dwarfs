import PragmaComponent from "@pragma/component";
import InteractiveElements from "../systems/game/interactiveElements";
import { bodyContains, type ColliderBody } from "./physics";

interface InteractiveProps {
  body: ColliderBody;
}

export interface ClickedEvent {
  point: Position2D;
}

// clickable area of the actor; a click sends it the actor event "clicked"
export default class Interactive extends PragmaComponent {
  public body: ColliderBody;

  constructor(internal: InternalPCProps, props: InteractiveProps) {
    super(internal);
    this.body = props.body;
  }

  start(): void {
    this.scene.getSystem(InteractiveElements).register(this);
  }

  destroy(): void {
    this.scene.findSystem(InteractiveElements)?.unregister(this);
  }

  public contains(point: Position2D) {
    return bodyContains(this.body, this.actor.transform, point);
  }
}
