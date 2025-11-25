export interface EncounterDefinition {
  roll: number | number[];
  name: string;
  qty: string;
  hd: number;
  ac: number;
  dmg: string;
  morale: number;
  treasure: string;
}

type EncounterTable = EncounterDefinition[];

export const DUNGEON_ENCOUNTERS: Record<string, EncounterTable> = {
  level1: [
    { roll: 1, name: "Bandit", qty: "1d6", hd: 1, ac: 6, dmg: "1d6", morale: 8, treasure: "A" },
    { roll: 2, name: "Beetle, Fire", qty: "1d6", hd: 1, ac: 4, dmg: "2d4", morale: 7, treasure: "U" },
    { roll: 3, name: "Cave Locust", qty: "1d6", hd: 2, ac: 4, dmg: "1d2", morale: 5, treasure: "U" },
    { roll: 4, name: "Centipede, Giant", qty: "1d6", hd: 0.5, ac: 9, dmg: "special", morale: 7, treasure: "U" },
    { roll: 5, name: "Ghoul", qty: "1d2", hd: 2, ac: 6, dmg: "1d3+1", morale: 9, treasure: "B" },
    { roll: 6, name: "Goblin", qty: "1d6", hd: 0.5, ac: 6, dmg: "1d6", morale: 7, treasure: "R" },
    { roll: [7, 8, 9, 10], name: "Human", qty: "1d3", hd: 1, ac: 9, dmg: "1d6", morale: 8, treasure: "A" },
    { roll: 11, name: "Kobold", qty: "2d6", hd: 0.5, ac: 7, dmg: "1d4", morale: 6, treasure: "J" },
    { roll: 12, name: "Lizard, Gecko", qty: "1", hd: 1, ac: 5, dmg: "1d8", morale: 7, treasure: "U" },
    { roll: 13, name: "NPC Party", qty: "1 party", hd: 1, ac: 9, dmg: "1d6", morale: 8, treasure: "A" },
    { roll: 14, name: "Orc", qty: "1d6", hd: 1, ac: 6, dmg: "1d6", morale: 8, treasure: "D" },
    { roll: 15, name: "Skeleton", qty: "1d6", hd: 0.5, ac: 7, dmg: "1d6", morale: 12, treasure: "B" },
    { roll: 16, name: "Snake, Racer", qty: "1", hd: 1, ac: 9, dmg: "1d3", morale: 5, treasure: "U" },
    { roll: 17, name: "Spider, Crab", qty: "1", hd: 0.5, ac: 7, dmg: "special", morale: 7, treasure: "U" },
    { roll: 18, name: "Stirge", qty: "1d6", hd: 1, ac: 7, dmg: "1d3", morale: 9, treasure: "L" },
    { roll: 19, name: "Troglodyte", qty: "1d3", hd: 2, ac: 5, dmg: "1d6", morale: 9, treasure: "A" },
    { roll: 20, name: "Zombie", qty: "1d3", hd: 2, ac: 8, dmg: "1d8", morale: 12, treasure: "B" },
  ],
  level2: [
    { roll: 1, name: "Beetle, Oil", qty: "1d6", hd: 2, ac: 4, dmg: "2d4", morale: 8, treasure: "U" },
    { roll: 2, name: "Carrion Crawler", qty: "1", hd: 3, ac: 7, dmg: "special", morale: 9, treasure: "B" },
    { roll: 3, name: "Ghoul", qty: "1d4", hd: 2, ac: 6, dmg: "1d3+1", morale: 9, treasure: "B" },
    { roll: 4, name: "Gnoll", qty: "1d4", hd: 2, ac: 5, dmg: "1d6", morale: 8, treasure: "D" },
    { roll: 5, name: "Goblin", qty: "2d4", hd: 0.5, ac: 6, dmg: "1d6", morale: 7, treasure: "R" },
    { roll: 6, name: "Hobgoblin", qty: "1d4", hd: 1, ac: 6, dmg: "1d8", morale: 9, treasure: "D" },
    { roll: 7, name: "Human", qty: "1d3", hd: 2, ac: 4, dmg: "1d8", morale: 9, treasure: "C" },
    { roll: 8, name: "Kobold", qty: "3d6", hd: 0.5, ac: 7, dmg: "1d4", morale: 6, treasure: "J" },
    { roll: 9, name: "Lizard, Draco", qty: "1d2", hd: 2, ac: 5, dmg: "1d8", morale: 7, treasure: "U" },
    { roll: 10, name: "NPC Party", qty: "1 party", hd: 2, ac: 6, dmg: "1d8", morale: 9, treasure: "C" },
    { roll: 11, name: "Orc", qty: "2d6", hd: 1, ac: 6, dmg: "1d6", morale: 8, treasure: "D" },
    { roll: 12, name: "Ogre", qty: "1d2", hd: 4, ac: 5, dmg: "1d10", morale: 10, treasure: "C" },
    { roll: 13, name: "Rust Monster", qty: "1", hd: 5, ac: 2, dmg: "special", morale: 7, treasure: "U" },
    { roll: 14, name: "Shadow", qty: "1d4", hd: 2, ac: 7, dmg: "1d4 + drain", morale: 12, treasure: "E" },
    { roll: 15, name: "Snake, Pit Viper", qty: "1", hd: 2, ac: 7, dmg: "poison", morale: 8, treasure: "U" },
    { roll: 16, name: "Spider, Large", qty: "1", hd: 2, ac: 6, dmg: "poison", morale: 7, treasure: "U" },
    { roll: 17, name: "Statue, Living", qty: "1", hd: 3, ac: 4, dmg: "1d8", morale: 11, treasure: "F" },
    { roll: 18, name: "Thoul", qty: "1d3", hd: 3, ac: 5, dmg: "1d4", morale: 10, treasure: "D" },
    { roll: 19, name: "Troglodyte", qty: "1d4", hd: 2, ac: 5, dmg: "1d6", morale: 9, treasure: "A" },
    { roll: 20, name: "Wight", qty: "1d2", hd: 3, ac: 5, dmg: "energy drain", morale: 12, treasure: "D" },
  ],
};

export function pickEncounter(level: number, roll: number): EncounterDefinition | null {
  const table =
    level <= 1 ? DUNGEON_ENCOUNTERS.level1 : level === 2 ? DUNGEON_ENCOUNTERS.level2 : DUNGEON_ENCOUNTERS.level2;
  for (const entry of table) {
    if (Array.isArray(entry.roll)) {
      if (entry.roll.includes(roll)) return entry;
    } else if (entry.roll === roll) {
      return entry;
    }
  }
  return null;
}

