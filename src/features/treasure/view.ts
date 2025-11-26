import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import type { TreasureHoard, TreasureState } from "../../state/schema";
import { TREASURE_TYPE_LIST, TREASURE_TYPES, type TreasureTypeKey } from "./data";
import {
  clearTreasureHistory,
  copyHoardToClipboard,
  getTreasureState,
  removeTreasureHoard,
  rollTreasureHoard,
  setTreasureType,
  subscribeToTreasure,
} from "./state";

const typeDefinitions = TREASURE_TYPE_LIST;

function formatGp(value: number): string {
  return `${Math.round(value).toLocaleString()} gp`;
}

export function renderTreasurePanel(target: HTMLElement) {
  const panel = createPanel("Treasure Hoard Generator", "Authentic BECMI treasure tables with gems, jewelry, and magic.");
  panel.body.classList.add("treasure-grid");

  const controlColumn = document.createElement("div");
  controlColumn.className = "treasure-column";

  const resultColumn = document.createElement("div");
  resultColumn.className = "treasure-column";

  panel.body.append(controlColumn, resultColumn);
  target.appendChild(panel.element);

  // Controls
  const controlCard = document.createElement("div");
  controlCard.className = "treasure-card";

  const typeField = document.createElement("div");
  typeField.className = "treasure-field";
  const typeLabel = document.createElement("label");
  typeLabel.className = "label";
  typeLabel.textContent = "Treasure Type";
  const typeSelect = document.createElement("select");
  typeSelect.className = "input";
  typeDefinitions.forEach((definition) => {
    const option = document.createElement("option");
    option.value = definition.key;
    option.textContent = definition.label;
    typeSelect.appendChild(option);
  });
  typeField.append(typeLabel, typeSelect);

  const typeDescription = document.createElement("p");
  typeDescription.className = "muted treasure-type-desc";

  typeSelect.addEventListener("change", () => {
    const value = typeSelect.value as TreasureTypeKey;
    setTreasureType(value);
    typeDescription.textContent = TREASURE_TYPES[value]?.description ?? "";
  });

  const generateButton = document.createElement("button");
  generateButton.type = "button";
  generateButton.className = "button";
  generateButton.textContent = "Generate Hoard";
  generateButton.addEventListener("click", () => {
    try {
      const hoard = rollTreasureHoard();
      showNotification({
        title: `${hoard.label} generated`,
        message: `Total value ${formatGp(hoard.totalValue)}`,
        variant: "success",
      });
    } catch (error) {
      showNotification({
        title: "Generation failed",
        message: (error as Error).message,
        variant: "danger",
      });
    }
  });

  const copyLatestButton = document.createElement("button");
  copyLatestButton.type = "button";
  copyLatestButton.className = "button";
  copyLatestButton.textContent = "Copy Latest";
  copyLatestButton.addEventListener("click", () => {
    const state = getTreasureState();
    if (!state.hoards.length) {
      showNotification({
        title: "Nothing to copy",
        message: "Generate a hoard first.",
        variant: "warning",
      });
      return;
    }
    copyHoardToClipboard(state.hoards[0])
      .then(() =>
        showNotification({
          title: "Copied",
          message: "Hoard details copied to clipboard.",
          variant: "success",
        }),
      )
      .catch(() =>
        showNotification({
          title: "Clipboard unavailable",
          message: "Your browser blocked clipboard access.",
          variant: "warning",
        }),
      );
  });

  const clearHistoryButton = document.createElement("button");
  clearHistoryButton.type = "button";
  clearHistoryButton.className = "button danger";
  clearHistoryButton.textContent = "Clear History";
  clearHistoryButton.addEventListener("click", () => {
    if (window.confirm("Clear all stored hoards?")) {
      clearTreasureHistory();
    }
  });

  const controlButtons = document.createElement("div");
  controlButtons.className = "treasure-actions";
  controlButtons.append(generateButton, copyLatestButton, clearHistoryButton);

  controlCard.append(typeField, typeDescription, controlButtons);
  controlColumn.appendChild(controlCard);

  // Result card
  const resultCard = document.createElement("div");
  resultCard.className = "treasure-card";
  const resultHeader = document.createElement("div");
  resultHeader.className = "section-title";
  resultHeader.textContent = "Latest Hoard";
  const resultBody = document.createElement("div");
  resultBody.className = "treasure-result";

  resultCard.append(resultHeader, resultBody);
  resultColumn.appendChild(resultCard);

  // History card
  const historyCard = document.createElement("div");
  historyCard.className = "treasure-card";
  const historyHeader = document.createElement("div");
  historyHeader.className = "section-title";
  historyHeader.textContent = "Recent Hoards";
  const historyList = document.createElement("div");
  historyList.className = "treasure-history";
  historyCard.append(historyHeader, historyList);
  resultColumn.appendChild(historyCard);

  function renderState(state: TreasureState) {
    syncType(state.selectedType);
    typeDescription.textContent = TREASURE_TYPES[state.selectedType as TreasureTypeKey]?.description ?? "";
    renderResult(state.hoards[0]);
    renderHistory(state.hoards);
  }

  function syncType(type: string) {
    if (typeSelect.value !== type) {
      typeSelect.value = type;
    }
  }

  function renderResult(hoard?: TreasureHoard) {
    resultBody.innerHTML = "";
    if (!hoard) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "No hoard generated yet.";
      resultBody.appendChild(empty);
      return;
    }

    const meta = document.createElement("div");
    meta.className = "treasure-meta";
    meta.innerHTML = `<div class="treasure-meta-title">${hoard.label}</div><div class="treasure-meta-value">${formatGp(
      hoard.totalValue,
    )}</div><div class="treasure-meta-sub">${new Date(hoard.createdAt).toLocaleString()}</div>`;
    resultBody.appendChild(meta);

    resultBody.appendChild(renderHoardSection("Coins", hoard.coins.map((coin) => `${coin.amount.toLocaleString()} ${coin.denomination.toUpperCase()} (${formatGp(coin.gpValue)})`)));
    resultBody.appendChild(
      renderHoardSection(
        "Gems",
        hoard.gems.map((item) => `${item.name} — ${formatGp(item.value)}`),
      ),
    );
    resultBody.appendChild(
      renderHoardSection(
        "Jewelry",
        hoard.jewelry.map((item) => `${item.name} — ${formatGp(item.value)}`),
      ),
    );
    resultBody.appendChild(
      renderHoardSection(
        "Magic Items",
        hoard.magic.map((item) => `${item.name} [${item.category}]`),
      ),
    );
  }

  function renderHoardSection(title: string, lines: string[]) {
    const section = document.createElement("div");
    section.className = "treasure-section";
    const heading = document.createElement("div");
    heading.className = "treasure-section-title";
    heading.textContent = title;
    section.appendChild(heading);

    if (!lines.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "None";
      section.appendChild(empty);
      return section;
    }

    const list = document.createElement("ul");
    list.className = "treasure-list";
    lines.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      list.appendChild(li);
    });
    section.appendChild(list);
    return section;
  }

  function renderHistory(hoards: TreasureHoard[]) {
    historyList.innerHTML = "";
    if (!hoards.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "History will appear here.";
      historyList.appendChild(empty);
      return;
    }

    hoards.forEach((hoard) => {
      const card = document.createElement("div");
      card.className = "treasure-history-item";

      const title = document.createElement("div");
      title.className = "treasure-history-title";
      title.textContent = `${hoard.label} • ${formatGp(hoard.totalValue)}`;

      const timestamp = document.createElement("div");
      timestamp.className = "treasure-history-sub";
      timestamp.textContent = new Date(hoard.createdAt).toLocaleString();

      const actions = document.createElement("div");
      actions.className = "treasure-history-actions";

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "button";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        copyHoardToClipboard(hoard)
          .then(() =>
            showNotification({
              title: "Copied",
              message: `${hoard.label} copied to clipboard.`,
              variant: "success",
            }),
          )
          .catch(() =>
            showNotification({
              title: "Clipboard unavailable",
              message: "Your browser blocked clipboard access.",
              variant: "warning",
            }),
          );
      });

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "button danger";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeTreasureHoard(hoard.id));

      actions.append(copyBtn, removeBtn);

      card.append(title, timestamp, actions);
      historyList.appendChild(card);
    });
  }

  const unsubscribe = subscribeToTreasure(renderState);
  renderState(getTreasureState());

  return () => unsubscribe();
}

