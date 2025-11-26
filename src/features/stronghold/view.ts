import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { StrongholdState } from "../../state/schema";
import {
  addComponent,
  exportStrongholdPlan,
  getStrongholdState,
  removeComponent,
  resetStrongholdState,
  setStrongholdName,
  setTerrainModifier,
  subscribeToStronghold,
  updateComponentQuantity,
} from "./state";
import { STRONGHOLD_COMPONENTS, getComponentById } from "./components";
import { calculateStrongholdSummary } from "./logic";

const TERRAIN_OPTIONS = [
  { value: 1, label: "Clear / Normal (×1.0)" },
  { value: 1.1, label: "Forest / Hills (×1.1)" },
  { value: 1.2, label: "Swamp / Mountain (×1.2)" },
];

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

function triggerDownload(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatGp(value: number): string {
  return `${value.toLocaleString()} gp`;
}

export function renderStrongholdPanel(target: HTMLElement) {
  const panel = createPanel("Stronghold Architect", "Design fortifications and calculate Expert-set construction costs.");
  panel.body.classList.add("stronghold-grid");

  const overviewColumn = document.createElement("div");
  overviewColumn.className = "stronghold-column";

  const builderColumn = document.createElement("div");
  builderColumn.className = "stronghold-column";

  panel.body.append(overviewColumn, builderColumn);
  target.appendChild(panel.element);

  // --- Overview column ---
  const nameField = document.createElement("div");
  nameField.className = "stronghold-field";
  const nameLabel = document.createElement("label");
  nameLabel.className = "label";
  nameLabel.textContent = "Stronghold Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "input";
  const syncName = bindTextInput(nameInput, setStrongholdName);
  nameField.append(nameLabel, nameInput);

  const terrainField = document.createElement("div");
  terrainField.className = "stronghold-field";
  const terrainLabel = document.createElement("label");
  terrainLabel.className = "label";
  terrainLabel.textContent = "Terrain Modifier";
  const terrainSelect = document.createElement("select");
  terrainSelect.className = "input";
  TERRAIN_OPTIONS.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = String(option.value);
    opt.textContent = option.label;
    terrainSelect.appendChild(opt);
  });
  const syncTerrain = bindSelect(terrainSelect, (value) => setTerrainModifier(Number(value)));
  terrainField.append(terrainLabel, terrainSelect);

  const summaryCard = document.createElement("div");
  summaryCard.className = "stronghold-card summary";
  const summaryHeading = document.createElement("div");
  summaryHeading.className = "section-title";
  summaryHeading.textContent = "Project Summary";
  const summaryGrid = document.createElement("div");
  summaryGrid.className = "stat-grid stronghold-summary-grid";
  summaryCard.append(summaryHeading, summaryGrid);

  const actionGroup = document.createElement("div");
  actionGroup.className = "stronghold-actions";
  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "button";
  exportBtn.textContent = "Export Design";
  exportBtn.addEventListener("click", () => {
    const payload = exportStrongholdPlan();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    triggerDownload(`stronghold-plan-${timestamp}.json`, payload);
    showNotification({
      title: "Design exported",
      message: "Stronghold JSON downloaded.",
      variant: "success",
    });
  });

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "button danger";
  resetBtn.textContent = "Reset Project";
  resetBtn.addEventListener("click", () => {
    if (window.confirm("Clear the current stronghold plan?")) {
      resetStrongholdState();
    }
  });

  actionGroup.append(exportBtn, resetBtn);
  overviewColumn.append(nameField, terrainField, summaryCard, actionGroup);

  // --- Builder column ---
  const builderCard = document.createElement("div");
  builderCard.className = "stronghold-card";

  const builderHeading = document.createElement("div");
  builderHeading.className = "section-title";
  builderHeading.textContent = "Construction Components";
  builderCard.appendChild(builderHeading);

  const addForm = document.createElement("div");
  addForm.className = "stronghold-add";

  const componentSelect = document.createElement("select");
  componentSelect.className = "input";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- Select Component --";
  componentSelect.appendChild(defaultOption);
  STRONGHOLD_COMPONENTS.forEach((component) => {
    const option = document.createElement("option");
    option.value = component.id;
    option.textContent = `${component.name} (${formatGp(component.cost)})`;
    componentSelect.appendChild(option);
  });

  const qtyInput = document.createElement("input");
  qtyInput.type = "number";
  qtyInput.min = "1";
  qtyInput.value = "1";
  qtyInput.className = "input";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "button";
  addButton.textContent = "Add Component";
  addButton.addEventListener("click", () => {
    const componentId = componentSelect.value;
    const qty = Number(qtyInput.value) || 1;
    if (!componentId) {
      showNotification({
        title: "Choose a component",
        message: "Select a structure before adding it to the plan.",
        variant: "warning",
      });
      return;
    }
    const success = addComponent(componentId, qty);
    if (!success) {
      showNotification({
        title: "Unknown component",
        message: "Unable to add that component. Please try another option.",
        variant: "danger",
      });
      return;
    }
    componentSelect.value = "";
    qtyInput.value = "1";
    componentDescription.textContent = "Select a component to view its details.";
  });

  const componentDescription = document.createElement("p");
  componentDescription.className = "muted stronghold-component-desc";
  componentSelect.addEventListener("change", () => {
    const selected = getComponentById(componentSelect.value);
    componentDescription.textContent = selected ? selected.description : "Select a component to view its details.";
  });
  componentDescription.textContent = "Select a component to view its details.";

  const addGrid = document.createElement("div");
  addGrid.className = "stronghold-add-grid";

  const componentField = document.createElement("div");
  componentField.className = "stronghold-field";
  const componentLabel = document.createElement("label");
  componentLabel.className = "label";
  componentLabel.textContent = "Component";
  componentField.append(componentLabel, componentSelect);

  const qtyField = document.createElement("div");
  qtyField.className = "stronghold-field";
  const qtyLabel = document.createElement("label");
  qtyLabel.className = "label";
  qtyLabel.textContent = "Quantity";
  qtyField.append(qtyLabel, qtyInput);

  addGrid.append(componentField, qtyField);
  addForm.append(addGrid, addButton, componentDescription);
  builderCard.appendChild(addForm);

  const listContainer = document.createElement("div");
  listContainer.className = "stronghold-list";
  const emptyState = document.createElement("p");
  emptyState.className = "muted stronghold-empty";
  emptyState.textContent = "No components added yet.";
  listContainer.appendChild(emptyState);

  builderCard.appendChild(listContainer);
  builderColumn.appendChild(builderCard);

  function renderSummary(state: StrongholdState) {
    const summary = calculateStrongholdSummary(state);
    summaryGrid.innerHTML = "";

    const stats: Array<{ label: string; value: string; meta?: string }> = [
      { label: "Base Cost", value: formatGp(summary.baseCost) },
      { label: "Terrain", value: `×${summary.terrainMod.toFixed(2)}` },
      { label: "Total Cost", value: formatGp(summary.totalCost) },
      { label: "Build Time", value: `${summary.buildDays.toLocaleString()} days` },
      { label: "Engineers", value: summary.engineers.toLocaleString() },
    ];

    stats.forEach((stat) => {
      const statNode = document.createElement("div");
      statNode.className = "stat";
      const lbl = document.createElement("div");
      lbl.className = "stat-label";
      lbl.textContent = stat.label;
      const val = document.createElement("div");
      val.className = "stat-value";
      val.textContent = stat.value;
      statNode.append(lbl, val);
      summaryGrid.appendChild(statNode);
    });
  }

  function renderComponents(state: StrongholdState) {
    const summary = calculateStrongholdSummary(state);
    listContainer.innerHTML = "";

    if (!summary.items.length) {
      listContainer.appendChild(emptyState);
      return;
    }

    summary.items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "stronghold-item";

      const header = document.createElement("div");
      header.className = "stronghold-item-header";

      const titleBlock = document.createElement("div");
      const title = document.createElement("div");
      title.className = "stronghold-item-title";
      title.textContent = item.name;
      const desc = document.createElement("div");
      desc.className = "nav-meta";
      desc.textContent = item.description;
      titleBlock.append(title, desc);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "button danger";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeComponent(item.id));

      header.append(titleBlock, removeBtn);

      const body = document.createElement("div");
      body.className = "stronghold-item-body";

      const qtyWrapper = document.createElement("div");
      qtyWrapper.className = "stronghold-field";
      const qtyLabel = document.createElement("label");
      qtyLabel.className = "label";
      qtyLabel.textContent = "Qty";
      const qtyInputField = document.createElement("input");
      qtyInputField.type = "number";
      qtyInputField.min = "1";
      qtyInputField.value = String(item.qty);
      qtyInputField.className = "input";
      qtyInputField.addEventListener("change", () => {
        const nextValue = Number(qtyInputField.value);
        updateComponentQuantity(item.id, Number.isFinite(nextValue) ? nextValue : item.qty);
      });
      qtyWrapper.append(qtyLabel, qtyInputField);

      const costBlock = document.createElement("div");
      costBlock.className = "stronghold-item-cost";
      const unit = document.createElement("div");
      unit.className = "nav-meta";
      unit.textContent = `Unit: ${formatGp(item.unitCost)}`;
      const total = document.createElement("div");
      total.className = "stat-value";
      total.textContent = formatGp(item.totalCost);
      costBlock.append(unit, total);

      body.append(qtyWrapper, costBlock);
      row.append(header, body);
      listContainer.appendChild(row);
    });
  }

  function sync(state: StrongholdState) {
    syncName(state.projectName);
    syncTerrain(String(state.terrainMod));
    renderSummary(state);
    renderComponents(state);
  }

  const unsubscribe = subscribeToStronghold(sync);
  sync(getStrongholdState());

  return () => unsubscribe();
}

