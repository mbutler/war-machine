import {
  DEFAULT_STATE,
  STATE_VERSION,
  WarMachineState,
  createDefaultLabState,
  createDefaultLedgerState,
  createDefaultSiegeState,
  createDefaultStrongholdState,
} from "./schema";
import type {
  DominionState,
  LabState,
  LedgerState,
  MerchantJourney,
  MerchantState,
  SiegeState,
  SiegeForce,
  SiegeTactic,
  StrongholdProject,
  StrongholdState,
  TreasureState,
  SiegeBattleLogEntry,
} from "./schema";
import { createId } from "../utils/id";

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

export type ImportResult =
  | { type: "campaign" }
  | { type: "module"; module: string };

export function importState(raw: string): ImportResult {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Import payload is not an object");
  }

  const obj = payload as Record<string, unknown>;

  // Check if this is a module export (has 'module' and 'data' properties)
  if (typeof obj.module === "string" && obj.data !== undefined) {
    return importModuleState(obj.module, obj.data);
  }

  // Otherwise, treat as full campaign import
  const candidate = obj.state;
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
  return { type: "campaign" };
}

type ModuleKey = keyof Omit<WarMachineState, "meta">;

const VALID_MODULES: ModuleKey[] = [
  "party",
  "dominion",
  "wilderness",
  "calendar",
  "siege",
  "merchant",
  "stronghold",
  "treasure",
  "lab",
  "dungeon",
  "ledger",
];

function importModuleState(moduleName: string, data: unknown): ImportResult {
  if (!VALID_MODULES.includes(moduleName as ModuleKey)) {
    throw new Error(`Unknown module type: ${moduleName}`);
  }

  if (hasWindow) {
    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(currentState));
  }

  const moduleKey = moduleName as ModuleKey;
  const draft = cloneState(currentState);

  // Assign the imported data to the appropriate module slot
  (draft as Record<string, unknown>)[moduleKey] = data;

  // Run migrations to ensure data integrity
  commit(draft);

  return { type: "module", module: moduleName };
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
  state.dominion = ensureDominionState(state.dominion);
  state.merchant = ensureMerchantState(state.merchant);
  state.ledger = ensureLedgerState(state.ledger);
}

function ensureStrongholdState(state?: StrongholdState): StrongholdState {
  if (!state || typeof state.projectName !== "string") {
    return createDefaultStrongholdState();
  }
  const defaults = createDefaultStrongholdState();
  const components = Array.isArray(state.components) ? state.components : defaults.components;
  const projects = Array.isArray(state.projects) ? state.projects : defaults.projects;
  return {
    projectName: typeof state.projectName === "string" ? state.projectName : defaults.projectName,
    terrainMod: typeof state.terrainMod === "number" ? state.terrainMod : defaults.terrainMod,
    components: components.map((entry) => ({
      id: entry.id,
      qty: typeof entry.qty === "number" ? entry.qty : 1,
    })),
    projects: projects.map((project) => sanitizeStrongholdProject(project)),
    activeProjectId: typeof state.activeProjectId === "string" ? state.activeProjectId : null,
    activeTrackerId: typeof state.activeTrackerId === "string" ? state.activeTrackerId : null,
  };
}

function sanitizeStrongholdProject(project: StrongholdProject): StrongholdProject {
  const status: StrongholdProject["status"] =
    project.status === "active" || project.status === "complete" ? project.status : "planned";
  return {
    id: project.id ?? createId(),
    name: typeof project.name === "string" && project.name.length ? project.name : "Stronghold Project",
    cost: typeof project.cost === "number" ? project.cost : 0,
    status,
    buildDays: typeof project.buildDays === "number" ? project.buildDays : 0,
    startedAt: typeof project.startedAt === "number" ? project.startedAt : Date.now(),
    completedAt: typeof project.completedAt === "number" ? project.completedAt : null,
    trackerId: typeof project.trackerId === "string" ? project.trackerId : null,
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
      mode: state.workbench?.mode === "spell" ? "spell" : "item",
      itemType: state.workbench?.itemType ?? defaults.workbench.itemType,
      spellLevel:
        typeof state.workbench?.spellLevel === "number" ? state.workbench.spellLevel : defaults.workbench.spellLevel,
      materialCost:
        typeof state.workbench?.materialCost === "number"
          ? state.workbench.materialCost
          : defaults.workbench.materialCost,
      isNewSpell:
        typeof state.workbench?.isNewSpell === "boolean"
          ? state.workbench.isNewSpell
          : defaults.workbench.isNewSpell,
      hasComponents:
        typeof state.workbench?.hasComponents === "boolean"
          ? state.workbench.hasComponents
          : defaults.workbench.hasComponents,
    },
    log: Array.isArray(state.log) ? state.log : [],
    activeTrackerId: typeof state.activeTrackerId === "string" ? state.activeTrackerId : null,
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
    fortification: state.fortification ?? defaults.fortification,
    turn: state.turn ?? defaults.turn,
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
    log: Array.isArray(state.log) ? state.log.map((entry) => sanitizeSiegeLog(entry)) : [],
  };
}

function sanitizeSiegeLog(entry: SiegeBattleLogEntry): SiegeBattleLogEntry {
  return {
    ...entry,
    recoveryTrackerId: typeof entry.recoveryTrackerId === "string" ? entry.recoveryTrackerId : null,
    recoveryReady: entry.recoveryReady === false ? false : true,
    recoveryDays: typeof entry.recoveryDays === "number" ? entry.recoveryDays : undefined,
  };
}

function ensureCalendarState(calendar: WarMachineState["calendar"]) {
  calendar.trackers = (calendar.trackers ?? []).map((tracker) => ({
    ...tracker,
    kind: tracker.kind ?? "other",
    startedAt: tracker.startedAt ?? Date.now(),
  }));
  return calendar;
}

function ensureDominionState(state?: DominionState): DominionState {
  if (!state) {
    return cloneState(DEFAULT_STATE.dominion);
  }
  return {
    ...state,
    activeTrackerId: typeof state.activeTrackerId === "string" ? state.activeTrackerId : null,
  };
}

function ensureMerchantState(state?: MerchantState): MerchantState {
  const defaults = cloneState(DEFAULT_STATE.merchant);
  if (!state) {
    return defaults;
  }
  const form = { ...defaults.form, ...(state.form ?? {}) };
  const preview = state.preview ?? defaults.preview;
  const ledger = Array.isArray(state.ledger) ? state.ledger.map((entry) => sanitizeMerchantJourney(entry)) : [];
  return {
    form,
    preview,
    ledger,
  };
}

function sanitizeMerchantJourney(entry: MerchantJourney): MerchantJourney {
  const status: MerchantJourney["status"] = entry.status === "pending" ? "pending" : "complete";
  return {
    ...entry,
    status,
    trackerId: typeof entry.trackerId === "string" ? entry.trackerId : null,
    travelDays: typeof entry.travelDays === "number" ? entry.travelDays : undefined,
    deliveredAt:
      typeof entry.deliveredAt === "number"
        ? entry.deliveredAt
        : status === "complete"
          ? entry.timestamp
          : null,
  };
}

function sanitizeForce(force: SiegeForce | undefined, fallback: SiegeForce): SiegeForce {
  if (!force) {
    return JSON.parse(JSON.stringify(fallback));
  }
  const engines = force.siegeEngines ?? {};
  const ammunition = force.ammunition ?? {};
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
    fatigue: (force.fatigue === "none" || force.fatigue === "moderate" || force.fatigue === "serious") ? force.fatigue : fallback.fatigue,
    treasury: typeof force.treasury === "number" ? force.treasury : fallback.treasury,
    rations: typeof force.rations === "number" ? force.rations : fallback.rations,
    clerics: typeof force.clerics === "number" ? force.clerics : fallback.clerics,
    ammunition: {
      ltCatapult: sanitizeCount(ammunition.ltCatapult, fallback.ammunition.ltCatapult),
      hvCatapult: sanitizeCount(ammunition.hvCatapult, fallback.ammunition.hvCatapult),
      ballista: sanitizeCount(ammunition.ballista, fallback.ammunition.ballista),
    },
    siegeEngines: {
      ltCatapult: sanitizeCount(engines.ltCatapult, fallback.siegeEngines.ltCatapult),
      hvCatapult: sanitizeCount(engines.hvCatapult, fallback.siegeEngines.hvCatapult),
      ram: sanitizeCount(engines.ram, fallback.siegeEngines.ram),
      tower: sanitizeCount(engines.tower, fallback.siegeEngines.tower),
      ballista: sanitizeCount(engines.ballista, fallback.siegeEngines.ballista),
      timberFort: sanitizeCount(engines.timberFort, fallback.siegeEngines.timberFort),
      mantlet: sanitizeCount(engines.mantlet, fallback.siegeEngines.mantlet),
      ladder: sanitizeCount(engines.ladder, fallback.siegeEngines.ladder),
      hoist: sanitizeCount(engines.hoist, fallback.siegeEngines.hoist),
      belfry: sanitizeCount(engines.belfry, fallback.siegeEngines.belfry),
      gallery: sanitizeCount(engines.gallery, fallback.siegeEngines.gallery),
    },
  };
}

function sanitizeCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeTactic(value: unknown, fallback: SiegeTactic): SiegeTactic {
  return value === "bombard" ||
    value === "harass" ||
    value === "assault" ||
    value === "depart"
    ? value
    : fallback;
}

function ensureLedgerState(state?: LedgerState): LedgerState {
  if (!state) {
    return createDefaultLedgerState();
  }
  return {
    balance: typeof state.balance === "number" ? state.balance : 0,
    transactions: Array.isArray(state.transactions) ? state.transactions : [],
    recurringExpenses: Array.isArray(state.recurringExpenses) ? state.recurringExpenses : [],
  };
}

