/**
 * Dominion Transform
 * 
 * Converts fantasy-log settlements and strongholds to war-machine DominionState.
 */

import type { Settlement, Stronghold, FantasyLogWorld, NPC } from '../types';
import type { DominionState, DominionResource, Alignment } from '../../../state/schema';
import { createId } from '../../../utils/id';

/**
 * Map settlement mood (-3 to +3) to confidence (0-600, with 300 as baseline)
 */
function moodToConfidence(mood: number): number {
  // mood -3 = 100, mood 0 = 300, mood +3 = 500
  return Math.max(50, Math.min(600, 300 + mood * 67));
}

/**
 * Estimate families from population
 * BECMI assumes ~5 people per family
 */
function populationToFamilies(population: number): number {
  return Math.max(1, Math.floor(population / 5));
}

/**
 * Extract resources from settlement supply
 */
function extractResources(settlement: Settlement): DominionResource[] {
  const resources: DominionResource[] = [];
  
  // Map goods to resource types
  const goodToType: Record<string, { type: 'Animal' | 'Vegetable' | 'Mineral'; name: string }> = {
    grain: { type: 'Vegetable', name: 'Grain' },
    timber: { type: 'Vegetable', name: 'Timber' },
    ore: { type: 'Mineral', name: 'Iron Ore' },
    textiles: { type: 'Vegetable', name: 'Textiles' },
    salt: { type: 'Mineral', name: 'Salt' },
    fish: { type: 'Animal', name: 'Fish' },
    livestock: { type: 'Animal', name: 'Livestock' },
    gems: { type: 'Mineral', name: 'Gems' },
  };
  
  for (const [good, amount] of Object.entries(settlement.supply)) {
    if (amount > 0 && goodToType[good]) {
      const { type, name } = goodToType[good];
      resources.push({
        id: createId(),
        type,
        name,
        value: Math.min(4, Math.max(1, Math.floor(amount / 25))), // Scale to 1-4
      });
    }
  }
  
  // Ensure at least one of each type if none found
  if (!resources.some(r => r.type === 'Animal')) {
    resources.push({ id: createId(), type: 'Animal', name: 'Livestock', value: 1 });
  }
  if (!resources.some(r => r.type === 'Vegetable')) {
    resources.push({ id: createId(), type: 'Vegetable', name: 'Grain', value: 1 });
  }
  if (!resources.some(r => r.type === 'Mineral')) {
    resources.push({ id: createId(), type: 'Mineral', name: 'Stone', value: 1 });
  }
  
  return resources.slice(0, 6); // Max 6 resources
}

/**
 * Estimate hex count from settlement type
 */
function estimateHexes(settlement: Settlement): number {
  switch (settlement.type) {
    case 'city': return 8;
    case 'town': return 4;
    case 'village': return 2;
    default: return 1;
  }
}

/**
 * Find the best ruler for a settlement from NPCs
 */
function findRuler(settlement: Settlement, npcs: NPC[]): { name: string; alignment: Alignment } {
  // Look for high-reputation NPCs in this settlement
  const localNpcs = npcs.filter(n => 
    n.home === settlement.id || n.location === settlement.name
  );
  
  // Sort by reputation/fame
  localNpcs.sort((a, b) => {
    const scoreA = (a.reputation ?? 0) + (a.fame ?? 0);
    const scoreB = (b.reputation ?? 0) + (b.fame ?? 0);
    return scoreB - scoreA;
  });
  
  if (localNpcs.length > 0) {
    const ruler = localNpcs[0];
    // Infer alignment from reputation
    let alignment: Alignment = 'Neutral';
    if (ruler.reputation > 1) alignment = 'Lawful';
    if (ruler.reputation < -1) alignment = 'Chaotic';
    
    return { name: ruler.name, alignment };
  }
  
  // Generate a default ruler
  const titles = ['Lord', 'Lady', 'Baron', 'Baroness', 'Mayor', 'Reeve'];
  const title = titles[Math.floor(Math.random() * titles.length)];
  
  return {
    name: `${title} of ${settlement.name}`,
    alignment: 'Neutral',
  };
}

/**
 * Transform the primary settlement to a DominionState
 * Uses the largest settlement as the "dominion"
 */
export function transformDominion(world: FantasyLogWorld): DominionState {
  // Find the largest settlement to use as the dominion
  const settlements = [...world.settlements].sort((a, b) => b.population - a.population);
  const primary = settlements[0];
  
  if (!primary) {
    // Return default state if no settlements
    return {
      name: 'Unnamed Dominion',
      ruler: 'Unknown Ruler',
      rulerAlignment: 'Neutral',
      dominionAlignment: 'Neutral',
      liege: 'None',
      vassalCount: 0,
      families: 1000,
      hexes: 4,
      confidence: 300,
      treasury: 5000,
      resources: [
        { id: createId(), type: 'Animal', name: 'Livestock', value: 2 },
        { id: createId(), type: 'Vegetable', name: 'Grain', value: 2 },
        { id: createId(), type: 'Mineral', name: 'Stone', value: 1 },
      ],
      turn: {
        season: 'Spring Start',
        rulerStatus: 'present',
        taxRate: 1,
        holidaySpending: 1000,
        event: 'none',
        expenses: 1500,
        tithePercent: 20,
      },
      log: [],
      activeTrackerId: null,
    };
  }
  
  const ruler = findRuler(primary, world.npcs);
  const families = populationToFamilies(primary.population);
  const confidence = moodToConfidence(primary.mood);
  const hexes = estimateHexes(primary);
  const resources = extractResources(primary);
  
  // Calculate treasury from strongholds in this area
  let treasury = 5000; // Base
  const localStrongholds = world.strongholds.filter(s => 
    s.location.q === primary.coord.q && s.location.r === primary.coord.r
  );
  for (const sh of localStrongholds) {
    treasury += sh.treasury;
  }
  
  // Count vassals (other settlements)
  const vassalCount = Math.max(0, settlements.length - 1);
  
  // Determine alignment from mood
  let dominionAlignment: Alignment = 'Neutral';
  if (primary.mood > 1) dominionAlignment = 'Lawful';
  if (primary.mood < -1) dominionAlignment = 'Chaotic';
  
  // Determine season from calendar or world time
  let season: DominionState['turn']['season'] = 'Spring Start';
  if (world.calendar) {
    const month = world.calendar.month;
    if (month >= 2 && month < 5) season = 'Spring Start';
    else if (month >= 5 && month < 8) season = 'Summer';
    else if (month >= 8 && month < 11) season = 'Autumn';
    else season = 'Winter';
  }
  
  return {
    name: primary.name,
    ruler: ruler.name,
    rulerAlignment: ruler.alignment,
    dominionAlignment,
    liege: 'None',
    vassalCount,
    families,
    hexes,
    confidence,
    treasury,
    resources,
    turn: {
      season,
      rulerStatus: 'present',
      taxRate: 1,
      holidaySpending: Math.floor(families * 1),
      event: 'none',
      expenses: Math.floor(families * 1.5),
      tithePercent: 20,
    },
    log: [],
    activeTrackerId: null,
  };
}

/**
 * Get all settlements as potential vassal dominions (for reference)
 */
export function getSettlementSummary(world: FantasyLogWorld): Array<{
  name: string;
  type: string;
  population: number;
  families: number;
  mood: number;
}> {
  return world.settlements.map(s => ({
    name: s.name,
    type: s.type,
    population: s.population,
    families: populationToFamilies(s.population),
    mood: s.mood,
  }));
}

