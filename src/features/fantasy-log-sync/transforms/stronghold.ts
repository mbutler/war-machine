/**
 * Stronghold Transform
 * 
 * Converts fantasy-log strongholds and construction events to war-machine StrongholdState.
 * When world.json has no strongholds, extracts construction progress from event log.
 * 
 * Uses deterministic randomness based on owner name to generate unique but consistent
 * stronghold configurations for each character.
 */

import type { Stronghold, FantasyLogWorld, LogEntry } from '../types';
import type { StrongholdState, StrongholdProject, StrongholdComponentSelection } from '../../../state/schema';
import { createId } from '../../../utils/id';
import { STRONGHOLD_COMPONENTS } from '../../stronghold/components';

/**
 * Simple seeded random number generator for deterministic variety
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: string) {
    // Hash the string to get a numeric seed
    this.seed = 0;
    for (let i = 0; i < seed.length; i++) {
      this.seed = ((this.seed << 5) - this.seed + seed.charCodeAt(i)) | 0;
    }
    if (this.seed === 0) this.seed = 12345;
  }
  
  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }
  
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

/**
 * Parsed construction event with extracted data
 */
interface ConstructionMention {
  owner: string;
  location: string;
  worldTime: Date;
  details: string;
}

/**
 * Aggregated stronghold construction data from events
 */
interface StrongholdConstruction {
  owner: string;
  location: string;
  firstMention: Date;
  lastMention: Date;
  mentionCount: number;
  phases: Set<string>;
}

// Stronghold archetypes with different component focuses
type StrongholdArchetype = 
  | 'watchtower'      // Minimal, single tower
  | 'fortified_manor' // Tower + stone building + walls
  | 'border_fort'     // Multiple towers, gatehouse, moat
  | 'mountain_keep'   // Keep with towers, heavy defenses
  | 'coastal_hold'    // Round towers, barbican, drawbridge
  | 'woodland_refuge' // Wood buildings, palisade, hidden
  | 'merchant_compound' // Stone buildings, gatehouse, minimal military
  | 'wizard_tower'    // Large tower, dungeon, secret doors
  | 'temple_complex'  // Stone buildings, tower, no moat
  | 'robber_hideout'; // Wood, dungeon, secret passages

/**
 * Parse construction events from the log
 */
function parseConstructionEvents(events: LogEntry[]): ConstructionMention[] {
  const mentions: ConstructionMention[] = [];
  
  for (const event of events) {
    // Match "Construction continues on X's stronghold" pattern
    const match = event.summary.match(/Construction continues on (.+?)(?:'s|'s) stronghold/i);
    if (match) {
      mentions.push({
        owner: event.actors?.[0] ?? match[1],
        location: event.location ?? 'Unknown',
        worldTime: new Date(event.worldTime),
        details: event.details ?? '',
      });
    }
    
    // Also match other construction patterns
    const buildMatch = event.summary.match(/(.+?) (?:begins|starts|continues) (?:building|constructing|work on)/i);
    if (buildMatch && event.category === 'town') {
      mentions.push({
        owner: event.actors?.[0] ?? buildMatch[1],
        location: event.location ?? 'Unknown',
        worldTime: new Date(event.worldTime),
        details: event.details ?? '',
      });
    }
  }
  
  return mentions;
}

/**
 * Aggregate construction mentions into distinct strongholds
 */
function aggregateConstructions(mentions: ConstructionMention[]): StrongholdConstruction[] {
  const byOwner = new Map<string, StrongholdConstruction>();
  
  for (const mention of mentions) {
    const key = mention.owner.toLowerCase();
    const existing = byOwner.get(key);
    
    if (existing) {
      existing.mentionCount++;
      if (mention.worldTime < existing.firstMention) {
        existing.firstMention = mention.worldTime;
      }
      if (mention.worldTime > existing.lastMention) {
        existing.lastMention = mention.worldTime;
      }
      // Track construction phases from details
      if (mention.details.includes('foundation')) existing.phases.add('foundation');
      if (mention.details.includes('walls rise')) existing.phases.add('walls');
      if (mention.details.includes('roof')) existing.phases.add('roof');
      if (mention.details.includes('complete') || mention.details.includes('finished')) {
        existing.phases.add('complete');
      }
    } else {
      const phases = new Set<string>();
      if (mention.details.includes('foundation')) phases.add('foundation');
      if (mention.details.includes('walls rise')) phases.add('walls');
      
      byOwner.set(key, {
        owner: mention.owner,
        location: mention.location,
        firstMention: mention.worldTime,
        lastMention: mention.worldTime,
        mentionCount: 1,
        phases,
      });
    }
  }
  
  return [...byOwner.values()];
}

/**
 * Estimate construction progress (0-100) based on mentions and time
 */
function estimateProgress(construction: StrongholdConstruction): number {
  // Base progress from phases detected
  let phaseProgress = 0;
  if (construction.phases.has('foundation')) phaseProgress = 15;
  if (construction.phases.has('walls')) phaseProgress = 40;
  if (construction.phases.has('roof')) phaseProgress = 75;
  if (construction.phases.has('complete')) phaseProgress = 100;
  
  // Add progress based on number of mentions (more updates = more work done)
  const mentionProgress = Math.min(30, construction.mentionCount * 5);
  
  // Add progress based on time elapsed (assume ~60 days for a small tower)
  const daysElapsed = (construction.lastMention.getTime() - construction.firstMention.getTime()) 
    / (1000 * 60 * 60 * 24);
  const timeProgress = Math.min(30, Math.floor(daysElapsed / 2));
  
  return Math.min(95, Math.max(phaseProgress, mentionProgress + timeProgress));
}

/**
 * Infer terrain modifier based on location name
 */
function inferTerrainMod(location: string): number {
  const loc = location.toLowerCase();
  
  // Mountain/hill locations
  if (loc.includes('mount') || loc.includes('peak') || loc.includes('crag') || 
      loc.includes('cliff') || loc.includes('heights')) {
    return 1.2;
  }
  
  // Forest/hill locations
  if (loc.includes('forest') || loc.includes('wood') || loc.includes('grove') ||
      loc.includes('hill') || loc.includes('vale')) {
    return 1.1;
  }
  
  // Swamp locations
  if (loc.includes('swamp') || loc.includes('marsh') || loc.includes('bog') ||
      loc.includes('fen') || loc.includes('mire')) {
    return 1.2;
  }
  
  // Clear/normal terrain
  return 1.0;
}

/**
 * Determine stronghold archetype based on owner name and location
 */
function inferArchetype(owner: string, location: string, rng: SeededRandom): StrongholdArchetype {
  const ownerLower = owner.toLowerCase();
  const locLower = location.toLowerCase();
  
  // Check for class/role hints in name
  if (ownerLower.includes('mage') || ownerLower.includes('wizard') || 
      ownerLower.includes('sorc') || ownerLower.includes('arch')) {
    return 'wizard_tower';
  }
  
  if (ownerLower.includes('priest') || ownerLower.includes('bishop') || 
      ownerLower.includes('abbot') || ownerLower.includes('temple')) {
    return 'temple_complex';
  }
  
  if (ownerLower.includes('thief') || ownerLower.includes('rogue') || 
      ownerLower.includes('shadow') || ownerLower.includes('bandit')) {
    return 'robber_hideout';
  }
  
  if (ownerLower.includes('merchant') || ownerLower.includes('guild') || 
      ownerLower.includes('trader')) {
    return 'merchant_compound';
  }
  
  // Check location hints
  if (locLower.includes('coast') || locLower.includes('harbor') || 
      locLower.includes('port') || locLower.includes('bay')) {
    return 'coastal_hold';
  }
  
  if (locLower.includes('forest') || locLower.includes('wood') || 
      locLower.includes('grove')) {
    return 'woodland_refuge';
  }
  
  if (locLower.includes('mount') || locLower.includes('peak') || 
      locLower.includes('cliff')) {
    return 'mountain_keep';
  }
  
  if (locLower.includes('border') || locLower.includes('march') || 
      locLower.includes('frontier')) {
    return 'border_fort';
  }
  
  // Random selection from common types based on seed
  const commonTypes: StrongholdArchetype[] = [
    'watchtower',
    'fortified_manor',
    'border_fort',
    'mountain_keep',
    'coastal_hold',
  ];
  
  return rng.pick(commonTypes);
}

/**
 * Generate unique stronghold name based on archetype and owner
 */
function generateStrongholdName(owner: string, archetype: StrongholdArchetype, rng: SeededRandom): string {
  const prefixes: Record<StrongholdArchetype, string[]> = {
    watchtower: ['Watchful', 'Vigilant', 'High', 'Lone', 'Eagle\'s'],
    fortified_manor: ['Ironwood', 'Stonewall', 'Oakheart', 'Greystone', 'Thornfield'],
    border_fort: ['Sentinel', 'Bastion', 'Bulwark', 'Rampart', 'Ward'],
    mountain_keep: ['Cragspire', 'Stonepeak', 'Ironhold', 'Highrock', 'Aerie'],
    coastal_hold: ['Seawatch', 'Tideguard', 'Stormhaven', 'Saltspray', 'Cliffside'],
    woodland_refuge: ['Greenwood', 'Shadeleaf', 'Thornwood', 'Misthollow', 'Fernhall'],
    merchant_compound: ['Goldcrest', 'Coinvault', 'Silvergate', 'Tradewind', 'Fairhaven'],
    wizard_tower: ['Arcane', 'Mystic', 'Starfall', 'Moonspire', 'Runeward'],
    temple_complex: ['Blessed', 'Sacred', 'Holy', 'Divine', 'Hallowed'],
    robber_hideout: ['Shadow', 'Hidden', 'Dark', 'Silent', 'Secret'],
  };
  
  const suffixes: Record<StrongholdArchetype, string[]> = {
    watchtower: ['Tower', 'Spire', 'Watch', 'Post', 'Eyrie'],
    fortified_manor: ['Manor', 'Hall', 'House', 'Estate', 'Lodge'],
    border_fort: ['Fort', 'Keep', 'Fortress', 'Citadel', 'Stronghold'],
    mountain_keep: ['Keep', 'Hold', 'Fastness', 'Citadel', 'Redoubt'],
    coastal_hold: ['Hold', 'Tower', 'Keep', 'Castle', 'Fortress'],
    woodland_refuge: ['Refuge', 'Sanctuary', 'Haven', 'Lodge', 'Retreat'],
    merchant_compound: ['House', 'Compound', 'Manor', 'Hall', 'Estate'],
    wizard_tower: ['Tower', 'Sanctum', 'Spire', 'Citadel', 'Observatory'],
    temple_complex: ['Temple', 'Sanctuary', 'Abbey', 'Priory', 'Shrine'],
    robber_hideout: ['Den', 'Lair', 'Hideout', 'Warren', 'Nest'],
  };
  
  const prefix = rng.pick(prefixes[archetype]);
  const suffix = rng.pick(suffixes[archetype]);
  
  // Sometimes use owner's name in the title
  if (rng.chance(0.3)) {
    const firstName = owner.split(' ')[0];
    return `${firstName}'s ${suffix}`;
  }
  
  return `${prefix} ${suffix}`;
}

/**
 * Generate components based on archetype with variety
 */
function generateComponents(
  archetype: StrongholdArchetype, 
  progress: number, 
  rng: SeededRandom
): StrongholdComponentSelection[] {
  const components: StrongholdComponentSelection[] = [];
  
  // Helper to add component with quantity
  const add = (id: string, qty: number) => {
    if (qty > 0) components.push({ id, qty });
  };
  
  // Progress gates for what's been built
  const hasFoundation = progress >= 15;
  const hasWalls = progress >= 40;
  const hasRoof = progress >= 70;
  const isComplete = progress >= 95;
  
  switch (archetype) {
    case 'watchtower':
      // Simple single tower
      add(rng.pick(['tower_sm', 'tower_md']), 1);
      if (hasWalls && rng.chance(0.5)) add('wall_stone', 1);
      if (isComplete) {
        add('civ_door_rein', rng.nextInt(1, 2));
        add('arrow_slit', rng.nextInt(4, 8));
        if (rng.chance(0.4)) add('window_bar', rng.nextInt(2, 4));
      }
      break;
      
    case 'fortified_manor':
      // Tower + stone building + walls
      add(rng.pick(['tower_sm', 'tower_md']), 1);
      add('bldg_stone', rng.nextInt(1, 2));
      if (hasWalls) add('wall_stone', rng.nextInt(2, 4));
      if (hasRoof) add('gatehouse', 1);
      if (isComplete) {
        add('civ_door_rein', rng.nextInt(2, 4));
        add('arrow_slit', rng.nextInt(6, 12));
        add('shutter', rng.nextInt(4, 8));
        if (rng.chance(0.3)) add('moat_un', rng.nextInt(1, 2));
      }
      break;
      
    case 'border_fort':
      // Multiple towers, gatehouse, moat
      add('tower_sm', rng.nextInt(2, 4));
      if (hasWalls) add('wall_stone', rng.nextInt(4, 6));
      if (hasRoof) {
        add('gatehouse', 1);
        add(rng.chance(0.5) ? 'moat_fill' : 'moat_un', rng.nextInt(2, 4));
        add('drawbridge', 1);
      }
      if (isComplete) {
        add('bldg_stone', rng.nextInt(1, 2));
        add('wall_bl', rng.nextInt(2, 4));
        add('civ_door_iron', rng.nextInt(1, 2));
        add('arrow_slit', rng.nextInt(12, 20));
      }
      break;
      
    case 'mountain_keep':
      // Keep with towers, heavy defenses
      if (hasFoundation) add('keep_sq', 1);
      add('tower_lg', rng.nextInt(1, 2));
      add('tower_sm', rng.nextInt(2, 3));
      if (hasWalls) add('wall_stone', rng.nextInt(4, 8));
      if (hasRoof) {
        add('gatehouse', 1);
        add('rampart', rng.nextInt(2, 4));
      }
      if (isComplete) {
        add('dungeon', rng.nextInt(5, 15));
        add('civ_door_iron', rng.nextInt(2, 4));
        add('arrow_slit', rng.nextInt(15, 25));
        add('wall_bl', rng.nextInt(4, 8));
      }
      break;
      
    case 'coastal_hold':
      // Round towers, barbican, drawbridge
      add(rng.pick(['tower_md', 'tower_lg']), 1);
      add('tower_sm', rng.nextInt(1, 3));
      if (hasWalls) add('wall_stone', rng.nextInt(3, 5));
      if (hasRoof) {
        add('barbican', 1);
        add('drawbridge', 1);
        add('moat_fill', rng.nextInt(2, 4));
      }
      if (isComplete) {
        add('bldg_stone', rng.nextInt(1, 2));
        add('arrow_slit', rng.nextInt(10, 16));
        add('window_bar', rng.nextInt(4, 8));
      }
      break;
      
    case 'woodland_refuge':
      // Wood buildings, palisade, hidden
      add('bldg_wood', rng.nextInt(2, 4));
      if (hasWalls) add('palisade', rng.nextInt(4, 8));
      if (hasRoof) {
        add('tower_sm', 1);
        add('trap_door', rng.nextInt(1, 3));
      }
      if (isComplete) {
        add('civ_door_wood', rng.nextInt(4, 8));
        add('shutter', rng.nextInt(6, 12));
        add('dungeon', rng.nextInt(2, 5));
      }
      break;
      
    case 'merchant_compound':
      // Stone buildings, gatehouse, minimal military
      add('bldg_stone', rng.nextInt(2, 4));
      if (hasWalls) add('wall_stone', rng.nextInt(2, 4));
      if (hasRoof) add('gatehouse', 1);
      if (isComplete) {
        add('civ_door_rein', rng.nextInt(4, 8));
        add('window_bar', rng.nextInt(6, 10));
        add('shutter', rng.nextInt(4, 8));
        if (rng.chance(0.4)) add('tower_sm', 1);
      }
      break;
      
    case 'wizard_tower':
      // Large tower, dungeon, secret doors
      add(rng.pick(['tower_lg', 'tower_sq']), 1);
      if (hasWalls) {
        add('wall_stone', rng.nextInt(1, 2));
        add('dungeon', rng.nextInt(5, 15));
      }
      if (hasRoof) {
        add('bldg_stone', 1);
        add('trap_door', rng.nextInt(2, 5));
      }
      if (isComplete) {
        add('civ_door_iron', rng.nextInt(2, 4));
        add('arrow_slit', rng.nextInt(4, 8));
        add('window_bar', rng.nextInt(6, 10));
      }
      break;
      
    case 'temple_complex':
      // Stone buildings, tower, no moat
      add('bldg_stone', rng.nextInt(2, 4));
      add('tower_sm', 1);
      if (hasWalls) add('wall_stone', rng.nextInt(2, 4));
      if (hasRoof) add('gatehouse', 1);
      if (isComplete) {
        add('civ_door_rein', rng.nextInt(4, 6));
        add('shutter', rng.nextInt(8, 14));
        add('window_bar', rng.nextInt(4, 8));
      }
      break;
      
    case 'robber_hideout':
      // Wood, dungeon, secret passages
      add('bldg_wood', rng.nextInt(1, 2));
      if (hasWalls) {
        add('palisade', rng.nextInt(2, 4));
        add('dungeon', rng.nextInt(10, 20));
      }
      if (hasRoof) {
        add('trap_door', rng.nextInt(3, 6));
      }
      if (isComplete) {
        add('civ_door_wood', rng.nextInt(2, 4));
        add('civ_door_iron', rng.nextInt(1, 2));
        add('arrow_slit', rng.nextInt(4, 8));
      }
      break;
  }
  
  return components;
}

/**
 * Calculate total cost from components
 */
function calculateComponentCost(components: StrongholdComponentSelection[]): number {
  let total = 0;
  for (const comp of components) {
    const def = STRONGHOLD_COMPONENTS.find(c => c.id === comp.id);
    if (def) {
      total += def.cost * comp.qty;
    }
  }
  return total;
}

/**
 * Calculate build days based on cost (BECMI: 1 day per 500gp)
 */
function calculateBuildDays(cost: number): number {
  return Math.ceil(cost / 500);
}

/**
 * Extended project with component data for variety
 */
interface ExtendedProject extends StrongholdProject {
  components: StrongholdComponentSelection[];
  terrainMod: number;
  archetype: StrongholdArchetype;
}

/**
 * Transform a world.json stronghold to an extended project
 */
function worldStrongholdToProject(stronghold: Stronghold): ExtendedProject {
  const rng = new SeededRandom(stronghold.name + stronghold.ownerId);
  
  // Map stronghold type to archetype
  const typeToArchetype: Record<string, StrongholdArchetype> = {
    'Tower': rng.pick(['watchtower', 'wizard_tower', 'fortified_manor']),
    'Keep': rng.pick(['mountain_keep', 'border_fort', 'coastal_hold']),
    'Temple': 'temple_complex',
    'Hideout': 'robber_hideout',
  };
  
  const archetype = typeToArchetype[stronghold.type] ?? 'fortified_manor';
  const progress = stronghold.constructionFinished ? 100 : 50 + rng.nextInt(0, 30);
  const terrainMod = inferTerrainMod(stronghold.name);
  const components = generateComponents(archetype, progress, rng);
  const baseCost = calculateComponentCost(components);
  const cost = Math.round(baseCost * terrainMod * stronghold.level);
  const buildDays = calculateBuildDays(cost);
  
  return {
    id: createId(),
    name: stronghold.name,
    cost,
    status: stronghold.constructionFinished ? 'complete' : 'active',
    buildDays,
    startedAt: Date.now() - (stronghold.constructionFinished ? buildDays * 24 * 60 * 60 * 1000 : 0),
    completedAt: stronghold.constructionFinished ? Date.now() : null,
    trackerId: null,
    components,
    terrainMod,
    archetype,
  };
}

/**
 * Transform a construction from events to an extended project
 */
function constructionToProject(construction: StrongholdConstruction): ExtendedProject {
  const rng = new SeededRandom(construction.owner + construction.location);
  const archetype = inferArchetype(construction.owner, construction.location, rng);
  const progress = estimateProgress(construction);
  const terrainMod = inferTerrainMod(construction.location);
  const name = generateStrongholdName(construction.owner, archetype, rng);
  const components = generateComponents(archetype, progress, rng);
  const baseCost = calculateComponentCost(components);
  const cost = Math.round(baseCost * terrainMod);
  const buildDays = calculateBuildDays(cost);
  const startedAt = construction.firstMention.getTime();
  
  return {
    id: createId(),
    name,
    cost,
    status: progress >= 100 ? 'complete' : 'active',
    buildDays,
    startedAt,
    completedAt: progress >= 100 ? construction.lastMention.getTime() : null,
    trackerId: null,
    components,
    terrainMod,
    archetype,
  };
}

/**
 * Transform strongholds to StrongholdState
 */
export function transformStronghold(world: FantasyLogWorld, events: LogEntry[]): StrongholdState {
  // Collect extended projects from both sources
  let extendedProjects: ExtendedProject[] = [];
  
  // First, check if world.json has stronghold data
  if (world.strongholds.length > 0) {
    const strongholds = [...world.strongholds].sort((a, b) => b.level - a.level);
    extendedProjects = strongholds.map(worldStrongholdToProject);
  }
  
  // Also extract from events (may add more or supplement)
  const mentions = parseConstructionEvents(events);
  if (mentions.length > 0) {
    const constructions = aggregateConstructions(mentions);
    
    // Only add constructions that don't already have a matching project
    const existingOwners = new Set(
      world.strongholds.map(s => s.ownerId.toLowerCase())
    );
    
    for (const construction of constructions) {
      if (!existingOwners.has(construction.owner.toLowerCase())) {
        extendedProjects.push(constructionToProject(construction));
      }
    }
  }
  
  // If no projects found at all
  if (extendedProjects.length === 0) {
    return {
      projectName: 'New Stronghold',
      terrainMod: 1,
      components: [],
      projects: [],
      activeProjectId: null,
      activeTrackerId: null,
    };
  }
  
  // Sort by cost (largest first) to pick the "primary" one
  extendedProjects.sort((a, b) => b.cost - a.cost);
  
  // Convert extended projects to standard projects for storage
  const projects: StrongholdProject[] = extendedProjects.map(ep => ({
    id: ep.id,
    name: ep.name,
    cost: ep.cost,
    status: ep.status,
    buildDays: ep.buildDays,
    startedAt: ep.startedAt,
    completedAt: ep.completedAt,
    trackerId: ep.trackerId,
  }));
  
  // Primary stronghold is the largest one
  const primary = extendedProjects[0];
  
  // Find active project (prefer to select an active one)
  const activeProject = projects.find(p => p.status === 'active') ?? projects[0];
  
  return {
    projectName: primary.name,
    terrainMod: primary.terrainMod,
    components: primary.components,
    projects,
    activeProjectId: activeProject?.id ?? null,
    activeTrackerId: null,
  };
}

/**
 * Get stronghold summary for reference
 */
export function getStrongholdSummary(world: FantasyLogWorld): Array<{
  name: string;
  type: string;
  level: number;
  owner: string;
  finished: boolean;
  treasury: number;
}> {
  return world.strongholds.map(s => ({
    name: s.name,
    type: s.type,
    level: s.level,
    owner: s.ownerId,
    finished: s.constructionFinished,
    treasury: s.treasury,
  }));
}

/**
 * Get construction progress from events (for debugging/display)
 */
export function getConstructionProgress(events: LogEntry[]): Array<{
  owner: string;
  location: string;
  mentionCount: number;
  progress: number;
  phases: string[];
}> {
  const mentions = parseConstructionEvents(events);
  const constructions = aggregateConstructions(mentions);
  
  return constructions.map(c => ({
    owner: c.owner,
    location: c.location,
    mentionCount: c.mentionCount,
    progress: estimateProgress(c),
    phases: [...c.phases],
  }));
}
