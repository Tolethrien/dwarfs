import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import type Coroutine from "@engine/coroutines/coroutine";
import { STORY_EVENTS, StoryEventID, type StoryTrigger } from "../content/storyEvents";
import type { ResourceChange } from "./resources";
import StoryUI, { type StoryPopup } from "../ui/story";
import { closeAllWindows, isAnyWindowOpen } from "../ui/elements/window";
import { UICurtain } from "../ui/elements/curtain";
import { showHud } from "../ui/hud";
import GameEvents from "./gameEvents";
import GameMode from "./gameMode";
import Intro from "./intro";
import Buildings from "./buildings";
import Calendar, { type Alarm } from "./calendar";
import Welfare from "./welfare";
import { BuildingsID } from "../content/structures";
import Tavern from "../components/tavern";
import type { TavernTab } from "../ui/buildings/tavern";
import type { UIWindow } from "../ui/elements/window";
import { assert } from "@axiom/utils";
import { gameCommands } from "../debugCommands";

// blackout: seconds into the black, in it before and after the change, and out of it
const STORY = {
  blackout: { close: 1.5, dark: 1, open: 2 },
};

const STORY_EVENT_IDS = Object.values(StoryEventID).filter((id) => typeof id === "number") as StoryEventID[];

// each event fires once a game, its script runs on its own, so one waiting for the player holds no
// other; only what takes the screen (a popup, a blackout) goes one at a time, after the intro, while
// the player is just playing with no window open; in real time, so they go on while the game stands
// still
export default class StoryEvents extends PragmaSystem {
  private readonly ui = new StoryUI();
  private readonly curtain = new UICurtain(false);
  private readonly fired = new Set<StoryEventID>();
  private readonly pending = new Map<StoryEventID, Alarm>();
  // a popup or a blackout has the screen
  private busy = false;
  declare private gameMode: GameMode;
  declare private intro: Intro;
  declare private buildings: Buildings;
  declare private calendar: Calendar;
  declare private welfare: Welfare;

  awake(): void {
    this.gameMode = this.scene.getSystem(GameMode);
    this.intro = this.scene.getSystem(Intro);
    this.buildings = this.scene.getSystem(Buildings);
    this.calendar = this.scene.getSystem(Calendar);
    this.welfare = this.scene.getSystem(Welfare);
    const events = this.scene.getSystem(GameEvents);
    events.resources.changed.connect((change) => this.onResource(change));
    events.tavern.arrived.connect(() => this.fire((when) => when.kind === "applicationsArrived"));
    events.headquarters.upgraded.connect((level) => this.fire((when) => when.kind === "headquartersLevel" && level >= when.level));
    const story = this;
    gameCommands("story", {
      get fired() {
        return [...story.fired].map((id) => StoryEventID[id]);
      },
      get pending() {
        return [...story.pending].map(([id, alarm]) => `${StoryEventID[id]} in ${(alarm.at ?? 0) - story.calendar.time} h`);
      },
      play: (id: StoryEventID) => {
        this.fired.add(id);
        this.play(id);
      },
    });
  }

  update(): void {
    this.ui.update();
  }

  destroy(): void {
    this.ui.destroy();
    this.curtain.destroy();
  }

  // over a window, it waits for that window open instead of for none
  public *popup(co: Coroutine, popup: StoryPopup, over?: UIWindow) {
    yield co.waitUntil(() => this.canShow(over));
    const resume = this.hold();
    yield co.waitPromise(this.ui.popup(popup, over));
    resume();
  }

  // every window shuts and the HUD hides, the screen goes black and change happens in the dark
  public *blackout(co: Coroutine, change: () => void) {
    yield co.waitUntil(() => this.canShow());
    const resume = this.hold();
    closeAllWindows();
    showHud(false);
    const blackout = STORY.blackout;
    yield co.waitPromise(this.curtain.darken(blackout.close * 1000));
    yield co.waitSeconds(blackout.dark / 2);
    change();
    yield co.waitSeconds(blackout.dark / 2);
    yield co.waitPromise(this.curtain.brighten(blackout.open * 1000));
    showHud(true);
    resume();
  }

  public buildMarket() {
    this.buildings.buildMarket();
  }

  public startMorale() {
    this.welfare.begin();
  }

  // the game stops and takes no input meanwhile: no camera, and no Tab, which would close every
  // window; a game the player paused stays paused
  private hold() {
    const paused = Time.getPaused();
    Time.setPaused(true);
    this.gameMode.set("cutscene");
    this.busy = true;
    return () => {
      this.busy = false;
      this.gameMode.set("game");
      Time.setPaused(paused);
    };
  }

  public tavernShows(tab: TavernTab) {
    return this.tavern()?.shows(tab) ?? false;
  }

  public get tavernWindow() {
    const tavern = this.tavern();
    assert(tavern !== undefined, "No tavern to show a popup over");
    return tavern.uiWindow;
  }

  private tavern() {
    const actor = this.buildings.actorOf(BuildingsID.tavern);
    return actor?.getComponent(Tavern);
  }

  private canShow(over?: UIWindow) {
    if (this.busy || !this.intro.isDone || !this.gameMode.is("game")) return false;
    return over === undefined ? !isAnyWindowOpen() : over.isOpen;
  }

  private play(id: StoryEventID) {
    this.startCoroutine((co) => STORY_EVENTS[id].play(co, this), {
      time: "real",
    });
  }

  private onResource(change: ResourceChange) {
    this.fire((when) => when.kind === "resource" && when.id === change.id && change.amount >= when.amount);
  }

  private fire(met: (when: StoryTrigger) => boolean) {
    for (const id of STORY_EVENT_IDS) {
      if (this.fired.has(id) || !met(STORY_EVENTS[id].when)) continue;
      this.fired.add(id);
      const after = STORY_EVENTS[id].after;
      if (after === undefined) this.play(id);
      else
        this.pending.set(
          id,
          this.calendar.alarm({ after: after }, () => {
            this.pending.delete(id);
            this.play(id);
          }),
        );
    }
  }
}
