/**
 * Fantasy-Log Data Types
 * 
 * These types mirror the fantasy-log project's data structures
 * for parsing world.json and events.jsonl files.
 */

// ============================================================================
// Core Types
// ============================================================================

export type LogCategory = 'town' | 'road' | 'dungeon' | 'faction' | 'weather' | 'system';

export interface LogEntry {
  category: LogCategory;
  summary: string;
  details?: string;
  location?: string;
  actors?: string[];
  worldTime: string; // ISO date string
  realTime: string;
  seed?: string;
}

export type Terrain =
  | 'road'
  | 'clear'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'swamp'
  | 'desert'
  | 'coastal'
  | 'ocean'
  | 'reef'
  | 'river';

export type Good =
  | 'grain' | 'timber' | 'ore' | 'textiles' | 'salt' | 'fish' | 'livestock'
  | 'spices' | 'silk' | 'gems' | 'ivory' | 'wine' | 'dyes';

export type PriceTrend = 'low' | 'normal' | 'high';

export type CharacterClass =
  | 'Cleric'
  | 'Fighter'
  | 'Magic-User'
  | 'Thief'
  | 'Dwarf'
  | 'Elf'
  | 'Halfling'
  | 'Druid'
  | 'Mystic';

// ============================================================================
// World Entities
// ============================================================================

export interface HexCoord {
  q: number;
  r: number;
}

export interface HexTile {
  coord: HexCoord;
  terrain: Terrain;
}

export interface PartyMember {
  name: string;
  class: CharacterClass;
  level: number;
  hp: number;
  maxHp: number;
}

export interface Party {
  id: string;
  name: string;
  members: PartyMember[];
  location: string;
  status: 'idle' | 'travel';
  fatigue?: number;
  wounded?: boolean;
  fame?: number;
  xp: number;
}

export interface Settlement {
  id: string;
  name: string;
  population: number;
  type: 'village' | 'town' | 'city';
  coord: HexCoord;
  supply: Record<Good, number>;
  mood: number;
  priceTrends?: Record<Good, PriceTrend>;
  isPort?: boolean;
  portSize?: 'minor' | 'major' | 'great';
}

export interface Stronghold {
  id: string;
  ownerId: string;
  name: string;
  location: HexCoord;
  type: 'Tower' | 'Keep' | 'Temple' | 'Hideout';
  level: number;
  staff: number;
  constructionFinished: boolean;
  treasury: number;
  unrest: number;
  population: number;
  taxRate: number;
}

export interface Army {
  id: string;
  ownerId: string;
  location: string;
  strength: number;
  quality: number;
  morale: number;
  status: 'idle' | 'marching' | 'besieging' | 'battling' | 'starving' | 'diseased' | 'surrendered';
  supplies: number;
  isMercenary?: boolean;
  costPerMonth?: number;
}

export interface Dungeon {
  id: string;
  name: string;
  coord: HexCoord;
  depth: number;
  danger: number;
  explored?: number;
}

export interface NPC {
  id: string;
  name: string;
  role: 'merchant' | 'guard' | 'scout' | 'priest' | 'bard' | 'laborer';
  class?: CharacterClass;
  level?: number;
  home: string;
  location: string;
  reputation: number;
  fame?: number;
  alive?: boolean;
  wounded?: boolean;
}

export interface Caravan {
  id: string;
  name: string;
  route: [string, string];
  goods: Good[];
  location: string;
  progressHours: number;
  direction: 'outbound' | 'inbound';
  factionId?: string;
}

export interface Faction {
  id: string;
  name: string;
  attitude: Record<string, number>;
  wealth: number;
  focus: 'trade' | 'martial' | 'pious' | 'arcane';
}

export interface Rumor {
  id: string;
  kind: 'dungeon' | 'caravan' | 'monster-sign' | 'omen' | 'feud' | 'mystery';
  text: string;
  target: string;
  origin: string;
  freshness: number;
}

// ============================================================================
// Calendar & Weather
// ============================================================================

export interface CalendarState {
  year: number;
  month: number;
  day: number;
  weather: 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';
  weatherDuration: number;
  moonPhase: 'new' | 'waxing' | 'full' | 'waning';
}

// ============================================================================
// Antagonists & Stories
// ============================================================================

export interface Antagonist {
  id: string;
  name: string;
  epithet: string;
  type: string;
  threat: number;
  territory: string;
  notoriety: number;
  alive: boolean;
  lastSeen?: string;
  minions?: number;
}

export interface StoryThread {
  id: string;
  type: string;
  title: string;
  summary: string;
  phase: string;
  actors: string[];
  location: string;
  tension: number;
  resolved: boolean;
  startedAt: string;
  lastUpdated: string;
}

// ============================================================================
// Full World State
// ============================================================================

export interface FantasyLogWorld {
  schemaVersion?: number;
  seed: string;
  archetype: string;
  hexes: HexTile[];
  width: number;
  height: number;
  settlements: Settlement[];
  parties: Party[];
  roads: Array<[string, string]>;
  dungeons: Dungeon[];
  activeRumors: Rumor[];
  npcs: NPC[];
  caravans: Caravan[];
  factions: Faction[];
  strongholds: Stronghold[];
  armies: Army[];
  startedAt: string;
  lastTickAt?: string;
  
  // Enhanced state
  calendar?: CalendarState;
  antagonists?: Antagonist[];
  storyThreads?: StoryThread[];
}

// ============================================================================
// Import Result Types
// ============================================================================

export interface ImportWarning {
  type: 'info' | 'warning' | 'error';
  message: string;
  entity?: string;
}

export interface ImportSummary {
  parties: number;
  characters: number;
  settlements: number;
  hexes: number;
  dungeons: number;
  armies: number;
  strongholds: number;
  caravans: number;
  factions: number;
  npcs: number;
  events: number;
  goldTransactions: number;
  calendarSynced: boolean;
  warnings: ImportWarning[];
}

