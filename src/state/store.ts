import { DEFAULT_STATE, STATE_VERSION, WarMachineState } from "./schema";

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
}

initialize();

function commit(next: WarMachineState) {
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

