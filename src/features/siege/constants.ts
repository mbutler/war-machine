import type { SiegeTactic } from "../../state/schema";

export const QUALITY_OPTIONS = [
  { value: 5 as const, label: "Average (+0)" },
  { value: 10 as const, label: "Good (+10)" },
  { value: 15 as const, label: "Excellent (+15)" },
];

export const TACTIC_OPTIONS: Array<{ value: SiegeTactic; label: string }> = [
  { value: "attack", label: "Attack" },
  { value: "envelop", label: "Envelop" },
  { value: "trap", label: "Trap" },
  { value: "hold", label: "Hold" },
  { value: "withdraw", label: "Withdraw" },
];

export const TACTIC_MATRIX: Record<SiegeTactic, Record<SiegeTactic, number>> = {
  attack: { attack: 0, envelop: -20, trap: 20, hold: 0, withdraw: 0 },
  envelop: { attack: 20, envelop: 0, trap: -20, hold: 20, withdraw: 0 },
  trap: { attack: -20, envelop: 20, trap: 0, hold: 20, withdraw: 0 },
  hold: { attack: 0, envelop: -20, trap: -20, hold: 0, withdraw: 0 },
  withdraw: { attack: 0, envelop: 0, trap: 0, hold: 0, withdraw: 0 },
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

