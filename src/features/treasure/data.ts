import type { CoinDenomination } from "../../state/schema";

export type DiceExpression = `${number}d${number}`;

export interface TreasureCoinTable {
  pct: number;
  roll: DiceExpression;
  mult?: number;
}

export interface TreasureJewelryTable {
  pct: number;
  roll: DiceExpression;
  mult?: number;
}

export interface TreasureGemTable {
  pct: number;
  roll: DiceExpression;
}

export interface TreasureMagicTable {
  pct: number;
  count: number;
  type: MagicCategory;
  extra?: MagicCategory[];
}

export type MagicCategory =
  | "any"
  | "weapon/armor"
  | "no-weapon"
  | "sword"
  | "weapon"
  | "armor"
  | "potion"
  | "scroll"
  | "ring"
  | "wand"
  | "misc";

export interface TreasureTypeDefinition {
  key: TreasureTypeKey;
  label: string;
  description: string;
  coins?: Partial<Record<CoinDenomination, TreasureCoinTable>>;
  gems?: TreasureGemTable;
  jewelry?: TreasureJewelryTable;
  magic?: TreasureMagicTable;
}

export type TreasureTypeKey =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "J"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V";

export const TREASURE_TYPES: Record<TreasureTypeKey, TreasureTypeDefinition> = {
  A: {
    key: "A",
    label: "Type A (Land Lair)",
    description: "25% CP, 35% GP, heavy gems/jewelry, up to 3 magic.",
    coins: {
      cp: { pct: 25, roll: "1d6", mult: 1000 },
      sp: { pct: 30, roll: "1d6", mult: 1000 },
      ep: { pct: 20, roll: "1d4", mult: 1000 },
      gp: { pct: 35, roll: "2d6", mult: 1000 },
      pp: { pct: 25, roll: "1d2", mult: 1000 },
    },
    gems: { pct: 50, roll: "6d6" },
    jewelry: { pct: 50, roll: "6d6" },
    magic: { pct: 30, count: 3, type: "any" },
  },
  B: {
    key: "B",
    label: "Type B (Land Lair)",
    description: "Coin-rich hoards with modest treasures.",
    coins: {
      cp: { pct: 50, roll: "1d8", mult: 1000 },
      sp: { pct: 25, roll: "1d6", mult: 1000 },
      ep: { pct: 25, roll: "1d4", mult: 1000 },
      gp: { pct: 25, roll: "1d3", mult: 1000 },
    },
    gems: { pct: 25, roll: "1d6" },
    jewelry: { pct: 25, roll: "1d6" },
    magic: { pct: 10, count: 1, type: "weapon/armor" },
  },
  C: {
    key: "C",
    label: "Type C (Land Lair)",
    description: "Copper heavy with low chance of magic.",
    coins: {
      cp: { pct: 20, roll: "1d12", mult: 1000 },
      sp: { pct: 30, roll: "1d4", mult: 1000 },
      ep: { pct: 10, roll: "1d4", mult: 1000 },
    },
    gems: { pct: 25, roll: "1d4" },
    jewelry: { pct: 25, roll: "1d4" },
    magic: { pct: 10, count: 2, type: "any" },
  },
  D: {
    key: "D",
    label: "Type D (Land Lair)",
    description: "Gold-forward hoard with good treasure odds.",
    coins: {
      cp: { pct: 10, roll: "1d8", mult: 1000 },
      sp: { pct: 15, roll: "1d12", mult: 1000 },
      gp: { pct: 60, roll: "1d6", mult: 1000 },
    },
    gems: { pct: 30, roll: "1d8" },
    jewelry: { pct: 30, roll: "1d8" },
    magic: { pct: 15, count: 2, type: "any", extra: ["potion"] },
  },
  E: {
    key: "E",
    label: "Type E (Land Lair)",
    description: "Mixed coin hoard with scroll/potion emphasis.",
    coins: {
      cp: { pct: 5, roll: "1d10", mult: 1000 },
      sp: { pct: 30, roll: "1d12", mult: 1000 },
      ep: { pct: 25, roll: "1d4", mult: 1000 },
      gp: { pct: 25, roll: "1d8", mult: 1000 },
    },
    gems: { pct: 10, roll: "1d10" },
    jewelry: { pct: 10, roll: "1d10" },
    magic: { pct: 25, count: 3, type: "any", extra: ["scroll"] },
  },
  F: {
    key: "F",
    label: "Type F (Monster Lair)",
    description: "No copper; strong magic chances.",
    coins: {
      sp: { pct: 10, roll: "2d10", mult: 1000 },
      ep: { pct: 20, roll: "1d8", mult: 1000 },
      gp: { pct: 45, roll: "1d12", mult: 1000 },
      pp: { pct: 30, roll: "1d3", mult: 1000 },
    },
    gems: { pct: 20, roll: "2d12" },
    jewelry: { pct: 10, roll: "1d12" },
    magic: { pct: 30, count: 3, type: "no-weapon", extra: ["potion", "scroll"] },
  },
  G: {
    key: "G",
    label: "Type G (Monster Lair)",
    description: "Gold/platinum dragon hoards.",
    coins: {
      gp: { pct: 50, roll: "10d4", mult: 1000 },
      pp: { pct: 50, roll: "1d20", mult: 1000 },
    },
    gems: { pct: 30, roll: "3d6" },
    jewelry: { pct: 25, roll: "1d10" },
    magic: { pct: 35, count: 4, type: "any", extra: ["scroll"] },
  },
  H: {
    key: "H",
    label: "Type H (Dragon/Lair)",
    description: "Massive hoards with everything.",
    coins: {
      cp: { pct: 25, roll: "3d8", mult: 1000 },
      sp: { pct: 50, roll: "1d100", mult: 1000 },
      ep: { pct: 50, roll: "1d4", mult: 10000 },
      gp: { pct: 50, roll: "1d6", mult: 10000 },
      pp: { pct: 25, roll: "5d4", mult: 1000 },
    },
    gems: { pct: 50, roll: "1d100" },
    jewelry: { pct: 50, roll: "1d4", mult: 10 },
    magic: { pct: 15, count: 4, type: "any", extra: ["potion", "scroll"] },
  },
  I: {
    key: "I",
    label: "Type I (Unique)",
    description: "Small platinum chests with high-quality jewels.",
    coins: {
      pp: { pct: 30, roll: "1d8", mult: 100 },
    },
    gems: { pct: 50, roll: "2d6" },
    jewelry: { pct: 50, roll: "2d6" },
    magic: { pct: 15, count: 1, type: "any" },
  },
  J: {
    key: "J",
    label: "Type J (Individual)",
    description: "Pocket change - copper focused.",
    coins: {
      cp: { pct: 25, roll: "1d4", mult: 1000 },
      sp: { pct: 10, roll: "1d3", mult: 1000 },
    },
  },
  K: {
    key: "K",
    label: "Type K (Individual)",
    description: "Silver and electrum purses.",
    coins: {
      sp: { pct: 30, roll: "1d6", mult: 1000 },
      ep: { pct: 10, roll: "1d2", mult: 1000 },
    },
  },
  L: {
    key: "L",
    label: "Type L (Individual)",
    description: "Gem-only stashes.",
    gems: { pct: 50, roll: "1d4" },
  },
  M: {
    key: "M",
    label: "Type M (Individual)",
    description: "Gold and platinum with robust gems.",
    coins: {
      gp: { pct: 40, roll: "2d4", mult: 1000 },
      pp: { pct: 50, roll: "5d6", mult: 100 },
    },
    gems: { pct: 55, roll: "5d4" },
    jewelry: { pct: 45, roll: "2d6" },
  },
  N: {
    key: "N",
    label: "Type N (Individual)",
    description: "Platinum and potions.",
    coins: {
      pp: { pct: 40, roll: "2d4", mult: 100 },
    },
    magic: { pct: 40, count: 0, type: "any", extra: ["potion", "potion", "potion"] },
  },
  O: {
    key: "O",
    label: "Type O (Individual)",
    description: "Magic scroll cache.",
    magic: { pct: 50, count: 0, type: "any", extra: ["scroll", "scroll"] },
  },
  P: {
    key: "P",
    label: "Type P (Coins)",
    description: "Pure copper cache.",
    coins: {
      cp: { pct: 100, roll: "3d8", mult: 1 },
    },
  },
  Q: {
    key: "Q",
    label: "Type Q (Coins)",
    description: "Pure silver cache.",
    coins: {
      sp: { pct: 100, roll: "3d6", mult: 1 },
    },
  },
  R: {
    key: "R",
    label: "Type R (Coins)",
    description: "Pure electrum cache.",
    coins: {
      ep: { pct: 100, roll: "2d6", mult: 1 },
    },
  },
  S: {
    key: "S",
    label: "Type S (Coins)",
    description: "Pure gold cache.",
    coins: {
      gp: { pct: 100, roll: "2d4", mult: 1 },
    },
  },
  T: {
    key: "T",
    label: "Type T (Coins)",
    description: "Pure platinum cache.",
    coins: {
      pp: { pct: 100, roll: "1d6", mult: 1 },
    },
  },
  U: {
    key: "U",
    label: "Type U (Group)",
    description: "Small mixed cache with low odds.",
    coins: {
      cp: { pct: 10, roll: "1d100", mult: 1 },
      sp: { pct: 10, roll: "1d100", mult: 1 },
      gp: { pct: 5, roll: "1d100", mult: 1 },
    },
    gems: { pct: 5, roll: "1d4" },
    jewelry: { pct: 5, roll: "1d4" },
    magic: { pct: 2, count: 1, type: "any" },
  },
  V: {
    key: "V",
    label: "Type V (Group)",
    description: "Mixed cache with better odds.",
    coins: {
      sp: { pct: 10, roll: "1d100", mult: 1 },
      ep: { pct: 5, roll: "1d100", mult: 1 },
      gp: { pct: 10, roll: "1d100", mult: 1 },
      pp: { pct: 5, roll: "1d100", mult: 1 },
    },
    gems: { pct: 10, roll: "1d4" },
    jewelry: { pct: 10, roll: "1d4" },
    magic: { pct: 5, count: 1, type: "any" },
  },
};

export interface GemTier {
  max: number;
  val: number;
  name: string;
}

export const GEM_TABLE: GemTier[] = [
  { max: 10, val: 10, name: "Ornamental stone (Agate, Azurite)" },
  { max: 25, val: 50, name: "Semi-precious (Bloodstone, Moonstone)" },
  { max: 75, val: 100, name: "Fancy stone (Amber, Amethyst, Jade)" },
  { max: 90, val: 500, name: "Precious gem (Pearl, Topaz, Peridot)" },
  { max: 99, val: 1000, name: "Gemstone (Emerald, Sapphire, Ruby)" },
  { max: 100, val: 5000, name: "Jewel (Diamond, Star Ruby)" },
];

export const JEWELRY_TABLE: GemTier[] = [
  { max: 10, val: 100, name: "Ivory or silver wrought" },
  { max: 25, val: 400, name: "Silver or gold plated" },
  { max: 75, val: 800, name: "Gold or silver w/ gems" },
  { max: 90, val: 1500, name: "Platinum with gems" },
  { max: 100, val: 5000, name: "Masterwork heirloom" },
];

export const MAGIC_TABLES: Record<MagicCategory, string[]> = {
  any: ["sword", "weapon", "armor", "potion", "scroll", "ring", "wand", "misc"],
  "weapon/armor": ["sword", "weapon", "armor"],
  "no-weapon": ["potion", "scroll", "ring", "wand", "misc"],
  sword: ["Sword +1", "Sword +1, +2 vs Undead", "Sword +1, +3 vs Dragons", "Sword +2", "Sword +3"],
  weapon: ["Axe +1", "Bow +1", "Dagger +1", "Mace +1", "Spear +1", "War Hammer +1"],
  armor: ["Shield +1", "Shield +2", "Leather Armor +1", "Chain Mail +1", "Plate Mail +1", "Plate Mail +2"],
  potion: ["Potion of Healing", "Potion of Flying", "Potion of Invisibility", "Potion of Speed", "Potion of Giant Strength"],
  scroll: [
    "Scroll: 1 spell (Level 1)",
    "Scroll: 2 spells (Lvl 1-2)",
    "Scroll: Protection from Evil",
    "Scroll: Protection from Lycanthropes",
    "Cursed Scroll",
  ],
  ring: ["Ring of Protection +1", "Ring of Invisibility", "Ring of Water Walking", "Ring of Fire Resistance", "Ring of Spell Turning"],
  wand: ["Wand of Magic Detection", "Wand of Secret Door Detection", "Wand of Magic Missiles", "Wand of Fear", "Wand of Cold"],
  misc: ["Elven Cloak", "Bag of Holding", "Boots of Speed", "Gauntlets of Ogre Power", "Helm of Telepathy", "Broom of Flying"],
};

export const TREASURE_TYPE_LIST: TreasureTypeDefinition[] = Object.values(TREASURE_TYPES);

