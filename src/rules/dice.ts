export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i += 1) {
    total += rollDie(sides);
  }
  return total;
}

export function rollFormula(formula: string): number {
  const match = formula.trim().match(/^(\d+)d(\d+)$/i);
  if (!match) {
    return Number(formula) || 0;
  }
  const [, countStr, sidesStr] = match;
  return rollDice(Number(countStr), Number(sidesStr));
}

export function rollStat3d6(): number {
  return rollDice(3, 6);
}

export function rollStatHeroic(): number {
  const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)].sort((a, b) => a - b);
  rolls.shift();
  return rolls.reduce((sum, value) => sum + value, 0);
}

export function pickRandom<T>(list: readonly T[]): T {
  const index = Math.floor(Math.random() * list.length);
  return list[index];
}

