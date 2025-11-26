import { createPanel } from "../../layout/panels";
import {
  subscribeToDungeon,
  getDungeonState,
  exploreRoom,
  searchRoom,
  restParty,
  resolveEncounter,
  resolveObstacle,
  lootRoom,
  bankLoot,
  clearLog,
  setDungeonDepth,
  toggleLairMode,
  syncDungeonWithParty,
  consumeTorch,
  consumeRation,
  applyEncounterDamage,
  setEncounterReaction,
  castSpellDuringDelve,
} from "./state";
import type { DungeonLogEntry, PartyState } from "../../state/schema";
import { getPartyState, subscribeToParty } from "../party/state";
import { calculatePartySnapshot } from "../party/resources";

export function renderDungeonPanel(target: HTMLElement) {
  const { element, body } = createPanel("Dungeon Delver", "BECMI delve simulator");
  element.classList.add("dungeon-shell");

  const layout = document.createElement("div");
  layout.style.display = "grid";
  layout.style.gridTemplateColumns = "320px 1fr 320px";
  layout.style.gap = "var(--panel-gap)";
  layout.style.width = "100%";
  layout.style.alignItems = "start";
  body.appendChild(layout);

  const rosterPanel = document.createElement("div");
  rosterPanel.className = "panel";
  layout.appendChild(rosterPanel);

  const midColumn = document.createElement("div");
  midColumn.className = "flex flex-col gap-sm";
  layout.appendChild(midColumn);

  const statusPanel = document.createElement("div");
  statusPanel.className = "panel compact";
  midColumn.appendChild(statusPanel);

  const controlsPanel = document.createElement("div");
  controlsPanel.className = "panel compact";
  midColumn.appendChild(controlsPanel);

  const logPanel = createPanel("Delver's Log", "Latest events underground");
  logPanel.body.classList.add("scrollbox");
  logPanel.body.style.maxHeight = "60vh";
  layout.appendChild(logPanel.element);

  function render(state = getDungeonState()) {
    const party = getPartyState();
    statusPanel.innerHTML = "";
    controlsPanel.innerHTML = "";
    renderStatus(statusPanel, state);
    renderControls(controlsPanel, state, party);
    renderLog(logPanel.body, state.log);
    renderRosterPanel(rosterPanel, party, state);
  }

  render();
  const unsubscribe = subscribeToDungeon(() => render());
  const unsubscribeParty = subscribeToParty(() => render());
  target.appendChild(element);
  syncDungeonWithParty();
  return () => {
    unsubscribe();
    unsubscribeParty();
  };
}

function renderStatus(container: HTMLElement, dungeon = getDungeonState()) {
  const grid = document.createElement("div");
  grid.className = "stat-grid";

  const stat = (label: string, value: string) => {
    const box = document.createElement("div");
    box.className = "stat";
    const lbl = document.createElement("div");
    lbl.className = "stat-label";
    lbl.textContent = label;
    const val = document.createElement("div");
    val.className = "stat-value";
    val.textContent = value;
    box.append(lbl, val);
    return box;
  };

  const nextWanderCheck = dungeon.turn % 2 === 0 ? 2 : 1;

  grid.append(
    stat("Depth", `Level ${dungeon.depth ?? 1}`),
    stat("Turn", `${dungeon.turn ?? 0}`),
    stat("Torches", `${dungeon.torches ?? 0}${dungeon.torchTurnsUsed ? ` (${6 - dungeon.torchTurnsUsed} turns left)` : ""}`),
    stat("Rations", `${dungeon.rations ?? 0}`),
    stat("Wander Check", `Next in ${nextWanderCheck} turn${nextWanderCheck === 1 ? "" : "s"}`),
    stat("Loot (gp)", `${dungeon.loot ?? 0}`),
    stat("Banked (gp)", `${dungeon.bankedGold ?? 0}`),
  );

  container.appendChild(grid);
}

function renderControls(container: HTMLElement, dungeon = getDungeonState(), party = getPartyState()) {
  const formRow = document.createElement("div");
  formRow.className = "stat-grid";

  const depthSelect = document.createElement("select");
  depthSelect.className = "input";
  [1, 2, 3, 5, 8].forEach((lvl) => {
    const option = document.createElement("option");
    option.value = String(lvl);
    option.textContent = `Level ${lvl}`;
    if (lvl === dungeon.depth) option.selected = true;
    depthSelect.appendChild(option);
  });
  depthSelect.addEventListener("change", () => setDungeonDepth(Number(depthSelect.value)));

  const lairToggle = document.createElement("label");
  lairToggle.className = "label";
  lairToggle.textContent = "Lair Mode";
  const lairInput = document.createElement("input");
  lairInput.type = "checkbox";
  lairInput.checked = dungeon.lairMode;
  lairInput.addEventListener("change", () => toggleLairMode(lairInput.checked));
  const lairWrapper = document.createElement("div");
  lairWrapper.className = "flex gap-sm";
  lairWrapper.appendChild(lairInput);
  lairWrapper.append("Increased treasure & danger");

  formRow.append(createField("Dungeon Depth", depthSelect), createField("Mode", lairWrapper));
  container.appendChild(formRow);

  const actionButtons = document.createElement("div");
  actionButtons.className = "flex flex-col gap-sm";

  if (dungeon.status === "idle") {
    actionButtons.append(
      makeButton("Explore New Room", "button", () => exploreRoom()),
      makeButton("Search the Area", "button", () => searchRoom()),
      makeButton("Rest & Eat", "button", () => restParty()),
    );
  }

  container.appendChild(actionButtons);

  if ((dungeon.status === "encounter" || dungeon.status === "loot") && dungeon.encounter) {
    container.appendChild(renderEncounterPanel(dungeon, party));
  } else if (dungeon.status === "obstacle" && dungeon.obstacle) {
    const obstaclePanel = document.createElement("div");
    obstaclePanel.className = "panel compact";
    const title = document.createElement("div");
    title.className = "panel-heading";
    title.textContent = `Obstacle: ${dungeon.obstacle.name}`;
    obstaclePanel.appendChild(title);
    const desc = document.createElement("p");
    desc.className = "muted";
    desc.textContent = dungeon.obstacle.description;
    obstaclePanel.appendChild(desc);
    const row = document.createElement("div");
    row.className = "flex gap-sm";
    row.append(
      makeButton("Force", "button", () => resolveObstacle("force")),
      makeButton("Careful", "button", () => resolveObstacle("careful")),
    );
    obstaclePanel.appendChild(row);
    container.appendChild(obstaclePanel);
  }

  const lootRow = document.createElement("div");
  lootRow.className = "flex gap-sm";
  lootRow.append(
    makeButton("Loot Room", "button", () => lootRoom()),
    makeButton("Bank Loot", "button", () => bankLoot()),
  );
  container.appendChild(lootRow);
}

function renderLog(container: HTMLElement, log: DungeonLogEntry[] = []) {
  container.innerHTML = "";
  if (!log.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "The darkness awaits...";
    container.appendChild(empty);
    return;
  }
  log.forEach((entry) => {
    const item = document.createElement("div");
    item.className = "log-entry";
    const header = document.createElement("div");
    header.className = "flex gap-sm";
    header.style.justifyContent = "space-between";
    const badge = document.createElement("span");
    badge.className = "chip";
    badge.textContent = entry.kind.toUpperCase();
    const time = document.createElement("span");
    time.className = "timestamp";
    time.textContent = new Date(entry.timestamp).toLocaleTimeString();
    header.append(badge, time);
    item.appendChild(header);
    const summary = document.createElement("div");
    summary.style.fontWeight = "bold";
    summary.textContent = entry.summary;
    item.appendChild(summary);
    if (entry.detail) {
      const detail = document.createElement("p");
      detail.className = "muted";
      detail.textContent = entry.detail;
      item.appendChild(detail);
    }
    container.appendChild(item);
  });

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "button";
  clearBtn.textContent = "Clear Log";
  clearBtn.addEventListener("click", () => clearLog());
  container.appendChild(clearBtn);
}

function createField(label: string, node: HTMLElement) {
  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col gap-sm";
  const lbl = document.createElement("label");
  lbl.className = "label";
  lbl.textContent = label;
  wrapper.append(lbl, node);
  return wrapper;
}

function makeButton(label: string, className: string, handler: () => void) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "button";
  btn.textContent = label;
  btn.addEventListener("click", handler);
  return btn;
}

function renderRosterPanel(container: HTMLElement, party: PartyState, dungeon = getDungeonState()) {
  container.innerHTML = "";
  const header = document.createElement("div");
  header.className = "panel-heading";
  header.textContent = "Expedition Party";
  container.appendChild(header);

  const syncButton = makeButton("Sync from Party", "button", () => syncDungeonWithParty());
  container.appendChild(syncButton);

  const summary = calculatePartySnapshot(party.roster);

  const resources = document.createElement("div");
  resources.className = "stat-grid";
  const statBox = (label: string, value: string) => {
    const stat = document.createElement("div");
    stat.className = "stat";
    const lbl = document.createElement("div");
    lbl.className = "stat-label";
    lbl.textContent = label;
    const val = document.createElement("div");
    val.className = "stat-value";
    val.textContent = value;
    stat.append(lbl, val);
    return stat;
  };
  resources.append(
    statBox("Torches", String(dungeon.torches ?? summary.summary.torches)),
    statBox("Rations", String(dungeon.rations ?? summary.summary.rations)),
    statBox("Encumbrance", `${summary.encumbrance.current} / ${summary.encumbrance.max} cn`),
  );
  container.appendChild(resources);

  const buttonsRow = document.createElement("div");
  buttonsRow.className = "flex gap-sm";
  buttonsRow.append(
    makeButton("Use Torch", "button", () => consumeTorch(1)),
    makeButton("Use Ration", "button", () => consumeRation(1)),
  );
  container.appendChild(buttonsRow);

  const rosterList = document.createElement("div");
  rosterList.className = "flex flex-col gap-sm";
  rosterList.style.maxHeight = "400px";
  rosterList.style.overflowY = "auto";

  if (party.roster.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No party loaded. Generate a party first.";
    rosterList.appendChild(empty);
  } else {
    party.roster.forEach((character) => {
      const card = document.createElement("div");
      card.className = "stat";
      const title = document.createElement("div");
      title.style.display = "flex";
      title.style.justifyContent = "space-between";
      const name = document.createElement("strong");
      name.textContent = character.name;
      const hp = document.createElement("span");
      hp.className = "nav-meta";
      hp.textContent = `${character.derivedStats.hp.current}/${character.derivedStats.hp.max} HP`;
      title.append(name, hp);

      const meta = document.createElement("div");
      meta.className = "nav-meta";
      meta.textContent = `Lvl ${character.level} ${character.className} • ${character.status.toUpperCase()}`;

      card.append(title, meta);
      rosterList.appendChild(card);
    });
  }

  container.appendChild(rosterList);
}

function renderEncounterPanel(dungeon = getDungeonState(), party = getPartyState()) {
  if (!dungeon.encounter) return document.createElement("div");
  const encounter = dungeon.encounter;
  const panel = document.createElement("div");
  panel.className = "panel compact";

  const header = document.createElement("div");
  header.className = "panel-heading";
  header.textContent = `Encounter: ${encounter.name}`;
  panel.appendChild(header);

  const badge = document.createElement("span");
  badge.className = "chip";
  badge.textContent = encounter.reaction.toUpperCase();
  panel.appendChild(badge);

  const info = document.createElement("p");
  info.className = "muted";
  info.textContent = `${encounter.quantity} foes · AC ${encounter.armorClass} · Morale ${encounter.morale}`;
  panel.appendChild(info);

  const hpTrack = document.createElement("div");
  hpTrack.className = "stat";
  const hpLabel = document.createElement("div");
  hpLabel.className = "stat-label";
  hpLabel.textContent = "Enemy HP";
  const hpValue = document.createElement("div");
  hpValue.className = "stat-value";
  hpValue.textContent = `${encounter.hp}/${encounter.hpMax}`;
  hpTrack.append(hpLabel, hpValue);
  panel.appendChild(hpTrack);

  const dmgRow = document.createElement("div");
  dmgRow.className = "flex gap-sm";
  const dmgInput = document.createElement("input");
  dmgInput.type = "number";
  dmgInput.className = "input";
  dmgInput.min = "1";
  dmgInput.value = "4";
  dmgInput.placeholder = "Damage";
  dmgRow.appendChild(dmgInput);
  dmgRow.appendChild(
    makeButton("Apply Damage", "button", () => {
      const amount = Number(dmgInput.value) || 0;
      if (amount > 0) {
        applyEncounterDamage(amount);
      }
    }),
  );
  panel.appendChild(dmgRow);

  const reactionRow = document.createElement("div");
  reactionRow.className = "flex gap-sm";
  ["hostile", "neutral", "friendly"].forEach((reaction) => {
    reactionRow.appendChild(
      makeButton(reaction, "button", () => setEncounterReaction(reaction as any)),
    );
  });
  panel.appendChild(reactionRow);

  const actions = document.createElement("div");
  actions.className = "flex gap-sm";
  actions.append(
    makeButton("Fight", "button", () => resolveEncounter("fight")),
    makeButton("Parley", "button", () => resolveEncounter("parley")),
    makeButton("Flee", "button", () => resolveEncounter("flee")),
  );
  panel.appendChild(actions);

  const casters = party.roster.filter((character) =>
    character.spells.known.some((spell) => spell.memorized && !spell.expended),
  );
  if (casters.length > 0) {
    const spellPanel = document.createElement("div");
    spellPanel.className = "stat";
    const lbl = document.createElement("div");
    lbl.className = "stat-label";
    lbl.textContent = "Available Spells";
    spellPanel.appendChild(lbl);
    casters.forEach((caster) => {
      const row = document.createElement("div");
      row.className = "flex flex-col gap-sm";
      const name = document.createElement("strong");
      name.textContent = caster.name;
      row.appendChild(name);
      caster.spells.known
        .filter((spell) => spell.memorized)
        .forEach((spell) => {
          const spellRow = document.createElement("div");
          spellRow.className = "flex gap-sm";
          spellRow.style.alignItems = "center";
          const label = document.createElement("span");
          label.className = "nav-meta";
          label.textContent = `${spell.name}${spell.expended ? " (used)" : ""}`;
          const castBtn = makeButton("Cast", "button", () => castSpellDuringDelve(caster.id, spell.name));
          castBtn.disabled = !!spell.expended;
          spellRow.append(label, castBtn);
          row.appendChild(spellRow);
        });
      spellPanel.appendChild(row);
    });
    panel.appendChild(spellPanel);
  }

  if (dungeon.status === "loot") {
    panel.appendChild(makeButton("Loot the Room", "button", () => lootRoom()));
  }

  return panel;
}

