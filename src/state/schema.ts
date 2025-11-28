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
  xp: number;
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
  activeTrackerId: string | null;
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
  staticMapMode: boolean;
  staticMapData?: Record<string, WildernessHex>;
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

export type CalendarTrackerKind =
  | "lab"
  | "stronghold"
  | "merchant"
  | "dominion"
  | "siege"
  | "wilderness"
  | "dungeon"
  | "other";

export interface CalendarTracker {
  id: string;
  name: string;
  remainingMinutes: number;
  initialMinutes: number;
  kind: CalendarTrackerKind;
  blocking: boolean;
  startedAt: number;
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

export type SiegeQuality = 5 | 10 | 15;
export type SiegeTactic = "attack" | "envelop" | "trap" | "hold" | "withdraw";

export interface SiegeForce {
  name: string;
  troops: number;
  leaderLevel: number;
  leaderStatBonus: number;
  percentNamed: number;
  avgOfficerLevel: number;
  avgTroopLevel: number;
  victories: number;
  trainingWeeks: number;
  quality: SiegeQuality;
  ac5: boolean;
  elfOrDwarf: boolean;
  mounts: boolean;
  missiles: boolean;
  magic: boolean;
  flyers: boolean;
  siegeEngines: {
    ltCatapult: number;
    hvCatapult: number;
    ram: number;
    tower: number;
    ballista: number;
  };
}

export interface SiegeModifiers {
  attacker: {
    terrain: boolean;
    morale: boolean;
    fatigue: boolean;
    intel: boolean;
    traitor: boolean;
    heroics: boolean;
  };
  defender: {
    fortified: boolean;
    terrain: boolean;
    morale: boolean;
    fatigue: boolean;
    intel: boolean;
    heroics: boolean;
  };
}

export interface SiegeBattleLogEntry {
  id: string;
  timestamp: number;
  winner: string;
  diff: number;
  attackerTotal: number;
  defenderTotal: number;
  attackerLosses: number;
  defenderLosses: number;
  notes: string;
  applied: boolean;
  recoveryTrackerId?: string | null;
  recoveryReady?: boolean;
  recoveryDays?: number;
}

export interface SiegeState {
  attacker: SiegeForce;
  defender: SiegeForce;
  tactics: {
    attacker: SiegeTactic;
    defender: SiegeTactic;
  };
  modifiers: SiegeModifiers;
  log: SiegeBattleLogEntry[];
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
  status: "pending" | "complete";
  trackerId?: string | null;
  travelDays?: number;
  deliveredAt?: number | null;
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
  buildDays: number;
  startedAt: number;
  completedAt?: number | null;
  trackerId?: string | null;
}

export interface StrongholdComponentSelection {
  id: string;
  qty: number;
}

export interface StrongholdState {
  projectName: string;
  terrainMod: number;
  components: StrongholdComponentSelection[];
  projects: StrongholdProject[];
  activeProjectId: string | null;
  activeTrackerId: string | null;
}

export type CoinDenomination = "cp" | "sp" | "ep" | "gp" | "pp";

export interface TreasureCoinPile {
  denomination: CoinDenomination;
  amount: number;
  gpValue: number;
}

export interface TreasureGemEntry {
  id: string;
  name: string;
  value: number;
}

export interface TreasureMagicItem {
  id: string;
  category: string;
  name: string;
}

export interface TreasureHoard {
  id: string;
  type: string;
  label: string;
  totalValue: number;
  createdAt: number;
  coins: TreasureCoinPile[];
  gems: TreasureGemEntry[];
  jewelry: TreasureGemEntry[];
  magic: TreasureMagicItem[];
  notes?: string;
}

export interface TreasureState {
  selectedType: string;
  hoards: TreasureHoard[];
}

export type LabClass = "mu" | "cleric";
export type LabMode = "spell" | "item";
export type LabItemType = "scroll" | "potion" | "wand" | "ring" | "weapon" | "construct";

export interface LabCaster {
  name: string;
  level: number;
  class: LabClass;
  mentalStat: number;
}

export interface LabResources {
  gold: number;
  libraryValue: number;
}

export interface LabWorkbench {
  mode: LabMode;
  itemType: LabItemType;
  spellLevel: number;
  materialCost: number;
  isNewSpell: boolean;
  hasComponents: boolean;
}

export interface LabLogEntry {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  itemType: LabItemType;
  outcome: "success" | "fail";
  roll: number;
  chance: number;
  weeks: number;
  cost: number;
}

export interface LabState {
  caster: LabCaster;
  resources: LabResources;
  workbench: LabWorkbench;
  log: LabLogEntry[];
  activeTrackerId: string | null;
}

export type DungeonStatus = "idle" | "surprise" | "encounter" | "obstacle" | "loot";
export type LightingCondition = "bright" | "dim" | "dark";
export type EncounterReaction = "hostile" | "aggressive" | "cautious" | "neutral" | "friendly";

export interface SurpriseState {
  partyRoll: number;
  monsterRoll: number;
  partySurprised: boolean;
  monsterSurprised: boolean;
}

export interface ReactionRollRecord {
  roll: number;
  modifier: number;
  total: number;
  result: EncounterReaction;
}

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
  reaction: EncounterReaction;
  distance: number; // feet
  special?: string; // Special abilities like poison, paralysis, etc.
  
  // Surprise tracking
  surprise?: SurpriseState;
  
  // Reaction roll tracking
  reactionRolls?: ReactionRollRecord[];
  
  // Morale tracking (BECMI checks at specific triggers)
  moraleChecked: {
    firstHit: boolean;      // When creature first takes damage
    quarterHp: boolean;     // Reduced to 1/4 HP or less
    firstDeath: boolean;    // First death on either side
    halfIncapacitated: boolean; // Half creatures unable to act
  };
  
  spellsCasterIds?: string[];
}

export type ObstacleType = "door" | "trap" | "hazard" | "feature";

export interface DungeonObstacle {
  id: string;
  name: string;
  description: string;
  type: ObstacleType;
  turnCost: number; // Turns required to resolve
  alertsMonsters: boolean;
  damage?: string; // Dice formula for damage
  saveType?: "death" | "wands" | "paralysis" | "breath" | "spells";
  resolved: boolean;
  attemptsMade: number; // For doors - multiple attempts allowed per round
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
  torchTurnsUsed: number; // Tracks turns used on current torch (0-5)
  rations: number;
  loot: number;
  lairMode: boolean;
  lighting: LightingCondition; // Affects encounter distance
  status: DungeonStatus;
  encounter?: DungeonEncounter;
  obstacle?: DungeonObstacle;
  roomSearched: boolean; // Whether current room has been searched
  log: DungeonLogEntry[];
}

// ============================================================================
// LEDGER (Gold Tracking)
// ============================================================================

export type LedgerSource =
  | "party"
  | "dominion"
  | "merchant"
  | "lab"
  | "stronghold"
  | "dungeon"
  | "treasure"
  | "wilderness"
  | "siege"
  | "manual";

export type LedgerCategory =
  | "loot"           // Monster treasure, dungeon finds
  | "tax"            // Dominion tax income
  | "trade"          // Merchant profits/losses
  | "wage"           // Retainer/hireling wages
  | "construction"   // Stronghold building costs
  | "research"       // Magic item creation, spell research
  | "equipment"      // Buy/sell gear
  | "supplies"       // Rations, torches, ammunition
  | "tithe"          // Religious contributions
  | "misc";          // Other transactions

export interface LedgerTransaction {
  id: string;
  timestamp: number;           // Real-world timestamp
  calendarYear: number;        // In-game year
  calendarMonth: number;       // In-game month (0-11)
  calendarDay: number;         // In-game day (1-28)
  source: LedgerSource;        // Which module initiated
  category: LedgerCategory;    // Type of transaction
  amount: number;              // Positive = income, negative = expense
  balance: number;             // Running balance after transaction
  description: string;         // Human-readable description
  linkedEntityId?: string;     // Optional link to related entity (project, journey, etc.)
  linkedEntityType?: string;   // Type of linked entity
}

export interface LedgerRecurringExpense {
  id: string;
  name: string;
  amount: number;
  frequency: "daily" | "weekly" | "monthly" | "seasonal";
  source: LedgerSource;
  category: LedgerCategory;
  nextDueYear: number;
  nextDueMonth: number;
  nextDueDay: number;
  active: boolean;
  linkedEntityId?: string;
  linkedEntityType?: string;
}

export interface LedgerState {
  balance: number;                        // Current total gold
  transactions: LedgerTransaction[];      // Transaction history
  recurringExpenses: LedgerRecurringExpense[];  // Scheduled payments (wages, etc.)
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
  ledger: LedgerState;
}

const STRONGHOLD_DEFAULT_STATE: StrongholdState = {
  projectName: "Castle Blackrock",
  terrainMod: 1,
  components: [],
  projects: [],
  activeProjectId: null,
  activeTrackerId: null,
};

export function createDefaultStrongholdState(): StrongholdState {
  return JSON.parse(JSON.stringify(STRONGHOLD_DEFAULT_STATE));
}

const LAB_DEFAULT_STATE: LabState = {
  caster: {
    name: "Archmage Solon",
    level: 9,
    class: "mu",
    mentalStat: 16,
  },
  resources: {
    gold: 25000,
    libraryValue: 10000,
  },
  workbench: {
    mode: "item",
    itemType: "scroll",
    spellLevel: 3,
    materialCost: 1000,
    isNewSpell: false,
    hasComponents: false,
  },
  log: [],
  activeTrackerId: null,
};

export function createDefaultLabState(): LabState {
  return JSON.parse(JSON.stringify(LAB_DEFAULT_STATE));
}

const SIEGE_DEFAULT_STATE: SiegeState = {
  attacker: {
    name: "Orc Horde",
    troops: 800,
    leaderLevel: 10,
    leaderStatBonus: 2,
    percentNamed: 3,
    avgOfficerLevel: 4,
    avgTroopLevel: 1,
    victories: 2,
    trainingWeeks: 12,
    quality: 5,
    ac5: false,
    elfOrDwarf: false,
    mounts: false,
    missiles: false,
    magic: false,
    flyers: false,
    siegeEngines: {
      ltCatapult: 0,
      hvCatapult: 0,
      ram: 0,
      tower: 0,
      ballista: 0,
    },
  },
  defender: {
    name: "Elven Garrison",
    troops: 500,
    leaderLevel: 12,
    leaderStatBonus: 4,
    percentNamed: 10,
    avgOfficerLevel: 5,
    avgTroopLevel: 2,
    victories: 4,
    trainingWeeks: 16,
    quality: 10,
    ac5: true,
    elfOrDwarf: true,
    mounts: false,
    missiles: true,
    magic: true,
    flyers: false,
    siegeEngines: {
      ltCatapult: 0,
      hvCatapult: 0,
      ram: 0,
      tower: 0,
      ballista: 2,
    },
  },
  tactics: {
    attacker: "attack",
    defender: "attack",
  },
  modifiers: {
    attacker: {
      terrain: false,
      morale: false,
      fatigue: false,
      intel: false,
      traitor: false,
      heroics: false,
    },
    defender: {
      fortified: true,
      terrain: false,
      morale: true,
      fatigue: false,
      intel: false,
      heroics: false,
    },
  },
  log: [],
};

export function createDefaultSiegeState(): SiegeState {
  return JSON.parse(JSON.stringify(SIEGE_DEFAULT_STATE));
}

const LEDGER_DEFAULT_STATE: LedgerState = {
  balance: 0,
  transactions: [],
  recurringExpenses: [],
};

export function createDefaultLedgerState(): LedgerState {
  return JSON.parse(JSON.stringify(LEDGER_DEFAULT_STATE));
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
      taxRate: 1,  // BECMI default: 1 gp per family (standard income of 10gp is separate)
      holidaySpending: 1000,
      event: "none",
      expenses: 1500,
      tithePercent: 20,
    },
    log: [],
    activeTrackerId: null,
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
    staticMapMode: false,
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
  siege: createDefaultSiegeState(),
  merchant: INITIAL_MERCHANT_STATE,
  stronghold: createDefaultStrongholdState(),
  treasure: {
    selectedType: "A",
    hoards: [],
  },
  lab: createDefaultLabState(),
  dungeon: {
    turn: 0,
    depth: 1,
    torches: 6,
    torchTurnsUsed: 0,
    rations: 7,
    loot: 0,
    lairMode: false,
    lighting: "dim",
    status: "idle",
    roomSearched: false,
    log: [],
  },
  ledger: createDefaultLedgerState(),
};

