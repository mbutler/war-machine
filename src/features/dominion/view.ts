import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { DominionState, DominionTurnSettings } from "../../state/schema";
import {
  addDominionResource,
  clearDominionLog,
  getDominionProjection,
  getDominionState,
  processDominionSeason,
  removeDominionResource,
  subscribeToDominion,
  updateDominionField,
  updateDominionResource,
  updateDominionTurn,
} from "./state";

type InputSync<T> = (value: T) => void;

function bindTextInput(input: HTMLInputElement, setter: (value: string) => void): InputSync<string> {
  let syncing = false;
  input.addEventListener("input", () => {
    if (syncing) return;
    setter(input.value);
  });
  return (value) => {
    syncing = true;
    input.value = value;
    syncing = false;
  };
}

function bindNumberInput(
  input: HTMLInputElement,
  setter: (value: number) => void,
  options: { min?: number; max?: number; fallback?: number } = {},
): InputSync<number> {
  let syncing = false;
  const { min, max, fallback = 0 } = options;
  const parseValue = () => {
    const next = Number(input.value);
    if (Number.isNaN(next)) {
      setter(fallback);
      return;
    }
    if (typeof min === "number" && next < min) {
      setter(min);
      return;
    }
    if (typeof max === "number" && next > max) {
      setter(max);
      return;
    }
    setter(next);
  };
  input.addEventListener("change", () => {
    if (syncing) return;
    parseValue();
  });
  input.addEventListener("blur", () => {
    if (syncing) return;
    parseValue();
  });
  return (value) => {
    syncing = true;
    input.value = String(value);
    syncing = false;
  };
}

function bindSelect<T extends string>(select: HTMLSelectElement, setter: (value: T) => void): InputSync<T> {
  let syncing = false;
  select.addEventListener("change", () => {
    if (syncing) return;
    setter(select.value as T);
  });
  return (value) => {
    syncing = true;
    select.value = value;
    syncing = false;
  };
}

function formatDelta(value: number, suffix = ""): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}

function renderResources(container: HTMLElement, state: DominionState) {
  container.innerHTML = "";
  if (!state.resources.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No unique resources recorded.";
    container.appendChild(empty);
    return;
  }

  state.resources.forEach((resource) => {
    const row = document.createElement("div");
    row.className = "flex gap-sm";
    row.style.alignItems = "center";

    const badge = document.createElement("span");
    badge.className = "nav-meta";
    badge.style.minWidth = "60px";
    badge.textContent = resource.type;

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "input";
    nameInput.value = resource.name;
    nameInput.addEventListener("change", () => {
      updateDominionResource(resource.id, { name: nameInput.value });
    });

    const valueInput = document.createElement("input");
    valueInput.type = "number";
    valueInput.className = "input";
    valueInput.style.maxWidth = "100px";
    valueInput.min = "0";
    valueInput.step = "0.5";
    valueInput.value = String(resource.value);
    valueInput.addEventListener("change", () => {
      const next = Number(valueInput.value);
      if (!Number.isNaN(next)) {
        updateDominionResource(resource.id, { value: next });
      }
    });

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "button danger";
    removeBtn.style.minWidth = "60px";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeDominionResource(resource.id));

    row.append(badge, nameInput, valueInput, removeBtn);
    container.appendChild(row);
  });
}

function renderLog(container: HTMLElement, state: DominionState) {
  container.innerHTML = "";
  if (!state.log.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "History is written here...";
    empty.style.textAlign = "center";
    empty.style.padding = "2rem 0";
    container.appendChild(empty);
    return;
  }

  state.log.forEach((entry) => {
    const card = document.createElement("article");
    card.className = "panel";

    const header = document.createElement("div");
    header.className = "flex gap-sm";
    header.style.justifyContent = "space-between";

    const left = document.createElement("span");
    left.className = "nav-label";
    left.textContent = entry.season;

    const time = document.createElement("span");
    time.className = "timestamp";
    time.textContent = new Date(entry.timestamp).toLocaleString();

    header.append(left, time);
    card.appendChild(header);

    const eventLine = document.createElement("p");
    eventLine.style.fontWeight = "bold";
    eventLine.textContent = entry.eventLabel;
    card.appendChild(eventLine);

    if (entry.factors.length) {
      const factors = document.createElement("div");
      factors.className = "flex gap-sm";
      factors.style.flexWrap = "wrap";
      entry.factors.forEach((label) => {
        const chip = document.createElement("span");
        chip.className = "nav-meta";
        chip.textContent = label;
        chip.style.padding = "0.15rem 0.4rem";
        chip.style.border = "1px solid var(--panel-border)";
        chip.style.borderRadius = "0.25rem";
        factors.appendChild(chip);
      });
      card.appendChild(factors);
    }

    const grid = document.createElement("div");
    grid.className = "stat-grid";

    const treasury = document.createElement("div");
    treasury.className = "stat";
    treasury.innerHTML = `<div class="stat-label">Treasury</div><div class="stat-value">${formatDelta(
      entry.incomeDelta,
      " gp",
    )}</div><div class="nav-meta">Now ${entry.treasuryAfter} gp</div>`;

    const confidence = document.createElement("div");
    confidence.className = "stat";
    confidence.innerHTML = `<div class="stat-label">Confidence</div><div class="stat-value">${formatDelta(
      entry.confidenceDelta,
    )}</div><div class="nav-meta">Now ${entry.finalConfidence}</div>`;

    grid.append(treasury, confidence);
    card.appendChild(grid);

    if (entry.populationDelta !== 0) {
      const pop = document.createElement("p");
      pop.className = "muted";
      pop.textContent = `Population shift: ${formatDelta(entry.populationDelta)} families (Now ${entry.familiesAfter})`;
      card.appendChild(pop);
    }

    container.appendChild(card);
  });
}

function renderProjection(block: HTMLElement, state: DominionState) {
  const projection = getDominionProjection();
  block.innerHTML = "";

  const grid = document.createElement("div");
  grid.className = "stat-grid";

  const incomeStat = document.createElement("div");
  incomeStat.className = "stat";
  incomeStat.innerHTML = `<div class="stat-label">Projected Income</div><div class="stat-value">${formatDelta(
    projection.netIncome,
    " gp",
  )}</div><div class="nav-meta">Gross ${projection.grossIncome} gp</div>`;

  const confidenceStat = document.createElement("div");
  confidenceStat.className = "stat";
  confidenceStat.innerHTML = `<div class="stat-label">Projected Confidence</div><div class="stat-value">${formatDelta(
    projection.confidenceDelta,
  )}</div><div class="nav-meta">Dest. ${projection.finalConfidence}</div>`;

  grid.append(incomeStat, confidenceStat);
  block.appendChild(grid);
}

function syncOverviewInputs(state: DominionState, bindings: Record<string, InputSync<any>>) {
  bindings.name(state.name);
  bindings.ruler(state.ruler);
  bindings.rulerAlignment(state.rulerAlignment);
  bindings.dominionAlignment(state.dominionAlignment);
  bindings.families(state.families);
  bindings.hexes(state.hexes);
  bindings.treasury(state.treasury);
  bindings.confidence(state.confidence);
  bindings.liege(state.liege);
  bindings.vassals(state.vassalCount);
}

function syncTurnInputs(turn: DominionTurnSettings, bindings: Record<string, InputSync<any>>) {
  bindings.season(turn.season);
  bindings.rulerStatus(turn.rulerStatus);
  bindings.taxRate(turn.taxRate);
  bindings.holidaySpending(turn.holidaySpending);
  bindings.event(turn.event);
  bindings.expenses(turn.expenses);
  bindings.tithePercent(turn.tithePercent);
}

export function renderDominionPanel(target: HTMLElement) {
  const overview = createPanel("Dominion Status", "Manage domain fundamentals and economic baselines.");
  overview.body.classList.add("flex", "flex-col", "gap-md");

  const formGrid = document.createElement("div");
  formGrid.className = "stat-grid";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "input";
  const syncName = bindTextInput(nameInput, (value) => updateDominionField("name", value));

  const rulerInput = document.createElement("input");
  rulerInput.type = "text";
  rulerInput.className = "input";
  const syncRuler = bindTextInput(rulerInput, (value) => updateDominionField("ruler", value));

  const rulerAlignSelect = document.createElement("select");
  rulerAlignSelect.className = "input";
  ["Lawful", "Neutral", "Chaotic"].forEach((alignment) => {
    const option = document.createElement("option");
    option.value = alignment;
    option.textContent = alignment;
    rulerAlignSelect.appendChild(option);
  });
  const syncRulerAlign = bindSelect(rulerAlignSelect, (value) => updateDominionField("rulerAlignment", value));

  const domAlignSelect = rulerAlignSelect.cloneNode(true) as HTMLSelectElement;
  domAlignSelect.innerHTML = rulerAlignSelect.innerHTML;
  const syncDomAlign = bindSelect(domAlignSelect, (value) => updateDominionField("dominionAlignment", value));

  const familiesInput = document.createElement("input");
  familiesInput.type = "number";
  familiesInput.className = "input";
  familiesInput.min = "0";
  const syncFamilies = bindNumberInput(familiesInput, (value) => updateDominionField("families", value), { min: 0 });

  const hexInput = document.createElement("input");
  hexInput.type = "number";
  hexInput.className = "input";
  hexInput.min = "1";
  const syncHexes = bindNumberInput(hexInput, (value) => updateDominionField("hexes", value), { min: 1 });

  const treasuryInput = document.createElement("input");
  treasuryInput.type = "number";
  treasuryInput.className = "input";
  const syncTreasury = bindNumberInput(treasuryInput, (value) => updateDominionField("treasury", value));

  const confidenceInput = document.createElement("input");
  confidenceInput.type = "number";
  confidenceInput.className = "input";
  const syncConfidence = bindNumberInput(confidenceInput, (value) => updateDominionField("confidence", value));

  const liegeInput = document.createElement("input");
  liegeInput.type = "text";
  liegeInput.className = "input";
  const syncLiege = bindTextInput(liegeInput, (value) => updateDominionField("liege", value));

  const vassalInput = document.createElement("input");
  vassalInput.type = "number";
  vassalInput.className = "input";
  vassalInput.min = "0";
  const syncVassals = bindNumberInput(vassalInput, (value) => updateDominionField("vassalCount", value), { min: 0 });

  const addField = (label: string, node: HTMLElement) => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-sm";
    const lbl = document.createElement("label");
    lbl.className = "label";
    lbl.textContent = label;
    wrapper.appendChild(lbl);
    wrapper.appendChild(node);
    formGrid.appendChild(wrapper);
  };

  addField("Dominion Name", nameInput);
  addField("Ruler", rulerInput);
  addField("Ruler Alignment", rulerAlignSelect);
  addField("Dominion Alignment", domAlignSelect);
  addField("Families", familiesInput);
  addField("Hexes", hexInput);
  addField("Treasury (gp)", treasuryInput);
  addField("Confidence", confidenceInput);
  addField("Liege", liegeInput);
  addField("Vassals", vassalInput);

  overview.body.appendChild(formGrid);

  const resourceSection = document.createElement("div");
  resourceSection.className = "flex flex-col gap-sm";

  const resHeader = document.createElement("div");
  resHeader.className = "panel-heading";
  resHeader.textContent = "Resources";
  resourceSection.appendChild(resHeader);

  const resourceList = document.createElement("div");
  resourceList.className = "flex flex-col gap-sm";
  resourceSection.appendChild(resourceList);

  const addRow = document.createElement("div");
  addRow.className = "flex gap-sm";
  addRow.style.alignItems = "center";

  const typeSelect = document.createElement("select");
  typeSelect.className = "input";
  ["Animal", "Vegetable", "Mineral"].forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    typeSelect.appendChild(option);
  });

  const nameField = document.createElement("input");
  nameField.type = "text";
  nameField.placeholder = "Name (e.g., Iron)";
  nameField.className = "input";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "button";
  addButton.textContent = "Add Resource";
  addButton.addEventListener("click", () => {
    if (!nameField.value.trim()) {
      showNotification({
        title: "Resource name required",
        message: "Provide a name before adding a resource.",
        variant: "warning",
      });
      return;
    }
    addDominionResource(typeSelect.value as "Animal" | "Vegetable" | "Mineral", nameField.value.trim(), 1);
    nameField.value = "";
  });

  addRow.append(typeSelect, nameField, addButton);
  resourceSection.appendChild(addRow);

  overview.body.appendChild(resourceSection);

  const turnPanel = createPanel("Season Management", "Prepare taxes, events, and obligations for the coming season.");
  turnPanel.body.classList.add("flex", "flex-col", "gap-md");

  const turnGrid = document.createElement("div");
  turnGrid.className = "stat-grid";

  const seasonSelect = document.createElement("select");
  seasonSelect.className = "input";
  ["Spring Start", "Summer", "Autumn", "Winter", "Year End"].forEach((season) => {
    const option = document.createElement("option");
    option.value = season;
    option.textContent = season;
    seasonSelect.appendChild(option);
  });
  const syncSeason = bindSelect(seasonSelect, (value) => updateDominionTurn("season", value));

  const rulerStatusSelect = document.createElement("select");
  rulerStatusSelect.className = "input";
  [
    { value: "present", label: "Present" },
    { value: "advisor", label: "Advisor Only" },
    { value: "absent", label: "Absent" },
  ].forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    rulerStatusSelect.appendChild(option);
  });
  const syncRulerStatus = bindSelect(rulerStatusSelect, (value) => updateDominionTurn("rulerStatus", value));

  const taxInput = document.createElement("input");
  taxInput.type = "number";
  taxInput.className = "input";
  taxInput.min = "0";
  const syncTax = bindNumberInput(taxInput, (value) => updateDominionTurn("taxRate", value), { min: 0 });

  const holidayInput = document.createElement("input");
  holidayInput.type = "number";
  holidayInput.className = "input";
  holidayInput.min = "0";
  const syncHoliday = bindNumberInput(holidayInput, (value) => updateDominionTurn("holidaySpending", value), { min: 0 });

  const eventSelect = document.createElement("select");
  eventSelect.className = "input";
  [
    { value: "none", label: "Normal / None" },
    { value: "festival", label: "Festival (+Confidence)" },
    { value: "good", label: "Good Event" },
    { value: "bad", label: "Bad Event" },
    { value: "calamity", label: "Calamity" },
    { value: "random", label: "Roll Random Event" },
  ].forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.value;
    option.textContent = entry.label;
    eventSelect.appendChild(option);
  });
  const syncEvent = bindSelect(eventSelect, (value) => updateDominionTurn("event", value));

  const expenseInput = document.createElement("input");
  expenseInput.type = "number";
  expenseInput.className = "input";
  expenseInput.min = "0";
  const syncExpenses = bindNumberInput(expenseInput, (value) => updateDominionTurn("expenses", value), { min: 0 });

  const titheInput = document.createElement("input");
  titheInput.type = "number";
  titheInput.className = "input";
  titheInput.min = "0";
  titheInput.max = "100";
  const syncTithe = bindNumberInput(titheInput, (value) => updateDominionTurn("tithePercent", value), {
    min: 0,
    max: 100,
  });

  const addTurnField = (label: string, node: HTMLElement) => {
    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-sm";
    const lbl = document.createElement("label");
    lbl.className = "label";
    lbl.textContent = label;
    wrapper.append(lbl, node);
    turnGrid.appendChild(wrapper);
  };

  addTurnField("Season", seasonSelect);
  addTurnField("Ruler Status", rulerStatusSelect);
  addTurnField("Tax Rate (gp / family)", taxInput);
  addTurnField("Holiday Spending", holidayInput);
  addTurnField("Event / Mood", eventSelect);
  addTurnField("Expenses (Troops / Works)", expenseInput);
  addTurnField("Tithe to Liege (%)", titheInput);

  turnPanel.body.appendChild(turnGrid);

  const projectionBlock = document.createElement("div");
  projectionBlock.className = "panel";
  turnPanel.body.appendChild(projectionBlock);

  const turnActions = document.createElement("div");
  turnActions.className = "flex gap-sm";

  const processButton = document.createElement("button");
  processButton.type = "button";
  processButton.className = "button";
  processButton.textContent = "Process Turn";
  processButton.addEventListener("click", () => {
    processDominionSeason();
  });

  const clearLogButton = document.createElement("button");
  clearLogButton.type = "button";
  clearLogButton.className = "button danger";
  clearLogButton.textContent = "Clear Chronicle";
  clearLogButton.addEventListener("click", () => {
    if (window.confirm("Clear dominion chronicle?")) {
      clearDominionLog();
    }
  });

  turnActions.append(processButton, clearLogButton);
  turnPanel.body.appendChild(turnActions);

  const logPanel = createPanel("Dominion Chronicle", "Season-by-season record of income, confidence, and events.");
  logPanel.body.classList.add("scrollbox");
  logPanel.body.style.maxHeight = "70vh";

  target.append(overview.element, turnPanel.element, logPanel.element);

  const overviewBindings = {
    name: syncName,
    ruler: syncRuler,
    rulerAlignment: syncRulerAlign,
    dominionAlignment: syncDomAlign,
    families: syncFamilies,
    hexes: syncHexes,
    treasury: syncTreasury,
    confidence: syncConfidence,
    liege: syncLiege,
    vassals: syncVassals,
  };

  const turnBindings = {
    season: syncSeason,
    rulerStatus: syncRulerStatus,
    taxRate: syncTax,
    holidaySpending: syncHoliday,
    event: syncEvent,
    expenses: syncExpenses,
    tithePercent: syncTithe,
  };

  const render = (state: DominionState) => {
    syncOverviewInputs(state, overviewBindings);
    syncTurnInputs(state.turn, turnBindings);
    renderResources(resourceList, state);
    renderProjection(projectionBlock, state);
    renderLog(logPanel.body, state);
  };

  render(getDominionState());
  const unsubscribe = subscribeToDominion(render);

  return () => {
    unsubscribe();
  };
}

