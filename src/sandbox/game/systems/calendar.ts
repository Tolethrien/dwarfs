import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import type { Signal } from "@axiom/events";
import { assert } from "@axiom/utils";
import { debug } from "@debug";
import { gameCommands } from "../debugCommands";
import ClockHud from "../ui/clock";
import GameEvents from "./gameEvents";

export const CALENDAR = {
  hourLength: 40,
  hoursPerDay: 24,
  daysPerWeek: 7,
  startHour: 6,
};

export enum Weekday {
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday,
}

export interface HourInfo {
  day: number;
  hour: number;
  weekday: Weekday;
}
export interface DayInfo {
  day: number;
  weekday: Weekday;
  week: number;
}
export interface WeekInfo {
  week: number;
}
export interface CalendarSignals {
  hourStarted: Signal<HourInfo>;
  dayStarted: Signal<DayInfo>;
  weekStarted: Signal<WeekInfo>;
}

export type AlarmWhen =
  | { after: number }
  | { day: number; hour: number }
  | { hour: number; everyDays: number }
  | { weekday: Weekday; hour: number };

export interface Alarm {
  readonly at: number;
  cancel(): void;
}

class CalendarAlarm implements Alarm {
  // also cancelled from its own ring, before a repeating one is set again
  public cancelled = false;

  constructor(
    public at: number,
    public readonly period: number | undefined,
    public readonly ring: () => void,
    private readonly owner: Calendar,
  ) {}

  public cancel() {
    this.owner.cancel(this);
  }
}

export default class Calendar extends PragmaSystem {
  private hours = CALENDAR.startHour;
  // the next full hour to fire, counted from the start of the game; from 0 even with a later
  // start, so the first frame still fires day 1's midnight and the hours up to the start
  private nextHour = 0;
  private readonly alarms = new Map<number, Set<CalendarAlarm>>();
  declare private events: GameEvents;
  declare private clock: ClockHud;

  public get day() {
    return Math.floor(this.hours / CALENDAR.hoursPerDay) + 1;
  }
  public get weekday() {
    return this.weekdayOf(this.day);
  }
  public get week() {
    return this.weekOf(this.day);
  }
  public get hour() {
    return Math.floor(this.hours % CALENDAR.hoursPerDay);
  }
  public get time() {
    return this.hours;
  }

  awake(): void {
    this.events = this.scene.getSystem(GameEvents);
    this.clock = new ClockHud(this);
    debug.game.connect("date", () => this.dateText);
    const calendar = this;
    gameCommands("time", {
      get date() {
        return calendar.dateText;
      },
      skip: (hours: number) => this.skip(hours),
    });
  }

  update(): void {
    this.clock.update();
    this.hours += Time.getDeltaTime() / CALENDAR.hourLength;
    this.advance();
  }

  public alarm(when: AlarmWhen, ring: () => void): Alarm {
    const alarm = new CalendarAlarm(this.firstRing(when), this.period(when), ring, this);
    this.set(alarm);
    return alarm;
  }

  public cancel(alarm: CalendarAlarm) {
    alarm.cancelled = true;
    this.alarms.get(alarm.at)?.delete(alarm);
  }

  private firstRing(when: AlarmWhen) {
    const hoursPerDay = CALENDAR.hoursPerDay;
    const today = Math.floor(this.nextHour / hoursPerDay) * hoursPerDay;
    if ("after" in when) {
      assert(when.after > 0, `An alarm after ${when.after} hours would ring in the past`);
      return Math.max(Math.round(this.hours + when.after), this.nextHour);
    }
    if ("day" in when) {
      const at = (when.day - 1) * hoursPerDay + when.hour;
      assert(at >= this.nextHour, `Day ${when.day} at ${when.hour}:00 is already gone`);
      return at;
    }
    if ("everyDays" in when) return this.notBefore(today + when.hour, hoursPerDay);
    const weekdayToday = this.weekdayOf(today / hoursPerDay + 1);
    const daysAhead = (when.weekday - weekdayToday + CALENDAR.daysPerWeek) % CALENDAR.daysPerWeek;
    return this.notBefore(today + daysAhead * hoursPerDay + when.hour, hoursPerDay * CALENDAR.daysPerWeek);
  }

  private notBefore(at: number, period: number) {
    return at < this.nextHour ? at + period : at;
  }

  private period(when: AlarmWhen) {
    if ("everyDays" in when) return when.everyDays * CALENDAR.hoursPerDay;
    if ("weekday" in when) return CALENDAR.hoursPerDay * CALENDAR.daysPerWeek;
    return undefined;
  }

  private set(alarm: CalendarAlarm) {
    let due = this.alarms.get(alarm.at);
    if (!due) {
      due = new Set();
      this.alarms.set(alarm.at, due);
    }
    due.add(alarm);
  }

  private skip(hours: number) {
    this.hours += hours;
    this.advance();
  }

  private advance() {
    // a long frame can cross several full hours, each one still fires in order
    while (this.nextHour <= this.hours) {
      const index = this.nextHour;
      this.nextHour++;
      this.fullHour(index);
    }
  }

  // the new day first, so whoever listens to the hour already sees it
  private fullHour(index: number) {
    const day = Math.floor(index / CALENDAR.hoursPerDay) + 1;
    const hour = index % CALENDAR.hoursPerDay;
    if (hour === 0) this.midnight(day);
    this.events.calendar.hourStarted.emit({ day: day, hour: hour, weekday: this.weekdayOf(day) });
    this.ring(index);
  }

  private ring(index: number) {
    const due = this.alarms.get(index);
    if (!due) return;
    this.alarms.delete(index);
    for (const alarm of due) {
      if (alarm.cancelled) continue;
      alarm.ring();
      if (alarm.cancelled || alarm.period === undefined) continue;
      alarm.at += alarm.period;
      this.set(alarm);
    }
  }

  private midnight(day: number) {
    const weekday = this.weekdayOf(day);
    const week = this.weekOf(day);
    if (weekday === Weekday.monday) this.events.calendar.weekStarted.emit({ week: week });
    this.events.calendar.dayStarted.emit({ day: day, weekday: weekday, week: week });
  }

  private weekdayOf(day: number): Weekday {
    return (day - 1) % CALENDAR.daysPerWeek;
  }

  private weekOf(day: number) {
    return Math.floor((day - 1) / CALENDAR.daysPerWeek) + 1;
  }

  public get dateText() {
    const hour = String(this.hour).padStart(2, "0");
    return `Week ${this.week} · Day ${this.day} · ${Weekday[this.weekday]} · ${hour}:00`;
  }
}
