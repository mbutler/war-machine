import type {
  DominionEventType,
  DominionLogEntry,
  DominionResource,
  DominionSeason,
  DominionState,
  DominionTurnSettings,
} from "../state/schema";
import { createId } from "../utils/id";

const STD_TAX_MIN = 10;
const STD_TAX_MAX = 20;
const MAX_HEX_POP = 500;
const MIN_CONFIDENCE = 0;
const MAX_CONFIDENCE = 500;

const EVENT_CONFIDENCE: Record<Exclude<DominionEventType, "random">, number> = {
  none: 0,
  festival: 5,
  good: 10,
  bad: -10,
  calamity: -30,
};

export interface DominionProjection {
  grossIncome: number;
  netIncome: number;
  confidenceDelta: number;
  finalConfidence: number;
  eventLabel: string;
  eventDelta: number;
  factors: string[];
  populationDelta: number;
  familiesAfter: number;
  treasuryAfter: number;
}

export interface ProcessDominionResult extends DominionProjection {
  logEntry: DominionLogEntry;
}

function sumResourceValue(resources: DominionResource[]): number {
  return resources.reduce((total, resource) => total + Number(resource.value || 0), 0);
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
  const resourceValue = sumResourceValue(state.resources);
  const grossIncome = population * (turn.taxRate + resourceValue);
  const tithe = Math.floor(grossIncome * (turn.tithePercent / 100));
  const netIncome = grossIncome - turn.expenses - tithe - turn.holidaySpending;

  let confidenceDelta = 0;
  const factors: string[] = [];

  if (turn.taxRate < STD_TAX_MIN) {
    const gain = STD_TAX_MIN - turn.taxRate;
    confidenceDelta += gain;
    factors.push(`Low Tax (+${gain})`);
  } else if (turn.taxRate > STD_TAX_MAX) {
    const loss = turn.taxRate - STD_TAX_MAX;
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
    grossIncome,
    netIncome,
    confidenceDelta,
    finalConfidence,
    eventLabel,
    eventDelta,
    factors,
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

