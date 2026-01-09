/**
 * Siege Transform
 * 
 * Converts fantasy-log armies to war-machine SiegeState forces.
 */

import type { Army, Faction, FantasyLogWorld } from '../types';
import type { SiegeState, SiegeForce, SiegeQuality, FatigueLevel } from '../../../state/schema';
import { createDefaultSiegeState } from '../../../state/schema';

/**
 * Map army quality (1-10) to siege quality (5, 10, 15)
 */
function mapQuality(quality: number): SiegeQuality {
  if (quality >= 7) return 15;
  if (quality >= 4) return 10;
  return 5;
}

/**
 * Map army status to fatigue
 */
function mapFatigue(status: Army['status']): FatigueLevel {
  switch (status) {
    case 'starving':
    case 'diseased':
      return 'serious';
    case 'battling':
    case 'besieging':
    case 'marching':
      return 'moderate';
    default:
      return 'none';
  }
}

/**
 * Estimate leader level from army quality and strength
 */
function estimateLeaderLevel(army: Army): number {
  // Larger, higher quality armies tend to have higher level leaders
  const sizeBonus = Math.floor(army.strength / 200);
  const qualityBonus = army.quality;
  return Math.min(20, Math.max(1, sizeBonus + qualityBonus));
}

/**
 * Transform an army to a SiegeForce
 */
function armyToForce(army: Army, factions: Faction[]): SiegeForce {
  const faction = factions.find(f => f.id === army.ownerId);
  const isMartial = faction?.focus === 'martial';
  const isPious = faction?.focus === 'pious';
  const isArcane = faction?.focus === 'arcane';
  
  const leaderLevel = estimateLeaderLevel(army);
  
  return {
    name: faction?.name ?? `Army ${army.id.slice(0, 6)}`,
    troops: army.strength,
    leaderLevel,
    leaderStatBonus: Math.floor(leaderLevel / 4),
    percentNamed: Math.min(15, Math.max(1, Math.floor(army.quality / 2))),
    avgOfficerLevel: Math.max(1, Math.floor(leaderLevel / 2)),
    avgTroopLevel: Math.max(1, Math.floor(army.quality / 3)),
    victories: 0, // Unknown from log
    trainingWeeks: army.quality * 2,
    quality: mapQuality(army.quality),
    ac5: army.quality >= 7,
    elfOrDwarf: false, // Could infer from faction name
    mounts: isMartial && army.quality >= 5,
    missiles: army.quality >= 4,
    magic: isArcane || (isPious && army.quality >= 6),
    flyers: isArcane && army.quality >= 8,
    fatigue: mapFatigue(army.status),
    siegeEngines: {
      ltCatapult: 0,
      hvCatapult: 0,
      ram: army.status === 'besieging' ? 1 : 0,
      tower: 0,
      ballista: Math.floor(army.strength / 200),
      timberFort: 0,
      mantlet: 0,
      ladder: army.status === 'besieging' ? Math.floor(army.strength / 100) : 0,
      hoist: 0,
      belfry: 0,
      gallery: 0,
    },
    treasury: faction?.wealth ?? 10000,
    ammunition: {
      ltCatapult: 0,
      hvCatapult: 0,
      ballista: Math.floor(army.strength / 200) * 8,
    },
    rations: Math.floor(army.supplies * army.strength / 10),
    clerics: isPious ? Math.max(1, Math.floor(army.strength / 100)) : 0,
  };
}

/**
 * Transform armies to SiegeState
 * Takes the two largest opposing armies if available
 */
export function transformSiege(world: FantasyLogWorld): SiegeState {
  const armies = [...world.armies].sort((a, b) => b.strength - a.strength);
  
  if (armies.length === 0) {
    return createDefaultSiegeState();
  }
  
  // Find armies that might be opposed (different owners, or one besieging)
  let attacker: Army | undefined;
  let defender: Army | undefined;
  
  // First, look for a besieging army
  const besieging = armies.find(a => a.status === 'besieging');
  if (besieging) {
    attacker = besieging;
    // Defender is at the same location with different owner
    defender = armies.find(a => 
      a.location === besieging.location && 
      a.ownerId !== besieging.ownerId
    );
  }
  
  // If no siege in progress, just use the two largest armies
  if (!attacker && armies.length >= 2) {
    attacker = armies[0];
    defender = armies[1];
  } else if (!attacker && armies.length === 1) {
    attacker = armies[0];
  }
  
  const state = createDefaultSiegeState();
  
  if (attacker) {
    state.attacker = armyToForce(attacker, world.factions);
  }
  
  if (defender) {
    state.defender = armyToForce(defender, world.factions);
  }
  
  // Update fortification if there's a stronghold at defender location
  if (defender) {
    const stronghold = world.strongholds.find(s => {
      const locKey = `hex:${s.location.q},${s.location.r}`;
      return locKey === defender!.location || s.name === defender!.location;
    });
    
    if (stronghold) {
      state.fortification = {
        name: stronghold.name,
        walls: {
          length: 200 + stronghold.level * 100,
          height: 15 + stronghold.level * 5,
          thickness: 5 + stronghold.level * 2,
          hp: 500 + stronghold.level * 500,
          maxHp: 500 + stronghold.level * 500,
        },
        towers: {
          count: stronghold.level * 2,
          hp: 150 + stronghold.level * 50,
          maxHp: 150 + stronghold.level * 50,
        },
        gates: {
          count: 1,
          hp: 100 + stronghold.level * 25,
          maxHp: 100 + stronghold.level * 25,
        },
        moat: stronghold.level >= 2,
        drawbridge: stronghold.level >= 2,
      };
    }
  }
  
  // Set phase based on status
  if (attacker?.status === 'besieging') {
    state.turn.phase = 'tactics';
    state.tactics.attacker = 'harass';
    state.tactics.defender = 'harass';
  }
  
  return state;
}

/**
 * Get army summary for reference
 */
export function getArmySummary(world: FantasyLogWorld): Array<{
  id: string;
  owner: string;
  location: string;
  strength: number;
  quality: number;
  status: string;
}> {
  return world.armies.map(a => ({
    id: a.id,
    owner: world.factions.find(f => f.id === a.ownerId)?.name ?? a.ownerId,
    location: a.location,
    strength: a.strength,
    quality: a.quality,
    status: a.status,
  }));
}

