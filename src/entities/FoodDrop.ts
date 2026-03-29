import { Entity } from './Entity';
import { FOOD_DECAY_TIME, FOOD_ENERGY_VALUE, FOOD_RADIUS } from '../config';

export class FoodDrop extends Entity {
  energyValue = FOOD_ENERGY_VALUE;
  radius = FOOD_RADIUS;
  spawnTime: number;
  decayTime = FOOD_DECAY_TIME;

  constructor(x: number, y: number) {
    super(x, y);
    this.spawnTime = performance.now();
    this.health = 1;
  }

  get timeAlive(): number {
    return performance.now() - this.spawnTime;
  }

  update(_dt: number): void {
    this.age += _dt;
    // Decay over time
    if (this.timeAlive > this.decayTime) {
      this.takeDamage(1);
    }
  }

  onDeath(): void {
    // Food just fades out
  }
}
