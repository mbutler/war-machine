import type { RouteDefinition } from "../router";
import { createSidebar } from "./sidebar";

interface ShellControls {
  onSelectRoute: (routeId: string) => void;
  onExport: () => void;
  onImport: (payload: string) => void;
  onClear: () => void;
}

export interface AppShell {
  contentRegion: HTMLElement;
  setRoutes: (routes: RouteDefinition[]) => void;
  setActiveRoute: (routeId: string) => void;
}

export function renderAppShell(root: HTMLElement, controls: ShellControls): AppShell {
  root.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.className = "app-wrapper";

  const sidebar = createSidebar(controls);
  wrapper.appendChild(sidebar.element);

  const contentRegion = document.createElement("main");
  contentRegion.className = "content-region";
  wrapper.appendChild(contentRegion);

  root.appendChild(wrapper);

  return {
    contentRegion,
    setRoutes: sidebar.setRoutes,
    setActiveRoute: sidebar.setActiveRoute,
  };
}

