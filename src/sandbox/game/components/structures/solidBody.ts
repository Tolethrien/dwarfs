import PragmaComponent from "@pragma/component";
import type Ball from "../dwarfs/ball";
import BallPhysics from "../../systems/world/ballPhysics";
import type { Hit } from "../../systems/world/terrain";

export interface BodyHit {
  readonly ball: Ball;
  readonly hit: Hit;
}

export interface SolidBodyProps {
  rect: Rect;
  passThrough?: boolean;
}

export default class SolidBody extends PragmaComponent {
  public readonly rect: Rect;
  private readonly passThrough: boolean;
  private physics: BallPhysics | undefined;
  private registered = false;

  constructor(internal: InternalPCProps, props: SolidBodyProps) {
    super(internal);
    this.rect = { ...props.rect };
    this.passThrough = props.passThrough ?? false;
  }

  awake(): void {
    this.physics = this.scene.getSystem(BallPhysics);
    this.onActorEvent("broken", () => this.unregister());
    this.registered = true;
    this.physics.registerBody({
      id: this.actor.ID,
      rect: this.rect,
      onHit: (ball, hit) => {
        this.emitActorEvent<BodyHit>("hit", { ball: ball, hit: hit });
        return this.passThrough;
      },
    });
  }

  destroy(): void {
    this.unregister();
  }

  private unregister() {
    if (!this.registered) return;
    this.registered = false;
    this.physics?.unregisterBody(this.actor.ID);
  }
}
