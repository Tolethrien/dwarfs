import Navi from "@navi/navi";
import UINode from "@navi/node";
import { Tweens } from "@navi/tween";
import { ph, pw } from "@navi/units";
import { COLOR } from "@axiom/color";

// black over the whole screen, to cut in a cutscene: it dims in and brightens out
export class UICurtain {
  private readonly node: UINode;

  constructor(dark: boolean) {
    this.node = Navi.append(
      new UINode({
        size: { width: pw(100), height: ph(100) },
        input: "ignore",
        style: { backgroundColor: COLOR.BLACK, zIndex: 1 },
      }),
    );
    this.node.setActive(dark);
  }

  public brighten(ms: number) {
    return new Promise<void>((resolve) => {
      this.node.play(
        Tweens.fadeOut(ms, undefined, () => {
          this.node.setActive(false);
          resolve();
        }),
      );
    });
  }

  public darken(ms: number) {
    this.node.setActive(true);
    return new Promise<void>((resolve) => this.node.play(Tweens.fadeIn(ms, undefined, resolve)));
  }

  public destroy() {
    Navi.remove(this.node, Navi.root);
  }
}
