import PragmaSystem from "@pragma/system";
import AxiomMath from "@axiom/math";
import { UIWindow } from "../../game/ui/elements/window";
import { column } from "../../game/ui/elements/column";
import { button } from "../../game/ui/elements/button";
import { text } from "../../game/ui/elements/text";

const MAIN_MENU = {
  width: 360,
  seed: { min: 1, max: 2_147_483_647 },
  // the loading text gets drawn and shown before the generation freezes the frame
  framesBeforeStart: 2,
};

export default class MainMenu extends PragmaSystem {
  private readonly window = new UIWindow({ kind: "modal", width: MAIN_MENU.width, title: "Krasnokopalnia", required: true });
  private leaving = false;

  constructor(
    internal: InternalPSProps,
    private readonly newGame: (seed: number) => void,
  ) {
    super(internal);
  }

  awake(): void {
    const list = column(this.window.open());
    button(list, "New game", () => this.startNewGame());
    button(list, "Quit", () => window.close());
  }

  update(): void {
    this.window.update();
  }

  destroy(): void {
    this.window.close();
  }

  private startNewGame() {
    if (this.leaving) return;
    this.leaving = true;
    this.window.clear();
    const content = this.window.open();
    text(content, "Generating the map…");
    const seed = AxiomMath.randomInt(MAIN_MENU.seed.min, MAIN_MENU.seed.max);
    const newGame = this.newGame;
    this.startCoroutine(function* (co) {
      yield co.waitFrames(MAIN_MENU.framesBeforeStart);
      // the scene can't be removed while it is being updated: the start waits for the frame's end
      queueMicrotask(() => newGame(seed));
    });
  }
}
