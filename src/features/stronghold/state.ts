import type { StrongholdState } from "../../state/schema";
import { createDefaultStrongholdState } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { getComponentById } from "./components";
import { buildStrongholdExportPayload, normalizeSelection } from "./logic";

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
  mutateStronghold((draft) => {
    draft.projectName = defaults.projectName;
    draft.terrainMod = defaults.terrainMod;
    draft.components = defaults.components;
    draft.projects = defaults.projects;
  });
}

export function exportStrongholdPlan(): string {
  const payload = buildStrongholdExportPayload(getStrongholdState());
  return JSON.stringify(payload, null, 2);
}

