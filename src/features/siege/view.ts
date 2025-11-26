import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { SiegeBattleLogEntry, SiegeState } from "../../state/schema";
import { QUALITY_OPTIONS, TACTIC_OPTIONS } from "./constants";
import { calculateForceTotals, getTacticAdvantage } from "./logic";
import {
  applySiegeCasualties,
  clearSiegeLog,
  getSiegeState,
  rollBattle,
  subscribeToSiege,
  updateForceField,
  updateModifier,
  updateSiegeEngine,
  updateTactic,
} from "./state";

type ForceKey = "attacker" | "defender";

interface ForceControls {
  name: HTMLInputElement;
  troops: HTMLInputElement;
  leaderLevel: HTMLInputElement;
  leaderStatBonus: HTMLInputElement;
  percentNamed: HTMLInputElement;
  avgOfficerLevel: HTMLInputElement;
  avgTroopLevel: HTMLInputElement;
  victories: HTMLInputElement;
  trainingWeeks: HTMLInputElement;
  quality: HTMLSelectElement;
  ac5: HTMLInputElement;
  elfOrDwarf: HTMLInputElement;
  mounts: HTMLInputElement;
  missiles: HTMLInputElement;
  magic: HTMLInputElement;
  flyers: HTMLInputElement;
  siegeEngines: Record<"ltCatapult" | "hvCatapult" | "ram" | "tower" | "ballista", HTMLInputElement>;
  stats: {
    base: HTMLElement;
    classBonus: HTMLElement;
    siegeBonus: HTMLElement;
    total: HTMLElement;
  };
}

export function renderSiegePanel(target: HTMLElement) {
  const panel = createPanel("War Machine Combat", "Large-scale force resolution with BFR math and siege logic.");
  panel.body.classList.add("siege-grid");

  const forceColumn = document.createElement("div");
  forceColumn.className = "siege-column";
  const defenderColumn = document.createElement("div");
  defenderColumn.className = "siege-column";
  const battleColumn = document.createElement("div");
  battleColumn.className = "siege-column";

  panel.body.append(forceColumn, defenderColumn, battleColumn);
  target.appendChild(panel.element);

  const attackerCard = buildForceCard("Force A", "Attacker", "attacker", "pill-att");
  const defenderCard = buildForceCard("Force B", "Defender", "defender", "pill-def");
  forceColumn.appendChild(attackerCard.element);
  defenderColumn.appendChild(defenderCard.element);

  const battleCard = document.createElement("div");
  battleCard.className = "siege-card";
  battleColumn.appendChild(battleCard);

  const tacticsHeader = document.createElement("div");
  tacticsHeader.className = "section-title";
  tacticsHeader.textContent = "Battle Resolution";
  battleCard.appendChild(tacticsHeader);

  const tacticsContainer = document.createElement("div");
  tacticsContainer.className = "siege-tactics";

  const attackerTacticSelect = createSelect(TACTIC_OPTIONS, (value) => updateTactic("attacker", value));
  const defenderTacticSelect = createSelect(TACTIC_OPTIONS, (value) => updateTactic("defender", value));

  tacticsContainer.append(
    createField("Attacker Tactic", attackerTacticSelect),
    createField("Defender Tactic", defenderTacticSelect),
  );
  battleCard.appendChild(tacticsContainer);

  const tacticAdvantage = document.createElement("div");
  tacticAdvantage.className = "siege-tactic-advantage";
  battleCard.appendChild(tacticAdvantage);

  battleCard.appendChild(buildModifiersSection("Attacker Modifiers", "attacker", [
    { key: "terrain", label: "Better Terrain (+20)" },
    { key: "morale", label: "High Morale (+10)" },
    { key: "fatigue", label: "Fatigued (-10)", negative: true },
    { key: "intel", label: "Good Intel (+10)" },
    { key: "traitor", label: "Traitor in Walls (+20)" },
    { key: "heroics", label: "PC Heroics (+10)" },
  ]));

  battleCard.appendChild(buildModifiersSection("Defender Modifiers", "defender", [
    { key: "fortified", label: "Fortified (Size x4, +10)" },
    { key: "terrain", label: "Better Terrain (+20)" },
    { key: "morale", label: "High Morale (+10)" },
    { key: "fatigue", label: "Fatigued (-10)", negative: true },
    { key: "intel", label: "Good Intel (+10)" },
    { key: "heroics", label: "PC Heroics (+10)" },
  ]));

  const actionRow = document.createElement("div");
  actionRow.className = "siege-action-row";
  const resolveBtn = document.createElement("button");
  resolveBtn.type = "button";
  resolveBtn.className = "button";
  resolveBtn.textContent = "Roll Battle";
  resolveBtn.addEventListener("click", () => {
    const entry = rollBattle();
    showNotification({
      title: `${entry.winner} wins`,
      message: `Casualties — Attacker ${entry.attackerLosses}, Defender ${entry.defenderLosses}`,
      variant: "success",
    });
  });

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "button danger";
  clearBtn.textContent = "Clear Log";
  clearBtn.addEventListener("click", () => {
    if (window.confirm("Clear battle log?")) {
      clearSiegeLog();
    }
  });

  actionRow.append(resolveBtn, clearBtn);
  battleCard.appendChild(actionRow);

  const logCard = document.createElement("div");
  logCard.className = "siege-card";
  const logHeader = document.createElement("div");
  logHeader.className = "section-title";
  logHeader.textContent = "Battle Log";
  const logList = document.createElement("div");
  logList.className = "siege-log";
  logCard.append(logHeader, logList);
  battleColumn.appendChild(logCard);

  function render(state: SiegeState) {
    syncForceCard(attackerCard.controls, state.attacker);
    syncForceCard(defenderCard.controls, state.defender);
    const attackerTotals = calculateForceTotals(state.attacker, "attacker");
    const defenderTotals = calculateForceTotals(state.defender, "defender");
    updateStats(attackerCard.controls, attackerTotals);
    updateStats(defenderCard.controls, defenderTotals);
    attackerTacticSelect.value = state.tactics.attacker;
    defenderTacticSelect.value = state.tactics.defender;
    tacticAdvantage.textContent = formatAdvantage(state.tactics.attacker, state.tactics.defender);
    syncModifiers(state);
    renderLog(state.log);
  }

  const unsubscribe = subscribeToSiege(render);
  render(getSiegeState());

  return () => unsubscribe();

  function buildForceCard(title: string, label: string, key: ForceKey, badgeClass: string) {
    const card = document.createElement("div");
    card.className = "siege-card";

    const header = document.createElement("div");
    header.className = "siege-card-header";
    const heading = document.createElement("span");
    heading.className = "siege-card-title";
    heading.textContent = title;
    const badge = document.createElement("span");
    badge.className = `siege-pill ${badgeClass}`;
    badge.textContent = label;
    header.append(heading, badge);
    card.appendChild(header);

    const nameInput = createInput("text", (value) => updateForceField(key, "name", value));
    const troopsInput = createNumberInput((value) => updateForceField(key, "troops", value));
    troopsInput.min = "0";

    card.appendChild(createField("Name", nameInput));
    card.appendChild(createField("Troops", troopsInput));

    const leadershipDetails = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Leadership & Experience";
    leadershipDetails.appendChild(summary);
    const detailBody = document.createElement("div");
    detailBody.className = "siege-details-body";
    leadershipDetails.appendChild(detailBody);
    card.appendChild(leadershipDetails);

    const leaderLevel = createNumberInput((value) => updateForceField(key, "leaderLevel", value));
    const leaderStat = createNumberInput((value) => updateForceField(key, "leaderStatBonus", value));
    const percentNamed = createNumberInput((value) => updateForceField(key, "percentNamed", value));
    const avgOfficer = createNumberInput((value) => updateForceField(key, "avgOfficerLevel", value));
    const avgTroop = createNumberInput((value) => updateForceField(key, "avgTroopLevel", value));
    const victories = createNumberInput((value) => updateForceField(key, "victories", value));
    detailBody.append(
      createRow([createField("Leader Level", leaderLevel), createField("Stat Adj.", leaderStat)]),
      createRow([createField("% Named Lvls", percentNamed), createField("Avg Off Level", avgOfficer)]),
      createRow([createField("Avg Troop Level", avgTroop), createField("Victories", victories)]),
    );

    const trainingDetails = document.createElement("details");
    const summaryTrain = document.createElement("summary");
    summaryTrain.textContent = "Training & Equipment";
    trainingDetails.appendChild(summaryTrain);
    const trainBody = document.createElement("div");
    trainBody.className = "siege-details-body";
    trainingDetails.appendChild(trainBody);
    const trainingWeeks = createNumberInput((value) => updateForceField(key, "trainingWeeks", value));
    const qualitySelect = document.createElement("select");
    qualitySelect.className = "input";
    QUALITY_OPTIONS.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = String(option.value);
      opt.textContent = option.label;
      qualitySelect.appendChild(opt);
    });
    qualitySelect.addEventListener("change", () => updateForceField(key, "quality", Number(qualitySelect.value) as any));

    trainBody.append(
      createRow([createField("Weeks Training", trainingWeeks), createField("Quality", qualitySelect)]),
    );

    const checkboxGrid = document.createElement("div");
    checkboxGrid.className = "siege-checkbox-grid";
    const toggles: Array<{ label: string; field: keyof SiegeForce }> = [
      { label: "AC ≤ 5 (+5)", field: "ac5" },
      { label: "Elf / Dwarf (+15)", field: "elfOrDwarf" },
      { label: ">20% Mounted", field: "mounts" },
      { label: ">20% Missile", field: "missiles" },
      { label: ">1% Magic", field: "magic" },
      { label: "Flyers / Specials", field: "flyers" },
    ];
    const checkboxControls: Record<string, HTMLInputElement> = {};
    toggles.forEach((toggle) => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.addEventListener("change", () => updateForceField(key, toggle.field, input.checked as any));
      checkboxControls[toggle.field] = input;
      const labelEl = document.createElement("label");
      labelEl.className = "siege-checkbox";
      labelEl.append(input, document.createTextNode(toggle.label));
      checkboxGrid.appendChild(labelEl);
    });
    trainBody.appendChild(checkboxGrid);
    card.appendChild(trainingDetails);

    const engineDetails = document.createElement("details");
    const engineSummary = document.createElement("summary");
    engineSummary.textContent = "Siege Engines";
    engineDetails.appendChild(engineSummary);
    const engineBody = document.createElement("div");
    engineBody.className = "siege-details-body";
    engineDetails.appendChild(engineBody);
    card.appendChild(engineDetails);

    const engineFields: Record<"ltCatapult" | "hvCatapult" | "ram" | "tower" | "ballista", HTMLInputElement> = {
      ltCatapult: createNumberInput((value) => updateSiegeEngine(key, "ltCatapult", value)),
      hvCatapult: createNumberInput((value) => updateSiegeEngine(key, "hvCatapult", value)),
      ram: createNumberInput((value) => updateSiegeEngine(key, "ram", value)),
      tower: createNumberInput((value) => updateSiegeEngine(key, "tower", value)),
      ballista: createNumberInput((value) => updateSiegeEngine(key, "ballista", value)),
    };
    engineBody.append(
      createRow([createField("Lt. Catapult", engineFields.ltCatapult), createField("Hv. Catapult", engineFields.hvCatapult)]),
      createRow([createField("Ram/Bore", engineFields.ram), createField("Tower", engineFields.tower)]),
      createField("Ballista", engineFields.ballista),
    );

    const statBox = document.createElement("div");
    statBox.className = "siege-stat-box";
    const baseStat = createStatRow("BFR Score");
    const classStat = createStatRow("Class Bonus");
    const siegeStat = createStatRow("Siege Bonus");
    const totalStat = createStatRow("Total BR");
    statBox.append(baseStat.row, classStat.row, siegeStat.row, totalStat.row);
    card.appendChild(statBox);

    const controls: ForceControls = {
      name: nameInput,
      troops: troopsInput,
      leaderLevel,
      leaderStatBonus: leaderStat,
      percentNamed,
      avgOfficerLevel: avgOfficer,
      avgTroopLevel: avgTroop,
      victories,
      trainingWeeks,
      quality: qualitySelect,
      ac5: checkboxControls.ac5,
      elfOrDwarf: checkboxControls.elfOrDwarf,
      mounts: checkboxControls.mounts,
      missiles: checkboxControls.missiles,
      magic: checkboxControls.magic,
      flyers: checkboxControls.flyers,
      siegeEngines: engineFields,
      stats: {
        base: baseStat.value,
        classBonus: classStat.value,
        siegeBonus: siegeStat.value,
        total: totalStat.value,
      },
    };

    return { element: card, controls };
  }

  function buildModifiersSection(title: string, side: "attacker" | "defender", options: Array<{ key: string; label: string }>) {
    const wrapper = document.createElement("div");
    wrapper.className = "siege-modifiers";
    const heading = document.createElement("div");
    heading.className = "control-title";
    heading.textContent = title;
    wrapper.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "siege-checkbox-grid";
    options.forEach((option) => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.addEventListener("change", () => updateModifier(side, option.key as any, input.checked));
      const label = document.createElement("label");
      label.className = "siege-checkbox";
      label.append(input, document.createTextNode(option.label));
      (label as any).dataset.modKey = option.key;
      (label as any).dataset.side = side;
      grid.appendChild(label);
    });
    wrapper.appendChild(grid);
    return wrapper;
  }

  function renderLog(entries: SiegeBattleLogEntry[]) {
    logList.innerHTML = "";
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Battle results will appear here.";
      logList.appendChild(empty);
      return;
    }
    entries.forEach((entry) => {
      const card = document.createElement("div");
      card.className = "siege-log-entry";

      const header = document.createElement("div");
      header.className = "siege-log-header";
      const title = document.createElement("strong");
      title.textContent = `${entry.winner} Wins`;
      const diff = document.createElement("span");
      diff.className = "siege-log-diff";
      diff.textContent = `Diff ${entry.diff}`;
      header.append(title, diff);

      const totals = document.createElement("div");
      totals.className = "siege-log-totals";
      totals.innerHTML = `Att ${entry.attackerTotal} · Def ${entry.defenderTotal}`;

      const losses = document.createElement("div");
      losses.className = "siege-log-losses";
      losses.textContent = `Losses — Att ${entry.attackerLosses}, Def ${entry.defenderLosses}`;

      const notes = document.createElement("p");
      notes.className = "siege-log-notes";
      notes.textContent = entry.notes;

      const actions = document.createElement("div");
      actions.className = "siege-log-actions";
      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "button";
      applyBtn.textContent = entry.applied ? "Applied" : "Apply Casualties";
      applyBtn.disabled = entry.applied;
      applyBtn.addEventListener("click", () => applySiegeCasualties(entry.id));
      actions.appendChild(applyBtn);

      card.append(header, totals, losses, notes, actions);
      logList.appendChild(card);
    });
  }

  function syncForceCard(controls: ForceControls, force: SiegeState["attacker"]) {
    controls.name.value = force.name;
    controls.troops.value = String(force.troops);
    controls.leaderLevel.value = String(force.leaderLevel);
    controls.leaderStatBonus.value = String(force.leaderStatBonus);
    controls.percentNamed.value = String(force.percentNamed);
    controls.avgOfficerLevel.value = String(force.avgOfficerLevel);
    controls.avgTroopLevel.value = String(force.avgTroopLevel);
    controls.victories.value = String(force.victories);
    controls.trainingWeeks.value = String(force.trainingWeeks);
    controls.quality.value = String(force.quality);
    controls.ac5.checked = force.ac5;
    controls.elfOrDwarf.checked = force.elfOrDwarf;
    controls.mounts.checked = force.mounts;
    controls.missiles.checked = force.missiles;
    controls.magic.checked = force.magic;
    controls.flyers.checked = force.flyers;
    controls.siegeEngines.ltCatapult.value = String(force.siegeEngines.ltCatapult);
    controls.siegeEngines.hvCatapult.value = String(force.siegeEngines.hvCatapult);
    controls.siegeEngines.ram.value = String(force.siegeEngines.ram);
    controls.siegeEngines.tower.value = String(force.siegeEngines.tower);
    controls.siegeEngines.ballista.value = String(force.siegeEngines.ballista);
  }

  function updateStats(controls: ForceControls, totals: ReturnType<typeof calculateForceTotals>) {
    controls.stats.base.textContent = String(totals.base);
    controls.stats.classBonus.textContent = String(totals.classBonus);
    controls.stats.siegeBonus.textContent = String(totals.siegeBonus);
    controls.stats.total.textContent = String(totals.total);
  }

  function syncModifiers(state: SiegeState) {
    const labels = battleCard.querySelectorAll<HTMLLabelElement>(".siege-checkbox");
    labels.forEach((label) => {
      const side = label.dataset.side as "attacker" | "defender";
      const key = label.dataset.modKey as keyof SiegeState["modifiers"]["attacker"] & keyof SiegeState["modifiers"]["defender"];
      const input = label.querySelector("input") as HTMLInputElement | null;
      if (!input) return;
      input.checked = Boolean((state.modifiers as any)[side][key]);
    });
  }

  function formatAdvantage(att: string, def: string) {
    const mod = getTacticAdvantage(att as any, def as any);
    if (mod > 0) return `Attacker advantage (+${mod})`;
    if (mod < 0) return `Defender advantage (+${Math.abs(mod)})`;
    return "No tactical advantage";
  }
}

function createInput(type: "text" | "number", onChange: (value: any) => void) {
  const input = document.createElement("input");
  input.type = type;
  input.className = "input";
  input.addEventListener("change", () => onChange(input.value));
  return input;
}

function createNumberInput(onChange: (value: number) => void) {
  const input = document.createElement("input");
  input.type = "number";
  input.className = "input";
  input.addEventListener("change", () => onChange(Number(input.value) || 0));
  return input;
}

function createSelect<T extends { value: any; label: string }>(options: T[], onChange: (value: any) => void) {
  const select = document.createElement("select");
  select.className = "input";
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function createField(labelText: string, control: HTMLElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "siege-field";
  const label = document.createElement("label");
  label.className = "label";
  label.textContent = labelText;
  wrapper.append(label, control);
  return wrapper;
}

function createRow(children: HTMLElement[]) {
  const row = document.createElement("div");
  row.className = "siege-row";
  children.forEach((child) => row.appendChild(child));
  return row;
}

function createStatRow(label: string) {
  const row = document.createElement("div");
  row.className = "siege-stat-row";
  const lbl = document.createElement("span");
  lbl.textContent = label;
  const value = document.createElement("strong");
  value.textContent = "0";
  row.append(lbl, value);
  return { row, value };
}

