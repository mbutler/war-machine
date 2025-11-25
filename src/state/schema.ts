import { INITIAL_MERCHANT_STATE } from "./initialMerchant";

export const STATE_VERSION = "1.0.0";

export type Alignment = "Lawful" | "Neutral" | "Chaotic";

export interface AbilityScores {
  str: number;
  int: number;
  wis: number;
  dex: number;
  con: number;
  cha: number;
}

export interface HitPoints {
  current: number;
  max: number;
}

export interface SavingThrowBlock {
  deathPoison: number;
  wands: number;
  paraStone: number;
  breath: number;
  spells: number;
}

export type SpellTier = "1st" | "2nd" | "3rd" | "4th" | "5th" | "6th" | "7th" | "8th" | "9th";

export interface SpellEntry {
  name: string;
  level: number;
  memorized?: boolean;
  expended?: boolean;
}

export type SpellSlotMap = Record<SpellTier, number>;

export interface SpellBook {
  slots: SpellSlotMap;
  known: SpellEntry[];
}

export interface ThiefSkillBlock {
  pickLocks: number;
  findTraps: number;
  removeTraps: number;
  climbWalls: number;
  moveSilently: number;
  hideInShadows: number;
  pickPockets: number;
  detectNoise: number;
  readLanguages: number;
}

export interface EquipmentPack {
  weapon: string;
  armor: string;
  shield: string | null;
  pack: string[];
  gold: number;
}

export interface Retainer {
  id: string;
  name: string;
  class: string;
  level: number;
  hp: HitPoints;
  morale: number;
  wage: number;
  ac: number;
  thac0: number;
  equipment: string;
}

export type CharacterStatus = "alive" | "dead";

export interface Character {
  id: string;
  name: string;
  race: string;
  classKey: string;
  className: string;
  level: number;
  alignment: Alignment;
  abilityScores: AbilityScores;
  derivedStats: {
    hp: HitPoints;
    ac: number;
    thac0: number;
    savingThrows: SavingThrowBlock;
  };
  spells: SpellBook;
  thiefSkills?: ThiefSkillBlock | null;
  equipment: EquipmentPack;
  retainers: Retainer[];
  maxRetainers: number;
  retainerMorale: number;
  status: CharacterStatus;
  notes?: string;
}

export interface PartyResources {
  bankedGold: number;
  loot: number;
  torches: number;
  rations: number;
}

export interface PartyPreferences {
  defaultSize: number;
  defaultLevel: number;
  method: "strict" | "heroic";
}

export interface PartyState {
  roster: Character[];
  preferences: PartyPreferences;
  partyResources: PartyResources;
}

export type DominionResourceType = "Animal" | "Vegetable" | "Mineral";

export interface DominionResource {
  id: string;
  type: DominionResourceType;
  name: string;
  value: number;
}

export type DominionSeason = "Spring Start" | "Summer" | "Autumn" | "Winter" | "Year End";
export type DominionEventType = "none" | "festival" | "good" | "bad" | "calamity" | "random";
export type DominionRulerStatus = "present" | "advisor" | "absent";

export interface DominionTurnSettings {
  season: DominionSeason;
  rulerStatus: DominionRulerStatus;
  taxRate: number;
  holidaySpending: number;
  event: DominionEventType;
  expenses: number;
  tithePercent: number;
}

export interface DominionLogEntry {
  id: string;
  timestamp: number;
  season: DominionSeason;
  eventLabel: string;
  incomeDelta: number;
  confidenceDelta: number;
  finalConfidence: number;
  treasuryAfter: number;
  populationDelta: number;
  familiesAfter: number;
  factors: string[];
}

export interface DominionState {
  name: string;
  ruler: string;
  rulerAlignment: Alignment;
  dominionAlignment: Alignment;
  liege: string;
  vassalCount: number;
  families: number;
  hexes: number;
  confidence: number;
  treasury: number;
  resources: DominionResource[];
  turn: DominionTurnSettings;
  log: DominionLogEntry[];
}

export type WildernessTerrainType =
  | "clear"
  | "woods"
  | "hills"
  | "mountain"
  | "swamp"
  | "desert"
  | "city"
  | "river"
  | "ocean";

export type WildernessClimate = "normal" | "cold" | "tropic" | "desert";

export interface WildernessHex {
  type: WildernessTerrainType;
  resources: DominionResourceType[];
  feature?: string | null;
  details?: string | null;
  color?: string;
  visited: boolean;
}

export interface WildernessLogEntry {
  id: string;
  timestamp: number;
  day: number;
  position: { q: number; r: number };
  terrain: WildernessTerrainType;
  summary: string;
  notes?: string;
}

export interface WildernessState {
  map: Record<string, WildernessHex>;
  currentPos: { q: number; r: number };
  camera: { x: number; y: number };
  days: number;
  movementPoints: number;
  maxMovementPoints: number;
  partySize: number;
  rations: number;
  water: number;
  startTerrain: WildernessTerrainType;
  climate: WildernessClimate;
  weather: {
    temperature: string;
    wind: string;
    precipitation: string;
  };
  log: WildernessLogEntry[];
}

export interface CalendarEvent {
  id: string;
  label: string;
  date: string;
  notes?: string;
}

export interface CalendarClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export interface CalendarTracker {
  id: string;
  name: string;
  remainingMinutes: number;
  initialMinutes: number;
}

export interface CalendarLogEntry {
  id: string;
  timestamp: number;
  action: string;
  detail?: string;
}

export interface CalendarState {
  clock: CalendarClock;
  trackers: CalendarTracker[];
  log: CalendarLogEntry[];
  events: CalendarEvent[];
}

export interface SiegeScenario {
  id: string;
  name: string;
  attackerRating: number;
  defenderRating: number;
  notes?: string;
}

export interface SiegeState {
  scenarios: SiegeScenario[];
}

export type TradeGoodKey = "food" | "metal" | "cloth" | "wood" | "spice" | "wine" | "weapons" | "gems";
export type TerrainKey = "plains" | "forest" | "hills" | "mountains" | "desert" | "swamp" | "coast";
export type TransportType = "wagon" | "ship" | "camel";
export type GuardLevel = "none" | "light" | "standard" | "heavy";
export type GuildStatus = "none" | "member" | "master";
export type MarketCondition = "normal" | "festival" | "siege" | "oversupply";

export interface MerchantFormState {
  houseName: string;
  treasury: number;
  tradeGood: TradeGoodKey;
  cargoValue: number;
  originTerrain: TerrainKey;
  destinationTerrain: TerrainKey;
  distance: number;
  transport: TransportType;
  guardLevel: GuardLevel;
  guildStatus: GuildStatus;
  borderCrossings: number;
  marketCondition: MarketCondition;
}

export interface MerchantJourney {
  id: string;
  timestamp: number;
  tradeGood: TradeGoodKey;
  cargoValue: number;
  salePrice: number;
  totalCosts: number;
  netProfit: number;
  eventSummary: string;
  marketSummary: string;
  details?: string;
}

export interface MerchantLogisticsPreview {
  valid: boolean;
  units: number;
  vehicles: number;
  transportCost: number;
  guardCost: number;
  borderTax: number;
  demandModifier: number;
  salePrice: number;
  profitMargin: number;
  profitGp: number;
  description: string;
}

export interface MerchantState {
  form: MerchantFormState;
  preview: MerchantLogisticsPreview;
  ledger: MerchantJourney[];
}

export interface StrongholdProject {
  id: string;
  name: string;
  cost: number;
  status: "planned" | "active" | "complete";
}

export interface StrongholdState {
  projects: StrongholdProject[];
}

export interface TreasureHoard {
  id: string;
  label: string;
  totalValue: number;
}

export interface TreasureState {
  hoards: TreasureHoard[];
}

export interface LabProject {
  id: string;
  name: string;
  category: string;
  status: "idea" | "in-progress" | "complete";
}

export interface LabState {
  projects: LabProject[];
}

export type DungeonStatus = "idle" | "encounter" | "obstacle" | "loot";

export interface DungeonEncounter {
  id: string;
  name: string;
  quantity: string;
  hitDice: number;
  armorClass: number;
  damage: string;
  morale: number;
  treasureType: string;
  hp: number;
  hpMax: number;
  reaction: "hostile" | "neutral" | "friendly";
  spellsCasterIds?: string[];
  moraleCheck?: boolean;
}

export interface DungeonObstacle {
  id: string;
  name: string;
  description: string;
}

export interface DungeonLogEntry {
  id: string;
  timestamp: number;
  kind: "explore" | "search" | "rest" | "loot" | "combat" | "event";
  summary: string;
  detail?: string;
}

export interface DungeonState {
  turn: number;
  depth: number;
  torches: number;
  rations: number;
  loot: number;
  bankedGold: number;
  lairMode: boolean;
  status: DungeonStatus;
  encounter?: DungeonEncounter;
  obstacle?: DungeonObstacle;
  log: DungeonLogEntry[];
}

export interface WarMachineState {
  meta: {
    version: string;
    lastUpdated: number;
  };
  party: PartyState;
  dominion: DominionState;
  wilderness: WildernessState;
  calendar: CalendarState;
  siege: SiegeState;
  merchant: MerchantState;
  stronghold: StrongholdState;
  treasure: TreasureState;
  lab: LabState;
  dungeon: DungeonState;
}

export const DEFAULT_STATE: WarMachineState = {
  meta: {
    version: STATE_VERSION,
    lastUpdated: 0,
  },
  party: {
    roster: [],
    preferences: {
      defaultSize: 4,
      defaultLevel: 1,
      method: "strict",
    },
    partyResources: {
      bankedGold: 0,
      loot: 0,
      torches: 0,
      rations: 0,
    },
  },
  dominion: {
    name: "Unnamed Dominion",
    ruler: "Unknown Ruler",
    rulerAlignment: "Neutral",
    dominionAlignment: "Neutral",
    liege: "None",
    vassalCount: 0,
    families: 1000,
    hexes: 4,
    confidence: 300,
    treasury: 5000,
    resources: [
      { id: "res-animal", type: "Animal", name: "Livestock", value: 2 },
      { id: "res-veg", type: "Vegetable", name: "Grain", value: 2 },
      { id: "res-min", type: "Mineral", name: "Stone", value: 1 },
    ],
    turn: {
      season: "Spring Start",
      rulerStatus: "present",
      taxRate: 10,
      holidaySpending: 1000,
      event: "none",
      expenses: 1500,
      tithePercent: 20,
    },
    log: [],
  },
  wilderness: {
    map: {
      "0,0": {
        type: "clear",
        resources: [],
        feature: "Start",
        details: "Safe Haven",
        visited: true,
      },
    },
    currentPos: { q: 0, r: 0 },
    camera: { x: 0, y: 0 },
    days: 0,
    movementPoints: 24,
    maxMovementPoints: 24,
    partySize: 6,
    rations: 42,
    water: 42,
    startTerrain: "clear",
    climate: "normal",
    weather: {
      temperature: "Moderate",
      wind: "Breeze",
      precipitation: "None",
    },
    log: [],
  },
  calendar: {
    clock: {
      year: 1000,
      month: 0,
      day: 1,
      hour: 8,
      minute: 0,
    },
    trackers: [],
    log: [],
    events: [],
  },
  siege: {
    scenarios: [],
  },
  merchant: INITIAL_MERCHANT_STATE,
  stronghold: {
    projects: [],
  },
  treasure: {
    hoards: [],
  },
  lab: {
    projects: [],
  },
  dungeon: {
    turn: 0,
    depth: 1,
    torches: 6,
    rations: 7,
    loot: 0,
    bankedGold: 0,
    lairMode: false,
    status: "idle",
    log: [],
  },
};

