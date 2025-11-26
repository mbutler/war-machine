import type { TreasureHoard, TreasureState } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import type { TreasureTypeKey } from "./data";
import { TREASURE_TYPES } from "./data";
import { formatHoardPlainText, generateTreasureHoard } from "./logic";

export type TreasureListener = (state: TreasureState) => void;

const HISTORY_LIMIT = 10;

export function getTreasureState(): TreasureState {
  return getState().treasure;
}

export function subscribeToTreasure(listener: TreasureListener): () => void {
  return subscribe((state) => listener(state.treasure));
}

export function setTreasureType(type: TreasureTypeKey) {
  updateState((state) => {
    state.treasure.selectedType = type;
  });
}

export function rollTreasureHoard(): TreasureHoard {
  const state = getState().treasure;
  const type = (TREASURE_TYPES[state.selectedType as TreasureTypeKey] ? state.selectedType : "A") as TreasureTypeKey;
  const hoard = generateTreasureHoard(type);

  updateState((draft) => {
    draft.treasure.hoards.unshift(hoard);
    draft.treasure.hoards = draft.treasure.hoards.slice(0, HISTORY_LIMIT);
  });

  return hoard;
}

export function removeTreasureHoard(id: string) {
  updateState((state) => {
    state.treasure.hoards = state.treasure.hoards.filter((hoard) => hoard.id !== id);
  });
}

export function clearTreasureHistory() {
  updateState((state) => {
    state.treasure.hoards = [];
  });
}

export function copyHoardToClipboard(hoard: TreasureHoard) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return Promise.reject(new Error("Clipboard API unavailable"));
  }
  return navigator.clipboard.writeText(formatHoardPlainText(hoard));
}

