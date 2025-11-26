import type { LabItemType } from "../../state/schema";

export interface LabItemDefinition {
  id: LabItemType;
  label: string;
  description: string;
}

export const LAB_ITEM_TYPES: LabItemDefinition[] = [
  {
    id: "scroll",
    label: "Scroll (1 wk/level)",
    description: "500 gp per spell level; requires copying magic safely.",
  },
  {
    id: "potion",
    label: "Potion (1 wk)",
    description: "Fixed 500 gp cost; brewing a single-dose elixir.",
  },
  {
    id: "wand",
    label: "Wand / Staff / Rod",
    description: "Permanent item; add material cost + 1,000 gp per spell level.",
  },
  {
    id: "ring",
    label: "Ring / Misc Item",
    description: "Permanent item; add material cost + 1,000 gp per spell level.",
  },
  {
    id: "weapon",
    label: "Weapon / Armor",
    description: "Permanent item; add material cost + 1,000 gp per spell level.",
  },
  {
    id: "construct",
    label: "Golem / Construct",
    description: "Major undertaking; add material cost + 1,000 gp per spell level.",
  },
];

export const LAB_ITEM_MAP = new Map(LAB_ITEM_TYPES.map((item) => [item.id, item]));

