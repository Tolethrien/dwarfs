import PragmaSystem from "@pragma/system";
import { debug } from "@debug";
import { BlocksID } from "../../game/content/blocks";
import { STORY_EVENTS, StoryEventID, type StoryEvent } from "../../game/content/events/storyEvents";
import PlayerStats from "../../game/systems/core/playerStats";
import StoryEvents from "../../game/systems/core/storyEvents";
import Calendar from "../../game/systems/core/calendar";
import Buildings from "../../game/systems/mine/buildings";
import { HEADQUARTERS } from "../../game/components/buildings/headquarters";
import { BuildingsID } from "../../game/content/structures";
import { toast } from "../../game/ui/elements/toast";
import { action, choice, control, page } from "../pages";

type EventState = "played" | "pending" | "waiting";

const STORY = {
  stages: ["after the intro", "ready for HQ 2", "HQ 2 + AGH"] as const,
};

type Stage = (typeof STORY.stages)[number];

const IDS = {
  events: Object.values(StoryEventID).filter((id) => typeof id === "number") as StoryEventID[],
};

const EVENT = choice(IDS.events, (id) => StoryEventID[id]);

export default class StoryDebug extends PragmaSystem {
  declare private buildings: Buildings;
  declare private player: PlayerStats;
  declare private story: StoryEvents;
  declare private calendar: Calendar;

  awake(): void {
    this.player = this.scene.getSystem(PlayerStats);
    this.story = this.scene.getSystem(StoryEvents);
    this.calendar = this.scene.getSystem(Calendar);
    debug.game.connect("player", () => ({
      name: this.player.name,
      minedTotal: this.player.minedTotal,
      mined: [...this.player.minedList]
        .sort((a, b) => b[1] - a[1])
        .map(([block, count]) => ({ block: BlocksID[block], count: count })),
    }));
    debug.game.connect("date", () => this.calendar.dateText);
    debug.game.connect("events", () => this.eventRows());
    this.buildings = this.scene.getSystem(Buildings);
    page("story", "events", "Events", "Story events: jump the game to a stage, play an event now, or skip it.", () => {
      const event = { key: "event", control: EVENT.control, value: EVENT.names[0] };
      return [
        action("story", "jump", "Jump to", [
          { key: "stage", control: control.select(STORY.stages), value: STORY.stages[0] },
        ], (args) => this.jumpTo(STORY.stages.find((stage) => stage === args.stage) ?? STORY.stages[0])),
        action("story", "play", "Play now", [event], (args) => this.story.playNow(EVENT.id(args.event))),
        action("story", "skip", "Skip (stops it if it runs)", [event], (args) => this.story.skipEvent(EVENT.id(args.event))),
        action("story", "done", "Mark played without playing", [event], (args) => this.story.markDone(EVENT.id(args.event))),
      ];
    });
  }

  private jumpTo(stage: Stage) {
    this.story.skipEvent(StoryEventID.intro);
    if (stage === "ready for HQ 2") {
      const cost = HEADQUARTERS.levels[1]?.cost;
      if (cost) for (const [id, missing] of this.buildings.store.missing(cost)) this.buildings.store.add(id, missing);
      toast("Jumped to HQ 2 ready", "info");
      return;
    }
    if (stage === "HQ 2 + AGH") {
      this.story.markDone(StoryEventID.marketOpens);
      this.story.markDone(StoryEventID.aghOpens);
      if (this.buildings.mineLevel < 2) this.buildings.setMineLevel(2);
      if (!this.buildings.isStanding(BuildingsID.market)) this.buildings.buildMarket();
      if (!this.buildings.isStanding(BuildingsID.agh)) this.buildings.buildAgh();
      toast("Jumped to HQ 2 + AGH", "info");
      return;
    }
    toast("Jumped past the intro", "info");
  }

  // played in the order they went off, then pending from the soonest, then the ones still waiting;
  // firedList means triggered, an event waiting for its alarm is in pendingList too
  private eventRows() {
    const played = [...this.story.firedList].filter((id) => !this.story.pendingList.has(id));
    const pending = [...this.story.pendingList]
      .map(([id, alarm]) => ({ id: id, hours: (alarm.at ?? this.calendar.time) - this.calendar.time }))
      .sort((a, b) => a.hours - b.hours);
    const waiting = IDS.events.filter((id) => !this.story.firedList.has(id) && !this.story.pendingList.has(id));
    return [
      ...played.map((id) => this.eventRow(id, "played", null)),
      ...pending.map((event) => this.eventRow(event.id, "pending", event.hours)),
      ...waiting.map((id) => this.eventRow(id, "waiting", null)),
    ];
  }

  private eventRow(id: StoryEventID, state: EventState, hours: number | null) {
    return { name: StoryEventID[id], state: state, hours: hours, requirement: this.requirement(STORY_EVENTS[id]) };
  }

  private requirement(event: StoryEvent) {
    const parts: string[] = [];
    if (event.when) parts.push(`${event.when.describe()}${event.when.isMet(this.scene) ? " ✓" : ""}`);
    if (event.at) parts.push(Object.entries(event.at).map(([key, value]) => `${key} ${value}`).join(" "));
    if (event.after !== undefined) parts.push(`+${event.after} h`);
    return parts.length === 0 ? null : parts.join(" · ");
  }
}
