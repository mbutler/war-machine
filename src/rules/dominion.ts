import type {
  DominionEventType,
  DominionLogEntry,
  DominionResource,
  DominionResourceType,
  DominionSeason,
  DominionState,
  DominionTurnSettings,
} from "../state/schema";
import { createId } from "../utils/id";

// BECMI Constants
const STANDARD_INCOME_PER_FAMILY = 10; // Fixed 10 gp per family (services, not cash)
const NORMAL_TAX_RATE = 1;             // Normal tax is 1 gp per family
const LOW_TAX_THRESHOLD = 1;           // Below this = confidence bonus
const HIGH_TAX_THRESHOLD = 3;          // Above this = confidence penalty
const MAX_HEX_POP = 500;
const MIN_CONFIDENCE = 0;
const MAX_CONFIDENCE = 500;

// BECMI Resource Values (per peasant family)
const RESOURCE_VALUE_PER_FAMILY: Record<DominionResourceType, number> = {
  Animal: 2,    // Livestock, hunting, etc.
  Vegetable: 1, // Crops, timber, etc.
  Mineral: 3,   // Mining, quarrying, etc.
};

const EVENT_CONFIDENCE: Record<Exclude<DominionEventType, "random">, number> = {
  none: 0,
  festival: 5,
  good: 10,
  bad: -10,
  calamity: -30,
};

export interface DominionProjection {
  // BECMI Income Breakdown
  standardIncome: number;  // Fixed 10 gp × families (services)
  resourceIncome: number;  // Based on resource types × families
  taxIncome: number;       // Variable tax rate × families
  grossIncome: number;     // Total of all three
  
  // Deductions and Net
  tithe: number;
  netIncome: number;
  
  // Confidence
  confidenceDelta: number;
  finalConfidence: number;
  eventLabel: string;
  eventDelta: number;
  factors: string[];
  
  // Population & Treasury
  populationDelta: number;
  familiesAfter: number;
  treasuryAfter: number;
}

export interface ProcessDominionResult extends DominionProjection {
  logEntry: DominionLogEntry;
}

/**
 * Calculate total resource value per family based on BECMI rules.
 * Each resource type has a fixed value: Animal=2, Vegetable=1, Mineral=3
 * Multiple resources of the same type stack.
 */
function calculateResourceValuePerFamily(resources: DominionResource[]): number {
  return resources.reduce((total, resource) => {
    // Use BECMI fixed values, but allow override via resource.value if set > 0
    const baseValue = RESOURCE_VALUE_PER_FAMILY[resource.type] ?? 0;
    const customValue = Number(resource.value || 0);
    // If custom value is set and differs from base, use custom; otherwise use BECMI base
    return total + (customValue > 0 ? customValue : baseValue);
  }, 0);
}

function hasAllResourceTypes(resources: DominionResource[]): boolean {
  const types = new Set(resources.map((resource) => resource.type));
  return ["Animal", "Vegetable", "Mineral"].every((type) => types.has(type as DominionResource["type"]));
}

function clampConfidence(value: number): number {
  return Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, Math.round(value)));
}

function resolveEvent(event: DominionEventType, roll?: number) {
  if (event !== "random") {
    const delta = EVENT_CONFIDENCE[event];
    const label = event === "none" ? "No Notable Event" : event.charAt(0).toUpperCase() + event.slice(1);
    return { label, delta };
  }

  const randomRoll = roll ?? Math.floor(Math.random() * 20) + 1;
  if (randomRoll <= 2) return { label: "Natural Disaster", delta: -20 };
  if (randomRoll <= 5) return { label: "Bandit Raid", delta: -10 };
  if (randomRoll <= 8) return { label: "Bad Harvest / Illness", delta: -5 };
  if (randomRoll <= 12) return { label: "Uneventful Season", delta: 0 };
  if (randomRoll <= 15) return { label: "Good Weather", delta: 5 };
  if (randomRoll <= 17) return { label: "Visiting Merchant", delta: 5 };
  if (randomRoll <= 19) return { label: "Local Festival", delta: 10 };
  return { label: "Miracle / Bumper Crop", delta: 20 };
}

function computePopulationDelta(
  season: DominionSeason,
  finalConfidence: number,
  families: number,
  hexes: number,
): number {
  if (season !== "Year End") {
    return 0;
  }

  let growthPct = 0;
  if (finalConfidence >= 450) growthPct = 0.5;
  else if (finalConfidence >= 350) growthPct = 0.2;
  else if (finalConfidence >= 270) growthPct = 0.05;
  else if (finalConfidence >= 200) growthPct = 0;
  else if (finalConfidence >= 150) growthPct = -0.1;
  else growthPct = -0.2;

  let delta = Math.floor(families * growthPct);
  const maxPop = hexes * MAX_HEX_POP;
  if (delta > 0 && families + delta > maxPop) {
    delta = Math.max(0, maxPop - families);
  }
  return delta;
}

export function projectDominionTurn(
  state: DominionState,
  turn: DominionTurnSettings,
  options?: { eventRoll?: number },
): DominionProjection {
  const population = Math.max(0, state.families);
  
  // BECMI Income Calculation (three separate streams)
  // 1. Standard Income: Fixed 10 gp per family (services, not cash)
  const standardIncome = population * STANDARD_INCOME_PER_FAMILY;
  
  // 2. Resource Income: Based on resource types (Animal=2, Vegetable=1, Mineral=3)
  const resourceValuePerFamily = calculateResourceValuePerFamily(state.resources);
  const resourceIncome = population * resourceValuePerFamily;
  
  // 3. Tax Income: Variable rate (default 1 gp, adjustable)
  const taxIncome = population * turn.taxRate;
  
  // Total gross income
  const grossIncome = standardIncome + resourceIncome + taxIncome;
  
  // Calculate tithe on gross income
  const tithe = Math.floor(grossIncome * (turn.tithePercent / 100));
  
  // Net income after all deductions
  const netIncome = grossIncome - turn.expenses - tithe - turn.holidaySpending;

  let confidenceDelta = 0;
  const factors: string[] = [];

  // BECMI Confidence: Tax rate affects peasant happiness
  // Normal tax is 1 gp/family. Lower = happier, higher = discontent
  if (turn.taxRate < LOW_TAX_THRESHOLD) {
    const gain = Math.round((LOW_TAX_THRESHOLD - turn.taxRate) * 5);
    if (gain > 0) {
      confidenceDelta += gain;
      factors.push(`Low Tax (+${gain})`);
    }
  } else if (turn.taxRate > HIGH_TAX_THRESHOLD) {
    const loss = Math.round((turn.taxRate - HIGH_TAX_THRESHOLD) * 5);
    confidenceDelta -= loss;
    factors.push(`High Tax (-${loss})`);
  }

  if (turn.rulerStatus === "present") {
    confidenceDelta += 1;
    factors.push("Ruler Present (+1)");
  } else if (turn.rulerStatus === "absent") {
    confidenceDelta -= 2;
    factors.push("Ruler Absent (-2)");
  }

  if (state.rulerAlignment !== state.dominionAlignment) {
    const opposed =
      (state.rulerAlignment === "Lawful" && state.dominionAlignment === "Chaotic") ||
      (state.rulerAlignment === "Chaotic" && state.dominionAlignment === "Lawful");
    if (opposed) {
      confidenceDelta -= 5;
      factors.push("Opposed Alignment (-5)");
    } else {
      confidenceDelta -= 2;
      factors.push("Alignment Mismatch (-2)");
    }
  }

  if (!hasAllResourceTypes(state.resources)) {
    confidenceDelta -= 5;
    factors.push("Missing Resource Types (-5)");
  }

  const holidayPerCapita = population > 0 ? turn.holidaySpending / population : 0;
  if (holidayPerCapita > 0.5) {
    confidenceDelta += 2;
    factors.push("Lavish Holidays (+2)");
  } else if (holidayPerCapita < 0.1) {
    confidenceDelta -= 2;
    factors.push("No Holidays (-2)");
  }

  const { label: eventLabel, delta: eventDelta } = resolveEvent(turn.event, options?.eventRoll);
  if (eventDelta !== 0) {
    factors.push(`Event: ${eventLabel} (${eventDelta >= 0 ? "+" : ""}${eventDelta})`);
  }
  confidenceDelta += eventDelta;

  const finalConfidence = clampConfidence(state.confidence + confidenceDelta);
  const populationDelta = computePopulationDelta(turn.season, finalConfidence, population, state.hexes);
  const familiesAfter = Math.max(0, population + populationDelta);
  const treasuryAfter = state.treasury + netIncome;

  return {
    // BECMI Income Breakdown
    standardIncome,
    resourceIncome,
    taxIncome,
    grossIncome,
    
    // Deductions
    tithe,
    netIncome,
    
    // Confidence
    confidenceDelta,
    finalConfidence,
    eventLabel,
    eventDelta,
    factors,
    
    // Population & Treasury
    populationDelta,
    familiesAfter,
    treasuryAfter,
  };
}

export function processDominionTurn(
  state: DominionState,
  turn: DominionTurnSettings,
  options?: { eventRoll?: number },
): ProcessDominionResult {
  const projection = projectDominionTurn(state, turn, options);

  const logEntry: DominionLogEntry = {
    id: createId(),
    timestamp: Date.now(),
    season: turn.season,
    eventLabel: projection.eventLabel,
    incomeDelta: projection.netIncome,
    confidenceDelta: projection.confidenceDelta,
    finalConfidence: projection.finalConfidence,
    treasuryAfter: projection.treasuryAfter,
    populationDelta: projection.populationDelta,
    familiesAfter: projection.familiesAfter,
    factors: projection.factors,
  };

  return {
    ...projection,
    logEntry,
  };
}

