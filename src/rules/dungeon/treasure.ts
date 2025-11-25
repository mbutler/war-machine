export interface TreasureRoll {
  pct: number;
  roll: string;
  mult?: number;
}

export interface MagicTable {
  pct: number;
  count: number;
  type: keyof typeof MAGIC_ITEMS;
  extra?: string[];
}

export interface TreasureTypeDefinition {
  cp?: TreasureRoll;
  sp?: TreasureRoll;
  ep?: TreasureRoll;
  gp?: TreasureRoll;
  pp?: TreasureRoll;
  gems?: TreasureRoll;
  jewelry?: TreasureRoll;
  magic?: MagicTable;
}

export const TREASURE_TYPES: Record<string, TreasureTypeDefinition> = {
  A: {
    cp: { pct: 25, roll: "1d6", mult: 1000 },
    sp: { pct: 30, roll: "1d6", mult: 1000 },
    ep: { pct: 20, roll: "1d4", mult: 1000 },
    gp: { pct: 35, roll: "2d6", mult: 1000 },
    pp: { pct: 25, roll: "1d2", mult: 1000 },
    gems: { pct: 50, roll: "6d6" },
    jewelry: { pct: 50, roll: "6d6" },
    magic: { pct: 30, count: 3, type: "any" },
  },
  B: {
    cp: { pct: 50, roll: "1d8", mult: 1000 },
    sp: { pct: 25, roll: "1d6", mult: 1000 },
    ep: { pct: 25, roll: "1d4", mult: 1000 },
    gp: { pct: 25, roll: "1d3", mult: 1000 },
    gems: { pct: 25, roll: "1d6" },
    jewelry: { pct: 25, roll: "1d6" },
    magic: { pct: 10, count: 1, type: "weaponArmor" },
  },
  C: {
    cp: { pct: 20, roll: "1d12", mult: 1000 },
    sp: { pct: 30, roll: "1d4", mult: 1000 },
    ep: { pct: 10, roll: "1d4", mult: 1000 },
    gems: { pct: 25, roll: "1d4" },
    jewelry: { pct: 25, roll: "1d4" },
    magic: { pct: 10, count: 2, type: "any" },
  },
  D: {
    cp: { pct: 10, roll: "1d8", mult: 1000 },
    sp: { pct: 15, roll: "1d12", mult: 1000 },
    gp: { pct: 60, roll: "1d6", mult: 1000 },
    gems: { pct: 30, roll: "1d8" },
    jewelry: { pct: 30, roll: "1d8" },
    magic: { pct: 15, count: 2, type: "any", extra: ["potion"] },
  },
  E: {
    cp: { pct: 5, roll: "1d10", mult: 1000 },
    sp: { pct: 30, roll: "1d12", mult: 1000 },
    ep: { pct: 25, roll: "1d4", mult: 1000 },
    gp: { pct: 25, roll: "1d8", mult: 1000 },
    gems: { pct: 10, roll: "1d10" },
    jewelry: { pct: 10, roll: "1d10" },
    magic: { pct: 25, count: 3, type: "any", extra: ["scroll"] },
  },
  F: {
    sp: { pct: 10, roll: "2d10", mult: 1000 },
    ep: { pct: 20, roll: "1d8", mult: 1000 },
    gp: { pct: 45, roll: "1d12", mult: 1000 },
    pp: { pct: 30, roll: "1d3", mult: 1000 },
    gems: { pct: 20, roll: "2d12" },
    jewelry: { pct: 10, roll: "1d12" },
    magic: { pct: 30, count: 3, type: "noWeapon", extra: ["potion", "scroll"] },
  },
  G: {
    gp: { pct: 50, roll: "10d4", mult: 1000 },
    pp: { pct: 50, roll: "1d20", mult: 1000 },
    gems: { pct: 30, roll: "3d6" },
    jewelry: { pct: 25, roll: "1d10" },
    magic: { pct: 35, count: 4, type: "any", extra: ["scroll"] },
  },
  H: {
    cp: { pct: 25, roll: "3d8", mult: 1000 },
    sp: { pct: 50, roll: "1d100", mult: 1000 },
    ep: { pct: 50, roll: "1d4", mult: 10000 },
    gp: { pct: 50, roll: "1d6", mult: 10000 },
    pp: { pct: 25, roll: "5d4", mult: 1000 },
    gems: { pct: 50, roll: "1d100" },
    jewelry: { pct: 50, roll: "1d4", mult: 10 },
    magic: { pct: 15, count: 4, type: "any", extra: ["potion", "scroll"] },
  },
  I: {
    pp: { pct: 30, roll: "1d8", mult: 100 },
    gems: { pct: 50, roll: "2d6" },
    jewelry: { pct: 50, roll: "2d6" },
    magic: { pct: 15, count: 1, type: "any" },
  },
  J: {
    cp: { pct: 25, roll: "1d4", mult: 1000 },
    sp: { pct: 10, roll: "1d3", mult: 1000 },
  },
  K: {
    sp: { pct: 30, roll: "1d6", mult: 1000 },
    ep: { pct: 10, roll: "1d2", mult: 1000 },
  },
  L: {
    gems: { pct: 50, roll: "1d4" },
  },
  M: {
    gp: { pct: 40, roll: "2d4", mult: 1000 },
    pp: { pct: 50, roll: "5d6", mult: 100 },
    gems: { pct: 55, roll: "5d4" },
    jewelry: { pct: 45, roll: "2d6" },
  },
  N: {
    pp: { pct: 40, roll: "2d4", mult: 100 },
    magic: { pct: 40, count: 3, type: "potionOnly" },
  },
  O: {
    magic: { pct: 50, count: 2, type: "scrollOnly" },
  },
  V: {
    sp: { pct: 10, roll: "1d100", mult: 1000 },
    ep: { pct: 10, roll: "1d100", mult: 1000 },
    gp: { pct: 10, roll: "1d100", mult: 1000 },
    pp: { pct: 5, roll: "1d100", mult: 1000 },
    gems: { pct: 10, roll: "1d100" },
    jewelry: { pct: 10, roll: "1d100" },
    magic: { pct: 5, count: 1, type: "any" },
  },
};

export const MAGIC_ITEMS = {
  any: ["Sword +1", "Shield +1", "Armor +1", "Potion of Healing", "Scroll of Protection", "Ring of Protection", "Wand of Trap Detection"],
  weaponArmor: ["Sword +1", "Shield +1", "Armor +1", "Dagger +1", "Mace +1"],
  noWeapon: ["Shield +1", "Armor +1", "Potion of Healing", "Ring of Invisibility", "Elven Cloak"],
  potion: ["Potion of Healing", "Potion of Extra Healing", "Potion of Giant Strength", "Potion of Invisibility", "Potion of Speed"],
  scroll: ["Scroll of Protection from Evil", "Scroll of Fireballs", "Scroll of Lightning Bolts", "Scroll of Teleportation"],
  potionOnly: ["Potion of Healing", "Potion of Extra Healing", "Potion of Invisibility", "Potion of Levitation", "Potion of Growth"],
  scrollOnly: ["Scroll of Protection from Evil", "Scroll of Fireballs", "Scroll of Lightning Bolts", "Scroll of Teleportation"],
};

