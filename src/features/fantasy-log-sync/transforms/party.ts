/**
 * Party Transform
 * 
 * Converts fantasy-log parties to war-machine Character roster.
 * Uses BECMI rules to fill in missing stats.
 * Uses deterministic seeded random for consistent imports.
 */

import type { Party, PartyMember, CharacterClass as FLClass } from '../types';
import type { Character, PartyState, AbilityScores, Alignment, SpellBook, ThiefSkillBlock } from '../../../state/schema';
import { createId } from '../../../utils/id';
import { CLASS_DEFINITIONS } from '../../../rules/tables/classes';
import { FEMALE_NAMES, MALE_NAMES } from '../../../data/names';
import { lookupThac0, THAC0_TABLE } from '../../../rules/tables/thac0';
import { lookupSavingThrow, SAVING_THROWS } from '../../../rules/tables/savingThrows';
import { MAGIC_USER_SLOTS, CLERIC_SLOTS } from '../../../rules/tables/spellSlots';
import { MAGIC_USER_SPELLS, CLERIC_SPELLS, DRUID_SPELLS } from '../../../rules/tables/spells';
import { getThiefSkills } from '../../../rules/tables/thiefSkills';
import { getAbilityMod } from '../../../rules/tables/abilityMods';

/**
 * Simple seeded random number generator for deterministic variety
 */
class SeededRandom {
  private seed: number;
  
  constructor(seed: string) {
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
  
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  
  chance(probability: number): boolean {
    return this.next() < probability;
  }
}

type ClassKey = keyof typeof CLASS_DEFINITIONS;
type SpellTier = '1st' | '2nd' | '3rd' | '4th' | '5th' | '6th' | '7th' | '8th' | '9th';

const SPELL_TIERS: SpellTier[] = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
const ALIGNMENTS: Alignment[] = ['Lawful', 'Neutral', 'Chaotic'];

/**
 * Map fantasy-log class names to war-machine class keys
 */
function mapClassKey(flClass: FLClass): ClassKey {
  const mapping: Record<FLClass, ClassKey> = {
    'Cleric': 'cleric',
    'Fighter': 'fighter',
    'Magic-User': 'magicuser',
    'Thief': 'thief',
    'Dwarf': 'dwarf',
    'Elf': 'elf',
    'Halfling': 'halfling',
    'Druid': 'druid',
    'Mystic': 'mystic',
  };
  return mapping[flClass] ?? 'fighter';
}

/**
 * Ensure a value is a valid number, with fallback
 */
function ensureNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

/**
 * Generate ability scores that meet class requirements
 * Uses a "heroic" approach - generates scores that make sense for the class
 * Uses seeded random for deterministic results
 */
function generateAbilityScores(classKey: ClassKey, level: number, rng: SeededRandom): AbilityScores {
  const classDef = CLASS_DEFINITIONS[classKey] ?? CLASS_DEFINITIONS.fighter;
  const prime = classDef.prime ?? 'str';
  const safeLevel = ensureNumber(level, 1);
  
  // Base scores - slightly above average for adventurers (using seeded random)
  const scores: AbilityScores = {
    str: 10 + rng.nextInt(0, 3),
    int: 10 + rng.nextInt(0, 3),
    wis: 10 + rng.nextInt(0, 3),
    dex: 10 + rng.nextInt(0, 3),
    con: 10 + rng.nextInt(0, 3),
    cha: 10 + rng.nextInt(0, 3),
  };
  
  // Ensure requirements are met
  if (classDef.req) {
    for (const [ability, min] of Object.entries(classDef.req)) {
      const key = ability as keyof AbilityScores;
      const minScore = ensureNumber(min, 9);
      if (key in scores && scores[key] < minScore) {
        scores[key] = minScore + rng.nextInt(0, 2);
      }
    }
  }
  
  // Boost prime requisite(s) - higher level = better prime
  const primeBoost = Math.min(6, Math.floor(safeLevel / 3) + 2);
  
  if (prime.includes('_')) {
    const parts = prime.split('_');
    const p1 = parts[0] as keyof AbilityScores;
    const p2 = parts[1] as keyof AbilityScores;
    if (p1 in scores) {
      scores[p1] = Math.min(18, ensureNumber(scores[p1], 10) + primeBoost);
    }
    if (p2 in scores) {
      scores[p2] = Math.min(18, ensureNumber(scores[p2], 10) + Math.floor(primeBoost / 2));
    }
  } else {
    const primeKey = prime as keyof AbilityScores;
    if (primeKey in scores) {
      scores[primeKey] = Math.min(18, ensureNumber(scores[primeKey], 10) + primeBoost);
    }
  }
  
  // Final validation - ensure all scores are valid numbers
  for (const key of Object.keys(scores) as (keyof AbilityScores)[]) {
    scores[key] = ensureNumber(scores[key], 10);
  }
  
  return scores;
}

/**
 * Build spell slots map
 */
function buildSpellSlots(): Record<SpellTier, number> {
  return SPELL_TIERS.reduce((acc, tier) => {
    acc[tier] = 0;
    return acc;
  }, {} as Record<SpellTier, number>);
}

/**
 * Build spellbook for magic users and elves (using seeded random)
 */
function buildMagicUserSpells(level: number, rng: SeededRandom): SpellBook {
  const slots = buildSpellSlots();
  const template = MAGIC_USER_SLOTS[Math.min(Math.max(level, 1), MAGIC_USER_SLOTS.length) - 1] ?? [1];
  
  template.forEach((count, index) => {
    const tier = SPELL_TIERS[index];
    if (tier) {
      slots[tier] = count;
    }
  });
  
  const known: SpellBook['known'] = [{ name: 'Read Magic', level: 1, memorized: true }];
  
  template.forEach((count, index) => {
    const spellLevel = index + 1;
    const pool = MAGIC_USER_SPELLS[spellLevel as keyof typeof MAGIC_USER_SPELLS];
    if (!pool?.length) return;
    
    const picks = count + 1;
    const pickedNames = new Set<string>(['Read Magic']);
    
    for (let i = 0; i < picks && pickedNames.size < pool.length + 1; i++) {
      const choice = rng.pick(pool);
      if (!pickedNames.has(choice)) {
        pickedNames.add(choice);
        known.push({
          name: choice,
          level: spellLevel,
          memorized: i < count,
        });
      }
    }
  });
  
  return { slots, known };
}

/**
 * Build spellbook for clerics and druids
 */
function buildClericSpells(level: number, wisScore: number, isDruid: boolean): SpellBook {
  const slots = buildSpellSlots();
  const template = [...(CLERIC_SLOTS[Math.min(Math.max(level, 1), CLERIC_SLOTS.length) - 1] ?? [])];
  
  // Wisdom bonuses
  if (wisScore >= 13) template[0] = (template[0] ?? 0) + 1;
  if (wisScore >= 16) template[1] = (template[1] ?? 0) + 1;
  if (wisScore >= 18) template[2] = (template[2] ?? 0) + 1;
  
  template.forEach((count, index) => {
    const tier = SPELL_TIERS[index];
    if (tier) {
      slots[tier] = count;
    }
  });
  
  const known: SpellBook['known'] = [];
  const spellSource = isDruid ? DRUID_SPELLS : CLERIC_SPELLS;
  
  template.forEach((count, index) => {
    if (count <= 0) return;
    const spellLevel = index + 1;
    const pool = spellSource[spellLevel as keyof typeof spellSource];
    pool?.forEach((name) => {
      if (!known.find((e) => e.name === name)) {
        known.push({ name, level: spellLevel, memorized: false });
      }
    });
  });
  
  return { slots, known };
}

/**
 * Build spellbook based on class (using seeded random)
 */
function buildSpellBook(classKey: ClassKey, level: number, stats: AbilityScores, rng: SeededRandom): SpellBook {
  if (classKey === 'magicuser' || classKey === 'elf') {
    return buildMagicUserSpells(level, rng);
  }
  if (classKey === 'cleric') {
    return buildClericSpells(level, stats.wis, false);
  }
  if (classKey === 'druid') {
    return buildClericSpells(level, stats.wis, true);
  }
  return { slots: buildSpellSlots(), known: [] };
}

/**
 * Build thief skills
 */
function buildThiefSkills(classKey: ClassKey, level: number, dexScore: number): ThiefSkillBlock | null {
  if (classKey !== 'thief') {
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

/**
 * Compute THAC0 for class and level
 */
function computeThac0(classKey: ClassKey, level: number): number {
  const tableKey = (['dwarf', 'elf', 'halfling', 'mystic'].includes(classKey)
    ? 'Fighter'
    : CLASS_DEFINITIONS[classKey].name.replace('-', '')) as keyof typeof THAC0_TABLE;
  const table = THAC0_TABLE[tableKey];
  return lookupThac0(table, level);
}

/**
 * Compute saving throws for class and level
 */
function computeSavingThrows(classKey: ClassKey, level: number) {
  let lookupKey: keyof typeof SAVING_THROWS;
  if (classKey === 'dwarf') {
    lookupKey = 'Dwarf';
  } else if (classKey === 'elf') {
    lookupKey = 'Elf';
  } else if (classKey === 'halfling') {
    lookupKey = 'Halfling';
  } else {
    lookupKey = CLASS_DEFINITIONS[classKey].name.replace('-', '') as keyof typeof SAVING_THROWS;
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

/**
 * Generate equipment based on class and level (using seeded random)
 */
function generateEquipment(classKey: ClassKey, level: number, rng: SeededRandom) {
  // Higher level = better equipment chance
  const goldBudget = (50 + level * 20) * (1 + rng.next() * 0.5);
  
  const weaponsByClass: Record<string, string> = {
    fighter: 'Sword',
    dwarf: 'Battle Axe',
    elf: 'Sword',
    halfling: 'Short Sword',
    cleric: 'Mace',
    druid: 'Staff',
    thief: 'Short Sword',
    magicuser: 'Dagger',
    mystic: 'Unarmed',
  };
  
  const armorByClass: Record<string, string> = {
    fighter: level >= 3 ? 'Plate Mail' : 'Chain Mail',
    dwarf: level >= 3 ? 'Plate Mail' : 'Chain Mail',
    elf: 'Chain Mail',
    halfling: 'Chain Mail',
    cleric: 'Chain Mail',
    druid: 'Leather',
    thief: 'Leather',
    magicuser: 'None',
    mystic: 'None',
  };
  
  const canUseShield = ['fighter', 'cleric', 'dwarf', 'elf', 'druid'].includes(classKey);
  
  const pack = ['Backpack', 'Rations (7 days)', 'Waterskin', 'Torches (6)'];
  if (classKey === 'cleric') pack.push('Holy Symbol');
  if (classKey === 'thief') pack.push("Thieves' Tools");
  if (classKey === 'magicuser' || classKey === 'elf') pack.push('Spellbook');
  
  return {
    weapon: weaponsByClass[classKey] ?? 'Dagger',
    armor: armorByClass[classKey] ?? 'None',
    shield: canUseShield && rng.chance(0.7) ? 'Shield' : null,
    pack,
    gold: Math.floor(goldBudget),
  };
}

/**
 * Calculate AC from armor and dex
 */
function calculateAC(armor: string, hasShield: boolean, dexMod: number): number {
  const armorAC: Record<string, number> = {
    'None': 9,
    'Leather': 7,
    'Chain Mail': 5,
    'Plate Mail': 3,
  };
  
  let ac = armorAC[armor] ?? 9;
  if (hasShield) ac -= 1;
  ac -= dexMod;
  
  return ac;
}

/**
 * Generate a deterministic name for a character if not provided
 */
function generateDeterministicName(seed: string, rng: SeededRandom): string {
  // Pick from either male or female names based on seed
  const isFemale = rng.chance(0.5);
  const namePool = isFemale ? FEMALE_NAMES : MALE_NAMES;
  return rng.pick(namePool);
}

/**
 * Transform a single party member to a war-machine Character
 * Uses a seed string for deterministic random generation
 */
export function transformPartyMember(member: PartyMember, partyName: string, memberIndex: number, partyXp: number = 0): Character {
  // Create seed from party name, member index, and class for deterministic randomness
  const seed = `${partyName}:${memberIndex}:${member.class}:${member.name ?? 'unnamed'}`;
  const rng = new SeededRandom(seed);
  
  const classKey = mapClassKey(member.class);
  const classDef = CLASS_DEFINITIONS[classKey] ?? CLASS_DEFINITIONS.fighter;
  const race = classDef.type === 'demihuman' ? classDef.name : 'Human';
  
  // Ensure we have valid values - use deterministic defaults if missing
  const name = member.name || generateDeterministicName(seed, rng);
  const level = ensureNumber(member.level, 1);
  const hp = ensureNumber(member.hp, 8);
  const maxHp = ensureNumber(member.maxHp, hp);
  
  const abilityScores = generateAbilityScores(classKey, level, rng);
  const dexMod = getAbilityMod(abilityScores.dex);
  const chaMod = getAbilityMod(abilityScores.cha);
  
  const equipment = generateEquipment(classKey, level, rng);
  const ac = calculateAC(equipment.armor, equipment.shield !== null, dexMod);
  
  const spells = buildSpellBook(classKey, level, abilityScores, rng);
  const thiefSkills = buildThiefSkills(classKey, level, abilityScores.dex);
  const thac0 = computeThac0(classKey, level);
  const savingThrows = computeSavingThrows(classKey, level);
  
  // Distribute party XP among members (rough approximation)
  const memberXp = Math.floor(ensureNumber(partyXp, 0) / 4);
  
  // Deterministic alignment based on class tendencies
  const alignment = rng.pick(ALIGNMENTS);
  
  return {
    id: createId(),
    name,
    race,
    classKey,
    className: classDef.name,
    level,
    xp: memberXp,
    alignment,
    abilityScores,
    derivedStats: {
      hp: { current: hp, max: maxHp },
      ac,
      thac0,
      savingThrows,
    },
    spells,
    thiefSkills,
    equipment,
    retainers: [],
    maxRetainers: Math.max(0, 4 + chaMod),
    retainerMorale: 7 + chaMod,
    status: 'alive',
  };
}

/**
 * Transform all fantasy-log parties to war-machine PartyState
 */
export function transformParties(parties: Party[]): PartyState {
  const roster: Character[] = [];
  
  for (const party of parties) {
    party.members.forEach((member, index) => {
      const character = transformPartyMember(member, party.name, index, party.xp);
      // Add note about which party they belong to
      character.notes = `Member of ${party.name}`;
      roster.push(character);
    });
  }
  
  // Calculate total resources from all parties
  let totalLoot = 0;
  let totalTorches = 0;
  let totalRations = 0;
  
  for (const char of roster) {
    totalLoot += char.equipment.gold;
    if (char.equipment.pack.some(p => p.includes('Torch'))) totalTorches += 6;
    if (char.equipment.pack.some(p => p.includes('Ration'))) totalRations += 7;
  }
  
  return {
    roster,
    preferences: {
      defaultSize: Math.max(4, parties.length > 0 ? Math.floor(roster.length / parties.length) : 4),
      defaultLevel: roster.length > 0 ? Math.floor(roster.reduce((sum, c) => sum + c.level, 0) / roster.length) : 1,
      method: 'heroic',
    },
    partyResources: {
      loot: totalLoot,
      torches: totalTorches,
      rations: totalRations,
    },
  };
}

