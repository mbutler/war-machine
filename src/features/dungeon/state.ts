import type { DungeonEncounter, DungeonLogEntry, DungeonObstacle } from "../../state/schema";
import type { DungeonEncounter, DungeonLogEntry, DungeonObstacle } from "../../state/schema";
import { DEFAULT_STATE, DungeonStatus, DungeonState } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { calculatePartySnapshot } from "../party/resources";
import { rollDie, rollFormula } from "../../rules/dice";
import { pickEncounter } from "../../rules/dungeon/encounters";
import { randomObstacle } from "../../rules/dungeon/obstacles";
import { MAGIC_ITEMS, TREASURE_TYPES } from "../../rules/dungeon/treasure";
import { createId } from "../../utils/id";
import { markSpellExpended } from "../party/state";
import { advanceCalendar } from "../calendar/state";

type DungeonListener = (state: ReturnType<typeof getDungeonState>) => void;

export function getDungeonState() {
  return normalizeDungeonState(getState().dungeon);
}

export function subscribeToDungeon(listener: DungeonListener): () => void {
  return subscribe((state) => listener(state.dungeon));
}

export function syncDungeonWithParty() {
  updateState((state) => {
    const summary = calculatePartySnapshot(state.party.roster);
    state.dungeon.torches = summary.summary.torches;
    state.dungeon.rations = summary.summary.rations;
    state.dungeon.bankedGold = summary.summary.bankedGold;
  });
}

export function setDungeonDepth(depth: number) {
  updateState((state) => {
    state.dungeon.depth = depth;
  });
}

export function toggleLairMode(enabled: boolean) {
  updateState((state) => {
    state.dungeon.lairMode = enabled;
  });
}

export function exploreRoom() {
  let turnsSpent = 0;
  updateState((state) => {
    const dungeon = state.dungeon;
    turnsSpent = advanceTurn(dungeon);

    const encounterRoll = rollDie(20);
    const definition = pickEncounter(dungeon.depth, encounterRoll);

    if (definition) {
      const built = buildEncounter(definition, dungeon.depth);
      dungeon.status = "encounter";
      dungeon.encounter = built;
      dungeon.obstacle = undefined;
      addLogEntry(dungeon, "combat", `Encounter: ${built.name}`, `${built.quantity} foes (HD ${built.hitDice})`);
    } else {
      const obstacle = randomObstacle();
      dungeon.status = "obstacle";
      dungeon.obstacle = { ...obstacle };
      dungeon.encounter = undefined;
      addLogEntry(dungeon, "event", `Obstacle: ${obstacle.name}`, obstacle.description);
    }
  });
  syncCalendarTurns(turnsSpent);
}

export function resolveObstacle(strategy: "force" | "careful") {
  updateState((state) => {
    const dungeon = state.dungeon;
    if (!dungeon.obstacle) return;
    addLogEntry(
      dungeon,
      "event",
      `Obstacle cleared`,
      `${dungeon.obstacle.name} handled via ${strategy === "force" ? "brute force" : "cautious effort"}.`,
    );
    dungeon.obstacle = undefined;
    dungeon.status = "idle";
  });
}

export function resolveEncounter(outcome: "fight" | "parley" | "flee") {
  updateState((state) => {
    const dungeon = state.dungeon;
    const encounter = dungeon.encounter;
    if (!encounter) return;
    let summary = "";
    if (outcome === "fight") {
      summary = `Defeated ${encounter.name}`;
      dungeon.loot += Math.round(encounter.hitDice * 10);
      dungeon.status = "loot";
      addLogEntry(dungeon, "combat", summary);
      return;
    } else if (outcome === "parley") {
      summary = `Parleyed with ${encounter.name}`;
      dungeon.status = "idle";
      dungeon.encounter = undefined;
    } else {
      summary = `Fled from ${encounter.name}`;
      dungeon.status = "idle";
      dungeon.encounter = undefined;
    }
    addLogEntry(dungeon, "combat", summary);
  });
}

export function searchRoom() {
  let turnsSpent = 0;
  updateState((state) => {
    const dungeon = state.dungeon;
    turnsSpent = advanceTurn(dungeon);
    const found = Math.random() < 0.3;
    if (found) {
      const loot = Math.max(1, rollFormula("1d6"));
      dungeon.loot += loot;
      addLogEntry(dungeon, "loot", "Found hidden stash", `${loot} gp worth of goods.`);
    } else {
      addLogEntry(dungeon, "event", "Search yields nothing");
    }
  });
  syncCalendarTurns(turnsSpent);
}

export function restParty() {
  let turnsSpent = 0;
  updateState((state) => {
    const dungeon = state.dungeon;
    turnsSpent = advanceTurn(dungeon);
    if (dungeon.rations > 0) {
      dungeon.rations -= 1;
      addLogEntry(dungeon, "event", "Party rests and eats.");
    } else {
      addLogEntry(dungeon, "event", "Rested without rations", "Fatigue may become an issue.");
    }
  });
  syncCalendarTurns(turnsSpent);
}

export function lootRoom() {
  updateState((state) => {
    const dungeon = state.dungeon;
    const type = dungeon.encounter?.treasureType ?? "A";
    const loot = generateTreasure(type);
    dungeon.loot += loot.totalGold;
    addLogEntry(dungeon, "loot", "Loot recovered", loot.summary);
    dungeon.status = "idle";
    dungeon.encounter = undefined;
  });
}

export function bankLoot() {
  updateState((state) => {
    const dungeon = state.dungeon;
    dungeon.bankedGold += dungeon.loot;
    addLogEntry(dungeon, "loot", "Returned to safety", `Banked ${dungeon.loot} gp.`);
    dungeon.loot = 0;
    dungeon.status = "idle";
  });
}

export function clearLog() {
  updateState((state) => {
    state.dungeon.log = [];
  });
}

export function consumeTorch(amount = 1) {
  updateState((state) => {
    state.dungeon.torches = Math.max(0, state.dungeon.torches - amount);
    addLogEntry(state.dungeon, "event", `Torches used (${amount})`);
  });
}

export function consumeRation(amount = 1) {
  updateState((state) => {
    state.dungeon.rations = Math.max(0, state.dungeon.rations - amount);
    addLogEntry(state.dungeon, "event", `Rations consumed (${amount})`);
  });
}

export function applyEncounterDamage(amount: number) {
  updateState((state) => {
    const encounter = state.dungeon.encounter;
    if (!encounter) return;
    encounter.hp = Math.max(0, encounter.hp - amount);
    if (encounter.hp === 0) {
      state.dungeon.status = "loot";
      addLogEntry(state.dungeon, "combat", `Defeated ${encounter.name}`);
    }
  });
}

export function setEncounterReaction(reaction: DungeonEncounter["reaction"]) {
  updateState((state) => {
    if (!state.dungeon.encounter) return;
    state.dungeon.encounter.reaction = reaction;
    addLogEntry(state.dungeon, "event", `Reaction shifts to ${reaction}`);
  });
}

export function castSpellDuringDelve(characterId: string, spellName: string) {
  markSpellExpended(characterId, spellName, true);
  updateState((state) => {
    addLogEntry(state.dungeon, "event", `Spell Cast`, `${spellName} expended by party.`);
  });
}

function advanceTurn(dungeon: typeof DEFAULT_STATE.dungeon, turns = 1): number {
  if (turns <= 0) return 0;
  dungeon.turn += turns;
  if (dungeon.torches > 0) {
    dungeon.torches = Math.max(0, dungeon.torches - turns);
  }
  return turns;
}

function syncCalendarTurns(turns: number) {
  if (turns > 0) {
    advanceCalendar("turn", turns);
  }
}

function addLogEntry(dungeon: typeof DEFAULT_STATE.dungeon, kind: DungeonLogEntry["kind"], summary: string, detail?: string) {
  dungeon.log.unshift({
    id: createId(),
    timestamp: Date.now(),
    kind,
    summary,
    detail,
  });
  dungeon.log = dungeon.log.slice(0, 200);
}

function buildEncounter(definition: ReturnType<typeof pickEncounter> extends infer T ? T : never, depth: number): DungeonEncounter {
  const qty = resolveQuantity(definition?.qty ?? "1");
  const hpMax = Math.max(1, Math.round((definition?.hd ?? 1) * 8 * qty));
  return {
    id: createId(),
    name: definition?.name ?? "Unknown",
    quantity: definition?.qty ?? "1",
    hitDice: definition?.hd ?? 1,
    armorClass: definition?.ac ?? 9,
    damage: definition?.dmg ?? "1d6",
    morale: definition?.morale ?? 7,
    treasureType: definition?.treasure ?? "A",
    hp: hpMax,
    hpMax,
    reaction: depth > 2 && Math.random() < 0.3 ? "hostile" : "neutral",
  };
}

function resolveQuantity(input: string): number {
  if (/^\d+d\d+$/i.test(input.trim())) {
    return rollFormula(input);
  }
  const parsed = parseInt(input, 10);
  return Number.isNaN(parsed) ? 1 : parsed;
}

function generateTreasure(type: string): { summary: string; totalGold: number } {
  const table = TREASURE_TYPES[type] || TREASURE_TYPES.A;
  let summary: string[] = [];
  let total = 0;

  const coin = (roll?: { pct: number; roll: string; mult?: number }, kind?: string) => {
    if (!roll) return;
    if (Math.random() * 100 > roll.pct) return;
    const amount = rollFormula(roll.roll) * (roll.mult ?? 1);
    summary.push(`${amount} ${kind}`);
    total += convertToGold(kind ?? "gp", amount);
  };

  coin(table.cp, "cp");
  coin(table.sp, "sp");
  coin(table.ep, "ep");
  coin(table.gp, "gp");
  coin(table.pp, "pp");

  if (table.gems && Math.random() * 100 < table.gems.pct) {
    const count = rollFormula(table.gems.roll);
    summary.push(`${count}x gems`);
    total += count * 50;
  }

  if (table.jewelry && Math.random() * 100 < table.jewelry.pct) {
    const count = rollFormula(table.jewelry.roll);
    summary.push(`${count}x jewelry`);
    total += count * 100;
  }

  if (table.magic && Math.random() * 100 < table.magic.pct) {
    const magicList = MAGIC_ITEMS[table.magic.type] ?? MAGIC_ITEMS.any;
    const picks = [];
    for (let i = 0; i < table.magic.count; i += 1) {
      picks.push(magicList[Math.floor(Math.random() * magicList.length)]);
    }
    if (table.magic.extra) {
      picks.push(...table.magic.extra);
    }
    summary.push(`Magic: ${picks.join(", ")}`);
  }

  if (summary.length === 0) {
    summary.push("No treasure found");
  }

  return { summary: summary.join("; "), totalGold: total };
}

function convertToGold(kind: string, amount: number): number {
  switch (kind) {
    case "cp":
      return amount / 100;
    case "sp":
      return amount / 10;
    case "ep":
      return amount / 2;
    case "pp":
      return amount * 5;
    default:
      return amount;
  }
}

function normalizeDungeonState(raw: DungeonState | undefined): DungeonState {
  return {
    turn: raw?.turn ?? 0,
    depth: raw?.depth ?? 1,
    torches: raw?.torches ?? 0,
    rations: raw?.rations ?? 0,
    loot: raw?.loot ?? 0,
    bankedGold: raw?.bankedGold ?? 0,
    lairMode: raw?.lairMode ?? false,
    status: raw?.status ?? "idle",
    encounter: raw?.encounter,
    obstacle: raw?.obstacle,
    log: raw?.log ?? [],
  };
}

