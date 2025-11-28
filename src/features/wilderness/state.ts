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
import { PLACES } from "../../data/places";

export type WildernessListener = (state: WildernessState) => void;

const MOVEMENT_POINTS_PER_DAY = 24;
const WATER_REFILL_DAYS = 7;
const LOG_LIMIT = 200;

// Fresh water sources - BECMI doesn't specify, so we use reasonable defaults
const REFILL_TERRAINS: WildernessTerrainType[] = ["river"];
const REFILL_FEATURES: string[] = ["Lake", "Spring", "Well", "Pond", "Stream"];

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
  // Exact matches
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

  // Case variations
  "clear": "clear",
  "forest": "woods",
  "hills": "hills",
  "mountains": "mountain",
  "swamp": "swamp",
  "desert": "desert",
  "jungle": "woods",
  "glacier": "mountain",
  "barren": "desert",
  "deep sea": "ocean",
  "sea": "ocean",
  "coast": "clear",

  // Alternative names
  "Grassland": "clear",
  "Plains": "clear",
  "Woodland": "woods",
  "Woods": "woods",
  "Mountain": "mountain", // singular
  "Desert": "desert",     // already included but keeping for clarity
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
// Main table: Roll 1d8 to determine subtable, varies by terrain type
const MAIN_ENCOUNTER_TABLE: Record<WildernessTerrainType, Record<number, string>> = {
  clear: {
    1: "Human",
    2: "Flyer",
    3: "Humanoid",
    4: "Animal",
    5: "Animal",
    6: "Unusual",
    7: "Dragon",
    8: "Insect"
  },
  woods: {
    1: "Human",
    2: "Flyer",
    3: "Humanoid",
    4: "Insect",
    5: "Unusual",
    6: "Animal",
    7: "Animal",
    8: "Dragon"
  },
  hills: {
    1: "Human",
    2: "Flyer",
    3: "Humanoid",
    4: "Unusual",
    5: "Humanoid",
    6: "Humanoid",
    7: "Humanoid",
    8: "Dragon"
  },
  mountain: {
    1: "Human",
    2: "Flyer",
    3: "Humanoid",
    4: "Unusual",
    5: "Humanoid",
    6: "Humanoid",
    7: "Humanoid",
    8: "Dragon"
  },
  swamp: {
    1: "Human",
    2: "Flyer",
    3: "Humanoid",
    4: "Swimmer",
    5: "Undead",
    6: "Undead",
    7: "Insect",
    8: "Dragon"
  },
  desert: {
    1: "Human",
    2: "Flyer",
    3: "Humanoid",
    4: "Human",
    5: "Animal",
    6: "Undead",
    7: "Animal",
    8: "Animal"
  },
  city: {
    1: "Human",
    2: "Undead",
    3: "Humanoid",
    4: "Human",
    5: "Human",
    6: "Human",
    7: "Human",
    8: "Special"
  },
  river: {
    1: "Human",
    2: "Flyer",
    3: "Humanoid",
    4: "Insect",
    5: "Swimmer",
    6: "Animal",
    7: "Dragon",
    8: "Dragon"
  },
  ocean: {
    1: "Human",
    2: "Flyer",
    3: "Swimmer",
    4: "Swimmer",
    5: "Swimmer",
    6: "Swimmer",
    7: "Swimmer",
    8: "Dragon"
  }
};

// Terrain groupings for subtable lookups (BECMI terrain categories)
const TERRAIN_GROUPINGS: Record<WildernessTerrainType, string> = {
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

// BECMI Wilderness Encounter Subtables - Full Implementation
const ENCOUNTER_DATA: Record<string, Record<string, Array<{ name: string; qty: string; treasure?: string }>>> = {
  // Subtable 1: Animals (terrain-specific)
  animal: {
    Clear: [
      { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
      { name: "Baboon, Rock", qty: "1d6", treasure: "Nil" },
      { name: "Boar", qty: "1d6", treasure: "Nil" },
      { name: "Cat, Lion", qty: "1d4", treasure: "Nil" },
      { name: "Elephant", qty: "1", treasure: "Nil" },
      { name: "Ferret, Giant", qty: "1d6", treasure: "Nil" },
      { name: "Horse, Riding", qty: "1d6", treasure: "Nil" },
      { name: "Lizard, Draco", qty: "1d6", treasure: "Nil" },
      { name: "Mule", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Viper", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Rattler", qty: "1d6", treasure: "Nil" },
      { name: "Weasel, Giant", qty: "1d4", treasure: "Nil" }
    ],
    Woods: [
      { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
      { name: "Boar", qty: "1d6", treasure: "Nil" },
      { name: "Cat, Panther", qty: "1d4", treasure: "Nil" },
      { name: "Cat, Tiger", qty: "1d4", treasure: "Nil" },
      { name: "Lizard, Gecko", qty: "1d6", treasure: "Nil" },
      { name: "Lizard, Draco", qty: "1d6", treasure: "Nil" },
      { name: "Lizard, Tuatara", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Viper", qty: "1d6", treasure: "Nil" },
      { name: "Spider, Crab", qty: "1d6", treasure: "Nil" },
      { name: "Unicorn", qty: "1d6", treasure: "Nil" },
      { name: "Wolf", qty: "2d6", treasure: "Nil" },
      { name: "Wolf, Dire", qty: "1d4", treasure: "Nil" }
    ],
    River: [
      { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
      { name: "Boar", qty: "1d6", treasure: "Nil" },
      { name: "Cat, Panther", qty: "1d4", treasure: "Nil" },
      { name: "Cat, Tiger", qty: "1d4", treasure: "Nil" },
      { name: "Crab, Giant", qty: "1d6", treasure: "Nil" },
      { name: "Crocodile", qty: "1d6", treasure: "Nil" },
      { name: "Crocodile, Large", qty: "1d3", treasure: "D" },
      { name: "Fish, Rock", qty: "1d6", treasure: "Nil" },
      { name: "Leech, Giant", qty: "1d4", treasure: "Nil" },
      { name: "Rat, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Shrew, Giant", qty: "1d4", treasure: "Nil" },
      { name: "Toad, Giant", qty: "1d6", treasure: "Nil" }
    ],
    Swamp: [
      { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
      { name: "Boar", qty: "1d6", treasure: "Nil" },
      { name: "Cat, Panther", qty: "1d4", treasure: "Nil" },
      { name: "Cat, Tiger", qty: "1d4", treasure: "Nil" },
      { name: "Crab, Giant", qty: "1d6", treasure: "Nil" },
      { name: "Crocodile", qty: "1d6", treasure: "Nil" },
      { name: "Crocodile, Large", qty: "1d3", treasure: "D" },
      { name: "Fish, Rock", qty: "1d6", treasure: "Nil" },
      { name: "Leech, Giant", qty: "1d4", treasure: "Nil" },
      { name: "Rat, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Shrew, Giant", qty: "1d4", treasure: "Nil" },
      { name: "Toad, Giant", qty: "1d6", treasure: "Nil" }
    ],
    Mountain: [
      { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
      { name: "Ape, Snow", qty: "1d4", treasure: "Nil" },
      { name: "Ape, White", qty: "1d4", treasure: "Nil" },
      { name: "Baboon, Rock", qty: "1d6", treasure: "Nil" },
      { name: "Bear, Cave", qty: "1d4", treasure: "Nil" },
      { name: "Bear, Grizzly", qty: "1d4", treasure: "Nil" },
      { name: "Cat, Mountain Lion", qty: "1d4", treasure: "Nil" },
      { name: "Mule", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Viper", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Rattler", qty: "1d6", treasure: "Nil" },
      { name: "Wolf", qty: "2d6", treasure: "Nil" },
      { name: "Wolf, Dire", qty: "1d4", treasure: "Nil" }
    ],
    Desert: [
      { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
      { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
      { name: "Camel", qty: "1d6", treasure: "Nil" },
      { name: "Camel", qty: "1d6", treasure: "Nil" },
      { name: "Cat, Lion", qty: "1d4", treasure: "Nil" },
      { name: "Cat, Lion", qty: "1d4", treasure: "Nil" },
      { name: "Lizard, Gecko", qty: "1d6", treasure: "Nil" },
      { name: "Lizard, Tuatara", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Viper", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Rattler", qty: "1d6", treasure: "Nil" },
      { name: "Spider, Widow", qty: "1d2", treasure: "Nil" },
      { name: "Spider, Tarantella", qty: "1d6", treasure: "Nil" }
    ],
    Jungle: [
      { name: "Animal Herd", qty: "2d10", treasure: "Nil" },
      { name: "Boar", qty: "1d6", treasure: "Nil" },
      { name: "Cat, Panther", qty: "1d4", treasure: "Nil" },
      { name: "Lizard, Draco", qty: "1d6", treasure: "Nil" },
      { name: "Lizard, Gecko", qty: "1d6", treasure: "Nil" },
      { name: "Lizard, Horned", qty: "1d6", treasure: "Nil" },
      { name: "Rat, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Shrew, Giant", qty: "1d4", treasure: "Nil" },
      { name: "Snake, Viper", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Python", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Spitting", qty: "1d6", treasure: "Nil" },
      { name: "Spider, Crab", qty: "1d6", treasure: "Nil" }
    ],
    Prehistoric: [
      { name: "Bear, Cave", qty: "1d4", treasure: "Nil" },
      { name: "Cat, Sabretooth", qty: "1d2", treasure: "Nil" },
      { name: "Crocodile, Giant", qty: "1", treasure: "D" },
      { name: "Elephant, Mastodon", qty: "1", treasure: "Nil" },
      { name: "Pterodactyl", qty: "1d4", treasure: "Nil" },
      { name: "Pteranodon", qty: "1d4", treasure: "Nil" },
      { name: "Snake, Racer", qty: "1d6", treasure: "Nil" },
      { name: "Snake, Viper", qty: "1d6", treasure: "Nil" },
      { name: "Triceratops", qty: "1d6", treasure: "Nil" },
      { name: "Triceratops", qty: "1d6", treasure: "Nil" },
      { name: "Tyrannosaurus", qty: "1", treasure: "Nil" },
      { name: "Wolf, Dire", qty: "2d6", treasure: "Nil" }
    ]
  },

  // Subtable 2: Humanoids
  humanoid: {
    Clear: [
      { name: "Bugbear", qty: "1d6", treasure: "B" },
      { name: "Elf", qty: "1d6", treasure: "(E) E" },
      { name: "Giant, Hill", qty: "1d4", treasure: "D" },
      { name: "Gnoll", qty: "2d4", treasure: "(R) C" },
      { name: "Goblin", qty: "2d4", treasure: "(R) C" },
      { name: "Halfing", qty: "1d6", treasure: "(O) N" },
      { name: "Hobgoblin", qty: "1d6", treasure: "(Q) D" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Pixie", qty: "2d4", treasure: "(S) R" },
      { name: "Thoul", qty: "1d6", treasure: "(B) F" },
      { name: "Troll", qty: "1d3", treasure: "(D) E" }
    ],
    Woods: [
      { name: "Bugbear", qty: "1d6", treasure: "B" },
      { name: "Cyclops", qty: "1", treasure: "E" },
      { name: "Dryad", qty: "1", treasure: "(B) E" },
      { name: "Elf", qty: "1d6", treasure: "(E) E" },
      { name: "Giant, Hill", qty: "1d4", treasure: "D" },
      { name: "Gnoll", qty: "2d4", treasure: "(R) C" },
      { name: "Goblin", qty: "2d4", treasure: "(R) C" },
      { name: "Hobgoblin", qty: "1d6", treasure: "(Q) D" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Thoul", qty: "1d6", treasure: "(B) F" },
      { name: "Troll", qty: "1d3", treasure: "(D) E" }
    ],
    River: [
      { name: "Bugbear", qty: "1d6", treasure: "B" },
      { name: "Elf", qty: "1d6", treasure: "(E) E" },
      { name: "Gnoll", qty: "2d4", treasure: "(R) C" },
      { name: "Hobgoblin", qty: "1d6", treasure: "(Q) D" },
      { name: "Lizard Man", qty: "2d4", treasure: "D" },
      { name: "Lizard Man", qty: "2d4", treasure: "D" },
      { name: "Nixie", qty: "2d4", treasure: "(B) E" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Sprite", qty: "2d4", treasure: "(S) R" },
      { name: "Thoul", qty: "1d6", treasure: "(B) F" },
      { name: "Troll", qty: "1d3", treasure: "(D) E" }
    ],
    Swamp: [
      { name: "Gnoll", qty: "2d4", treasure: "(R) C" },
      { name: "Goblin", qty: "2d4", treasure: "(R) C" },
      { name: "Hobgoblin", qty: "1d6", treasure: "(Q) D" },
      { name: "Lizard Man", qty: "2d4", treasure: "D" },
      { name: "Lizard Man", qty: "2d4", treasure: "D" },
      { name: "Nixie", qty: "2d4", treasure: "(B) E" },
      { name: "Nixie", qty: "2d4", treasure: "(B) E" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Troglodyte", qty: "1d6", treasure: "(Q) D" },
      { name: "Troll", qty: "1d3", treasure: "(D) E" },
      { name: "Troll", qty: "1d3", treasure: "(D) E" }
    ],
    Mountain: [
      { name: "Dwarf", qty: "2d4", treasure: "(M) G" },
      { name: "Giant, Cloud", qty: "1", treasure: "E" },
      { name: "Giant, Frost", qty: "1", treasure: "E" },
      { name: "Giant, Hill", qty: "1d4", treasure: "D" },
      { name: "Giant, Stone", qty: "1", treasure: "E" },
      { name: "Giant, Storm", qty: "1", treasure: "E" },
      { name: "Gnome", qty: "1d6", treasure: "(O) N" },
      { name: "Goblin", qty: "2d4", treasure: "(R) C" },
      { name: "Hobgoblin", qty: "1d6", treasure: "(Q) D" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Troglodyte", qty: "1d6", treasure: "(Q) D" },
      { name: "Troll", qty: "1d3", treasure: "(D) E" }
    ],
    Desert: [
      { name: "Giant, Fire", qty: "1", treasure: "E" },
      { name: "Goblin", qty: "2d4", treasure: "(R) C" },
      { name: "Hobgoblin", qty: "1d6", treasure: "(Q) D" },
      { name: "Hobgoblin", qty: "1d6", treasure: "(Q) D" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Pixie", qty: "2d4", treasure: "(S) R" },
      { name: "Sprite", qty: "2d4", treasure: "(S) R" },
      { name: "Thoul", qty: "1d6", treasure: "(B) F" }
    ],
    Settled: [
      { name: "Dwarf", qty: "2d4", treasure: "(M) G" },
      { name: "Elf", qty: "1d6", treasure: "(E) E" },
      { name: "Giant, Hill", qty: "1d4", treasure: "D" },
      { name: "Gnome", qty: "1d6", treasure: "(O) N" },
      { name: "Gnoll", qty: "2d4", treasure: "(R) C" },
      { name: "Goblin", qty: "2d4", treasure: "(R) C" },
      { name: "Halfing", qty: "1d6", treasure: "(O) N" },
      { name: "Hobgoblin", qty: "1d6", treasure: "(Q) D" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Sprite", qty: "2d4", treasure: "(S) R" },
      { name: "Sprite", qty: "2d4", treasure: "(S) R" }
    ],
    Jungle: [
      { name: "Bugbear", qty: "1d6", treasure: "B" },
      { name: "Cyclops", qty: "1", treasure: "E" },
      { name: "Elf", qty: "1d6", treasure: "(E) E" },
      { name: "Giant, Fire", qty: "1", treasure: "E" },
      { name: "Giant, Hill", qty: "1d4", treasure: "D" },
      { name: "Gnoll", qty: "2d4", treasure: "(R) C" },
      { name: "Goblin", qty: "2d4", treasure: "(R) C" },
      { name: "Lizard Man", qty: "2d4", treasure: "D" },
      { name: "Ogre", qty: "1d6", treasure: "(C) E" },
      { name: "Orc", qty: "2d6", treasure: "(Q) D" },
      { name: "Troglodyte", qty: "1d6", treasure: "(Q) D" },
      { name: "Troll", qty: "1d3", treasure: "(D) E" }
    ]
  },


  // Subtable 4: Flyers (universal)
  flyer: {
    Mountain: [
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
      { name: "Roc, Giant", qty: "1", treasure: "I" }
    ],
    Desert: [
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
      { name: "Roc, Giant", qty: "1", treasure: "I" }
    ],
    AllOther: [
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
      { name: "Roc, Giant", qty: "1", treasure: "I" }
    ]
  },

  // Subtable 5: Swimmers (terrain-specific)
  swimmer: {
    River: [
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
      { name: "Turtle, Giant", qty: "1d2", treasure: "Nil" }
    ],
    Ocean: [
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
      { name: "Turtle, Giant", qty: "1d2", treasure: "Nil" }
    ]
  },

  // Subtable 6: Dragons (universal, with sea variation)
  dragon: {
    Land: [
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Chimera", qty: "1d2", treasure: "F" },
      { name: "Dragon, Black", qty: "1", treasure: "H" },
      { name: "Dragon, Blue", qty: "1", treasure: "H" },
      { name: "Dragon, Gold", qty: "1", treasure: "H" },
      { name: "Dragon, Green", qty: "1", treasure: "H" },
      { name: "Dragon, Red", qty: "1", treasure: "H" },
      { name: "Dragon, White", qty: "1", treasure: "H" },
      { name: "Hydra", qty: "1", treasure: "B" },
      { name: "Hydra", qty: "1", treasure: "B" },
      { name: "Wyvern", qty: "1d3", treasure: "E" },
      { name: "Salamander, Flame", qty: "1d4", treasure: "E" },
      { name: "Salamander, Frost", qty: "1d4", treasure: "E" }
    ],
    Sea: [
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" }
    ]
  },

  // Subtable 7: Insect (universal)
  insect: {
    All: [
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" },
      { name: "Ant, Giant", qty: "2d6", treasure: "Nil" }
    ]
  },

  // Subtable 8: Undead (universal)
  undead: {
    All: [
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
      { name: "Zombie", qty: "2d4", treasure: "Nil" }
    ]
  },

  // Subtable 9: Unusual (universal)
  unusual: {
    All: [
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
      { name: "Treant", qty: "1d6", treasure: "C" }
    ]
  },

  // Subtable 10: Castle Encounters (BECMI p.98)
  castle: {
    All: [
      { name: "Castle Patrol", qty: "2d6", treasure: "Nil", castle: { class: "Cleric", level: "1d20+8", alignment: "Lawful" } },
      { name: "Castle Patrol", qty: "2d6", treasure: "Nil", castle: { class: "Magic-User", level: "1d20+8", alignment: "Neutral" } },
      { name: "Castle Patrol", qty: "2d6", treasure: "Nil", castle: { class: "Demihuman", level: "varies", alignment: "Chaotic" } },
      { name: "Castle Patrol", qty: "2d6", treasure: "Nil", castle: { class: "Fighter", level: "1d20+8", alignment: "Neutral" } },
      { name: "Castle Patrol", qty: "2d6", treasure: "Nil", castle: { class: "Fighter", level: "1d20+8", alignment: "Lawful" } },
      { name: "Castle Patrol", qty: "2d6", treasure: "Nil", castle: { class: "Fighter", level: "1d20+8", alignment: "Lawful" } }
    ]
  },

  // Subtable 11: City Encounters (8 sections, 1d20 each)
  city: {
    Section1: [
      "Alchemist", "Animal Trainer", "Apothecary", "Archaeologist", "Armorer", "Artist/Sculptor", "Assassin", "Astrologer", "Astronomer", "Athlete",
      "Baker", "Banker", "Barber", "Bartender", "Basketweaver", "Bazaar Merchant", "Beeceeper", "Beggar", "Blacksmith", "Boardinghouse Keeper"
    ],
    Section2: [
      "Boatman/Gondolier", "Bodyguard", "Bonecarver", "Bootmaker", "Bowyer", "Brewer", "Broommaker", "Butcher", "Candlemaker", "Caravan Master",
      "Carter", "Chandler", "Charcoalmaker", "Chef", "Chemist", "Church/Temple", "Employee", "Cleric Adventurer", "Coachman", "Bootmaker"
    ],
    Section3: [
      "Construction Worker", "Cooper", "Craft Guildsman", "Dairy Worker", "Dancer", "Diplomat", "Driver", "Dockman/Wharfsman", "Doctor/Dentist", "Droid Adventurer",
      "Dwarf Adventurer", "Elf Adventurer", "Entertainer", "Farmer", "Ferryman", "Fighter Adventurer", "Church/Temple", "Fighter, Mercenary", "Fisherman", "Fletcher"
    ],
    Section4: [
      "Freighter", "Furnituremaker", "Furrier", "Gambler", "Gemcutter", "Gentleman/Lady", "Geologist", "Glassblower", "Goldsmith", "Government Official",
      "Graveyard Keeper", "Guardsman", "Guide", "Guild Officer", "Halffling Adventurer", "Harlot", "Healer", "Herbalist", "Hunter", "Innkeeper"
    ],
    Section5: [
      "Freighter", "Jeweler", "Judge", "Juggler/Mime", "Kennel Keeper", "Laborer", "Land Officer", "Lawyer", "Leatherworker", "Magic-User Adventurer",
      "Magic-User Guild Officer", "Majordomo", "Mason", "Mayor", "Madame", "Madman", "Thief Adventurer", "Thieves' Guild Officer", "Town Drunk", "Town Hall Employee"
    ],
    Section6: [
      "Trading Post Employee", "Translator", "Treasurer", "Undertaker", "Vagrant", "Vigilante", "Warehouse Worker", "Watchman", "Watering-Hole Worker", "Weaver",
      "Welldigger", "Wellkeeper", "Wheelwright", "Winemaker", "Woodcarver", "Woodcutter", "Schoolteacher", "Scribe", "Serf", "Servant, Hired"
    ],
    Section7: [
      "Servant, Indentured", "Shipwright", "Singer", "Slave", "Smuggler", "Soapmaker", "Spy", "Stablekeeper", "Stoneworker", "Tailor",
      "Tanner", "Tavernkeeper", "Tax Assessor", "Taxidermist", "Thatcher", "Schoolteacher", "Scribe", "Serf", "Servant, Hired", "Servant, Indentured"
    ],
    Section8: [
      "Shipwright", "Singer", "Slave", "Smuggler", "Soapmaker", "Spy", "Stablekeeper", "Stoneworker", "Tailor", "Tanner",
      "Tavernkeeper", "Tax Assessor", "Taxidermist", "Thatcher", "Town Drunk", "Town Hall Employee", "Trading Post Employee", "Translator", "Treasurer", "Undertaker"
    ]
  }
};

const CLASSES = ["Fighter", "Cleric", "Magic-User", "Thief", "Druid", "Mystic", "Dwarf", "Elf"];
const ALIGNMENTS = ["Lawful", "Neutral", "Chaotic"];

function shouldGenerateCastle(terrainType: WildernessTerrainType, randomValue: number): boolean {
  // Terrain-based castle generation probabilities (DM discretion, no BECMI rules)
  switch (terrainType) {
    case "mountain":
      return randomValue < 0.60; // 60% chance - very likely, strategic high ground
    case "hills":
      return randomValue < 0.30; // 30% chance - likely, good defensive positions
    case "woods":
      return randomValue < 0.05; // 5% chance - hard to defend and maintain
    default:
      return randomValue < 0.01; // 1% chance - uncommon in poor terrain
  }
}

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

// Helper function to check if a hex and its neighbors are safe for starting
function isSafeStartingArea(staticMapData: Record<string, WildernessHex>, q: number, r: number): boolean {
  // Check the starting hex itself
  const centerKey = `${q},${r}`;
  const centerHex = staticMapData[centerKey];
  if (!centerHex || centerHex.type === 'ocean') {
    return false;
  }

  // Check immediate neighbors (hex ring distance 1)
  const neighbors = [
    { q: q + 1, r: r },     // East
    { q: q + 1, r: r - 1 }, // Southeast
    { q: q, r: r - 1 },     // Southwest
    { q: q - 1, r: r },     // West
    { q: q - 1, r: r + 1 }, // Northwest
    { q: q, r: r + 1 },     // Northeast
  ];

  // At least 3 out of 6 neighbors should be non-ocean for a safe starting area
  let safeNeighbors = 0;
  for (const neighbor of neighbors) {
    const neighborKey = `${neighbor.q},${neighbor.r}`;
    const neighborHex = staticMapData[neighborKey];
    if (neighborHex && neighborHex.type !== 'ocean') {
      safeNeighbors++;
    }
  }

  return safeNeighbors >= 3;
}

// Helper function to find a suitable starting position in static map mode
function findStaticMapStartingPosition(staticMapData: Record<string, WildernessHex>): { q: number; r: number } {
  // First, collect all non-ocean hexes
  const candidateStarts: { q: number; r: number }[] = [];

  for (const [key, hex] of Object.entries(staticMapData)) {
    if (hex.type !== 'ocean') {
      const [q, r] = key.split(',').map(Number);
      candidateStarts.push({ q, r });
    }
  }

  // If no candidates, default to origin
  if (candidateStarts.length === 0) {
    return { q: 0, r: 0 };
  }

  // Filter to hexes that have a safe starting area (non-ocean center + enough safe neighbors)
  const safeStarts = candidateStarts.filter(pos => isSafeStartingArea(staticMapData, pos.q, pos.r));

  // If we have safe starts, use those; otherwise fall back to any non-ocean hex
  const validStarts = safeStarts.length > 0 ? safeStarts : candidateStarts;

  // Randomly select from valid starting positions
  const randomIndex = Math.floor(Math.random() * validStarts.length);
  const selectedPos = validStarts[randomIndex];

  // Debug: log starting position selection
  console.log(`Selected starting position: (${selectedPos.q}, ${selectedPos.r}) from ${validStarts.length} safe options`);

  return selectedPos;
}

export function resetWilderness(options: { startTerrain?: WildernessTerrainType; climate?: WildernessClimate } = {}) {
  updateState((state) => {
    const start = normalizeTerrainType(options.startTerrain ?? state.wilderness.startTerrain);
    const partySize = state.wilderness.partySize || 6;

    // Determine starting position - use random non-ocean hex if static map is available
    let startingPos = { q: 0, r: 0 };
    if (state.wilderness.staticMapMode && state.wilderness.staticMapData) {
      startingPos = findStaticMapStartingPosition(state.wilderness.staticMapData);
    }

    // Generate starting feature based on terrain type
    let startFeature = "Start";
    let startDetails = "Safe Haven";
    let startResources: DominionResourceType[] = [];

    if (start === "city") {
      // Create a large starting city
      const settlement = generateLargeCity();
      startFeature = `${settlement.name} (${settlement.size}) - START`;
      startDetails = `Population: ${settlement.population}. Ruler: ${settlement.ruler}. Services: ${settlement.services}. Your party's starting location.`;
    }

    state.wilderness = {
      map: {
        [`${startingPos.q},${startingPos.r}`]: {
          type: start,
          resources: startResources,
          feature: startFeature,
          details: startDetails,
          color: TERRAIN_DATA[start].color,
          visited: true,
        },
      },
      currentPos: startingPos,
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

export function forageFullDay() {
  updateState((state) => {
    const wilderness = state.wilderness;
    const currentHex = sanitizeHex(wilderness.map[keyFromPos(wilderness.currentPos)]);
    if (!currentHex) return;

    // Check for required resources (Animal or Vegetable) - BECMI allows foraging in suitable terrain
    const hasResources = currentHex.resources && (currentHex.resources.includes("Animal") || currentHex.resources.includes("Vegetable"));
    const terrain = TERRAIN_DATA[currentHex.type];
    const terrainAllowsForaging = terrain.forage > 0; // Desert doesn't allow foraging

    if (!hasResources && !terrainAllowsForaging) {
      addLogEntry(wilderness, {
        terrain: currentHex.type,
        summary: "Cannot forage here.",
        notes: "No suitable food sources in this area.",
      });
      return;
    }

    // Advance calendar directly in the same updateState transaction - full day
    const calendar = state.calendar;
    const before = describeClock(calendar.clock);
    advanceClock(calendar.clock, "hour", 24);
    const after = describeClock(calendar.clock);
    addCalendarLog(calendar, `Time passed: +1 day`, `${before} → ${after}`);

    // BECMI: Full day foraging is automatically successful
    const found = randomRange(6, 12); // More food when spending full day
    wilderness.rations += found;
    addLogEntry(wilderness, {
      terrain: currentHex.type,
      summary: "Full day foraging successful.",
      notes: `Found ${found} rations.`,
    });
    wilderness.weather = generateWeather(wilderness.climate);
  });
}

export function forageCurrentHex() {
  updateState((state) => {
    const wilderness = state.wilderness;
    const currentHex = sanitizeHex(wilderness.map[keyFromPos(wilderness.currentPos)]);
    if (!currentHex) return;

    // Check for required resources (Animal or Vegetable) - BECMI allows foraging in suitable terrain
    const hasResources = currentHex.resources && (currentHex.resources.includes("Animal") || currentHex.resources.includes("Vegetable"));
    const terrain = TERRAIN_DATA[currentHex.type];
    const terrainAllowsForaging = terrain.forage > 0; // Desert doesn't allow foraging

    if (!hasResources && !terrainAllowsForaging) {
      addLogEntry(wilderness, {
        terrain: currentHex.type,
        summary: "Cannot forage here.",
        notes: "No suitable food sources in this area.",
      });
      return;
    }

    // Advance calendar directly in the same updateState transaction
    const calendar = state.calendar;
    const before = describeClock(calendar.clock);
    advanceClock(calendar.clock, "hour", 2);
    const after = describeClock(calendar.clock);
    addCalendarLog(calendar, `Time passed: +2 hours`, `${before} → ${after}`);

    // BECMI foraging: 50% base chance (1-3 on d6) modified by terrain
    const baseChance = 3; // 1-3 on d6 (50% success)
    // Better terrain improves foraging success: forage value acts as bonus
    const terrainModifier = Math.max(0, terrain.forage - 1); // Desert=0, Clear/Mountain=0, Hills/Swamp=1, Woods/River=2, City=5
    const finalChance = Math.max(1, Math.min(6, baseChance + terrainModifier));

    const roll = randomRange(1, 6);
    if (roll <= finalChance) {
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
    const currentHex = sanitizeHex(wilderness.map[keyFromPos(wilderness.currentPos)]);
    if (!currentHex) return;

    if (!canRefillWater(wilderness)) {
      addLogEntry(wilderness, {
        terrain: currentHex.type,
        summary: "No fresh water source nearby.",
      });
      return;
    }

    // Small time cost for refilling waterskins
    const calendar = state.calendar;
    const before = describeClock(calendar.clock);
    advanceClock(calendar.clock, "hour", 1);
    const after = describeClock(calendar.clock);
    addCalendarLog(calendar, `Time passed: +1 hour`, `${before} → ${after}`);

    wilderness.water = wilderness.partySize * WATER_REFILL_DAYS;
    addLogEntry(wilderness, {
      terrain: currentHex.type,
      summary: "Waterskins refilled.",
      notes: "Fresh water found and collected.",
    });
    wilderness.weather = generateWeather(wilderness.climate);
  });
}

export function canRefillWater(state: WildernessState = getWildernessState()): boolean {
  const map = state.map ?? {};
  const hex = map[keyFromPos(state.currentPos)];
  if (!hex) return false;

  // Check terrain type (rivers)
  if (REFILL_TERRAINS.includes(hex.type)) return true;

  // Check for water features (from static maps or procedural generation)
  if (hex.feature && REFILL_FEATURES.includes(hex.feature)) return true;

  // In settlements, assume access to wells/springs
  if (hex.type === "city") return true;

  return false;
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

  // In static map mode, if no static data exists for this hex, use a default terrain
  // instead of procedural generation to ensure consistency
  if (state.staticMapMode) {
    const defaultHex: WildernessHex = {
      type: "clear", // Default to clear terrain
      resources: [],
      visited: true,
      color: TERRAIN_DATA.clear.color,
    };
    map[key] = defaultHex;
    return defaultHex;
  }

  if (map[key]) {
    map[key] = sanitizeHex(map[key]);
    map[key]!.visited = true;
    return map[key]!;
  }

  const generated = generateHex(fromType, q, r);
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

function generateHex(fromType: WildernessTerrainType, q?: number, r?: number): WildernessHex {
  // Use coordinates as seed for deterministic generation
  const seed = q !== undefined && r !== undefined ? (q * 1000 + r) : Math.random();
  const seededRandom = seededRandomGenerator(seed);

  const type = selectTerrain(fromType, seededRandom);
  const resources: DominionResourceType[] = [];

  // Resource availability based on terrain type - better foraging terrain has more resources
  const terrainData = TERRAIN_DATA[type];
  const animalChance = Math.min(0.8, 0.1 + (terrainData.forage * 0.2)); // Desert=10%, Clear/Mountain=30%, Woods/River=70%, City=100%
  const vegetableChance = Math.min(0.8, 0.1 + (terrainData.forage * 0.2));
  const mineralChance = 0.1; // Minerals are rarer and terrain-independent

  if (seededRandom() < animalChance) resources.push("Animal");
  if (seededRandom() < vegetableChance) resources.push("Vegetable");
  if (seededRandom() < mineralChance) resources.push("Mineral");

  let feature: string | null = null;
  let details: string | null = null;

  // BECMI-compliant hex features - NOT random probabilities, should be DM-placed
  // For procedural generation, we use reasonable default distributions with comments
  // In a proper BECMI campaign, these would be placed by the DM based on campaign needs

  // Towns: Should be DM-placed near water sources. For procedural gen, 15% chance in suitable terrain
  if (type === "city" || (type === "clear" && seededRandom() < 0.15)) { // NOT RAW: procedural town placement
    const settlement = generateSettlement(seededRandom);
    feature = `${settlement.name} (${settlement.size})`;
    details = `Population: ${settlement.population}. Ruler: ${settlement.ruler}. Services: ${settlement.services}.`;
  }
  // Castles: Terrain-based frequency (no BECMI rules, DM discretion)
  // Mountains: 80% chance (extremely likely, strategic high ground)
  // Hills: 50% chance (good defensive positions)
  // Woods: 5% chance (hard to defend, maintain)
  // Everything else: 1% chance (uncommon in poor terrain)
  else if (shouldGenerateCastle(type, seededRandom())) { // Custom terrain-based castle placement
    const castleNameIndex = Math.floor(seededRandom() * PLACES.length);
    const castleName = PLACES[castleNameIndex];
    feature = `${castleName} Castle`;

    // BECMI Subtable 10: Castle Encounters
    const classRoll = Math.floor(seededRandom() * 6) + 1; // 1d6
    let ownerClass: string;
    let ownerLvl: number;

    if (classRoll === 1) {
      ownerClass = "Cleric";
      ownerLvl = Math.floor(seededRandom() * 20) + 9; // 1d20 + 8
    } else if (classRoll === 2) {
      ownerClass = "Magic-User";
      ownerLvl = Math.floor(seededRandom() * 20) + 9; // 1d20 + 8
    } else if (classRoll === 3) {
      // Demihuman - roll 1d6 for sub-type
      const demihumanRoll = Math.floor(seededRandom() * 6) + 1;
      if (demihumanRoll <= 2) {
        ownerClass = "Dwarf";
        ownerLvl = 12; // Fixed level per BECMI
      } else if (demihumanRoll <= 4) {
        ownerClass = "Elf";
        ownerLvl = 10; // Fixed level per BECMI
      } else {
        ownerClass = "Halfling";
        ownerLvl = 8; // Fixed level per BECMI
      }
    } else {
      // classRoll 4-6
      ownerClass = "Fighter";
      ownerLvl = Math.floor(seededRandom() * 20) + 9; // 1d20 + 8
    }

    // Alignment: 1d6 - Chaotic 1/6, Neutral 3/6, Lawful 2/6
    const alignRoll = Math.floor(seededRandom() * 6) + 1;
    let align: string;
    if (alignRoll === 1) {
      align = "Chaotic";
    } else if (alignRoll <= 4) {
      align = "Neutral";
    } else {
      align = "Lawful";
    }

    const troops = (Math.floor(seededRandom() * 4) + 1) * 10;
    details = `${align} ${ownerClass} (Lvl ${ownerLvl}). Garrison: ${troops}.`;
  }
  // Ruins: Should be DM-placed for adventure hooks. For procedural gen, rare everywhere
  else if (seededRandom() < 0.02) { // NOT RAW: procedural ruin placement
    const ruinNameIndex = Math.floor(seededRandom() * PLACES.length);
    const ruinName = PLACES[ruinNameIndex];
    feature = `${ruinName} Ruins`;
    details = "Ancient crumbling walls. Possible dungeon entrance.";
  }
  // Water sources: Springs, ponds, streams - make water more available in wilderness
  else if (seededRandom() < 0.05) { // 5% chance for water features in suitable terrain
    const waterFeatures = ["Spring", "Pond", "Stream"];
    feature = waterFeatures[Math.floor(seededRandom() * waterFeatures.length)];
    details = `Fresh water source - can refill waterskins here.`;
  }
  // Lairs: Should result from encounters. For procedural gen, occasional lairs
  else if (seededRandom() < 0.08) { // NOT RAW: procedural lair placement
    const lairNameIndex = Math.floor(seededRandom() * PLACES.length);
    const lairName = PLACES[lairNameIndex];
    feature = `${lairName} Lair`;
    details = "Monster lair - roll for encounter when investigated.";
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

// Simple seeded random number generator for deterministic procedural generation
function seededRandomGenerator(seed: number) {
  let x = Math.sin(seed) * 10000;
  return function() {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
}

function selectTerrain(fromType: WildernessTerrainType, randomFn = Math.random): WildernessTerrainType {
  const normalized = normalizeTerrainType(fromType);
  const table = TERRAIN_DATA[normalized]?.tables;
  if (!table) return normalized;
  const roll = Math.floor(randomFn() * 20) + 1;
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

  // Roll 1d8 on terrain-specific main table to determine subtable
  const mainRoll = randomRange(1, 8);
  const subtableName = MAIN_ENCOUNTER_TABLE[normalized][mainRoll];

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

function rollOnSubtable(subtableName: string, terrainGroup: string): { categoryName: string; encounter: { name: string; qty: string; treasure?: string; castle?: any } } {
  let tableKey: string;
  let subKey: string;
  let roll: number;

  // Map subtable names to table keys and determine appropriate sub-key
  switch (subtableName) {
    case "Human":
      tableKey = "human";
      // Map terrain group to appropriate human subtable
      if (terrainGroup === "Clear") subKey = "Clear";
      else if (terrainGroup === "Settled") subKey = "Settled";
      else if (terrainGroup === "Woods") subKey = "Woods";
      else if (terrainGroup === "River") subKey = "River";
      else if (terrainGroup === "Mountain") subKey = "Mountain";
      else if (terrainGroup === "Desert") subKey = "Desert";
      else if (terrainGroup === "Ocean") subKey = "Ocean";
      else if (terrainGroup === "Jungle") subKey = "Jungle";
      else if (terrainGroup === "Swamp") subKey = "Swamp";
      else subKey = "Clear"; // Default
      roll = randomRange(1, 12);
      break;

    case "Humanoid":
      tableKey = "humanoid";
      subKey = terrainGroup;
      roll = randomRange(1, 12);
      break;

    case "Animal":
      tableKey = "animal";
      subKey = terrainGroup;
      roll = randomRange(1, 12);
      break;

    case "Flyer":
      tableKey = "flyer";
      if (terrainGroup === "Mountain") subKey = "Mountain";
      else if (terrainGroup === "Desert") subKey = "Desert";
      else subKey = "AllOther";
      roll = randomRange(1, 12);
      break;

    case "Insect":
      tableKey = "insect";
      subKey = "All";
      roll = randomRange(1, 12);
      break;

    case "Swimmer":
      tableKey = "swimmer";
      subKey = terrainGroup; // River or Ocean
      roll = randomRange(1, 12);
      break;

    case "Unusual":
      tableKey = "unusual";
      subKey = "All";
      roll = randomRange(1, 12);
      break;

    case "Dragon":
      tableKey = "dragon";
      subKey = terrainGroup === "Ocean" ? "Sea" : "Land";
      roll = randomRange(1, subKey === "Sea" ? 10 : 12);
      break;

    case "Undead":
      tableKey = "undead";
      subKey = "All";
      roll = randomRange(1, 12);
      break;

    case "Special":
      if (terrainGroup === "City") {
        // City special encounters - use city table
        tableKey = "city";
        const sectionRoll = randomRange(1, 8);
        subKey = `Section${sectionRoll}`;
        roll = randomRange(1, 20);
        // For city encounters, we need to handle this differently
        const cityTable = ENCOUNTER_DATA[tableKey][subKey];
        const encounterName = cityTable[roll - 1];
        return {
          categoryName: "City Encounter",
          encounter: { name: encounterName, qty: "1", treasure: "V" }
        };
      } else {
        // Castle encounters for settled/castle terrain
        tableKey = "castle";
        subKey = "All";
        roll = randomRange(1, 6);

        // Handle demihuman sub-roll if roll = 3
        if (roll === 3) {
          const demihumanRoll = randomRange(1, 6);
          let demihumanType: string;
          let demihumanLevel: number;

          if (demihumanRoll <= 2) {
            demihumanType = "Dwarf";
            demihumanLevel = 12;
          } else if (demihumanRoll <= 4) {
            demihumanType = "Elf";
            demihumanLevel = 10;
          } else {
            demihumanType = "Halfling";
            demihumanLevel = 8;
          }

          // Update the encounter with specific demihuman details
          const table = ENCOUNTER_DATA[tableKey]?.[subKey];
          if (table && table[roll - 1]) {
            table[roll - 1].castle = {
              class: demihumanType,
              level: demihumanLevel.toString(),
              alignment: table[roll - 1].castle?.alignment || "Chaotic"
            };
          }
        }
      }
      break;

    default:
      tableKey = "animal";
      subKey = "Clear";
      roll = randomRange(1, 12);
  }

  const table = ENCOUNTER_DATA[tableKey]?.[subKey];
  if (!table) {
    // Fallback
    return { categoryName: "Unknown", encounter: { name: "Unknown Creature", qty: "1", treasure: "Nil" } };
  }

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

function generateSettlement(seededRandom = Math.random) {
  // Select a random name from the PLACES array
  const nameIndex = Math.floor(seededRandom() * PLACES.length);
  const name = PLACES[nameIndex];

  // Convert dice rolls to seeded random
  const popRoll = Math.floor(seededRandom() * 6) + Math.floor(seededRandom() * 6) + 2; // 2d6
  let size = "Village";
  let population = (Math.floor(seededRandom() * 10) + 1) * 50; // 1d10 * 50

  if (popRoll >= 11) {
    size = "City";
    population = (Math.floor(seededRandom() * 10) + Math.floor(seededRandom() * 10) + 2) * 1000; // 2d10 * 1000
  } else if (popRoll >= 8) {
    size = "Town";
    population = (Math.floor(seededRandom() * 10) + 1) * 200 + 500; // 1d10 * 200 + 500
  }

  const rulerLevel = Math.floor(seededRandom() * 6) + 8 + 1; // 1d6 + 8
  const rulerClass = CLASSES[Math.floor(seededRandom() * CLASSES.length)];

  const services = ["Market"];
  if (size !== "Village") {
    services.push("Inn", "Blacksmith", "Temple");
  }
  if (size === "City") {
    services.push("Magic Guild", "Thieves Guild", "Arena");
  }

  return {
    name,
    size,
    population,
    ruler: `Lvl ${rulerLevel} ${rulerClass}`,
    services: services.join(", "),
  };
}

function generateLargeCity(seededRandom = Math.random) {
  // Select a random name from the PLACES array
  const nameIndex = Math.floor(seededRandom() * PLACES.length);
  const name = PLACES[nameIndex];

  // Force city generation - use a high population roll
  const size = "City";
  const population = (Math.floor(seededRandom() * 10) + Math.floor(seededRandom() * 10) + 2) * 1000; // 2d10 * 1000

  const rulerLevel = Math.floor(seededRandom() * 6) + 8 + 1; // 1d6 + 8
  const rulerClass = CLASSES[Math.floor(seededRandom() * CLASSES.length)];

  const services = ["Market", "Inn", "Blacksmith", "Temple", "Magic Guild", "Thieves Guild", "Arena"];

  return {
    name,
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

// Removed complex coordinate conversion - now expects axial coordinates directly

// Helper function to convert Python BECMI terrain to Wilderness terrain
function convertPythonTerrain(pythonTerrain: string): WildernessTerrainType {
  // Try exact match first
  let converted = PYTHON_TO_WILDERNESS_TERRAIN[pythonTerrain];

  // If no exact match, try case-insensitive match
  if (!converted) {
    const lowerCaseTerrain = pythonTerrain.toLowerCase();
    for (const [key, value] of Object.entries(PYTHON_TO_WILDERNESS_TERRAIN)) {
      if (key.toLowerCase() === lowerCaseTerrain) {
        converted = value;
        break;
      }
    }
  }

  if (!converted) {
    console.warn(`Unknown terrain type "${pythonTerrain}" - defaulting to "clear". Expected types:`, Object.keys(PYTHON_TO_WILDERNESS_TERRAIN));
    return "clear";
  }
  return converted;
}

/**
 * Loads a static wilderness map from JSON data.
 *
 * Expected JSON format: Array of hex objects with:
 * - q, r: Axial coordinates (centered around 0,0)
 * - terrain: Lowercase terrain type (forest, hills, mountains, etc.)
 * - feature?: Optional feature like "River" or "Lake"
 * - details?: Optional descriptive text for the feature
 */
export function loadStaticMapFromJSON(jsonData: string): void {
  try {
    const data = JSON.parse(jsonData);

    if (!Array.isArray(data)) {
      throw new Error("Invalid static map format: expected array of hex objects with q,r,terrain");
    }

    console.log("Loading static map with", data.length, "hexes");

    const staticMap: Record<string, WildernessHex> = {};

    data.forEach((hex: any) => {
      if (hex.q === undefined || hex.r === undefined || !hex.terrain) {
        console.warn("Skipping invalid hex:", hex);
        return;
      }

      const key = `${hex.q},${hex.r}`;
      const wildernessTerrain = convertPythonTerrain(hex.terrain);

      staticMap[key] = {
        type: wildernessTerrain,
        resources: [],
        visited: false,
        color: TERRAIN_DATA[wildernessTerrain].color,
        feature: hex.feature || undefined,
        details: hex.details || undefined,
      };
    });

    console.log(`Loaded ${Object.keys(staticMap).length} static hexes`);

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


