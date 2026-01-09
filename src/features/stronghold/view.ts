import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { StrongholdState, StrongholdProject } from "../../state/schema";
import {
  addComponent,
  cancelStrongholdConstruction,
  exportStrongholdData,
  importStrongholdData,
  getStrongholdState,
  removeComponent,
  resetStrongholdState,
  setStrongholdName,
  setTerrainModifier,
  startStrongholdConstruction,
  subscribeToStronghold,
  updateComponentQuantity,
  selectProject,
} from "./state";
import { STRONGHOLD_COMPONENTS, getComponentById } from "./components";
import { calculateStrongholdSummary } from "./logic";
import { getModuleExportFilename, triggerDownload } from "../../utils/moduleExport";

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

function formatGp(value: number): string {
  return `${value.toLocaleString()} gp`;
}

function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", { 
    year: "numeric", 
    month: "short", 
    day: "numeric" 
  });
}

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "complete": return "badge-success";
    case "active": return "badge-warning";
    case "planned": return "badge-info";
    default: return "";
  }
}

export function renderStrongholdPanel(target: HTMLElement) {
  const panel = createPanel("Stronghold", "Design fortifications and calculate construction costs");
  
  // Projects list section (for viewing multiple imported strongholds)
  const projectsSection = document.createElement("div");
  projectsSection.className = "stronghold-projects-section";
  
  const projectsHeader = document.createElement("div");
  projectsHeader.className = "stronghold-projects-header";
  const projectsTitle = document.createElement("h3");
  projectsTitle.className = "section-title";
  projectsTitle.textContent = "Stronghold Projects";
  const newProjectBtn = document.createElement("button");
  newProjectBtn.type = "button";
  newProjectBtn.className = "button small";
  newProjectBtn.textContent = "+ New Project";
  newProjectBtn.addEventListener("click", () => selectProject(null));
  projectsHeader.append(projectsTitle, newProjectBtn);
  
  const projectsList = document.createElement("div");
  projectsList.className = "stronghold-projects-list";
  
  projectsSection.append(projectsHeader, projectsList);
  
  // Two-column grid for current project
  const gridContainer = document.createElement("div");
  gridContainer.className = "stronghold-grid";

  const overviewColumn = document.createElement("div");
  overviewColumn.className = "stronghold-column";

  const builderColumn = document.createElement("div");
  builderColumn.className = "stronghold-column";

  gridContainer.append(overviewColumn, builderColumn);
  panel.body.append(projectsSection, gridContainer);
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
  const statusNotice = document.createElement("div");
  statusNotice.className = "stronghold-status";
  summaryCard.append(summaryHeading, summaryGrid, statusNotice);

  const actionGroup = document.createElement("div");
  actionGroup.className = "stronghold-actions";
  const buildBtn = document.createElement("button");
  buildBtn.type = "button";
  buildBtn.className = "button primary";
  buildBtn.textContent = "Start Construction";
  buildBtn.addEventListener("click", () => {
    const result = startStrongholdConstruction();
    if (!result.success) {
      showNotification({
        title: "Cannot start construction",
        message: result.error ?? "Unknown error.",
        variant: "warning",
      });
      return;
    }
    showNotification({
      title: "Project scheduled",
      message: "Construction timer added to the calendar.",
      variant: "success",
    });
  });

  const exportBtn = document.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "button";
  exportBtn.textContent = "Export";
  exportBtn.addEventListener("click", () => {
    const payload = exportStrongholdData();
    triggerDownload(getModuleExportFilename("stronghold"), payload);
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
        importStrongholdData(text);
        showNotification({
          title: "Stronghold imported",
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

  const resetBtn = document.createElement("button");
  resetBtn.type = "button";
  resetBtn.className = "button danger";
  resetBtn.textContent = "Reset Project";
  resetBtn.addEventListener("click", () => {
    if (window.confirm("Clear the current stronghold plan?")) {
      resetStrongholdState();
    }
  });

  const cancelBuildBtn = document.createElement("button");
  cancelBuildBtn.type = "button";
  cancelBuildBtn.className = "button danger";
  cancelBuildBtn.textContent = "Abort Build";
  cancelBuildBtn.hidden = true;
  cancelBuildBtn.addEventListener("click", () => {
    if (!window.confirm("Cancel the active construction timer?")) {
      return;
    }
    cancelStrongholdConstruction();
    showNotification({
      title: "Construction canceled",
      message: "Timer removed from the calendar.",
      variant: "info",
    });
  });

  actionGroup.append(buildBtn, exportBtn, importBtn, importInput, resetBtn, cancelBuildBtn);
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
    const activeProject = state.projects.find((project) => project.id === state.activeProjectId && project.status === "active");
    stats.push({
      label: "Active Build",
      value: activeProject ? activeProject.name : "Idle",
      meta: state.activeTrackerId ? "Tracking via calendar timer" : undefined,
    });

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
      if (stat.meta) {
        const meta = document.createElement("div");
        meta.className = "nav-meta";
        meta.textContent = stat.meta;
        statNode.appendChild(meta);
      }
      summaryGrid.appendChild(statNode);
    });
    return summary;
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

  function renderProjects(state: StrongholdState) {
    projectsList.innerHTML = "";
    
    if (state.projects.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.className = "muted stronghold-projects-empty";
      emptyMsg.textContent = "No stronghold projects yet. Import from Fantasy Log or start designing a new one.";
      projectsList.appendChild(emptyMsg);
      projectsSection.hidden = false;
      return;
    }
    
    projectsSection.hidden = false;
    
    // Group projects by status
    const byStatus = new Map<string, StrongholdProject[]>();
    for (const project of state.projects) {
      const list = byStatus.get(project.status) || [];
      list.push(project);
      byStatus.set(project.status, list);
    }
    
    // Order: active first, then planned, then complete
    const statusOrder = ["active", "planned", "complete"];
    
    for (const status of statusOrder) {
      const projects = byStatus.get(status);
      if (!projects || projects.length === 0) continue;
      
      for (const project of projects) {
        const card = document.createElement("div");
        card.className = "stronghold-project-card";
        if (project.id === state.activeProjectId) {
          card.classList.add("selected");
        }
        card.addEventListener("click", () => selectProject(project.id));
        
        const header = document.createElement("div");
        header.className = "stronghold-project-card-header";
        
        const name = document.createElement("span");
        name.className = "stronghold-project-name";
        name.textContent = project.name;
        
        const badge = document.createElement("span");
        badge.className = `badge ${getStatusBadgeClass(project.status)}`;
        badge.textContent = project.status.charAt(0).toUpperCase() + project.status.slice(1);
        
        header.append(name, badge);
        
        const meta = document.createElement("div");
        meta.className = "stronghold-project-meta";
        
        const cost = document.createElement("span");
        cost.textContent = `${project.cost.toLocaleString()} gp`;
        
        const days = document.createElement("span");
        days.textContent = `${project.buildDays} days`;
        
        const dateInfo = document.createElement("span");
        if (project.status === "complete" && project.completedAt) {
          dateInfo.textContent = `Completed: ${formatDate(project.completedAt)}`;
        } else if (project.startedAt) {
          dateInfo.textContent = `Started: ${formatDate(project.startedAt)}`;
        }
        
        meta.append(cost, days);
        if (dateInfo.textContent) {
          meta.appendChild(dateInfo);
        }
        
        card.append(header, meta);
        projectsList.appendChild(card);
      }
    }
  }

  function sync(state: StrongholdState) {
    renderProjects(state);
    syncName(state.projectName);
    syncTerrain(String(state.terrainMod));
    const summary = renderSummary(state);
    renderComponents(state);
    const hasPlan = summary.items.length > 0 && summary.buildDays > 0;
    const activeProject = state.projects.find((project) => project.id === state.activeProjectId && project.status === "active");
    const building = Boolean(state.activeTrackerId);
    buildBtn.disabled = !hasPlan || building;
    buildBtn.textContent = building ? "Construction In Progress" : "Start Construction";
    const lastComplete = state.projects.find((project) => project.status === "complete");
    cancelBuildBtn.hidden = !building;
    statusNotice.dataset.state = building ? "active" : "idle";
    if (building && activeProject) {
      statusNotice.textContent = `Building ${activeProject.name}. Track progress in the calendar.`;
    } else if (building) {
      statusNotice.textContent = "Construction running — track progress in the calendar.";
    } else if (lastComplete) {
      statusNotice.textContent = `Last completed: ${lastComplete.name}`;
    } else {
      statusNotice.textContent = "No builds underway.";
    }
  }

  const unsubscribe = subscribeToStronghold(sync);
  sync(getStrongholdState());

  return () => unsubscribe();
}

