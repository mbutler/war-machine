import type { StrongholdComponentSelection, StrongholdState } from "../../state/schema";
import { getComponentById } from "./components";

export interface StrongholdSummaryItem {
  id: string;
  name: string;
  qty: number;
  unitCost: number;
  totalCost: number;
  description: string;
}

export interface StrongholdSummary {
  baseCost: number;
  terrainMod: number;
  totalCost: number;
  buildDays: number;
  engineers: number;
  items: StrongholdSummaryItem[];
}

export function calculateStrongholdSummary(state: StrongholdState): StrongholdSummary {
  const items: StrongholdSummaryItem[] = [];
  let baseCost = 0;

  state.components.forEach((selection) => {
    const def = getComponentById(selection.id);
    if (!def) {
      return;
    }
    const qty = Math.max(1, selection.qty);
    const totalCost = def.cost * qty;
    baseCost += totalCost;
    items.push({
      id: def.id,
      name: def.name,
      qty,
      unitCost: def.cost,
      totalCost,
      description: def.description,
    });
  });

  const terrainMod = state.terrainMod > 0 ? state.terrainMod : 1;
  const totalCost = Math.ceil(baseCost * terrainMod);
  const buildDays = totalCost > 0 ? Math.ceil(totalCost / 500) : 0;
  const engineers = totalCost > 0 ? Math.ceil(totalCost / 100000) : 0;

  return {
    baseCost,
    terrainMod,
    totalCost,
    buildDays,
    engineers,
    items,
  };
}

export function normalizeSelection(selection: StrongholdComponentSelection): StrongholdComponentSelection {
  return {
    id: selection.id,
    qty: Math.max(1, Math.floor(selection.qty)),
  };
}

export function buildStrongholdExportPayload(state: StrongholdState) {
  const summary = calculateStrongholdSummary(state);
  return {
    name: state.projectName,
    terrainMultiplier: summary.terrainMod,
    totals: {
      baseCost: summary.baseCost,
      totalCost: summary.totalCost,
      buildDays: summary.buildDays,
      engineers: summary.engineers,
    },
    components: summary.items.map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
    })),
  };
}

