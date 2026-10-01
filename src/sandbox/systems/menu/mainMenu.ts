import PragmaSystem from "@pragma/system";
import { isCancelled } from "@axiom/worker";
import { debug } from "@debug";
import MenuPanel from "../../ui/menuPanel";
import MenuScene from "../../scenes/menuScene";
import SaveGame from "../../world/saveGame";

export default class MainMenu extends PragmaSystem {
  private panel: MenuPanel | null = null;
  // a click already started a game, the menu is on its way out
  private leaving = false;
  private closed = false;

  constructor(internal: InternalPSProps) {
    super(internal);
  }

  awake(): void {
    void this.showMain();
  }

  update(): void {
    this.panel?.update();
  }

  destroy(): void {
    this.closed = true;
    this.panel?.destroy();
  }

  private show(build: (panel: MenuPanel) => void) {
    // the save list is async, the menu may be gone by the time it comes
    if (this.closed) return;
    this.panel?.destroy();
    this.panel = new MenuPanel({ blur: 0 });
    build(this.panel);
  }

  private async showMain() {
    const games = await window.API.SAVES.list();
    this.show((panel) => {
      panel.title("Krasnokopalnia");
      if (games.length > 0)
        panel.button("Kontynuuj", () => this.enter(null, () => SaveGame.load()));
      panel.button("Nowa gra", () =>
        this.enter("Generowanie mapy", (signal) => SaveGame.newGame({ signal })),
      );      if (games.length > 0) panel.button("Wczytaj", () => this.showGames(games));
      panel.button("Wyjdź", () => window.close());
    });
  }

  private showGames(games: SaveGameInfo[]) {
    this.show((panel) => {
      panel.title("Wczytaj");
      for (const game of games)
        panel.button(`${game.gameId}   ${formatTime(game.saves[0].time)}`, () =>
          this.showSaves(game),
        );
      panel.button("Wstecz", () => void this.showMain());
    });
  }

  private showSaves(game: SaveGameInfo) {
    this.show((panel) => {
      panel.title(game.gameId);
      for (const save of game.saves)
        panel.button(saveLabel(save), () =>
          this.enter(null, () => SaveGame.load(game.gameId, save.file)),
        );
      panel.button("Usuń grę", async () => {
        await window.API.SAVES.delete(game.gameId);
        void this.showMain();
      });
      panel.button("Wstecz", async () => this.showGames(await window.API.SAVES.list()));
    });
  }

  // after the frame: the menu scene cannot be removed while Pragma is updating it.
  // loading: a screen with a way back while it runs (generation takes seconds on a big map)
  private enter(loading: string | null, start: (signal: AbortSignal) => Promise<unknown>) {
    if (this.leaving) return;
    this.leaving = true;
    const abort = new AbortController();
    if (loading !== null) this.showLoading(loading, abort);
    queueMicrotask(async () => {
      try {
        await start(abort.signal);
        MenuScene.close();
      } catch (error) {
        this.leaving = false;
        if (isCancelled(error)) {
          void this.showMain();
          return;
        }
        debug.log.error("menu: the game did not start", error);
        this.showError(error);
      }
    });
  }

  private showLoading(text: string, abort: AbortController) {
    this.show((panel) => {
      panel.title(text);
      panel.note(() => ".".repeat(1 + (Math.floor(performance.now() / 400) % 3)));
      panel.button("Wstecz", () => abort.abort());
    });
  }

  private showError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    this.show((panel) => {
      panel.title("Nie udało się");
      panel.note(message);
      panel.button("Wróć", () => void this.showMain());
    });
  }
}

function saveLabel(save: SavePoint) {
  const kind = save.kind === "auto" ? "autozapis" : "zapis";
  const name = save.name ? `   ${save.name}` : "";
  return `${kind}   ${formatTime(save.time)}${name}`;
}

function formatTime(time: string) {
  return Temporal.PlainDateTime.from(time).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
