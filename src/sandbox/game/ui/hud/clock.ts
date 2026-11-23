import Navi from "@navi/navi";
import UINode from "@navi/node";
import { auto } from "@navi/units";
import { COLOR } from "@axiom/color";
import Time from "@engine/time";
import type Calendar from "../../systems/core/calendar";
import { UI_SHEET, UI_THEME } from "../../content/ui";
import { hudSlot } from "../hud";
import { text } from "../elements/text";
import { row } from "../elements/row";
import { button, runClicked } from "../elements/button";

const CLOCK_UI = {
  speeds: [1, 2, 5, 25],
  textSize: 19,
  gap: 8,
  speedGap: 5,
  padding: { top: 10, right: 15, bottom: 10, left: 19 },
};

export default class ClockHud {
  private readonly panel: UINode;

  constructor(calendar: Calendar) {
    const bar = UI_SHEET.hudBarLongA;
    this.panel = Navi.append(
      new UINode({
        size: { width: auto(), height: auto() },
        style: {
          backgroundColor: COLOR.WHITE,
          backgroundImage: UI_SHEET.image,
          backgroundImageCrop: bar.crop,
          backgroundImageSlice: bar.slice,
          padding: CLOCK_UI.padding,
          layout: "stack",
          direction: "row",
          alignCross: "center",
          gap: CLOCK_UI.gap,
        },
      }),
      hudSlot("topCenter"),
    );
    this.panel.tags.add("hud:clock");
    text(this.panel, () => calendar.dateText, {
      color: UI_THEME.paper.inkCream,
      size: CLOCK_UI.textSize,
      font: UI_THEME.font.display,
    });
    const speeds = row(this.panel, { fit: true, gap: CLOCK_UI.speedGap });
    button(speeds, "II", () => Time.setPaused(!Time.getPaused()), {
      sprite: "dark",
      compact: true,
      selected: () => Time.getPaused(),
    });
    for (const option of CLOCK_UI.speeds)
      button(speeds, `x${option}`, () => this.select(option), {
        sprite: "dark",
        compact: true,
        selected: () => !Time.getPaused() && option === Time.getTimeSpeed(),
      });
    this.select(1);
  }

  public update() {
    runClicked(this.panel);
  }

  private select(speed: number) {
    Time.setPaused(false);
    Time.setTimeSpeed(speed);
  }
}
