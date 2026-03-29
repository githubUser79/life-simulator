import { Graphics } from 'pixi.js';
import { Plant } from '../entities/Plant';
import { PLANT_COLOR } from '../config';

/**
 * Renders a plant as a 4-leaf clover with growth animation
 * and gentle rotation oscillation.
 */
export class PlantRenderer {
  private plant: Plant;
  private gfx: Graphics;
  private animTime = 0;

  constructor(plant: Plant) {
    this.plant = plant;
    this.gfx = new Graphics();
    plant.container.addChild(this.gfx);
  }

  /** Call each frame from Pixi ticker */
  render(_time: number, deltaMs: number): void {
    this.animTime += deltaMs * 0.001;
    const growth = this.plant.growthProgress;
    const r = this.plant.maxRadius * growth;

    // Gentle rotation oscillation ±5°
    const rotOscillation = Math.sin(this.animTime * 2) * (5 * Math.PI) / 180;
    this.gfx.rotation = rotOscillation;

    this.gfx.clear();

    if (r < 0.5) return; // too small to draw

    // Draw 4 heart-shaped leaves (clover)
    for (let leaf = 0; leaf < 4; leaf++) {
      const angle = (leaf / 4) * Math.PI * 2;
      const cx = Math.cos(angle) * r * 0.5;
      const cy = Math.sin(angle) * r * 0.5;

      // Each leaf: approximate heart shape with 2 overlapping circles + a triangle tip
      const leafSize = r * 0.45;
      const offsetX = Math.cos(angle + Math.PI / 2) * leafSize * 0.3;
      const offsetY = Math.sin(angle + Math.PI / 2) * leafSize * 0.3;

      // Left lobe
      this.gfx.circle(cx - offsetX, cy - offsetY, leafSize * 0.5);
      this.gfx.fill({ color: PLANT_COLOR, alpha: 0.85 });

      // Right lobe
      this.gfx.circle(cx + offsetX, cy + offsetY, leafSize * 0.5);
      this.gfx.fill({ color: PLANT_COLOR, alpha: 0.85 });

      // Tip triangle
      const tipX = cx + Math.cos(angle) * leafSize * 0.7;
      const tipY = cy + Math.sin(angle) * leafSize * 0.7;
      this.gfx.beginPath();
      this.gfx.moveTo(cx - offsetX, cy - offsetY);
      this.gfx.lineTo(tipX, tipY);
      this.gfx.lineTo(cx + offsetX, cy + offsetY);
      this.gfx.closePath();
      this.gfx.fill({ color: PLANT_COLOR, alpha: 0.85 });
    }

    // Center dot
    this.gfx.circle(0, 0, r * 0.15);
    this.gfx.fill({ color: 0x338844 });
  }
}
