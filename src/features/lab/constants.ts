import type { LabItemType } from "../../state/schema";

export interface LabItemDefinition {
  id: LabItemType;
  label: string;
  description: string;
}

export const LAB_ITEM_TYPES: LabItemDefinition[] = [
  {
    id: "scroll",
    label: "Scroll",
    description: "500 gp per spell level; requires rare components for safe copying.",
  },
  {
    id: "potion",
    label: "Potion",
    description: "Fixed 500 gp cost; requires rare components for brewing.",
  },
  {
    id: "wand",
    label: "Wand / Staff / Rod",
    description: "Permanent item; requires rare components + materials.",
  },
  {
    id: "ring",
    label: "Ring / Misc Item",
    description: "Permanent item; requires rare components + materials.",
  },
  {
    id: "weapon",
    label: "Weapon / Armor",
    description: "Permanent item; requires rare components + materials.",
  },
  {
    id: "construct",
    label: "Golem / Construct",
    description: "Major undertaking; requires rare components + materials.",
  },
];

export const LAB_ITEM_MAP = new Map(LAB_ITEM_TYPES.map((item) => [item.id, item]));

