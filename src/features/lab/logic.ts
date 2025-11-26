import type { LabItemType, LabMode, LabState } from "../../state/schema";
import { LAB_ITEM_MAP } from "./constants";

export interface LabCalculationResult {
  mode: LabMode;
  itemType: LabItemType;
  spellLevel: number;
  timeWeeks: number;
  cost: number;
  chance: number;
  libraryRequired: number;
  libraryOk: boolean;
  breakdown: string;
}

export function calculateLabExperiment(state: LabState): LabCalculationResult {
  const mode = state.workbench.mode;
  const itemType = state.workbench.itemType;
  const spellLevel = Math.max(1, Math.floor(state.workbench.spellLevel));
  const materialCost = Math.max(0, Math.floor(state.workbench.materialCost));

  let timeWeeks = 0;
  let cost = 0;

  if (mode === "formula") {
    timeWeeks = Math.max(1, spellLevel);
    cost = timeWeeks * 1000;
  } else if (itemType === "scroll") {
    timeWeeks = Math.max(1, spellLevel);
    cost = Math.max(1, spellLevel) * 500;
  } else if (itemType === "potion") {
    timeWeeks = 1;
    cost = 500;
  } else {
    timeWeeks = Math.max(1, spellLevel);
    cost = materialCost + spellLevel * 1000;
  }

  const casterLevel = Math.max(1, state.caster.level);
  const casterStat = Math.max(1, state.caster.mentalStat);
  const libraryRequired = spellLevel * 2000;
  const libraryOk = state.resources.libraryValue >= libraryRequired;

  let chance = 15 + casterLevel + casterStat - spellLevel * 2;
  if (!libraryOk) {
    chance = 0;
  } else {
    chance = Math.min(95, Math.max(5, chance));
  }

  const breakdown = `Base(15) + Lvl(${casterLevel}) + Stat(${casterStat}) - Diff(${spellLevel * 2})`;

  return {
    mode,
    itemType,
    spellLevel,
    timeWeeks,
    cost,
    chance,
    libraryRequired,
    libraryOk,
    breakdown,
  };
}

export function getLabItemLabel(itemType: LabItemType): string {
  return LAB_ITEM_MAP.get(itemType)?.label ?? itemType;
}

