import type { CalendarTrackerKind, CalendarTrackerUnit } from "../../state/schema";
import { addCalendarTracker, removeCalendarTracker } from "./state";

export interface TimedActionOptions {
  name: string;
  duration: number;
  unit: CalendarTrackerUnit;
  kind?: CalendarTrackerKind;
  blocking?: boolean;
}

export interface TimedAction {
  trackerId: string;
}

export function startTimedAction(options: TimedActionOptions): TimedAction | null {
  const { name, duration, unit, kind = "other", blocking = false } = options;
  if (!name.trim() || duration <= 0) {
    return null;
  }
  const tracker = addCalendarTracker(name, duration, unit, { kind, blocking });
  return tracker ? { trackerId: tracker.id } : null;
}

export function cancelTimedAction(id: string) {
  removeCalendarTracker(id);
}

