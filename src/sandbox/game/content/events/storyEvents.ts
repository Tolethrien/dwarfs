import type Coroutine from "@engine/coroutines/coroutine";
import type {
  CoroutineTime,
  CoroutineWait,
} from "@engine/coroutines/coroutine";
import type Condition from "../../conditions/condition";
import { hasResource } from "../../conditions/hasResource";
import { hqLevel } from "../../conditions/hqLevel";
import { tavernArrivals } from "../../conditions/tavernArrivals";
import type StoryEvents from "../../systems/core/storyEvents";
import { randomInDay, type AlarmWhen } from "../../systems/core/calendar";
import { ResourcesID } from "../resources";
import { BuildCategoryID } from "../build";
import { MAIN_TRAITS, MainTraitsID } from "../traits";
import { MORALE } from "../../components/dwarfs/morale";
import { playIntro } from "./intro";
import { playAghOpens } from "./agh";

// the ids go to the save, keep them stable
export enum StoryEventID {
  smelterTutorial,
  tavernTutorial,
  marketOpens,
  tradeUnion,
  intro,
  palisadePlans,
  aghOpens,
}

const MINER = MAIN_TRAITS[MainTraitsID.miner];

export interface StoryEvent {
  // omitted: fires when the game starts (or at its calendar alarm)
  when?: Condition;
  at?: AlarmWhen;
  // game hours from the trigger to the event
  after?: number;
  // real by default, so it goes on while the game stands still
  time?: CoroutineTime;
  // a Skip button while it runs, the script fast-forwards (co.isSkipping)
  skippable?: boolean;
  play(
    co: Coroutine,
    story: StoryEvents,
  ): Generator<CoroutineWait | void, void, void>;
}

export const STORY_EVENTS: Record<StoryEventID, StoryEvent> = {
  [StoryEventID.intro]: {
    skippable: true,
    play: playIntro,
  },
  [StoryEventID.smelterTutorial]: {
    when: hasResource(ResourcesID.ironOre, 20),
    *play(co, story) {
      yield* story.popup(co, {
        title: "You've got iron ore!",
        lines: [
          "Ore can be smelted into iron bars.",
          "Build a smelter in the empty cave by the shaft and smelt it there.",
        ],
      });
    },
  },
  // the first newcomers are two miners, the tavern brings them the same every game
  [StoryEventID.tavernTutorial]: {
    when: tavernArrivals(1),
    *play(co, story) {
      yield* story.popup(co, {
        title: "New applications!",
        lines: [
          "New recruits have left their applications in the tavern.",
          "Open the tavern and check the Applications tab.",
        ],
      });
      yield co.waitUntil(() => story.tavernShows("applications"));
      yield* story.popup(
        co,
        {
          title: `A new kind of dwarf: ${MINER.name}!`,
          lines: [
            MINER.description,
            `Speed ${MINER.speed} · Power ${MINER.power} · Drinks ${MINER.bph} beer an hour`,
          ],
        },
        story.tavernWindow,
      );
    },
  },
  [StoryEventID.marketOpens]: {
    when: hqLevel(2),
    *play(co, story) {
      yield* story.blackout(co, () => story.buildMarket());
    },
  },
  [StoryEventID.tradeUnion]: {
    when: hqLevel(2),
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
  [StoryEventID.palisadePlans]: {
    at: randomInDay(3),
    *play(co, story) {
      yield* story.popup(co, {
        title: "Plans from the Party!",
        lines: [
          "Comrade! The Central Committee's finest engineers have sent you the plans for their latest invention: the Palisade!",
          "Use it to bounce your comrades in the right direction underground. Open build mode [Tab] and look under Other.",
        ],
      });
      story.unlockPlan("palisade");
      yield co.waitUntil(() => story.buildCategoryOpen(BuildCategoryID.other));
      yield* story.popupInBuild(co, {
        title: "Palisade unlocked!",
        lines: [
          "You can now build palisades in dug-out caves to redirect flying dwarfs.",
          "Hold the right mouse button while placing to rotate a palisade to any angle.",
          "It's a cheap first design — each hit wears it down, and after a few hits it breaks and disappears.",
        ],
      });
    },
  },
  [StoryEventID.aghOpens]: {
    when: hqLevel(2),
    after: 24,
    skippable: true,
    play: playAghOpens,
  },
};
