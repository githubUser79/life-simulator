import { Container, Graphics } from 'pixi.js';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config';

const CELL_SIZE = 100;
const COLS = Math.ceil(WORLD_WIDTH / CELL_SIZE);
const ROWS = Math.ceil(WORLD_HEIGHT / CELL_SIZE);
const DECAY = 0.995; // per tick decay factor

export class Heatmap {
  container: Container;
  visible = false;
  private gfx: Graphics;
  private deathGrid: Float32Array;
  private eatGrid: Float32Array;
  private frameCount = 0;

  constructor() {
    this.container = new Container();
    this.container.alpha = 0.4;
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
    this.deathGrid = new Float32Array(COLS * ROWS);
    this.eatGrid = new Float32Array(COLS * ROWS);
  }

  /** Record a death event */
  recordDeath(x: number, y: number): void {
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      this.deathGrid[row * COLS + col] += 1;
    }
  }

  /** Record an eating event */
  recordEat(x: number, y: number): void {
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      this.eatGrid[row * COLS + col] += 1;
    }
  }

  /** Call every tick to decay values */
  tick(): void {
    for (let i = 0; i < this.deathGrid.length; i++) {
      this.deathGrid[i] *= DECAY;
      this.eatGrid[i] *= DECAY;
    }
  }

  /** Render the heatmap (call less frequently — every 30 frames) */
  render(): void {
    if (!this.visible) {
      this.container.visible = false;
      this.frameCount = 0; // reset so first frame after toggle renders immediately
      return;
    }
    this.container.visible = true;
    this.frameCount++;
    if (this.frameCount % 30 !== 0 && this.frameCount > 1) return;

    this.gfx.clear();

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        const death = Math.min(this.deathGrid[idx], 10);
        const eat = Math.min(this.eatGrid[idx], 10);

        if (death < 0.1 && eat < 0.1) continue;

        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;

        // Deaths = red, Eating = green, both = yellow
        if (death > 0.1) {
          this.gfx.rect(x, y, CELL_SIZE, CELL_SIZE);
          this.gfx.fill({ color: 0xcc2222, alpha: Math.min(death / 10, 0.6) });
        }
        if (eat > 0.1) {
          this.gfx.rect(x, y, CELL_SIZE, CELL_SIZE);
          this.gfx.fill({ color: 0x22cc44, alpha: Math.min(eat / 10, 0.4) });
        }
      }
    }
  }

  reset(): void {
    this.deathGrid.fill(0);
    this.eatGrid.fill(0);
  }
}
