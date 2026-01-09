import type { Character, PartyPreferences, PartyState } from "../../state/schema";
import { createPanel } from "../../layout/panels";
import { showNotification } from "../../layout/notifications";
import { showModal } from "../../layout/modal";
import {
  generateParty,
  getPartyState,
  subscribeToParty,
  addRetainerToCharacter,
  removeRetainer,
  exportPartyData,
  importPartyFromJson,
  replaceCharacter as replaceCharacterState,
} from "./state";
import { getAbilityMod } from "../../rules/tables/abilityMods";
import type { Retainer } from "../../state/schema";
import { calculatePartySnapshot } from "./resources";
import { getLedgerBalance } from "../ledger/state";
import { createRetainerPicker } from "./retainerPicker";
import { getModuleExportFilename, triggerDownload } from "../../utils/moduleExport";

const METHODS = [
  { value: "strict", label: "Strict (3d6 in order)" },
  { value: "heroic", label: "Heroic (4d6 drop lowest)" },
] as const;

function createChip(label: string, variant?: string): HTMLSpanElement {
  const chip = document.createElement("span");
  chip.className = `chip ${variant ?? ""}`.trim();
  chip.textContent = label;
  return chip;
}

function createSection(title: string): HTMLDivElement {
  const section = document.createElement("div");
  section.className = "stat-section";
  const heading = document.createElement("div");
  heading.className = "section-title";
  heading.textContent = title;
  section.appendChild(heading);
  return section;
}

function createInfoBlock(title: string, copy: string, variant?: string): HTMLDivElement {
  const block = document.createElement("div");
  block.className = `info-block ${variant ?? ""}`.trim();
  const heading = document.createElement("div");
  heading.className = "section-title";
  heading.textContent = title;
  block.appendChild(heading);
  const paragraph = document.createElement("p");
  paragraph.className = "muted";
  paragraph.style.margin = "0";
  paragraph.textContent = copy;
  block.appendChild(paragraph);
  return block;
}

function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function createLabeledInput(label: string, input: HTMLElement): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col gap-sm";

  const lbl = document.createElement("label");
  lbl.className = "label";
  lbl.textContent = label;
  wrapper.appendChild(lbl);
  wrapper.appendChild(input);

  return wrapper;
}

function renderCharacterRow(character: Character, preferences: PartyPreferences): HTMLElement {
  const card = document.createElement("article");
  card.className = "character-card";

  const header = document.createElement("div");
  header.className = "card-header";

  const classLabel = character.race === "Human" ? character.className : character.race;
  const title = document.createElement("div");
  const name = document.createElement("h3");
  name.className = "card-title";
  name.textContent = character.name;
  title.appendChild(name);
  header.appendChild(title);

  const status = document.createElement("div");
  status.className = "card-meta";
  status.append(
    createChip(classLabel, "chip-class"),
    createChip(character.alignment, "chip-align"),
    createChip(`Lvl ${character.level}`, "chip-level"),
  );
  if (character.status === "dead") {
    status.appendChild(createChip("Deceased", "chip-deceased"));
  }
  header.appendChild(status);

  card.appendChild(header);

  const abilitySection = createSection("Ability Scores");
  const abilities = document.createElement("div");
  abilities.className = "stat-grid ability-grid";

  const abilityList = [
    ["STR", character.abilityScores.str],
    ["INT", character.abilityScores.int],
    ["WIS", character.abilityScores.wis],
    ["DEX", character.abilityScores.dex],
    ["CON", character.abilityScores.con],
    ["CHA", character.abilityScores.cha],
  ];

  abilityList.forEach(([label, value]) => {
    const stat = document.createElement("div");
    stat.className = "stat";

    const lbl = document.createElement("div");
    lbl.className = "stat-label";
    lbl.textContent = String(label || "");
    stat.appendChild(lbl);

    const val = document.createElement("div");
    val.className = "stat-value";
    val.textContent = String(value);
    stat.appendChild(val);

    const mod = document.createElement("div");
    mod.className = "nav-meta";
    const abilityMod = getAbilityMod(value as number);
    if (abilityMod > 0) mod.classList.add("stat-mod", "mod-positive");
    else if (abilityMod < 0) mod.classList.add("stat-mod", "mod-negative");
    else mod.classList.add("stat-mod");
    mod.textContent = formatModifier(abilityMod);
    stat.appendChild(mod);

    abilities.appendChild(stat);
  });

  abilitySection.appendChild(abilities);
  card.appendChild(abilitySection);

  const derivedSection = createSection("Combat Profile");
  const derivedGrid = document.createElement("div");
  derivedGrid.className = "stat-grid derived-grid";

  const derivedValues: Array<{ label: string; value: string; className: string }> = [
    { label: "Hit Points", value: `${character.derivedStats.hp.current}/${character.derivedStats.hp.max}`, className: "stat-hp" },
    { label: "Armor Class", value: String(character.derivedStats.ac), className: "stat-ac" },
    { label: "THAC0", value: String(character.derivedStats.thac0), className: "stat-thac0" },
  ];

  derivedValues.forEach(({ label, value, className }) => {
    const stat = document.createElement("div");
    stat.className = `stat ${className}`;

    const lbl = document.createElement("div");
    lbl.className = "stat-label";
    lbl.textContent = label;
    stat.appendChild(lbl);

    const val = document.createElement("div");
    val.className = "stat-value";
    val.textContent = value;
    stat.appendChild(val);

    derivedGrid.appendChild(stat);
  });

  derivedSection.appendChild(derivedGrid);
  card.appendChild(derivedSection);

  const saveSection = createSection("Saving Throws");
  const saves = document.createElement("div");
  saves.className = "save-grid";
  const savingPairs: Array<[string, number]> = [
    ["Death", character.derivedStats.savingThrows.deathPoison],
    ["Wands", character.derivedStats.savingThrows.wands],
    ["Paralysis", character.derivedStats.savingThrows.paraStone],
    ["Breath", character.derivedStats.savingThrows.breath],
    ["Spells", character.derivedStats.savingThrows.spells],
  ];

  savingPairs.forEach(([label, value]) => {
    const stat = document.createElement("div");
    stat.className = "stat";
    const lbl = document.createElement("div");
    lbl.className = "stat-label";
    lbl.textContent = label;
    const val = document.createElement("div");
    val.className = "stat-value";
    val.textContent = String(value);
    stat.append(lbl, val);
    saves.appendChild(stat);
  });
  saveSection.appendChild(saves);
  card.appendChild(saveSection);

  const supportGrid = document.createElement("div");
  supportGrid.className = "detail-grid";

  const shield = character.equipment.shield ? `, ${character.equipment.shield}` : "";
  const pack = character.equipment.pack.length ? character.equipment.pack.join(", ") : "Standard kit";
  const equipmentCopy = `${character.equipment.weapon}, ${character.equipment.armor}${shield}. Pack: ${pack}. Gold: ${character.equipment.gold} gp.`;
  supportGrid.appendChild(createInfoBlock("Equipment", equipmentCopy, "info-equipment"));

  if (character.spells.known.length > 0) {
    const prepared = character.spells.known.map((spell) => `${spell.name}${spell.memorized ? "*" : ""}`);
    supportGrid.appendChild(createInfoBlock("Spellbook", prepared.join(", "), "info-spells"));
  }

  if (character.thiefSkills) {
    const thiefCopy = `OL ${character.thiefSkills.pickLocks}%, FT ${character.thiefSkills.findTraps}%, RT ${character.thiefSkills.removeTraps}%, HS ${character.thiefSkills.hideInShadows}%`;
    supportGrid.appendChild(createInfoBlock("Thief Skills", thiefCopy, "info-thief"));
  }

  card.appendChild(supportGrid);

  const retainerSection = document.createElement("div");
  retainerSection.className = "stat-section";

  const retainerHeader = document.createElement("div");
  retainerHeader.className = "section-title";
  retainerHeader.textContent = `Retainers (${character.retainers.length}/${character.maxRetainers}) · Morale ${character.retainerMorale}`;
  retainerSection.appendChild(retainerHeader);

  const retainerActions = document.createElement("div");
  retainerActions.className = "flex gap-sm";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "button";
  addButton.textContent = "Recruit Retainer";
  addButton.addEventListener("click", () => {
    if (character.retainers.length >= character.maxRetainers) {
      showNotification({
        title: "Retainer limit reached",
        message: "Dismiss an existing retainer before recruiting more.",
        variant: "warning",
      });
      return;
    }

    let closeModal: (() => void) | undefined;

    const picker = createRetainerPicker({
      onSelect: (type) => {
        addRetainerToCharacter(character.id, type.id);
        closeModal?.();
        showNotification({
          title: "Retainer recruited",
          message: `${type.label} joined the party.`,
          variant: "success",
        });
      },
    });

    closeModal = showModal({
      title: `Recruit for ${character.name}`,
      content: picker,
    });
  });

  retainerActions.appendChild(addButton);
  retainerSection.appendChild(retainerActions);

  const retainerList = document.createElement("div");
  retainerList.className = "flex flex-col gap-sm";

  if (character.retainers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No retainers recruited.";
    retainerList.appendChild(empty);
  } else {
    character.retainers.forEach((retainer) => {
      retainerList.appendChild(renderRetainerCard(character.id, retainer));
    });
  }

  retainerSection.appendChild(retainerList);
  card.appendChild(retainerSection);

  if (character.status === "dead") {
    const banner = document.createElement("div");
    banner.className = "info-block info-thief";
    banner.style.borderColor = "rgba(248,113,113,0.6)";
    banner.style.background = "rgba(248,113,113,0.12)";
    const sectionLabel = document.createElement("div");
    sectionLabel.className = "section-title";
    sectionLabel.textContent = "Character Deceased";
    banner.appendChild(sectionLabel);
    const message = document.createElement("p");
    message.className = "muted";
    message.textContent = "Recruit a replacement to keep this slot active.";
    banner.appendChild(message);
    const replaceBtn = document.createElement("button");
    replaceBtn.type = "button";
    replaceBtn.className = "button";
    replaceBtn.textContent = "Recruit Replacement";
    replaceBtn.addEventListener("click", () => {
      if (window.confirm(`Replace ${character.name} with a new recruit?`)) {
        replaceCharacterState(character.id, { level: 1, method: preferences.method });
      }
    });
    banner.appendChild(replaceBtn);
    card.appendChild(banner);
  }

  return card;
}

function renderRetainerCard(parentId: string, retainer: Retainer): HTMLElement {
  const card = document.createElement("div");
  card.className = "stat";
  card.style.display = "flex";
  card.style.flexDirection = "column";
  card.style.gap = "0.25rem";

  const header = document.createElement("div");
  header.className = "flex gap-sm";
  header.style.justifyContent = "space-between";

  const name = document.createElement("strong");
  name.textContent = retainer.name;
  header.appendChild(name);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "button danger";
  remove.style.padding = "0.2rem 0.35rem";
  remove.style.fontSize = "0.65rem";
  remove.textContent = "Dismiss";
  remove.addEventListener("click", () => {
    if (window.confirm(`Dismiss ${retainer.name}?`)) {
      removeRetainer(parentId, retainer.id);
    }
  });
  header.appendChild(remove);

  const meta = document.createElement("div");
  meta.className = "nav-meta";
  meta.textContent = `${retainer.class} · Wage ${retainer.wage}gp/month`;

  const stats = document.createElement("div");
  stats.className = "nav-meta";
  stats.textContent = `HP ${retainer.hp.current}/${retainer.hp.max} · AC ${retainer.ac} · THAC0 ${retainer.thac0} · Morale ${retainer.morale}`;

  const gear = document.createElement("div");
  gear.className = "nav-meta";
  gear.textContent = retainer.equipment;

  card.append(header, meta, stats, gear);
  return card;
}

/**
 * Extract party name from character notes field.
 * Matches "Member of X" pattern from fantasy-log imports.
 */
function extractPartyName(notes: string | undefined): string | null {
  if (!notes) return null;
  const match = notes.match(/^Member of (.+)$/);
  return match ? match[1] : null;
}

/**
 * Group characters by their party affiliation.
 */
function groupCharactersByParty(roster: Character[]): Map<string, Character[]> {
  const groups = new Map<string, Character[]>();
  
  for (const character of roster) {
    const partyName = extractPartyName(character.notes) ?? "Adventurers";
    const group = groups.get(partyName) ?? [];
    group.push(character);
    groups.set(partyName, group);
  }
  
  return groups;
}

/**
 * Create a party group header element.
 */
function createPartyHeader(partyName: string, memberCount: number): HTMLElement {
  const header = document.createElement("div");
  header.className = "party-group-header";
  header.style.cssText = `
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 0.5rem;
  `;
  
  const name = document.createElement("h3");
  name.style.cssText = "margin: 0; font-size: 1.1rem; font-weight: 600;";
  name.textContent = partyName;
  
  const count = document.createElement("span");
  count.className = "chip";
  count.style.cssText = "font-size: 0.75rem;";
  count.textContent = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;
  
  header.append(name, count);
  return header;
}

function renderRoster(container: HTMLElement, state: PartyState) {
  container.innerHTML = "";
  if (!state.roster.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No characters generated yet.";
    container.appendChild(empty);
    return;
  }

  // Group characters by party affiliation
  const groups = groupCharactersByParty(state.roster);
  
  // If only one group (all same party or no party info), render flat list
  if (groups.size === 1) {
    const [partyName, members] = [...groups.entries()][0];
    // Only show header if it's a named party (not "Adventurers")
    if (partyName !== "Adventurers") {
      container.appendChild(createPartyHeader(partyName, members.length));
    }
    members.forEach((character) => {
      container.appendChild(renderCharacterRow(character, state.preferences));
    });
    return;
  }
  
  // Multiple groups - render with headers
  // Sort so "Adventurers" (unaffiliated) comes last
  const sortedGroups = [...groups.entries()].sort((a, b) => {
    if (a[0] === "Adventurers") return 1;
    if (b[0] === "Adventurers") return -1;
    return a[0].localeCompare(b[0]);
  });
  
  for (const [partyName, members] of sortedGroups) {
    const groupContainer = document.createElement("div");
    groupContainer.className = "party-group";
    groupContainer.style.cssText = "margin-bottom: 1.5rem;";
    
    groupContainer.appendChild(createPartyHeader(partyName, members.length));
    
    const memberList = document.createElement("div");
    memberList.className = "flex flex-col gap-md";
    
    members.forEach((character) => {
      memberList.appendChild(renderCharacterRow(character, state.preferences));
    });
    
    groupContainer.appendChild(memberList);
    container.appendChild(groupContainer);
  }
}

function renderSummary(container: HTMLElement, state: PartyState) {
  const snapshot = calculatePartySnapshot(state.roster);
  container.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "stat-grid";

  const makeStat = (label: string, value: string) => {
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

  const enc = snapshot.encumbrance;
  const mvLabel = `${enc.slowestNormalSpeed}' (${enc.slowestEncounterSpeed}')`;

  grid.append(
    makeStat("Treasury", `${getLedgerBalance()} gp`),
    makeStat("Torches", `${snapshot.summary.torches}`),
    makeStat("Rations", `${snapshot.summary.rations}`),
    makeStat("Encumbrance", `${enc.current} / ${enc.max} cn`),
    makeStat("Slowest MV", mvLabel),
  );

  container.appendChild(grid);
}

export function renderPartyPanel(target: HTMLElement) {
  const { element, body } = createPanel("Party", "Generate BECMI characters and manage your adventuring roster");

  const controls = document.createElement("div");
  controls.className = "panel compact";

  const sizeInput = document.createElement("input");
  sizeInput.type = "number";
  sizeInput.min = "1";
  sizeInput.max = "12";
  sizeInput.className = "input";

  const levelInput = document.createElement("input");
  levelInput.type = "number";
  levelInput.min = "1";
  levelInput.max = "36";
  levelInput.className = "input";

  const methodSelect = document.createElement("select");
  methodSelect.className = "input";
  METHODS.forEach((method) => {
    const option = document.createElement("option");
    option.value = method.value;
    option.textContent = method.label;
    methodSelect.appendChild(option);
  });

  const button = document.createElement("button");
  button.type = "button";
  button.className = "button";
  button.textContent = "Generate Party";

  const controlsGrid = document.createElement("div");
  controlsGrid.className = "stat-grid";
  controlsGrid.append(
    createLabeledInput("Party Size", sizeInput),
    createLabeledInput("Level", levelInput),
    createLabeledInput("Method", methodSelect),
  );

  controls.appendChild(controlsGrid);
  controls.appendChild(button);

  const actionRow = document.createElement("div");
  actionRow.className = "flex gap-sm";

  const exportJsonBtn = document.createElement("button");
  exportJsonBtn.type = "button";
  exportJsonBtn.className = "button";
  exportJsonBtn.textContent = "Export";
  exportJsonBtn.addEventListener("click", () => {
    const payload = exportPartyData();
    triggerDownload(getModuleExportFilename("party"), payload);
  });

  const importJsonBtn = document.createElement("button");
  importJsonBtn.type = "button";
  importJsonBtn.className = "button";
  importJsonBtn.textContent = "Import";

  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = "application/json";
  importInput.className = "visually-hidden";
  importInput.addEventListener("change", () => {
    const file = importInput.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        importPartyFromJson(text);
        showNotification({
          title: "Party import",
          message: "Party data imported successfully.",
          variant: "success",
        });
      } catch (error) {
        showNotification({
          title: "Import failed",
          message: (error as Error).message,
          variant: "danger",
        });
      } finally {
        importInput.value = "";
      }
    });
  });

  importJsonBtn.addEventListener("click", () => importInput.click());

  actionRow.append(exportJsonBtn, importJsonBtn, importInput);
  controls.appendChild(actionRow);

  body.appendChild(controls);

  const logisticsPanel = createPanel("Party Logistics", "Supplies & encumbrance summary");
  logisticsPanel.element.classList.add("compact");
  const logisticsContainer = document.createElement("div");
  logisticsPanel.body.appendChild(logisticsContainer);
  body.appendChild(logisticsPanel.element);

  const rosterHeading = document.createElement("div");
  rosterHeading.className = "panel-heading";
  rosterHeading.textContent = "Roster";
  body.appendChild(rosterHeading);

  const rosterContainer = document.createElement("div");
  rosterContainer.className = "flex flex-col gap-md";
  body.appendChild(rosterContainer);

  function syncInputs(state: PartyState) {
    sizeInput.value = String(state.preferences.defaultSize);
    levelInput.value = String(state.preferences.defaultLevel);
    methodSelect.value = state.preferences.method;
  }

  function handleGenerate() {
    const size = Number(sizeInput.value) || 4;
    const level = Number(levelInput.value) || 1;
    const method = methodSelect.value === "heroic" ? "heroic" : "strict";
    generateParty({ size, level, method });
  }

  button.addEventListener("click", handleGenerate);

  const initialState = getPartyState();
  syncInputs(initialState);
  renderRoster(rosterContainer, initialState);
  renderSummary(logisticsContainer, initialState);

  const unsubscribe = subscribeToParty((party) => {
    syncInputs(party);
    renderRoster(rosterContainer, party);
    renderSummary(logisticsContainer, party);
  });

  target.appendChild(element);

  return () => {
    unsubscribe();
  };
}

