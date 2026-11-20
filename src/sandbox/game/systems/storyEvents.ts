import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import { Camera } from "@engine/camera/camera";
import type Coroutine from "@engine/coroutines/coroutine";
import { assert } from "@axiom/utils";
import { STORY_EVENTS, StoryEventID, type StoryTrigger } from "../content/events/storyEvents";
import { BuildingsID } from "../content/structures";
import type Shaft from "../actors/shaft";
import Tavern from "../components/tavern";
import type { ResourceChange } from "../components/storage";
import StoryUI, { type StoryPopup } from "../ui/story";
import { closeAllWindows, isAnyWindowOpen, type UIWindow } from "../ui/elements/window";
import type { TavernTab } from "../ui/buildings/tavern";
import { showHud } from "../ui/hud";
import GameEvents from "./gameEvents";
import GameMode from "./gameMode";
import Buildings from "./buildings";
import MapView from "./mapView";
import Calendar, { type Alarm } from "./calendar";
import Welfare from "./welfare";
import Terrain from "./terrain";
import Discovery from "./discovery";
import Stations from "./stations";
import BuildMode from "./buildMode";
import PlayerStats from "./playerStats";
import Roster from "./roster";

// blackout: seconds into the black, in it before and after the change, and out of it; glide: the
// camera's flight to a spot
const STORY = {
  blackout: { close: 1.5, dark: 1, open: 2 },
  glide: { seconds: 1.2 },
};

const STORY_EVENT_IDS = Object.values(StoryEventID).filter((id) => typeof id === "number") as StoryEventID[];

export interface StoryHold {
  pause?: boolean;
  stopClock?: boolean;
  hideHud?: boolean;
}

// each event fires once a game, its script runs on its own, so one waiting for the player holds no
// other; only what takes the screen (the intro, a popup, a blackout) goes one at a time, while the
// player is just playing with no window open
export default class StoryEvents extends PragmaSystem {
  public readonly ui = new StoryUI();
  private readonly fired = new Set<StoryEventID>();
  private readonly pending = new Map<StoryEventID, Alarm>();
  private busy = false;
  declare public terrain: Terrain;
  declare public discovery: Discovery;
  declare public stations: Stations;
  declare public buildings: Buildings;
  declare public mapView: MapView;
  declare public buildMode: BuildMode;
  declare public gameMode: GameMode;
  declare public playerStats: PlayerStats;
  declare public roster: Roster;
  declare public calendar: Calendar;
  declare private welfare: Welfare;

  constructor(
    internal: InternalPSProps,
    public readonly shaft: Shaft,
  ) {
    super(internal);
  }

  awake(): void {
    this.terrain = this.scene.getSystem(Terrain);
    this.discovery = this.scene.getSystem(Discovery);
    this.stations = this.scene.getSystem(Stations);
    this.buildings = this.scene.getSystem(Buildings);
    this.mapView = this.scene.getSystem(MapView);
    this.buildMode = this.scene.getSystem(BuildMode);
    this.gameMode = this.scene.getSystem(GameMode);
    this.playerStats = this.scene.getSystem(PlayerStats);
    this.roster = this.scene.getSystem(Roster);
    this.calendar = this.scene.getSystem(Calendar);
    this.welfare = this.scene.getSystem(Welfare);
    const events = this.scene.getSystem(GameEvents);
    events.resources.changed.connect((change) => this.onResource(change));
    events.tavern.arrived.connect(() => this.fire((when) => when.kind === "applicationsArrived"));
    events.headquarters.upgraded.connect((level) => this.fire((when) => when.kind === "headquartersLevel" && level >= when.level));
  }

  start(): void {
    this.fire((when) => when.kind === "start");
  }

  update(): void {
    this.ui.update();
  }

  destroy(): void {
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
    this.gameMode.set("cutscene");
    this.busy = true;
    let held = true;
    return {
      release: () => {
        if (!held) return;
        held = false;
        this.busy = false;
        // the intro ends with the player shooting: build or shoot mode stays as it is
        if (this.gameMode.is("cutscene")) this.gameMode.set("game");
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
    this.welfare.begin();
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
    return over === undefined ? !isAnyWindowOpen() : over.isOpen;
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
