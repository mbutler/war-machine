import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { Faction, FactionOperation, FactionRelationship, FactionState } from "../../state/schema";
import {
  addFaction,
  exportFactionData,
  FOCUS_ICONS,
  FOCUS_LABELS,
  getFactionState,
  getRelationship,
  getSelectedFaction,
  importFactionData,
  RELATIONSHIP_COLORS,
  RELATIONSHIP_LABELS,
  removeFaction,
  selectFaction,
  setRelationship,
  subscribeToFaction,
  updateFaction,
  updateOperation,
} from "./state";
import { getModuleExportFilename, triggerDownload } from "../../utils/moduleExport";

// ============================================================================
// Main Panel
// ============================================================================

export function renderFactionPanel(target: HTMLElement): () => void {
  target.innerHTML = "";

  const container = document.createElement("div");
  container.className = "faction-container";

  // Left column: Faction list
  const listColumn = document.createElement("div");
  listColumn.className = "faction-list-column";

  const listHeader = document.createElement("div");
  listHeader.className = "faction-list-header";
  listHeader.innerHTML = `
    <h3>Factions</h3>
    <button class="btn-add-faction" title="Add Faction">+</button>
  `;
  listColumn.appendChild(listHeader);

  const factionList = document.createElement("div");
  factionList.className = "faction-list";
  listColumn.appendChild(factionList);

  // Right column: Details
  const detailColumn = document.createElement("div");
  detailColumn.className = "faction-detail-column";

  container.appendChild(listColumn);
  container.appendChild(detailColumn);

  // Data actions panel
  const dataActionsPanel = createPanel("Data");
  dataActionsPanel.element.className = "panel faction-data-actions";
  dataActionsPanel.body.innerHTML = `
    <div class="button-row">
      <button id="faction-export">Export</button>
      <label class="file-button">
        Import
        <input type="file" id="faction-import" accept=".json" hidden>
      </label>
    </div>
  `;

  const wrapper = document.createElement("div");
  wrapper.className = "faction-wrapper";
  wrapper.appendChild(container);
  wrapper.appendChild(dataActionsPanel.element);
  target.appendChild(wrapper);

  // Event handlers
  const addBtn = listHeader.querySelector(".btn-add-faction") as HTMLButtonElement;
  addBtn.addEventListener("click", () => {
    const id = addFaction({
      name: "New Faction",
      focus: "trade",
      wealth: 100,
      power: 50,
      morale: 0,
      territory: [],
      attitude: {},
      enemies: [],
      allies: [],
      resourceNeeds: [],
    });
    selectFaction(id);
    showNotification("Faction created", "success");
  });

  const exportBtn = dataActionsPanel.body.querySelector("#faction-export") as HTMLButtonElement;
  exportBtn.addEventListener("click", () => {
    const json = exportFactionData();
    triggerDownload(json, getModuleExportFilename("faction"));
    showNotification("Faction data exported", "success");
  });

  const importInput = dataActionsPanel.body.querySelector("#faction-import") as HTMLInputElement;
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      importFactionData(text);
      showNotification("Faction data imported", "success");
    } catch (error) {
      showNotification(`Import failed: ${(error as Error).message}`, "error");
    }
    importInput.value = "";
  });

  function render(state: FactionState) {
    renderFactionList(factionList, state);
    renderFactionDetails(detailColumn, state);
  }

  render(getFactionState());
  return subscribeToFaction(render);
}

// ============================================================================
// Faction List
// ============================================================================

function renderFactionList(container: HTMLElement, state: FactionState) {
  container.innerHTML = "";

  if (state.factions.length === 0) {
    const empty = document.createElement("div");
    empty.className = "faction-empty";
    empty.innerHTML = `
      <p>No factions imported yet.</p>
      <p class="muted">Use "Import from Log" in the Data section to import factions from fantasy-log.</p>
    `;
    container.appendChild(empty);
    return;
  }

  // Group by focus
  const byFocus: Record<string, Faction[]> = {
    martial: [],
    trade: [],
    pious: [],
    arcane: [],
  };

  for (const faction of state.factions) {
    byFocus[faction.focus]?.push(faction) ?? (byFocus.martial.push(faction));
  }

  for (const focus of ["martial", "trade", "pious", "arcane"] as const) {
    const factions = byFocus[focus];
    if (factions.length === 0) continue;

    const group = document.createElement("div");
    group.className = "faction-group";

    const groupHeader = document.createElement("div");
    groupHeader.className = "faction-group-header";
    groupHeader.innerHTML = `${FOCUS_ICONS[focus]} ${FOCUS_LABELS[focus]} (${factions.length})`;
    group.appendChild(groupHeader);

    for (const faction of factions) {
      const card = createFactionCard(faction, state.selectedFactionId === faction.id);
      card.addEventListener("click", () => selectFaction(faction.id));
      group.appendChild(card);
    }

    container.appendChild(group);
  }
}

function createFactionCard(faction: Faction, isSelected: boolean): HTMLElement {
  const card = document.createElement("div");
  card.className = `faction-card ${isSelected ? "selected" : ""}`;

  const powerBar = Math.min(100, Math.max(0, faction.power));
  const moraleLabel = faction.morale > 0 ? `+${faction.morale}` : faction.morale.toString();

  card.innerHTML = `
    <div class="faction-card-header">
      <span class="faction-icon">${FOCUS_ICONS[faction.focus]}</span>
      <span class="faction-name">${faction.name}</span>
    </div>
    <div class="faction-card-stats">
      <div class="faction-stat">
        <span class="stat-label">Wealth</span>
        <span class="stat-value">${faction.wealth} gp</span>
      </div>
      <div class="faction-stat">
        <span class="stat-label">Morale</span>
        <span class="stat-value ${faction.morale > 0 ? "positive" : faction.morale < 0 ? "negative" : ""}">${moraleLabel}</span>
      </div>
    </div>
    <div class="faction-power-bar">
      <div class="faction-power-fill" style="width: ${powerBar}%"></div>
      <span class="faction-power-label">${faction.power}% Power</span>
    </div>
  `;

  return card;
}

// ============================================================================
// Faction Details
// ============================================================================

function renderFactionDetails(container: HTMLElement, state: FactionState) {
  container.innerHTML = "";

  const faction = getSelectedFaction();
  if (!faction) {
    const placeholder = document.createElement("div");
    placeholder.className = "faction-placeholder";
    placeholder.innerHTML = `
      <p>Select a faction to view details</p>
      <p class="muted">Or click + to create a new faction</p>
    `;
    container.appendChild(placeholder);
    return;
  }

  // Header with name and delete button
  const header = document.createElement("div");
  header.className = "faction-detail-header";
  header.innerHTML = `
    <div class="faction-detail-title">
      <span class="faction-icon large">${FOCUS_ICONS[faction.focus]}</span>
      <input type="text" class="faction-name-input" value="${faction.name}">
    </div>
    <button class="btn-delete-faction" title="Delete Faction">Delete</button>
  `;
  container.appendChild(header);

  const nameInput = header.querySelector(".faction-name-input") as HTMLInputElement;
  nameInput.addEventListener("change", () => {
    updateFaction(faction.id, { name: nameInput.value });
  });

  const deleteBtn = header.querySelector(".btn-delete-faction") as HTMLButtonElement;
  deleteBtn.addEventListener("click", () => {
    if (confirm(`Delete faction "${faction.name}"?`)) {
      removeFaction(faction.id);
      showNotification("Faction deleted", "success");
    }
  });

  // Stats section
  const statsPanel = createPanel("Statistics");
  renderFactionStats(statsPanel.body, faction);
  container.appendChild(statsPanel.element);

  // Relationships section
  const relPanel = createPanel("Relationships");
  renderFactionRelationships(relPanel.body, faction, state);
  container.appendChild(relPanel.element);

  // Territory section
  const terPanel = createPanel("Territory & Influence");
  renderFactionTerritory(terPanel.body, faction);
  container.appendChild(terPanel.element);

  // Operations section
  const opsPanel = createPanel("Active Operations");
  renderFactionOperations(opsPanel.body, faction, state);
  container.appendChild(opsPanel.element);

  // Notes section
  const notesPanel = createPanel("Notes");
  renderFactionNotes(notesPanel.body, faction);
  container.appendChild(notesPanel.element);
}

function renderFactionStats(container: HTMLElement, faction: Faction) {
  container.innerHTML = `
    <div class="faction-stats-grid">
      <div class="stat-row">
        <label>Focus</label>
        <select class="faction-focus-select">
          ${(["trade", "martial", "pious", "arcane"] as const)
            .map((f) => `<option value="${f}" ${faction.focus === f ? "selected" : ""}>${FOCUS_ICONS[f]} ${FOCUS_LABELS[f]}</option>`)
            .join("")}
        </select>
      </div>
      <div class="stat-row">
        <label>Wealth (gp)</label>
        <input type="number" class="faction-wealth-input" value="${faction.wealth}" min="0">
      </div>
      <div class="stat-row">
        <label>Power (0-100)</label>
        <input type="number" class="faction-power-input" value="${faction.power}" min="0" max="100">
      </div>
      <div class="stat-row">
        <label>Morale (-10 to +10)</label>
        <input type="number" class="faction-morale-input" value="${faction.morale}" min="-10" max="10">
      </div>
      <div class="stat-row">
        <label>Last Noted</label>
        <input type="text" class="faction-lastnoted-input" value="${faction.lastNoted ?? ""}" placeholder="Location...">
      </div>
      <div class="stat-row">
        <label>Resource Needs</label>
        <input type="text" class="faction-needs-input" value="${faction.resourceNeeds.join(", ")}" placeholder="timber, ore, etc.">
      </div>
    </div>
  `;

  const focusSelect = container.querySelector(".faction-focus-select") as HTMLSelectElement;
  focusSelect.addEventListener("change", () => {
    updateFaction(faction.id, { focus: focusSelect.value as Faction["focus"] });
  });

  const wealthInput = container.querySelector(".faction-wealth-input") as HTMLInputElement;
  wealthInput.addEventListener("change", () => {
    updateFaction(faction.id, { wealth: Math.max(0, parseInt(wealthInput.value) || 0) });
  });

  const powerInput = container.querySelector(".faction-power-input") as HTMLInputElement;
  powerInput.addEventListener("change", () => {
    updateFaction(faction.id, { power: Math.min(100, Math.max(0, parseInt(powerInput.value) || 0)) });
  });

  const moraleInput = container.querySelector(".faction-morale-input") as HTMLInputElement;
  moraleInput.addEventListener("change", () => {
    updateFaction(faction.id, { morale: Math.min(10, Math.max(-10, parseInt(moraleInput.value) || 0)) });
  });

  const lastNotedInput = container.querySelector(".faction-lastnoted-input") as HTMLInputElement;
  lastNotedInput.addEventListener("change", () => {
    updateFaction(faction.id, { lastNoted: lastNotedInput.value || undefined });
  });

  const needsInput = container.querySelector(".faction-needs-input") as HTMLInputElement;
  needsInput.addEventListener("change", () => {
    const needs = needsInput.value.split(",").map((s) => s.trim()).filter(Boolean);
    updateFaction(faction.id, { resourceNeeds: needs });
  });
}

function renderFactionRelationships(container: HTMLElement, faction: Faction, state: FactionState) {
  const otherFactions = state.factions.filter((f) => f.id !== faction.id);

  if (otherFactions.length === 0) {
    container.innerHTML = `<p class="muted">No other factions to relate to.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.className = "faction-rel-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Faction</th>
        <th>Status</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody") as HTMLTableSectionElement;

  for (const other of otherFactions) {
    const rel = getRelationship(faction.id, other.id);
    const status = rel?.status ?? "neutral";

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>
        <span class="faction-icon small">${FOCUS_ICONS[other.focus]}</span>
        ${other.name}
      </td>
      <td>
        <select class="rel-status-select" data-other="${other.id}">
          ${(["allied", "friendly", "neutral", "hostile", "war"] as const)
            .map((s) => `<option value="${s}" ${status === s ? "selected" : ""} style="color: ${RELATIONSHIP_COLORS[s]}">${RELATIONSHIP_LABELS[s]}</option>`)
            .join("")}
        </select>
      </td>
      <td>
        <input type="text" class="rel-reason-input" data-other="${other.id}" value="${rel?.reason ?? ""}" placeholder="Why...">
      </td>
    `;

    const statusSelect = row.querySelector(".rel-status-select") as HTMLSelectElement;
    statusSelect.style.color = RELATIONSHIP_COLORS[status];
    statusSelect.addEventListener("change", () => {
      const newStatus = statusSelect.value as FactionRelationship["status"];
      statusSelect.style.color = RELATIONSHIP_COLORS[newStatus];
      const reasonInput = row.querySelector(".rel-reason-input") as HTMLInputElement;
      setRelationship(faction.id, other.id, newStatus, reasonInput.value || undefined);
    });

    const reasonInput = row.querySelector(".rel-reason-input") as HTMLInputElement;
    reasonInput.addEventListener("change", () => {
      setRelationship(faction.id, other.id, statusSelect.value as FactionRelationship["status"], reasonInput.value || undefined);
    });

    tbody.appendChild(row);
  }

  container.appendChild(table);

  // Quick summary
  const allies = faction.allies.length;
  const enemies = faction.enemies.length;
  if (allies > 0 || enemies > 0) {
    const summary = document.createElement("div");
    summary.className = "faction-rel-summary";
    summary.innerHTML = `
      ${allies > 0 ? `<span class="allies">${allies} allies</span>` : ""}
      ${enemies > 0 ? `<span class="enemies">${enemies} enemies</span>` : ""}
    `;
    container.appendChild(summary);
  }
}

function renderFactionTerritory(container: HTMLElement, faction: Faction) {
  container.innerHTML = "";

  // Territory list
  const terList = document.createElement("div");
  terList.className = "faction-territory-list";

  if (faction.territory.length === 0) {
    terList.innerHTML = `<p class="muted">No controlled territory.</p>`;
  } else {
    terList.innerHTML = `
      <p><strong>Controlled Locations:</strong></p>
      <ul class="territory-list">
        ${faction.territory.map((t) => `<li>${t}</li>`).join("")}
      </ul>
    `;
  }
  container.appendChild(terList);

  // Attitude map
  const attitudeEntries = Object.entries(faction.attitude);
  if (attitudeEntries.length > 0) {
    const attDiv = document.createElement("div");
    attDiv.className = "faction-attitudes";
    attDiv.innerHTML = `
      <p><strong>Attitudes:</strong></p>
      <div class="attitude-grid">
        ${attitudeEntries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([target, value]) => {
            const color = value > 0 ? "#22c55e" : value < 0 ? "#ef4444" : "#94a3b8";
            const sign = value > 0 ? "+" : "";
            return `<div class="attitude-entry">
              <span class="attitude-target">${target}</span>
              <span class="attitude-value" style="color: ${color}">${sign}${value}</span>
            </div>`;
          })
          .join("")}
      </div>
      ${attitudeEntries.length > 10 ? `<p class="muted">...and ${attitudeEntries.length - 10} more</p>` : ""}
    `;
    container.appendChild(attDiv);
  }
}

function renderFactionOperations(container: HTMLElement, faction: Faction, state: FactionState) {
  const operations = state.operations.filter((o) => o.participants.includes(faction.id) || o.target === faction.id);

  if (operations.length === 0) {
    container.innerHTML = `<p class="muted">No active operations.</p>`;
    return;
  }

  const list = document.createElement("div");
  list.className = "faction-operations-list";

  for (const op of operations) {
    const card = document.createElement("div");
    card.className = `operation-card ${op.status}`;

    const statusIcon = op.status === "active" ? "[...]" : op.status === "complete" ? "[OK]" : op.status === "failed" ? "[X]" : "[--]";
    const typeLabel = op.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    card.innerHTML = `
      <div class="operation-header">
        <span class="operation-type">${typeLabel}</span>
        <span class="operation-status">${statusIcon} ${op.status}</span>
      </div>
      <div class="operation-target">Target: ${op.target}</div>
      <div class="operation-meta">
        <span>${op.secret ? "Covert" : "Open"}</span>
        <span>${op.resources} gp committed</span>
        <span>${op.successChance}% chance</span>
      </div>
    `;

    if (op.status === "active") {
      const actions = document.createElement("div");
      actions.className = "operation-actions";
      actions.innerHTML = `
        <button class="btn-complete">Complete</button>
        <button class="btn-fail">Fail</button>
        <button class="btn-cancel">Cancel</button>
      `;
      actions.querySelector(".btn-complete")?.addEventListener("click", () => {
        updateOperation(op.id, { status: "complete" });
      });
      actions.querySelector(".btn-fail")?.addEventListener("click", () => {
        updateOperation(op.id, { status: "failed" });
      });
      actions.querySelector(".btn-cancel")?.addEventListener("click", () => {
        updateOperation(op.id, { status: "cancelled" });
      });
      card.appendChild(actions);
    }

    list.appendChild(card);
  }

  container.appendChild(list);
}

function renderFactionNotes(container: HTMLElement, faction: Faction) {
  container.innerHTML = `
    <textarea class="faction-notes" placeholder="Add notes about this faction...">${faction.notes ?? ""}</textarea>
  `;

  const textarea = container.querySelector(".faction-notes") as HTMLTextAreaElement;
  textarea.addEventListener("change", () => {
    updateFaction(faction.id, { notes: textarea.value || undefined });
  });
}
