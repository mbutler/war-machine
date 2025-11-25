export interface ClassRequirement {
  [ability: string]: number;
}

export interface ClassDefinition {
  key: string;
  name: string;
  hd: number;
  req: ClassRequirement;
  prime: string;
  type: "human" | "demihuman";
}

export const CLASS_DEFINITIONS: Record<string, ClassDefinition> = {
  cleric: { key: "cleric", name: "Cleric", hd: 6, req: { wis: 9 }, prime: "wis", type: "human" },
  fighter: { key: "fighter", name: "Fighter", hd: 8, req: { str: 9 }, prime: "str", type: "human" },
  magicuser: { key: "magicuser", name: "Magic-User", hd: 4, req: { int: 9 }, prime: "int", type: "human" },
  thief: { key: "thief", name: "Thief", hd: 4, req: { dex: 9 }, prime: "dex", type: "human" },
  dwarf: { key: "dwarf", name: "Dwarf", hd: 8, req: { con: 9 }, prime: "str", type: "demihuman" },
  elf: { key: "elf", name: "Elf", hd: 6, req: { int: 9, str: 9 }, prime: "str_int", type: "demihuman" },
  halfling: { key: "halfling", name: "Halfling", hd: 6, req: { dex: 9, con: 9 }, prime: "str_dex", type: "demihuman" },
};

export const HUMAN_CLASSES = ["cleric", "fighter", "magicuser", "thief"] as const;
export const DEMIHUMAN_CLASSES = ["dwarf", "elf", "halfling"] as const;

