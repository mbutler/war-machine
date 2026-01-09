/**
 * Fantasy-Log Faction Transform
 * 
 * Transforms fantasy-log factions into war-machine FactionState.
 * Also extracts faction events and operations from the event log.
 */

import type {
  Faction as WMFaction,
  FactionLogEntry,
  FactionOperation,
  FactionRelationship,
  FactionState,
} from '../../../state/schema';
import type { Faction as FLFaction, FantasyLogWorld, LogEntry } from '../types';
import { createId } from '../../../utils/id';

// ============================================================================
// Seeded Random for Deterministic Generation
// ============================================================================

class SeededRandom {
  private seed: number;

  constructor(seedStr: string) {
    this.seed = this.hashString(seedStr);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash) || 1;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  range(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// ============================================================================
// Main Transform
// ============================================================================

export function transformFactions(
  world: FantasyLogWorld,
  events: LogEntry[]
): FactionState {
  const factions: WMFaction[] = [];
  const relationships: FactionRelationship[] = [];
  const operations: FactionOperation[] = [];
  const log: FactionLogEntry[] = [];

  // Transform each faction from world.json
  for (const flFaction of world.factions) {
    const wmFaction = transformFaction(flFaction, world, events);
    factions.push(wmFaction);
  }

  // Build relationships from faction enemies/allies
  buildRelationships(factions, relationships);

  // Extract operations from events
  extractOperationsFromEvents(events, factions, operations);

  // Extract faction log entries from events
  extractFactionLog(events, factions, log);

  return {
    factions,
    relationships,
    operations,
    log,
    selectedFactionId: factions.length > 0 ? factions[0].id : null,
  };
}

// ============================================================================
// Individual Faction Transform
// ============================================================================

function transformFaction(
  flFaction: FLFaction,
  world: FantasyLogWorld,
  events: LogEntry[]
): WMFaction {
  const rng = new SeededRandom(flFaction.id + flFaction.name);

  // Estimate power from wealth, armies, and event mentions
  const armyCount = world.armies.filter(a => a.ownerId === flFaction.id).length;
  const totalArmyStrength = world.armies
    .filter(a => a.ownerId === flFaction.id)
    .reduce((sum, a) => sum + a.strength, 0);
  
  // Count event mentions
  const mentionCount = events.filter(e => 
    e.summary.includes(flFaction.name) || 
    e.actors?.includes(flFaction.name)
  ).length;

  // Calculate power (0-100) based on various factors
  let power = 30; // Base power
  power += Math.min(20, flFaction.wealth / 10); // Wealth contribution (max +20)
  power += armyCount * 10; // Each army +10
  power += Math.min(20, totalArmyStrength / 100); // Army strength contribution
  power += Math.min(10, mentionCount / 10); // Event prominence
  power = Math.min(100, Math.max(0, power));

  // Estimate morale from event outcomes
  let morale = 0;
  const factionEvents = events.filter(e => 
    e.category === 'faction' && 
    (e.summary.includes(flFaction.name) || e.actors?.includes(flFaction.name))
  );
  
  for (const event of factionEvents) {
    const summary = event.summary.toLowerCase();
    if (summary.includes('victory') || summary.includes('success') || summary.includes('grows bold')) {
      morale += 1;
    } else if (summary.includes('defeat') || summary.includes('loss') || summary.includes('falls')) {
      morale -= 1;
    }
  }
  morale = Math.min(10, Math.max(-10, morale));

  // Extract territory from caravans and settlements
  const territory: string[] = [];
  
  // Settlements they control (from attitude > 2)
  for (const [target, attitude] of Object.entries(flFaction.attitude)) {
    if (attitude >= 2 && !target.startsWith('hex:')) {
      territory.push(target);
    }
  }

  // Extract resource needs from shortage events
  const resourceNeeds: string[] = [];
  for (const event of events) {
    if (event.category === 'faction' && 
        event.summary.includes(flFaction.name) && 
        event.summary.includes('shortage')) {
      const match = event.summary.match(/shortage of (\w+)/i);
      if (match && !resourceNeeds.includes(match[1])) {
        resourceNeeds.push(match[1]);
      }
    }
  }

  // Find enemies from events
  const enemies: string[] = [];
  const allies: string[] = [];

  for (const event of factionEvents) {
    const summary = event.summary.toLowerCase();
    
    // Look for enemy mentions
    if (summary.includes('enemy') || summary.includes('war') || summary.includes('attack')) {
      for (const otherFaction of world.factions) {
        if (otherFaction.id !== flFaction.id && 
            (event.summary.includes(otherFaction.name) || event.actors?.includes(otherFaction.name))) {
          if (!enemies.includes(otherFaction.id)) {
            enemies.push(otherFaction.id);
          }
        }
      }
    }
    
    // Look for ally mentions
    if (summary.includes('ally') || summary.includes('alliance') || summary.includes('unite')) {
      for (const otherFaction of world.factions) {
        if (otherFaction.id !== flFaction.id && 
            (event.summary.includes(otherFaction.name) || event.actors?.includes(otherFaction.name))) {
          if (!allies.includes(otherFaction.id)) {
            allies.push(otherFaction.id);
          }
        }
      }
    }
  }

  // Find last noted location
  let lastNoted: string | undefined;
  for (let i = events.length - 1; i >= 0; i--) {
    const event = events[i];
    if (event.location && 
        (event.summary.includes(flFaction.name) || event.actors?.includes(flFaction.name))) {
      lastNoted = event.location;
      break;
    }
  }

  return {
    id: flFaction.id,
    name: flFaction.name,
    focus: flFaction.focus,
    wealth: flFaction.wealth,
    power: Math.round(power),
    morale,
    territory,
    attitude: flFaction.attitude,
    enemies,
    allies,
    resourceNeeds,
    lastNoted,
  };
}

// ============================================================================
// Build Relationships
// ============================================================================

function buildRelationships(
  factions: WMFaction[],
  relationships: FactionRelationship[]
) {
  // Build relationships from enemies and allies lists
  const processed = new Set<string>();

  for (const faction of factions) {
    // Add enemy relationships
    for (const enemyId of faction.enemies) {
      const key = [faction.id, enemyId].sort().join('-');
      if (!processed.has(key)) {
        processed.add(key);
        relationships.push({
          factionA: faction.id,
          factionB: enemyId,
          status: 'war',
          reason: 'Historical conflict',
        });
      }
    }

    // Add ally relationships
    for (const allyId of faction.allies) {
      const key = [faction.id, allyId].sort().join('-');
      if (!processed.has(key)) {
        processed.add(key);
        relationships.push({
          factionA: faction.id,
          factionB: allyId,
          status: 'allied',
          reason: 'Mutual interests',
        });
      }
    }

    // Add hostile relationships based on conflicting attitudes
    for (const otherFaction of factions) {
      if (otherFaction.id === faction.id) continue;
      
      const key = [faction.id, otherFaction.id].sort().join('-');
      if (processed.has(key)) continue;

      // Check for conflicting territories
      const sharedTerritories = faction.territory.filter(t => 
        otherFaction.territory.includes(t)
      );
      
      if (sharedTerritories.length > 0) {
        processed.add(key);
        relationships.push({
          factionA: faction.id,
          factionB: otherFaction.id,
          status: 'hostile',
          reason: `Competing claims on ${sharedTerritories[0]}`,
        });
      }
    }
  }
}

// ============================================================================
// Extract Operations from Events
// ============================================================================

function extractOperationsFromEvents(
  events: LogEntry[],
  factions: WMFaction[],
  operations: FactionOperation[]
) {
  const factionNames = new Map(factions.map(f => [f.name.toLowerCase(), f.id]));

  for (const event of events) {
    if (event.category !== 'faction') continue;

    const summary = event.summary.toLowerCase();
    let operationType: FactionOperation['type'] | null = null;
    let factionId: string | null = null;
    let target: string = event.location ?? 'unknown';

    // Determine operation type from event summary
    if (summary.includes('raid') || summary.includes('attack') || summary.includes('strike')) {
      operationType = 'raid';
    } else if (summary.includes('patrol') || summary.includes('guard')) {
      operationType = 'patrol';
    } else if (summary.includes('conquest') || summary.includes('conquer') || summary.includes('capture')) {
      operationType = 'conquest';
    } else if (summary.includes('siege') || summary.includes('besiege')) {
      operationType = 'siege';
    } else if (summary.includes('spy') || summary.includes('intelligence') || summary.includes('espionage')) {
      operationType = 'espionage';
    } else if (summary.includes('sabotage') || summary.includes('disrupt')) {
      operationType = 'sabotage';
    } else if (summary.includes('assassination') || summary.includes('murder')) {
      operationType = 'assassination';
    } else if (summary.includes('negotiate') || summary.includes('diplomacy') || summary.includes('treaty')) {
      operationType = 'diplomacy';
    } else if (summary.includes('trade') || summary.includes('merchant') || summary.includes('caravan')) {
      operationType = 'trade_mission';
    } else if (summary.includes('recruit') || summary.includes('rally') || summary.includes('swear allegiance')) {
      operationType = 'recruitment';
    } else if (summary.includes('propaganda') || summary.includes('spread') || summary.includes('whisper')) {
      operationType = 'propaganda';
    }

    if (!operationType) continue;

    // Find which faction this operation belongs to
    for (const [name, id] of factionNames) {
      if (summary.includes(name) || event.actors?.some(a => a.toLowerCase() === name)) {
        factionId = id;
        break;
      }
    }

    if (!factionId) continue;

    // Determine status based on event details
    const status: FactionOperation['status'] = 'complete';
    const eventTime = new Date(event.worldTime).getTime();

    operations.push({
      id: createId(),
      type: operationType,
      target,
      startedAt: eventTime,
      completesAt: eventTime,
      participants: [factionId],
      successChance: 100, // Already happened
      resources: 0,
      secret: summary.includes('secret') || summary.includes('covert') || operationType === 'espionage' || operationType === 'assassination',
      status,
      outcome: event.summary,
    });
  }
}

// ============================================================================
// Extract Faction Log
// ============================================================================

function extractFactionLog(
  events: LogEntry[],
  factions: WMFaction[],
  log: FactionLogEntry[]
) {
  const factionNames = new Map(factions.map(f => [f.name.toLowerCase(), f.id]));

  for (const event of events) {
    if (event.category !== 'faction') continue;

    // Find which faction this log entry belongs to
    let factionId: string | null = null;
    const summary = event.summary.toLowerCase();

    for (const [name, id] of factionNames) {
      if (summary.includes(name) || event.actors?.some(a => a.toLowerCase() === name)) {
        factionId = id;
        break;
      }
    }

    // If no specific faction, assign to first actor or skip
    if (!factionId && event.actors && event.actors.length > 0) {
      const actorName = event.actors[0].toLowerCase();
      factionId = factionNames.get(actorName) ?? null;
    }

    if (!factionId) continue;

    log.push({
      id: createId(),
      timestamp: new Date(event.worldTime).getTime(),
      factionId,
      summary: event.summary,
      details: event.details,
      location: event.location,
    });
  }

  // Sort by timestamp descending (most recent first)
  log.sort((a, b) => b.timestamp - a.timestamp);
}
