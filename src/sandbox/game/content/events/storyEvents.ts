import type Coroutine from "@engine/coroutines/coroutine";
import type { CoroutineTime, CoroutineWait } from "@engine/coroutines/coroutine";
import type StoryEvents from "../../systems/storyEvents";
import { ResourcesID } from "../resources";
import { MAIN_TRAITS, MainTraitsID } from "../traits";
import { MORALE } from "../../systems/welfare";
import { playIntro } from "./intro";

// the ids go to the save, keep them stable
export enum StoryEventID {
  smelterTutorial,
  tavernTutorial,
  marketOpens,
  tradeUnion,
  intro,
}

// start: the game begins; resource: at least amount of it in the storage; applicationsArrived: the
// tavern's daily newcomers; headquartersLevel: the headquarters reached at least the level
export type StoryTrigger =
  | { kind: "start" }
  | { kind: "resource"; id: ResourcesID; amount: number }
  | { kind: "applicationsArrived" }
  | { kind: "headquartersLevel"; level: number };

const MINER = MAIN_TRAITS[MainTraitsID.miner];

export interface StoryEvent {
  when: StoryTrigger;
  // game hours from the trigger to the event
  after?: number;
  // real by default, so it goes on while the game stands still
  time?: CoroutineTime;
  // a Skip button while it runs, the script fast-forwards (co.isSkipping)
  skippable?: boolean;
  play(co: Coroutine, story: StoryEvents): Generator<CoroutineWait | void, void, void>;
}

export const STORY_EVENTS: Record<StoryEventID, StoryEvent> = {
  [StoryEventID.intro]: {
    when: { kind: "start" },
    time: "game",
    skippable: true,
    play: playIntro,
  },
  [StoryEventID.smelterTutorial]: {
    when: { kind: "resource", id: ResourcesID.ironOre, amount: 20 },
    *play(co, story) {
      yield* story.popup(co, {
        title: "You've got iron ore!",
        lines: ["Ore can be smelted into iron bars.", "Build a smelter in the empty cave by the shaft and smelt it there."],
      });
    },
  },
  // the first newcomers are two miners, the tavern brings them the same every game
  [StoryEventID.tavernTutorial]: {
    when: { kind: "applicationsArrived" },
    *play(co, story) {
      yield* story.popup(co, {
        title: "New applications!",
        lines: ["Every day at 12:00 new recruits leave their applications in the tavern.", "Go to the tavern and look at the Applications tab."],
      });
      yield co.waitUntil(() => story.tavernShows("applications"));
      yield* story.popup(
        co,
        {
          title: `A new kind of dwarf: ${MINER.name}!`,
          lines: [MINER.description, `Speed ${MINER.speed} · Power ${MINER.power} · Drinks ${MINER.bph} beer an hour`],
        },
        story.tavernWindow,
      );
    },
  },
  [StoryEventID.marketOpens]: {
    when: { kind: "headquartersLevel", level: 2 },
    *play(co, story) {
      yield* story.blackout(co, () => story.buildMarket());
    },
  },
  [StoryEventID.tradeUnion]: {
    when: { kind: "headquartersLevel", level: 2 },
    after: 48,
    *play(co, story) {
      yield* story.popup(co, {
        title: "The dwarfs have formed a trade union!",
        lines: [
          "Over beer in the tavern, the miners have founded the first trade union in the history of the mountain. A pick-shaped banner already hangs above the bar.",
          "From today they demand sensible working hours, a full tankard after every shift and the right to grumble at the director. They will strike if pushed too far.",
          `Every dwarf now has morale, from ${MORALE.min} to ${MORALE.max}. Each hour of a shift, counted from the shot, takes ${-MORALE.work}; each hour in the tavern gives back ${MORALE.tavern}.`,
          `Below ${MORALE.tiredBelow} a dwarf becomes Tired and can't be called to work until its morale is back to ${MORALE.restedAt}. At 0 it drops its pick and goes home in the middle of the shift.`,
          "You can see a dwarf's morale on its card.",
        ],
      });
      story.startMorale();
    },
  },
};
