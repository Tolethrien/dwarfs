import PragmaActor from "@pragma/actor";
import LayeredSprite from "../components/common/layeredSprite";
import { RENDER_SHEET, SORT_ORDER } from "../content/render";
import { DWARF_LOOK, getRandomDwarfLook } from "../content/dwarfs";

export default class IntroDwarf extends PragmaActor {
  constructor(position: Position2D) {
    super();
    this.transform.teleport(position.x, position.y);
    this.addComponent(LayeredSprite, {
      zIndex: SORT_ORDER.dwarfs,
      sprite: RENDER_SHEET.dwarfs,
      size: { width: DWARF_LOOK.cell, height: DWARF_LOOK.cell },
      layers: getRandomDwarfLook(),
    });
  }
}
