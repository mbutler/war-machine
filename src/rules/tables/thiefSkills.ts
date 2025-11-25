export interface ThiefSkills {
  ol: number;
  ft: number;
  rt: number;
  cw: number;
  ms: number;
  hs: number;
  pp: number;
  hn: number;
  rl?: number;
}

export const THIEF_TABLE: Record<number, ThiefSkills> = {
  1: { ol: 15, ft: 10, rt: 10, cw: 87, ms: 20, hs: 10, pp: 20, hn: 30 },
  2: { ol: 20, ft: 15, rt: 15, cw: 88, ms: 25, hs: 15, pp: 25, hn: 30 },
  3: { ol: 25, ft: 20, rt: 20, cw: 89, ms: 30, hs: 20, pp: 30, hn: 30 },
  4: { ol: 30, ft: 25, rt: 25, cw: 90, ms: 35, hs: 25, pp: 35, hn: 30, rl: 80 },
  5: { ol: 35, ft: 30, rt: 30, cw: 91, ms: 40, hs: 30, pp: 40, hn: 30, rl: 80 },
  6: { ol: 45, ft: 40, rt: 40, cw: 92, ms: 45, hs: 36, pp: 45, hn: 30, rl: 80 },
  7: { ol: 55, ft: 50, rt: 50, cw: 93, ms: 55, hs: 45, pp: 55, hn: 50, rl: 80 },
  8: { ol: 65, ft: 60, rt: 60, cw: 94, ms: 65, hs: 55, pp: 65, hn: 50, rl: 80 },
  9: { ol: 75, ft: 70, rt: 70, cw: 95, ms: 75, hs: 65, pp: 75, hn: 50, rl: 80 },
  10: { ol: 85, ft: 80, rt: 80, cw: 96, ms: 85, hs: 75, pp: 85, hn: 50, rl: 80 },
  11: { ol: 95, ft: 90, rt: 90, cw: 97, ms: 95, hs: 85, pp: 95, hn: 66, rl: 80 },
  12: { ol: 96, ft: 95, rt: 95, cw: 98, ms: 96, hs: 90, pp: 105, hn: 66, rl: 80 },
  13: { ol: 97, ft: 97, rt: 97, cw: 99, ms: 98, hs: 95, pp: 115, hn: 83, rl: 80 },
  14: { ol: 99, ft: 99, rt: 99, cw: 99, ms: 99, hs: 99, pp: 125, hn: 83, rl: 80 },
};

export function getThiefSkills(level: number): ThiefSkills {
  const key = Math.min(Math.max(level, 1), 14);
  return THIEF_TABLE[key];
}

