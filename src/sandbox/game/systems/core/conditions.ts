import PragmaSystem from "@pragma/system";
import type Condition from "../../conditions/condition";
import { missingOf, type WatchTopic } from "../../conditions/condition";
import GameEvents from "./gameEvents";

interface Watcher {
  condition: Condition;
  onChange: (met: boolean) => void;
  last: boolean;
}

export default class Conditions extends PragmaSystem {
  private readonly watchers = new Map<WatchTopic, Set<Watcher>>();

  awake(): void {
    const events = this.scene.getSystem(GameEvents);
    this.connect(events.resources.changed, () => this.notify("resources"));
    this.connect(events.headquarters.upgraded, () => this.notify("headquarters"));
    this.connect(events.tavern.arrived, () => this.notify("tavern"));
    this.connect(events.biomes.discovered, () => this.notify("biomes"));
    this.connect(events.shaft.deepened, () => this.notify("shaft"));
    this.connect(events.calendar.hourStarted, () => this.notify("calendar"));
    this.connect(events.player.unlocked, () => this.notify("plans"));
  }

  public isMet(condition: Condition) {
    return condition.isMet(this.scene);
  }

  public missing(condition: Condition) {
    return missingOf(condition, this.scene);
  }

  public watch(condition: Condition, onChange: (met: boolean) => void) {
    const watcher: Watcher = {
      condition: condition,
      onChange: onChange,
      last: condition.isMet(this.scene),
    };
    for (const topic of condition.watches) {
      let group = this.watchers.get(topic);
      if (!group) {
        group = new Set();
        this.watchers.set(topic, group);
      }
      group.add(watcher);
    }
    return () => this.unwatch(watcher);
  }

  public whenMet(condition: Condition, onMet: () => void) {
    if (this.isMet(condition)) {
      onMet();
      return () => {};
    }
    const stop = this.watch(condition, (met) => {
      if (!met) return;
      stop();
      onMet();
    });
    return stop;
  }

  private unwatch(watcher: Watcher) {
    for (const topic of watcher.condition.watches) this.watchers.get(topic)?.delete(watcher);
  }

  private notify(topic: WatchTopic) {
    const group = this.watchers.get(topic);
    if (!group) return;
    for (const watcher of [...group]) {
      if (!group.has(watcher)) continue;
      const met = watcher.condition.isMet(this.scene);
      if (met === watcher.last) continue;
      watcher.last = met;
      watcher.onChange(met);
    }
  }
}
