import { createId } from "../../utils/id";
import type { SiegeBattleLogEntry, SiegeForce, SiegeState, SiegeTactic } from "../../state/schema";
import { COMBAT_RESULTS, TACTIC_MATRIX } from "./constants";

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

  const classBonusUnit = Math.ceil(base / 10);
  let bonuses = 0;
  if (force.mounts) bonuses += 1;
  if (force.missiles) bonuses += 1;
  if (force.magic) bonuses += 1;
  if (force.flyers) bonuses += 1;
  const classBonus = classBonusUnit * bonuses;

  let siegeBonus = 0;
  siegeBonus += force.siegeEngines.ltCatapult * 4;
  siegeBonus += force.siegeEngines.hvCatapult * 8;
  siegeBonus += force.siegeEngines.ram * 4;
  siegeBonus += force.siegeEngines.tower * 10;
  if (role === "defender") {
    siegeBonus += force.siegeEngines.ballista * 2;
  }

  const total = base + classBonus + siegeBonus;
  return { base, classBonus, siegeBonus, total };
}

export function getTacticAdvantage(attacker: SiegeTactic, defender: SiegeTactic): number {
  return TACTIC_MATRIX[attacker][defender] ?? 0;
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

  const tacticMod = getTacticAdvantage(state.tactics.attacker, state.tactics.defender);
  attackerBR += tacticMod;
  defenderBR -= tacticMod;

  const { attacker: attMod, defender: defMod } = state.modifiers;
  if (attMod.terrain) attackerBR += 20;
  if (attMod.morale) attackerBR += 10;
  if (attMod.fatigue) attackerBR -= 10;
  if (attMod.intel) attackerBR += 10;
  if (attMod.traitor) attackerBR += 20;
  if (attMod.heroics) attackerBR += 10;

  if (defMod.terrain) defenderBR += 20;
  if (defMod.morale) defenderBR += 10;
  if (defMod.fatigue) defenderBR -= 10;
  if (defMod.intel) defenderBR += 10;
  if (defMod.heroics) defenderBR += 10;
  if (defMod.fortified) defenderBR += 10;

  const rollA = randomRange(1, 100);
  const rollB = randomRange(1, 100);

  const attackerTotal = attackerBR + rollA;
  const defenderTotal = defenderBR + rollB;
  const diff = Math.abs(attackerTotal - defenderTotal);

  const row = COMBAT_RESULTS.find((entry) => diff <= entry.max) ?? COMBAT_RESULTS[COMBAT_RESULTS.length - 1];
  const attackerWins = attackerTotal >= defenderTotal;

  let attackerCasPct = attackerWins ? row.wCas : row.lCas;
  let defenderCasPct = attackerWins ? row.lCas : row.wCas;

  if (defMod.fortified) {
    attackerCasPct = Math.floor(attackerCasPct / 2);
    defenderCasPct = Math.floor(defenderCasPct / 2);
  }

  const attackerLosses = Math.floor((attackerTroops * attackerCasPct) / 100);
  const defenderLosses = Math.floor((defenderTroops * defenderCasPct) / 100);

  const winnerName = attackerWins ? state.attacker.name : state.defender.name;
  const notes = attackerWins
    ? `${winnerName} holds ${row.wLoc}; ${state.defender.name} ${row.lLoc}. Rolls ${rollA}/${rollB}.`
    : `${winnerName} holds ${row.wLoc}; ${state.attacker.name} ${row.lLoc}. Rolls ${rollA}/${rollB}.`;

  const computation: BattleComputation = {
    attacker: attackerCalc,
    defender: defenderCalc,
    attackerTotal,
    defenderTotal,
    diff,
    attackerLosses,
    defenderLosses,
    winner: attackerWins ? "attacker" : "defender",
    notes,
    rollA,
    rollB,
  };

  const logEntry: SiegeBattleLogEntry = {
    id: createId(),
    timestamp: Date.now(),
    winner: winnerName,
    diff,
    attackerTotal,
    defenderTotal,
    attackerLosses,
    defenderLosses,
    notes,
    applied: false,
  };

  return { computation, logEntry };
}

function randomRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

