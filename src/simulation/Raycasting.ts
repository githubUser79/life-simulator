import { Entity } from '../entities/Entity';
import { Creature } from '../entities/Creature';
import { Predator } from '../entities/Predator';
import { Prey } from '../entities/Prey';
import { Omnivore } from '../entities/Omnivore';
import { Plant } from '../entities/Plant';
import { FoodDrop } from '../entities/FoodDrop';
import { SpatialGrid } from './SpatialGrid';
import {
  MAX_RAY_DISTANCE,
  NUM_ZONES,
  CREATURE_FOV,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  DAY_NIGHT_CYCLE_TICKS,
  NIGHT_RAY_MULTIPLIER,
} from '../config';

export interface ZoneResult {
  normalizedDist: number; // 0 = at entity, 1 = max range / nothing
  relativeAngle: number;  // -1 to 1 normalized
  attractiveness: number; // -1 to +1
}

/**
 * Cast rays for a creature and return per-zone closest-hit results.
 * No actual line intersection – uses angular sector + distance approximation.
 */
/** Get the daylight factor (0 = darkest night, 1 = bright day) */
export function getDaylightFactor(tick: number): number {
  const phase = (tick % DAY_NIGHT_CYCLE_TICKS) / DAY_NIGHT_CYCLE_TICKS;
  // Smooth sine wave: 0.5 + 0.5*cos gives 1 at phase=0 (noon), 0 at phase=0.5 (midnight)
  return 0.5 + 0.5 * Math.cos(phase * Math.PI * 2);
}

export function castRays(
  creature: Creature,
  grid: SpatialGrid,
  tick = 0
): ZoneResult[] {
  const speciesType: 'predator' | 'omnivore' | 'prey' =
    creature instanceof Predator ? 'predator' :
    creature instanceof Omnivore ? 'omnivore' : 'prey';
  const fov = CREATURE_FOV;
  const halfFov = fov / 2;
  const zoneWidth = fov / NUM_ZONES;

  // Day/night affects vision range
  const daylight = getDaylightFactor(tick);
  const rayDist = MAX_RAY_DISTANCE * (NIGHT_RAY_MULTIPLIER + (1 - NIGHT_RAY_MULTIPLIER) * daylight);

  const nearby = grid.getNearby(
    creature.position.x,
    creature.position.y,
    rayDist
  );

  // Initialize zones with "nothing found"
  const zones: ZoneResult[] = [];
  for (let i = 0; i < NUM_ZONES; i++) {
    zones.push({ normalizedDist: 1, relativeAngle: 0, attractiveness: 0 });
  }

  // Best (closest) hit per zone
  const bestDist = new Array(NUM_ZONES).fill(rayDist + 1);

  for (const entity of nearby) {
    if (entity === creature) continue;
    if (!entity.alive) continue;

    // Wrapping-aware delta
    let dx = entity.position.x - creature.position.x;
    let dy = entity.position.y - creature.position.y;
    if (dx > WORLD_WIDTH / 2) dx -= WORLD_WIDTH;
    if (dx < -WORLD_WIDTH / 2) dx += WORLD_WIDTH;
    if (dy > WORLD_HEIGHT / 2) dy -= WORLD_HEIGHT;
    if (dy < -WORLD_HEIGHT / 2) dy += WORLD_HEIGHT;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > rayDist || dist < 0.01) continue;

    // Angle from creature's facing direction to entity
    const angleToEntity = Math.atan2(dy, dx);
    let relAngle = angleToEntity - creature.direction;

    // Normalize to [-PI, PI]
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    // Check if within FOV
    if (Math.abs(relAngle) > halfFov) continue;

    // Determine which zone (0 = leftmost, 4 = rightmost)
    const zoneAngle = relAngle + halfFov; // shift to [0, fov]
    const zoneIdx = Math.min(
      NUM_ZONES - 1,
      Math.floor(zoneAngle / zoneWidth)
    );

    if (dist < bestDist[zoneIdx]) {
      bestDist[zoneIdx] = dist;

      // Attractiveness
      const attract = getAttractiveness(entity, speciesType);

      // Relative angle within zone, normalized to [-1, 1]
      const zoneCenterAngle = -halfFov + (zoneIdx + 0.5) * zoneWidth;
      const normAngle = (relAngle - zoneCenterAngle) / (zoneWidth / 2);

      zones[zoneIdx] = {
        normalizedDist: dist / rayDist,
        relativeAngle: Math.max(-1, Math.min(1, normAngle)),
        attractiveness: attract,
      };
    }
  }

  return zones;
}

function getAttractiveness(entity: Entity, observer: 'predator' | 'omnivore' | 'prey'): number {
  if (observer === 'predator') {
    if (entity instanceof Prey) return 1;
    if (entity instanceof Omnivore) return 0.9;  // also food for predators
    if (entity instanceof FoodDrop) return 0.8;
    if (entity instanceof Plant) return 0;
    if (entity instanceof Predator) return -0.5;
  } else if (observer === 'omnivore') {
    if (entity instanceof Prey) return 0.8;       // hunt prey
    if (entity instanceof Predator) return 0.6;   // can also hunt predators
    if (entity instanceof Plant) return 0.7;       // eat plants
    if (entity instanceof FoodDrop) return 0.5;
    if (entity instanceof Omnivore) return -0.3;   // avoid own kind (no cannibalism)
  } else {
    // Prey
    if (entity instanceof Plant) return 1;
    if (entity instanceof FoodDrop) return -0.2;
    if (entity instanceof Predator) return -1;
    if (entity instanceof Omnivore) return -0.8;   // flee from omnivores
    if (entity instanceof Prey) return 0;
  }
  return 0;
}
