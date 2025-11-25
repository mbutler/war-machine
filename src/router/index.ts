export type RouteSection =
  | "Characters"
  | "Domain"
  | "Exploration"
  | "Logistics"
  | "Siege"
  | "Arcana"
  | "Timekeeping";

export type MountResult = void | (() => void);

export interface RouteDefinition {
  id: string;
  label: string;
  description?: string;
  section: RouteSection;
  order?: number;
  mount: (target: HTMLElement) => MountResult;
}

interface StartRouterOptions {
  container: HTMLElement;
  onRouteChange?: (route: RouteDefinition) => void;
}

const routes: RouteDefinition[] = [];
let activeRoute: RouteDefinition | null = null;
let activeCleanup: (() => void) | null = null;

export function registerRoute(route: RouteDefinition) {
  if (routes.find((entry) => entry.id === route.id)) {
    throw new Error(`Route with id "${route.id}" already registered`);
  }
  routes.push(route);
  routes.sort((a, b) => {
    const aOrder = a.order ?? 100;
    const bOrder = b.order ?? 100;
    if (a.section === b.section) {
      return aOrder - bOrder || a.label.localeCompare(b.label);
    }
    return a.section.localeCompare(b.section);
  });
}

export function getRoutes(): RouteDefinition[] {
  return [...routes];
}

export function startRouter(options: StartRouterOptions) {
  if (!routes.length) {
    throw new Error("No routes registered");
  }

  function resolveRouteFromHash(): RouteDefinition {
    const hash = window.location.hash.replace(/^#\/?/, "");
    const found = routes.find((route) => route.id === hash);
    return found || routes[0];
  }

  function activateRoute(route: RouteDefinition) {
    if (activeRoute?.id === route.id) {
      return;
    }

    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }

    options.container.innerHTML = "";
    const cleanup = route.mount(options.container);
    activeCleanup = typeof cleanup === "function" ? cleanup : null;
    activeRoute = route;
    options.onRouteChange?.(route);
  }

  function handleHashChange() {
    const route = resolveRouteFromHash();
    const hash = window.location.hash.replace(/^#\/?/, "");
    if (!hash || hash !== route.id) {
      window.location.hash = route.id;
    }
    activateRoute(route);
  }

  window.addEventListener("hashchange", handleHashChange);
  handleHashChange();
}

