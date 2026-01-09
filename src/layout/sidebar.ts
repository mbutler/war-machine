import type { RouteDefinition } from "../router";
import { showModal, closeModal } from "./modal";

interface SidebarControls {
  onSelectRoute: (routeId: string) => void;
  onExport: () => void;
  onImport: (payload: string) => void;
  onImportFromLog: (worldJson: string | null, eventsJsonl: string | null) => void;
  onClear: () => void;
}

interface SidebarApi {
  element: HTMLElement;
  setRoutes: (routes: RouteDefinition[]) => void;
  setActiveRoute: (routeId: string) => void;
}

export function createSidebar(controls: SidebarControls): SidebarApi {
  const container = document.createElement("aside");
  container.className = "sidebar";

  const navPanel = document.createElement("div");
  navPanel.className = "sidebar-panel";

  const actionsPanel = document.createElement("div");
  actionsPanel.className = "sidebar-panel";

  const actionTitle = document.createElement("div");
  actionTitle.className = "sidebar-title";
  actionTitle.textContent = "Data";
  actionsPanel.appendChild(actionTitle);

  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "button";
  exportButton.textContent = "Export Campaign";
  exportButton.addEventListener("click", controls.onExport);

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "button";
  importButton.textContent = "Import Campaign";

  importButton.addEventListener("click", () => {
    showImportCampaignModal(controls.onImport);
  });

  function showImportCampaignModal(onImport: (payload: string) => void) {
    const content = document.createElement("div");
    content.style.cssText = "display: flex; flex-direction: column; gap: 1rem;";

    // Description
    const desc = document.createElement("p");
    desc.style.cssText = "margin: 0; color: var(--text-secondary);";
    desc.textContent = "Import a previously exported War Machine campaign file (.json).";
    content.appendChild(desc);

    // Campaign file picker
    const fileGroup = document.createElement("div");
    fileGroup.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem;";
    
    const fileLabel = document.createElement("label");
    fileLabel.style.cssText = "font-weight: 500;";
    fileLabel.textContent = "Campaign File";
    
    const fileInputWrapper = document.createElement("div");
    fileInputWrapper.style.cssText = "display: flex; gap: 0.5rem; align-items: center;";
    
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.cssText = "flex: 1;";
    
    const fileStatus = document.createElement("span");
    fileStatus.style.cssText = "font-size: 0.875rem; color: var(--text-secondary);";
    fileStatus.textContent = "No file selected";
    
    fileInputWrapper.append(fileInput, fileStatus);
    fileGroup.append(fileLabel, fileInputWrapper);
    content.appendChild(fileGroup);

    // Buttons
    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;";
    
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "button";
    cancelBtn.textContent = "Cancel";
    
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "button primary";
    importBtn.textContent = "Import";
    importBtn.disabled = true;
    
    buttonRow.append(cancelBtn, importBtn);
    content.appendChild(buttonRow);

    // Track file contents
    let campaignJson: string | null = null;

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (!file) {
        fileStatus.textContent = "No file selected";
        fileStatus.style.color = "var(--text-secondary)";
        campaignJson = null;
        importBtn.disabled = true;
        return;
      }
      fileStatus.textContent = `Loading ${file.name}...`;
      const reader = new FileReader();
      reader.onload = () => {
        campaignJson = reader.result?.toString() ?? null;
        fileStatus.textContent = campaignJson ? `Loaded: ${file.name}` : "Failed to load";
        fileStatus.style.color = campaignJson ? "var(--success)" : "var(--danger)";
        importBtn.disabled = !campaignJson;
      };
      reader.onerror = () => {
        fileStatus.textContent = "Failed to load";
        fileStatus.style.color = "var(--danger)";
        campaignJson = null;
        importBtn.disabled = true;
      };
      reader.readAsText(file);
    });

    const close = showModal({
      title: "Import Campaign",
      content,
    });

    cancelBtn.addEventListener("click", close);
    
    importBtn.addEventListener("click", () => {
      if (campaignJson) {
        close();
        onImport(campaignJson);
      }
    });
  }

  // Import from Fantasy Log button
  const importLogButton = document.createElement("button");
  importLogButton.type = "button";
  importLogButton.className = "button";
  importLogButton.textContent = "Import from Log";

  importLogButton.addEventListener("click", () => {
    showImportLogModal(controls.onImportFromLog);
  });

  function showImportLogModal(onImport: (worldJson: string | null, eventsJsonl: string | null) => void) {
    const content = document.createElement("div");
    content.className = "import-log-modal";
    content.style.cssText = "display: flex; flex-direction: column; gap: 1rem;";

    // Description
    const desc = document.createElement("p");
    desc.style.cssText = "margin: 0; color: var(--text-secondary);";
    desc.textContent = "Import world state and event history from the Fantasy Log simulator. Select one or both files.";
    content.appendChild(desc);

    // World.json file picker
    const worldGroup = document.createElement("div");
    worldGroup.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem;";
    
    const worldLabel = document.createElement("label");
    worldLabel.style.cssText = "font-weight: 500;";
    worldLabel.textContent = "World State (world.json)";
    
    const worldInputWrapper = document.createElement("div");
    worldInputWrapper.style.cssText = "display: flex; gap: 0.5rem; align-items: center;";
    
    const worldInput = document.createElement("input");
    worldInput.type = "file";
    worldInput.accept = ".json";
    worldInput.style.cssText = "flex: 1;";
    
    const worldStatus = document.createElement("span");
    worldStatus.style.cssText = "font-size: 0.875rem; color: var(--text-secondary);";
    worldStatus.textContent = "No file selected";
    
    worldInputWrapper.append(worldInput, worldStatus);
    worldGroup.append(worldLabel, worldInputWrapper);
    content.appendChild(worldGroup);

    // Events.jsonl file picker
    const eventsGroup = document.createElement("div");
    eventsGroup.style.cssText = "display: flex; flex-direction: column; gap: 0.5rem;";
    
    const eventsLabel = document.createElement("label");
    eventsLabel.style.cssText = "font-weight: 500;";
    eventsLabel.textContent = "Event Log (events.jsonl)";
    
    const eventsInputWrapper = document.createElement("div");
    eventsInputWrapper.style.cssText = "display: flex; gap: 0.5rem; align-items: center;";
    
    const eventsInput = document.createElement("input");
    eventsInput.type = "file";
    eventsInput.accept = ".jsonl";
    eventsInput.style.cssText = "flex: 1;";
    
    const eventsStatus = document.createElement("span");
    eventsStatus.style.cssText = "font-size: 0.875rem; color: var(--text-secondary);";
    eventsStatus.textContent = "No file selected";
    
    eventsInputWrapper.append(eventsInput, eventsStatus);
    eventsGroup.append(eventsLabel, eventsInputWrapper);
    content.appendChild(eventsGroup);

    // Buttons
    const buttonRow = document.createElement("div");
    buttonRow.style.cssText = "display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;";
    
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "button";
    cancelBtn.textContent = "Cancel";
    
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "button primary";
    importBtn.textContent = "Import";
    importBtn.disabled = true;
    
    buttonRow.append(cancelBtn, importBtn);
    content.appendChild(buttonRow);

    // Track file contents
    let worldJson: string | null = null;
    let eventsJsonl: string | null = null;

    function updateImportButton() {
      importBtn.disabled = worldJson === null && eventsJsonl === null;
    }

    worldInput.addEventListener("change", () => {
      const file = worldInput.files?.[0];
      if (!file) {
        worldStatus.textContent = "No file selected";
        worldJson = null;
        updateImportButton();
        return;
      }
      worldStatus.textContent = `Loading ${file.name}...`;
      const reader = new FileReader();
      reader.onload = () => {
        worldJson = reader.result?.toString() ?? null;
        worldStatus.textContent = worldJson ? `✓ ${file.name}` : "Failed to load";
        worldStatus.style.color = worldJson ? "var(--success)" : "var(--danger)";
        updateImportButton();
      };
      reader.onerror = () => {
        worldStatus.textContent = "Failed to load";
        worldStatus.style.color = "var(--danger)";
        worldJson = null;
        updateImportButton();
      };
      reader.readAsText(file);
    });

    eventsInput.addEventListener("change", () => {
      const file = eventsInput.files?.[0];
      if (!file) {
        eventsStatus.textContent = "No file selected";
        eventsJsonl = null;
        updateImportButton();
        return;
      }
      eventsStatus.textContent = `Loading ${file.name}...`;
      const reader = new FileReader();
      reader.onload = () => {
        eventsJsonl = reader.result?.toString() ?? null;
        eventsStatus.textContent = eventsJsonl ? `✓ ${file.name}` : "Failed to load";
        eventsStatus.style.color = eventsJsonl ? "var(--success)" : "var(--danger)";
        updateImportButton();
      };
      reader.onerror = () => {
        eventsStatus.textContent = "Failed to load";
        eventsStatus.style.color = "var(--danger)";
        eventsJsonl = null;
        updateImportButton();
      };
      reader.readAsText(file);
    });

    const close = showModal({
      title: "Import from Fantasy Log",
      content,
    });

    cancelBtn.addEventListener("click", close);
    
    importBtn.addEventListener("click", () => {
      console.log("[sidebar] Import button clicked");
      console.log("[sidebar] worldJson:", worldJson ? `${worldJson.length} chars` : "null");
      console.log("[sidebar] eventsJsonl:", eventsJsonl ? `${eventsJsonl.length} chars` : "null");
      close();
      onImport(worldJson, eventsJsonl);
    });
  }

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "button danger";
  clearButton.textContent = "Clear Data";
  clearButton.addEventListener("click", () => {
    if (window.confirm("Clear all War Machine data? This cannot be undone.")) {
      controls.onClear();
    }
  });

  actionsPanel.append(exportButton, importButton, importLogButton, clearButton);

  container.append(navPanel, actionsPanel);

  const routeElements = new Map<string, HTMLButtonElement>();

  function setRoutes(routes: RouteDefinition[]) {
    navPanel.innerHTML = "";
    routeElements.clear();

    const groups = new Map<string, RouteDefinition[]>();
    routes.forEach((route) => {
      const group = groups.get(route.section) ?? [];
      group.push(route);
      groups.set(route.section, group);
    });

    [...groups.entries()].forEach(([section, items]) => {
      const title = document.createElement("div");
      title.className = "sidebar-title";
      title.textContent = section;
      navPanel.appendChild(title);

      const list = document.createElement("div");
      list.className = "nav-list";
      navPanel.appendChild(list);

      items.forEach((route) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "nav-button";
        button.dataset.routeId = route.id;
        button.dataset.active = "false";
        button.textContent = route.label;
        button.addEventListener("click", () => controls.onSelectRoute(route.id));

        list.appendChild(button);
        routeElements.set(route.id, button);
      });
    });
  }

  function setActiveRoute(routeId: string) {
    routeElements.forEach((element, id) => {
      element.dataset.active = id === routeId ? "true" : "false";
    });
  }

  return {
    element: container,
    setRoutes,
    setActiveRoute,
  };
}

