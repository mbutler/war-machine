import type { SiegeForce, SiegeState, SiegeTactic } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { resolveBattle } from "./logic";

const LOG_LIMIT = 15;

export type SiegeListener = (state: SiegeState) => void;

type ForceKey = "attacker" | "defender";
type EngineKey = keyof SiegeForce["siegeEngines"];
type ModifierSide = "attacker" | "defender";
type AttackerModifierKey = keyof SiegeState["modifiers"]["attacker"];
type DefenderModifierKey = keyof SiegeState["modifiers"]["defender"];

export function getSiegeState(): SiegeState {
  return getState().siege;
}

export function subscribeToSiege(listener: SiegeListener): () => void {
  return subscribe((state) => listener(state.siege));
}

function mutateSiege(mutator: (draft: SiegeState) => void) {
  updateState((state) => {
    mutator(state.siege);
  });
}

export function updateForceField<K extends keyof SiegeForce>(force: ForceKey, field: K, value: SiegeForce[K]) {
  mutateSiege((draft) => {
    (draft[force][field] as SiegeForce[K]) = value;
  });
}

export function updateSiegeEngine(force: ForceKey, engine: EngineKey, value: number) {
  mutateSiege((draft) => {
    draft[force].siegeEngines[engine] = Math.max(0, value);
  });
}

export function updateTactic(role: ForceKey, tactic: SiegeTactic) {
  mutateSiege((draft) => {
    draft.tactics[role] = tactic;
  });
}

export function updateModifier(side: ModifierSide, key: AttackerModifierKey | DefenderModifierKey, value: boolean) {
  mutateSiege((draft) => {
    (draft.modifiers[side] as any)[key] = value;
  });
}

export function rollBattle() {
  const current = getSiegeState();
  const { logEntry } = resolveBattle(current);
  mutateSiege((draft) => {
    draft.log.unshift(logEntry);
    draft.log = draft.log.slice(0, LOG_LIMIT);
  });
  return logEntry;
}

export function clearSiegeLog() {
  mutateSiege((draft) => {
    draft.log = [];
  });
}

export function applySiegeCasualties(entryId: string) {
  mutateSiege((draft) => {
    const entry = draft.log.find((log) => log.id === entryId);
    if (!entry || entry.applied) {
      return;
    }
    draft.attacker.troops = Math.max(0, draft.attacker.troops - entry.attackerLosses);
    draft.defender.troops = Math.max(0, draft.defender.troops - entry.defenderLosses);
    entry.applied = true;
  });
}

