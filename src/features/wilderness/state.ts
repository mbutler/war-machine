import type {
  DominionResourceType,
  WildernessClimate,
  WildernessHex,
  WildernessState,
  WildernessTerrainType,
} from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { createId } from "../../utils/id";
import { advanceCalendar } from "../calendar/state";

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

const TERRAIN_TABLES: Record<WildernessTerrainType, string[]> = {
  clear: ["Men", "Men", "Flyer", "Humanoid", "Animal", "Animal", "Unusual", "Dragon"],
  woods: ["Men", "Flyer", "Humanoid", "Humanoid", "Animal", "Animal", "Unusual", "Dragon"],
  hills: ["Men", "Flyer", "Humanoid", "Humanoid", "Animal", "Unusual", "Dragon", "Dragon"],
  mountain: ["Men", "Flyer", "Humanoid", "Unusual", "Unusual", "Animal", "Dragon", "Dragon"],
  swamp: ["Men", "Flyer", "Humanoid", "Undead", "Undead", "Swimmer", "Dragon", "Unusual"],
  river: ["Men", "Flyer", "Humanoid", "Swimmer", "Swimmer", "Swimmer", "Animal", "Dragon"],
  desert: ["Men", "Men", "Flyer", "Humanoid", "Undead", "Unusual", "Dragon", "Dragon"],
  city: ["Men", "Men", "Men", "Men", "Men", "Humanoid", "Undead", "Giant"],
  ocean: ["Men", "Men", "Flyer", "Humanoid", "Swimmer", "Swimmer", "Dragon", "Dragon"],
};

const ENCOUNTER_DATA: Record<string, Array<{ name: string; qty: string }>> = {
  menus: [
    { name: "Bandit", qty: "1d6+3" },
    { name: "Brigand", qty: "2d4" },
    { name: "Berserker", qty: "1d6" },
    { name: "Fighter Patrol", qty: "1d6" },
    { name: "Merchant", qty: "1d20" },
    { name: "NPC Party", qty: "1d6+2" },
  ],
  humanoid: [
    { name: "Goblin", qty: "2d4" },
    { name: "Hobgoblin", qty: "1d6" },
    { name: "Orc", qty: "1d6" },
    { name: "Gnoll", qty: "1d6" },
    { name: "Kobold", qty: "4d4" },
    { name: "Ogre", qty: "1d3" },
  ],
  flyer: [
    { name: "Gargoyle", qty: "1d6" },
    { name: "Griffon", qty: "1d6" },
    { name: "Harpy", qty: "1d6" },
    { name: "Hippogriff", qty: "2d8" },
    { name: "Pegasus", qty: "1d12" },
    { name: "Roc", qty: "1d20" },
    { name: "Dragon", qty: "1" },
  ],
  animal: [
    { name: "Antelope", qty: "3d10" },
    { name: "Boar", qty: "1d6" },
    { name: "Great Cat", qty: "1d4" },
    { name: "Bear", qty: "1d4" },
    { name: "Wolf", qty: "2d6" },
  ],
  swimmer: [
    { name: "Crocodile", qty: "1d6" },
    { name: "Giant Fish", qty: "1d6" },
    { name: "Giant Leech", qty: "1d4" },
    { name: "Lizard Men", qty: "2d4" },
  ],
  dragon: [
    { name: "Black Dragon", qty: "1" },
    { name: "Blue Dragon", qty: "1" },
    { name: "Green Dragon", qty: "1" },
    { name: "Red Dragon", qty: "1" },
    { name: "White Dragon", qty: "1" },
    { name: "Chimera", qty: "1d2" },
    { name: "Wyvern", qty: "1d3" },
    { name: "Hydra", qty: "1" },
  ],
  undead: [
    { name: "Ghoul", qty: "1d6" },
    { name: "Skeleton", qty: "3d4" },
    { name: "Wight", qty: "1d3" },
    { name: "Wraith", qty: "1d3" },
    { name: "Vampire", qty: "1" },
    { name: "Spectre", qty: "1d2" },
    { name: "Zombie", qty: "2d4" },
  ],
  unusual: [
    { name: "Basilisk", qty: "1d6" },
    { name: "Centaur", qty: "1d6" },
    { name: "Giant", qty: "1d6" },
    { name: "Lycanthrope", qty: "1d6" },
    { name: "Medusa", qty: "1d3" },
    { name: "Treant", qty: "1d6" },
  ],
  giant: [
    { name: "Hill Giant", qty: "1d4" },
    { name: "Stone Giant", qty: "1d4" },
    { name: "Fire Giant", qty: "1d4" },
  ],
};

const CLASSES = ["Fighter", "Cleric", "Magic-User", "Thief", "Dwarf", "Elf"];
const ALIGNMENTS = ["Lawful", "Neutral", "Chaotic"];

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

    spendMovementPoints(wilderness, finalData.mpCost);
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
    consumeDailySupplies(wilderness);
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
  });
}

function ensureHex(state: WildernessState, q: number, r: number, fromType: WildernessTerrainType): WildernessHex {
  const map = ensureMap(state);
  const key = `${q},${r}`;
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

function spendMovementPoints(state: WildernessState, cost: number) {
  state.movementPoints -= cost;
  while (state.movementPoints <= 0) {
    consumeDailySupplies(state);
    state.movementPoints += state.maxMovementPoints;
  }
}

function consumeDailySupplies(state: WildernessState) {
  const currentHex = sanitizeHex(state.map[keyFromPos(state.currentPos)]);
  const isDesert = currentHex?.type === "desert";
  const waterNeed = isDesert ? state.partySize * 2 : state.partySize;

  state.days += 1;
  advanceCalendar("day", 1);
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

function maybeGenerateEncounter(hex: WildernessHex): string | undefined {
  if (!hex) return undefined;
  const terrainData = TERRAIN_DATA[normalizeTerrainType(hex.type)];
  if (!terrainData) return undefined;
  if (randomRange(1, 6) > terrainData.encounter) {
    return undefined;
  }
  return generateEncounter(hex.type);
}

function generateEncounter(type: WildernessTerrainType): string {
  const normalized = normalizeTerrainType(type);
  const categories = TERRAIN_TABLES[normalized] ?? [];
  const categoryName = categories[randomRange(0, categories.length - 1)] ?? "Men";
  const table = ENCOUNTER_DATA[categoryName.toLowerCase()] ?? ENCOUNTER_DATA.unusual;
  const encounter = table[randomRange(0, table.length - 1)];
  const qty = rollDice(encounter.qty);
  return `ENCOUNTER: ${qty} ${encounter.name} (${categoryName})`;
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


