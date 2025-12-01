import type { SiegeTactic } from "../../state/schema";

export const QUALITY_OPTIONS = [
  { value: 5 as const, label: "Average (+0)" },
  { value: 10 as const, label: "Good (+10)" },
  { value: 15 as const, label: "Excellent (+15)" },
];

export const TACTIC_OPTIONS: Array<{ value: SiegeTactic; label: string }> = [
  { value: "bombard", label: "Bombard" },
  { value: "harass", label: "Harass" },
  { value: "assault", label: "Assault" },
  { value: "depart", label: "Depart" },
];

// Siege tactics don't use tactical advantage matrix - each tactic has specific BR bonuses
export const SIEGE_TACTIC_BR_BONUSES: Record<SiegeTactic, { attacker: number; defender: number }> = {
  bombard: { attacker: 0, defender: 0 }, // Artillery only, no tactical bonuses
  harass: { attacker: 0, defender: 0 }, // Standard combat with siege equipment
  assault: { attacker: 5, defender: 0 }, // Attacker gets +5% bonus
  depart: { attacker: 0, defender: 0 }, // Forces leave the siege
};

export interface CombatResultRow {
  max: number;
  wCas: number;
  lCas: number;
  wLoc: string;
  lLoc: string;
}

export const COMBAT_RESULTS: CombatResultRow[] = [
  { max: 0, wCas: 0, lCas: 10, wLoc: "Field", lLoc: "Retreat" },
  { max: 8, wCas: 0, lCas: 10, wLoc: "Field", lLoc: "Retreat" },
  { max: 15, wCas: 0, lCas: 20, wLoc: "Field", lLoc: "Retreat" },
  { max: 24, wCas: 10, lCas: 20, wLoc: "Field", lLoc: "Retreat" },
  { max: 30, wCas: 10, lCas: 30, wLoc: "Field", lLoc: "Retreat + 1 hex" },
  { max: 38, wCas: 20, lCas: 40, wLoc: "Field", lLoc: "Retreat" },
  { max: 50, wCas: 0, lCas: 30, wLoc: "Field", lLoc: "Retreat + 2 hexes" },
  { max: 63, wCas: 20, lCas: 50, wLoc: "Field + 1", lLoc: "Retreat + 3 hexes" },
  { max: 80, wCas: 30, lCas: 60, wLoc: "Field + 1", lLoc: "Retreat + 3 hexes" },
  { max: 90, wCas: 10, lCas: 50, wLoc: "Field + 3", lLoc: "Retreat + 2 hexes" },
  { max: 100, wCas: 0, lCas: 30, wLoc: "Field + 3", lLoc: "Rout" },
  { max: 120, wCas: 20, lCas: 70, wLoc: "Field + 3", lLoc: "Rout" },
  { max: 150, wCas: 10, lCas: 70, wLoc: "Field + 3", lLoc: "Rout" },
  { max: 999, wCas: 10, lCas: 100, wLoc: "Field + 5", lLoc: "Rout" },
];

