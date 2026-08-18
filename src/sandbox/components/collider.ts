import PragmaComponent, { InternalPCProps } from "@/core/pragma/component";
import Transform from "./transform";
type ColliderShape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; w: number; h: number };

interface RigidProps {
  shape: ColliderShape;
  isTrigger?: boolean;
}

export default class Rigid extends PragmaComponent {
  static debugDraw = false;
  public shape: ColliderShape;
  public isTrigger: boolean;
  declare private transform: Transform;

  constructor(internal: InternalPCProps, props: RigidProps) {
    super(internal);
    this.shape = props.shape;
    this.isTrigger = props.isTrigger ?? false;
  }

  start(): void {
    this.transform = this.actor.transform;
    this.emitSceneEvent("rigidRegister", { rigid: this });
  }

  awake(): void {}

  destroy(): void {
    this.emitSceneEvent("rigidUnregister", { rigid: this });
  }
}
