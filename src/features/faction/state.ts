import type {
  Faction,
  FactionLogEntry,
  FactionOperation,
  FactionRelationship,
  FactionState,
} from "../../state/schema";
import { DEFAULT_STATE } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { createId } from "../../utils/id";
import { serializeModuleExport } from "../../utils/moduleExport";

export type FactionListener = (state: FactionState) => void;

export function getFactionState(): FactionState {
  return getState().faction;
}

export function subscribeToFaction(listener: FactionListener): () => void {
  return subscribe((state) => listener(state.faction));
}

export function selectFaction(factionId: string | null) {
  updateState((state) => {
    state.faction.selectedFactionId = factionId;
  });
}

export function getSelectedFaction(): Faction | null {
  const state = getFactionState();
  if (!state.selectedFactionId) return null;
  return state.factions.find((f) => f.id === state.selectedFactionId) ?? null;
}

export function updateFaction(factionId: string, updates: Partial<Faction>) {
  updateState((state) => {
    const faction = state.faction.factions.find((f) => f.id === factionId);
    if (faction) {
      Object.assign(faction, updates);
    }
  });
}

export function addFaction(faction: Omit<Faction, "id">): string {
  const id = createId();
  updateState((state) => {
    state.faction.factions.push({ ...faction, id });
  });
  return id;
}

export function removeFaction(factionId: string) {
  updateState((state) => {
    state.faction.factions = state.faction.factions.filter((f) => f.id !== factionId);
    state.faction.relationships = state.faction.relationships.filter(
      (r) => r.factionA !== factionId && r.factionB !== factionId
    );
    state.faction.operations = state.faction.operations.filter(
      (o) => !o.participants.includes(factionId)
    );
    if (state.faction.selectedFactionId === factionId) {
      state.faction.selectedFactionId = null;
    }
  });
}

export function setRelationship(
  factionA: string,
  factionB: string,
  status: FactionRelationship["status"],
  reason?: string
) {
  updateState((state) => {
    const existing = state.faction.relationships.find(
      (r) =>
        (r.factionA === factionA && r.factionB === factionB) ||
        (r.factionA === factionB && r.factionB === factionA)
    );
    if (existing) {
      existing.status = status;
      existing.reason = reason;
    } else {
      state.faction.relationships.push({ factionA, factionB, status, reason });
    }
  });
}

export function getRelationship(factionA: string, factionB: string): FactionRelationship | null {
  const state = getFactionState();
  return (
    state.relationships.find(
      (r) =>
        (r.factionA === factionA && r.factionB === factionB) ||
        (r.factionA === factionB && r.factionB === factionA)
    ) ?? null
  );
}

export function addOperation(operation: Omit<FactionOperation, "id">): string {
  const id = createId();
  updateState((state) => {
    state.faction.operations.push({ ...operation, id });
  });
  return id;
}

export function updateOperation(operationId: string, updates: Partial<FactionOperation>) {
  updateState((state) => {
    const operation = state.faction.operations.find((o) => o.id === operationId);
    if (operation) {
      Object.assign(operation, updates);
    }
  });
}

export function removeOperation(operationId: string) {
  updateState((state) => {
    state.faction.operations = state.faction.operations.filter((o) => o.id !== operationId);
  });
}

export function addFactionLogEntry(entry: Omit<FactionLogEntry, "id" | "timestamp">) {
  updateState((state) => {
    state.faction.log.unshift({
      ...entry,
      id: createId(),
      timestamp: Date.now(),
    });
    state.faction.log = state.faction.log.slice(0, 200);
  });
}

export function clearFactionLog() {
  updateState((state) => {
    state.faction.log = [];
  });
}

// ============================================================================
// Focus Icons & Labels
// ============================================================================

export const FOCUS_ICONS: Record<Faction["focus"], string> = {
  trade: "[T]",
  martial: "[M]",
  pious: "[P]",
  arcane: "[A]",
};

export const FOCUS_LABELS: Record<Faction["focus"], string> = {
  trade: "Trade",
  martial: "Martial",
  pious: "Pious",
  arcane: "Arcane",
};

export const RELATIONSHIP_LABELS: Record<FactionRelationship["status"], string> = {
  allied: "Allied",
  friendly: "Friendly",
  neutral: "Neutral",
  hostile: "Hostile",
  war: "At War",
};

export const RELATIONSHIP_COLORS: Record<FactionRelationship["status"], string> = {
  allied: "#22c55e",
  friendly: "#86efac",
  neutral: "#94a3b8",
  hostile: "#fca5a5",
  war: "#ef4444",
};

// ============================================================================
// Data Export/Import
// ============================================================================

export function exportFactionData(): string {
  const state = getFactionState();
  return serializeModuleExport("faction", state);
}

export function importFactionData(raw: string) {
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid faction import file.");
  }

  if (payload.module === "faction" && payload.data) {
    const factionData = payload.data as FactionState;
    updateState((state) => {
      state.faction = normalizeFactionState(factionData);
    });
    return;
  }

  throw new Error("Unrecognized faction file format. Use the module export format.");
}

function normalizeFactionState(data: Partial<FactionState>): FactionState {
  const defaults = DEFAULT_STATE.faction;
  return {
    factions: Array.isArray(data.factions) ? data.factions : defaults.factions,
    relationships: Array.isArray(data.relationships) ? data.relationships : defaults.relationships,
    operations: Array.isArray(data.operations) ? data.operations : defaults.operations,
    log: Array.isArray(data.log) ? data.log.slice(0, 200) : defaults.log,
    selectedFactionId: null,
  };
}
