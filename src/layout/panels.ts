export interface PanelParts {
  element: HTMLElement;
  body: HTMLElement;
}

export function createPanel(title: string, description?: string): PanelParts {
  const panel = document.createElement("section");
  panel.className = "panel";

  const heading = document.createElement("div");
  heading.className = "panel-heading";
  heading.textContent = title;
  panel.appendChild(heading);

  if (description) {
    const desc = document.createElement("p");
    desc.className = "muted";
    desc.textContent = description;
    panel.appendChild(desc);
  }

  const body = document.createElement("div");
  body.className = "panel-body";
  panel.appendChild(body);

  return { element: panel, body };
}

