import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { SiegeBattleLogEntry, SiegeState } from "../../state/schema";
import { QUALITY_OPTIONS, TACTIC_OPTIONS } from "./constants";
import { calculateForceTotals } from "./logic";
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
  updateForceFatigue,
  updateForceTreasury,
  updateForceAmmunition,
  updateForceRations,
  updateForceClerics,
  advanceSiegeTurn,
  exportSiegeData,
  importSiegeData,
} from "./state";
import { getModuleExportFilename, triggerDownload } from "../../utils/moduleExport";

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
  fatigue: HTMLSelectElement;
  treasury: HTMLInputElement;
  rations: HTMLInputElement;
  clerics: HTMLInputElement;
  ammunition: Record<"ltCatapult" | "hvCatapult" | "ballista", HTMLInputElement>;
  siegeEngines: Record<"ltCatapult" | "hvCatapult" | "ram" | "tower" | "ballista" | "timberFort" | "mantlet" | "ladder" | "hoist" | "belfry" | "gallery", HTMLInputElement>;
  stats: {
    base: HTMLElement;
    classBonus: HTMLElement;
    siegeBonus: HTMLElement;
    total: HTMLElement;
  };
}

export function renderSiegePanel(target: HTMLElement) {
  const panel = createPanel("Siege", "Resolve large-scale battles using War Machine rules");
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

  const turnHeader = document.createElement("div");
  turnHeader.className = "section-title";
  turnHeader.textContent = "Siege Turn";
  battleCard.appendChild(turnHeader);

  const turnInfo = document.createElement("div");
  turnInfo.className = "siege-turn-info";
  battleCard.appendChild(turnInfo);

  const fortificationHeader = document.createElement("div");
  fortificationHeader.className = "section-title";
  fortificationHeader.textContent = "Fortification";
  battleCard.appendChild(fortificationHeader);

  const fortificationInfo = document.createElement("div");
  fortificationInfo.className = "siege-fortification-info";
  battleCard.appendChild(fortificationInfo);

  const turnControls = document.createElement("div");
  turnControls.className = "siege-turn-controls";
  battleCard.appendChild(turnControls);

  const advanceTurnBtn = document.createElement("button");
  advanceTurnBtn.type = "button";
  advanceTurnBtn.className = "button";
  advanceTurnBtn.textContent = "Advance Turn";
  advanceTurnBtn.addEventListener("click", () => {
    advanceSiegeTurn();
    showNotification({
      title: "Turn Advanced",
      message: "Weekly costs deducted, ammunition gathered.",
      variant: "info",
    });
  });

  turnControls.appendChild(advanceTurnBtn);

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

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "button";
  exportBtn.textContent = "Export";
  exportBtn.addEventListener("click", () => {
    const payload = exportSiegeData();
    triggerDownload(getModuleExportFilename("siege"), payload);
  });

  const importBtn = document.createElement("button");
  importBtn.type = "button";
  importBtn.className = "button";
  importBtn.textContent = "Import";

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.className = "visually-hidden";
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        importSiegeData(text);
        showNotification({
          title: "Siege imported",
          message: "Data loaded successfully.",
          variant: "success",
        });
      } catch (err) {
        showNotification({
          title: "Import failed",
          message: (err as Error).message,
          variant: "danger",
        });
      }
    }).finally(() => {
      importInput.value = "";
    });
  });
  importBtn.addEventListener("click", () => importInput.click());

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "button danger";
  clearBtn.textContent = "Clear Log";
  clearBtn.addEventListener("click", () => {
    if (window.confirm("Clear battle log?")) {
      clearSiegeLog();
    }
  });

  actionRow.append(resolveBtn, exportBtn, importBtn, importInput, clearBtn);
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

    // Update turn information
    turnInfo.innerHTML = `
      <div class="siege-turn-display">
        <strong>Week ${state.turn.week}</strong> - Phase: ${state.turn.phase}
        ${state.turn.hasResolved ? '(Resolved)' : '(Pending)'}
      </div>
    `;

    // Update fortification information
    const fort = state.fortification;
    fortificationInfo.innerHTML = `
      <div class="siege-fort-display">
        <div><strong>${fort.name}</strong></div>
        <div>Walls: ${fort.walls.hp}/${fort.walls.maxHp} HP (${fort.walls.length}' × ${fort.walls.height}' × ${fort.walls.thickness}' thick)</div>
        <div>Towers: ${fort.towers.hp}/${fort.towers.maxHp} HP (${fort.towers.count} towers)</div>
        <div>Gates: ${fort.gates.hp}/${fort.gates.maxHp} HP (${fort.gates.count} gates)</div>
        <div>Features: ${fort.moat ? 'Moat' : 'No moat'}, ${fort.drawbridge ? 'Drawbridge' : 'No drawbridge'}</div>
      </div>
    `;

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

    const fatigueSelect = document.createElement("select");
    fatigueSelect.className = "input";
    const fatigueOptions = [
      { value: "none", label: "No Fatigue" },
      { value: "moderate", label: "Moderate Fatigue (-10)" },
      { value: "serious", label: "Serious Fatigue (-30)" },
    ];
    fatigueOptions.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      fatigueSelect.appendChild(opt);
    });
    fatigueSelect.addEventListener("change", () => updateForceFatigue(key, fatigueSelect.value as any));

    trainBody.append(
      createRow([createField("Weeks Training", trainingWeeks), createField("Quality", qualitySelect)]),
      createRow([createField("Fatigue", fatigueSelect)]),
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

    const accountingDetails = document.createElement("details");
    const accountingSummary = document.createElement("summary");
    accountingSummary.textContent = "Siege Accounting";
    accountingDetails.appendChild(accountingSummary);
    const accountingBody = document.createElement("div");
    accountingBody.className = "siege-details-body";
    accountingDetails.appendChild(accountingBody);
    card.appendChild(accountingDetails);

    const treasuryInput = createNumberInput((value) => updateForceTreasury(key, value));
    const rationsInput = createNumberInput((value) => updateForceRations(key, value));
    const clericsInput = createNumberInput((value) => updateForceClerics(key, value));

    accountingBody.append(
      createRow([createField("Treasury (gp)", treasuryInput), createField("Rations", rationsInput)]),
      createRow([createField("Clerics", clericsInput)]),
    );

    const engineDetails = document.createElement("details");
    const engineSummary = document.createElement("summary");
    engineSummary.textContent = "Siege Engines";
    engineDetails.appendChild(engineSummary);
    const engineBody = document.createElement("div");
    engineBody.className = "siege-details-body";
    engineDetails.appendChild(engineBody);
    card.appendChild(engineDetails);

    const engineFields: Record<"ltCatapult" | "hvCatapult" | "ram" | "tower" | "ballista" | "timberFort" | "mantlet" | "ladder" | "hoist" | "belfry" | "gallery", HTMLInputElement> = {
      ltCatapult: createNumberInput((value) => updateSiegeEngine(key, "ltCatapult", value)),
      hvCatapult: createNumberInput((value) => updateSiegeEngine(key, "hvCatapult", value)),
      ram: createNumberInput((value) => updateSiegeEngine(key, "ram", value)),
      tower: createNumberInput((value) => updateSiegeEngine(key, "tower", value)),
      ballista: createNumberInput((value) => updateSiegeEngine(key, "ballista", value)),
      timberFort: createNumberInput((value) => updateSiegeEngine(key, "timberFort", value)),
      mantlet: createNumberInput((value) => updateSiegeEngine(key, "mantlet", value)),
      ladder: createNumberInput((value) => updateSiegeEngine(key, "ladder", value)),
      hoist: createNumberInput((value) => updateSiegeEngine(key, "hoist", value)),
      belfry: createNumberInput((value) => updateSiegeEngine(key, "belfry", value)),
      gallery: createNumberInput((value) => updateSiegeEngine(key, "gallery", value)),
    };

    const ammunitionFields: Record<"ltCatapult" | "hvCatapult" | "ballista", HTMLInputElement> = {
      ltCatapult: createNumberInput((value) => updateForceAmmunition(key, "ltCatapult", value)),
      hvCatapult: createNumberInput((value) => updateForceAmmunition(key, "hvCatapult", value)),
      ballista: createNumberInput((value) => updateForceAmmunition(key, "ballista", value)),
    };

    engineBody.append(
      createRow([createField("Lt. Catapult", engineFields.ltCatapult), createField("Hv. Catapult", engineFields.hvCatapult)]),
      createRow([createField("Ram/Bore", engineFields.ram), createField("Tower", engineFields.tower)]),
      createRow([createField("Ballista", engineFields.ballista), createField("Belfry", engineFields.belfry)]),
      createRow([createField("Timber Fort", engineFields.timberFort), createField("Mantlet", engineFields.mantlet)]),
      createRow([createField("Ladder", engineFields.ladder), createField("Hoist", engineFields.hoist)]),
      createField("Gallery", engineFields.gallery),
    );

    // Add ammunition tracking
    const ammoSection = document.createElement("div");
    ammoSection.className = "siege-ammo-section";
    const ammoTitle = document.createElement("div");
    ammoTitle.className = "control-title";
    ammoTitle.textContent = "Ammunition";
    ammoSection.appendChild(ammoTitle);
    ammoSection.append(
      createRow([createField("Lt. Catapult Ammo", ammunitionFields.ltCatapult), createField("Hv. Catapult Ammo", ammunitionFields.hvCatapult)]),
      createField("Ballista Ammo", ammunitionFields.ballista),
    );
    engineBody.appendChild(ammoSection);

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
      fatigue: fatigueSelect,
      treasury: treasuryInput,
      rations: rationsInput,
      clerics: clericsInput,
      ammunition: ammunitionFields,
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

      let recoveryNode: HTMLDivElement | null = null;
      if (entry.recoveryTrackerId || entry.recoveryDays) {
        recoveryNode = document.createElement("div");
        recoveryNode.className = "siege-log-recovery";
        if (entry.recoveryTrackerId && entry.recoveryReady === false) {
          recoveryNode.textContent = `Recovery underway (${entry.recoveryDays ?? "?"} day(s)) — see calendar timer.`;
        } else {
          recoveryNode.textContent = `Recovered after ${entry.recoveryDays ?? "?"} day(s).`;
          recoveryNode.dataset.state = "ready";
        }
      }

      const actions = document.createElement("div");
      actions.className = "siege-log-actions";
      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.className = "button";
      const waiting = Boolean(entry.recoveryTrackerId && entry.recoveryReady === false);
      applyBtn.textContent = entry.applied ? "Applied" : waiting ? "Recovering..." : "Apply Casualties";
      applyBtn.disabled = entry.applied || waiting;
      applyBtn.addEventListener("click", () => applySiegeCasualties(entry.id));
      actions.appendChild(applyBtn);

      card.append(header, totals, losses, notes);
      if (recoveryNode) {
        card.appendChild(recoveryNode);
      }
      card.appendChild(actions);
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
    controls.fatigue.value = force.fatigue;
    controls.treasury.value = String(force.treasury);
    controls.rations.value = String(force.rations);
    controls.clerics.value = String(force.clerics);
    controls.ammunition.ltCatapult.value = String(force.ammunition?.ltCatapult ?? 0);
    controls.ammunition.hvCatapult.value = String(force.ammunition?.hvCatapult ?? 0);
    controls.ammunition.ballista.value = String(force.ammunition?.ballista ?? 0);
    controls.siegeEngines.ltCatapult.value = String(force.siegeEngines?.ltCatapult ?? 0);
    controls.siegeEngines.hvCatapult.value = String(force.siegeEngines?.hvCatapult ?? 0);
    controls.siegeEngines.ram.value = String(force.siegeEngines?.ram ?? 0);
    controls.siegeEngines.tower.value = String(force.siegeEngines?.tower ?? 0);
    controls.siegeEngines.ballista.value = String(force.siegeEngines?.ballista ?? 0);
    controls.siegeEngines.timberFort.value = String(force.siegeEngines?.timberFort ?? 0);
    controls.siegeEngines.mantlet.value = String(force.siegeEngines?.mantlet ?? 0);
    controls.siegeEngines.ladder.value = String(force.siegeEngines?.ladder ?? 0);
    controls.siegeEngines.hoist.value = String(force.siegeEngines?.hoist ?? 0);
    controls.siegeEngines.belfry.value = String(force.siegeEngines?.belfry ?? 0);
    controls.siegeEngines.gallery.value = String(force.siegeEngines?.gallery ?? 0);
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
    // Siege tactics don't have tactical advantages like War Machine tactics
    // Instead, each tactic provides specific BR bonuses
    const attackerTactic = att as SiegeTactic;
    const defenderTactic = def as SiegeTactic;

    if (attackerTactic === "assault") return "Attacker assault bonus (+5%)";
    if (attackerTactic === "depart") return "Attacker departing siege";
    if (attackerTactic === "bombard") return "Artillery duel";
    if (attackerTactic === "harass") return "Harassment tactics";
    return "Siege tactics set";
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

