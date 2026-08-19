import "@/css/index.css";
import { assert } from "@utils/utils";
import InputManager from "@engine/inputManager";
import Time from "@engine/time";
import Aurora from "../aurora/core";
import Renderer from "../aurora/renderer/renderer";
import Pragma from "../pragma/pragma";

export default class Engine {
  declare private static canvas: HTMLCanvasElement;
  public static async initialize({
    preload,
    setup,
  }: {
    preload: () => Promise<void>;
    setup: () => void;
  }) {
    await this.setCanvas();
    InputManager.registerEvents();
    await Aurora.init(this.canvas);
    Time.initTimer(performance.now());
    await preload();
    setup();
    requestAnimationFrame((currentTime) => this.loop(currentTime));
  }

  private static loop(currentTime: number) {
    Time.update(currentTime);
    InputManager.updateInputs();
    Renderer.beginBatch();
    Pragma.update();
    Renderer.endBatch();
    requestAnimationFrame((currentTime) => this.loop(currentTime));
  }

  private static async setCanvas() {
    const DEBOUNCE_MS = 100;
    let debounceTimer: number | null = null;
    let pendingSize: Size2D | null = null;
    const canvas = document.getElementById(
      "gameWindow",
    ) as HTMLCanvasElement | null;
    assert(canvas !== null, "There is no canvas element with ID: gameWindow");
    this.canvas = canvas;
    const size = await window.API.WINDOW.getWindowSize();
    canvas.width = size.width;
    canvas.height = size.height;

    window.API.WINDOW.onWindowResize((size) => {
      pendingSize = size;
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        if (!pendingSize) return;
        canvas.width = pendingSize.width;
        canvas.height = pendingSize.height;
        pendingSize = null;
        debounceTimer = null;
      }, DEBOUNCE_MS);
    });
  }
}
