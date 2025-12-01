import { createId } from "../../utils/id";
import type { SiegeBattleLogEntry, SiegeForce, SiegeState, SiegeTactic, FatigueLevel } from "../../state/schema";
import { COMBAT_RESULTS, SIEGE_TACTIC_BR_BONUSES } from "./constants";

export interface ForceCalculation {
  base: number;
  classBonus: number;
  siegeBonus: number;
  total: number;
}

export interface BattleComputation {
  attacker: ForceCalculation;
  defender: ForceCalculation;
  attackerTotal: number;
  defenderTotal: number;
  diff: number;
  attackerLosses: number;
  defenderLosses: number;
  winner: "attacker" | "defender";
  notes: string;
  rollA: number;
  rollB: number;
}

export function calculateForceTotals(force: SiegeForce, role: "attacker" | "defender"): ForceCalculation {
  let base =
    force.leaderLevel +
    force.leaderStatBonus +
    force.percentNamed * 2 +
    force.avgOfficerLevel * 3 +
    force.avgTroopLevel * 2 +
    force.victories +
    force.trainingWeeks +
    5 +
    force.quality;

  if (force.ac5) base += 5;
  if (force.elfOrDwarf) base += 15;

  // Apply fatigue penalties
  if (force.fatigue === "moderate") base -= 10;
  if (force.fatigue === "serious") base -= 30;

  const classBonusUnit = Math.ceil(base / 10);
  let bonuses = 0;
  if (force.mounts) bonuses += 1;
  if (force.missiles) bonuses += 1;
  if (force.magic) bonuses += 1;
  if (force.flyers) bonuses += 1;
  const classBonus = classBonusUnit * bonuses;

  let siegeBonus = 0;
  // Artillery bonuses (applied based on tactic)
  siegeBonus += force.siegeEngines.ltCatapult * 4;
  siegeBonus += force.siegeEngines.hvCatapult * 8;

  // Ballista bonuses (defender only)
  if (role === "defender") {
    siegeBonus += force.siegeEngines.ballista * 2;
  }

  // Other siege equipment bonuses
  siegeBonus += force.siegeEngines.ram * 4;
  siegeBonus += force.siegeEngines.tower * 10;
  siegeBonus += force.siegeEngines.belfry * 10;
  siegeBonus += force.siegeEngines.hoist * 4;

  // Timber forts and mantlets (scaling bonuses based on ratio per troops)
  const timberFortBonus = Math.min(force.siegeEngines.timberFort, Math.floor(force.troops / 100)) * 4;
  const mantletBonus = Math.min(force.siegeEngines.mantlet, Math.floor(force.troops / 100)) * 2;
  siegeBonus += timberFortBonus + mantletBonus;

  // Ladders and galleries (scaling bonuses)
  const ladderBonus = Math.min(force.siegeEngines.ladder, Math.floor(force.troops / 1000)) * 2;
  siegeBonus += ladderBonus;

  // Gallery doubles ram effectiveness
  if (force.siegeEngines.gallery > 0 && force.siegeEngines.ram > 0) {
    siegeBonus += force.siegeEngines.ram * 4; // Additional bonus for ram with gallery
  }

  const total = base + classBonus + siegeBonus;
  return { base, classBonus, siegeBonus, total };
}

export function getSiegeTacticBRBonus(tactic: SiegeTactic, isAttacker: boolean): number {
  const bonuses = SIEGE_TACTIC_BR_BONUSES[tactic];
  return isAttacker ? bonuses.attacker : bonuses.defender;
}

// Siege-specific battle resolution functions
export function resolveBombardBattle(attackerBR: number, defenderBR: number): { attackerCasualties: number; defenderCasualties: number; notes: string } {
  // Bombard: Artillery duel - 1d10 for attacker, 2d10 for defender
  const attackerRoll = randomRange(1, 10);
  const defenderRoll = randomRange(1, 10) + randomRange(1, 10);

  const attackerCasualties = Math.floor((attackerBR * attackerRoll) / 100);
  const defenderCasualties = Math.floor((defenderBR * defenderRoll) / 100);

  return {
    attackerCasualties,
    defenderCasualties,
    notes: `Bombard: Attacker roll ${attackerRoll} (${attackerCasualties} casualties), Defender roll ${defenderRoll} (${defenderCasualties} casualties)`
  };
}

export function resolveHarassBattle(attackerBR: number, defenderBR: number, attackerRoll: number, defenderRoll: number): { attackerCasualties: number; defenderCasualties: number; notes: string } {
  // Harass: Standard War Machine combat with siege modifiers
  const diff = Math.abs(attackerBR + attackerRoll - (defenderBR + defenderRoll));
  const row = COMBAT_RESULTS.find((entry) => diff <= entry.max) ?? COMBAT_RESULTS[COMBAT_RESULTS.length - 1];

  const attackerWins = (attackerBR + attackerRoll) >= (defenderBR + defenderRoll);
  let attackerCasPct = attackerWins ? row.wCas : row.lCas;
  let defenderCasPct = attackerWins ? row.lCas : row.wCas;

  // Siege modifications: casualties are 1/10 normal, defender casualties halved
  attackerCasPct = Math.floor(attackerCasPct / 10);
  defenderCasPct = Math.floor(defenderCasPct / 20); // Half of normal, then halved again = 1/4

  return {
    attackerCasualties: Math.floor(attackerCasPct * 100 / 100), // Placeholder for actual troop count
    defenderCasualties: Math.floor(defenderCasPct * 100 / 100),
    notes: `Harass: ${attackerWins ? 'Attacker' : 'Defender'} wins (${diff} diff, rolls ${attackerRoll}/${defenderRoll})`
  };
}

export function resolveAssaultBattle(attackerBR: number, defenderBR: number, attackerRoll: number, defenderRoll: number): { attackerCasualties: number; defenderCasualties: number; notes: string } {
  // Assault: Standard combat with halved casualties
  const diff = Math.abs(attackerBR + attackerRoll - (defenderBR + defenderRoll));
  const row = COMBAT_RESULTS.find((entry) => diff <= entry.max) ?? COMBAT_RESULTS[COMBAT_RESULTS.length - 1];

  const attackerWins = (attackerBR + attackerRoll) >= (defenderBR + defenderRoll);
  let attackerCasPct = attackerWins ? row.wCas : row.lCas;
  let defenderCasPct = attackerWins ? row.lCas : row.wCas;

  // Assault modifications: all casualties halved, defender casualties halved again
  attackerCasPct = Math.floor(attackerCasPct / 2);
  defenderCasPct = Math.floor(defenderCasPct / 4);

  return {
    attackerCasualties: Math.floor(attackerCasPct * 100 / 100),
    defenderCasualties: Math.floor(defenderCasPct * 100 / 100),
    notes: `Assault: ${attackerWins ? 'Attacker' : 'Defender'} wins (${diff} diff, rolls ${attackerRoll}/${defenderRoll})`
  };
}

export function resolveBattle(state: SiegeState): { computation: BattleComputation; logEntry: SiegeBattleLogEntry } {
  const attackerCalc = calculateForceTotals(state.attacker, "attacker");
  const defenderCalc = calculateForceTotals(state.defender, "defender");

  let attackerBR = attackerCalc.total;
  let defenderBR = defenderCalc.total;

  const attackerTroops = Math.max(0, state.attacker.troops);
  const defenderTroops = Math.max(0, state.defender.troops);
  let effectiveDefTroops = defenderTroops;
  if (state.modifiers.defender.fortified) {
    effectiveDefTroops *= 4;
  }

  // Troop ratio bonuses
  if (attackerTroops > 0 && defenderTroops > 0) {
    const ratio = attackerTroops > effectiveDefTroops ? attackerTroops / effectiveDefTroops : effectiveDefTroops / attackerTroops;
    let ratioBonus = 0;
    if (ratio >= 1.5) ratioBonus = 10;
    if (ratio >= 2) ratioBonus = 20;
    if (ratio >= 3) ratioBonus = 30;
    if (ratio >= 4) ratioBonus = 40;
    if (ratio >= 8) ratioBonus = 50;
    if (attackerTroops > effectiveDefTroops) attackerBR += ratioBonus;
    else defenderBR += ratioBonus;
  }

  // Siege tactic BR bonuses (replaces tactical advantage)
  attackerBR += getSiegeTacticBRBonus(state.tactics.attacker, true);
  defenderBR += getSiegeTacticBRBonus(state.tactics.defender, false);

  // Siege modifiers (different from standard War Machine)
  const { attacker: attMod, defender: defMod } = state.modifiers;
  if (attMod.terrain) attackerBR += 20;
  if (attMod.morale) attackerBR += 10;
  if (attMod.intel) attackerBR += 10;
  if (attMod.traitor) attackerBR += 20;
  if (attMod.heroics) attackerBR += 10;

  if (defMod.terrain) defenderBR += 20;
  if (defMod.morale) defenderBR += 10;
  if (defMod.intel) defenderBR += 10;
  if (defMod.heroics) defenderBR += 10;
  if (defMod.fortified) defenderBR += 10;

  // Fatigue modifiers are now handled in calculateForceTotals
  // Siege-specific battle resolution based on attacker's tactic
  let battleResult;
  const rollA = randomRange(1, 100);
  const rollB = randomRange(1, 100);

  switch (state.tactics.attacker) {
    case "depart":
      // Attacker leaves the siege
      battleResult = {
        attackerCasualties: 0,
        defenderCasualties: 0,
        notes: `${state.attacker.name} departs from the siege.`
      };
      break;

    case "bombard":
      // Artillery duel
      battleResult = resolveBombardBattle(attackerBR, defenderBR);
      break;

    case "harass":
      // Standard siege combat
      battleResult = resolveHarassBattle(attackerBR, defenderBR, rollA, rollB);
      break;

    case "assault":
      // Full assault
      battleResult = resolveAssaultBattle(attackerBR, defenderBR, rollA, rollB);
      break;

    default:
      // Fallback to harass
      battleResult = resolveHarassBattle(attackerBR, defenderBR, rollA, rollB);
  }

  // Calculate actual casualties based on troop counts
  const attackerLosses = Math.floor((attackerTroops * battleResult.attackerCasualties) / 100);
  const defenderLosses = Math.floor((defenderTroops * battleResult.defenderCasualties) / 100);

  // Determine winner (for logging purposes)
  const attackerTotal = attackerBR + rollA;
  const defenderTotal = defenderBR + rollB;
  const winnerName = attackerTotal >= defenderTotal ? state.attacker.name : state.defender.name;

  const computation: BattleComputation = {
    attacker: attackerCalc,
    defender: defenderCalc,
    attackerTotal,
    defenderTotal,
    diff: Math.abs(attackerTotal - defenderTotal),
    attackerLosses,
    defenderLosses,
    winner: attackerTotal >= defenderTotal ? "attacker" : "defender",
    notes: battleResult.notes,
    rollA,
    rollB,
  };

  const logEntry: SiegeBattleLogEntry = {
    id: createId(),
    timestamp: Date.now(),
    winner: winnerName,
    diff: computation.diff,
    attackerTotal,
    defenderTotal,
    attackerLosses,
    defenderLosses,
    notes: battleResult.notes,
    applied: false,
    recoveryTrackerId: null,
    recoveryReady: true,
    recoveryDays: 0,
  };

  return { computation, logEntry };
}

function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

