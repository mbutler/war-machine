// Experience point tables for all BECMI classes
// Based on the BECMI Rules Cyclopedia

export interface ExperienceTable {
  [level: number]: number;
}

// Human Classes
export const FIGHTER_EXPERIENCE: ExperienceTable = {
  1: 0,
  2: 2000,
  3: 4000,
  4: 8000,
  5: 16000,
  6: 32000,
  7: 64000,
  8: 120000,
  9: 240000,
  10: 360000,
  11: 480000,
  12: 600000,
  13: 720000,
  14: 840000,
  15: 960000,
  16: 1080000,
  17: 1200000,
  18: 1320000,
  19: 1440000,
  20: 1560000,
  21: 1680000,
  22: 1800000,
  23: 1920000,
  24: 2040000,
  25: 2160000,
  26: 2280000,
  27: 2400000,
  28: 2520000,
  29: 2640000,
  30: 2760000,
  31: 2880000,
  32: 3000000,
  33: 3120000,
  34: 3240000,
  35: 3360000,
  36: 3480000,
};

export const CLERIC_EXPERIENCE: ExperienceTable = {
  1: 0,
  2: 1500,
  3: 3000,
  4: 6000,
  5: 12000,
  6: 25000,
  7: 50000,
  8: 100000,
  9: 200000,
  10: 300000,
  11: 400000,
  12: 500000,
  13: 600000,
  14: 700000,
  15: 800000,
  16: 900000,
  17: 1000000,
  18: 1100000,
  19: 1200000,
  20: 1300000,
  21: 1400000,
  22: 1500000,
  23: 1600000,
  24: 1700000,
  25: 1800000,
  26: 1900000,
  27: 2000000,
  28: 2100000,
  29: 2200000,
  30: 2300000,
  31: 2400000,
  32: 2500000,
  33: 2600000,
  34: 2700000,
  35: 2800000,
  36: 2900000,
};

export const MAGIC_USER_EXPERIENCE: ExperienceTable = {
  1: 0,
  2: 2500,
  3: 5000,
  4: 10000,
  5: 20000,
  6: 40000,
  7: 80000,
  8: 150000,
  9: 300000,
  10: 450000,
  11: 600000,
  12: 750000,
  13: 900000,
  14: 1050000,
  15: 1200000,
  16: 1350000,
  17: 1500000,
  18: 1650000,
  19: 1800000,
  20: 1950000,
  21: 2100000,
  22: 2250000,
  23: 2400000,
  24: 2550000,
  25: 2700000,
  26: 2850000,
  27: 3000000,
  28: 3150000,
  29: 3300000,
  30: 3450000,
  31: 3600000,
  32: 3750000,
  33: 3900000,
  34: 4050000,
  35: 4200000,
  36: 4350000,
};

export const THIEF_EXPERIENCE: ExperienceTable = {
  1: 0,
  2: 1200,
  3: 2400,
  4: 4800,
  5: 9600,
  6: 20000,
  7: 40000,
  8: 80000,
  9: 160000,
  10: 280000,
  11: 400000,
  12: 520000,
  13: 640000,
  14: 760000,
  15: 880000,
  16: 1000000,
  17: 1120000,
  18: 1240000,
  19: 1360000,
  20: 1480000,
  21: 1600000,
  22: 1720000,
  23: 1840000,
  24: 1960000,
  25: 2080000,
  26: 2200000,
  27: 2320000,
  28: 2440000,
  29: 2560000,
  30: 2680000,
  31: 2800000,
  32: 2920000,
  33: 3040000,
  34: 3160000,
  35: 3280000,
  36: 3400000,
};

// Demihuman Classes
export const DWARF_EXPERIENCE: ExperienceTable = {
  1: 0,
  2: 2200,
  3: 4400,
  4: 8800,
  5: 17000,
  6: 35000,
  7: 70000,
  8: 140000,
  9: 270000,
  10: 400000,
  11: 530000,
  12: 660000,
  13: 800000,
  14: 1000000,
  15: 1200000,
  16: 1400000,
  17: 1600000,
  18: 1800000,
  19: 2000000,
  20: 2200000,
  21: 2400000,
  22: 2600000,
};

export const ELF_EXPERIENCE: ExperienceTable = {
  1: 0,
  2: 4000,
  3: 8000,
  4: 16000,
  5: 32000,
  6: 64000,
  7: 120000,
  8: 250000,
  9: 400000,
  10: 600000,
  11: 850000,
  12: 1100000,
  13: 1350000,
  14: 1600000,
  15: 1850000,
  16: 2100000,
  17: 2350000,
  18: 2600000,
  19: 2850000,
  20: 3100000,
};

export const HALFLING_EXPERIENCE: ExperienceTable = {
  1: 0,
  2: 2000,
  3: 4000,
  4: 8000,
  5: 16000,
  6: 32000,
  7: 64000,
  8: 120000,
  9: 300000,
  10: 600000,
  11: 900000,
  12: 1200000,
  13: 1500000,
  14: 1800000,
  15: 2100000,
  16: 2400000,
  17: 2700000,
  18: 3000000,
};

// Optional Classes
export const DRUID_EXPERIENCE: ExperienceTable = {
  // Druids start as clerics and switch at level 9
  9: 200000,
  10: 300000,
  11: 400000,
  12: 500000,
  13: 600000,
  14: 700000,
  15: 800000,
  16: 900000,
  17: 1000000,
  18: 1100000,
  19: 1200000,
  20: 1300000,
  21: 1400000,
  22: 1500000,
  23: 1600000,
  24: 1700000,
  25: 1800000,
  26: 1900000,
  27: 2000000,
  28: 2100000,
  29: 2200000,
  30: 2300000,
  31: 2400000,
  32: 2500000,
  33: 2600000,
  34: 2700000,
  35: 2800000,
  36: 2900000,
};

export const MYSTIC_EXPERIENCE: ExperienceTable = {
  1: 0,
  2: 2000,
  3: 4000,
  4: 8000,
  5: 16000,
  6: 32000,
  7: 64000,
  8: 120000,
  9: 240000,
  10: 360000,
  11: 480000,
  12: 600000,
  13: 720000,
  14: 840000,
  15: 960000,
  16: 1080000,
};

// Get experience table for a class key
export function getExperienceTable(classKey: string): ExperienceTable {
  switch (classKey) {
    case 'fighter':
      return FIGHTER_EXPERIENCE;
    case 'cleric':
      return CLERIC_EXPERIENCE;
    case 'magicuser':
      return MAGIC_USER_EXPERIENCE;
    case 'thief':
      return THIEF_EXPERIENCE;
    case 'dwarf':
      return DWARF_EXPERIENCE;
    case 'elf':
      return ELF_EXPERIENCE;
    case 'halfling':
      return HALFLING_EXPERIENCE;
    case 'druid':
      return DRUID_EXPERIENCE;
    case 'mystic':
      return MYSTIC_EXPERIENCE;
    default:
      return FIGHTER_EXPERIENCE; // fallback
  }
}

// Get XP needed for next level
export function getXpForNextLevel(classKey: string, currentLevel: number): number {
  const table = getExperienceTable(classKey);
  const nextLevel = currentLevel + 1;
  return table[nextLevel] || 0; // 0 means max level reached
}

// Check if character can level up
export function canLevelUp(classKey: string, currentXp: number, currentLevel: number): boolean {
  const nextXp = getXpForNextLevel(classKey, currentLevel);
  return nextXp > 0 && currentXp >= nextXp;
}

// Get maximum level for a class
export function getMaxLevel(classKey: string): number {
  const table = getExperienceTable(classKey);
  const levels = Object.keys(table).map(Number).sort((a, b) => b - a);
  return levels[0] || 1;
}




