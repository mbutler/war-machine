export interface AbilityModRange {
  min: number;
  max: number;
  mod: number;
}

export const ABILITY_MODS: readonly AbilityModRange[] = [
  { min: 1, max: 3, mod: -3 },
  { min: 4, max: 5, mod: -2 },
  { min: 6, max: 8, mod: -1 },
  { min: 9, max: 12, mod: 0 },
  { min: 13, max: 15, mod: 1 },
  { min: 16, max: 17, mod: 2 },
  { min: 18, max: 18, mod: 3 },
];

export function getAbilityMod(score: number): number {
  const range = ABILITY_MODS.find((entry) => score >= entry.min && score <= entry.max);
  return range ? range.mod : 0;
}

