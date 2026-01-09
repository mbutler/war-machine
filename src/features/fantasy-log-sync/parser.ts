/**
 * Fantasy-Log Parser
 * 
 * Parses world.json and events.jsonl from the fantasy-log project.
 */

import type { FantasyLogWorld, LogEntry, ImportWarning } from './types';

export interface ParsedData {
  world: FantasyLogWorld | null;
  events: LogEntry[];
  warnings: ImportWarning[];
}

/**
 * Parse a world.json file content
 */
export function parseWorldJson(content: string): { world: FantasyLogWorld | null; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  
  try {
    const parsed = JSON.parse(content);
    
    // Validate required fields
    if (!parsed.seed) {
      warnings.push({ type: 'warning', message: 'World missing seed - using "unknown"' });
      parsed.seed = 'unknown';
    }
    
    if (!parsed.settlements || !Array.isArray(parsed.settlements)) {
      warnings.push({ type: 'warning', message: 'World missing settlements array' });
      parsed.settlements = [];
    }
    
    if (!parsed.parties || !Array.isArray(parsed.parties)) {
      warnings.push({ type: 'warning', message: 'World missing parties array' });
      parsed.parties = [];
    }
    
    if (!parsed.hexes || !Array.isArray(parsed.hexes)) {
      warnings.push({ type: 'warning', message: 'World missing hexes array' });
      parsed.hexes = [];
    }
    
    // Normalize optional arrays
    parsed.dungeons = parsed.dungeons ?? [];
    parsed.npcs = parsed.npcs ?? [];
    parsed.caravans = parsed.caravans ?? [];
    parsed.factions = parsed.factions ?? [];
    parsed.strongholds = parsed.strongholds ?? [];
    parsed.armies = parsed.armies ?? [];
    parsed.activeRumors = parsed.activeRumors ?? [];
    parsed.roads = parsed.roads ?? [];
    parsed.antagonists = parsed.antagonists ?? [];
    parsed.storyThreads = parsed.storyThreads ?? [];
    
    return { world: parsed as FantasyLogWorld, warnings };
  } catch (error) {
    return {
      world: null,
      warnings: [{
        type: 'error',
        message: `Failed to parse world.json: ${(error as Error).message}`
      }]
    };
  }
}

/**
 * Parse an events.jsonl file content (newline-delimited JSON)
 */
export function parseEventsJsonl(content: string): { events: LogEntry[]; warnings: ImportWarning[] } {
  const warnings: ImportWarning[] = [];
  const events: LogEntry[] = [];
  
  const lines = content.trim().split('\n').filter(line => line.trim());
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    try {
      const entry = JSON.parse(line) as LogEntry;
      
      // Validate required fields
      if (!entry.category || !entry.summary || !entry.worldTime) {
        warnings.push({
          type: 'warning',
          message: `Line ${i + 1}: Event missing required fields, skipping`
        });
        continue;
      }
      
      events.push(entry);
    } catch (error) {
      warnings.push({
        type: 'warning',
        message: `Line ${i + 1}: Failed to parse event JSON`
      });
    }
  }
  
  if (events.length === 0 && lines.length > 0) {
    warnings.push({
      type: 'error',
      message: 'No valid events found in events.jsonl'
    });
  }
  
  return { events, warnings };
}

/**
 * Parse both files from a combined import
 */
export function parseFantasyLogFiles(
  worldContent: string | null,
  eventsContent: string | null
): ParsedData {
  const allWarnings: ImportWarning[] = [];
  let world: FantasyLogWorld | null = null;
  let events: LogEntry[] = [];
  
  if (worldContent) {
    const worldResult = parseWorldJson(worldContent);
    world = worldResult.world;
    allWarnings.push(...worldResult.warnings);
  }
  
  if (eventsContent) {
    const eventsResult = parseEventsJsonl(eventsContent);
    events = eventsResult.events;
    allWarnings.push(...eventsResult.warnings);
  }
  
  if (!world && events.length === 0) {
    allWarnings.push({
      type: 'error',
      message: 'No valid data found in either file'
    });
  }
  
  return { world, events, warnings: allWarnings };
}

/**
 * Extract gold amounts from event text
 * Matches patterns like "35 coin", "100 gold", "50gp", etc.
 */
export function extractGoldFromEvent(event: LogEntry): number | null {
  const text = `${event.summary} ${event.details ?? ''}`;
  
  // Match various gold patterns
  const patterns = [
    /(\d+)\s*(?:coin|coins)/i,
    /(\d+)\s*(?:gold|gp)/i,
    /(\d+)\s*(?:treasure|loot)/i,
    /claim(?:s|ed)?\s+(\d+)/i,
    /worth\s+(\d+)/i,
    /plunder(?:s|ed)?\s+(\d+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }
  
  return null;
}

/**
 * Detect if an event represents combat/battle
 */
export function isCombatEvent(event: LogEntry): boolean {
  const text = `${event.summary} ${event.details ?? ''}`.toLowerCase();
  const combatTerms = [
    'battle', 'fight', 'clash', 'combat', 'attack', 'ambush',
    'defeat', 'victory', 'slain', 'killed', 'fell', 'routed',
    'skirmish', 'engage', 'struck', 'wound'
  ];
  return combatTerms.some(term => text.includes(term));
}

/**
 * Detect if an event represents travel/arrival
 */
export function isTravelEvent(event: LogEntry): boolean {
  const text = `${event.summary} ${event.details ?? ''}`.toLowerCase();
  const travelTerms = [
    'arrives', 'arrived', 'departs', 'departed', 'travels', 
    'journey', 'reaches', 'enters', 'leaves', 'sets out'
  ];
  return travelTerms.some(term => text.includes(term));
}

/**
 * Detect if an event represents construction/building
 */
export function isConstructionEvent(event: LogEntry): boolean {
  const text = `${event.summary} ${event.details ?? ''}`.toLowerCase();
  const constructionTerms = [
    'construction', 'building', 'stronghold', 'tower', 'keep',
    'fortification', 'walls', 'foundation', 'complete'
  ];
  return constructionTerms.some(term => text.includes(term));
}

/**
 * Detect if an event represents trade/commerce
 */
export function isTradeEvent(event: LogEntry): boolean {
  const text = `${event.summary} ${event.details ?? ''}`.toLowerCase();
  const tradeTerms = [
    'caravan', 'trade', 'merchant', 'goods', 'cargo',
    'delivery', 'market', 'commerce', 'profit'
  ];
  return tradeTerms.some(term => text.includes(term));
}

