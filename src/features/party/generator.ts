import { pickRandom, rollDice, rollDie, rollStat3d6, rollStatHeroic } from "../../rules/dice";
import { getAbilityMod } from "../../rules/tables/abilityMods";
import { DEMIHUMAN_CLASSES, CLASS_DEFINITIONS, HUMAN_CLASSES } from "../../rules/tables/classes";
import { THAC0_TABLE, lookupThac0 } from "../../rules/tables/thac0";
import { SAVING_THROWS, lookupSavingThrow } from "../../rules/tables/savingThrows";
import { MAGIC_USER_SLOTS, CLERIC_SLOTS } from "../../rules/tables/spellSlots";
import { MAGIC_USER_SPELLS, CLERIC_SPELLS, DRUID_SPELLS } from "../../rules/tables/spells";
import { getThiefSkills } from "../../rules/tables/thiefSkills";
import { EQUIPMENT_PRICES } from "../../rules/tables/equipment";
import { canLevelUp, getXpForNextLevel, getMaxLevel } from "../../rules/tables/experience";
import { getRandomName } from "./nameBag";
import { createId } from "../../utils/id";
import type {
  AbilityScores,
  Alignment,
  Character,
  SpellBook,
  SpellSlotMap,
  SpellTier,
  ThiefSkillBlock,
} from "../../state/schema";

export type GenerationMethod = "strict" | "heroic";
type ClassKey = keyof typeof CLASS_DEFINITIONS;

export interface GenerateCharacterOptions {
  level: number;
  method: GenerationMethod;
  isRetainer?: boolean;
}

const ALIGNMENTS: Alignment[] = ["Lawful", "Neutral", "Chaotic"];
const SPELL_TIERS: SpellTier[] = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

function rollAbilityScores(method: GenerationMethod): AbilityScores {
  const roller = method === "heroic" ? rollStatHeroic : rollStat3d6;
  return {
    str: roller(),
    int: roller(),
    wis: roller(),
    dex: roller(),
    con: roller(),
    cha: roller(),
  };
}

function meetsRequirements(stats: AbilityScores, req: Record<string, number>): boolean {
  return Object.entries(req).every(([key, min]) => (stats as Record<string, number>)[key] >= min);
}

function selectClass(stats: AbilityScores): ClassKey {
  const validHumans = HUMAN_CLASSES.filter((key) => meetsRequirements(stats, CLASS_DEFINITIONS[key].req)) as ClassKey[];
  const validDemis = DEMIHUMAN_CLASSES.filter((key) => meetsRequirements(stats, CLASS_DEFINITIONS[key].req)) as ClassKey[];

  if (!validHumans.length && !validDemis.length) {
    return "fighter";
  }

  const useDemi = validDemis.length > 0 && (Math.random() < 0.4 || validHumans.length === 0);
  const candidates = (useDemi ? validDemis : validHumans.length ? validHumans : validDemis) as ClassKey[];

  let selected = candidates[0] as ClassKey;
  let score = -Infinity;
  candidates.forEach((key) => {
    const prime = CLASS_DEFINITIONS[key].prime;
    let currentScore = 0;
    if (prime.includes("_")) {
      const [a, b] = prime.split("_");
      currentScore = Math.max((stats as Record<string, number>)[a], (stats as Record<string, number>)[b]);
    } else {
      currentScore = (stats as Record<string, number>)[prime];
    }
    if (currentScore > score) {
      score = currentScore;
      selected = key;
    }
  });
  return selected;
}

function buildSpellSlots(): SpellSlotMap {
  return SPELL_TIERS.reduce<SpellSlotMap>((acc, tier) => {
    acc[tier] = 0;
    return acc;
  }, {} as SpellSlotMap);
}

function buildMagicUserSpells(level: number): SpellBook {
  const slots = buildSpellSlots();
  const template = MAGIC_USER_SLOTS[Math.min(Math.max(level, 1), MAGIC_USER_SLOTS.length) - 1] ?? [1];
  template.forEach((count, index) => {
    const tier = SPELL_TIERS[index];
    if (tier) {
      slots[tier] = count;
    }
  });

  const known = new Map<string, { name: string; level: number; memorized: boolean }>();
  known.set("Read Magic", { name: "Read Magic", level: 1, memorized: true });

  template.forEach((count, index) => {
    const spellLevel = (index + 1) as SpellTier;
    const pool = MAGIC_USER_SPELLS[spellLevel];
    if (!pool?.length) {
      return;
    }
    const picks = count + 1;
    for (let i = 0; i < picks; i += 1) {
      const choice = pickRandom(pool);
      if (!known.has(choice)) {
        known.set(choice, {
          name: choice,
          level: spellLevel,
          memorized: i < count,
        });
      }
    }
  });

  return { slots, known: Array.from(known.values()) };
}

function buildClericSpells(level: number, wisScore: number, isDruid: boolean = false): SpellBook {
  const slots = buildSpellSlots();
  const template = [...(CLERIC_SLOTS[Math.min(Math.max(level, 1), CLERIC_SLOTS.length) - 1] ?? [])];

  if (wisScore >= 13) {
    template[0] = (template[0] ?? 0) + 1;
  }
  if (wisScore >= 16) {
    template[1] = (template[1] ?? 0) + 1;
  }
  if (wisScore >= 18) {
    template[2] = (template[2] ?? 0) + 1;
  }

  template.forEach((count, index) => {
    const tier = SPELL_TIERS[index];
    if (tier) {
      slots[tier] = count;
    }
  });

  const known: SpellBook["known"] = [];
  template.forEach((count, index) => {
    if (count <= 0) {
      return;
    }
    const spellLevel = (index + 1) as SpellTier;
    const pool = isDruid ? DRUID_SPELLS[spellLevel] : CLERIC_SPELLS[spellLevel];
    pool?.forEach((name) => {
      if (!known.find((entry) => entry.name === name)) {
        known.push({ name, level: spellLevel, memorized: false });
      }
    });
  });

  return { slots, known };
}

function buildSpellBook(classKey: ClassKey, level: number, stats: AbilityScores): SpellBook {
  if (classKey === "magicuser" || classKey === "elf") {
    return buildMagicUserSpells(level);
  }
  if (classKey === "cleric") {
    return buildClericSpells(level, stats.wis, false);
  }
  if (classKey === "druid") {
    return buildClericSpells(level, stats.wis, true);
  }
  return { slots: buildSpellSlots(), known: [] };
}

function buildThiefSkills(classKey: ClassKey, level: number, dexScore: number): ThiefSkillBlock | null {
  if (classKey !== "thief") {
    return null;
  }
  const base = getThiefSkills(level);
  const dexMod = Math.max(0, getAbilityMod(dexScore) * 5);
  return {
    pickLocks: Math.min(99, base.ol + dexMod),
    findTraps: Math.min(99, base.ft + dexMod),
    removeTraps: Math.min(99, base.rt + dexMod),
    climbWalls: base.cw,
    moveSilently: Math.min(99, base.ms + dexMod),
    hideInShadows: Math.min(99, base.hs + dexMod),
    pickPockets: Math.min(125, base.pp + dexMod),
    detectNoise: base.hn,
    readLanguages: base.rl ?? (level >= 4 ? 80 : 0),
  };
}

function buyEquipment(classKey: ClassKey, gold: number, dexMod: number) {
  let armor = "None";
  let ac = 9;
  let hasShield = false;

  const canWearHeavy = ["fighter", "cleric", "dwarf", "elf", "halfling"].includes(classKey);

  if (canWearHeavy && gold >= EQUIPMENT_PRICES["Chain Mail"]) {
    gold -= EQUIPMENT_PRICES["Chain Mail"];
    armor = "Chain Mail";
    ac = 5;
  } else if (gold >= EQUIPMENT_PRICES["Leather"]) {
    gold -= EQUIPMENT_PRICES["Leather"];
    armor = "Leather";
    ac = 7;
  }

  const canUseShield = ["fighter", "cleric", "druid", "dwarf", "elf"].includes(classKey);
  if (canUseShield && gold >= EQUIPMENT_PRICES["Shield"]) {
    gold -= EQUIPMENT_PRICES["Shield"];
    hasShield = true;
    ac -= 1;
  }

  const weaponsByPriority = {
    fighter: ["Sword", "Mace", "Dagger"],
    dwarf: ["Sword", "Mace", "Dagger"],
    elf: ["Sword", "Mace", "Dagger"],
    halfling: ["Sword", "Mace", "Dagger"],
    cleric: ["Mace", "Dagger"],
    druid: ["Mace", "Dagger"],
    thief: ["Sword", "Dagger"],
    magicuser: ["Dagger"],
    mystic: ["Unarmed"], // Mystics fight unarmed
  } as Record<string, string[]>;

  let weapon = "Dagger";
  const priorities = weaponsByPriority[classKey] ?? ["Dagger"];
  for (const candidate of priorities) {
    if (candidate === "Unarmed" || gold >= (EQUIPMENT_PRICES[candidate] ?? 0)) {
      if (candidate !== "Unarmed") {
        gold -= EQUIPMENT_PRICES[candidate] ?? 0;
      }
      weapon = candidate;
      break;
    }
  }

  // Mystics can't wear armor
  if (classKey === "mystic") {
    armor = "None";
    ac = 9;
    hasShield = false;
  }

  const pack: string[] = [];
  const tryBuy = (item: string) => {
    const price = EQUIPMENT_PRICES[item];
    if (price !== undefined && gold >= price) {
      gold -= price;
      pack.push(item);
      return true;
    }
    return false;
  };

  tryBuy("Backpack");
  tryBuy("Rations (7 days)");
  tryBuy("Waterskin");
  tryBuy("Torch (6)");
  if (classKey === "cleric") {
    tryBuy("Holy Symbol");
  }
  if (classKey === "thief") {
    tryBuy("Thieves' Tools");
  }

  if (classKey === "magicuser" || classKey === "elf") {
    pack.push("Spellbook");
  }

  const packItems = pack.map((item) => {
    if (item === "Torch (6)") {
      return "Torches (6)";
    }
    return item;
  });

  const acFinal = ac - dexMod;

  return {
    equipment: {
      weapon,
      armor,
      shield: hasShield ? "Shield" : null,
      pack: packItems,
      gold,
    },
    ac: acFinal,
  };
}

function computeSavingThrows(classKey: ClassKey, level: number) {
  let lookupKey: keyof typeof SAVING_THROWS;
  if (classKey === "dwarf") {
    lookupKey = "Dwarf";
  } else if (classKey === "elf") {
    lookupKey = "Elf";
  } else if (classKey === "halfling") {
    lookupKey = "Halfling";
  } else {
    lookupKey = CLASS_DEFINITIONS[classKey].name.replace("-", "") as keyof typeof SAVING_THROWS;
  }
  const track = SAVING_THROWS[lookupKey];
  return {
    deathPoison: lookupSavingThrow(track.deathPoison, level),
    wands: lookupSavingThrow(track.wands, level),
    paraStone: lookupSavingThrow(track.paraStone, level),
    breath: lookupSavingThrow(track.breath, level),
    spells: lookupSavingThrow(track.spells, level),
  };
}

function computeThac0(classKey: ClassKey, level: number) {
  // Demihumans use Fighter THAC0 progression (attack ranks correspond to fighter levels)
  const tableKey = (["dwarf", "elf", "halfling", "mystic"].includes(classKey)
    ? "Fighter"
    : CLASS_DEFINITIONS[classKey].name.replace("-", "")) as keyof typeof THAC0_TABLE;
  const table = THAC0_TABLE[tableKey];
  return lookupThac0(table, level);
}

export function generateCharacter(options: GenerateCharacterOptions): Character {
  const { level, method, isRetainer } = options;
  const abilityScores = rollAbilityScores(method);
  const classKey = selectClass(abilityScores);
  const classDef = CLASS_DEFINITIONS[classKey];
  const race = classDef.type === "demihuman" ? classDef.name : "Human";
  const name = getRandomName();
  const alignment = pickRandom(ALIGNMENTS);
  const conMod = getAbilityMod(abilityScores.con);

  let hp = Math.max(1, (isRetainer ? rollDie(classDef.hd) : classDef.hd) + conMod);
  for (let i = 1; i < level; i += 1) {
    hp += Math.max(1, rollDie(classDef.hd) + conMod);
  }

  let gold = rollDice(3, 6) * 10;
  const dexMod = getAbilityMod(abilityScores.dex);

  const { equipment, ac } = buyEquipment(classKey, gold, dexMod);
  gold = equipment.gold;

  const thac0 = computeThac0(classKey, level);
  const savingThrows = computeSavingThrows(classKey, level);
  const spells = buildSpellBook(classKey, level, abilityScores);
  const thiefSkills = buildThiefSkills(classKey, level, abilityScores.dex);

  const character: Character = {
    id: createId(),
    name,
    race,
    classKey,
    className: classDef.name,
    level,
    xp: 0,
    alignment,
    abilityScores,
    derivedStats: {
      hp: { current: hp, max: hp },
      ac,
      thac0,
      savingThrows,
    },
    spells,
    thiefSkills,
    equipment,
    retainers: [],
    maxRetainers: Math.max(0, 4 + getAbilityMod(abilityScores.cha)),
    retainerMorale: 7 + getAbilityMod(abilityScores.cha),
    status: "alive",
  };

  return character;
}

// Level up a character if they have enough XP
export function levelUpCharacter(character: Character): Character {
  if (!canLevelUp(character.classKey, character.xp, character.level)) {
    return character;
  }

  const newLevel = character.level + 1;
  const classDef = CLASS_DEFINITIONS[character.classKey];
  const conMod = getAbilityMod(character.abilityScores.con);

  // Calculate new HP
  let newHpMax = character.derivedStats.hp.max;
  if (newLevel <= 9) {
    // Normal HD progression
    newHpMax += Math.max(1, rollDie(classDef.hd) + conMod);
  } else {
    // Fixed HP after level 9
    const extraHp = ["fighter", "dwarf"].includes(character.classKey) ? 3 : 2;
    newHpMax += extraHp;
  }

  // Recalculate derived stats
  const newThac0 = computeThac0(character.classKey, newLevel);
  const newSavingThrows = computeSavingThrows(character.classKey, newLevel);
  const newSpells = buildSpellBook(character.classKey, newLevel, character.abilityScores);
  const newThiefSkills = buildThiefSkills(character.classKey, newLevel, character.abilityScores.dex);

  return {
    ...character,
    level: newLevel,
    derivedStats: {
      ...character.derivedStats,
      hp: { current: newHpMax, max: newHpMax },
      thac0: newThac0,
      savingThrows: newSavingThrows,
    },
    spells: newSpells,
    thiefSkills: newThiefSkills,
  };
}

// Add XP to a character and level up if necessary
export function addXpToCharacter(character: Character, xpGained: number): Character {
  // Apply prime requisite bonus
  const bonusPercent = getPrimeRequisiteBonus(character);
  const bonusXp = Math.floor(xpGained * (bonusPercent / 100));
  const totalXpGained = xpGained + bonusXp;

  const newXp = character.xp + totalXpGained;
  let updatedCharacter = {
    ...character,
    xp: newXp,
  };

  // Level up as many times as possible
  while (canLevelUp(updatedCharacter.classKey, updatedCharacter.xp, updatedCharacter.level)) {
    updatedCharacter = levelUpCharacter(updatedCharacter);
  }

  return updatedCharacter;
}

// Calculate prime requisite bonus percentage
function getPrimeRequisiteBonus(character: Character): number {
  const stats = character.abilityScores;
  const classDef = CLASS_DEFINITIONS[character.classKey];
  const primeReq = classDef.prime;

  let bonus = 0;

  if (primeReq === "str_dex") {
    // Mystic: bonus based on Strength
    if (stats.str >= 16) bonus = 10;
    else if (stats.str >= 13) bonus = 5;
  } else if (primeReq === "str_int") {
    // Elf: bonus if either Str or Int is high
    const strBonus = stats.str >= 13 ? (stats.str >= 16 ? 10 : 5) : 0;
    const intBonus = stats.int >= 13 ? (stats.int >= 16 ? 10 : 5) : 0;
    bonus = Math.max(strBonus, intBonus);
  } else if (primeReq.includes("_")) {
    // Halfling: bonus if either prime req is high
    const [req1, req2] = primeReq.split("_");
    const bonus1 = (stats as any)[req1] >= 13 ? ((stats as any)[req1] >= 16 ? 10 : 5) : 0;
    const bonus2 = (stats as any)[req2] >= 13 ? ((stats as any)[req2] >= 16 ? 10 : 5) : 0;
    bonus = Math.max(bonus1, bonus2);
  } else {
    // Single prime requisite
    const primeScore = (stats as any)[primeReq];
    if (primeScore >= 16) bonus = 10;
    else if (primeScore >= 13) bonus = 5;
  }

  return bonus;
}

// Get XP needed for next level
export function getXpNeededForNextLevel(character: Character): number {
  return getXpForNextLevel(character.classKey, character.level);
}

// Get maximum level for character's class
export function getCharacterMaxLevel(character: Character): number {
  return getMaxLevel(character.classKey);
}

