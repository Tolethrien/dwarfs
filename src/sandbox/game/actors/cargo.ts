import PragmaActor from "@pragma/actor";
import PragmaComponent from "@pragma/component";
import { Draw } from "@aurora/urp/draw/draw";
import AxiomMath from "@axiom/math";
import Travel from "../components/travel";
import Storage from "../components/storage";
import Headlight from "../components/headlight";
import { LightsID } from "../content/lights";
import { DWARF_LOOK } from "../content/dwarfs";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";

// looks: cells of the items sheet (a 96 px grid), a cargo takes one at random
const CARGO = {
  size: DWARF_LOOK.cell,
  looks: [
    { x: 0, y: 0, width: 96, height: 96 },
    { x: 96, y: 0, width: 96, height: 96 },
  ] as Crop[],
};

export default class Cargo extends PragmaActor {
  constructor() {
    super();
    this.addComponent(Travel);
    this.addComponent(Storage);
    this.addComponent(CargoLook);
    this.addComponent(Headlight).light = LightsID.cargo;
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
