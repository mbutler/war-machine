export type Thac0Class = "Fighter" | "Cleric" | "MagicUser" | "Thief";

type Thac0Progression = readonly number[];

export const THAC0_TABLE: Record<Thac0Class, Thac0Progression> = {
  Fighter: [
    19, 19, 19, 17, 17, 17, 15, 15, 15, 13, 13, 13, 11, 11, 11, 9, 9, 9, 7, 7, 7, 5, 5, 5, 3, 3, 3, 2, 2, 2, 2, 2,
    2, 2, 2, 2,
  ],
  Cleric: [
    19, 19, 19, 19, 17, 17, 17, 17, 14, 14, 14, 14, 12, 12, 12, 12, 9, 9, 9, 9, 7, 7, 7, 7, 4, 4, 4, 4, 2, 2, 2, 2, 2,
    2, 2, 2,
  ],
  MagicUser: [
    19, 19, 19, 19, 19, 17, 17, 17, 17, 17, 14, 14, 14, 14, 14, 12, 12, 12, 12, 12, 9, 9, 9, 9, 9, 7, 7, 7, 7, 7, 4, 4,
    4, 4, 4, 4,
  ],
  Thief: [
    19, 19, 19, 19, 17, 17, 17, 17, 14, 14, 14, 14, 12, 12, 12, 12, 9, 9, 9, 9, 7, 7, 7, 7, 4, 4, 4, 4, 2, 2, 2, 2, 2,
    2, 2, 2,
  ],
};

export function lookupThac0(table: Thac0Progression, level: number): number {
  const index = Math.min(Math.max(level - 1, 0), table.length - 1);
  return table[index];
}

