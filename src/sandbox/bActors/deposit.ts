import PragmaActor from "@/core/pragma/actor";
import Physics from "../components/physics";
import Stats from "../components/stats";
import Sprite from "../components/sprite";
import { BLOCK_NAMES, BLOCK_TYPES } from "@/data";
interface DepositProps {
  position: Position2D;
  type: number;
  currentHP?: number;
}

export default class Deposit extends PragmaActor {
  constructor(props: DepositProps) {
    super();
    this.transform.setPosition(props.position.x, props.position.y);
    this.addComponent(Physics, {
      type: "static",
      body: { type: "rect", h: 96, w: 96 },
    });
    //TODO: tutaj dodac genralnie caly obiekt z danymi o blokach! i z nich wyciagac max hp itp
    this.addComponent(Stats, {
      kind: "deposit",
      currentHP: props.currentHP ?? 5,
      maxHP: 5,
      strength: BLOCK_TYPES[BLOCK_NAMES[props.type]].str,
    });
    this.addComponent(Sprite, {
      crop: BLOCK_TYPES[BLOCK_NAMES[props.type]],
      sprite: "stones",
    });
  }
}
