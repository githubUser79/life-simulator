import { WORLD_WIDTH, WORLD_HEIGHT } from '../config';

const CELL_SIZE = 50;
const COLS = Math.ceil(WORLD_WIDTH / CELL_SIZE);
const ROWS = Math.ceil(WORLD_HEIGHT / CELL_SIZE);
const DECAY = 0.992;

/** Three pheromone channels: danger (prey alarm), territory (predator), neutral (omnivore) */
export class PheromoneGrid {
  /** Prey alarm — emitted when prey is attacked, warns other prey */
  danger: Float32Array;
  /** Predator territory — emitted by predators, repels other predators */
  territory: Float32Array;
  /** Omnivore scent — mild trail left by omnivores */
  scent: Float32Array;

  constructor() {
    this.danger = new Float32Array(COLS * ROWS);
    this.territory = new Float32Array(COLS * ROWS);
    this.scent = new Float32Array(COLS * ROWS);
  }

  private idx(x: number, y: number): number {
    const col = Math.floor(x / CELL_SIZE) % COLS;
    const row = Math.floor(y / CELL_SIZE) % ROWS;
    return ((row % ROWS) + ROWS) % ROWS * COLS + ((col % COLS) + COLS) % COLS;
  }

  /** Emit pheromone at world position */
  emit(x: number, y: number, channel: 'danger' | 'territory' | 'scent', amount: number): void {
    const i = this.idx(x, y);
    this[channel][i] = Math.min(this[channel][i] + amount, 10);
  }

  /** Sample pheromone intensity at world position (returns 0-1 normalized) */
  sample(x: number, y: number, channel: 'danger' | 'territory' | 'scent'): number {
    const i = this.idx(x, y);
    return Math.min(this[channel][i] / 5, 1); // normalize: 5 = max signal
  }

  /**
   * Sample the gradient (direction of strongest increase) at a world position.
   * Returns [gx, gy] normalized to [-1, 1] relative to creature's facing direction.
   */
  gradient(x: number, y: number, channel: 'danger' | 'territory' | 'scent', direction: number): { forward: number; lateral: number } {
    const grid = this[channel];
    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);

    // Sample 4 neighbors
    const left  = grid[((row % ROWS + ROWS) % ROWS) * COLS + (((col - 1) % COLS + COLS) % COLS)] || 0;
    const right = grid[((row % ROWS + ROWS) % ROWS) * COLS + (((col + 1) % COLS + COLS) % COLS)] || 0;
    const up    = grid[(((row - 1) % ROWS + ROWS) % ROWS) * COLS + ((col % COLS + COLS) % COLS)] || 0;
    const down  = grid[(((row + 1) % ROWS + ROWS) % ROWS) * COLS + ((col % COLS + COLS) % COLS)] || 0;

    // World-space gradient
    const gx = (right - left) / 10; // normalize to ~[-1, 1]
    const gy = (down - up) / 10;

    // Rotate into creature's local frame
    const cos = Math.cos(-direction);
    const sin = Math.sin(-direction);
    const forward = gx * cos - gy * sin; // how much smell increases ahead
    const lateral = gx * sin + gy * cos; // how much smell increases to the right

    return { forward: Math.max(-1, Math.min(1, forward)), lateral: Math.max(-1, Math.min(1, lateral)) };
  }

  /** Decay all channels */
  tick(): void {
    for (let i = 0; i < this.danger.length; i++) {
      this.danger[i] *= DECAY;
      this.territory[i] *= DECAY;
      this.scent[i] *= DECAY;
    }
  }

  /** Diffuse pheromones to neighboring cells (call less often — every 10 ticks) */
  diffuse(): void {
    for (const grid of [this.danger, this.territory, this.scent]) {
      const copy = new Float32Array(grid);
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const i = row * COLS + col;
          const val = copy[i];
          if (val < 0.01) continue;
          // Spread 20% to neighbors
          const spread = val * 0.05;
          const up = ((row - 1 + ROWS) % ROWS) * COLS + col;
          const down = ((row + 1) % ROWS) * COLS + col;
          const left = row * COLS + ((col - 1 + COLS) % COLS);
          const right = row * COLS + ((col + 1) % COLS);
          grid[up] += spread;
          grid[down] += spread;
          grid[left] += spread;
          grid[right] += spread;
          grid[i] -= spread * 4;
        }
      }
    }
  }

  reset(): void {
    this.danger.fill(0);
    this.territory.fill(0);
    this.scent.fill(0);
  }
}
