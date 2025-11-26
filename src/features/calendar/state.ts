import type {
  CalendarClock,
  CalendarLogEntry,
  CalendarState,
  CalendarTracker,
  CalendarTrackerKind,
} from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { createId } from "../../utils/id";

export type CalendarListener = (state: CalendarState) => void;
export type CalendarEventPayload = { type: "timers-expired"; trackers: CalendarTracker[] };

const calendarEventListeners = new Set<(event: CalendarEventPayload) => void>();

export type CalendarAdvanceUnit =
  | "round"
  | "turn"
  | "hour"
  | "watch"
  | "day"
  | "week"
  | "month"
  | "season";

export type CalendarTrackerUnit = "turn" | "hour" | "day" | "week";

const MINUTES_PER_UNIT: Record<CalendarAdvanceUnit, number> = {
  round: 10 / 60,
  turn: 10,
  hour: 60,
  watch: 240,
  day: 1440,
  week: 10080,
  month: 40320,
  season: 120960,
};

const MINUTES_PER_TRACKER_UNIT: Record<CalendarTrackerUnit, number> = {
  turn: 10,
  hour: 60,
  day: 1440,
  week: 10080,
};

const MAX_LOG_ENTRIES = 200;
const DAYS_PER_MONTH = 28;
const MONTHS_PER_YEAR = 12;

const DEFAULT_CLOCK: CalendarClock = {
  year: 1000,
  month: 0,
  day: 1,
  hour: 8,
  minute: 0,
};

export const CALENDAR_MONTHS = [
  "Nuwmont",
  "Vatermont",
  "Thaumont",
  "Flaurmont",
  "Yarthmont",
  "Klarmont",
  "Felmont",
  "Fyrmont",
  "Ambyrmont",
  "Sviftmont",
  "Eirmont",
  "Kaldmont",
] as const;

export function getCalendarState(): CalendarState {
  return getState().calendar;
}

export function subscribeToCalendar(listener: CalendarListener): () => void {
  return subscribe((state) => listener(state.calendar));
}

export function onCalendarEvent(listener: (event: CalendarEventPayload) => void): () => void {
  calendarEventListeners.add(listener);
  return () => calendarEventListeners.delete(listener);
}

function emitCalendarEvent(event: CalendarEventPayload) {
  calendarEventListeners.forEach((listener) => listener(event));
}

export function advanceCalendar(unit: CalendarAdvanceUnit, amount = 1): CalendarTracker[] {
  if (amount <= 0) {
    return [];
  }

  let expired: CalendarTracker[] = [];

  updateState((state) => {
    const calendar = state.calendar;
    calendar.clock = normalizeClock(calendar.clock);
    calendar.trackers = Array.isArray(calendar.trackers) ? calendar.trackers : [];
    calendar.log = Array.isArray(calendar.log) ? calendar.log : [];
    const before = describeClock(calendar.clock);
    advanceClock(calendar.clock, unit, amount);
    const after = describeClock(calendar.clock);
    const minutes = convertUnitToMinutes(unit, amount);
    if (minutes > 0) {
      expired = decrementTrackers(calendar, minutes);
    }
    addCalendarLog(calendar, `Time passed: +${amount} ${unit}${amount === 1 ? "" : "s"}`, `${before} → ${after}`);
  });
  return expired;

  if (expired.length) {
    emitCalendarEvent({ type: "timers-expired", trackers: expired });
  }

  return expired;
}

export function manualSetCalendar(payload: { year: number; month: number; day: number }) {
  updateState((state) => {
    state.calendar.clock.year = Math.max(0, Math.floor(payload.year) || 0);
    state.calendar.clock.month = normalizeMonth(payload.month);
    state.calendar.clock.day = normalizeDay(payload.day);
    addCalendarLog(state.calendar, "Manual update", describeClock(state.calendar.clock));
  });
}

export function addCalendarTracker(
  name: string,
  duration: number,
  unit: CalendarTrackerUnit,
  options: { kind?: CalendarTrackerKind; blocking?: boolean } = {},
): CalendarTracker | null {
  const trimmed = name.trim();
  if (!trimmed || duration <= 0) {
    return;
  }

  const minutes = convertTrackerDuration(duration, unit);
  if (minutes <= 0) {
    return;
  }

  let newTracker: CalendarTracker | null = null;
  updateState((state) => {
    const tracker: CalendarTracker = {
      id: createId(),
      name: trimmed,
      initialMinutes: minutes,
      remainingMinutes: minutes,
      kind: options.kind ?? "other",
      blocking: options.blocking ?? false,
      startedAt: Date.now(),
    };
    state.calendar.trackers.push(tracker);
    addCalendarLog(
      state.calendar,
      "Tracker added",
      `${tracker.name} (${formatDuration(minutes)})${tracker.blocking ? " · Blocking" : ""}`,
    );
    newTracker = tracker;
  });

  return newTracker;
}

export function removeCalendarTracker(id: string) {
  updateState((state) => {
    state.calendar.trackers = state.calendar.trackers.filter((tracker) => tracker.id !== id);
  });
}

export function clearCalendarLog() {
  updateState((state) => {
    state.calendar.log = [];
  });
}

export function exportCalendarData() {
  const calendar = getCalendarState();
  return {
    exportedAt: new Date().toISOString(),
    clock: calendar.clock,
    trackers: calendar.trackers,
    log: calendar.log,
  };
}

export function importCalendarData(raw: string) {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Calendar import payload must be an object.");
  }

  updateState((state) => {
    const data = payload as {
      clock?: Partial<CalendarClock>;
      trackers?: CalendarTracker[];
      log?: CalendarLogEntry[];
    };

    if (data.clock) {
      state.calendar.clock = {
        year: Math.max(0, Math.floor(data.clock.year ?? state.calendar.clock.year)),
        month: normalizeMonth(data.clock.month ?? state.calendar.clock.month),
        day: normalizeDay(data.clock.day ?? state.calendar.clock.day),
        hour: clampHour(data.clock.hour ?? state.calendar.clock.hour),
        minute: clampMinute(data.clock.minute ?? state.calendar.clock.minute),
      };
    }

    if (Array.isArray(data.trackers)) {
      state.calendar.trackers = data.trackers.map((tracker) => ({
        id: tracker.id ?? createId(),
        name: tracker.name ?? "Tracker",
        initialMinutes: Number.isFinite(tracker.initialMinutes) ? tracker.initialMinutes : 0,
        remainingMinutes: Number.isFinite(tracker.remainingMinutes) ? tracker.remainingMinutes : 0,
      }));
    }

    if (Array.isArray(data.log)) {
      state.calendar.log = data.log
        .map((entry) => ({
          id: entry.id ?? createId(),
          timestamp: entry.timestamp ?? Date.now(),
          action: entry.action ?? "Entry",
          detail: entry.detail,
        }))
        .slice(0, MAX_LOG_ENTRIES);
    }
  });
}

export function getCalendarSeason(clock: CalendarClock): string {
  const safe = normalizeClock(clock);
  if (safe.month >= 2 && safe.month <= 4) return "Spring";
  if (safe.month >= 5 && safe.month <= 7) return "Summer";
  if (safe.month >= 8 && safe.month <= 10) return "Autumn";
  return "Winter";
}

export function getCalendarMoonPhase(clock: CalendarClock): string {
  const safe = normalizeClock(clock);
  const day = ((safe.day - 1) % DAYS_PER_MONTH) + 1;
  if (day > 3 && day <= 10) return "First Quarter";
  if (day > 10 && day <= 17) return "Full Moon";
  if (day > 17 && day <= 24) return "Last Quarter";
  return "New Moon";
}

export function formatCalendarDate(clock: CalendarClock): string {
  const safe = normalizeClock(clock);
  const monthName = CALENDAR_MONTHS[normalizeMonth(safe.month)];
  return `${safe.day} ${monthName}, AC ${safe.year}`;
}

export function formatCalendarTime(clock: CalendarClock): string {
  const safe = normalizeClock(clock);
  const hours = Math.floor(safe.hour);
  const minutes = Math.floor(safe.minute);
  const amPm = hours >= 12 ? "PM" : "AM";
  let displayHour = hours % 12;
  if (displayHour === 0) displayHour = 12;
  return `${displayHour}:${minutes.toString().padStart(2, "0")} ${amPm}`;
}

export function formatDuration(minutes: number): string {
  if (minutes >= 1440) {
    return `${(minutes / 1440).toFixed(1)} day(s)`;
  }
  if (minutes >= 60) {
    return `${(minutes / 60).toFixed(1)} hr(s)`;
  }
  if (minutes >= 1) {
    return `${Math.round(minutes)} min(s)`;
  }
  return "Moments";
}

export function addCalendarLog(state: CalendarState, action: string, detail?: string) {
  const log = Array.isArray(state.log) ? state.log : [];
  log.unshift({
    id: createId(),
    timestamp: Date.now(),
    action,
    detail,
  });
  state.log = log.slice(0, MAX_LOG_ENTRIES);
}

export function describeClock(clock: CalendarClock): string {
  const safe = normalizeClock(clock);
  return `${formatCalendarDate(safe)} ${formatCalendarTime(safe)}`;
}

export function advanceClock(clock: CalendarClock, unit: CalendarAdvanceUnit, amount: number) {
  const target = normalizeClock(clock);
  switch (unit) {
    case "round":
      addMinutes(target, (10 / 60) * amount);
      break;
    case "turn":
      addMinutes(target, 10 * amount);
      break;
    case "hour":
      addHours(target, amount);
      break;
    case "watch":
      addHours(target, 4 * amount);
      break;
    case "day":
      addDays(target, amount);
      break;
    case "week":
      addDays(target, 7 * amount);
      break;
    case "month":
      addMonths(target, amount);
      break;
    case "season":
      addMonths(target, 3 * amount);
      break;
    default:
      break;
  }
  Object.assign(clock, target);
}

function addMinutes(clock: CalendarClock, minutes: number) {
  if (minutes <= 0) return;
  clock.minute += minutes;
  while (clock.minute >= 60) {
    clock.minute -= 60;
    addHours(clock, 1);
  }
}

function addHours(clock: CalendarClock, hours: number) {
  if (hours <= 0) return;
  clock.hour += hours;
  while (clock.hour >= 24) {
    clock.hour -= 24;
    addDays(clock, 1);
  }
}

function addDays(clock: CalendarClock, days: number) {
  if (days <= 0) return;
  clock.day += days;
  while (clock.day > DAYS_PER_MONTH) {
    clock.day -= DAYS_PER_MONTH;
    addMonths(clock, 1);
  }
}

function addMonths(clock: CalendarClock, months: number) {
  if (months <= 0) return;
  clock.month += months;
  while (clock.month >= MONTHS_PER_YEAR) {
    clock.month -= MONTHS_PER_YEAR;
    clock.year += 1;
  }
}

function convertUnitToMinutes(unit: CalendarAdvanceUnit, amount: number): number {
  const minutes = MINUTES_PER_UNIT[unit];
  return minutes ? minutes * amount : 0;
}

function convertTrackerDuration(duration: number, unit: CalendarTrackerUnit): number {
  return (MINUTES_PER_TRACKER_UNIT[unit] ?? 0) * duration;
}

function decrementTrackers(state: CalendarState, minutes: number): CalendarTracker[] {
  if (minutes <= 0) return [];
  const expired: CalendarTracker[] = [];
  const trackers = Array.isArray(state.trackers) ? state.trackers : [];

  trackers.forEach((tracker) => {
    if (tracker.remainingMinutes <= 0) {
      return;
    }
    tracker.remainingMinutes = Math.max(0, tracker.remainingMinutes - minutes);
    if (tracker.remainingMinutes === 0) {
      expired.push({ ...tracker });
    }
  });

  if (expired.length) {
    const expiredIds = new Set(expired.map((tracker) => tracker.id));
    state.trackers = trackers.filter((tracker) => !expiredIds.has(tracker.id));
    addCalendarLog(state, "Timers expired", expired.map((t) => t.name).join(", "));
  } else {
    state.trackers = trackers;
  }

  return expired;
}

function normalizeMonth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  let month = Math.floor(value);
  while (month < 0) month += MONTHS_PER_YEAR;
  while (month >= MONTHS_PER_YEAR) month -= MONTHS_PER_YEAR;
  return month;
}

function normalizeDay(value: number): number {
  if (!Number.isFinite(value)) return 1;
  let day = Math.floor(value);
  if (day < 1) day = 1;
  if (day > DAYS_PER_MONTH) day = ((day - 1) % DAYS_PER_MONTH) + 1;
  return day;
}

function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 0;
  let hour = Math.floor(value);
  while (hour < 0) hour += 24;
  while (hour >= 24) hour -= 24;
  return hour;
}

function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return 0;
  let minute = Math.floor(value);
  while (minute < 0) minute += 60;
  while (minute >= 60) minute -= 60;
  return minute;
}

function normalizeClock(clock?: Partial<CalendarClock> | null): CalendarClock {
  return {
    year: Number.isFinite(clock?.year) ? Math.floor(clock!.year as number) : DEFAULT_CLOCK.year,
    month: normalizeMonth(clock?.month ?? DEFAULT_CLOCK.month),
    day: normalizeDay(clock?.day ?? DEFAULT_CLOCK.day),
    hour: clampHour(clock?.hour ?? DEFAULT_CLOCK.hour),
    minute: clampMinute(clock?.minute ?? DEFAULT_CLOCK.minute),
  };
}


