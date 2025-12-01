import type { SiegeForce, SiegeState, SiegeTactic } from "../../state/schema";
import { createDefaultSiegeState } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { resolveBattle } from "./logic";
import { startTimedAction, cancelTimedAction } from "../calendar/actions";
import { onCalendarEvent } from "../calendar/state";
import { serializeModuleExport } from "../../utils/moduleExport";

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

export function updateForceFatigue(force: ForceKey, fatigue: FatigueLevel) {
  mutateSiege((draft) => {
    draft[force].fatigue = fatigue;
  });
}

export function updateForceTreasury(force: ForceKey, treasury: number) {
  mutateSiege((draft) => {
    draft[force].treasury = Math.max(0, treasury);
  });
}

export function updateForceAmmunition(force: ForceKey, ammoType: "ltCatapult" | "hvCatapult" | "ballista", amount: number) {
  mutateSiege((draft) => {
    draft[force].ammunition[ammoType] = Math.max(0, amount);
  });
}

export function updateForceRations(force: ForceKey, rations: number) {
  mutateSiege((draft) => {
    draft[force].rations = Math.max(0, rations);
  });
}

export function updateForceClerics(force: ForceKey, clerics: number) {
  mutateSiege((draft) => {
    draft[force].clerics = Math.max(0, clerics);
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
  const recoveryDays = calculateRecoveryDays(logEntry.attackerLosses, logEntry.defenderLosses);
  if (recoveryDays > 0) {
    const trackerUnit = recoveryDays >= 14 ? "week" : "day";
    const duration = trackerUnit === "week" ? Math.max(1, Math.ceil(recoveryDays / 7)) : recoveryDays;
    const tracker = startTimedAction({
      name: `Siege Recovery: ${logEntry.winner}`,
      duration,
      unit: trackerUnit,
      kind: "siege",
    });
    if (tracker) {
      logEntry.recoveryTrackerId = tracker.trackerId;
      logEntry.recoveryReady = false;
      logEntry.recoveryDays = recoveryDays;
    }
  }
  mutateSiege((draft) => {
    draft.log.unshift(logEntry);
    draft.log = draft.log.slice(0, LOG_LIMIT);
  });
  return logEntry;
}

export function clearSiegeLog() {
  const state = getSiegeState();
  state.log.forEach((entry) => {
    if (entry.recoveryTrackerId) {
      cancelTimedAction(entry.recoveryTrackerId);
    }
  });
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
    if (entry.recoveryTrackerId && entry.recoveryReady === false) {
      return;
    }
    draft.attacker.troops = Math.max(0, draft.attacker.troops - entry.attackerLosses);
    draft.defender.troops = Math.max(0, draft.defender.troops - entry.defenderLosses);
    entry.applied = true;
  });
}

function calculateRecoveryDays(attackerLosses: number, defenderLosses: number): number {
  const total = attackerLosses + defenderLosses;
  if (total <= 0) {
    return 0;
  }
  return Math.max(1, Math.ceil(total / 200));
}

// Siege Accounting Functions
export function deductWeeklyCosts() {
  mutateSiege((draft) => {
    // Deduct weekly payroll (1/4 of monthly mercenary rates)
    // Assuming standard rates from BECMI Chapter 11
    const attackerPayroll = Math.floor((draft.attacker.troops * 1) / 4); // 1 gp/month per troop = 0.25 gp/week
    const defenderPayroll = Math.floor((draft.defender.troops * 1) / 4);

    draft.attacker.treasury = Math.max(0, draft.attacker.treasury - attackerPayroll);
    draft.defender.treasury = Math.max(0, draft.defender.treasury - defenderPayroll);

    // Deduct rations (1 week per person)
    draft.attacker.rations = Math.max(0, draft.attacker.rations - draft.attacker.troops);
    draft.defender.rations = Math.max(0, draft.defender.rations - draft.defender.troops);

    // Apply fatigue from inadequate rations
    if (draft.attacker.rations <= 0) {
      if (draft.attacker.fatigue === "none") draft.attacker.fatigue = "moderate";
      else if (draft.attacker.fatigue === "moderate") draft.attacker.fatigue = "serious";
    }
    if (draft.defender.rations <= 0) {
      if (draft.defender.fatigue === "none") draft.defender.fatigue = "moderate";
      else if (draft.defender.fatigue === "moderate") draft.defender.fatigue = "serious";
    }

    // Deduct ammunition based on usage (simplified)
    // In full implementation, this would be based on actual weapon usage
    if (draft.attacker.siegeEngines.ltCatapult > 0) {
      draft.attacker.ammunition.ltCatapult = Math.max(0, draft.attacker.ammunition.ltCatapult - 4);
    }
    if (draft.attacker.siegeEngines.hvCatapult > 0) {
      draft.attacker.ammunition.hvCatapult = Math.max(0, draft.attacker.ammunition.hvCatapult - 6);
    }
    if (draft.attacker.siegeEngines.ballista > 0) {
      draft.attacker.ammunition.ballista = Math.max(0, draft.attacker.ammunition.ballista - 2);
    }
    if (draft.defender.siegeEngines.ballista > 0) {
      draft.defender.ammunition.ballista = Math.max(0, draft.defender.ammunition.ballista - 2);
    }

    // Advance siege turn
    draft.turn.week += 1;
    draft.turn.hasResolved = false;
  });
}

export function gatherAmmunition() {
  mutateSiege((draft) => {
    // Simplified ammunition gathering
    // Attacker can gather from spent artillery
    const attackerArtillery = draft.attacker.siegeEngines.ltCatapult + draft.attacker.siegeEngines.hvCatapult;
    if (attackerArtillery > 0) {
      const gathered = Math.floor(attackerArtillery / 2); // Half of weapons fired
      draft.attacker.ammunition.ltCatapult += gathered;
      draft.attacker.ammunition.hvCatapult += gathered;
    }
  });
}

export function advanceSiegeTurn() {
  deductWeeklyCosts();
  gatherAmmunition();
}

// Fortification Damage Functions
export function applyFortificationDamage(damage: number, target: "walls" | "towers" | "gates") {
  mutateSiege((draft) => {
    const fort = draft.fortification;
    if (target === "walls") {
      fort.walls.hp = Math.max(0, fort.walls.hp - damage);
    } else if (target === "towers") {
      fort.towers.hp = Math.max(0, fort.towers.hp - damage);
    } else if (target === "gates") {
      fort.gates.hp = Math.max(0, fort.gates.hp - damage);
    }
  });
}

export function checkFortificationBreach(): { breached: boolean; target: string } {
  const state = getSiegeState();
  const fort = state.fortification;

  if (fort.walls.hp <= fort.walls.maxHp * 0.5) {
    return { breached: true, target: "walls" };
  }
  if (fort.towers.hp <= fort.towers.maxHp * 0.5) {
    return { breached: true, target: "towers" };
  }
  if (fort.gates.hp <= 0) {
    return { breached: true, target: "gates" };
  }

  return { breached: false, target: "" };
}

export function calculateSiegeWeaponDamage(weaponType: "ltCatapult" | "hvCatapult" | "trebuchet"): number {
  // Simplified damage calculation based on BECMI
  switch (weaponType) {
    case "ltCatapult": return Math.floor(Math.random() * 8) + 8; // 1d8+8
    case "hvCatapult": return Math.floor(Math.random() * 10) + 10; // 1d10+10
    case "trebuchet": return Math.floor(Math.random() * 12) + 13; // 1d12+13
    default: return 10;
  }
}

onCalendarEvent((event) => {
  if (event.type !== "timers-expired") {
    return;
  }
  const trackerIds = new Set(event.trackers.filter((tracker) => tracker.kind === "siege").map((tracker) => tracker.id));
  if (!trackerIds.size) {
    return;
  }
  mutateSiege((draft) => {
    draft.log.forEach((entry) => {
      if (entry.recoveryTrackerId && trackerIds.has(entry.recoveryTrackerId)) {
        entry.recoveryTrackerId = null;
        entry.recoveryReady = true;
      }
    });
  });
});

// ============================================================================
// Data Export/Import
// ============================================================================

/**
 * Exports the siege state in the standardized module format.
 */
export function exportSiegeData(): string {
  const state = getSiegeState();
  return serializeModuleExport("siege", state);
}

/**
 * Imports siege data from JSON. Supports the standardized module format.
 */
export function importSiegeData(raw: string) {
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid siege import file.");
  }

  if (payload.module === "siege" && payload.data) {
    const siegeData = payload.data as SiegeState;
    // Cancel any active recovery timers before importing
    const current = getSiegeState();
    current.log.forEach((entry) => {
      if (entry.recoveryTrackerId) {
        cancelTimedAction(entry.recoveryTrackerId);
      }
    });
    updateState((state) => {
      state.siege = normalizeSiegeState(siegeData);
    });
    return;
  }

  throw new Error("Unrecognized siege file format. Use the module export format.");
}

function normalizeSiegeState(data: Partial<SiegeState>): SiegeState {
  const defaults = createDefaultSiegeState();
  return {
    attacker: data.attacker ? {
      ...defaults.attacker,
      ...data.attacker,
      siegeEngines: { ...defaults.attacker.siegeEngines, ...(data.attacker.siegeEngines || {}) },
      ammunition: { ...defaults.attacker.ammunition, ...(data.attacker.ammunition || {}) },
    } : defaults.attacker,
    defender: data.defender ? {
      ...defaults.defender,
      ...data.defender,
      siegeEngines: { ...defaults.defender.siegeEngines, ...(data.defender.siegeEngines || {}) },
      ammunition: { ...defaults.defender.ammunition, ...(data.defender.ammunition || {}) },
    } : defaults.defender,
    fortification: data.fortification ?? defaults.fortification,
    turn: data.turn ?? defaults.turn,
    tactics: data.tactics ?? defaults.tactics,
    modifiers: data.modifiers ?? defaults.modifiers,
    log: Array.isArray(data.log)
      ? data.log.slice(0, LOG_LIMIT).map((entry) => ({
          ...entry,
          recoveryTrackerId: null, // Reset tracker on import
        }))
      : [],
  };
}

