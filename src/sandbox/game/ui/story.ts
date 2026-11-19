import { button } from "./elements/button";
import { paragraph } from "./elements/paragraph";
import { UIWindow } from "./elements/window";

const STORY_UI = {
  popup: { width: 460, close: "Got it" },
};

export interface StoryPopup {
  title: string;
  lines: string[];
}

export default class StoryUI {
  private window: UIWindow | undefined;
  // one over another window is run by that window's update
  private owned = false;

  public update() {
    if (!this.owned) this.window?.update();
  }

  // it closes only by its button; over a window, it holds that window's input off and keeps it open
  public popup(popup: StoryPopup, over?: UIWindow) {
    return new Promise<void>((resolve) => {
      const window = new UIWindow({
        kind: "modal",
        width: STORY_UI.popup.width,
        title: popup.title,
        required: true,
        owner: over,
        onClose: () => {
          this.window = undefined;
          resolve();
        },
      });
      this.window = window;
      this.owned = over !== undefined;
      const content = window.open();
      for (const line of popup.lines) paragraph(content, line);
      button(content, STORY_UI.popup.close, () => window.close(), { big: true });
    });
  }

  public destroy() {
    this.window?.close();
  }
}
