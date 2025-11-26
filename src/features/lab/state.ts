import { createId } from "../../utils/id";
import type { LabState } from "../../state/schema";
import { createDefaultLabState } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { calculateLabExperiment, getLabItemLabel } from "./logic";
import { startTimedAction } from "../calendar/actions";
import { onCalendarEvent } from "../calendar/state";

const LAB_LOG_LIMIT = 30;

export type LabListener = (state: LabState) => void;

export interface ExperimentResult {
  success: boolean;
  roll?: number;
  chance?: number;
  error?: string;
}

export function getLabState(): LabState {
  return getState().lab;
}

export function subscribeToLab(listener: LabListener): () => void {
  return subscribe((state) => listener(state.lab));
}

function mutateLab(mutator: (draft: LabState) => void) {
  updateState((state) => {
    mutator(state.lab);
  });
}

export function updateLabCaster<K extends keyof LabState["caster"]>(field: K, value: LabState["caster"][K]) {
  mutateLab((draft) => {
    draft.caster[field] = value;
  });
}

export function updateLabResources<K extends keyof LabState["resources"]>(
  field: K,
  value: LabState["resources"][K],
) {
  mutateLab((draft) => {
    draft.resources[field] = value;
  });
}

export function updateLabWorkbench<K extends keyof LabState["workbench"]>(
  field: K,
  value: LabState["workbench"][K],
) {
  mutateLab((draft) => {
    draft.workbench[field] = value;
  });
}

export function investInLibrary(amount = 1000): { success: boolean; error?: string } {
  const state = getLabState();
  if (amount <= 0) {
    return { success: false, error: "Invalid investment amount." };
  }
  if (state.resources.gold < amount) {
    return { success: false, error: "Insufficient gold for investment." };
  }
  mutateLab((draft) => {
    draft.resources.gold -= amount;
    draft.resources.libraryValue += amount;
  });
  return { success: true };
}

export function attemptExperiment(): ExperimentResult {
  const state = getLabState();
  if (state.activeTrackerId) {
    return { success: false, error: "Research already in progress via calendar timer." };
  }
  const calc = calculateLabExperiment(state);

  if (state.resources.gold < calc.cost) {
    return { success: false, error: "Insufficient gold for this experiment." };
  }
  if (!calc.libraryOk) {
    return { success: false, error: "Library value is below the required threshold." };
  }
  if (calc.mode === "item" && !state.workbench.hasFormula) {
    return { success: false, error: "Item creation requires a researched formula." };
  }

  const roll = Math.floor(Math.random() * 100) + 1;
  const success = roll <= calc.chance;
  const outcome: "success" | "fail" = success ? "success" : "fail";

  const entry = buildLogEntry({
    state,
    calc,
    roll,
    outcome,
  });

  mutateLab((draft) => {
    draft.resources.gold -= calc.cost;
    draft.log.unshift(entry);
    draft.log = draft.log.slice(0, LAB_LOG_LIMIT);
  });

  const trackerLabel =
    calc.mode === "formula"
      ? `Lab: Formula Research (${calc.timeWeeks} wk)`
      : `Lab: ${getLabItemLabel(state.workbench.itemType)} (${calc.timeWeeks} wk)`;
  const tracker = startTimedAction({
    name: trackerLabel,
    duration: Math.max(1, calc.timeWeeks),
    unit: "week",
    kind: "lab",
    blocking: true,
  });
  if (tracker) {
    mutateLab((draft) => {
      draft.activeTrackerId = tracker.trackerId;
    });
  }

  return { success, roll, chance: calc.chance };
}

function buildLogEntry({
  state,
  calc,
  roll,
  outcome,
}: {
  state: LabState;
  calc: ReturnType<typeof calculateLabExperiment>;
  roll: number;
  outcome: "success" | "fail";
}) {
  const itemLabel = getLabItemLabel(state.workbench.itemType);
  const action = calc.mode === "formula" ? "Formula" : itemLabel;
  const title =
    outcome === "success"
      ? calc.mode === "formula"
        ? "Formula Discovered"
        : `${itemLabel} Created`
      : calc.mode === "formula"
        ? "Research Failed"
        : `${itemLabel} Failed`;

  let description = `${action} attempt used ${calc.timeWeeks} week(s) and ${calc.cost.toLocaleString()} gp.`;
  description += ` Roll ${roll}/${calc.chance}% — ${outcome === "success" ? "success" : "failure"}.`;
  if (outcome === "fail" && roll >= 95) {
    description += " Catastrophic backlash rattles the lab!";
  }

  return {
    id: createId(),
    timestamp: Date.now(),
    title,
    description,
    itemType: state.workbench.itemType,
    outcome,
    roll,
    chance: calc.chance,
    weeks: calc.timeWeeks,
    cost: calc.cost,
  };
}

export function clearLabLog() {
  mutateLab((draft) => {
    draft.log = [];
  });
}

export function resetLabState() {
  mutateLab((draft) => {
    const defaults = createDefaultLabState();
    draft.caster = defaults.caster;
    draft.resources = defaults.resources;
    draft.workbench = defaults.workbench;
    draft.log = defaults.log;
    draft.activeTrackerId = defaults.activeTrackerId;
  });
}

onCalendarEvent((event) => {
  if (event.type !== "timers-expired") {
    return;
  }
  const expiredIds = new Set(event.trackers.filter((tracker) => tracker.kind === "lab").map((tracker) => tracker.id));
  if (!expiredIds.size) {
    return;
  }
  mutateLab((draft) => {
    if (draft.activeTrackerId && expiredIds.has(draft.activeTrackerId)) {
      draft.activeTrackerId = null;
    }
  });
});

