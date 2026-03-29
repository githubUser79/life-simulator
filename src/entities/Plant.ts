import { Entity } from './Entity';
import {
  PLANT_GROWTH_TIME,
  PLANT_MAX_RADIUS,
} from '../config';

export class Plant extends Entity {
  growthStart: number;
  maxRadius = PLANT_MAX_RADIUS;
  grown = false;

  constructor(x: number, y: number) {
    super(x, y);
    this.growthStart = performance.now();
    this.health = 1;
    this.energy = 0.5;
  }

  get growthProgress(): number {
    const elapsed = performance.now() - this.growthStart;
    return Math.min(elapsed / PLANT_GROWTH_TIME, 1);
  }

  get currentRadius(): number {
    return this.maxRadius * this.growthProgress;
  }

  update(_dt: number): void {
    if (this.growthProgress >= 1) {
      this.grown = true;
    }
    this.age += _dt;
  }

  onDeath(): void {
    // Plants just fade out
  }
}
