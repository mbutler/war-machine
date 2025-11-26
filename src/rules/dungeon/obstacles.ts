export interface ObstacleDefinition {
  id: string;
  name: string;
  description: string;
}

export const OBSTACLES: ObstacleDefinition[] = [
  {
    id: "stuck-door",
    name: "Stuck Door",
    description: "This heavy stone door resists your efforts. A successful bend bars check opens it, but failure wastes a turn.",
  },
  {
    id: "chasm",
    name: "Underground Chasm",
    description: "A wide fissure blocks your path, dropping into darkness below. You'll need to jump, use a rope, or find another route.",
  },
  {
    id: "flooded",
    name: "Flooded Passage",
    description: "Knee-deep water fills this corridor, slowing movement and risking torch extinction.",
  },
  {
    id: "collapsed",
    name: "Cave-In",
    description: "Falling rubble has blocked the passage. Careful digging will take time and may cause more collapse.",
  },
  {
    id: "pit-trap",
    name: "Hidden Pit Trap",
    description: "A concealed pit yawns before you. Someone will need to test the floor or probe ahead carefully.",
  },
  {
    id: "poison-dart-trap",
    name: "Poison Dart Trap",
    description: "Pressure plates trigger darts from the walls. A successful find traps check can disable it.",
  },
  {
    id: "illusion-wall",
    name: "Illusory Wall",
    description: "This section of wall shimmers unnaturally. It may be an illusion hiding a passage or secret door.",
  },
  {
    id: "fungus-garden",
    name: "Fungus Garden",
    description: "Strange glowing mushrooms cover the floor. Some may be edible, others poisonous or hallucinogenic.",
  },
  {
    id: "slippery-moss",
    name: "Slippery Moss",
    description: "The floor is coated in slick, wet moss. Movement is treacherous and falling risks injury.",
  },
  {
    id: "echoing-chamber",
    name: "Echoing Chamber",
    description: "Strange acoustics amplify all sounds. Stealth will be difficult, but you might hear distant noises.",
  },
];

export function randomObstacle(): ObstacleDefinition {
  return OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
}

