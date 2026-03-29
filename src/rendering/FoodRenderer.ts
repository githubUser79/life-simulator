import { Graphics } from 'pixi.js';
import { FoodDrop } from '../entities/FoodDrop';
import { FOOD_COLOR, FOOD_RING_COLOR } from '../config';

/**
 * Renders a food drop as a golden circle with a dashed outer ring,
 * gently pulsing in scale.
 */
export class FoodRenderer {
  private food: FoodDrop;
  private gfx: Graphics;
  private animTime = 0;

  constructor(food: FoodDrop) {
    this.food = food;
    this.gfx = new Graphics();
    food.container.addChild(this.gfx);
  }

  /** Call each frame from Pixi ticker */
  render(_time: number, deltaMs: number): void {
    this.animTime += deltaMs * 0.001;
    const r = this.food.radius;

    // Pulsing scale 0.9 - 1.1
    const pulse = 1 + 0.1 * Math.sin(this.animTime * 3);
    this.gfx.scale.set(pulse);

    this.gfx.clear();

    // Filled golden circle
    this.gfx.circle(0, 0, r);
    this.gfx.fill({ color: FOOD_COLOR });

    // Dashed outer ring – approximate with arc segments
    const ringR = r * 1.6;
    const segments = 8;
    const gapAngle = Math.PI / segments;
    for (let i = 0; i < segments; i++) {
      const startAngle = i * 2 * gapAngle;
      const endAngle = startAngle + gapAngle;
      this.gfx.arc(0, 0, ringR, startAngle, endAngle);
      this.gfx.stroke({ color: FOOD_RING_COLOR, width: 1.5, alpha: 0.7 });
    }
  }
}
