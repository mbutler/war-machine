import type {
  DominionResourceType,
  WildernessClimate,
  WildernessHex,
  WildernessState,
  WildernessTerrainType,
} from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { createId } from "../../utils/id";
import { advanceCalendar, advanceClock, addCalendarLog, describeClock, getCalendarMoonPhase } from "../calendar/state";

export type WildernessListener = (state: WildernessState) => void;

const MOVEMENT_POINTS_PER_DAY = 24;
const WATER_REFILL_DAYS = 7;
const LOG_LIMIT = 200;

const REFILL_TERRAINS: WildernessTerrainType[] = ["clear", "woods", "river", "swamp", "city", "ocean"];

const VALID_TERRAINS: WildernessTerrainType[] = [
  "clear",
  "woods",
  "hills",
  "mountain",
  "swamp",
  "desert",
  "city",
  "river",
  "ocean",
];

// Terrain type mapping from Python BECMI generator to Wilderness system
const PYTHON_TO_WILDERNESS_TERRAIN: Record<string, WildernessTerrainType> = {
  "Clear": "clear",      // Grasslands
  "Forest": "woods",     // Woods
  "Hills": "hills",      // Hills
  "Mountains": "mountain", // Mountains
  "Swamp": "swamp",      // Swamp
  "Desert": "desert",    // Desert
  "Jungle": "woods",     // Jungle -> Woods (closest match)
  "Glacier": "mountain", // Glacier -> Mountain
  "Barren": "desert",    // Barren -> Desert
  "Deep Sea": "ocean",   // Deep Sea -> Ocean
  "Sea": "ocean",        // Sea -> Ocean
  "Coast": "clear",      // Coast -> Clear (could be city, but clear for now)
};

const TERRAIN_DATA: Record<
  WildernessTerrainType,
  {
    name: string;
    color: string;
    mpCost: number;
    forage: number;
    lost: number;
    encounter: number;
    tables?: Record<string, number>;
  }
> = {
  clear: {
    name: "Clear",
    color: "#86efac",
    mpCost: 6,
    forage: 1,
    lost: 1,
    encounter: 2,
    tables: { clear: 10, city: 12, woods: 16, river: 17, swamp: 18, hills: 19, mountain: 20 },
  },
  woods: {
    name: "Woods",
    color: "#15803d",
    mpCost: 9,
    forage: 3,
    lost: 2,
    encounter: 3,
    tables: { clear: 5, city: 6, woods: 14, river: 15, swamp: 16, hills: 17, mountain: 20 },
  },
  hills: {
    name: "Hills",
    color: "#a1a1aa",
    mpCost: 9,
    forage: 2,
    lost: 2,
    encounter: 3,
    tables: { clear: 4, city: 5, woods: 7, river: 8, swamp: 9, hills: 17, mountain: 20 },
  },
  mountain: {
    name: "Mountain",
    color: "#52525b",
    mpCost: 12,
    forage: 1,
    lost: 2,
    encounter: 3,
    tables: { clear: 3, woods: 6, river: 8, hills: 14, mountain: 20 },
  },
  swamp: {
    name: "Swamp",
    color: "#047857",
    mpCost: 12,
    forage: 2,
    lost: 3,
    encounter: 3,
    tables: { clear: 3, woods: 6, river: 10, swamp: 18, hills: 19, mountain: 20 },
  },
  desert: {
    name: "Desert",
    color: "#fdba74",
    mpCost: 12,
    forage: 0,
    lost: 3,
    encounter: 2,
    tables: { clear: 4, desert: 18, hills: 19, mountain: 20 },
  },
  city: {
    name: "Settlement",
    color: "#fcd34d",
    mpCost: 4,
    forage: 6,
    lost: 0,
    encounter: 2,
    tables: { clear: 10, city: 14, woods: 16, river: 17, hills: 19, mountain: 20 },
  },
  river: {
    name: "River",
    color: "#3b82f6",
    mpCost: 6,
    forage: 3,
    lost: 0,
    encounter: 2,
    tables: { clear: 10, city: 12, woods: 16, river: 20 },
  },
  ocean: {
    name: "Ocean",
    color: "#1e3a8a",
    mpCost: 12,
    forage: 3,
    lost: 3,
    encounter: 2,
    tables: { ocean: 20 },
  },
};

// BECMI Wilderness Encounters Table
// Main table: Roll 1d8 to determine subtable, then roll 1d12 on subtable by terrain
const MAIN_ENCOUNTER_TABLE: Record<number, string> = {
  1: "Human",
  2: "Humanoid",
  3: "Animal",    // Varies by terrain: Animal/Insect/Swimmer
  4: "Animal",    // Varies by terrain: Animal/Unusual/Swimmer
  5: "Unusual",   // Varies by terrain: Unusual/Animal/Swimmer
  6: "Dragon",    // Varies by terrain: Dragon/Animal/Animal
  7: "Insect",    // Varies by terrain: Insect/Dragon/Dragon
  8: "Special",   // For city terrain
};

// Terrain groupings for subtable lookups
const TERRAIN_GROUPINGS = {
  clear: "Clear",
  woods: "Woods",
  hills: "Hills",
  mountain: "Mountain", // BECMI groups as "Barren, Mountain, Hill"
  swamp: "Swamp",
  desert: "Desert",
  city: "City",
  river: "River",
  ocean: "Ocean",
} as const;

// BECMI Wilderness Encounter Subtables
const ENCOUNTER_DATA: Record<string, Array<{ name: string; qty: string; treasure?: string }>> = {
  // Subtable 3: Humans (varies by terrain - simplified to core types)
  menus: [
    { name: "Adventurer", qty: "1d6", treasure: "V" },
    { name: "Bandit", qty: "1d6+3", treasure: "(U) A" },
    { name: "Berserker", qty: "1d6", treasure: "(Q) B" },
    { name: "Brigand", qty: "2d4", treasure: "(T) A" },
    { name: "Buccaneer", qty: "1d6", treasure: "(S) A" },
    { name: "Caveman", qty: "1d6", treasure: "Nil" },
    { name: "Cleric", qty: "1d3", treasure: "V" },
    { name: "Dervish", qty: "1d6", treasure: "(T) A" },
    { name: "Fighter", qty: "1d6", treasure: "V" },
    { name: "Magic-User", qty: "1d3", treasure: "V" },
    { name: "Merchant", qty: "1d20", treasure: "(U) C" },
    { name: "NPC Party", qty: "1d6+2", treasure: "V" },
  ],

  // Subtable 2: Humanoids
  humanoid: [
    { name: "Bugbear", qty: "1d6", treasure: "B" },
    { name: "Cyclops", qty: "1", treasure: "E" },
    { name: "Dwarf", qty: "2d4", treasure: "(M) G" },
    { name: "Elf", qty: "1d6", treasure: "(E) E" },
    { name: "Giant, Cloud", qty: "1", treasure: "E" },
    { name: "Giant, Fire", qty: "1", treasure: "E" },
    { name: "Giant, Frost", qty: "1", treasure: "E" },
    { name: "Giant, Hill", qty: "1d4", treasure: "D" },
    { name: "Giant, Stone", qty: "1", treasure: "E" },
    { name: "Giant, Storm", qty: "1", treasure: "E" },
    { name: "Gnome", qty: "1d6", treasure: "(O) N" },
    { name: "Goblin", qty: "2d4", treasure: "(R) C" },
  ],

  // Subtable 4: Flyers
  flyer: [
    { name: "Bee, Giant", qty: "1d6", treasure: "Nil" },
    { name: "Gargoyle", qty: "1d6", treasure: "C" },
    { name: "Griffon", qty: "1d6", treasure: "D" },
    { name: "Harpy", qty: "1d6", treasure: "C" },
    { name: "Hippogriff", qty: "2d8", treasure: "C" },
    { name: "Insect Swarm", qty: "1", treasure: "Nil" },
    { name: "Manticore", qty: "1d4", treasure: "D" },
    { name: "Pegasus", qty: "1d12", treasure: "Nil" },
    { name: "Robber Fly", qty: "1d6", treasure: "Nil" },
    { name: "Roc, Small", qty: "1", treasure: "I" },
    { name: "Roc, Large", qty: "1", treasure: "I" },
    { name: "Roc, Giant", qty: "1", treasure: "I" },
  ],

  // Subtable 1: Animals (simplified - BECMI has terrain-specific variants)
  animal: [
    { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
    { name: "Ape, Snow", qty: "1d4", treasure: "Nil" },
    { name: "Ape, White", qty: "1d4", treasure: "Nil" },
    { name: "Baboon, Rock", qty: "1d6", treasure: "Nil" },
    { name: "Bear, Cave", qty: "1d4", treasure: "Nil" },
    { name: "Bear, Grizzly", qty: "1d4", treasure: "Nil" },
    { name: "Boar", qty: "1d6", treasure: "Nil" },
    { name: "Camel", qty: "1d6", treasure: "Nil" },
    { name: "Cat, Lion", qty: "1d4", treasure: "Nil" },
    { name: "Cat, Panther", qty: "1d4", treasure: "Nil" },
    { name: "Cat, Sabretooth", qty: "1d2", treasure: "Nil" },
    { name: "Cat, Tiger", qty: "1d4", treasure: "Nil" },
  ],

  // Subtable 5: Swimmers
  swimmer: [
    { name: "Crocodile", qty: "1d6", treasure: "Nil" },
    { name: "Crocodile, Large", qty: "1d3", treasure: "D" },
    { name: "Fish, Rock", qty: "1d6", treasure: "Nil" },
    { name: "Giant Fish", qty: "1d6", treasure: "Nil" },
    { name: "Leech, Giant", qty: "1d4", treasure: "Nil" },
    { name: "Lizard Man", qty: "2d4", treasure: "D" },
    { name: "Toad, Giant", qty: "1d6", treasure: "Nil" },
    { name: "Shrew, Giant", qty: "1d4", treasure: "Nil" },
    { name: "Snake, Python", qty: "1d6", treasure: "Nil" },
    { name: "Snake, Rattler", qty: "1d6", treasure: "Nil" },
    { name: "Snake, Viper", qty: "1d6", treasure: "Nil" },
    { name: "Turtle, Giant", qty: "1d2", treasure: "Nil" },
  ],

  // Subtable 6: Dragons
  dragon: [
    { name: "Chimera", qty: "1d2", treasure: "F" },
    { name: "Dragon, Black", qty: "1", treasure: "H" },
    { name: "Dragon, Blue", qty: "1", treasure: "H" },
    { name: "Dragon, Gold", qty: "1", treasure: "H" },
    { name: "Dragon, Green", qty: "1", treasure: "H" },
    { name: "Dragon, Red", qty: "1", treasure: "H" },
    { name: "Dragon, White", qty: "1", treasure: "H" },
    { name: "Hydra", qty: "1", treasure: "B" },
    { name: "Salamander, Flame", qty: "1d4", treasure: "E" },
    { name: "Salamander, Frost", qty: "1d4", treasure: "E" },
    { name: "Wyvern", qty: "1d3", treasure: "E" },
    { name: "Dragon, White", qty: "1", treasure: "H" }, // Duplicate for 12th slot
  ],

  // Subtable 8: Undead
  undead: [
    { name: "Ghoul", qty: "1d6", treasure: "Nil" },
    { name: "Ghoul", qty: "1d6", treasure: "Nil" },
    { name: "Ghoul", qty: "1d6", treasure: "Nil" },
    { name: "Mummy", qty: "1", treasure: "D" },
    { name: "Skeleton", qty: "3d4", treasure: "Nil" },
    { name: "Skeleton", qty: "3d4", treasure: "Nil" },
    { name: "Spectre", qty: "1d2", treasure: "E" },
    { name: "Wight", qty: "1d3", treasure: "B" },
    { name: "Wraith", qty: "1d3", treasure: "E" },
    { name: "Vampire", qty: "1", treasure: "F" },
    { name: "Zombie", qty: "2d4", treasure: "Nil" },
    { name: "Zombie", qty: "2d4", treasure: "Nil" },
  ],

  // Subtable 9: Unusual
  unusual: [
    { name: "Basilisk", qty: "1d6", treasure: "F" },
    { name: "Blink Dog", qty: "1d6", treasure: "C" },
    { name: "Centaur", qty: "1d6", treasure: "D" },
    { name: "Displacer Beast", qty: "1d2", treasure: "E" },
    { name: "Gorgon", qty: "1d2", treasure: "E" },
    { name: "Lycanthrope, Werebear", qty: "1d4", treasure: "C" },
    { name: "Lycanthrope, Wereboar", qty: "1d4", treasure: "D" },
    { name: "Lycanthrope, Wererat", qty: "1d6", treasure: "C" },
    { name: "Lycanthrope, Weretiger", qty: "1d4", treasure: "C" },
    { name: "Lycanthrope, Werewolf", qty: "1d6", treasure: "C" },
    { name: "Medusa", qty: "1d3", treasure: "F" },
    { name: "Treant", qty: "1d6", treasure: "C" },
  ],
};

const CLASSES = ["Fighter", "Cleric", "Magic-User", "Thief", "Dwarf", "Elf"];
const ALIGNMENTS = ["Lawful", "Neutral", "Chaotic"];

export type LightCondition = "clear_daylight" | "dim_light" | "no_light";

const DIRS_ODD = [
  { q: -1, r: -1 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
  { q: -1, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: 0 },
];

const DIRS_EVEN = [
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 1 },
];

export function getWildernessState(): WildernessState {
  return getState().wilderness;
}

export function subscribeToWilderness(listener: WildernessListener): () => void {
  return subscribe((state) => listener(state.wilderness));
}

export function resetWilderness(options: { startTerrain?: WildernessTerrainType; climate?: WildernessClimate } = {}) {
  updateState((state) => {
    const start = normalizeTerrainType(options.startTerrain ?? state.wilderness.startTerrain);
    const partySize = state.wilderness.partySize || 6;

    state.wilderness = {
      map: {
        "0,0": {
          type: start,
          resources: [],
          feature: "Start",
          details: "Safe Haven",
          color: TERRAIN_DATA[start].color,
          visited: true,
        },
      },
      currentPos: { q: 0, r: 0 },
      camera: { x: 0, y: 0 },
      days: 0,
      movementPoints: MOVEMENT_POINTS_PER_DAY,
      maxMovementPoints: MOVEMENT_POINTS_PER_DAY,
      partySize,
      rations: partySize * WATER_REFILL_DAYS,
      water: partySize * WATER_REFILL_DAYS,
      startTerrain: start,
      climate: options.climate ?? state.wilderness.climate,
      weather: generateWeather(options.climate ?? state.wilderness.climate),
      log: [],
      staticMapMode: state.wilderness.staticMapMode || false,
      staticMapData: state.wilderness.staticMapData,
    };
  });
}

export function setPartySize(size: number) {
  updateState((state) => {
    state.wilderness.partySize = Math.max(1, Math.floor(size));
  });
}

export function setRations(value: number) {
  updateState((state) => {
    state.wilderness.rations = Math.max(0, Math.floor(value));
  });
}

export function setWater(value: number) {
  updateState((state) => {
    state.wilderness.water = Math.max(0, Math.floor(value));
  });
}

export function setStartTerrain(terrain: WildernessTerrainType) {
  updateState((state) => {
    state.wilderness.startTerrain = terrain;
  });
}

export function setClimate(climate: WildernessClimate) {
  updateState((state) => {
    state.wilderness.climate = climate;
    state.wilderness.weather = generateWeather(climate);
  });
}

export function setCameraOffset(offset: { x: number; y: number }) {
  updateState((state) => {
    state.wilderness.camera = offset;
  });
}

export function moveParty(directionIndex: number) {
  updateState((state) => {
    const wilderness = state.wilderness;
    const map = ensureMap(wilderness);
    const currentKey = keyFromPos(wilderness.currentPos);
    const currentHex = sanitizeHex(map[currentKey]);
    const fromType = currentHex.type ?? "clear";
    const { nextPos, lostMessage } = resolveMovement(wilderness, directionIndex, fromType);
    const finalHex = ensureHex(wilderness, nextPos.q, nextPos.r, fromType);
    const finalData = TERRAIN_DATA[finalHex.type] ?? TERRAIN_DATA.clear;
    wilderness.currentPos = nextPos;

    const hoursAdvanced = spendMovementPoints(wilderness, finalData.mpCost);
    if (hoursAdvanced > 0) {
      // Advance calendar directly in the same updateState transaction
      const calendar = state.calendar;
      const before = describeClock(calendar.clock);
      advanceClock(calendar.clock, "hour", hoursAdvanced);
      const after = describeClock(calendar.clock);
      addCalendarLog(calendar, `Time passed: +${hoursAdvanced} hour${hoursAdvanced === 1 ? "" : "s"}`, `${before} → ${after}`);
    }
    wilderness.weather = generateWeather(wilderness.climate);

    const encounterMsg = maybeGenerateEncounter(finalHex);
    addLogEntry(wilderness, {
      terrain: finalHex.type,
      summary: buildSummary(finalHex),
      notes: [lostMessage, encounterMsg].filter(Boolean).join(" "),
    });

    wilderness.map[currentKey] = { ...sanitizeHex(currentHex), visited: true } as WildernessHex;
  });
}

export function forageCurrentHex() {
  updateState((state) => {
    const wilderness = state.wilderness;
    const currentHex = sanitizeHex(wilderness.map[keyFromPos(wilderness.currentPos)]);
    if (!currentHex) return;
    // Advance calendar directly in the same updateState transaction
    const calendar = state.calendar;
    const before = describeClock(calendar.clock);
    advanceClock(calendar.clock, "hour", 2);
    const after = describeClock(calendar.clock);
    addCalendarLog(calendar, `Time passed: +2 hours`, `${before} → ${after}`);
    const terrain = TERRAIN_DATA[currentHex.type];
    const roll = randomRange(1, 6);
    if (roll <= terrain.forage) {
      const found = randomRange(1, 6);
      wilderness.rations += found;
      addLogEntry(wilderness, {
        terrain: currentHex.type,
        summary: "Foraging successful.",
        notes: `Found ${found} rations.`,
      });
    } else {
      addLogEntry(wilderness, {
        terrain: currentHex.type,
        summary: "Foraging failed.",
        notes: "No food located.",
      });
    }
    wilderness.weather = generateWeather(wilderness.climate);
  });
}

export function refillWater() {
  updateState((state) => {
    const wilderness = state.wilderness;
    if (!canRefillWater(wilderness)) {
      addLogEntry(wilderness, {
        terrain: wilderness.map[keyFromPos(wilderness.currentPos)]?.type ?? "clear",
        summary: "No water source nearby.",
      });
      return;
    }
    wilderness.water = wilderness.partySize * WATER_REFILL_DAYS;
    addLogEntry(wilderness, {
      terrain: wilderness.map[keyFromPos(wilderness.currentPos)]?.type ?? "clear",
      summary: "Waterskins refilled.",
    });
  });
}

export function canRefillWater(state: WildernessState = getWildernessState()): boolean {
  const map = state.map ?? {};
  const hex = map[keyFromPos(state.currentPos)];
  if (!hex) return false;
  return REFILL_TERRAINS.includes(hex.type);
}

export function exportWildernessData(): string {
  const state = getWildernessState();
  const payload = {
    map: state.map,
    currentPos: state.currentPos,
    days: state.days,
    movementPoints: state.movementPoints,
    maxMovementPoints: state.maxMovementPoints,
    partySize: state.partySize,
    rations: state.rations,
    water: state.water,
    startTerrain: state.startTerrain,
    climate: state.climate,
    weather: state.weather,
    log: state.log,
    staticMapMode: state.staticMapMode,
    staticMapData: state.staticMapData,
  };
  return JSON.stringify(payload, null, 2);
}

export function importWildernessData(raw: string) {
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (!payload || typeof payload !== "object" || !payload.map || !payload.currentPos) {
    throw new Error("Invalid wilderness map file.");
  }

  updateState((state) => {
    state.wilderness.map = payload.map as Record<string, WildernessHex>;
    Object.keys(state.wilderness.map).forEach((key) => {
      state.wilderness.map[key] = sanitizeHex(state.wilderness.map[key]);
    });
    state.wilderness.currentPos = payload.currentPos;
    state.wilderness.days = payload.days ?? 0;
    state.wilderness.movementPoints = payload.movementPoints ?? MOVEMENT_POINTS_PER_DAY;
    state.wilderness.maxMovementPoints = payload.maxMovementPoints ?? MOVEMENT_POINTS_PER_DAY;
    state.wilderness.partySize = payload.partySize ?? state.wilderness.partySize;
    state.wilderness.rations = payload.rations ?? state.wilderness.rations;
    state.wilderness.water = payload.water ?? state.wilderness.water;
    state.wilderness.startTerrain = normalizeTerrainType(payload.startTerrain ?? state.wilderness.startTerrain);
    state.wilderness.climate = payload.climate ?? state.wilderness.climate;
    state.wilderness.weather = payload.weather ?? state.wilderness.weather ?? generateWeather(state.wilderness.climate);
    state.wilderness.log = Array.isArray(payload.log) ? payload.log : [];
    state.wilderness.staticMapMode = payload.staticMapMode ?? false;
    state.wilderness.staticMapData = payload.staticMapData;
  });
}

function ensureHex(state: WildernessState, q: number, r: number, fromType: WildernessTerrainType): WildernessHex {
  const map = ensureMap(state);
  const key = `${q},${r}`;

  // Check for static map data first if in static mode
  if (state.staticMapMode && state.staticMapData && state.staticMapData[key]) {
    const staticHex = { ...state.staticMapData[key], visited: true };
    map[key] = staticHex;
    return staticHex;
  }

  if (map[key]) {
    map[key] = sanitizeHex(map[key]);
    map[key]!.visited = true;
    return map[key]!;
  }

  const generated = generateHex(fromType);
  map[key] = generated;
  return generated;
}

function ensureMap(state: WildernessState): Record<string, WildernessHex> {
  if (!state.map) {
    const start = normalizeTerrainType(state.startTerrain);
    state.map = {
      "0,0": {
        type: start,
        resources: [],
        feature: "Start",
        details: "Safe Haven",
        color: TERRAIN_DATA[start].color,
        visited: true,
      },
    };
  } else {
    Object.keys(state.map).forEach((key) => {
      state.map[key] = sanitizeHex(state.map[key]);
    });
  }
  return state.map;
}

function generateHex(fromType: WildernessTerrainType): WildernessHex {
  const type = selectTerrain(fromType);
  const resources: DominionResourceType[] = [];
  if (Math.random() < 0.2) resources.push("Animal");
  if (Math.random() < 0.2) resources.push("Vegetable");
  if (Math.random() < 0.1) resources.push("Mineral");

  let feature: string | null = null;
  let details: string | null = null;

  const roll = Math.random();
  if (roll < 0.02) {
    feature = "Castle";
    const ownerLvl = randomRange(9, 14);
    const ownerClass = CLASSES[randomRange(0, CLASSES.length - 1)];
    const align = ALIGNMENTS[randomRange(0, ALIGNMENTS.length - 1)];
    const troops = randomRange(1, 4) * 10;
    const patrol = maybeGenerateEncounter({ type } as WildernessHex)?.replace("ENCOUNTER: ", "") ?? "Militia";
    details = `${align} ${ownerClass} (Lvl ${ownerLvl}). Garrison: ${troops}. Patrol: ${patrol}.`;
  } else if (roll < 0.05) {
    feature = "Ruins";
    details = "Ancient crumbling walls. Dungeon entrance?";
  } else if (roll < 0.15) {
    feature = "Lair";
    details = maybeGenerateEncounter({ type } as WildernessHex)?.replace("ENCOUNTER: ", "Lair of ") ?? "Empty lair.";
  } else if (roll < 0.2 || type === "city") {
    feature = "Town";
    const settlement = generateSettlement();
    details = `${settlement.size} (Pop: ${settlement.population}). Ruler: ${settlement.ruler}. Services: ${settlement.services}.`;
  }

  return {
    type,
    resources,
    feature,
    details,
    color: TERRAIN_DATA[type]?.color,
    visited: true,
  };
}

function selectTerrain(fromType: WildernessTerrainType): WildernessTerrainType {
  const normalized = normalizeTerrainType(fromType);
  const table = TERRAIN_DATA[normalized]?.tables;
  if (!table) return normalized;
  const roll = randomRange(1, 20);
  const sortedEntries = Object.entries(table).sort((a, b) => a[1] - b[1]);
  for (const [terrain, threshold] of sortedEntries) {
    if (roll <= threshold) {
      return normalizeTerrainType(terrain);
    }
  }
  return normalized;
}

function resolveMovement(
  state: WildernessState,
  dirIndex: number,
  fromType: WildernessTerrainType,
): { nextPos: { q: number; r: number }; lostMessage?: string } {
  const isOdd = Math.abs(state.currentPos.q) % 2 === 1;
  const deltas = isOdd ? DIRS_EVEN : DIRS_ODD;
  const delta = deltas[dirIndex];
  let nextPos = { q: state.currentPos.q + delta.q, r: state.currentPos.r + delta.r };
  let lostMessage: string | undefined;

  const terrain = TERRAIN_DATA[normalizeTerrainType(fromType)] ?? TERRAIN_DATA.clear;
  let lostChance = terrain.lost;
  if (normalizeTerrainType(fromType) === "river") lostChance = 0;

  if (randomRange(1, 6) <= lostChance) {
    const drift = randomRange(0, 5);
    if (drift !== dirIndex) {
      lostMessage = "Lost! Trail drifts off course.";
      const driftDelta = deltas[drift];
      nextPos = { q: state.currentPos.q + driftDelta.q, r: state.currentPos.r + driftDelta.r };
    }
  }
  return { nextPos, lostMessage };
}

function spendMovementPoints(state: WildernessState, cost: number): number {
  state.movementPoints -= cost;

  // Calculate hours spent traveling based on miles
  // Assuming 8 hours of travel per day for 24 miles
  const hoursSpentTraveling = (cost / state.maxMovementPoints) * 8;

  let daysAdvanced = 0;
  while (state.movementPoints <= 0) {
    consumeDailySupplies(state);
    state.movementPoints += state.maxMovementPoints;
    daysAdvanced += 1;
  }

  // Return total hours spent (travel + any full days)
  return Math.round(hoursSpentTraveling + (daysAdvanced * 24));
}

function consumeDailySupplies(state: WildernessState) {
  const currentHex = sanitizeHex(state.map[keyFromPos(state.currentPos)]);
  const isDesert = currentHex?.type === "desert";
  const waterNeed = isDesert ? state.partySize * 2 : state.partySize;

  state.days += 1;
  // Calendar advancement will be handled by the caller in the same updateState transaction
  state.rations = Math.max(0, state.rations - state.partySize);
  state.water = Math.max(0, state.water - waterNeed);

  if (state.rations === 0 || state.water === 0) {
    addLogEntry(state, {
      terrain: currentHex?.type ?? "clear",
      summary: "Supplies exhausted",
      notes: "Starvation or dehydration threatens the party.",
    });
  }
}

// BECMI Chance of Encounter Table
// Clear, grasslands, inhabited, settled: 1 on 1d6 (16.7%)
// Forest, river, hills, barren, desert, ocean: 1-2 on 1d6 (33.3%)
// Swamp, jungle, mountains: 1-3 on 1d6 (50%)
function getEncounterChance(terrainType: WildernessTerrainType): number {
  const normalized = normalizeTerrainType(terrainType);
  switch (normalized) {
    case "clear":
    case "city":
      return 1; // 1 on 1d6
    case "woods":
    case "river":
    case "hills":
    case "desert":
    case "ocean":
      return 2; // 1-2 on 1d6
    case "swamp":
    case "mountain":
      return 3; // 1-3 on 1d6
    default:
      return 1; // Default to clear
  }
}

function maybeGenerateEncounter(hex: WildernessHex): string | undefined {
  if (!hex) return undefined;
  const encounterChance = getEncounterChance(hex.type);
  if (randomRange(1, 6) > encounterChance) {
    return undefined;
  }
  return generateEncounter(hex.type);
}

function generateEncounter(type: WildernessTerrainType): string {
  const normalized = normalizeTerrainType(type);
  const terrainGroup = TERRAIN_GROUPINGS[normalized] || "Clear";

  // Roll 1d8 on main table to determine subtable
  const mainRoll = randomRange(1, 8);
  const subtableName = MAIN_ENCOUNTER_TABLE[mainRoll];

  // Get the appropriate subtable based on main roll and terrain
  const { categoryName, encounter } = rollOnSubtable(subtableName, terrainGroup);
  const qty = rollDice(encounter.qty);

  // Check for surprise (simplified - could be expanded with actual surprise mechanics)
  const isSurprised = randomRange(1, 6) <= 2; // 33% chance of surprise for now

  // Calculate encounter distance based on lighting conditions and surprise
  const distance = calculateEncounterDistance(isSurprised);

  const surpriseText = isSurprised ? " (Surprised!)" : "";
  const treasureText = encounter.treasure && encounter.treasure !== "Nil" ?
    ` [Treasure: ${encounter.treasure}]` : "";

  return `ENCOUNTER: ${qty} ${encounter.name} (${categoryName}) - ${distance} yards away${surpriseText}${treasureText}`;
}

function rollOnSubtable(subtableName: string, terrainGroup: string): { categoryName: string; encounter: { name: string; qty: string } } {
  let tableKey: string;
  let roll: number;

  // Handle terrain-specific subtable variations from BECMI main table
  switch (subtableName) {
    case "Human":
      tableKey = "menus";
      roll = randomRange(1, 12);
      break;

    case "Humanoid":
      tableKey = "humanoid";
      roll = randomRange(1, 12);
      break;

    case "Animal":
      tableKey = "animal";
      roll = randomRange(1, 12);
      break;

    case "Unusual":
      tableKey = "unusual";
      roll = randomRange(1, 12);
      break;

    case "Dragon":
      tableKey = "dragon";
      roll = randomRange(1, 12);
      break;

    case "Insect":
      // Insect encounters use the unusual table in BECMI
      tableKey = "unusual";
      roll = randomRange(1, 12);
      break;

    case "Special":
      if (terrainGroup === "City") {
        // City special encounters - for now use humans, but should be city-specific
        tableKey = "menus";
        roll = randomRange(1, 12);
      } else {
        tableKey = "menus"; // Fallback
        roll = randomRange(1, 12);
      }
      break;

    default:
      tableKey = "menus";
      roll = randomRange(1, 12);
  }

  const table = ENCOUNTER_DATA[tableKey.toLowerCase()] ?? ENCOUNTER_DATA.menus;
  const encounter = table[roll - 1] ?? table[0];

  return { categoryName: tableKey, encounter };
}

function getLightCondition(): LightCondition {
  // Import calendar state to check time of day
  const calendarState = getState().calendar;
  const hour = calendarState.clock.hour;

  // Clear daylight: 8 AM - 6 PM (hours 8-17, 10 hours)
  if (hour >= 8 && hour <= 17) {
    return "clear_daylight";
  }

  // Dim light: 2 hours morning (6-8 AM) and 2 hours evening (6-8 PM)
  if ((hour >= 6 && hour <= 7) || (hour >= 18 && hour <= 19)) {
    return "dim_light";
  }

  // No light: Full night 8 PM - 6 AM (hours 20-23, 0-5)
  // Check moon phase - full moon provides dim light even at night
  const moonPhase = getCalendarMoonPhase(calendarState.clock);
  const isFullMoon = moonPhase === "Full Moon";

  if (hour >= 20 || hour <= 5) {
    // Full moon provides dim light
    if (isFullMoon) {
      return "dim_light";
    }
    // Otherwise no light
    return "no_light";
  }

  // Default fallback
  return "dim_light";
}

function calculateEncounterDistance(isSurprised: boolean = false): number {
  // If surprised, always use 1d4 × 10 yards (or half, depending on surprise)
  if (isSurprised) {
    return rollDice("1d4") * 10;
  }

  const lightCondition = getLightCondition();

  let distance: number;
  switch (lightCondition) {
    case "clear_daylight":
      // 4d6 × 10 yards
      distance = rollDice("4d6") * 10;
      break;
    case "dim_light":
      // 2d6 × 10 yards
      distance = rollDice("2d6") * 10;
      break;
    case "no_light":
    default:
      // 1d4 × 10 yards
      distance = rollDice("1d4") * 10;
      break;
  }

  return distance;
}

function generateSettlement() {
  const popRoll = rollDice("2d6");
  let size = "Village";
  let population = rollDice("1d10") * 50;

  if (popRoll >= 11) {
    size = "City";
    population = rollDice("2d10") * 1000;
  } else if (popRoll >= 8) {
    size = "Town";
    population = rollDice("1d10") * 200 + 500;
  }

  const rulerLevel = rollDice("1d6") + 8;
  const rulerClass = CLASSES[randomRange(0, CLASSES.length - 1)];

  const services = ["Market"];
  if (size !== "Village") {
    services.push("Inn", "Blacksmith", "Temple");
  }
  if (size === "City") {
    services.push("Magic Guild", "Thieves Guild", "Arena");
  }

  return {
    size,
    population,
    ruler: `Lvl ${rulerLevel} ${rulerClass}`,
    services: services.join(", "),
  };
}

function generateWeather(climate: WildernessClimate) {
  let tempRoll = rollDice("2d6");
  if (climate === "cold") tempRoll -= 3;
  if (climate === "tropic") tempRoll += 3;

  let temperature = "Moderate";
  if (tempRoll <= 4) temperature = "Cold/Freezing";
  else if (tempRoll <= 6) temperature = "Cool";
  else if (tempRoll >= 10 && tempRoll < 12) temperature = "Hot";
  else if (tempRoll >= 12) temperature = "Scorching";

  let wind = "Breeze";
  const windRoll = rollDice("2d6");
  if (windRoll <= 3) wind = "Dead Calm";
  else if (windRoll >= 10 && windRoll < 12) wind = "Strong Winds";
  else if (windRoll >= 12) wind = "Gale/Storm";

  let precipitation = "None";
  const rainRoll = rollDice("2d6");
  if (rainRoll >= 10) precipitation = temperature.includes("Cold") ? "Snow" : "Rain";
  if (rainRoll === 12) precipitation = "Heavy Storm";

  return { temperature, wind, precipitation };
}

function addLogEntry(
  state: WildernessState,
  entry: { terrain: WildernessTerrainType; summary: string; notes?: string },
) {
  state.log.unshift({
    id: createId(),
    timestamp: Date.now(),
    day: state.days,
    position: { ...state.currentPos },
    terrain: entry.terrain,
    summary: entry.summary,
    notes: entry.notes,
  });
  state.log = state.log.slice(0, LOG_LIMIT);
}

function buildSummary(hex: WildernessHex): string {
  const terrain = TERRAIN_DATA[normalizeTerrainType(hex.type)] ?? TERRAIN_DATA.clear;
  let text = `Travelled to ${terrain.name}.`;
  if (hex.feature) {
    text += ` Found ${hex.feature.toUpperCase()}!`;
  }
  return text;
}

function keyFromPos(pos?: { q?: number; r?: number }): string {
  const q = Number.isFinite(pos?.q) ? (pos!.q as number) : 0;
  const r = Number.isFinite(pos?.r) ? (pos!.r as number) : 0;
  return `${q},${r}`;
}

function rollDice(input: string): number {
  const match = input.match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return parseInt(input, 10) || 1;
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += randomRange(1, sides);
  }
  return Math.max(1, total + mod);
}

function randomRange(min: number, max: number): number {
  if (max <= min) return min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeTerrainType(type?: string | null): WildernessTerrainType {
  if (!type) return "clear";
  const key = type.toLowerCase() as WildernessTerrainType;
  return (VALID_TERRAINS as string[]).includes(key) ? key : "clear";
}

function sanitizeHex(hex?: WildernessHex): WildernessHex {
  if (!hex) {
    return {
      type: "clear",
      resources: [],
      feature: "Start",
      details: "Safe Haven",
      color: TERRAIN_DATA.clear.color,
      visited: true,
    };
  }
  const normalizedType = normalizeTerrainType(hex.type);
  return {
    ...hex,
    type: normalizedType,
    color: hex.color ?? TERRAIN_DATA[normalizedType].color,
  };
}

export function setStaticMapMode(enabled: boolean) {
  updateState((state) => {
    state.wilderness.staticMapMode = enabled;
  });
}

// Helper function to convert Python BECMI terrain to Wilderness terrain
function convertPythonTerrain(pythonTerrain: string): WildernessTerrainType {
  return PYTHON_TO_WILDERNESS_TERRAIN[pythonTerrain] || "clear";
}

export function loadStaticMapFromJSON(jsonData: string): void {
  try {
    const data = JSON.parse(jsonData);

    if (!Array.isArray(data)) {
      throw new Error("Invalid static map format: expected array of hex data");
    }

    const staticMap: Record<string, WildernessHex> = {};

    data.forEach((hex: any) => {
      if (!hex.x || !hex.y || !hex.terrain) {
        return; // Skip invalid entries
      }

      const key = `${hex.x},${hex.y}`;
      const wildernessTerrain = convertPythonTerrain(hex.terrain);

      staticMap[key] = {
        type: wildernessTerrain,
        resources: [],
        visited: false, // Static map starts unvisited
        color: TERRAIN_DATA[wildernessTerrain].color,
        // Add feature for rivers/lakes
        feature: hex.is_river ? "River" : hex.is_lake ? "Lake" : undefined,
        details: hex.is_river ? "Fresh water source" : hex.is_lake ? "Standing water" : undefined,
      };
    });

    updateState((state) => {
      state.wilderness.staticMapData = staticMap;
      state.wilderness.staticMapMode = true;
    });

  } catch (error) {
    throw new Error(`Failed to parse static map JSON: ${(error as Error).message}`);
  }
}

export function unloadStaticMap(): void {
  updateState((state) => {
    state.wilderness.staticMapMode = false;
    state.wilderness.staticMapData = undefined;
  });
}

export { getLightCondition, type LightCondition };


