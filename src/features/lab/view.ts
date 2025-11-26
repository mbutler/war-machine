import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { LabLogEntry, LabState } from "../../state/schema";
import { LAB_ITEM_TYPES } from "./constants";
import { calculateLabExperiment } from "./logic";
import {
  attemptExperiment,
  clearLabLog,
  getLabState,
  investInLibrary,
  resetLabState,
  subscribeToLab,
  updateLabCaster,
  updateLabResources,
  updateLabWorkbench,
} from "./state";

const CLASS_OPTIONS = [
  { value: "mu", label: "Magic-User / Elf" },
  { value: "cleric", label: "Cleric / Druid" },
];

function formatGp(value: number): string {
  return `${Math.round(value).toLocaleString()} gp`;
}

export function renderLabPanel(target: HTMLElement) {
  const panel = createPanel("Artificer's Lab", "Manage casters, libraries, and enchantment projects.");
  panel.body.classList.add("lab-grid");

  const casterColumn = document.createElement("div");
  casterColumn.className = "lab-column";
  const workbenchColumn = document.createElement("div");
  workbenchColumn.className = "lab-column";
  const logColumn = document.createElement("div");
  logColumn.className = "lab-column";

  panel.body.append(casterColumn, workbenchColumn, logColumn);
  target.appendChild(panel.element);

  // Caster & Resources Card
  const casterCard = document.createElement("div");
  casterCard.className = "lab-card";

  const casterHeader = document.createElement("div");
  casterHeader.className = "section-title";
  casterHeader.textContent = "The Caster";
  casterCard.appendChild(casterHeader);

  const casterForm = document.createElement("div");
  casterForm.className = "lab-form-grid";

  const nameInput = createInput("text");
  bindTextInput(nameInput, (value) => updateLabCaster("name", value));
  casterForm.appendChild(createField("Name", nameInput));

  const levelInput = createInput("number");
  levelInput.min = "1";
  bindNumberInput(levelInput, (value) => updateLabCaster("level", value), 1);
  casterForm.appendChild(createField("Level", levelInput));

  const classSelect = document.createElement("select");
  classSelect.className = "input";
  CLASS_OPTIONS.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option.value;
    opt.textContent = option.label;
    classSelect.appendChild(opt);
  });
  bindSelect(classSelect, (value) => updateLabCaster("class", value as any));
  casterForm.appendChild(createField("Class", classSelect));

  const statInput = createInput("number");
  statInput.min = "1";
  bindNumberInput(statInput, (value) => updateLabCaster("mentalStat", value), 10);
  casterForm.appendChild(createField("Int / Wis Score", statInput));

  casterCard.appendChild(casterForm);

  const resourceHeader = document.createElement("div");
  resourceHeader.className = "section-title";
  resourceHeader.textContent = "Resources";
  casterCard.appendChild(resourceHeader);

  const resourceForm = document.createElement("div");
  resourceForm.className = "lab-form-grid";

  const goldInput = createInput("number");
  goldInput.min = "0";
  bindNumberInput(goldInput, (value) => updateLabResources("gold", value), 0);
  resourceForm.appendChild(createField("Gold (gp)", goldInput));

  const libraryInput = createInput("number");
  libraryInput.min = "0";
  bindNumberInput(libraryInput, (value) => updateLabResources("libraryValue", value), 0);
  resourceForm.appendChild(createField("Library Value (gp)", libraryInput));

  casterCard.appendChild(resourceForm);

  const resourceActions = document.createElement("div");
  resourceActions.className = "lab-actions";

  const investBtn = document.createElement("button");
  investBtn.type = "button";
  investBtn.className = "button";
  investBtn.textContent = "Invest 1,000 gp";
  investBtn.addEventListener("click", () => {
    const result = investInLibrary(1000);
    if (!result.success) {
      showNotification({
        title: "Investment failed",
        message: result.error,
        variant: "warning",
      });
    } else {
      showNotification({
        title: "Library expanded",
        message: "1,000 gp moved from treasury to library.",
        variant: "success",
      });
    }
  });

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "button danger";
  resetBtn.textContent = "Reset Defaults";
  resetBtn.addEventListener("click", () => {
    if (window.confirm("Reset the lab to default values?")) {
      resetLabState();
    }
  });

  resourceActions.append(investBtn, resetBtn);
  casterCard.appendChild(resourceActions);

  casterColumn.appendChild(casterCard);

  // Workbench Card
  const workbenchCard = document.createElement("div");
  workbenchCard.className = "lab-card";

  const workbenchHeader = document.createElement("div");
  workbenchHeader.className = "section-title";
  workbenchHeader.textContent = "Enchantment Workbench";
  workbenchCard.appendChild(workbenchHeader);

  const modeToggle = document.createElement("div");
  modeToggle.className = "lab-mode-toggle";
  const formulaOption = createRadioOption("Research Formula", "formula");
  const itemOption = createRadioOption("Create Item", "item");
  modeToggle.append(formulaOption.wrapper, itemOption.wrapper);
  workbenchCard.appendChild(modeToggle);

  formulaOption.input.addEventListener("change", () => {
    if (formulaOption.input.checked) {
      updateLabWorkbench("mode", "formula");
    }
  });
  itemOption.input.addEventListener("change", () => {
    if (itemOption.input.checked) {
      updateLabWorkbench("mode", "item");
    }
  });

  const workbenchForm = document.createElement("div");
  workbenchForm.className = "lab-form-grid";

  const itemSelect = document.createElement("select");
  itemSelect.className = "input";
  LAB_ITEM_TYPES.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.label;
    itemSelect.appendChild(opt);
  });
  bindSelect(itemSelect, (value) => updateLabWorkbench("itemType", value as LabState["workbench"]["itemType"]));
  workbenchForm.appendChild(createField("Item Type", itemSelect));

  const spellLevelInput = createInput("number");
  spellLevelInput.min = "1";
  bindNumberInput(spellLevelInput, (value) => updateLabWorkbench("spellLevel", value), 1);
  workbenchForm.appendChild(createField("Primary Spell Level", spellLevelInput));

  const materialInput = createInput("number");
  materialInput.min = "0";
  bindNumberInput(materialInput, (value) => updateLabWorkbench("materialCost", value), 0);
  workbenchForm.appendChild(createField("Material Cost (gp)", materialInput));

  const formulaField = document.createElement("div");
  formulaField.className = "lab-field lab-formula-field";
  const formulaLabel = document.createElement("label");
  formulaLabel.className = "label";
  formulaLabel.textContent = "Formula Prepared";
  const formulaCheckbox = document.createElement("input");
  formulaCheckbox.type = "checkbox";
  formulaCheckbox.className = "lab-checkbox";
  formulaCheckbox.addEventListener("change", () => updateLabWorkbench("hasFormula", formulaCheckbox.checked));
  formulaField.append(formulaLabel, formulaCheckbox);
  workbenchForm.appendChild(formulaField);

  workbenchCard.appendChild(workbenchForm);

  const summaryCard = document.createElement("div");
  summaryCard.className = "lab-summary";

  const summaryGrid = document.createElement("div");
  summaryGrid.className = "lab-summary-grid";

  const costStat = createStatBlock("Gold Cost");
  const timeStat = createStatBlock("Weeks Required");
  summaryGrid.append(costStat.container, timeStat.container);

  summaryCard.appendChild(summaryGrid);

  const chanceBlock = document.createElement("div");
  chanceBlock.className = "lab-chance";
  const chanceLabel = document.createElement("div");
  chanceLabel.className = "lab-chance-label";
  chanceLabel.textContent = "Probability of Success";
  const chanceValue = document.createElement("div");
  chanceValue.className = "lab-chance-value";
  const chanceBreakdown = document.createElement("div");
  chanceBreakdown.className = "lab-chance-breakdown";
  const libraryWarning = document.createElement("div");
  libraryWarning.className = "lab-chance-warning";

  chanceBlock.append(chanceLabel, chanceValue, chanceBreakdown, libraryWarning);
  summaryCard.appendChild(chanceBlock);

  const libraryInfo = document.createElement("div");
  libraryInfo.className = "lab-library-info";
  summaryCard.appendChild(libraryInfo);

  workbenchCard.appendChild(summaryCard);

  const activeNotice = document.createElement("div");
  activeNotice.className = "lab-active-notice";
  workbenchCard.appendChild(activeNotice);

  const errorMessage = document.createElement("div");
  errorMessage.className = "lab-error";
  workbenchCard.appendChild(errorMessage);

  const craftButton = document.createElement("button");
  craftButton.type = "button";
  craftButton.className = "button";
  craftButton.textContent = "Begin Research";
  craftButton.addEventListener("click", () => {
    const result = attemptExperiment();
    if (!result.success) {
      showNotification({
        title: "Experiment halted",
        message: result.error ?? "Unknown error occurred.",
        variant: "warning",
      });
      return;
    }
    const title = formulaOption.input.checked ? "Formula complete" : "Item crafted";
    showNotification({
      title,
      message: `Roll ${result.roll}/${result.chance}%`,
      variant: "success",
    });
  });
  workbenchCard.appendChild(craftButton);

  workbenchColumn.appendChild(workbenchCard);

  // Log Card
  const logCard = document.createElement("div");
  logCard.className = "lab-card";

  const logHeader = document.createElement("div");
  logHeader.className = "lab-log-header";
  const logTitle = document.createElement("div");
  logTitle.className = "section-title";
  logTitle.textContent = "Grimoire Log";
  const clearLogBtn = document.createElement("button");
  clearLogBtn.type = "button";
  clearLogBtn.className = "button danger";
  clearLogBtn.textContent = "Clear";
  clearLogBtn.addEventListener("click", () => {
    if (window.confirm("Clear all log entries?")) {
      clearLabLog();
    }
  });
  logHeader.append(logTitle, clearLogBtn);
  logCard.appendChild(logHeader);

  const logList = document.createElement("div");
  logList.className = "lab-log-list";
  logCard.appendChild(logList);

  logColumn.appendChild(logCard);

  function sync(state: LabState) {
    nameInput.value = state.caster.name;
    levelInput.value = String(state.caster.level);
    classSelect.value = state.caster.class;
    statInput.value = String(state.caster.mentalStat);
    goldInput.value = String(state.resources.gold);
    libraryInput.value = String(state.resources.libraryValue);
    formulaOption.input.checked = state.workbench.mode === "formula";
    itemOption.input.checked = state.workbench.mode === "item";
    itemSelect.value = state.workbench.itemType;
    spellLevelInput.value = String(state.workbench.spellLevel);
    materialInput.value = String(state.workbench.materialCost);
    formulaCheckbox.checked = state.workbench.hasFormula;
    formulaField.style.display = state.workbench.mode === "item" ? "flex" : "none";

    const calc = calculateLabExperiment(state);
    costStat.value.textContent = formatGp(calc.cost);
    timeStat.value.textContent = `${calc.timeWeeks.toLocaleString()} wk${calc.timeWeeks === 1 ? "" : "s"}`;
    chanceValue.textContent = `${calc.chance}%`;
    chanceValue.dataset.state = calc.libraryOk ? "ok" : "fail";
    chanceBreakdown.textContent = calc.breakdown;
    libraryWarning.textContent = calc.libraryOk ? "" : `Library inadequate! Need ${formatGp(calc.libraryRequired)}.`;
    libraryWarning.style.display = calc.libraryOk ? "none" : "block";
    libraryInfo.textContent = `Current library: ${formatGp(state.resources.libraryValue)} · Required: ${formatGp(calc.libraryRequired)}`;
    const experimentBlocked = Boolean(state.activeTrackerId);
    craftButton.disabled = experimentBlocked;
    craftButton.textContent = experimentBlocked
      ? "Experiment In Progress"
      : calc.mode === "formula"
        ? "Research Formula"
        : "Create Item";
    activeNotice.textContent = experimentBlocked ? "Downtime running — check calendar trackers." : "";
    errorMessage.textContent = "";

    renderLog(state.log);
  }

  function renderLog(entries: LabLogEntry[]) {
    logList.innerHTML = "";
    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Experiments are recorded here…";
      logList.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "lab-log-entry";
      row.dataset.outcome = entry.outcome;

      const header = document.createElement("div");
      header.className = "lab-log-entry-header";

      const badge = document.createElement("span");
      badge.className = "lab-badge";
      badge.textContent = entry.itemType.toUpperCase();

      const title = document.createElement("strong");
      title.textContent = entry.title;

      const timestamp = document.createElement("span");
      timestamp.className = "lab-log-entry-time";
      timestamp.textContent = new Date(entry.timestamp).toLocaleString();

      header.append(badge, title, timestamp);

      const details = document.createElement("p");
      details.className = "lab-log-entry-text";
      details.textContent = entry.description;

      row.append(header, details);
      logList.appendChild(row);
    });
  }

  const unsubscribe = subscribeToLab(sync);
  sync(getLabState());

  return () => unsubscribe();
}

function createInput(type: "text" | "number" = "text"): HTMLInputElement {
  const input = document.createElement("input");
  input.type = type;
  input.className = "input";
  return input;
}

function createField(labelText: string, control: HTMLElement): HTMLDivElement {
  const field = document.createElement("div");
  field.className = "lab-field";
  const label = document.createElement("label");
  label.className = "label";
  label.textContent = labelText;
  field.append(label, control);
  return field;
}

function createRadioOption(labelText: string, value: string) {
  const wrapper = document.createElement("label");
  wrapper.className = "lab-radio";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "lab-mode";
  input.value = value;
  wrapper.append(input, document.createTextNode(labelText));
  return { wrapper, input };
}

function createStatBlock(labelText: string) {
  const container = document.createElement("div");
  container.className = "lab-stat";
  const label = document.createElement("div");
  label.className = "lab-stat-label";
  label.textContent = labelText;
  const value = document.createElement("div");
  value.className = "lab-stat-value";
  container.append(label, value);
  return { container, value };
}

function bindTextInput(input: HTMLInputElement, setter: (value: string) => void) {
  input.addEventListener("input", () => setter(input.value));
}

function bindNumberInput(input: HTMLInputElement, setter: (value: number) => void, fallback = 0) {
  const handle = () => {
    const next = Number(input.value);
    setter(Number.isNaN(next) ? fallback : next);
  };
  input.addEventListener("change", handle);
  input.addEventListener("blur", handle);
}

function bindSelect(select: HTMLSelectElement, setter: (value: string) => void) {
  select.addEventListener("change", () => setter(select.value));
}

