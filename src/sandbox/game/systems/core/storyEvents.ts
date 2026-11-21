import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import { Camera } from "@engine/camera/camera";
import type Coroutine from "@engine/coroutines/coroutine";
import { assert } from "@axiom/utils";
import { STORY_EVENTS, StoryEventID } from "../../content/events/storyEvents";
import type { ActionName } from "../../content/actions";
import { BuildCategoryID } from "../../content/build";
import { BuildingsID } from "../../content/structures";
import type Shaft from "../../actors/shaft";
import Tavern from "../../components/buildings/tavern";
import StoryUI, { type StoryPopup } from "../../ui/story";
import { closeAllWindows, type UIWindow } from "../../ui/elements/window";
import type { TavernTab } from "../../ui/buildings/tavern";
import { showHud } from "../../ui/hud";
import Conditions from "./conditions";
import GameMode, { VIEW } from "./gameMode";
import Buildings from "../mine/buildings";
import BuildMode from "../mine/buildMode";
import Calendar, { type Alarm } from "./calendar";
import PlayerStats from "./playerStats";
import Roster from "../dwarfs/roster";

// blackout: seconds into the black, in it before and after the change, and out of it; glide: the
// camera's flight to a spot
const STORY = {
  blackout: { close: 1.5, dark: 1, open: 2 },
  glide: { seconds: 1.2 },
  buildHold: [...VIEW, "toggleBuild", "cancelBuild", "place", "rotateBuild"] as ActionName[],
};

const STORY_EVENT_IDS = Object.values(StoryEventID).filter((id) => typeof id === "number") as StoryEventID[];

export interface StoryHold {
  pause?: boolean;
  stopClock?: boolean;
  hideHud?: boolean;
  keepMode?: boolean;
}

// each event fires once a game, its script runs on its own, so one waiting for the player holds no
// other; only what takes the screen (the intro, a popup, a blackout) goes one at a time, while the
// player is just playing with no window open
export default class StoryEvents extends PragmaSystem {
  public readonly ui = new StoryUI();
  private readonly fired = new Set<StoryEventID>();
  private readonly pending = new Map<StoryEventID, Alarm>();
  private readonly stoppers = new Map<StoryEventID, () => void>();
  private busy = false;
  declare private buildings: Buildings;
  declare private buildMode: BuildMode;
  declare private gameMode: GameMode;
  declare private playerStats: PlayerStats;
  declare private roster: Roster;
  declare private calendar: Calendar;
  declare private conditions: Conditions;

  constructor(
    internal: InternalPSProps,
    public readonly shaft: Shaft,
  ) {
    super(internal);
  }

  awake(): void {
    this.buildings = this.scene.getSystem(Buildings);
    this.buildMode = this.scene.getSystem(BuildMode);
    this.gameMode = this.scene.getSystem(GameMode);
    this.playerStats = this.scene.getSystem(PlayerStats);
    this.roster = this.scene.getSystem(Roster);
    this.calendar = this.scene.getSystem(Calendar);
    this.conditions = this.scene.getSystem(Conditions);
  }

  start(): void {
    for (const id of STORY_EVENT_IDS) {
      const when = STORY_EVENTS[id].when;
      if (when === undefined || this.fired.has(id)) continue;
      const stop = this.conditions.whenMet(when, () => this.trigger(id));
      if (!this.fired.has(id)) this.stoppers.set(id, stop);
    }
    for (const id of STORY_EVENT_IDS) {
      if (STORY_EVENTS[id].when === undefined) this.trigger(id);
    }
  }

  update(): void {
    this.ui.update();
  }

  destroy(): void {
    for (const stop of this.stoppers.values()) stop();
    this.stoppers.clear();
    for (const alarm of this.pending.values()) alarm.cancel();
    this.pending.clear();
    this.ui.destroy();
  }

  public get firedList(): ReadonlySet<StoryEventID> {
    return this.fired;
  }

  public get pendingList(): ReadonlyMap<StoryEventID, Alarm> {
    return this.pending;
  }

  public playNow(id: StoryEventID) {
    this.fired.add(id);
    this.stoppers.get(id)?.();
    this.stoppers.delete(id);
    this.pending.get(id)?.cancel();
    this.pending.delete(id);
    this.play(id);
  }

  // the screen is taken and no input goes to the game: no camera, and no Tab, which would close
  // every window; for co.take, it gives everything back when the script ends, stops or is skipped
  public hold(options: StoryHold) {
    assert(!this.busy, "The screen is held twice");
    const paused = Time.getPaused();
    if (options.pause) Time.setPaused(true);
    if (options.stopClock) this.calendar.isRunning = false;
    if (options.hideHud) showHud(false);
    if (options.keepMode) this.gameMode.block(STORY.buildHold);
    else this.gameMode.set("cutscene");
    this.busy = true;
    let held = true;
    return {
      release: () => {
        if (!held) return;
        held = false;
        this.busy = false;
        if (options.keepMode) this.gameMode.unblock(STORY.buildHold);
        // the intro ends with the player shooting: build or shoot mode stays as it is
        else if (this.gameMode.is("cutscene")) this.gameMode.set("game");
        if (options.pause) Time.setPaused(paused);
        if (options.stopClock) this.calendar.isRunning = true;
        if (options.hideHud) showHud(true);
      },
    };
  }

  // over a window, it waits for that window open instead of for none
  public *popup(co: Coroutine, popup: StoryPopup, over?: UIWindow) {
    yield co.waitUntil(() => this.canShow(over));
    const hold = co.take(this.hold({ pause: true }));
    yield this.ui.popup(popup, over);
    hold.release();
  }

  public *popupInBuild(co: Coroutine, popup: StoryPopup) {
    yield co.waitUntil(() => !this.busy && this.gameMode.is("build"));
    const hold = co.take(this.hold({ pause: true, keepMode: true }));
    yield this.ui.popup(popup);
    hold.release();
  }

  // every window shuts and the HUD hides, the screen goes black and change happens in the dark
  public *blackout(co: Coroutine, change: () => void) {
    yield co.waitUntil(() => this.canShow());
    const hold = co.take(this.hold({ pause: true, hideHud: true }));
    closeAllWindows();
    const blackout = STORY.blackout;
    yield this.ui.curtain.darken(blackout.close * 1000);
    yield co.waitSeconds(blackout.dark / 2);
    change();
    yield co.waitSeconds(blackout.dark / 2);
    yield this.ui.curtain.brighten(blackout.open * 1000);
    hold.release();
  }

  // the player's own camera stays locked meanwhile; the game's camera waits at the spot, so the
  // release has nothing to glide back to
  public *glideCamera(co: Coroutine, spot: Position2D) {
    if (!co.isSkipping)
      yield co.start(function* (glide) {
        const vcam = glide.take(Camera.claim({ blend: 0, release: 0 }));
        yield vcam.moveTo(spot, { duration: STORY.glide.seconds, easing: "easeInOutSine" });
      });
    Camera.setPosition(spot);
  }

  public buildMarket() {
    this.buildings.buildMarket();
  }

  public startMorale() {
    this.roster.beginMorale();
  }

  public unlockPlan(plan: string) {
    this.playerStats.unlock(plan);
  }

  public buildCategoryOpen(category: BuildCategoryID) {
    return this.gameMode.is("build") && this.buildMode.category === category;
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
    if (this.busy || !this.gameMode.is("game")) return false;
    return over === undefined || over.isOpen;
  }

  private play(id: StoryEventID) {
    const event = STORY_EVENTS[id];
    const key = `story ${StoryEventID[id]}`;
    const story = this;
    this.startCoroutine(
      function* (co) {
        if (event.skippable) {
          story.ui.showSkip(() => {
            story.ui.showSkip(undefined);
            story.skipCoroutine(key);
          });
          co.defer(() => story.ui.showSkip(undefined));
        }
        yield* event.play(co, story);
      },
      { key: key, time: event.time ?? "real" },
    );
  }

  private trigger(id: StoryEventID) {
    if (this.fired.has(id)) return;
    this.fired.add(id);
    this.stoppers.delete(id);
    const event = STORY_EVENTS[id];
    let alarm = event.at;
    if (alarm === undefined && event.after !== undefined) alarm = { after: event.after };
    if (alarm === undefined) {
      this.play(id);
      return;
    }
    this.pending.set(
      id,
      this.calendar.alarm(alarm, () => {
        this.pending.delete(id);
        this.play(id);
      }),
    );
  }
}
