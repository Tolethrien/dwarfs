import "@/css/index.css";
import { assert } from "@axiom/utils";
import Time from "./time";
import Pragma from "@pragma/pragma";
import { debug } from "@debug";
import Aurora from "@aurora/core";
import Renderer from "@aurora/renderer/renderer";
import AuroraDebugInfo from "@aurora/debugger/debugInfo";
import Draw from "@aurora/draw";
import FPSOverlay from "./fpsOverlay";
import InputManager from "./inputManager";
import Navi from "../navi/navi";
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
    Navi.initialize();
    Time.initTimer(performance.now());
    await preload();
    setup();
    requestAnimationFrame((currentTime) => this.loop(currentTime));
  }

  private static loop(currentTime: number) {
    Time.update(currentTime);
    AuroraDebugInfo.startCount(currentTime);
    InputManager.updateInputs();
    Navi.updateSystem();

    Renderer.beginBatch();

    Pragma.update();
    Navi.drawSystem();

    Renderer.endBatch();
    AuroraDebugInfo.endCount();
    debug.aurora.reportGPUData(AuroraDebugInfo.getAllData);
    Time.endFrame();
    FPSOverlay.update();
    debug.performance.endFrame(Time.getFrameTime());

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
        Navi.resize();
        pendingSize = null;
        debounceTimer = null;
      }, DEBOUNCE_MS);
    });
  }
}
