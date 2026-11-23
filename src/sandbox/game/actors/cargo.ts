import PragmaActor from "@pragma/actor";
import PragmaComponent from "@pragma/component";
import { Draw } from "@aurora/urp/draw/draw";
import AxiomMath from "@axiom/math";
import Travel from "../components/common/travel";
import Storage from "../components/common/storage";
import Lamp from "../components/common/lamp";
import { DECORATIONS, DecosID } from "../content/decorations";
import { LightsID } from "../content/lights";
import { DWARF_LOOK } from "../content/dwarfs";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";

export const CARGO = {
  size: DWARF_LOOK.cell,
  looks: [DECORATIONS[DecosID.barrel].crop, DECORATIONS[DecosID.crate].crop],
};

export default class Cargo extends PragmaActor {
  constructor() {
    super();
    this.addComponent(Travel);
    this.addComponent(Storage);
    this.addComponent(CargoLook);
    this.addComponent(Lamp, { light: LightsID.cargo });
  }
}

class CargoLook extends PragmaComponent {
  private readonly look = CARGO.looks[AxiomMath.randomArrayIndex(CARGO.looks)];

  render(): void {
    const center = this.actor.transform.getRenderPosition();
    Draw.sprite({
      position: { x: center.x - CARGO.size / 2, y: center.y - CARGO.size / 2, z: SORT_ORDER.dwarfs },
      size: { width: CARGO.size, height: CARGO.size },
      texture: RENDER_SHEET.items,
      crop: this.look,
    });
  }
}
