import type { LabItemType, LabMode, LabState } from "../../state/schema";
import { LAB_ITEM_MAP } from "./constants";

export interface LabCalculationResult {
  mode: LabMode;
  itemType: LabItemType;
  spellLevel: number;
  timeWeeks: number;
  cost: number;
  chance: number;
  libraryRequired: boolean;
  componentsRequired: boolean;
  componentsOk: boolean;
  breakdown: string;
}

export function calculateLabExperiment(state: LabState): LabCalculationResult {
  const mode = state.workbench.mode;
  const itemType = state.workbench.itemType;
  const spellLevel = Math.max(1, Math.floor(state.workbench.spellLevel));
  const materialCost = Math.max(0, Math.floor(state.workbench.materialCost));

  let timeWeeks = 0;
  let cost = 0;
  let libraryRequired = false;
  let componentsRequired = false;
  let componentsOk = true;

  if (mode === "spell") {
    // Spell Research: BECMI Chapter 17 rules
    // Cost: 1,000 gp × spell level
    cost = spellLevel * 1000;

    // Time: 1 week + 1 day per 1,000 gp spent
    timeWeeks = 1 + Math.floor(cost / 1000);

    // Requirements: Large library and rare components
    libraryRequired = true;
    componentsRequired = true;
    componentsOk = state.workbench.hasComponents;

  } else if (itemType === "scroll") {
    // Scrolls: 1 week per spell level, 500 gp per spell level
    timeWeeks = Math.max(1, spellLevel);
    cost = Math.max(1, spellLevel) * 500;
    componentsRequired = true;
    componentsOk = state.workbench.hasComponents;
  } else if (itemType === "potion") {
    // Potions: 1 week, 500 gp
    timeWeeks = 1;
    cost = 500;
    componentsRequired = true;
    componentsOk = state.workbench.hasComponents;
  } else {
    // Other magical items: BECMI Chapter 16 rules
    // Initial enchantment cost = total spell levels × 1,000 gp
    // Permanent items add 5 × initial cost
    // Time = 1 week + 1 day per 1,000 gp spent
    timeWeeks = Math.max(1, spellLevel);

    const initialCost = spellLevel * 1000; // Total spell levels × 1,000 gp
    const permanencyCost = initialCost * 5; // Permanent items cost 5 × initial cost
    const totalEnchantmentCost = initialCost + permanencyCost;

    // Add material costs (for special materials, gems, etc.)
    cost = totalEnchantmentCost + materialCost;

    // Add extra days for costs over 1,000 gp
    const extraDays = Math.floor(cost / 1000) - 1; // -1 because base is 1 week
    timeWeeks += Math.max(0, extraDays);

    componentsRequired = true;
    componentsOk = state.workbench.hasComponents;
  }

  const casterLevel = Math.max(1, state.caster.level);
  const casterStat = Math.max(1, state.caster.mentalStat);

  // BECMI success chance formula varies by activity
  let chance = 0;
  let breakdown = "";

  if (mode === "spell") {
    // Spell Research: ([Int + Lvl] × 2) - (3 × spell level) for common, - (5 × spell level) for new
    const penalty = state.workbench.isNewSpell ? 5 : 3;
    chance = (casterStat + casterLevel) * 2 - (spellLevel * penalty);
    breakdown = `([Int(${casterStat}) + Lvl(${casterLevel})] × 2) - (${penalty} × SL(${spellLevel})) = ${chance}%`;
  } else {
    // Magic Item Creation: ([Int + Lvl] × 2) - (3 × spell level)
    chance = (casterStat + casterLevel) * 2 - (spellLevel * 3);
    breakdown = `([Int(${casterStat}) + Lvl(${casterLevel})] × 2) - (3 × SL(${spellLevel})) = ${chance}%`;
  }

  // Apply requirements
  if ((libraryRequired && !state.resources.libraryValue) || (!componentsOk && componentsRequired)) {
    chance = 0;
  } else {
    chance = Math.min(95, Math.max(5, chance));
  }

  return {
    mode,
    itemType,
    spellLevel,
    timeWeeks,
    cost,
    chance,
    componentsRequired,
    componentsOk,
    breakdown,
  };
}

export function getLabItemLabel(itemType: LabItemType): string {
  return LAB_ITEM_MAP.get(itemType)?.label ?? itemType;
}

