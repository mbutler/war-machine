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
  attemptReturn,
  continueReturn,
  clearLog,
  setDungeonDepth,
  setLighting,
  toggleLairMode,
  syncDungeonWithParty,
  resetDungeonState,
  consumeTorch,
  consumeRation,
  applyEncounterDamage,
  setEncounterReaction,
  castSpellDuringDelve,
  evadeEncounter,
} from "./state";
import type { DungeonLogEntry, PartyState, LightingCondition, EncounterReaction, DungeonObstacle } from "../../state/schema";
import { getPartyState, subscribeToParty } from "../party/state";
import { calculatePartySnapshot } from "../party/resources";
import { getLedgerBalance } from "../ledger/state";

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

  const stat = (label: string, value: string, highlight?: boolean) => {
    const box = document.createElement("div");
    box.className = "stat";
    if (highlight) box.style.borderColor = "var(--accent-a)";
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
  
  // Light level indicator
  const lightingLabel = {
    bright: "🔆 Bright",
    dim: "🕯️ Dim",
    dark: "⬛ Dark"
  }[dungeon.lighting];

  grid.append(
    stat("Depth", `Level ${dungeon.depth ?? 1}`),
    stat("Turn", `${dungeon.turn ?? 0}`),
    stat("Lighting", lightingLabel, dungeon.lighting === "dark"),
    stat("Torches", `${dungeon.torches ?? 0}${dungeon.torchTurnsUsed ? ` (${6 - dungeon.torchTurnsUsed} turns left)` : ""}`),
    stat("Rations", `${dungeon.rations ?? 0}`),
    stat("Wander Check", `Next in ${nextWanderCheck} turn${nextWanderCheck === 1 ? "" : "s"}`),
    stat("Loot (gp)", `${dungeon.loot ?? 0}`),
    stat("Treasury (gp)", `${getLedgerBalance()}`),
  );

  container.appendChild(grid);
  
  // Status indicator
  if (dungeon.status !== "idle") {
    const statusBadge = document.createElement("div");
    statusBadge.className = "chip";
    statusBadge.style.marginTop = "var(--space-sm)";
    statusBadge.textContent = dungeon.status.toUpperCase();
    if (dungeon.status === "surprise") {
      statusBadge.style.background = "var(--accent-c)";
      statusBadge.style.color = "#000";
      statusBadge.textContent = "⚡ TACTICAL ADVANTAGE";
    }
    container.appendChild(statusBadge);
  }
}

function renderControls(container: HTMLElement, dungeon = getDungeonState(), party = getPartyState()) {
  const formRow = document.createElement("div");
  formRow.className = "stat-grid";

  // Depth selector
  const depthSelect = document.createElement("select");
  depthSelect.className = "input";
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((lvl) => {
    const option = document.createElement("option");
    option.value = String(lvl);
    option.textContent = `Level ${lvl}`;
    if (lvl === dungeon.depth) option.selected = true;
    depthSelect.appendChild(option);
  });
  depthSelect.addEventListener("change", () => setDungeonDepth(Number(depthSelect.value)));

  // Lighting selector
  const lightingSelect = document.createElement("select");
  lightingSelect.className = "input";
  (["bright", "dim", "dark"] as LightingCondition[]).forEach((light) => {
    const option = document.createElement("option");
    option.value = light;
    option.textContent = light.charAt(0).toUpperCase() + light.slice(1);
    if (light === dungeon.lighting) option.selected = true;
    lightingSelect.appendChild(option);
  });
  lightingSelect.addEventListener("change", () => setLighting(lightingSelect.value as LightingCondition));
  
  // Disable lighting change if no torches and not bright
  if (dungeon.torches === 0 && dungeon.lighting === "dark") {
    lightingSelect.disabled = true;
    lightingSelect.title = "No light sources available";
  }

  // Lair mode toggle
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

  formRow.append(
    createField("Dungeon Depth", depthSelect), 
    createField("Lighting", lightingSelect),
    createField("Mode", lairWrapper)
  );
  container.appendChild(formRow);

  // Reset dungeon button - separate section for clarity
  const resetSection = document.createElement("div");
  resetSection.className = "flex gap-sm";
  resetSection.style.marginTop = "var(--space-sm)";
  resetSection.style.paddingTop = "var(--space-sm)";
  resetSection.style.borderTop = "1px solid var(--border-color)";
  resetSection.appendChild(makeButton("🔄 New Dungeon", "button", () => resetDungeonState()));
  container.appendChild(resetSection);

  const actionButtons = document.createElement("div");
  actionButtons.className = "flex flex-col gap-sm";

  if (dungeon.status === "idle") {
    const buttons = [makeButton("Explore New Room", "button", () => exploreRoom())];

    // Only show search button if room hasn't been searched yet
    if (!dungeon.roomSearched) {
      buttons.push(makeButton("Search the Area", "button", () => searchRoom()));
    }

    buttons.push(makeButton("Rest & Eat", "button", () => restParty()));

    actionButtons.append(...buttons);
  }

  container.appendChild(actionButtons);

  // Surprise state - party has tactical advantage
  if (dungeon.status === "surprise" && dungeon.encounter) {
    container.appendChild(renderSurprisePanel(dungeon, party));
  }
  // Normal encounter or loot state
  else if ((dungeon.status === "encounter" || dungeon.status === "loot") && dungeon.encounter) {
    container.appendChild(renderEncounterPanel(dungeon, party));
  } 
  // Obstacle state
  else if (dungeon.status === "obstacle" && dungeon.obstacle) {
    container.appendChild(renderObstaclePanel(dungeon.obstacle, party));
  }

  // Return to surface section
  if (dungeon.turn > 0 && dungeon.loot > 0) {
    const returnSection = document.createElement("div");
    returnSection.className = "panel compact";
    returnSection.style.marginTop = "var(--space-sm)";
    returnSection.style.borderColor = "rgba(34, 197, 94, 0.5)";
    
    const returnHeader = document.createElement("div");
    returnHeader.className = "panel-heading";
    returnHeader.textContent = "🏠 Return to Surface";
    returnSection.appendChild(returnHeader);
    
    const turnsToExit = dungeon.depth * 3;
    const numChecks = Math.ceil(turnsToExit / 2);
    
    const returnInfo = document.createElement("p");
    returnInfo.className = "muted";
    returnInfo.style.fontSize = "0.85em";
    returnInfo.innerHTML = `
      <strong>Current loot:</strong> ${dungeon.loot} gp<br>
      <strong>Time to exit:</strong> ~${turnsToExit} turns (${turnsToExit * 10} minutes)<br>
      <strong>Wandering monster checks:</strong> ${numChecks} (1-in-6 each)<br>
      <strong>Danger level:</strong> ${Math.round((1 - Math.pow(5/6, numChecks)) * 100)}% chance of encounter
    `;
    returnSection.appendChild(returnInfo);
    
    const returnBtn = makeButton("⬆️ Attempt Return Journey", "button", () => attemptReturn());
    returnBtn.style.width = "100%";
    returnBtn.style.marginTop = "var(--space-sm)";
    returnSection.appendChild(returnBtn);
    
    container.appendChild(returnSection);
  } else if (dungeon.turn === 0 && dungeon.loot > 0) {
    // At surface with loot - just bank it
    const bankRow = document.createElement("div");
    bankRow.className = "flex gap-sm";
    bankRow.append(
      makeButton("💰 Secure Loot", "button", () => bankLoot()),
    );
    container.appendChild(bankRow);
  }
}

function renderSurprisePanel(dungeon = getDungeonState(), party = getPartyState()) {
  if (!dungeon.encounter) return document.createElement("div");
  const encounter = dungeon.encounter;
  
  const panel = document.createElement("div");
  panel.className = "panel compact";
  panel.style.borderColor = "var(--accent-c)";

  const header = document.createElement("div");
  header.className = "panel-heading";
  header.textContent = `⚡ Surprise: ${encounter.name}`;
  panel.appendChild(header);

  const info = document.createElement("p");
  info.className = "muted";
  info.textContent = `${encounter.quantity} foes at ${encounter.distance}' - You have the drop on them!`;
  panel.appendChild(info);
  
  const description = document.createElement("p");
  description.style.fontSize = "0.85em";
  description.innerHTML = `
    <strong>Options:</strong><br>
    • <strong>Evade</strong> - Slip away unnoticed (automatic success)<br>
    • <strong>Ambush</strong> - Attack with a free round before they can react<br>
    • <strong>Approach</strong> - Reveal yourselves and attempt negotiation
  `;
  panel.appendChild(description);

  const actions = document.createElement("div");
  actions.className = "flex gap-sm";
  actions.append(
    makeButton("🚪 Evade", "button", () => evadeEncounter()),
    makeButton("⚔️ Ambush", "button", () => {
      // Grant free attack round, then continue to encounter
      resolveEncounter("fight");
    }),
    makeButton("🤝 Approach", "button", () => {
      // Reveal and attempt parley - reaction may change
      resolveEncounter("parley");
    }),
  );
  panel.appendChild(actions);

  return panel;
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

  // Reaction badge with color coding
  const badge = document.createElement("span");
  badge.className = "chip";
  badge.textContent = encounter.reaction.toUpperCase();
  badge.style.background = getReactionColor(encounter.reaction);
  badge.style.color = "#000";
  panel.appendChild(badge);

  // Info row with distance
  const info = document.createElement("p");
  info.className = "muted";
  info.textContent = `${encounter.quantity} foes · AC ${encounter.armorClass} · Morale ${encounter.morale} · ${encounter.distance}' away`;
  panel.appendChild(info);
  
  // Special abilities if any
  if (encounter.special) {
    const special = document.createElement("p");
    special.style.fontSize = "0.85em";
    special.style.color = "var(--accent-a)";
    special.textContent = `⚠️ Special: ${encounter.special}`;
    panel.appendChild(special);
  }

  // HP Track
  const hpTrack = document.createElement("div");
  hpTrack.className = "stat";
  const hpLabel = document.createElement("div");
  hpLabel.className = "stat-label";
  hpLabel.textContent = "Enemy HP";
  const hpValue = document.createElement("div");
  hpValue.className = "stat-value";
  const hpPercent = Math.round((encounter.hp / encounter.hpMax) * 100);
  hpValue.textContent = `${encounter.hp}/${encounter.hpMax} (${hpPercent}%)`;
  if (hpPercent <= 25) hpValue.style.color = "var(--accent-a)";
  else if (hpPercent <= 50) hpValue.style.color = "var(--accent-c)";
  hpTrack.append(hpLabel, hpValue);
  panel.appendChild(hpTrack);

  // Manual damage input
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

  // Reaction adjustment buttons
  const reactionLabel = document.createElement("div");
  reactionLabel.className = "stat-label";
  reactionLabel.textContent = "Adjust Reaction";
  panel.appendChild(reactionLabel);
  
  const reactionRow = document.createElement("div");
  reactionRow.className = "flex gap-sm";
  (["hostile", "aggressive", "cautious", "neutral", "friendly"] as EncounterReaction[]).forEach((reaction) => {
    const btn = makeButton(reaction, "button", () => setEncounterReaction(reaction));
    if (reaction === encounter.reaction) {
      btn.style.background = getReactionColor(reaction);
    }
    btn.style.fontSize = "0.75em";
    btn.style.padding = "0.25em 0.5em";
    reactionRow.appendChild(btn);
  });
  panel.appendChild(reactionRow);

  // Combat action buttons (only in encounter state)
  if (dungeon.status === "encounter") {
    const actions = document.createElement("div");
    actions.className = "flex gap-sm";
    actions.style.marginTop = "var(--space-sm)";
    actions.append(
      makeButton("⚔️ Fight", "button", () => resolveEncounter("fight")),
      makeButton("🗣️ Parley", "button", () => resolveEncounter("parley")),
      makeButton("🏃 Flee", "button", () => resolveEncounter("flee")),
    );
    panel.appendChild(actions);
  }

  // Spellcaster section
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

  // Loot button (only in loot state)
  if (dungeon.status === "loot") {
    const lootActions = document.createElement("div");
    lootActions.className = "flex flex-col gap-sm";
    lootActions.style.marginTop = "var(--space-sm)";
    
    lootActions.appendChild(makeButton("💰 Loot the Bodies", "button", () => lootRoom()));
    
    // If party was escaping and won the fight, offer to continue
    if (dungeon.loot > 0 && dungeon.turn > 0) {
      const continueBtn = makeButton("⬆️ Continue to Surface", "button", () => continueReturn());
      continueBtn.style.marginTop = "var(--space-sm)";
      lootActions.appendChild(continueBtn);
    }
    
    panel.appendChild(lootActions);
  }

  return panel;
}

function renderObstaclePanel(obstacle: DungeonObstacle, party: PartyState) {
  const panel = document.createElement("div");
  panel.className = "panel compact";
  
  // Color-coded border based on type
  const borderColors = {
    door: "rgba(59, 130, 246, 0.5)",
    trap: "rgba(220, 38, 38, 0.5)",
    hazard: "rgba(245, 158, 11, 0.5)",
    feature: "rgba(156, 163, 175, 0.5)",
  };
  panel.style.borderColor = borderColors[obstacle.type] || "rgba(156, 163, 175, 0.5)";
  
  // Header with type icon
  const typeIcons = {
    door: "🚪",
    trap: "⚠️",
    hazard: "⚡",
    feature: "✨",
  };
  const header = document.createElement("div");
  header.className = "panel-heading";
  header.textContent = `${typeIcons[obstacle.type] || "❓"} ${obstacle.name}`;
  panel.appendChild(header);
  
  // Type badge
  const badge = document.createElement("span");
  badge.className = "chip";
  badge.textContent = obstacle.type.toUpperCase();
  badge.style.background = borderColors[obstacle.type];
  badge.style.color = "#000";
  panel.appendChild(badge);
  
  // Description
  const desc = document.createElement("p");
  desc.className = "muted";
  desc.textContent = obstacle.description;
  panel.appendChild(desc);
  
  // Info about the obstacle
  const info = document.createElement("div");
  info.className = "stat-grid";
  info.style.fontSize = "0.85em";
  
  if (obstacle.turnCost > 0) {
    const turnInfo = document.createElement("div");
    turnInfo.className = "stat";
    turnInfo.innerHTML = `<div class="stat-label">Time Cost</div><div class="stat-value">${obstacle.turnCost} turn${obstacle.turnCost > 1 ? 's' : ''}</div>`;
    info.appendChild(turnInfo);
  }
  
  if (obstacle.damage && obstacle.damage !== "0") {
    const dmgInfo = document.createElement("div");
    dmgInfo.className = "stat";
    dmgInfo.innerHTML = `<div class="stat-label">Damage</div><div class="stat-value" style="color: var(--accent-a)">${obstacle.damage}</div>`;
    info.appendChild(dmgInfo);
  }
  
  if (obstacle.saveType) {
    const saveInfo = document.createElement("div");
    saveInfo.className = "stat";
    const saveLabels: Record<string, string> = {
      death: "Death/Poison",
      wands: "Wands",
      paralysis: "Paralysis/Stone",
      breath: "Breath",
      spells: "Spells",
    };
    saveInfo.innerHTML = `<div class="stat-label">Save</div><div class="stat-value">${saveLabels[obstacle.saveType] || obstacle.saveType}</div>`;
    info.appendChild(saveInfo);
  }
  
  if (obstacle.alertsMonsters) {
    const alertInfo = document.createElement("div");
    alertInfo.className = "stat";
    alertInfo.innerHTML = `<div class="stat-label">Alert</div><div class="stat-value" style="color: var(--accent-c)">⚠️ May draw attention</div>`;
    info.appendChild(alertInfo);
  }
  
  if (info.children.length > 0) {
    panel.appendChild(info);
  }
  
  // Check if party has a thief for certain options
  const hasThief = party.roster.some(c => c.thiefSkills && (c.thiefSkills.removeTraps > 0 || c.thiefSkills.pickLocks > 0));
  
  // Action buttons based on obstacle type
  const actions = document.createElement("div");
  actions.className = "flex gap-sm";
  actions.style.marginTop = "var(--space-sm)";
  
  if (obstacle.type === "door") {
    if (obstacle.id === "stuck-door") {
      actions.appendChild(makeButton("💪 Force Open (1d6)", "button", () => resolveObstacle("force")));
    } else if (obstacle.id === "locked-door") {
      const pickBtn = makeButton("🔧 Pick Lock", "button", () => resolveObstacle("careful"));
      if (!hasThief) {
        pickBtn.disabled = true;
        pickBtn.title = "Requires a thief";
      }
      actions.appendChild(pickBtn);
    }
    actions.appendChild(makeButton("↩️ Find Another Way", "button", () => resolveObstacle("avoid")));
  } else if (obstacle.type === "trap") {
    const disarmBtn = makeButton("🔧 Disarm", "button", () => resolveObstacle("careful"));
    if (!hasThief) {
      disarmBtn.disabled = true;
      disarmBtn.title = "Requires a thief with Remove Traps";
    }
    actions.appendChild(disarmBtn);
    actions.appendChild(makeButton("⚡ Trigger It", "button", () => resolveObstacle("force")));
    actions.appendChild(makeButton("↩️ Go Around", "button", () => resolveObstacle("avoid")));
  } else {
    // Hazard or feature
    actions.appendChild(makeButton("🏃 Rush Through", "button", () => resolveObstacle("force")));
    actions.appendChild(makeButton("🐢 Proceed Carefully", "button", () => resolveObstacle("careful")));
    actions.appendChild(makeButton("↩️ Find Another Way", "button", () => resolveObstacle("avoid")));
  }
  
  panel.appendChild(actions);
  
  // Show attempt count if any
  if (obstacle.attemptsMade > 0) {
    const attemptInfo = document.createElement("p");
    attemptInfo.style.fontSize = "0.8em";
    attemptInfo.className = "muted";
    attemptInfo.textContent = `Attempts made: ${obstacle.attemptsMade}`;
    panel.appendChild(attemptInfo);
  }
  
  return panel;
}

function getReactionColor(reaction: EncounterReaction): string {
  switch (reaction) {
    case "hostile": return "rgba(220, 38, 38, 0.6)";
    case "aggressive": return "rgba(245, 158, 11, 0.6)";
    case "cautious": return "rgba(156, 163, 175, 0.6)";
    case "neutral": return "rgba(59, 130, 246, 0.6)";
    case "friendly": return "rgba(34, 197, 94, 0.6)";
  }
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
    
    // Color-code log entries
    if (entry.kind === "combat") badge.style.background = "rgba(220, 38, 38, 0.4)";
    else if (entry.kind === "loot") badge.style.background = "rgba(245, 158, 11, 0.4)";

    // Ensure chip text is legible on colored backgrounds
    badge.style.color = "#000";
    
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
  const enc = summary.encumbrance;
  const mvLabel = `${enc.slowestNormalSpeed}' (${enc.slowestEncounterSpeed}')`;

  resources.append(
    statBox("Torches", String(dungeon.torches ?? summary.summary.torches)),
    statBox("Rations", String(dungeon.rations ?? summary.summary.rations)),
    statBox("Encumbrance", `${enc.current} / ${enc.max} cn`),
    statBox("Slowest MV", mvLabel),
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
      
      // Highlight dead characters
      if (character.status === "dead") {
        card.style.opacity = "0.5";
        card.style.borderColor = "rgba(220, 38, 38, 0.5)";
      }
      
      const title = document.createElement("div");
      title.style.display = "flex";
      title.style.justifyContent = "space-between";
      const name = document.createElement("strong");
      name.textContent = character.name;
      const hp = document.createElement("span");
      hp.className = "nav-meta";
      hp.textContent = `${character.derivedStats.hp.current}/${character.derivedStats.hp.max} HP`;
      
      // Color HP based on percentage
      const hpPercent = (character.derivedStats.hp.current / character.derivedStats.hp.max) * 100;
      if (hpPercent <= 0) hp.style.color = "var(--accent-a)";
      else if (hpPercent <= 25) hp.style.color = "rgba(220, 38, 38, 0.8)";
      else if (hpPercent <= 50) hp.style.color = "rgba(245, 158, 11, 0.8)";
      
      title.append(name, hp);

      const meta = document.createElement("div");
      meta.className = "nav-meta";
      meta.textContent = `Lvl ${character.level} ${character.className} • AC ${character.derivedStats.ac} • ${character.status.toUpperCase()}`;

      card.append(title, meta);
      rosterList.appendChild(card);
    });
  }

  container.appendChild(rosterList);
}
