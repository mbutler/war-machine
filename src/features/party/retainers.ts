import type { Retainer } from "../../state/schema";
import { getAbilityMod } from "../../rules/tables/abilityMods";
import { rollDie, pickRandom } from "../../rules/dice";
import { getRandomName } from "./nameBag";
import { createId } from "../../utils/id";

export type RetainerTier = "normal" | "torchbearer" | "porter" | "mercenary";

export interface RetainerTypeDefinition {
  id: RetainerTier;
  label: string;
  description: string;
  ac: number;
  hd: number;
  hpBonus: number;
  thac0: number;
  wage: number;
  equipment: string;
}

export const RETAINER_TYPES: RetainerTypeDefinition[] = [
  {
    id: "normal",
    label: "Normal Man",
    description: "0-level townsfolk with basic gear",
    ac: 9,
    hd: 6,
    hpBonus: 0,
    thac0: 20,
    wage: 10,
    equipment: "Clothes, hand weapon",
  },
  {
    id: "torchbearer",
    label: "Torch Bearer",
    description: "Carries light sources and basic gear",
    ac: 9,
    hd: 6,
    hpBonus: 0,
    thac0: 20,
    wage: 12,
    equipment: "Torches, dagger",
  },
  {
    id: "porter",
    label: "Porter",
    description: "Carries treasure, extra supplies",
    ac: 9,
    hd: 6,
    hpBonus: 0,
    thac0: 20,
    wage: 15,
    equipment: "Backpack, staff",
  },
  {
    id: "mercenary",
    label: "Mercenary",
    description: "Chain mail fighter for hire",
    ac: 4,
    hd: 6,
    hpBonus: 1,
    thac0: 20,
    wage: 25,
    equipment: "Chain mail, shield, sword",
  },
];

export function generateRetainer(type: RetainerTypeDefinition): Retainer {
  const hp = Math.max(1, rollDie(type.hd) + type.hpBonus);
  const name = getRandomName();

  return {
    id: createId(),
    name,
    class: type.label,
    level: 0,
    hp: { current: hp, max: hp },
    morale: rollDie(6) + rollDie(6) + 6,
    wage: type.wage,
    ac: type.ac,
    thac0: type.thac0,
    equipment: type.equipment,
  };
}

export function canRecruitRetainer(currentCount: number, maxCount: number): boolean {
  return currentCount < maxCount;
}

