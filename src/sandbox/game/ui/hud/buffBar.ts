import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto, px } from "@navi/units";
import { COLOR } from "@axiom/color";
import type Buffs from "../../systems/dwarfs/buffs";
import { BUFFS, type BuffID } from "../../content/buffs";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { hudSlot } from "../hud";
import { icon } from "../elements/icon";

const BUFF_BAR = {
  size: 46,
  slotSize: 54,
  gap: 6,
  textSize: 13,
  textOutline: 2,
};

export function formatBuffLeft(hours: number) {
  return `${Math.ceil(hours)}h`;
}

export function describeBuff(id: BuffID) {
  const buff = BUFFS[id];
  const effects = buff.effects.map((effect) => effect.describe()).join("\n");
  return `${buff.name}\n${buff.description}\n${effects}`;
}

export default class BuffBarUI {
  private readonly bar: UINode;
  private readonly tiles = new Map<BuffID, UINode>();

  constructor(private readonly buffs: Buffs) {
    this.bar = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        input: "none",
        style: {
          backgroundColor: UI_THEME.colors.transparent,
          layout: "stack",
          direction: "row",
          gap: BUFF_BAR.gap,
        },
      }),
      hudSlot("topRightUnder"),
    );
    this.bar.tags.add("hud:buffs");
  }

  public update() {
    const active = this.buffs.list;
    for (const [id, tile] of this.tiles) {
      if (active.has(id)) continue;
      Navi.remove(tile, this.bar);
      this.tiles.delete(id);
    }
    for (const id of active.keys()) if (!this.tiles.has(id)) this.tiles.set(id, this.addTile(id));
  }

  private addTile(id: BuffID) {
    const slot = UI_SHEET.slot;
    const frame = Navi.append(
      new UINode({
        size: { width: px(BUFF_BAR.slotSize), height: px(BUFF_BAR.slotSize) },
        input: "none",
        style: {
          backgroundColor: COLOR.WHITE,
          backgroundImage: UI_SHEET.image,
          backgroundImageCrop: slot.crop,
          backgroundImageSlice: slot.slice,
          layout: "stack",
          alignMain: "center",
          alignCross: "center",
        },
      }),
      this.bar,
    );
    const tile = icon(frame, BUFFS[id].icon, {
      size: BUFF_BAR.size,
      image: "buffs",
      tooltip: () => describeBuff(id),
    });
    Navi.append(
      new UIText(() => formatBuffLeft(this.buffs.list.get(id) ?? 0), {
        size: { width: auto(), height: auto() },
        input: "none",
        style: {
          anchorX: "center",
          anchorY: "end",
          textColor: UI_THEME.paper.inkCream,
          textSize: BUFF_BAR.textSize,
          textOutline: { width: BUFF_BAR.textOutline, color: UI_THEME.colors.textOutline },
        },
      }),
      tile,
    );
    return frame;
  }
}
