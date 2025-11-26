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
import { describeClock, advanceClock, addCalendarLog } from "../calendar/state";

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
  updateState((state) => {
    const dungeon = state.dungeon;
    const turnsSpent = advanceTurn(dungeon);

    // BECMI dungeon exploration: Most rooms are empty or have features
    const roomResult = determineRoomContents();

    if (roomResult.type === "encounter") {
      // Rare: room contains monsters (placed encounter)
      const encounterRoll = rollDie(20);
      const definition = pickEncounter(dungeon.depth, encounterRoll);
      if (definition) {
        const built = buildEncounter(definition, dungeon.depth);
        dungeon.status = "encounter";
        dungeon.encounter = built;
        dungeon.obstacle = undefined;
        addLogEntry(dungeon, "combat", `Room contains: ${built.name}`, `${built.quantity} foes (HD ${built.hitDice})`);
      } else {
        // Fallback to empty room
        dungeon.status = "idle";
        addLogEntry(dungeon, "event", "Empty room", "The room appears to be empty.");
      }
    } else if (roomResult.type === "obstacle") {
      // Room has a feature or trap
      const obstacle = randomObstacle();
      dungeon.status = "obstacle";
      dungeon.obstacle = { ...obstacle };
      dungeon.encounter = undefined;
      addLogEntry(dungeon, "event", `Room feature: ${obstacle.name}`, obstacle.description);
    } else {
      // Empty room
      dungeon.status = "idle";
      addLogEntry(dungeon, "event", "Empty room", roomResult.description);
    }

    // Advance calendar time
    if (turnsSpent > 0) {
      const calendar = state.calendar;
      const before = describeClock(calendar.clock);
      advanceClock(calendar.clock, "turn", turnsSpent);
      const after = describeClock(calendar.clock);
      addCalendarLog(calendar, `Dungeon exploration: +${turnsSpent} turn${turnsSpent === 1 ? "" : "s"}`, `${before} → ${after}`);
    }
  });
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

    if (outcome === "fight") {
      performCombatRound(dungeon, state.party.roster, false);
    } else if (outcome === "parley") {
      if (encounter.reaction === "hostile") {
        addLogEntry(dungeon, "combat", "Parley failed - they attack!", "The monsters ignore your words and charge!");
        performCombatRound(dungeon, state.party.roster, false);
      } else {
        addLogEntry(dungeon, "combat", "Parley successful", `You convince the ${encounter.name} to leave peacefully.`);
        dungeon.status = "idle";
        dungeon.encounter = undefined;
      }
    } else if (outcome === "flee") {
      addLogEntry(dungeon, "combat", "Attempting to flee", "You turn and run from combat!");
      performCombatRound(dungeon, state.party.roster, true);
      // If still in combat after the round, fleeing failed
      if (dungeon.encounter && dungeon.status === "encounter") {
        addLogEntry(dungeon, "combat", "Flee failed", "The monsters catch up to you!");
      }
    }
  });
}

function performCombatRound(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], fleeing: boolean = false) {
  if (!dungeon.encounter) return;

  const encounter = dungeon.encounter;

  // If monsters are already defeated, immediately declare victory
  if (encounter.hp <= 0) {
    addLogEntry(dungeon, "combat", "Victory!", `The ${encounter.name} were already defeated!`);
    dungeon.status = "loot";
    return;
  }

  // Filter to only living characters
  const livingParty = party.filter(char => char.derivedStats.hp.current > 0);

  // Initiative
  const partyInit = rollDie(6);
  const monsterInit = rollDie(6);
  const partyGoesFirst = partyInit >= monsterInit;

  addLogEntry(dungeon, "combat", `Initiative: Party ${partyInit}, Monsters ${monsterInit}`, partyGoesFirst ? "Party acts first!" : "Monsters act first!");

  // Combat resolution
  if (partyGoesFirst && !fleeing) {
    resolvePartyAttacks(dungeon, livingParty, fleeing);
  }
  if (encounter.hp > 0) {
    resolveMonsterAttacks(dungeon, livingParty, fleeing);
  }
  if (!partyGoesFirst && !fleeing && encounter.hp > 0) {
    resolvePartyAttacks(dungeon, livingParty, fleeing);
  }

  // If fleeing, party gets away if they survive the attacks
  if (fleeing) {
    const stillLiving = livingParty.filter(char => char.derivedStats.hp.current > 0);
    if (stillLiving.length > 0) {
      addLogEntry(dungeon, "combat", "Escape successful!", "You got away from the monsters!");
      dungeon.status = "idle";
      dungeon.encounter = undefined;
      return;
    }
  }


  // Check if monsters are defeated
  if (encounter.hp <= 0) {
    console.log("Monsters defeated!");
    addLogEntry(dungeon, "combat", "Victory!", `The ${encounter.name} have been defeated!`);
    dungeon.status = "loot";
    return;
  }

  // Check if party is wiped out
  const stillLiving = livingParty.filter(char => char.derivedStats.hp.current > 0);
  if (stillLiving.length === 0) {
    console.log("Party wiped out!");
    addLogEntry(dungeon, "combat", "Party Wiped Out!", "All party members have fallen!");
    dungeon.status = "idle";
    dungeon.encounter = undefined;
    return;
  }

  // Combat continues to next round
}

function resolvePartyAttacks(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], fleeing: boolean) {
  if (fleeing || !dungeon.encounter) return;

  const encounter = dungeon.encounter;
  let totalDamage = 0;

  party.forEach(char => {
    if (char.derivedStats.hp.current <= 0) return;

    // Calculate attack roll using THAC0
    const attackRoll = rollDie(20);
    const targetAC = encounter.armorClass;
    const requiredRoll = char.derivedStats.thac0 - targetAC;

    if (attackRoll >= requiredRoll) {
      // Use weapon damage (simplified to 1d6 for now)
      const damage = rollDie(6);
      totalDamage += damage;
      addLogEntry(dungeon, "combat", `${char.name} hits!`, `Deals ${damage} damage to ${encounter.name}`);
    } else {
      addLogEntry(dungeon, "combat", `${char.name} misses`, `Attack roll: ${attackRoll} (needed ${requiredRoll}+)`);
    }
  });

  if (totalDamage > 0) {
    encounter.hp = Math.max(0, encounter.hp - totalDamage);
    addLogEntry(dungeon, "combat", `Party deals ${totalDamage} total damage`, `${encounter.name} has ${encounter.hp} HP remaining`);

    // Check morale conditions
    const hpPerMonster = Math.max(1, Math.round(encounter.hitDice * 8)); // Rough estimate

    // 1. First Death? (Damage > 1 monster HP)
    if (!encounter.checkedFirstDeath && totalDamage >= hpPerMonster) {
      encounter.checkedFirstDeath = true;
      checkMonsterMorale(dungeon);
      if (dungeon.status !== "encounter") return; // Morale failed
    }

    // 2. Half Strength?
    if (!encounter.checkedHalf && encounter.hp <= (encounter.hpMax / 2)) {
      encounter.checkedHalf = true;
      checkMonsterMorale(dungeon);
      if (dungeon.status !== "encounter") return; // Morale failed
    }
  }
}

function resolveMonsterAttacks(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], fleeing: boolean) {
  if (!dungeon.encounter) return;

  const encounter = dungeon.encounter;
  const hitBonus = fleeing ? 2 : 0; // Bonus to hit fleeing targets

  // Calculate active monster count (based on remaining HP)
  const hpPerMonster = Math.max(1, Math.round(encounter.hitDice * 8)); // Rough estimate
  const activeCount = Math.max(1, Math.ceil(encounter.hp / hpPerMonster));

  addLogEntry(dungeon, "combat", `Monster attacks`, `${activeCount} ${encounter.name} attack!`);

  // Each active monster attacks
  for (let i = 0; i < activeCount; i++) {
    // Select random target
    const livingTargets = party.filter(char => char.derivedStats.hp.current > 0);
    if (livingTargets.length === 0) break;

    const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
    const attackRoll = rollDie(20) + hitBonus;

    // Monster THAC0 calculation (simplified)
    const monsterTHAC0 = 19 - (encounter.hitDice * 2); // Rough approximation
    const requiredRoll = monsterTHAC0 - target.derivedStats.ac;

    if (attackRoll >= requiredRoll) {
      const damage = rollFormula(encounter.damage);
      const newHp = Math.max(0, target.derivedStats.hp.current - damage);
      target.derivedStats.hp.current = newHp;

      if (newHp <= 0) {
        addLogEntry(dungeon, "combat", `${target.name} falls!`, `Hit by ${encounter.name} for ${damage} damage`);
        target.status = "dead";
      } else {
        addLogEntry(dungeon, "combat", `${target.name} hit!`, `Takes ${damage} damage from ${encounter.name}`);
      }
    } else {
      addLogEntry(dungeon, "combat", `${encounter.name} misses ${target.name}`, `Attack roll: ${attackRoll} (needed ${requiredRoll}+)`);
    }
  }
}

function checkMonsterMorale(dungeon: typeof DEFAULT_STATE.dungeon) {
  if (!dungeon.encounter) return;

  const encounter = dungeon.encounter;
  const moraleRoll = rollDie(6) + rollDie(6);

  // Check morale conditions
  const hpPercent = (encounter.hp / encounter.hpMax) * 100;
  let moraleModifier = 0;

  if (hpPercent <= 50) moraleModifier += 2; // Half strength or less
  // Could add more morale modifiers here

  if (moraleRoll + moraleModifier > encounter.morale) {
    addLogEntry(dungeon, "combat", "Morale check failed!", `${encounter.name} flee in panic! (Rolled ${moraleRoll}+${moraleModifier} vs ${encounter.morale})`);
    dungeon.status = "idle";
    dungeon.encounter = undefined;
  }
}

export function searchRoom() {
  let turnsSpent = 0;
  updateState((state) => {
    const dungeon = state.dungeon;
    turnsSpent = advanceTurn(dungeon);

    // Search results: vary based on thoroughness and luck
    const searchRoll = rollDie(100);

    if (searchRoll <= 20) {
      // Found treasure!
      const loot = Math.max(1, rollFormula("2d6"));
      dungeon.loot += loot;
      addLogEntry(dungeon, "loot", "Treasure discovered!", `Found ${loot} gp in a hidden compartment.`);
    } else if (searchRoll <= 40) {
      // Found something interesting but not valuable
      const discoveries = [
        "Discovered faded runes on the wall describing an ancient curse.",
        "Found a skeleton clutching a rusted dagger.",
        "Unearthed a cracked crystal that pulses with faint magic.",
        "Discovered a hidden inscription: 'The third torch from the left holds the key.'",
        "Found strange symbols carved into the stone floor.",
        "Located an old leather-bound book, pages crumbling to dust."
      ];
      addLogEntry(dungeon, "event", "Discovery made", discoveries[Math.floor(Math.random() * discoveries.length)]);
    } else if (searchRoll <= 60) {
      // Found minor useful item
      const items = [
        "Found 1d4 days worth of iron rations in a concealed cache.",
        "Discovered a flask of oil for torches.",
        "Located a coil of 50' of rope in good condition.",
        "Found a tinderbox with flint and steel.",
        "Unearthed a small sack containing 2d10 copper pieces.",
        "Located a wineskin filled with fresh water."
      ];
      const itemResult = items[Math.floor(Math.random() * items.length)];
      // Could add these to inventory, but for now just describe
      addLogEntry(dungeon, "event", "Useful item found", itemResult);
    } else {
      // Nothing found
      const noFindMessages = [
        "After thorough searching, nothing of value is found.",
        "The room has been picked clean by previous explorers.",
        "Your search reveals only dust and debris.",
        "No hidden compartments or secret doors are discovered.",
        "The room yields no secrets to your careful examination."
      ];
      addLogEntry(dungeon, "event", "Search complete", noFindMessages[Math.floor(Math.random() * noFindMessages.length)]);
    }

    // Advance calendar time
    if (turnsSpent > 0) {
      const calendar = state.calendar;
      const before = describeClock(calendar.clock);
      advanceClock(calendar.clock, "turn", turnsSpent);
      const after = describeClock(calendar.clock);
      addCalendarLog(calendar, `Dungeon search: +${turnsSpent} turn${turnsSpent === 1 ? "" : "s"}`, `${before} → ${after}`);
    }
  });
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

    // Advance calendar time
    if (turnsSpent > 0) {
      const calendar = state.calendar;
      const before = describeClock(calendar.clock);
      advanceClock(calendar.clock, "turn", turnsSpent);
      const after = describeClock(calendar.clock);
      addCalendarLog(calendar, `Dungeon rest: +${turnsSpent} turn${turnsSpent === 1 ? "" : "s"}`, `${before} → ${after}`);
    }
  });
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
    // Force consumption of torches (e.g., for light spells, etc.)
    state.dungeon.torches = Math.max(0, state.dungeon.torches - amount);
    addLogEntry(state.dungeon, "event", `Torches consumed (${amount})`);
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

  // Handle torch consumption - each torch burns for 6 turns (1 hour)
  const TORCH_DURATION_TURNS = 6;
  for (let i = 0; i < turns; i++) {
    if (dungeon.torches > 0) {
      dungeon.torchTurnsUsed++;
      if (dungeon.torchTurnsUsed >= TORCH_DURATION_TURNS) {
        dungeon.torches--;
        dungeon.torchTurnsUsed = 0;
        addLogEntry(dungeon, "event", `Torch burned out (${dungeon.torches} remaining)`);
      }
    }
  }

  // Check for wandering monsters every 2 turns (BECMI rule)
  if (dungeon.turn % 2 === 0) {
    checkWanderingMonsters(dungeon);
  }

  return turns;
}

function determineRoomContents(): { type: "empty" | "obstacle" | "encounter"; description?: string } {
  // BECMI room exploration probabilities:
  // - 70% empty room
  // - 20% feature/trap (obstacle)
  // - 10% contains monsters (placed encounter)
  const roll = rollDie(100);

  if (roll <= 70) {
    // Empty room - add some variety in descriptions
    const emptyDescriptions = [
      "The room appears to be empty.",
      "Nothing of interest catches your eye.",
      "The chamber is bare except for dust and cobwebs.",
      "This room has been stripped clean long ago.",
      "An empty chamber with signs of previous habitation.",
      "The room contains only debris and rubble."
    ];
    return {
      type: "empty",
      description: emptyDescriptions[Math.floor(Math.random() * emptyDescriptions.length)]
    };
  } else if (roll <= 90) {
    // Room has a feature or trap
    return { type: "obstacle" };
  } else {
    // Rare: room contains monsters (placed encounter)
    return { type: "encounter" };
  }
}

function checkWanderingMonsters(dungeon: typeof DEFAULT_STATE.dungeon) {
  // BECMI wandering monster check: 1d6, encounter on roll of 1
  const roll = rollDie(6);
  if (roll === 1) {
    // Wandering monster encountered during travel
    const encounterRoll = rollDie(20);
    const definition = pickEncounter(dungeon.depth, encounterRoll);

    if (definition) {
      const built = buildEncounter(definition, dungeon.depth);
      dungeon.status = "encounter";
      dungeon.encounter = built;
      dungeon.obstacle = undefined;
      addLogEntry(dungeon, "combat", `Wandering monsters: ${built.name}`, `${built.quantity} foes (HD ${built.hitDice}) spotted during travel!`);
    }
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
    torchTurnsUsed: raw?.torchTurnsUsed ?? 0,
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

