import type {
  DungeonAreaType,
  DungeonEncounter,
  DungeonLogEntry,
  DungeonObstacle,
  DungeonRoomContents,
  LightingCondition,
  EncounterReaction,
  ObstacleType,
} from "../../state/schema";
import { DEFAULT_STATE, DungeonState } from "../../state/schema";
import { getState, subscribe, updateState } from "../../state/store";
import { calculatePartySnapshot } from "../party/resources";
import { rollDie, rollFormula } from "../../rules/dice";
import { pickEncounter, rollSurprise, resolveReaction, rollEncounterDistance, rollWanderingMonsterDistance } from "../../rules/dungeon/encounters";
import { randomObstacle, randomTrap, rollOpenDoors, triggerTrap, type ObstacleDefinition } from "../../rules/dungeon/obstacles";
import { MAGIC_ITEMS, TREASURE_TYPES } from "../../rules/dungeon/treasure";
import { ALL_EQUIPMENT } from "../../rules/tables/equipment";
import { createId } from "../../utils/id";
import { markSpellExpended } from "../party/state";
import { describeClock, advanceClock, addCalendarLog } from "../calendar/state";
import { recordLoot } from "../ledger/state";
import { addXpToCharacter } from "../party/generator";

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
  });
}

export function resetDungeonState() {
  updateState((state) => {
    // Reset all dungeon state to defaults, keeping party resources synced
    const summary = calculatePartySnapshot(state.party.roster);

    state.dungeon = {
      turn: 0,
      depth: 1,
      torches: summary.summary.torches,
      torchTurnsUsed: 0,
      rations: summary.summary.rations,
      loot: 0,
      lairMode: false,
      lighting: "dim",
      status: "idle",
      // Start in a generic room on Level 1
      areaType: "room",
      intersectionKind: null,
      roomContents: "empty",
      roomHasTreasure: false,
      roomTreasureClaimed: false,
      roomSearched: false,
      log: [],
    };

    addLogEntry(state.dungeon, "event", "Dungeon Reset", "Party has entered a new dungeon complex.");
  });
}

export function setDungeonDepth(depth: number) {
  updateState((state) => {
    state.dungeon.depth = depth;
  });
}

export function setLighting(lighting: LightingCondition) {
  updateState((state) => {
    state.dungeon.lighting = lighting;
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
    const turnsSpent = advanceTurn(dungeon, 1, state.party.roster);

    // If a wandering monster encounter or surprise occurred during the turn advance,
    // do not proceed with further exploration or room stocking for this action.
    if (dungeon.status === "encounter" || dungeon.status === "surprise") {
      return;
    }

    // Pick a lightweight area type (room/corridor/intersection) for flavor only
    const { areaType, intersectionKind } = determineAreaType();
    dungeon.areaType = areaType;
    dungeon.intersectionKind = intersectionKind ?? null;

    // BECMI RC Random Stocking: determine high-level room contents + treasure flag
    const stocking = rollRoomStocking();
    dungeon.roomContents = stocking.contents;
    dungeon.roomHasTreasure = stocking.hasTreasure && stocking.contents !== "monster";
    dungeon.roomTreasureClaimed = false;
    dungeon.roomSearched = false; // New area, search not yet performed

    // Resolve contents based on RC categories
    if (stocking.contents === "monster") {
      // Room contains monsters (placed encounter); treasure handled via lair tables
      startEncounter(dungeon, false, state.party.roster);
    } else if (stocking.contents === "trap") {
      // Trap room – pick an appropriate trap obstacle
      const obstacleDef = randomTrap();
      dungeon.status = "obstacle";
      dungeon.obstacle = buildObstacle(obstacleDef);
      dungeon.encounter = undefined;

      const typeLabel = "⚠️ Trap";
      addLogEntry(dungeon, "event", `${typeLabel}: ${obstacleDef.name}`, obstacleDef.description);
    } else if (stocking.contents === "special") {
      // Special room – use a non-damaging feature/hazard to represent RC "Special"
      const obstacleDef = randomObstacle("feature");
      dungeon.status = "obstacle";
      dungeon.obstacle = buildObstacle(obstacleDef);
      dungeon.encounter = undefined;

      addLogEntry(dungeon, "event", `✨ Special: ${obstacleDef.name}`, obstacleDef.description);
    } else {
      // Empty room (may still hide unguarded treasure per RC, discovered via Search)
      dungeon.status = "idle";
      dungeon.encounter = undefined;
      dungeon.obstacle = undefined;

      const description = describeEmptyArea(dungeon.areaType, dungeon.intersectionKind);
      addLogEntry(dungeon, "event", "Empty area", description);
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

function buildObstacle(def: ObstacleDefinition): DungeonObstacle {
  return {
    id: def.id,
    name: def.name,
    description: def.description,
    type: def.type,
    turnCost: def.resolution.turnCost,
    alertsMonsters: def.resolution.alertsMonsters,
    damage: def.resolution.damage,
    saveType: def.resolution.saveType,
    resolved: false,
    attemptsMade: 0,
  };
}

// Start an encounter with proper BECMI mechanics
function startEncounter(dungeon: typeof DEFAULT_STATE.dungeon, isWandering: boolean, party?: any[]) {
  const encounterRoll = rollDie(20);
  const definition = pickEncounter(dungeon.depth, encounterRoll);
  
  if (!definition) {
    // Fallback to empty room
    dungeon.status = "idle";
    addLogEntry(dungeon, "event", "Empty room", "The room appears to be empty.");
    return;
  }

  // Build encounter
  const built = buildEncounter(definition, dungeon);
  
  // Roll surprise (BECMI p.92)
  const surprise = rollSurprise();
  built.surprise = surprise;
  
  // Determine encounter distance based on lighting and surprise
  if (surprise.partySurprised || surprise.monsterSurprised) {
    // When surprise occurs, use special distance rules
    const baseDistance = rollDie(4) * 10; // 1d4 × 10'
    if (surprise.partySurprised && !surprise.monsterSurprised) {
      // Monsters notice party at full distance, party notices at half
      built.distance = Math.floor(baseDistance / 2);
    } else {
      built.distance = baseDistance;
    }
  } else {
    // Normal encounter distance based on lighting
    built.distance = isWandering 
      ? rollWanderingMonsterDistance() 
      : rollEncounterDistance(dungeon.lighting);
  }
  
  // Roll reaction (BECMI p.93)
  const { finalResult, rolls } = resolveReaction(0); // Could add party Charisma here
  built.reaction = finalResult;
  built.reactionRolls = rolls;
  
  dungeon.encounter = built;
  
  // Log the encounter
  const encounterType = isWandering ? "Wandering monsters" : "Room contains";
  addLogEntry(
    dungeon, 
    "combat", 
    `${encounterType}: ${built.name}`, 
    `${built.quantity} foes (HD ${built.hitDice}) at ${built.distance}' distance`
  );
  
  // Log surprise result
  addLogEntry(dungeon, "event", "Surprise Check", surprise.description);
  
  // Log reaction
  const reactionDesc = describeReaction(finalResult);
  addLogEntry(dungeon, "event", `Reaction: ${finalResult.toUpperCase()}`, reactionDesc);
  
  // Set status based on surprise
  if (surprise.monsterSurprised && !surprise.partySurprised) {
    // Party has advantage - can evade, attack, or negotiate
    dungeon.status = "surprise";
    addLogEntry(dungeon, "event", "Tactical Advantage", "The party may evade automatically, attack with a free round, or attempt negotiation.");
  } else if (surprise.partySurprised && !surprise.monsterSurprised) {
    // Monsters have advantage - BECMI: free attack round before party can respond
    dungeon.status = "encounter";
    if ((finalResult === "hostile" || finalResult === "aggressive") && party && party.length > 0) {
      addLogEntry(dungeon, "combat", "⚔️ Ambush!", "The monsters attack before you can react!");
      // Execute the monster's free attack round
      const livingParty = party.filter((c: any) => c.derivedStats?.hp?.current > 0);
      if (livingParty.length > 0) {
        resolveMonsterAttacks(dungeon, livingParty, false);
      }
    } else if (finalResult === "hostile") {
      addLogEntry(dungeon, "combat", "Ambush!", "The monsters attack before you can react!");
    }
  } else {
    // Normal encounter
    dungeon.status = "encounter";
  }
}

function describeReaction(reaction: EncounterReaction): string {
  switch (reaction) {
    case "hostile": return "The creatures attack immediately!";
    case "aggressive": return "The creatures growl and threaten, ready to fight.";
    case "cautious": return "The creatures watch warily, uncertain of your intentions.";
    case "neutral": return "The creatures seem indifferent to your presence.";
    case "friendly": return "The creatures seem well-disposed toward you.";
  }
}

export function evadeEncounter() {
  updateState((state) => {
    const dungeon = state.dungeon;
    const encounter = dungeon.encounter;
    const party = state.party.roster;
    
    if (!encounter) return;
    
    const livingParty = party.filter((c: any) => c.derivedStats?.hp?.current > 0);
    if (!livingParty.length) return;
    
    // BECMI Evasion Checklist, Step 2:
    // If evaders are not surprised and the other side IS surprised, evasion is automatic.
    if (encounter.surprise?.monsterSurprised && !encounter.surprise?.partySurprised) {
      addLogEntry(
        dungeon,
        "event",
        "Evasion successful",
        "You slip away before the monsters notice you.",
      );
      dungeon.status = "idle";
      dungeon.encounter = undefined;
      return;
    }
    
    // Step 3: Decision to pursue – monsters must make a morale check to see if they give chase.
    // checkMonsterMorale returns true if monsters flee (morale failed), false if they stand.
    const monstersFleeInstead = checkMonsterMorale(dungeon, "pursuit_decision");
    if (monstersFleeInstead) {
      // Monsters have broken and run; encounter already cleared by morale logic.
      addLogEntry(
        dungeon,
        "event",
        "Evasion successful",
        "The monsters lose their nerve and do not pursue.",
      );
      return;
    }
    
    // Step 4: Attempt to Evade – use the BECMI Evasion Table to determine chance, then roll d100.
    const partyCount = livingParty.length;
    const monsterCount = estimateMonsterCount(encounter);
    const baseChance = getDungeonEvasionChance(partyCount, monsterCount);
    const roll = rollDie(100);
    
    if (roll <= baseChance) {
      addLogEntry(
        dungeon,
        "combat",
        "Evasion successful",
        `Rolled ${roll} vs ${baseChance}% chance on the Evasion Table. You escape into the dungeon's twists and shadows.`,
      );
      dungeon.status = "idle";
      dungeon.encounter = undefined;
    } else {
      addLogEntry(
        dungeon,
        "combat",
        "Evasion failed",
        `Rolled ${roll} vs ${baseChance}% chance on the Evasion Table. The pursuers keep up – you have not escaped.`,
      );
      // RAW: pursuit continues in rounds at running speed.
      // In this abstraction, we leave the encounter active and let the party choose
      // to fight or attempt to flee (running under fire) in subsequent rounds.
      dungeon.status = "encounter";
    }
  });
}

export function resolveObstacle(strategy: "force" | "careful" | "avoid") {
  updateState((state) => {
    const dungeon = state.dungeon;
    const obstacle = dungeon.obstacle;
    if (!obstacle) return;
    
    obstacle.attemptsMade++;
    
    // Handle based on obstacle type
    if (obstacle.type === "door") {
      resolveDoorObstacle(dungeon, state.party.roster, strategy);
    } else if (obstacle.type === "trap") {
      resolveTrapObstacle(dungeon, state.party.roster, strategy);
    } else {
      resolveHazardObstacle(dungeon, state.party.roster, strategy);
    }
    
    // Apply turn cost if resolved or significant time spent
    if (obstacle.resolved || obstacle.turnCost > 0) {
      const turnsSpent = Math.max(1, obstacle.turnCost);
      advanceTurn(dungeon, turnsSpent, state.party.roster);
      
      const calendar = state.calendar;
      const before = describeClock(calendar.clock);
      advanceClock(calendar.clock, "turn", turnsSpent);
      const after = describeClock(calendar.clock);
      addCalendarLog(calendar, `Obstacle resolution: +${turnsSpent} turn${turnsSpent === 1 ? "" : "s"}`, `${before} → ${after}`);
    }
    
    // Check for wandering monsters if obstacle alerted them
    if (obstacle.alertsMonsters && !obstacle.resolved) {
      // Extra wandering monster check due to noise
      const alertRoll = rollDie(6);
      if (alertRoll <= 2) { // Higher chance due to noise
        addLogEntry(dungeon, "event", "Noise attracts attention!", "Something heard the commotion...");
        checkWanderingMonsters(dungeon);
      }
    }
    
    // Clear obstacle if resolved
    if (obstacle.resolved) {
      dungeon.obstacle = undefined;
      dungeon.status = "idle";
    }
  });
}

function resolveDoorObstacle(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], strategy: string) {
  const obstacle = dungeon.obstacle;
  if (!obstacle) return;
  
  if (strategy === "avoid") {
    addLogEntry(dungeon, "event", "Chose another path", "The party decides to find another way around.");
    obstacle.resolved = true;
    return;
  }
  
  if (obstacle.id === "stuck-door") {
    // BECMI Open Doors: 1d6, success on 5-6 + Str mod
    // Find strongest party member
    const strongestStr = Math.max(...party.map(c => c.abilityScores?.str ?? 10));
    const strMod = strongestStr >= 13 ? (strongestStr >= 16 ? 2 : 1) : (strongestStr <= 8 ? (strongestStr <= 5 ? -2 : -1) : 0);
    
    const result = rollOpenDoors(strMod);
    
    if (result.success) {
      addLogEntry(
        dungeon, 
        "event", 
        "Door forced open!", 
        `Rolled ${result.roll}${result.modifier !== 0 ? ` (${result.modifier > 0 ? '+' : ''}${result.modifier})` : ''} = ${result.total}. ${result.natural6 ? "Natural 6!" : "Success!"}`
      );
      obstacle.resolved = true;
    } else {
      addLogEntry(
        dungeon, 
        "event", 
        "Door won't budge", 
        `Rolled ${result.roll}${result.modifier !== 0 ? ` (${result.modifier > 0 ? '+' : ''}${result.modifier})` : ''} = ${result.total}. Need 5+ to succeed. Monsters beyond may have heard the attempt.`
      );
      // Failed attempt alerts monsters - they lose surprise
    }
  } else if (obstacle.id === "locked-door") {
    // Would need thief with Open Locks skill
    const thief = party.find(c => c.thiefSkills?.pickLocks);
    if (thief && strategy === "careful") {
      const skill = thief.thiefSkills.pickLocks;
      const roll = rollDie(100);
      if (roll <= skill) {
        addLogEntry(dungeon, "event", "Lock picked!", `${thief.name} successfully picks the lock (rolled ${roll} vs ${skill}%).`);
        obstacle.resolved = true;
      } else {
        addLogEntry(dungeon, "event", "Lock resists", `${thief.name} fails to pick the lock (rolled ${roll} vs ${skill}%). Can't try again until gaining a level.`);
      }
    } else if (strategy === "force") {
      // Forcing a locked door is harder
      addLogEntry(dungeon, "event", "Cannot force", "The lock holds firm. A thief's skills are needed.");
    } else {
      addLogEntry(dungeon, "event", "No thief available", "No one in the party has the skills to pick this lock.");
    }
  } else if (obstacle.id === "secret-door") {
    // Already found, so just open it
    addLogEntry(dungeon, "event", "Secret door opened", "Now that you know where it is, the mechanism is easy to operate.");
    obstacle.resolved = true;
  }
}

function resolveTrapObstacle(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], strategy: string) {
  const obstacle = dungeon.obstacle;
  if (!obstacle) return;
  
  if (strategy === "avoid") {
    addLogEntry(dungeon, "event", "Trap avoided", "The party carefully circumvents the trapped area.");
    obstacle.resolved = true;
    return;
  }
  
  if (strategy === "careful") {
    // Try to disarm with thief
    const thief = party.find(c => c.thiefSkills?.removeTraps);
    if (thief) {
      const skill = thief.thiefSkills.removeTraps;
      const roll = rollDie(100);
      if (roll <= skill) {
        addLogEntry(dungeon, "event", "Trap disarmed!", `${thief.name} carefully disables the ${obstacle.name} (rolled ${roll} vs ${skill}%).`);
        obstacle.resolved = true;
      } else {
        addLogEntry(dungeon, "event", "Trap triggered!", `${thief.name} accidentally triggers the trap! (rolled ${roll} vs ${skill}%)`);
        applyTrapDamage(dungeon, party, obstacle);
        obstacle.resolved = true; // Trap is "resolved" by triggering
      }
    } else {
      addLogEntry(dungeon, "event", "No thief available", "No one has the skills to disarm this trap safely.");
    }
  } else if (strategy === "force") {
    // Triggering deliberately or by accident
    addLogEntry(dungeon, "event", "Trap triggered!", "The trap activates!");
    applyTrapDamage(dungeon, party, obstacle);
    obstacle.resolved = true;
  }
}

function applyTrapDamage(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], obstacle: DungeonObstacle) {
  // Roll damage
  let totalDamage = 0;
  if (obstacle.damage && obstacle.damage !== "0") {
    const match = obstacle.damage.match(/(\d+)d(\d+)/);
    if (match) {
      const numDice = parseInt(match[1]);
      const dieSize = parseInt(match[2]);
      for (let i = 0; i < numDice; i++) {
        totalDamage += rollDie(dieSize);
      }
    }
  }
  
  // Apply to random party member (front-liner)
  const livingParty = party.filter(c => c.derivedStats.hp.current > 0);
  if (livingParty.length === 0) return;
  
  const victim = livingParty[0]; // Front-liner takes trap damage
  
  // Allow saving throw (including save-or-die for poison traps)
  let saveTarget = 15; // Default
  if (obstacle.saveType && victim.derivedStats.savingThrows) {
    const saves = victim.derivedStats.savingThrows;
    switch (obstacle.saveType) {
      case "death": saveTarget = saves.deathPoison; break;
      case "wands": saveTarget = saves.wands; break;
      case "paralysis": saveTarget = saves.paraStone; break;
      case "breath": saveTarget = saves.breath; break;
      case "spells": saveTarget = saves.spells; break;
    }
  }
  
  const saveRoll = rollDie(20);
  const isPoisonSave = obstacle.saveType === "death";

  // Save-or-die poisons: failure is immediate death regardless of rolled damage
  if (isPoisonSave && saveRoll < saveTarget) {
    victim.derivedStats.hp.current = 0;
    victim.status = "dead";
    addLogEntry(
      dungeon,
      "combat",
      `${victim.name} succumbs to poison!`,
      `Failed save vs. Poison (rolled ${saveRoll} vs ${saveTarget}).`,
    );
    return;
  }

  if (saveRoll >= saveTarget) {
    // Saved - avoid or half damage depending on trap type (non-poison)
    if (obstacle.id.includes("pit") || obstacle.id.includes("block") || obstacle.id.includes("blade")) {
      addLogEntry(
        dungeon,
        "combat",
        `${victim.name} dodges!`,
        `Saved vs. ${obstacle.saveType} (rolled ${saveRoll} vs ${saveTarget}). No damage taken.`,
      );
      totalDamage = 0;
    } else {
      totalDamage = Math.floor(totalDamage / 2);
      addLogEntry(
        dungeon,
        "combat",
        `${victim.name} partially avoids trap`,
        `Saved vs. ${obstacle.saveType} (rolled ${saveRoll} vs ${saveTarget}). Takes ${totalDamage} damage (half).`,
      );
    }
  } else {
    addLogEntry(
      dungeon,
      "combat",
      `${victim.name} hit by trap!`,
      `Failed save vs. ${obstacle.saveType} (rolled ${saveRoll} vs ${saveTarget}). Takes ${totalDamage} damage!`,
    );
  }
  
  if (totalDamage > 0) {
    victim.derivedStats.hp.current = Math.max(0, victim.derivedStats.hp.current - totalDamage);
    if (victim.derivedStats.hp.current <= 0) {
      victim.status = "dead";
      addLogEntry(dungeon, "combat", `${victim.name} falls!`, "The trap proves fatal!");
    }
  }
}

function resolveHazardObstacle(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], strategy: string) {
  const obstacle = dungeon.obstacle;
  if (!obstacle) return;
  
  if (strategy === "avoid") {
    addLogEntry(dungeon, "event", "Found another way", "The party chooses a different route.");
    obstacle.resolved = true;
    return;
  }
  
  const livingParty = party.filter(c => c.derivedStats.hp.current > 0);
  if (livingParty.length === 0) {
    obstacle.resolved = true;
    return;
  }
  
  // Different hazards require different checks
  if (obstacle.id === "chasm") {
    resolveChasm(dungeon, livingParty, strategy, obstacle);
  } else if (obstacle.id === "slippery-surface") {
    resolveSlipperySurface(dungeon, livingParty, strategy, obstacle);
  } else if (obstacle.id === "flooded-passage") {
    resolveFloodedPassage(dungeon, strategy, obstacle);
  } else if (obstacle.id === "collapsed-passage") {
    resolveCollapsedPassage(dungeon, strategy, obstacle);
  } else {
    // Generic resolution for other hazards/features
    if (strategy === "careful") {
      addLogEntry(
        dungeon,
        "event",
        `${obstacle.name} navigated carefully`,
        `The party takes their time and proceeds with caution. ${obstacle.turnCost > 1 ? `This costs ${obstacle.turnCost} turns.` : ''}`
      );
    } else {
      addLogEntry(dungeon, "event", `${obstacle.name} passed`, "The party pushes through quickly.");
    }
    obstacle.resolved = true;
  }
}

// BECMI: Chasm requires Dexterity check to jump, or careful crossing with rope
function resolveChasm(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], strategy: string, obstacle: DungeonObstacle) {
  if (strategy === "careful") {
    // Careful crossing with rope - takes time but much safer
    addLogEntry(dungeon, "event", "Rope secured", "The party carefully secures a rope and crosses one at a time.");
    
    // Each character makes an easy Dex check (roll under Dex on d20)
    for (const char of party) {
      const dex = char.abilityScores?.dex ?? 10;
      const roll = rollDie(20);
      // With rope, +4 bonus effectively (higher threshold)
      if (roll > dex + 4 && roll !== 1) { // Natural 1 always succeeds
        // Slipped but rope catches them - minor damage
        const fallDamage = rollDie(4); // Rope-assisted fall = less damage
        char.derivedStats.hp.current = Math.max(0, char.derivedStats.hp.current - fallDamage);
        addLogEntry(dungeon, "combat", `${char.name} slips!`, `Dex check failed (rolled ${roll} vs ${dex}+4). The rope catches them but they take ${fallDamage} damage from the fall.`);
        if (char.derivedStats.hp.current <= 0) {
          char.status = "dead";
          addLogEntry(dungeon, "combat", `${char.name} falls!`, "The impact proves fatal.");
        }
      } else {
        addLogEntry(dungeon, "event", `${char.name} crosses safely`, `Dex check passed (rolled ${roll} vs ${dex}+4).`);
      }
    }
    obstacle.resolved = true;
  } else {
    // Force = jump across - risky!
    addLogEntry(dungeon, "event", "Attempting to jump!", "Each party member leaps across the chasm...");
    
    for (const char of party) {
      // BECMI Ability Check: Roll 1d20, must roll ≤ Dex score
      const dex = char.abilityScores?.dex ?? 10;
      const roll = rollDie(20);
      
      if (roll <= dex || roll === 1) { // Natural 1 always succeeds per BECMI
        addLogEntry(dungeon, "event", `${char.name} lands safely!`, `Dex check passed (rolled ${roll} vs ${dex}).`);
      } else {
        // Failed - they fall!
        const fallDamage = rollDie(6) + rollDie(6) + rollDie(6); // 3d6 per obstacle definition
        char.derivedStats.hp.current = Math.max(0, char.derivedStats.hp.current - fallDamage);
        addLogEntry(dungeon, "combat", `${char.name} falls into the chasm!`, `Dex check failed (rolled ${roll} vs ${dex}). Takes ${fallDamage} damage from the fall!`);
        
        if (char.derivedStats.hp.current <= 0) {
          char.status = "dead";
          addLogEntry(dungeon, "combat", `${char.name} is killed!`, "The fall proves fatal.");
        }
      }
    }
    obstacle.resolved = true;
  }
}

// BECMI: Slippery surface - Dex check or Save vs Paralysis to avoid falling
function resolveSlipperySurface(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], strategy: string, obstacle: DungeonObstacle) {
  if (strategy === "careful") {
    addLogEntry(dungeon, "event", "Moving carefully", "The party proceeds slowly across the slick surface.");
    // Careful movement - easier check
    for (const char of party) {
      const dex = char.abilityScores?.dex ?? 10;
      const roll = rollDie(20);
      if (roll > dex + 6) { // Very easy with care
        const fallDamage = rollDie(4);
        char.derivedStats.hp.current = Math.max(0, char.derivedStats.hp.current - fallDamage);
        addLogEntry(dungeon, "combat", `${char.name} slips!`, `Takes ${fallDamage} damage from the fall.`);
      }
    }
    obstacle.resolved = true;
  } else {
    // Force = rush through
    addLogEntry(dungeon, "event", "Rushing across!", "The party hurries across the slippery surface...");
    
    for (const char of party) {
      const dex = char.abilityScores?.dex ?? 10;
      const roll = rollDie(20);
      
      if (roll <= dex) {
        addLogEntry(dungeon, "event", `${char.name} keeps footing`, `Dex check passed (rolled ${roll} vs ${dex}).`);
      } else {
        const fallDamage = rollDie(4);
        char.derivedStats.hp.current = Math.max(0, char.derivedStats.hp.current - fallDamage);
        addLogEntry(dungeon, "combat", `${char.name} falls!`, `Dex check failed (rolled ${roll} vs ${dex}). Takes ${fallDamage} damage.`);
        
        if (char.derivedStats.hp.current <= 0) {
          char.status = "dead";
        }
      }
    }
    obstacle.resolved = true;
  }
}

// Flooded passage - risks torches, slows movement
function resolveFloodedPassage(dungeon: typeof DEFAULT_STATE.dungeon, strategy: string, obstacle: DungeonObstacle) {
  if (strategy === "careful") {
    addLogEntry(dungeon, "event", "Wading carefully", "The party holds torches high and wades through slowly.");
    // Torches safe with careful movement
    obstacle.resolved = true;
  } else {
    // Rushing through water risks torches
    addLogEntry(dungeon, "event", "Splashing through!", "The party rushes through the flooded passage...");
    
    // 50% chance a torch gets extinguished
    if (rollDie(100) <= 50 && dungeon.torches > 0) {
      dungeon.torches--;
      addLogEntry(dungeon, "event", "Torch extinguished!", `A torch sputters and goes out in the water. ${dungeon.torches} torches remaining.`);
      if (dungeon.torches === 0) {
        dungeon.lighting = "dark";
        addLogEntry(dungeon, "event", "Darkness!", "Your last light source has gone out!");
      }
    }
    obstacle.resolved = true;
  }
}

// Collapsed passage - clearing rubble takes time and makes noise
function resolveCollapsedPassage(dungeon: typeof DEFAULT_STATE.dungeon, strategy: string, obstacle: DungeonObstacle) {
  if (strategy === "careful") {
    addLogEntry(dungeon, "event", "Clearing rubble carefully", "The party carefully moves stones, bracing as they go. This takes considerable time.");
    // Takes full turn cost (3 turns) but safe
    obstacle.resolved = true;
  } else {
    // Force = dig quickly but risk further collapse
    addLogEntry(dungeon, "event", "Digging frantically!", "The party throws stones aside as fast as possible...");
    
    // 20% chance of further collapse causing damage
    if (rollDie(100) <= 20) {
      const collapseRoll = rollDie(6);
      addLogEntry(dungeon, "combat", "More rubble falls!", `The digging triggers more collapse. Everyone nearby takes ${collapseRoll} damage!`);
      // Damage to front-liners
    }
    obstacle.turnCost = 1; // Faster but risky
    obstacle.resolved = true;
  }
}

export function resolveEncounter(outcome: "fight" | "parley" | "flee") {
  updateState((state) => {
    const dungeon = state.dungeon;
    const encounter = dungeon.encounter;
    if (!encounter) return;

    if (outcome === "fight") {
      // Check if party has surprise advantage (BECMI: free attack round before initiative)
      const hasSurpriseAdvantage = encounter.surprise?.monsterSurprised && !encounter.surprise?.partySurprised;
      
      if (hasSurpriseAdvantage && dungeon.status === "surprise") {
        // FREE ATTACK ROUND - monsters cannot respond!
        addLogEntry(dungeon, "combat", "⚡ Surprise Attack!", "The party strikes before the monsters can react!");
        
        const livingParty = state.party.roster.filter(char => char.derivedStats.hp.current > 0);
        resolvePartyAttacks(dungeon, livingParty);
        
        // Check if monsters defeated in surprise round
        if (encounter.hp <= 0) {
          addLogEntry(dungeon, "combat", "Victory!", `The ${encounter.name} never knew what hit them!`);
          dungeon.status = "loot";
          return;
        }
        
        // Monsters now recover from surprise - normal combat begins
        addLogEntry(dungeon, "event", "Surprise ends", "The monsters recover and prepare to fight back!");
        dungeon.status = "encounter";
        // Clear surprise state so subsequent rounds are normal
        encounter.surprise = undefined;
      } else {
        // Normal combat round
        performCombatRound(dungeon, state.party.roster, false);
      }
    } else if (outcome === "parley") {
      // Parley success depends on reaction
      if (encounter.reaction === "hostile") {
        addLogEntry(dungeon, "combat", "Parley failed - they attack!", "The monsters ignore your words and charge!");
        performCombatRound(dungeon, state.party.roster, false);
      } else if (encounter.reaction === "aggressive") {
        // Aggressive monsters might be talked down with good Charisma
        const parleyRoll = rollDie(6) + rollDie(6); // 2d6
        if (parleyRoll >= 9) {
          addLogEntry(dungeon, "event", "Parley partially successful", "The creatures grudgingly agree to let you pass, but remain hostile.");
          dungeon.status = "idle";
          dungeon.encounter = undefined;
        } else {
          addLogEntry(dungeon, "combat", "Parley failed!", "Your words only anger them further!");
          performCombatRound(dungeon, state.party.roster, false);
        }
      } else {
        addLogEntry(dungeon, "event", "Parley successful", `You convince the ${encounter.name} to leave peacefully.`);
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

  // BECMI Initiative: Roll 1d6 for each side, higher goes first
  // On ties, actions are simultaneous
  const partyInit = rollDie(6);
  const monsterInit = rollDie(6);
  
  let initiativeResult: string;
  if (partyInit > monsterInit) {
    initiativeResult = "Party acts first!";
  } else if (monsterInit > partyInit) {
    initiativeResult = "Monsters act first!";
  } else {
    initiativeResult = "Tied! Actions are simultaneous.";
  }

  addLogEntry(dungeon, "combat", `Initiative: Party ${partyInit}, Monsters ${monsterInit}`, initiativeResult);

  // Combat resolution based on initiative
  if (partyInit > monsterInit) {
    // Party goes first
    if (!fleeing) {
      resolvePartyAttacks(dungeon, livingParty);
    }
    if (encounter.hp > 0) {
      resolveMonsterAttacks(dungeon, livingParty, fleeing);
    }
  } else if (monsterInit > partyInit) {
    // Monsters go first
    resolveMonsterAttacks(dungeon, livingParty, fleeing);
    if (!fleeing && encounter.hp > 0) {
      resolvePartyAttacks(dungeon, livingParty);
    }
  } else {
    // Simultaneous - both sides attack "at the same time"
    // Damage is dealt even if the attacker is killed this round
    if (!fleeing) {
      resolvePartyAttacks(dungeon, livingParty);
    }
    resolveMonsterAttacks(dungeon, livingParty, fleeing);
  }

  // If fleeing, party gets away if they survive the attacks
  if (fleeing) {
    const stillLiving = livingParty.filter(char => char.derivedStats.hp.current > 0);
    if (stillLiving.length > 0) {
      // Monsters need morale check to pursue
      const pursueCheck = checkMonsterMorale(dungeon, "pursuit");
      if (!pursueCheck) {
        addLogEntry(dungeon, "combat", "Escape successful!", "The monsters decide not to pursue.");
        dungeon.status = "idle";
        dungeon.encounter = undefined;
        return;
      } else {
        addLogEntry(dungeon, "combat", "Monsters give chase!", "The monsters pursue you relentlessly!");
      }
    }
  }

  // Check if monsters are defeated
  if (encounter.hp <= 0) {
    addLogEntry(dungeon, "combat", "Victory!", `The ${encounter.name} have been defeated!`);
    dungeon.status = "loot";
    return;
  }

  // Check if party is wiped out
  const stillLiving = livingParty.filter(char => char.derivedStats.hp.current > 0);
  if (stillLiving.length === 0) {
    addLogEntry(dungeon, "combat", "Party Wiped Out!", "All party members have fallen!");
    dungeon.status = "idle";
    dungeon.encounter = undefined;
    return;
  }
}

function resolvePartyAttacks(dungeon: typeof DEFAULT_STATE.dungeon, party: any[]) {
  if (!dungeon.encounter) return;

  const encounter = dungeon.encounter;
  let totalDamage = 0;
  const hpBefore = encounter.hp;

  party.forEach((char) => {
    if (char.derivedStats.hp.current <= 0 || char.status !== "alive") return;

    // Calculate attack roll using THAC0
    const attackRoll = rollDie(20);
    const targetAC = encounter.armorClass;
    const requiredRoll = char.derivedStats.thac0 - targetAC;

    if (attackRoll >= requiredRoll || attackRoll === 20) { // Natural 20 always hits
      const damageFormula = getWeaponDamageFormulaForCharacter(char);
      const damage = rollFormula(damageFormula);
      totalDamage += damage;
      addLogEntry(dungeon, "combat", `${char.name} hits!`, `Deals ${damage} damage to ${encounter.name}`);
    } else {
      addLogEntry(dungeon, "combat", `${char.name} misses`, `Attack roll: ${attackRoll} (needed ${requiredRoll}+)`);
    }
  });

  if (totalDamage > 0) {
    encounter.hp = Math.max(0, encounter.hp - totalDamage);
    addLogEntry(dungeon, "combat", `Party deals ${totalDamage} total damage`, `${encounter.name} has ${encounter.hp} HP remaining`);

    // If the encounter has been reduced to 0 HP, skip morale checks - they are already defeated
    if (encounter.hp <= 0) {
      return;
    }

    // BECMI Morale Checks
    const hpPerMonster = Math.max(1, Math.round(encounter.hitDice * 4.5)); // Average of 1dHD

    // 1. First hit check (when creature first takes damage)
    if (!encounter.moraleChecked.firstHit && hpBefore === encounter.hpMax && totalDamage > 0) {
      encounter.moraleChecked.firstHit = true;
      if (checkMonsterMorale(dungeon, "first_hit")) return;
    }

    // 2. First Death check (when damage >= 1 monster's worth of HP)
    if (!encounter.moraleChecked.firstDeath && totalDamage >= hpPerMonster) {
      encounter.moraleChecked.firstDeath = true;
      if (checkMonsterMorale(dungeon, "first_death")) return;
    }

    // 3. Quarter HP check
    if (!encounter.moraleChecked.quarterHp && encounter.hp <= (encounter.hpMax / 4)) {
      encounter.moraleChecked.quarterHp = true;
      if (checkMonsterMorale(dungeon, "quarter_hp")) return;
    }

    // 4. Half Incapacitated check (when HP is at half or less, simulating half group down)
    if (!encounter.moraleChecked.halfIncapacitated && encounter.hp <= (encounter.hpMax / 2)) {
      encounter.moraleChecked.halfIncapacitated = true;
      if (checkMonsterMorale(dungeon, "half_incapacitated")) return;
    }
  }
}

function resolveMonsterAttacks(dungeon: typeof DEFAULT_STATE.dungeon, party: any[], fleeing: boolean) {
  if (!dungeon.encounter) return;

  const encounter = dungeon.encounter;
  const hitBonus = fleeing ? 2 : 0; // Bonus to hit fleeing targets

  // Calculate active monster count (based on remaining HP)
  const hpPerMonster = Math.max(1, Math.round(encounter.hitDice * 4.5));
  const activeCount = Math.max(1, Math.ceil(encounter.hp / hpPerMonster));

  addLogEntry(dungeon, "combat", `Monster attacks`, `${activeCount} ${encounter.name} attack!`);

  // Each active monster attacks
  for (let i = 0; i < activeCount; i++) {
    // Select random target
    const livingTargets = party.filter((char) => char.derivedStats.hp.current > 0 && char.status !== "dead");
    if (livingTargets.length === 0) break;

    const target = livingTargets[Math.floor(Math.random() * livingTargets.length)];
    const attackRoll = rollDie(20) + hitBonus;

    // Monster THAC0 based on HD (BECMI table approximation)
    const monsterTHAC0 = getMonsterTHAC0(encounter.hitDice);
    const requiredRoll = monsterTHAC0 - target.derivedStats.ac;

    if (attackRoll >= requiredRoll || attackRoll >= 20) {
      const damage = rollFormula(encounter.damage);
      let newHp = Math.max(0, target.derivedStats.hp.current - damage);
      target.derivedStats.hp.current = newHp;

      if (newHp <= 0) {
        addLogEntry(
          dungeon,
          "combat",
          `${target.name} falls!`,
          `Hit by ${encounter.name} for ${damage} damage`,
        );
        target.status = "dead";

        // Check monster morale on PC death (first death on either side)
        if (!encounter.moraleChecked.firstDeath) {
          encounter.moraleChecked.firstDeath = true;
          // Note: Monsters killing a PC might boost their morale, but rules say check anyway
        }
      } else {
        addLogEntry(
          dungeon,
          "combat",
          `${target.name} hit!`,
          `Takes ${damage} damage from ${encounter.name}`,
        );
      }

      // Apply special monster abilities (poison, paralysis, petrification, energy drain, charm)
      applyMonsterSpecialEffectsOnHit(dungeon, encounter, target);
    } else {
      addLogEntry(dungeon, "combat", `${encounter.name} misses ${target.name}`, `Attack roll: ${attackRoll} (needed ${requiredRoll}+)`);
    }
  }
}

// BECMI Monster THAC0 by HD (approximation from rules)
function getMonsterTHAC0(hd: number): number {
  if (hd < 1) return 19;
  if (hd <= 1) return 19;
  if (hd <= 2) return 18;
  if (hd <= 3) return 17;
  if (hd <= 4) return 16;
  if (hd <= 5) return 15;
  if (hd <= 6) return 14;
  if (hd <= 7) return 13;
  if (hd <= 8) return 12;
  if (hd <= 9) return 11;
  if (hd <= 11) return 10;
  if (hd <= 13) return 9;
  if (hd <= 15) return 8;
  if (hd <= 17) return 7;
  if (hd <= 19) return 6;
  if (hd <= 21) return 5;
  return 4; // 22+ HD
}

// BECMI Morale Check (p. 102)
// Roll 2d6, if result > morale score, creature flees
// Returns true if monsters flee
function checkMonsterMorale(dungeon: typeof DEFAULT_STATE.dungeon, trigger: string): boolean {
  if (!dungeon.encounter) return false;

  const encounter = dungeon.encounter;
  
  // Morale 2 = always flees, Morale 12 = never flees
  if (encounter.morale <= 2) {
    addLogEntry(dungeon, "combat", "Morale check: Cowardly!", `${encounter.name} flee immediately!`);
    dungeon.status = "idle";
    dungeon.encounter = undefined;
    return true;
  }
  if (encounter.morale >= 12) {
    addLogEntry(dungeon, "combat", "Morale check: Fearless", `${encounter.name} fight to the death!`);
    return false;
  }

  const moraleRoll = rollDie(6) + rollDie(6);
  
  // Adjustments to morale SCORE (not roll) per BECMI
  let adjustedMorale = encounter.morale;
  
  // Adjust based on HP situation
  const hpPercent = (encounter.hp / encounter.hpMax) * 100;
  if (hpPercent <= 25) adjustedMorale -= 2;
  else if (hpPercent <= 50) adjustedMorale -= 1;

  // BECMI: Roll GREATER than morale = flee
  if (moraleRoll > adjustedMorale) {
    const triggerDesc = trigger.replace(/_/g, ' ');
    addLogEntry(
      dungeon,
      "combat",
      "Morale check failed!",
      `${encounter.name} flee! (Rolled ${moraleRoll} vs morale ${adjustedMorale}, trigger: ${triggerDesc})`
    );
    addLogEntry(dungeon, "event", "Encounter ended", "The surviving monsters have fled. You may continue exploring.");
    dungeon.status = "idle";
    dungeon.encounter = undefined;
    return true;
  }
  
  addLogEntry(
    dungeon,
    "combat",
    "Morale holds",
    `${encounter.name} continue fighting (Rolled ${moraleRoll} vs morale ${adjustedMorale})`
  );
  return false;
}

// ------------------------------------------------------------
// BECMI Evasion Table helpers (Dungeon-scale evasion)
// ------------------------------------------------------------

function estimateMonsterCount(encounter: DungeonEncounter): number {
  const hpPerMonster = Math.max(1, Math.round(encounter.hitDice * 4.5));
  return Math.max(1, Math.round(encounter.hpMax / hpPerMonster));
}

function getDungeonEvasionChance(partySize: number, monsterCount: number): number {
  let chance = 0;
  
  if (partySize <= 4) {
    if (monsterCount === 1) {
      chance = 50;
    } else if (monsterCount >= 2 && monsterCount <= 3) {
      chance = 70;
    } else if (monsterCount >= 4) {
      chance = 90;
    }
  } else if (partySize <= 12) {
    if (monsterCount >= 1 && monsterCount <= 3) {
      chance = 35;
    } else if (monsterCount >= 4 && monsterCount <= 8) {
      chance = 50;
    } else if (monsterCount >= 9) {
      chance = 70;
    }
  } else if (partySize <= 24) {
    if (monsterCount >= 1 && monsterCount <= 6) {
      chance = 25;
    } else if (monsterCount >= 7 && monsterCount <= 16) {
      chance = 35;
    } else if (monsterCount >= 17) {
      chance = 50;
    }
  } else {
    // 25+ characters
    if (monsterCount >= 1 && monsterCount <= 10) {
      chance = 10;
    } else if (monsterCount >= 11 && monsterCount <= 30) {
      chance = 25;
    } else if (monsterCount >= 31) {
      chance = 35;
    }
  }
  
  // Important note from RC: minimum 5% chance to evade regardless of penalties.
  if (chance <= 0) {
    chance = 5;
  }
  return Math.max(5, Math.min(95, chance));
}

export function searchRoom() {
  let turnsSpent = 0;
  updateState((state) => {
    const dungeon = state.dungeon;

    // Check if room has already been searched
    if (dungeon.roomSearched) {
      addLogEntry(dungeon, "event", "Already searched", "This room has already been thoroughly searched.");
      return;
    }

    turnsSpent = advanceTurn(dungeon, 1, state.party.roster);

    // Mark room as searched
    dungeon.roomSearched = true;
    // If RC Random Stocking indicates hidden unguarded treasure and it hasn't been taken yet,
    // use the official Unguarded Treasure table (by dungeon level).
    if (dungeon.roomHasTreasure && !dungeon.roomTreasureClaimed && (!dungeon.roomContents || dungeon.roomContents !== "monster")) {
      const treasure = generateUnguardedTreasureByLevel(dungeon.depth);
      if (treasure.totalGold > 0 || treasure.summary) {
        dungeon.loot += treasure.totalGold;
        dungeon.roomTreasureClaimed = true;
        addLogEntry(
          dungeon,
          "loot",
          "Unguarded treasure discovered!",
          treasure.summary || "You uncover a hidden stash of coins and valuables."
        );
      }
    } else {
      // Otherwise fall back to the existing abstract search outcomes
      const searchRoll = rollDie(100);

      if (searchRoll <= 20) {
        // Found abstract treasure
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
        addLogEntry(dungeon, "event", "Useful item found", itemResult);
      } else {
        // Nothing found
        const noFindMessages = [
          "After thorough searching, nothing of value is found.",
          "The area has been picked clean by previous explorers.",
          "Your search reveals only dust and debris.",
          "No hidden compartments or secret doors are discovered.",
          "The area yields no secrets to your careful examination."
        ];
        addLogEntry(dungeon, "event", "Search complete", noFindMessages[Math.floor(Math.random() * noFindMessages.length)]);
      }
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
    // BECMI: Resting takes 6 hours (36 turns) to be "well-rested" for spell recovery
    const REST_DURATION_TURNS = 36; // 6 hours × 6 turns per hour
    turnsSpent = advanceTurn(dungeon, REST_DURATION_TURNS, state.party.roster);

    if (dungeon.rations > 0) {
      dungeon.rations -= 1;
      addLogEntry(dungeon, "event", "Party rests and eats", `Spent ${REST_DURATION_TURNS} turns resting (6 hours). Spellcasters may now recover spells.`);
    } else {
      addLogEntry(dungeon, "event", "Rested without rations", `Spent ${REST_DURATION_TURNS} turns resting (6 hours), but fatigue may become an issue without food.`);
    }

    // Recover expended spells - BECMI: "one night's sleep is enough rest" for spell recovery
    // Spellcasters can now re-memorize spells (though this would take additional study time)
    state.party.roster.forEach(character => {
      if (character.spells?.known) {
        character.spells.known.forEach(spell => {
          if (spell.expended) {
            spell.expended = false;
            spell.memorized = false; // Spells are forgotten when cast, need re-memorization
          }
        });
      }
    });

    // Advance calendar time
    if (turnsSpent > 0) {
      const calendar = state.calendar;
      const before = describeClock(calendar.clock);
      advanceClock(calendar.clock, "turn", turnsSpent);
      const after = describeClock(calendar.clock);
      addCalendarLog(calendar, `Dungeon rest: +${turnsSpent} turns (6 hours)`, `${before} → ${after}`);
    }
  });
}

export function lootRoom() {
  updateState((state) => {
    const dungeon = state.dungeon;
    const encounter = dungeon.encounter;

    // Award XP for defeated monsters
    if (encounter) {
      const xpAwarded = calculateMonsterXP(encounter);
      awardXpToParty(state.party.roster, xpAwarded, encounter.name);
      addLogEntry(dungeon, "loot", `XP Awarded: ${xpAwarded} total`, `Each surviving party member gains XP from defeating ${encounter.name}`);
    }

    // Generate treasure
    const type = encounter?.treasureType ?? "A";
    const loot = generateTreasure(type);
    dungeon.loot += loot.totalGold;
    addLogEntry(dungeon, "loot", "Loot recovered", loot.summary);

    dungeon.status = "idle";
    dungeon.encounter = undefined;
  });
}

// Attempt to return to the surface - BECMI accurate with wandering monster checks
export function attemptReturn() {
  updateState((state) => {
    const dungeon = state.dungeon;
    const depth = dungeon.depth;
    
    // Calculate turns needed to return based on depth
    // Estimate: 3 turns per dungeon level to traverse back
    const turnsToExit = depth * 3;
    
    // Number of wandering monster checks (every 2 turns per BECMI)
    const numChecks = Math.ceil(turnsToExit / 2);
    
    addLogEntry(dungeon, "event", "Beginning return journey", 
      `Depth ${depth} requires approximately ${turnsToExit} turns to exit. Making ${numChecks} wandering monster checks...`);
    
    // Roll all wandering monster checks at once
    let encountersTriggered = 0;
    const checkResults: string[] = [];
    
    for (let i = 0; i < numChecks; i++) {
      const roll = rollDie(6);
      if (roll === 1) {
        encountersTriggered++;
        checkResults.push(`Check ${i + 1}: ${roll} - ENCOUNTER!`);
      } else {
        checkResults.push(`Check ${i + 1}: ${roll} - Safe`);
      }
    }
    
    addLogEntry(dungeon, "event", "Wandering monster checks", checkResults.join(" | "));
    
    if (encountersTriggered > 0) {
      // Encounter during escape! Generate one encounter at current depth
      addLogEntry(dungeon, "combat", `⚔️ Ambushed during retreat!`, 
        `${encountersTriggered} encounter${encountersTriggered > 1 ? 's' : ''} triggered! You must fight or flee before reaching safety.`);
      
      // Start the encounter - can't bank until resolved
      startEncounter(dungeon, true, state.party.roster); // true = wandering monster
      dungeon.status = "encounter";
      
      // Mark that we're trying to exit (so after combat resolves, we continue)
      // We'll add an "escaping" flag to track this
    } else {
      // Safe return!
      completeReturn(dungeon, state);
    }
  });
}

// Complete the return to surface and bank loot
function completeReturn(dungeon: typeof DEFAULT_STATE.dungeon, state: any) {
  const lootAmount = dungeon.loot;
  const depth = dungeon.depth;
  const turnsToExit = depth * 3;
  
  // Advance time for the journey back
  advanceTurn(dungeon, turnsToExit, state.party.roster);
  
  // Update calendar
  const calendar = state.calendar;
  const before = describeClock(calendar.clock);
  advanceClock(calendar.clock, "turn", turnsToExit);
  const after = describeClock(calendar.clock);
  addCalendarLog(calendar, `Return journey: +${turnsToExit} turns`, `${before} → ${after}`);
  
  addLogEntry(dungeon, "loot", "🏠 Returned to safety!", 
    `After ${turnsToExit} turns of travel, the party reaches the surface with ${lootAmount} gp.`);
  
  // Reset dungeon state
  dungeon.loot = 0;
  dungeon.turn = 0;
  dungeon.status = "idle";
  
  // Record in ledger if there was loot
  if (lootAmount > 0) {
    // We need to record outside updateState to avoid nesting
    // So we'll flag it and handle in the outer function
  }
}

// Old simple bank function - now just for after-combat banking
export function bankLoot() {
  let lootAmount = 0;
  let depth = 1;

  updateState((state) => {
    const dungeon = state.dungeon;
    
    // If in combat/encounter, can't bank yet
    if (dungeon.status === "encounter" || dungeon.status === "surprise") {
      addLogEntry(dungeon, "event", "Cannot leave!", "You must resolve the current encounter first.");
      return;
    }
    
    lootAmount = dungeon.loot;
    depth = dungeon.depth;
    
    // Simple instant bank for when already at surface or after combat
    if (dungeon.turn === 0 || dungeon.depth === 0) {
      // Already at surface
      addLogEntry(dungeon, "loot", "Loot secured", `${lootAmount} gp added to treasury.`);
      dungeon.loot = 0;
    } else {
      // Use the proper return sequence
      addLogEntry(dungeon, "event", "Use 'Return to Surface'", "You must travel back through the dungeon first.");
      return;
    }
  });

  // Record in the central ledger (outside updateState to avoid nested calls)
  if (lootAmount > 0) {
    recordLoot(lootAmount, `Dungeon loot (depth ${depth})`);
  }
}

// Called after resolving an encounter during escape
export function continueReturn() {
  let lootAmount = 0;
  let depth = 1;
  
  updateState((state) => {
    const dungeon = state.dungeon;
    
    // Only continue if encounter was just resolved
    if (dungeon.status !== "idle" && dungeon.status !== "loot") {
      return;
    }
    
    // If in loot status, they won the fight - collect loot first
    if (dungeon.status === "loot" && dungeon.encounter) {
      // Don't auto-continue, let them loot first
      return;
    }
    
    lootAmount = dungeon.loot;
    depth = dungeon.depth;
    
    // Complete the return journey
    const turnsToExit = depth * 3;
    
    // Advance time for remainder of journey
    advanceTurn(dungeon, turnsToExit, state.party.roster);
    
    // Update calendar
    const calendar = state.calendar;
    const before = describeClock(calendar.clock);
    advanceClock(calendar.clock, "turn", turnsToExit);
    const after = describeClock(calendar.clock);
    addCalendarLog(calendar, `Completed return: +${turnsToExit} turns`, `${before} → ${after}`);
    
    addLogEntry(dungeon, "loot", "🏠 Finally reached safety!", 
      `The party emerges from the dungeon with ${lootAmount} gp.`);
    
    // Reset dungeon state
    dungeon.loot = 0;
    dungeon.turn = 0;
    dungeon.status = "idle";
  });

  // Record in the central ledger
  if (lootAmount > 0) {
    recordLoot(lootAmount, `Dungeon loot (depth ${depth})`);
  }
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
    
    // Update lighting if no torches
    if (state.dungeon.torches === 0) {
      state.dungeon.lighting = "dark";
      addLogEntry(state.dungeon, "event", "Darkness!", "You are now in complete darkness.");
    }
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
    
    const hpBefore = encounter.hp;
    encounter.hp = Math.max(0, encounter.hp - amount);
    
    // Check morale triggers from manual damage application
    if (hpBefore === encounter.hpMax && amount > 0 && !encounter.moraleChecked.firstHit) {
      encounter.moraleChecked.firstHit = true;
      checkMonsterMorale(state.dungeon, "first_hit");
    }
    
    if (encounter.hp === 0) {
      state.dungeon.status = "loot";
      addLogEntry(state.dungeon, "combat", `Defeated ${encounter.name}`);
    }
  });
}

export function setEncounterReaction(reaction: EncounterReaction) {
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

function advanceTurn(dungeon: typeof DEFAULT_STATE.dungeon, turns = 1, party?: any[]): number {
  if (turns <= 0) return 0;

  const startingTurn = dungeon.turn;

  // Handle torch consumption and wandering monster checks for each turn
  const TORCH_DURATION_TURNS = 6;
  for (let i = 0; i < turns; i++) {
    dungeon.turn++;

    // Handle torch consumption - each torch burns for 6 turns (1 hour)
    if (dungeon.torches > 0) {
      dungeon.torchTurnsUsed++;
      if (dungeon.torchTurnsUsed >= TORCH_DURATION_TURNS) {
        dungeon.torches--;
        dungeon.torchTurnsUsed = 0;
        addLogEntry(dungeon, "event", `Torch burned out (${dungeon.torches} remaining)`);

        // Update lighting if last torch burned out
        if (dungeon.torches === 0) {
          dungeon.lighting = "dark";
          addLogEntry(dungeon, "event", "Darkness!", "Your last torch has burned out!");
        }
      }
    }

    // Check for wandering monsters every 2 turns (BECMI rule)
    if (dungeon.turn % 2 === 0) {
      checkWanderingMonsters(dungeon, party);
      // If we encountered monsters during any activity, stop that activity early
      if (dungeon.status === "encounter" || dungeon.status === "surprise") {
        addLogEntry(
          dungeon,
          "event",
          "Activity interrupted!",
          "Wandering monsters appear and cut your plans short.",
        );
        // Return the number of turns actually completed
        return dungeon.turn - startingTurn;
      }
    }
  }

  return turns;
}

// ------------------------------------------------------------
// RC Random Stocking helpers
// ------------------------------------------------------------

// RC Room Contents Table (Random Stocking, Chapter 17)
// First 1d6 = contents; second 1d6 = whether treasure is present.
function rollRoomStocking(): { contents: DungeonRoomContents; hasTreasure: boolean } {
  const first = rollDie(6);
  const second = rollDie(6);

  let contents: DungeonRoomContents;
  if (first <= 2) {
    contents = "empty";
  } else if (first === 3) {
    contents = "trap";
  } else if (first === 4 || first === 5) {
    contents = "monster";
  } else {
    contents = "special";
  }

  // Treasure column: "T" entries by contents and second roll
  let hasTreasure = false;
  if (contents === "empty") {
    // 1-2 Empty, treasure on second roll of 1
    hasTreasure = second === 1;
  } else if (contents === "trap") {
    // 3 Trap, treasure on second roll of 1–2
    hasTreasure = second === 1 || second === 2;
  } else if (contents === "monster") {
    // 4-5 Monster, treasure on second roll of 1–3
    hasTreasure = second >= 1 && second <= 3;
  } else {
    // 6 Special – normally no treasure from the Random Stocking table
    hasTreasure = false;
  }

  return { contents, hasTreasure };
}

// Lightweight area type tags for flavor (RC mapping terms)
function determineAreaType(): { areaType: DungeonAreaType; intersectionKind?: "side_passage" | "t_intersection" | "four_way" } {
  const roll = rollDie(100);
  // Simple abstraction: mostly rooms, with occasional corridors and intersections
  if (roll <= 60) {
    return { areaType: "room" };
  }
  if (roll <= 85) {
    return { areaType: "corridor" };
  }

  // Intersection – pick RC-described type
  const intersectionRoll = rollDie(3);
  if (intersectionRoll === 1) {
    return { areaType: "intersection", intersectionKind: "side_passage" };
  }
  if (intersectionRoll === 2) {
    return { areaType: "intersection", intersectionKind: "t_intersection" };
  }
  return { areaType: "intersection", intersectionKind: "four_way" };
}

function describeEmptyArea(areaType: DungeonAreaType, intersectionKind: "side_passage" | "t_intersection" | "four_way" | null | undefined): string {
  if (areaType === "room") {
    const emptyDescriptions = [
      "The room appears to be empty.",
      "Nothing of interest catches your eye.",
      "The chamber is bare except for dust and cobwebs.",
      "This room has been stripped clean long ago.",
      "An empty chamber with signs of previous habitation.",
      "The room contains only debris and rubble."
    ];
    return emptyDescriptions[Math.floor(Math.random() * emptyDescriptions.length)];
  }

  if (areaType === "corridor") {
    const corridorDescriptions = [
      "A straight dungeon corridor stretches into the gloom.",
      "The passageway runs ahead, its walls damp and close.",
      "You move along a narrow corridor, echoes following your steps.",
      "The corridor is quiet, lined with old stone blocks and dust."
    ];
    return corridorDescriptions[Math.floor(Math.random() * corridorDescriptions.length)];
  }

  // Intersections use RC mapping terms explicitly
  switch (intersectionKind) {
    case "side_passage":
      return "You come to a side passage: a corridor branches off to one side, but the main corridor continues.";
    case "t_intersection":
      return "You reach a T-intersection where the main corridor ends and passages continue left and right.";
    case "four_way":
    default:
      return "You arrive at a four-way intersection where corridors branch off in all directions.";
  }
}

function checkWanderingMonsters(dungeon: typeof DEFAULT_STATE.dungeon, party?: any[]) {
  // BECMI wandering monster check: 1d6, encounter on roll of 1
  const roll = rollDie(6);
  if (roll === 1) {
    // Wandering monster encountered during travel
    startEncounter(dungeon, true, party);
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

function buildEncounter(definition: ReturnType<typeof pickEncounter> extends infer T ? T : never, dungeon: DungeonState): DungeonEncounter {
  const qty = resolveQuantity(definition?.qty ?? "1");
  const hpMax = Math.max(1, Math.round((definition?.hd ?? 1) * 4.5 * qty)); // Average HP per HD
  
  return {
    id: createId(),
    name: definition?.name ?? "Unknown",
    quantity: definition?.qty ?? "1",
    hitDice: definition?.hd ?? 1,
    armorClass: definition?.ac ?? 9,
    damage: definition?.dmg ?? "1d6",
    morale: definition?.morale ?? 7,
    treasureType: definition?.treasure ?? "A",
    special: definition?.special,
    hp: hpMax,
    hpMax,
    reaction: "cautious", // Will be set by reaction roll
    distance: 0, // Will be set by encounter distance roll
    moraleChecked: {
      firstHit: false,
      quarterHp: false,
      firstDeath: false,
      halfIncapacitated: false,
    },
  };
}

function resolveQuantity(input: string): number {
  if (/^\d+d\d+$/i.test(input.trim())) {
    return rollFormula(input);
  }
  // Handle "1d6+4" type formulas
  if (/^\d+d\d+[+-]\d+$/i.test(input.trim())) {
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

// RC Unguarded Treasure Table (Chapter 17, Random Stocking)
// Used when RC Random Stocking indicates treasure in a room without monsters.
function generateUnguardedTreasureByLevel(level: number): { summary: string; totalGold: number } {
  // Determine the appropriate row based on dungeon level
  // 1; 2-3; 4-5; 6-7; 8+
  type Row =
    | { band: "1"; sp: () => number; gp: () => number; gpChance: number; gemChance: number; gemDice: string; jewelryChance: number; jewelryDice: string; magicChance: number; }
    | { band: "2-3" | "4-5" | "6-7" | "8+"; sp: () => number; gp: () => number; gemChance: number; gemDice: string; jewelryChance: number; jewelryDice: string; magicChance: number; };

  const rows: Row[] = [
    {
      band: "1",
      sp: () => rollFormula("1d6") * 100,
      gp: () => rollFormula("1d6") * 10,
      gpChance: 50,
      gemChance: 5,
      gemDice: "1d6",
      jewelryChance: 2,
      jewelryDice: "1d6",
      magicChance: 2,
    },
    {
      band: "2-3",
      sp: () => rollFormula("1d12") * 100,
      gp: () => rollFormula("1d6") * 100,
      gemChance: 10,
      gemDice: "1d6",
      jewelryChance: 5,
      jewelryDice: "1d6",
      magicChance: 8,
    },
    {
      band: "4-5",
      sp: () => rollFormula("1d6") * 1000,
      gp: () => rollFormula("1d6") * 200,
      gemChance: 20,
      gemDice: "1d8",
      jewelryChance: 10,
      jewelryDice: "1d8",
      magicChance: 10,
    },
    {
      band: "6-7",
      sp: () => rollFormula("1d6") * 2000,
      gp: () => rollFormula("1d6") * 500,
      gemChance: 30,
      gemDice: "1d10",
      jewelryChance: 15,
      jewelryDice: "1d10",
      magicChance: 15,
    },
    {
      band: "8+",
      sp: () => rollFormula("1d6") * 5000,
      gp: () => rollFormula("1d6") * 1000,
      gemChance: 40,
      gemDice: "1d12",
      jewelryChance: 20,
      jewelryDice: "1d12",
      magicChance: 20,
    },
  ];

  let row: Row;
  if (level <= 1) row = rows[0];
  else if (level <= 3) row = rows[1];
  else if (level <= 5) row = rows[2];
  else if (level <= 7) row = rows[3];
  else row = rows[4];

  const parts: string[] = [];
  let totalGold = 0;

  // Silver pieces are always present
  const spAmount = row.sp();
  parts.push(`${spAmount} sp`);
  totalGold += spAmount / 10; // RC: 10 sp = 1 gp

  // Gold pieces (where applicable)
  if (row.band === "1") {
    if (Math.random() * 100 < row.gpChance) {
      const gpAmount = row.gp();
      parts.push(`${gpAmount} gp`);
      totalGold += gpAmount;
    }
  } else {
    const gpAmount = row.gp();
    parts.push(`${gpAmount} gp`);
    totalGold += gpAmount;
  }

  // Gems
  if (Math.random() * 100 < row.gemChance) {
    const gemCount = rollFormula(row.gemDice);
    parts.push(`${gemCount}x gems`);
    // Match lair treasure abstraction: assume 50 gp per gem
    totalGold += gemCount * 50;
  }

  // Jewelry
  if (Math.random() * 100 < row.jewelryChance) {
    const jewelryCount = rollFormula(row.jewelryDice);
    parts.push(`${jewelryCount}x jewelry`);
    // Match lair treasure abstraction: assume 100 gp per jewelry
    totalGold += jewelryCount * 100;
  }

  // Magic item: "Any 1" from MAGIC_ITEMS.any
  if (Math.random() * 100 < row.magicChance) {
    const list = MAGIC_ITEMS.any ?? [];
    if (list.length > 0) {
      const pick = list[Math.floor(Math.random() * list.length)];
      parts.push(`Magic: ${pick}`);
    } else {
      parts.push("Magic: Any 1");
    }
  }

  if (parts.length === 0) {
    parts.push("No treasure found");
  }

  return { summary: parts.join("; "), totalGold };
}

// Look up a character's weapon damage based on their equipped weapon and the equipment tables
function getWeaponDamageFormulaForCharacter(character: any): string {
  const weaponName: string | undefined = character.equipment?.weapon;
  if (!weaponName) {
    return "1d6";
  }

  // Direct match by name for melee/missile weapons
  const direct = ALL_EQUIPMENT.find(
    (item) =>
      (item.category === "weapons_melee" || item.category === "weapons_missile") &&
      item.name === weaponName &&
      item.damage,
  );
  if (direct?.damage) {
    // Some weapons (e.g. Bastard Sword) have multiple damage entries separated by "/"
    const parts = direct.damage.split("/");
    return parts[0].trim();
  }

  const lower = weaponName.toLowerCase();
  const aliasMap: Record<string, string> = {
    sword: "Sword (Normal)",
    "long sword": "Sword (Normal)",
    "short sword": "Short Sword",
    mace: "Mace",
    dagger: "Dagger",
    "silver dagger": "Silver Dagger",
    staff: "Staff",
    spear: "Spear",
    club: "Club",
    "war hammer": "War Hammer",
    "hand axe": "Hand Axe",
    "battle axe": "Battle Axe",
    javelin: "Javelin",
    "two-handed sword": "Two-Handed Sword",
    // Mystics and similar unarmed fighters
    unarmed: "unarmed",
  };

  const aliasTarget = aliasMap[lower];
  if (aliasTarget === "unarmed") {
    // Simple unarmed damage approximation
    return "1d2";
  }

  if (aliasTarget) {
    const aliased = ALL_EQUIPMENT.find(
      (item) =>
        (item.category === "weapons_melee" || item.category === "weapons_missile") &&
        item.name === aliasTarget &&
        item.damage,
    );
    if (aliased?.damage) {
      const parts = aliased.damage.split("/");
      return parts[0].trim();
    }
  }

  // Fallback if we can't resolve the weapon
  return "1d6";
}

// Apply core BECMI-style special abilities for monsters on a successful hit
function applyMonsterSpecialEffectsOnHit(
  dungeon: typeof DEFAULT_STATE.dungeon,
  encounter: DungeonEncounter,
  target: any,
): void {
  if (!encounter.special) return;
  if (!target || target.status === "dead" || target.derivedStats?.hp?.current <= 0) return;

  const special = encounter.special.toLowerCase();
  const saves = target.derivedStats?.savingThrows;
  if (!saves) return;

  const name = target.name ?? "A party member";

  // Helper to roll a save and report
  const rollSave = (targetNumber: number, kind: string) => {
    const roll = rollDie(20);
    const success = roll >= targetNumber;
    return { roll, success, targetNumber, kind };
  };

  // Poison: save vs Death/Poison or die outright
  if (special.includes("poison")) {
    const saveInfo = rollSave(saves.deathPoison, "Death/Poison");
    if (!saveInfo.success) {
      target.derivedStats.hp.current = 0;
      target.status = "dead";
      addLogEntry(
        dungeon,
        "combat",
        `${name} is slain by poison!`,
        `Failed save vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
      );
      return;
    }
    addLogEntry(
      dungeon,
      "combat",
      `${name} resists the poison`,
      `Saved vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
    );
  }

  // Paralysis (ghouls, carrion crawlers, etc.)
  if (special.includes("paralysis")) {
    const saveInfo = rollSave(saves.paraStone, "Paralysis/Turn to Stone");
    if (!saveInfo.success) {
      target.status = "paralyzed";
      addLogEntry(
        dungeon,
        "combat",
        `${name} is paralyzed!`,
        `Failed save vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
      );
    } else {
      addLogEntry(
        dungeon,
        "combat",
        `${name} shrugs off paralysis`,
        `Saved vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
      );
    }
  }

  // Petrification (medusa, basilisk, cockatrice, etc.)
  if (special.includes("petrify") || special.includes("petrification") || special.includes("turns to stone")) {
    const saveInfo = rollSave(saves.paraStone, "Paralysis/Turn to Stone");
    if (!saveInfo.success) {
      target.derivedStats.hp.current = 0;
      target.status = "petrified";
      addLogEntry(
        dungeon,
        "combat",
        `${name} is turned to stone!`,
        `Failed save vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
      );
      return;
    }
    addLogEntry(
      dungeon,
      "combat",
      `${name} avoids petrification`,
      `Saved vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
    );
  }

  // Energy drain (wights, wraiths, spectres, vampires)
  if (special.includes("energy drain") || special.includes("energy-drain") || special.includes("level drain")) {
    const saveInfo = rollSave(saves.spells, "Spells (Energy Drain)");
    if (!saveInfo.success) {
      // For survivability modeling, treat full energy drain as effectively lethal
      target.derivedStats.hp.current = 0;
      target.status = "drained";
      addLogEntry(
        dungeon,
        "combat",
        `${name} is drained of life energy!`,
        `Failed save vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
      );
      return;
    }
    addLogEntry(
      dungeon,
      "combat",
      `${name} resists energy drain`,
      `Saved vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
    );
  }

  // Charm (harpies, vampires, devil swine, etc.)
  if (special.includes("charm")) {
    const saveInfo = rollSave(saves.spells, "Spells (Charm)");
    if (!saveInfo.success) {
      target.status = "charmed";
      addLogEntry(
        dungeon,
        "combat",
        `${name} is charmed!`,
        `Failed save vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
      );
    } else {
      addLogEntry(
        dungeon,
        "combat",
        `${name} resists charm`,
        `Saved vs ${saveInfo.kind} (rolled ${saveInfo.roll} vs ${saveInfo.targetNumber}).`,
      );
    }
  }
}

// BECMI Monster XP Table (simplified - base XP by HD, modified by special abilities)
function calculateMonsterXP(encounter: DungeonEncounter): number {
  const hd = encounter.hitDice;
  const quantity = resolveQuantity(encounter.quantity);

  // Base XP per HD (from BECMI monster XP table)
  const baseXpPerHd = [
    0,   // 0 HD
    10,  // 1 HD
    20,  // 2 HD
    35,  // 3 HD
    75,  // 4 HD
    175, // 5 HD
    350, // 6 HD
    700, // 7 HD
    1100, // 8 HD
    1600, // 9 HD
    2200, // 10 HD
    3000, // 11 HD
    4000, // 12 HD
    5000, // 13 HD
    6000, // 14 HD
    7500, // 15 HD
    9000, // 16 HD
    10500, // 17 HD
    12000, // 18 HD
    13500, // 19 HD
    15000, // 20 HD
  ];

  const baseXp = (baseXpPerHd[Math.min(hd, baseXpPerHd.length - 1)] || 15000);

  // Special abilities multiplier (asterisks in BECMI)
  let multiplier = 1;
  if (encounter.special) {
    // Count asterisks or special abilities
    const specialIndicators = (encounter.special.match(/\*/g) || []).length;
    if (specialIndicators > 0) {
      // Each asterisk roughly doubles XP value
      multiplier = Math.pow(2, specialIndicators);
    } else if (encounter.special.toLowerCase().includes('magic') ||
               encounter.special.toLowerCase().includes('spell') ||
               encounter.special.toLowerCase().includes('breath')) {
      multiplier = 2; // Special abilities typically double XP
    }
  }

  // Calculate total XP for all monsters of this type
  const totalXp = Math.floor(baseXp * multiplier * quantity);

  return Math.max(1, totalXp); // Minimum 1 XP
}

// Award XP to party members (BECMI: XP divided equally among surviving party members)
function awardXpToParty(party: any[], totalXp: number, monsterName: string) {
  const survivingMembers = party.filter(char => char.derivedStats.hp.current > 0);

  if (survivingMembers.length === 0) return;

  const xpPerMember = Math.floor(totalXp / survivingMembers.length);

  survivingMembers.forEach(char => {
    addXpToCharacter(char, xpPerMember);
  });
}

function normalizeDungeonState(raw: DungeonState | undefined): DungeonState {
  return {
    turn: raw?.turn ?? 0,
    depth: raw?.depth ?? 1,
    torches: raw?.torches ?? 0,
    torchTurnsUsed: raw?.torchTurnsUsed ?? 0,
    rations: raw?.rations ?? 0,
    loot: raw?.loot ?? 0,
    lairMode: raw?.lairMode ?? false,
    lighting: raw?.lighting ?? "dim",
    status: raw?.status ?? "idle",
    areaType: raw?.areaType ?? "room",
    intersectionKind: raw?.intersectionKind ?? null,
    roomContents: raw?.roomContents ?? "empty",
    roomHasTreasure: raw?.roomHasTreasure ?? false,
    roomTreasureClaimed: raw?.roomTreasureClaimed ?? false,
    encounter: raw?.encounter,
    obstacle: raw?.obstacle,
    roomSearched: raw?.roomSearched ?? false,
    log: raw?.log ?? [],
  };
}
