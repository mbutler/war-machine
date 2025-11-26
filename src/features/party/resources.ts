import type { Character } from "../../state/schema";

export interface PartyResourceSummary {
  loot: number;
  torches: number;
  rations: number;
  potions: number;
  scrolls: number;
}

export interface PartyEncumbrance {
  current: number;
  max: number;
}

export function calculatePartySnapshot(roster: Character[]): {
  summary: PartyResourceSummary;
  encumbrance: PartyEncumbrance;
} {
  let torches = 0;
  let rations = 0;
  let current = 0;
  let max = 0;

  roster.forEach((character) => {
    const isAlive = character.status !== "dead" && character.derivedStats.hp.current > 0;
    if (isAlive) {
      torches += 6;
      rations += 7;
    }

    current += calculateCharacterLoad(character);
    max += 1600;

    character.retainers.forEach((retainer) => {
      torches += 6;
      rations += 7;
      if (retainer.class === "Porter") {
        current += 50;
        max += 2400;
      } else if (retainer.class === "Mercenary") {
        current += 400 + 60 + 100 + 60 + 140;
        max += 1600;
      } else {
        current += 10 + 60 + 140;
        max += 1600;
      }
    });
  });

  return {
    summary: {
      loot: 0,
      torches,
      rations,
      potions: 0,
      scrolls: 0,
    },
    encumbrance: {
      current,
      max,
    },
  };
}

const ARMOR_WEIGHT: Record<string, number> = {
  "Chain Mail": 400,
  Leather: 150,
  None: 0,
};

const WEAPON_WEIGHT: Record<string, number> = {
  Sword: 60,
  Mace: 50,
  Dagger: 10,
};

function calculateCharacterLoad(character: Character): number {
  let weight = 0;
  weight += ARMOR_WEIGHT[character.equipment.armor] ?? 0;
  weight += WEAPON_WEIGHT[character.equipment.weapon] ?? 0;
  if (character.equipment.shield) {
    weight += 100;
  }
  weight += 20; // backpack
  weight += 7 * 20; // rations
  weight += 6 * 10; // torches
  weight += 20; // waterskin
  if (character.className === "Magic-User" || character.className === "Elf") {
    weight += 500;
  }
  if (character.className === "Cleric") {
    weight += 10;
  }
  return weight;
}

