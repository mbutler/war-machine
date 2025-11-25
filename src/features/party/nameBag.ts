import { FEMALE_NAMES, MALE_NAMES } from "../../data/names";

type Gender = "female" | "male";

const femaleBag = [...FEMALE_NAMES];
const maleBag = [...MALE_NAMES];

function drawFromBag<T>(bag: T[], source: readonly T[]): T {
  if (bag.length === 0) {
    bag.push(...source);
  }
  const index = Math.floor(Math.random() * bag.length);
  const [name] = bag.splice(index, 1);
  return name;
}

export function getRandomName(preferred?: Gender): string {
  if (preferred === "female") {
    return drawFromBag(femaleBag, FEMALE_NAMES);
  }
  if (preferred === "male") {
    return drawFromBag(maleBag, MALE_NAMES);
  }
  return Math.random() < 0.5 ? drawFromBag(femaleBag, FEMALE_NAMES) : drawFromBag(maleBag, MALE_NAMES);
}

