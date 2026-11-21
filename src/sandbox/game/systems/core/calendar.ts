import PragmaSystem from "@pragma/system";
import Time from "@engine/time";
import type { Signal } from "@axiom/events";
import AxiomMath from "@axiom/math";
import { assert } from "@axiom/utils";
import ClockHud from "../../ui/hud/clock";
import GameEvents from "./gameEvents";

export const CALENDAR = {
  hourLength: 40,
  hoursPerDay: 24,
  daysPerWeek: 7,
  startHour: 8,
  // skips midnight and the edge hours (23, 0, 1)
  randomDayHours: { min: 2, max: 22 },
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
  | { randomInDay: number }
  | { randomInWeek: number }
  | { hour: number; everyDays: number }
  | { weekday: Weekday; hour: number };

export function randomInDay(day: number): AlarmWhen {
  return { randomInDay: day };
}

export function randomInWeek(week: number): AlarmWhen {
  return { randomInWeek: week };
}

// from: the alarm is set only once this holds (checked every full hour), its time counted from then;
// until: checked at each ring, once it holds the alarm is gone without ringing
export interface AlarmConditions {
  from?: () => boolean;
  until?: () => boolean;
}

export interface Alarm {
  // undefined while it waits for its from
  readonly at: number | undefined;
  cancel(): void;
}

class CalendarAlarm implements Alarm {
  public at: number | undefined;
  // also cancelled from its own ring, before a repeating one is set again
  public cancelled = false;

  constructor(
    public readonly when: AlarmWhen,
    public readonly ring: () => void,
    public readonly conditions: AlarmConditions,
    private readonly owner: Calendar,
  ) {}

  public cancel() {
    this.owner.cancel(this);
  }
}

export default class Calendar extends PragmaSystem {
  private hours = CALENDAR.startHour;
  // stopped, the hours don't move; the intro holds them until its end
  public isRunning = true;
  // the next full hour to fire, counted from the start of the game; from 0 even with a later
  // start, so the first frame still fires day 1's midnight and the hours up to the start
  private nextHour = 0;
  private readonly alarms = new Map<number, Set<CalendarAlarm>>();
  private readonly waiting = new Set<CalendarAlarm>();
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
  }

  update(): void {
    this.clock.update();
    if (this.isRunning) this.hours += Time.getDeltaTime() / CALENDAR.hourLength;
    this.advance();
  }

  public alarm(
    when: AlarmWhen,
    ring: () => void,
    conditions: AlarmConditions = {},
  ): Alarm {
    const alarm = new CalendarAlarm(when, ring, conditions, this);
    if (conditions.from && !conditions.from()) {
      this.waiting.add(alarm);
      return alarm;
    }
    const armed = this.arm(alarm);
    assert(armed, "The alarm's day is already gone");
    return alarm;
  }

  public cancel(alarm: CalendarAlarm) {
    alarm.cancelled = true;
    this.waiting.delete(alarm);
    if (alarm.at !== undefined) this.alarms.get(alarm.at)?.delete(alarm);
  }

  // a set day that went by while it waited never comes
  private arm(alarm: CalendarAlarm) {
    const at = this.firstRing(alarm.when);
    if (at < this.nextHour) {
      alarm.cancelled = true;
      return false;
    }
    this.set(alarm, at);
    return true;
  }

  private wake() {
    for (const alarm of this.waiting) {
      if (!alarm.conditions.from?.()) continue;
      this.waiting.delete(alarm);
      this.arm(alarm);
    }
  }

  private firstRing(when: AlarmWhen) {
    const hoursPerDay = CALENDAR.hoursPerDay;
    const today = Math.floor(this.nextHour / hoursPerDay) * hoursPerDay;
    if ("after" in when) {
      assert(
        when.after > 0,
        `An alarm after ${when.after} hours would ring in the past`,
      );
      return Math.max(Math.round(this.hours + when.after), this.nextHour);
    }
    if ("day" in when) return (when.day - 1) * hoursPerDay + when.hour;
    if ("randomInDay" in when) return this.randomSlot(when.randomInDay, when.randomInDay);
    if ("randomInWeek" in when) {
      const firstDay = (when.randomInWeek - 1) * CALENDAR.daysPerWeek + 1;
      return this.randomSlot(firstDay, firstDay + CALENDAR.daysPerWeek - 1);
    }
    if ("everyDays" in when)
      return this.notBefore(today + when.hour, hoursPerDay);
    const weekdayToday = this.weekdayOf(today / hoursPerDay + 1);
    const daysAhead =
      (when.weekday - weekdayToday + CALENDAR.daysPerWeek) %
      CALENDAR.daysPerWeek;
    return this.notBefore(
      today + daysAhead * hoursPerDay + when.hour,
      hoursPerDay * CALENDAR.daysPerWeek,
    );
  }

  private randomSlot(firstDay: number, lastDay: number) {
    const hoursPerDay = CALENDAR.hoursPerDay;
    const range = CALENDAR.randomDayHours;
    const slots: number[] = [];
    for (let day = firstDay; day <= lastDay; day++) {
      const dayStart = (day - 1) * hoursPerDay;
      const from = Math.max(range.min, this.nextHour - dayStart);
      for (let hour = from; hour <= range.max; hour++) slots.push(dayStart + hour);
    }
    if (slots.length === 0) return (lastDay - 1) * hoursPerDay + range.max;
    return slots[AxiomMath.randomInt(0, slots.length - 1)];
  }

  private notBefore(at: number, period: number) {
    return at < this.nextHour ? at + period : at;
  }

  private period(when: AlarmWhen) {
    if ("everyDays" in when) return when.everyDays * CALENDAR.hoursPerDay;
    if ("weekday" in when) return CALENDAR.hoursPerDay * CALENDAR.daysPerWeek;
    return undefined;
  }

  private set(alarm: CalendarAlarm, at: number) {
    alarm.at = at;
    let due = this.alarms.get(at);
    if (!due) {
      due = new Set();
      this.alarms.set(at, due);
    }
    due.add(alarm);
  }

  public skip(hours: number) {
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
    this.events.calendar.hourStarted.emit({
      day: day,
      hour: hour,
      weekday: this.weekdayOf(day),
    });
    this.wake();
    this.ring(index);
  }

  private ring(index: number) {
    const due = this.alarms.get(index);
    if (!due) return;
    this.alarms.delete(index);
    for (const alarm of due) {
      if (alarm.cancelled) continue;
      if (alarm.conditions.until?.()) {
        alarm.cancelled = true;
        continue;
      }
      alarm.ring();
      const period = this.period(alarm.when);
      if (alarm.cancelled || period === undefined) continue;
      this.set(alarm, index + period);
    }
  }

  private midnight(day: number) {
    const weekday = this.weekdayOf(day);
    const week = this.weekOf(day);
    if (weekday === Weekday.monday)
      this.events.calendar.weekStarted.emit({ week: week });
    this.events.calendar.dayStarted.emit({
      day: day,
      weekday: weekday,
      week: week,
    });
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
