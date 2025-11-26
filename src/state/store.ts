import {
  DEFAULT_STATE,
  STATE_VERSION,
  WarMachineState,
  createDefaultLabState,
  createDefaultSiegeState,
  createDefaultStrongholdState,
} from "./schema";
import type { LabState, SiegeState, SiegeForce, SiegeTactic, StrongholdState, TreasureState } from "./schema";

type Listener = (state: WarMachineState) => void;

const STORAGE_KEY = "war-machine-state";
const BACKUP_KEY = "war-machine-state-backup";

const hasWindow = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

let currentState: WarMachineState = cloneState(DEFAULT_STATE);
const listeners = new Set<Listener>();

function cloneState<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function readFromStorage(): WarMachineState | null {
  if (!hasWindow) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as WarMachineState;
    if (!parsed.meta || parsed.meta.version !== STATE_VERSION) {
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function writeToStorage(state: WarMachineState) {
  if (!hasWindow) {
    return;
  }
  const payload = JSON.stringify(state);
  window.localStorage.setItem(STORAGE_KEY, payload);
}

function initialize() {
  const stored = readFromStorage();
  currentState = stored ? stored : cloneState(DEFAULT_STATE);
  applyStateMigrations(currentState);
  writeToStorage(currentState);
}

initialize();

function commit(next: WarMachineState) {
  applyStateMigrations(next);
  next.meta.version = STATE_VERSION;
  next.meta.lastUpdated = Date.now();
  currentState = next;
  writeToStorage(currentState);
  listeners.forEach((listener) => listener(cloneState(currentState)));
}

export function getState(): WarMachineState {
  return cloneState(currentState);
}

export function setState(partial: Partial<WarMachineState>) {
  const next = cloneState(currentState);
  Object.assign(next, partial);
  commit(next);
}

export function updateState(mutator: (draft: WarMachineState) => void) {
  const draft = cloneState(currentState);
  mutator(draft);
  commit(draft);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function exportState(snapshot: WarMachineState = currentState): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    schemaVersion: STATE_VERSION,
    state: snapshot,
  };
  return JSON.stringify(payload, null, 2);
}

export function importState(raw: string) {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Import payload is not an object");
  }

  const candidate = (payload as { state?: unknown }).state;
  if (!candidate) {
    throw new Error("Import payload missing state property");
  }

  const nextState = candidate as WarMachineState;
  if (!nextState.meta || typeof nextState.meta.version !== "string") {
    throw new Error("Invalid state metadata");
  }

  if (hasWindow) {
    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(currentState));
  }

  commit(cloneState(nextState));
}

export function resetState() {
  commit(cloneState(DEFAULT_STATE));
}

function applyStateMigrations(state: WarMachineState) {
  state.stronghold = ensureStrongholdState(state.stronghold);
  state.treasure = ensureTreasureState(state.treasure);
  state.lab = ensureLabState(state.lab);
  state.siege = ensureSiegeState(state.siege);
  state.calendar = ensureCalendarState(state.calendar);
}

function ensureStrongholdState(state?: StrongholdState): StrongholdState {
  if (!state || typeof state.projectName !== "string") {
    return createDefaultStrongholdState();
  }
  const defaults = createDefaultStrongholdState();
  return {
    projectName: state.projectName ?? defaults.projectName,
    terrainMod: typeof state.terrainMod === "number" ? state.terrainMod : defaults.terrainMod,
    components: Array.isArray(state.components) ? state.components : defaults.components,
    projects: Array.isArray(state.projects) ? state.projects : defaults.projects,
  };
}

function ensureTreasureState(state?: TreasureState): TreasureState {
  const next: TreasureState = {
    selectedType: (state && typeof state.selectedType === "string" ? state.selectedType : "A") || "A",
    hoards: Array.isArray(state?.hoards) ? state!.hoards : [],
  };
  return next;
}

function ensureLabState(state?: LabState): LabState {
  const defaults = createDefaultLabState();
  if (!state) {
    return defaults;
  }
  return {
    caster: {
      name: typeof state.caster?.name === "string" ? state.caster.name : defaults.caster.name,
      level: typeof state.caster?.level === "number" ? state.caster.level : defaults.caster.level,
      class: state.caster?.class === "cleric" ? "cleric" : "mu",
      mentalStat:
        typeof state.caster?.mentalStat === "number" ? state.caster.mentalStat : defaults.caster.mentalStat,
    },
    resources: {
      gold: typeof state.resources?.gold === "number" ? state.resources.gold : defaults.resources.gold,
      libraryValue:
        typeof state.resources?.libraryValue === "number"
          ? state.resources.libraryValue
          : defaults.resources.libraryValue,
    },
    workbench: {
      mode: state.workbench?.mode === "formula" ? "formula" : "item",
      itemType: (state.workbench?.itemType ?? defaults.workbench.itemType),
      spellLevel:
        typeof state.workbench?.spellLevel === "number" ? state.workbench.spellLevel : defaults.workbench.spellLevel,
      materialCost:
        typeof state.workbench?.materialCost === "number"
          ? state.workbench.materialCost
          : defaults.workbench.materialCost,
      hasFormula: Boolean(state.workbench?.hasFormula),
    },
    log: Array.isArray(state.log) ? state.log : [],
    activeTrackerId: state.activeTrackerId ?? null,
  };
}

function ensureSiegeState(state?: SiegeState): SiegeState {
  const defaults = createDefaultSiegeState();
  if (!state) {
    return defaults;
  }
  return {
    attacker: sanitizeForce(state.attacker, defaults.attacker),
    defender: sanitizeForce(state.defender, defaults.defender),
    tactics: {
      attacker: sanitizeTactic(state.tactics?.attacker, defaults.tactics.attacker),
      defender: sanitizeTactic(state.tactics?.defender, defaults.tactics.defender),
    },
    modifiers: {
      attacker: {
        terrain: Boolean(state.modifiers?.attacker?.terrain),
        morale: Boolean(state.modifiers?.attacker?.morale),
        fatigue: Boolean(state.modifiers?.attacker?.fatigue),
        intel: Boolean(state.modifiers?.attacker?.intel),
        traitor: Boolean(state.modifiers?.attacker?.traitor),
        heroics: Boolean(state.modifiers?.attacker?.heroics),
      },
      defender: {
        fortified: state.modifiers?.defender?.fortified ?? defaults.modifiers.defender.fortified,
        terrain: Boolean(state.modifiers?.defender?.terrain),
        morale: Boolean(state.modifiers?.defender?.morale),
        fatigue: Boolean(state.modifiers?.defender?.fatigue),
        intel: Boolean(state.modifiers?.defender?.intel),
        heroics: Boolean(state.modifiers?.defender?.heroics),
      },
    },
    log: Array.isArray(state.log) ? state.log : [],
  };
}

function ensureCalendarState(calendar: WarMachineState["calendar"]) {
  calendar.trackers = (calendar.trackers ?? []).map((tracker) => ({
    ...tracker,
    kind: tracker.kind ?? "other",
    blocking: tracker.blocking ?? false,
    startedAt: tracker.startedAt ?? Date.now(),
  }));
  return calendar;
}

function sanitizeForce(force: SiegeForce | undefined, fallback: SiegeForce): SiegeForce {
  if (!force) {
    return JSON.parse(JSON.stringify(fallback));
  }
  const engines = force.siegeEngines ?? {};
  return {
    name: typeof force.name === "string" ? force.name : fallback.name,
    troops: typeof force.troops === "number" ? force.troops : fallback.troops,
    leaderLevel: typeof force.leaderLevel === "number" ? force.leaderLevel : fallback.leaderLevel,
    leaderStatBonus:
      typeof force.leaderStatBonus === "number" ? force.leaderStatBonus : fallback.leaderStatBonus,
    percentNamed: typeof force.percentNamed === "number" ? force.percentNamed : fallback.percentNamed,
    avgOfficerLevel:
      typeof force.avgOfficerLevel === "number" ? force.avgOfficerLevel : fallback.avgOfficerLevel,
    avgTroopLevel:
      typeof force.avgTroopLevel === "number" ? force.avgTroopLevel : fallback.avgTroopLevel,
    victories: typeof force.victories === "number" ? force.victories : fallback.victories,
    trainingWeeks:
      typeof force.trainingWeeks === "number" ? force.trainingWeeks : fallback.trainingWeeks,
    quality: force.quality === 5 || force.quality === 10 || force.quality === 15 ? force.quality : fallback.quality,
    ac5: Boolean(force.ac5),
    elfOrDwarf: Boolean(force.elfOrDwarf),
    mounts: Boolean(force.mounts),
    missiles: Boolean(force.missiles),
    magic: Boolean(force.magic),
    flyers: Boolean(force.flyers),
    siegeEngines: {
      ltCatapult: sanitizeCount(engines.ltCatapult, fallback.siegeEngines.ltCatapult),
      hvCatapult: sanitizeCount(engines.hvCatapult, fallback.siegeEngines.hvCatapult),
      ram: sanitizeCount(engines.ram, fallback.siegeEngines.ram),
      tower: sanitizeCount(engines.tower, fallback.siegeEngines.tower),
      ballista: sanitizeCount(engines.ballista, fallback.siegeEngines.ballista),
    },
  };
}

function sanitizeCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeTactic(value: unknown, fallback: SiegeTactic): SiegeTactic {
  return value === "attack" ||
    value === "envelop" ||
    value === "trap" ||
    value === "hold" ||
    value === "withdraw"
    ? value
    : fallback;
}

