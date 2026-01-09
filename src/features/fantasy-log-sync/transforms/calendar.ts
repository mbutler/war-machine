/**
 * Calendar Transform
 * 
 * Converts fantasy-log calendar state to war-machine CalendarState.
 */

import type { CalendarState as FLCalendar, FantasyLogWorld, LogEntry, StoryThread } from '../types';
import type { CalendarState, CalendarEvent, CalendarClock } from '../../../state/schema';
import { createId } from '../../../utils/id';

/**
 * Transform fantasy-log calendar to war-machine calendar
 */
export function transformCalendar(
  flCalendar: FLCalendar | undefined,
  world: FantasyLogWorld,
  events: LogEntry[]
): CalendarState {
  // Determine clock from calendar or lastTickAt
  let clock: CalendarClock;
  
  if (flCalendar) {
    clock = {
      year: flCalendar.year,
      month: flCalendar.month,
      day: flCalendar.day,
      hour: 8, // Default to morning
      minute: 0,
    };
  } else if (world.lastTickAt) {
    const date = new Date(world.lastTickAt);
    clock = {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
  } else if (world.startedAt) {
    const date = new Date(world.startedAt);
    clock = {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hour: 8,
      minute: 0,
    };
  } else {
    // Default to year 1000
    clock = {
      year: 1000,
      month: 0,
      day: 1,
      hour: 8,
      minute: 0,
    };
  }
  
  // Extract calendar events from story threads
  const calendarEvents: CalendarEvent[] = [];
  
  if (world.storyThreads) {
    for (const story of world.storyThreads) {
      if (!story.resolved) {
        // Active story threads become calendar events
        calendarEvents.push({
          id: createId(),
          label: story.title,
          date: formatCalendarDate(clock),
          notes: `[${story.phase}] ${story.summary}`,
        });
      }
    }
  }
  
  // Extract notable events from log as calendar entries
  const notableEvents = events.filter(e => 
    e.category === 'faction' && 
    (e.summary.includes('tale begins') || e.summary.includes('resolved'))
  );
  
  for (const event of notableEvents.slice(-10)) { // Last 10 notable events
    const eventDate = new Date(event.worldTime);
    calendarEvents.push({
      id: createId(),
      label: event.summary,
      date: `${eventDate.getUTCMonth() + 1}/${eventDate.getUTCDate()}/${eventDate.getUTCFullYear()}`,
      notes: event.details,
    });
  }
  
  // Build log entries from recent events
  const log = events.slice(-50).map(e => ({
    id: createId(),
    timestamp: new Date(e.worldTime).getTime(),
    action: e.summary,
    detail: e.details,
  }));
  
  return {
    clock,
    trackers: [], // Trackers are managed by war-machine, not imported
    log,
    events: calendarEvents,
  };
}

/**
 * Format calendar date as string
 */
function formatCalendarDate(clock: CalendarClock): string {
  return `${clock.month + 1}/${clock.day}/${clock.year}`;
}

/**
 * Extract active trackers from world state
 * (Strongholds under construction, etc.)
 */
export function extractTrackers(world: FantasyLogWorld) {
  const trackers: CalendarState['trackers'] = [];
  
  // Strongholds under construction
  for (const stronghold of world.strongholds) {
    if (!stronghold.constructionFinished) {
      trackers.push({
        id: createId(),
        name: `Building: ${stronghold.name}`,
        remainingMinutes: 30 * 24 * 60, // Estimate: 30 days
        initialMinutes: 60 * 24 * 60, // Estimate: 60 days total
        kind: 'stronghold',
        startedAt: Date.now(),
      });
    }
  }
  
  // Caravans in transit
  for (const caravan of world.caravans) {
    const remainingHours = Math.max(1, 24 - caravan.progressHours);
    trackers.push({
      id: createId(),
      name: `Caravan: ${caravan.name}`,
      remainingMinutes: remainingHours * 60,
      initialMinutes: 24 * 60,
      kind: 'merchant',
      startedAt: Date.now(),
    });
  }
  
  return trackers;
}

