/**
 * Fantasy-Log Sync
 * 
 * Main orchestration module for importing fantasy-log data into war-machine.
 */

import type { FantasyLogWorld, LogEntry, ImportSummary, ImportWarning } from './types';
import type { WarMachineState } from '../../state/schema';
import { parseWorldJson, parseEventsJsonl } from './parser';
import {
  transformParties,
  transformCalendar,
  transformDominion,
  transformWilderness,
  transformSiege,
  transformMerchant,
  transformLedger,
  transformStronghold,
  extractTrackers,
} from './transforms';

export interface SyncOptions {
  /** Import party roster */
  parties: boolean;
  /** Import calendar state */
  calendar: boolean;
  /** Import dominion state from settlements */
  dominion: boolean;
  /** Import wilderness map */
  wilderness: boolean;
  /** Import siege forces from armies */
  siege: boolean;
  /** Import merchant journeys from caravans */
  merchant: boolean;
  /** Import ledger transactions from events */
  ledger: boolean;
  /** Import stronghold projects */
  stronghold: boolean;
}

export const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  parties: true,
  calendar: true,
  dominion: true,
  wilderness: true,
  siege: true,
  merchant: true,
  ledger: true,
  stronghold: true,
};

export interface SyncResult {
  state: Partial<WarMachineState>;
  summary: ImportSummary;
}

/**
 * Synchronize fantasy-log data to war-machine state
 */
export function syncFromFantasyLog(
  worldContent: string | null,
  eventsContent: string | null,
  options: SyncOptions = DEFAULT_SYNC_OPTIONS
): SyncResult {
  const warnings: ImportWarning[] = [];
  const state: Partial<WarMachineState> = {};
  
  // Parse input files
  let world: FantasyLogWorld | null = null;
  let events: LogEntry[] = [];
  
  if (worldContent) {
    const result = parseWorldJson(worldContent);
    world = result.world;
    warnings.push(...result.warnings);
  }
  
  if (eventsContent) {
    const result = parseEventsJsonl(eventsContent);
    events = result.events;
    warnings.push(...result.warnings);
  }
  
  if (!world && events.length === 0) {
    return {
      state: {},
      summary: {
        parties: 0,
        characters: 0,
        settlements: 0,
        hexes: 0,
        dungeons: 0,
        armies: 0,
        strongholds: 0,
        caravans: 0,
        factions: 0,
        npcs: 0,
        events: 0,
        goldTransactions: 0,
        calendarSynced: false,
        warnings: [{
          type: 'error',
          message: 'No valid data found in input files',
        }],
      },
    };
  }
  
  // Create a minimal world if only events provided
  if (!world) {
    world = {
      seed: 'imported',
      archetype: 'Standard',
      hexes: [],
      width: 0,
      height: 0,
      settlements: [],
      parties: [],
      roads: [],
      dungeons: [],
      activeRumors: [],
      npcs: [],
      caravans: [],
      factions: [],
      strongholds: [],
      armies: [],
      startedAt: new Date().toISOString(),
    };
  }
  
  // Track summary
  const summary: ImportSummary = {
    parties: 0,
    characters: 0,
    settlements: 0,
    hexes: 0,
    dungeons: 0,
    armies: 0,
    strongholds: 0,
    caravans: 0,
    factions: 0,
    npcs: 0,
    events: events.length,
    goldTransactions: 0,
    calendarSynced: false,
    warnings,
  };
  
  // Transform each section based on options
  
  if (options.parties && world.parties.length > 0) {
    state.party = transformParties(world.parties);
    summary.parties = world.parties.length;
    summary.characters = state.party.roster.length;
    warnings.push({
      type: 'info',
      message: `Imported ${summary.characters} characters from ${summary.parties} parties`,
    });
  }
  
  if (options.calendar) {
    state.calendar = transformCalendar(world.calendar, world, events);
    // Add trackers from world state
    const trackers = extractTrackers(world);
    state.calendar.trackers = [...state.calendar.trackers, ...trackers];
    summary.calendarSynced = true;
  }
  
  if (options.dominion && world.settlements.length > 0) {
    state.dominion = transformDominion(world);
    summary.settlements = world.settlements.length;
    warnings.push({
      type: 'info',
      message: `Imported ${summary.settlements} settlements (primary: ${state.dominion.name})`,
    });
  }
  
  if (options.wilderness && world.hexes.length > 0) {
    state.wilderness = transformWilderness(world);
    summary.hexes = world.hexes.length;
    summary.dungeons = world.dungeons.length;
    warnings.push({
      type: 'info',
      message: `Imported ${summary.hexes} hexes with ${summary.dungeons} dungeons`,
    });
  }
  
  if (options.siege && world.armies.length > 0) {
    state.siege = transformSiege(world);
    summary.armies = world.armies.length;
    warnings.push({
      type: 'info',
      message: `Imported ${summary.armies} armies`,
    });
  }
  
  if (options.merchant) {
    state.merchant = transformMerchant(world, events);
    summary.caravans = world.caravans.length;
    if (summary.caravans > 0) {
      warnings.push({
        type: 'info',
        message: `Imported ${summary.caravans} caravans as merchant journeys`,
      });
    }
  }
  
  if (options.ledger) {
    state.ledger = transformLedger(events, world);
    summary.goldTransactions = state.ledger.transactions.length;
    if (summary.goldTransactions > 0) {
      warnings.push({
        type: 'info',
        message: `Extracted ${summary.goldTransactions} gold transactions (balance: ${state.ledger.balance}gp)`,
      });
    }
  }
  
  if (options.stronghold) {
    // Check for strongholds in world OR construction events in log
    const hasStrongholds = world.strongholds.length > 0;
    const hasConstructionEvents = events.some(e => 
      e.summary.toLowerCase().includes('construction') && 
      e.summary.toLowerCase().includes('stronghold')
    );
    
    if (hasStrongholds || hasConstructionEvents) {
      state.stronghold = transformStronghold(world, events);
      // Count projects created (may come from events)
      const projectCount = state.stronghold.projects.length;
      summary.strongholds = projectCount;
      warnings.push({
        type: 'info',
        message: `Imported ${projectCount} stronghold${projectCount !== 1 ? 's' : ''} (${hasStrongholds ? 'from world' : 'from events'})`,
      });
    }
  }
  
  // Record additional stats
  summary.factions = world.factions.length;
  summary.npcs = world.npcs.length;
  
  return { state, summary };
}

/**
 * Preview what would be imported without actually doing it
 */
export function previewSync(
  worldContent: string | null,
  eventsContent: string | null
): ImportSummary {
  const result = syncFromFantasyLog(worldContent, eventsContent, DEFAULT_SYNC_OPTIONS);
  return result.summary;
}

/**
 * Merge synced state into existing war-machine state
 */
export function mergeIntoState(
  current: WarMachineState,
  synced: Partial<WarMachineState>
): WarMachineState {
  const merged = { ...current };
  
  if (synced.party) {
    // Merge party rosters - add new characters, don't duplicate
    const existingNames = new Set(
      current.party.roster
        .filter(c => c.name)
        .map(c => c.name.toLowerCase())
    );
    const newCharacters = synced.party.roster.filter(
      c => c.name && !existingNames.has(c.name.toLowerCase())
    );
    
    merged.party = {
      ...current.party,
      roster: [...current.party.roster, ...newCharacters],
      partyResources: {
        loot: current.party.partyResources.loot + synced.party.partyResources.loot,
        torches: current.party.partyResources.torches + synced.party.partyResources.torches,
        rations: current.party.partyResources.rations + synced.party.partyResources.rations,
      },
    };
  }
  
  if (synced.calendar) {
    // Merge calendar - update clock, merge events
    const existingEventIds = new Set(current.calendar.events.map(e => e.label));
    const newEvents = synced.calendar.events.filter(
      e => !existingEventIds.has(e.label)
    );
    
    merged.calendar = {
      clock: synced.calendar.clock,
      trackers: [...current.calendar.trackers, ...synced.calendar.trackers],
      log: [...current.calendar.log, ...synced.calendar.log].slice(-100), // Keep last 100
      events: [...current.calendar.events, ...newEvents],
    };
  }
  
  if (synced.dominion) {
    // Replace dominion entirely (it represents the primary settlement)
    merged.dominion = synced.dominion;
  }
  
  if (synced.wilderness) {
    // Merge wilderness maps - overlay new hexes
    merged.wilderness = {
      ...synced.wilderness,
      map: {
        ...current.wilderness.map,
        ...synced.wilderness.map,
      },
    };
  }
  
  if (synced.siege) {
    // Replace siege state
    merged.siege = synced.siege;
  }
  
  if (synced.merchant) {
    // Merge merchant ledger
    const existingIds = new Set(current.merchant.ledger.map(j => j.eventSummary));
    const newJourneys = synced.merchant.ledger.filter(
      j => !existingIds.has(j.eventSummary)
    );
    
    merged.merchant = {
      ...synced.merchant,
      ledger: [...current.merchant.ledger, ...newJourneys],
    };
  }
  
  if (synced.ledger) {
    // Merge ledger transactions
    const newTransactions = synced.ledger.transactions.filter(
      t => !current.ledger.transactions.some(
        ct => ct.description === t.description && ct.timestamp === t.timestamp
      )
    );
    
    const allTransactions = [...current.ledger.transactions, ...newTransactions]
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Recalculate running balance
    let balance = 0;
    for (const t of allTransactions) {
      balance += t.amount;
      t.balance = balance;
    }
    
    merged.ledger = {
      balance,
      transactions: allTransactions,
      recurringExpenses: current.ledger.recurringExpenses,
    };
  }
  
  if (synced.stronghold) {
    // Merge stronghold projects
    const existingNames = new Set(current.stronghold.projects.map(p => p.name));
    const newProjects = synced.stronghold.projects.filter(
      p => !existingNames.has(p.name)
    );
    
    merged.stronghold = {
      ...synced.stronghold,
      projects: [...current.stronghold.projects, ...newProjects],
      components: synced.stronghold.components.length > 0 
        ? synced.stronghold.components 
        : current.stronghold.components,
    };
  }
  
  return merged;
}

