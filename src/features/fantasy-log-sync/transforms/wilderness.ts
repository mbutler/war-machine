/**
 * Wilderness Transform
 * 
 * Converts fantasy-log hex map to war-machine WildernessState.
 */

import type { HexTile, Terrain, FantasyLogWorld, Settlement, Dungeon } from '../types';
import type { 
  WildernessState, 
  WildernessHex, 
  WildernessTerrainType,
  DominionResourceType 
} from '../../../state/schema';
import { createId } from '../../../utils/id';

/**
 * Map fantasy-log terrain to war-machine terrain
 */
function mapTerrain(terrain: Terrain): WildernessTerrainType {
  const mapping: Record<Terrain, WildernessTerrainType> = {
    'road': 'clear', // Road is treated as clear with feature
    'clear': 'clear',
    'forest': 'woods',
    'hills': 'hills',
    'mountains': 'mountain',
    'swamp': 'swamp',
    'desert': 'desert',
    'coastal': 'clear', // Coastal is clear near ocean
    'ocean': 'ocean',
    'reef': 'ocean', // Reef is dangerous ocean
    'river': 'river',
  };
  return mapping[terrain] ?? 'clear';
}

/**
 * Generate resources for a hex based on terrain
 */
function terrainResources(terrain: WildernessTerrainType): DominionResourceType[] {
  const resourceMap: Record<WildernessTerrainType, DominionResourceType[]> = {
    'clear': ['Vegetable', 'Animal'],
    'woods': ['Vegetable', 'Animal'],
    'hills': ['Mineral', 'Animal'],
    'mountain': ['Mineral'],
    'swamp': ['Vegetable'],
    'desert': [],
    'city': ['Vegetable', 'Animal', 'Mineral'],
    'river': ['Animal'],
    'ocean': ['Animal'],
  };
  return resourceMap[terrain] ?? [];
}

/**
 * Generate a hex key from coordinates
 */
function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

/**
 * Transform hex map from fantasy-log to war-machine format
 */
export function transformWilderness(world: FantasyLogWorld): WildernessState {
  const map: Record<string, WildernessHex> = {};
  
  // Process all hexes
  for (const hex of world.hexes) {
    const { q, r } = hex.coord;
    const key = hexKey(q, r);
    const terrain = mapTerrain(hex.terrain);
    
    // Check for settlements at this location
    const settlement = world.settlements.find(s => 
      s.coord.q === q && s.coord.r === r
    );
    
    // Check for dungeons at this location
    const dungeon = world.dungeons.find(d => 
      d.coord.q === q && d.coord.r === r
    );
    
    let feature: string | null = null;
    let details: string | null = null;
    
    if (settlement) {
      feature = settlement.name;
      details = `${capitalize(settlement.type)} (pop. ${settlement.population})`;
    } else if (dungeon) {
      feature = dungeon.name;
      details = `Dungeon (danger ${dungeon.danger}, depth ${dungeon.depth})`;
    } else if (hex.terrain === 'road') {
      feature = 'Road';
      details = 'Well-traveled path';
    } else if (hex.terrain === 'reef') {
      feature = 'Reef';
      details = 'Dangerous waters';
    } else if (hex.terrain === 'coastal') {
      feature = 'Coast';
      details = 'Land meets sea';
    }
    
    // Determine if visited (has settlement or dungeon = known)
    const visited = settlement !== undefined || dungeon !== undefined;
    
    map[key] = {
      type: settlement ? 'city' : terrain,
      resources: terrainResources(terrain),
      feature,
      details,
      visited,
    };
  }
  
  // Ensure starting position exists
  if (!map['0,0']) {
    map['0,0'] = {
      type: 'clear',
      resources: [],
      feature: 'Start',
      details: 'Starting location',
      visited: true,
    };
  }
  
  // Find the "center" of the map as current position
  // Prefer a settlement if available
  let startPos = { q: 0, r: 0 };
  if (world.settlements.length > 0) {
    const primary = world.settlements.sort((a, b) => b.population - a.population)[0];
    startPos = { q: primary.coord.q, r: primary.coord.r };
  }
  
  // Determine weather from calendar
  let weather: WildernessState['weather'] = {
    temperature: 'Moderate',
    wind: 'Breeze',
    precipitation: 'None',
  };
  
  if (world.calendar) {
    const w = world.calendar.weather;
    weather = {
      temperature: w === 'snow' ? 'Cold' : w === 'storm' ? 'Cool' : 'Moderate',
      wind: w === 'storm' ? 'Gale' : w === 'rain' ? 'Gusty' : 'Breeze',
      precipitation: w === 'rain' || w === 'storm' ? 'Rain' : w === 'snow' ? 'Snow' : 'None',
    };
  }
  
  // Determine climate from season/month
  let climate: WildernessState['climate'] = 'normal';
  if (world.calendar) {
    const month = world.calendar.month;
    if (month >= 11 || month <= 1) climate = 'cold';
    else if (month >= 5 && month <= 7) climate = 'normal';
  }
  
  return {
    map,
    currentPos: startPos,
    camera: { x: 0, y: 0 },
    days: 0,
    movementPoints: 24,
    maxMovementPoints: 24,
    partySize: world.parties.reduce((sum, p) => sum + p.members.length, 0) || 5,
    rations: 35,
    water: 35,
    startTerrain: 'city',
    climate,
    weather,
    log: [],
    staticMapMode: false,
    status: 'idle',
  };
}

/**
 * Capitalize first letter
 */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Get dungeon entries for reference
 */
export function getDungeonSummary(world: FantasyLogWorld): Array<{
  name: string;
  location: string;
  danger: number;
  depth: number;
  explored: number;
}> {
  return world.dungeons.map(d => ({
    name: d.name,
    location: `${d.coord.q},${d.coord.r}`,
    danger: d.danger,
    depth: d.depth,
    explored: d.explored ?? 0,
  }));
}

