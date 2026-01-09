import type { StrongholdState } from "../../state/schema";
import { createDefaultStrongholdState } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { getComponentById } from "./components";
import { buildStrongholdExportPayload, calculateStrongholdSummary, normalizeSelection } from "./logic";
import { startTimedAction, cancelTimedAction } from "../calendar/actions";
import { onCalendarEvent } from "../calendar/state";
import { createId } from "../../utils/id";
import { serializeModuleExport } from "../../utils/moduleExport";

export type StrongholdListener = (state: StrongholdState) => void;

export function getStrongholdState(): StrongholdState {
  return getState().stronghold;
}

export function subscribeToStronghold(listener: StrongholdListener): () => void {
  return subscribe((state) => listener(state.stronghold));
}

function mutateStronghold(mutator: (draft: StrongholdState) => void) {
  updateState((state) => {
    mutator(state.stronghold);
  });
}

export function setStrongholdName(name: string) {
  mutateStronghold((draft) => {
    draft.projectName = name.trimStart();
  });
}

export function setTerrainModifier(modifier: number) {
  const safeValue = Number.isFinite(modifier) && modifier > 0 ? Number(modifier.toFixed(2)) : 1;
  mutateStronghold((draft) => {
    draft.terrainMod = safeValue;
  });
}

export function addComponent(componentId: string, quantity: number): boolean {
  const component = getComponentById(componentId);
  if (!component) {
    return false;
  }
  const normalizedQty = Math.max(1, Math.floor(quantity));
  mutateStronghold((draft) => {
    const existing = draft.components.find((entry) => entry.id === componentId);
    if (existing) {
      existing.qty = Math.max(1, existing.qty + normalizedQty);
    } else {
      draft.components.push(normalizeSelection({ id: componentId, qty: normalizedQty }));
    }
  });
  return true;
}

export function updateComponentQuantity(componentId: string, quantity: number) {
  mutateStronghold((draft) => {
    const selection = draft.components.find((entry) => entry.id === componentId);
    if (!selection) return;
    const normalizedQty = Math.max(0, Math.floor(quantity));
    if (normalizedQty <= 0) {
      draft.components = draft.components.filter((entry) => entry.id !== componentId);
      return;
    }
    selection.qty = normalizedQty;
  });
}

export function removeComponent(componentId: string) {
  mutateStronghold((draft) => {
    draft.components = draft.components.filter((entry) => entry.id !== componentId);
  });
}

export function resetStrongholdState() {
  const defaults = createDefaultStrongholdState();
  const current = getStrongholdState();
  if (current.activeTrackerId) {
    cancelTimedAction(current.activeTrackerId);
  }
  mutateStronghold((draft) => {
    draft.projectName = defaults.projectName;
    draft.terrainMod = defaults.terrainMod;
    draft.components = defaults.components;
    draft.projects = defaults.projects;
    draft.activeProjectId = defaults.activeProjectId;
    draft.activeTrackerId = defaults.activeTrackerId;
  });
}

/**
 * Selects a project from the projects list to view/edit.
 * This loads the project's name into the editor and sets it as the active selection.
 */
export function selectProject(projectId: string | null) {
  if (!projectId) {
    mutateStronghold((draft) => {
      draft.activeProjectId = null;
      draft.projectName = "New Stronghold";
      draft.components = [];
    });
    return;
  }
  
  const state = getStrongholdState();
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;
  
  mutateStronghold((draft) => {
    draft.activeProjectId = projectId;
    draft.projectName = project.name;
    // Note: components are currently global, not per-project
    // Future enhancement could store components per-project
  });
}

/**
 * Exports the stronghold state in the standardized module format.
 * This format is compatible with both individual module import and full campaign import.
 */
export function exportStrongholdData(): string {
  const state = getStrongholdState();
  return serializeModuleExport("stronghold", state);
}

/**
 * Legacy export for backward compatibility - exports display-friendly summary.
 */
export function exportStrongholdPlan(): string {
  const payload = buildStrongholdExportPayload(getStrongholdState());
  return JSON.stringify(payload, null, 2);
}

/**
 * Imports stronghold data from JSON. Supports multiple formats:
 * - Standardized module format (module: "stronghold", data: StrongholdState)
 */
export function importStrongholdData(raw: string) {
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid stronghold import file.");
  }

  // Handle standardized module format
  if (payload.module === "stronghold" && payload.data) {
    const strongholdData = payload.data as StrongholdState;
    // Cancel any active construction before importing
    const current = getStrongholdState();
    if (current.activeTrackerId) {
      cancelTimedAction(current.activeTrackerId);
    }
    updateState((state) => {
      state.stronghold = normalizeStrongholdState(strongholdData);
    });
    return;
  }

  throw new Error("Unrecognized stronghold file format. Use the module export format.");
}

function normalizeStrongholdState(data: Partial<StrongholdState>): StrongholdState {
  const defaults = createDefaultStrongholdState();
  return {
    projectName: typeof data.projectName === "string" ? data.projectName : defaults.projectName,
    terrainMod: typeof data.terrainMod === "number" ? data.terrainMod : defaults.terrainMod,
    components: Array.isArray(data.components)
      ? data.components.map((c) => normalizeSelection(c))
      : defaults.components,
    projects: Array.isArray(data.projects) ? data.projects : defaults.projects,
    activeProjectId: typeof data.activeProjectId === "string" ? data.activeProjectId : null,
    activeTrackerId: null, // Always reset tracker on import - the timer won't exist
  };
}

export function startStrongholdConstruction(): { success: boolean; error?: string } {
  const state = getStrongholdState();
  if (state.activeTrackerId) {
    return { success: false, error: "A construction project is already underway." };
  }
  const summary = calculateStrongholdSummary(state);
  if (!summary.items.length || summary.buildDays <= 0) {
    return { success: false, error: "Add at least one component before starting construction." };
  }
  const projectName = state.projectName?.trim() || "Stronghold Project";
  const durationDays = Math.max(1, summary.buildDays);
  const useWeeks = durationDays >= 14;
  const unit = useWeeks ? "week" : "day";
  const duration = useWeeks ? Math.max(1, Math.ceil(durationDays / 7)) : durationDays;
  const tracker = startTimedAction({
    name: `Stronghold: ${projectName}`,
    duration,
    unit,
    kind: "stronghold",
  });
  if (!tracker) {
    return { success: false, error: "Unable to attach construction timer to the calendar." };
  }
  const projectId = createId();
  mutateStronghold((draft) => {
    draft.activeTrackerId = tracker.trackerId;
    draft.activeProjectId = projectId;
    draft.projects.unshift({
      id: projectId,
      name: projectName,
      cost: summary.totalCost,
      status: "active",
      buildDays: summary.buildDays,
      startedAt: Date.now(),
      completedAt: null,
      trackerId: tracker.trackerId,
    });
    draft.components = [];
  });
  return { success: true };
}

export function cancelStrongholdConstruction(): boolean {
  const state = getStrongholdState();
  if (!state.activeTrackerId) {
    return false;
  }
  cancelTimedAction(state.activeTrackerId);
  mutateStronghold((draft) => {
    draft.projects.forEach((project) => {
      if (project.id === draft.activeProjectId) {
        project.status = "planned";
        project.trackerId = null;
        project.completedAt = null;
      }
    });
    draft.activeTrackerId = null;
    draft.activeProjectId = null;
  });
  return true;
}

onCalendarEvent((event) => {
  if (event.type !== "timers-expired") {
    return;
  }
  const completed = event.trackers.filter((tracker) => tracker.kind === "stronghold");
  if (!completed.length) {
    return;
  }
  const trackerIds = new Set(completed.map((tracker) => tracker.id));
  mutateStronghold((draft) => {
    if (draft.activeTrackerId && trackerIds.has(draft.activeTrackerId)) {
      draft.activeTrackerId = null;
      draft.activeProjectId = null;
    }
    draft.projects.forEach((project) => {
      if (project.trackerId && trackerIds.has(project.trackerId)) {
        project.status = "complete";
        project.completedAt = Date.now();
        project.trackerId = null;
      }
    });
  });
});

