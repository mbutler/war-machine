export interface ObstacleDefinition {
  id: string;
  name: string;
  description: string;
}

export const OBSTACLES: ObstacleDefinition[] = [
  {
    id: "stuck-door",
    name: "Stuck Door",
    description: "Requires a force check; success opens loudly, failure wastes a turn.",
  },
  {
    id: "chasm",
    name: "Underground Chasm",
    description: "Wide gap blocks the passage; must jump, rope, or find another route.",
  },
  {
    id: "flooded",
    name: "Flooded Corridor",
    description: "Waist-deep water slows progress and may extinguish unprotected torches.",
  },
  {
    id: "collapsed",
    name: "Collapsed Tunnel",
    description: "Rubble blocks the route; digging carefully consumes torches and time.",
  },
];

export function randomObstacle(): ObstacleDefinition {
  return OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
}

