import type {
  DominionLogEntry,
  DominionResourceType,
  DominionState,
  DominionTurnSettings,
} from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { processDominionTurn, projectDominionTurn, type DominionProjection } from "../../rules/dominion";
import { createId } from "../../utils/id";

export type DominionListener = (state: DominionState) => void;

export function getDominionState(): DominionState {
  return getState().dominion;
}

export function subscribeToDominion(listener: DominionListener): () => void {
  return subscribe((state) => listener(state.dominion));
}

export function updateDominionField<K extends keyof DominionState>(field: K, value: DominionState[K]) {
  updateState((state) => {
    (state.dominion[field] as DominionState[K]) = value;
  });
}

export function updateDominionTurn<K extends keyof DominionTurnSettings>(field: K, value: DominionTurnSettings[K]) {
  updateState((state) => {
    state.dominion.turn[field] = value;
  });
}

export function addDominionResource(type: DominionResourceType, name: string, value = 1) {
  updateState((state) => {
    state.dominion.resources.push({
      id: createId(),
      type,
      name,
      value,
    });
  });
}

export function updateDominionResource(id: string, updates: Partial<{ name: string; value: number }>) {
  updateState((state) => {
    const resource = state.dominion.resources.find((entry) => entry.id === id);
    if (resource) {
      if (typeof updates.name === "string") resource.name = updates.name;
      if (typeof updates.value === "number" && !Number.isNaN(updates.value)) resource.value = updates.value;
    }
  });
}

export function removeDominionResource(id: string) {
  updateState((state) => {
    state.dominion.resources = state.dominion.resources.filter((resource) => resource.id !== id);
  });
}

export function clearDominionLog() {
  updateState((state) => {
    state.dominion.log = [];
  });
}

export function processDominionSeason(): DominionLogEntry {
  let logEntry: DominionLogEntry | null = null;

  updateState((state) => {
    const result = processDominionTurn(state.dominion, state.dominion.turn);
    state.dominion.treasury = result.treasuryAfter;
    state.dominion.confidence = result.finalConfidence;
    state.dominion.families = result.familiesAfter;
    state.dominion.log.unshift(result.logEntry);
    state.dominion.log = state.dominion.log.slice(0, 100);
    logEntry = result.logEntry;
  });

  if (!logEntry) {
    throw new Error("Failed to process dominion season");
  }

  return logEntry;
}

export function getDominionProjection(): DominionProjection {
  const state = getDominionState();
  return projectDominionTurn(state, state.turn);
}

