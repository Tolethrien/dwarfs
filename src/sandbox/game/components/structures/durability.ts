import PragmaComponent from "@pragma/component";
import type { BodyHit } from "./solidBody";

export interface DurabilityProps {
  maxHp: number;
}

export default class Durability extends PragmaComponent {
  public readonly maxHp: number;
  public hp: number;

  constructor(internal: InternalPCProps, props: DurabilityProps) {
    super(internal);
    this.maxHp = props.maxHp;
    this.hp = props.maxHp;
  }

  awake(): void {
    this.onActorEvent<BodyHit>("hit", () => this.damage(1));
  }

  public get hurt() {
    return this.maxHp > 0 ? 1 - this.hp / this.maxHp : 0;
  }

  public damage(amount: number) {
    if (amount <= 0 || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp > 0) return;
    this.emitActorEvent("broken", undefined);
    this.actor.selfDestroy();
  }
}
