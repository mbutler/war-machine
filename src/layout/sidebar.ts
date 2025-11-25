import type { RouteDefinition } from "../router";

interface SidebarControls {
  onSelectRoute: (routeId: string) => void;
  onExport: () => void;
  onImport: (payload: string) => void;
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
  exportButton.textContent = "Export Suite";
  exportButton.addEventListener("click", controls.onExport);

  const importButton = document.createElement("button");
  importButton.type = "button";
  importButton.className = "button";
  importButton.textContent = "Import Suite";

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.className = "visually-hidden";
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result?.toString() ?? "";
      controls.onImport(result);
      importInput.value = "";
    };
    reader.readAsText(file);
  });

  importButton.addEventListener("click", () => {
    importInput.click();
  });

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "button danger";
  clearButton.textContent = "Clear Data";
  clearButton.addEventListener("click", () => {
    if (window.confirm("Clear all War Machine data? This cannot be undone.")) {
      controls.onClear();
    }
  });

  actionsPanel.append(exportButton, importButton, clearButton);
  actionsPanel.appendChild(importInput);

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

        const label = document.createElement("span");
        label.className = "nav-label";
        label.textContent = route.label;

        const meta = document.createElement("span");
        meta.className = "nav-meta";
        meta.textContent = route.description ?? "";

        button.append(label, meta);
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

