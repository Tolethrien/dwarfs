import Navi from "@navi/navi";
import UINode from "@navi/node";
import UIText from "@navi/elements/text";
import { auto } from "@navi/units";
import type Buffs from "../../systems/dwarfs/buffs";
import { BUFFS, type BuffID } from "../../content/buffs";
import { UI_THEME } from "../../content/ui";
import { hudSlot } from "../hud";
import { icon } from "../elements/icon";

const BUFF_BAR = {
  size: 48,
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
    const tile = icon(this.bar, BUFFS[id].icon, {
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
          textColor: UI_THEME.colors.text,
          textSize: BUFF_BAR.textSize,
          textOutline: { width: BUFF_BAR.textOutline, color: UI_THEME.colors.textOutline },
        },
      }),
      tile,
    );
    return tile;
  }
}
