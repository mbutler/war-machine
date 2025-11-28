import type { Character, PartyState, Retainer, WarMachineState } from "../../state/schema";
import { DEFAULT_STATE, STATE_VERSION } from "../../state/schema";
import { exportState, getState, setState, subscribe, updateState } from "../../state/store";
import { GenerateCharacterOptions, GenerationMethod, generateCharacter } from "./generator";
import { RETAINER_TYPES, generateRetainer } from "./retainers";
import { calculatePartySnapshot } from "./resources";
import { createId } from "../../utils/id";
import { recordIncome, setLedgerBalance, addRecurringExpense, removeRecurringExpense } from "../ledger/state";

export interface PartyGenerationRequest {
  size: number;
  level: number;
  method: GenerationMethod;
}

export type PartyListener = (state: PartyState) => void;

export function getPartyState(): PartyState {
  return getState().party;
}

export function subscribeToParty(listener: PartyListener): () => void {
  return subscribe((state) => listener(state.party));
}

function createGenerationOptions(request: PartyGenerationRequest): GenerateCharacterOptions {
  return {
    level: request.level,
    method: request.method,
  };
}

export function generateParty(request: PartyGenerationRequest) {
  let totalStartingGold = 0;

  updateState((state) => {
    const roster = [];
    for (let i = 0; i < request.size; i += 1) {
      const character = generateCharacter(createGenerationOptions(request));
      roster.push(character);
      // Sum up leftover gold from each character
      totalStartingGold += character.equipment.gold ?? 0;
    }
    state.party.roster = roster;
    state.party.preferences = {
      defaultSize: request.size,
      defaultLevel: request.level,
      method: request.method,
    };
    refreshPartyResources(state.party);

    // Reset ledger completely (including recurring expenses - old retainers are gone)
    state.ledger.balance = 0;
    state.ledger.transactions = [];
    state.ledger.recurringExpenses = [];
  });

  // Record starting gold in the ledger (outside updateState to avoid nested calls)
  if (totalStartingGold > 0) {
    recordIncome(
      totalStartingGold,
      "party",
      "misc",
      `Party starting gold (${request.size} characters)`,
    );
  }
}

export function addRetainerToCharacter(characterId: string, typeId: string) {
  let retainerToAdd: Retainer | null = null;

  updateState((state) => {
    const character = state.party.roster.find((entry) => entry.id === characterId);
    if (!character) return;
    if (character.retainers.length >= character.maxRetainers) {
      return;
    }
    const type = RETAINER_TYPES.find((entry) => entry.id === typeId);
    if (!type) return;
    const retainer = generateRetainer(type);
    character.retainers.push(retainer);
    refreshPartyResources(state.party);
    retainerToAdd = retainer;
  });

  // Add recurring wage expense (outside updateState to avoid nesting)
  if (retainerToAdd) {
    const retainer = retainerToAdd as Retainer;
    addRecurringExpense({
      name: `Wages: ${retainer.name} (${retainer.class})`,
      amount: retainer.wage,
      frequency: "monthly",
      source: "party",
      category: "wage",
      linkedEntityId: retainer.id,
      linkedEntityType: "retainer",
    });
  }
}

export function removeRetainer(characterId: string, retainerId: string) {
  let removedRetainerId: string | null = null;

  updateState((state) => {
    const character = state.party.roster.find((entry) => entry.id === characterId);
    if (!character) return;
    
    // Check if the retainer exists before removing
    const retainerExists = character.retainers.some((r) => r.id === retainerId);
    if (retainerExists) {
      removedRetainerId = retainerId;
    }
    
    character.retainers = character.retainers.filter((retainer) => retainer.id !== retainerId);
    refreshPartyResources(state.party);
  });

  // Remove the recurring wage expense (outside updateState to avoid nesting)
  if (removedRetainerId) {
    // Find and remove the recurring expense linked to this retainer
    const ledgerState = getState().ledger;
    const expense = ledgerState.recurringExpenses.find(
      (e) => e.linkedEntityId === removedRetainerId && e.linkedEntityType === "retainer"
    );
    if (expense) {
      removeRecurringExpense(expense.id);
    }
  }
}

export function replaceCharacter(characterId: string, options: GenerateCharacterOptions) {
  let retainerIdsToRemove: string[] = [];

  updateState((state) => {
    const idx = state.party.roster.findIndex((entry) => entry.id === characterId);
    if (idx === -1) return;
    
    // Get retainer IDs from the character being replaced
    const oldCharacter = state.party.roster[idx];
    if (oldCharacter.retainers.length > 0) {
      retainerIdsToRemove = oldCharacter.retainers.map((r) => r.id);
    }
    
    const replacement = generateCharacter(options);
    state.party.roster[idx] = replacement;
    refreshPartyResources(state.party);
  });

  // Remove recurring wage expenses for old retainers (outside updateState)
  if (retainerIdsToRemove.length > 0) {
    const ledgerState = getState().ledger;
    for (const retainerId of retainerIdsToRemove) {
      const expense = ledgerState.recurringExpenses.find(
        (e) => e.linkedEntityId === retainerId && e.linkedEntityType === "retainer"
      );
      if (expense) {
        removeRecurringExpense(expense.id);
      }
    }
  }
}

export interface PartyExportPayload {
  version: string;
  party: Character[];
  partyResources: PartyState["partyResources"];
  encumbrance: ReturnType<typeof calculatePartySnapshot>["encumbrance"];
  campaignInfo: {
    dungeonLevel: number;
    experienceBonus: number;
    magicItemBonus: boolean;
  };
}

export function exportPartyData(): PartyExportPayload {
  const state = getState();
  const snapshot = calculatePartySnapshot(state.party.roster);
  return {
    version: STATE_VERSION,
    party: state.party.roster,
    partyResources: snapshot.summary,
    encumbrance: snapshot.encumbrance,
    campaignInfo: {
      dungeonLevel: 1,
      experienceBonus: 0,
      magicItemBonus: false,
    },
  };
}

export function importPartyFromJson(raw: string) {
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  if (payload?.state) {
    const nextState = payload.state as WarMachineState;
    if (!nextState.party) {
      throw new Error("Imported suite file missing party data.");
    }
    setState(nextState);
    return { format: "suite" as const };
  }

  if (!Array.isArray(payload?.party)) {
    throw new Error("Party file missing party data.");
  }

  updateState((state) => {
    state.party.roster = payload.party.map(normalizeCharacter);
    state.party.partyResources = payload.partyResources ?? DEFAULT_STATE.party.partyResources;
    refreshPartyResources(state.party);
  });

  return { format: "party" as const };
}

function normalizeCharacter(raw: any): Character {
  const base: Character = {
    id: raw.id ?? createId(),
    name: raw.name ?? "Unknown",
    race: raw.race ?? "Human",
    classKey: raw.classKey ?? (raw.className ?? raw.class ?? "Fighter").toLowerCase().replace(/\s+/g, ""),
    className: raw.className ?? raw.class ?? "Fighter",
    level: raw.level ?? 1,
    alignment: raw.alignment ?? "Neutral",
    abilityScores: raw.abilityScores ?? DEFAULT_STATE.party.roster[0]?.abilityScores ?? {
      str: 10,
      int: 10,
      wis: 10,
      dex: 10,
      con: 10,
      cha: 10,
    },
    derivedStats: raw.derivedStats ?? {
      hp: { current: 1, max: 1 },
      ac: 9,
      thac0: 19,
      savingThrows: {
        deathPoison: 12,
        wands: 13,
        paraStone: 14,
        breath: 15,
        spells: 16,
      },
    },
    spells: raw.spells ?? { slots: {}, known: [] },
    thiefSkills: raw.thiefSkills ?? null,
    equipment: raw.equipment ?? {
      weapon: "Dagger",
      armor: "None",
      shield: null,
      pack: [],
      gold: 0,
    },
    retainers: raw.retainers ?? [],
    maxRetainers: raw.maxRetainers ?? 0,
    retainerMorale: raw.retainerMorale ?? 7,
    status: raw.status ?? "alive",
    notes: raw.notes,
  };
  return base;
}

function refreshPartyResources(party: PartyState) {
  const snapshot = calculatePartySnapshot(party.roster);
  party.partyResources = snapshot.summary;
}

export function markSpellExpended(characterId: string, spellName: string, expended: boolean) {
  updateState((state) => {
    const character = state.party.roster.find((entry) => entry.id === characterId);
    if (!character) return;
    const spell = character.spells.known.find((entry) => entry.name === spellName);
    if (!spell) return;
    spell.expended = expended;
  });
}

