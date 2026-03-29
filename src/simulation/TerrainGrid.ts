import { WORLD_WIDTH, WORLD_HEIGHT } from '../config';

export type Biome = 'grassland' | 'forest' | 'desert' | 'water';

const CELL_SIZE = 200;
const COLS = Math.ceil(WORLD_WIDTH / CELL_SIZE);
const ROWS = Math.ceil(WORLD_HEIGHT / CELL_SIZE);

/** Biome properties */
export const BIOME_PROPS: Record<Biome, {
  speedMult: number;      // movement speed multiplier
  visionMult: number;     // ray distance multiplier
  plantChanceMult: number; // plant spawn chance multiplier
  color: number;          // render overlay color
  alpha: number;          // render overlay alpha
}> = {
  grassland: { speedMult: 1.0, visionMult: 1.0, plantChanceMult: 1.0, color: 0x000000, alpha: 0 },
  forest:    { speedMult: 0.8, visionMult: 0.6, plantChanceMult: 3.0, color: 0x224422, alpha: 0.25 },
  desert:    { speedMult: 1.2, visionMult: 1.2, plantChanceMult: 0.2, color: 0x443322, alpha: 0.2 },
  water:     { speedMult: 0.5, visionMult: 0.8, plantChanceMult: 0.0, color: 0x112244, alpha: 0.35 },
};

export class TerrainGrid {
  grid: Biome[];
  readonly cols = COLS;
  readonly rows = ROWS;
  readonly cellSize = CELL_SIZE;

  constructor() {
    this.grid = new Array(COLS * ROWS).fill('grassland');
    this.generate();
  }

  /** Procedural terrain generation using simple noise-like blobs */
  generate(): void {
    this.grid.fill('grassland');

    // Place biome blobs
    const biomes: Biome[] = ['forest', 'desert', 'water'];
    for (const biome of biomes) {
      const blobCount = biome === 'water' ? 3 : 5;
      for (let b = 0; b < blobCount; b++) {
        const cx = Math.floor(Math.random() * COLS);
        const cy = Math.floor(Math.random() * ROWS);
        const radius = 2 + Math.floor(Math.random() * 3);

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (dx * dx + dy * dy > radius * radius) continue;
            // Fuzzy edges
            if (dx * dx + dy * dy > (radius - 1) * (radius - 1) && Math.random() < 0.4) continue;
            const col = ((cx + dx) % COLS + COLS) % COLS;
            const row = ((cy + dy) % ROWS + ROWS) % ROWS;
            this.grid[row * COLS + col] = biome;
          }
        }
      }
    }
  }

  /** Get biome at world position */
  getBiome(x: number, y: number): Biome {
    const col = Math.floor(x / CELL_SIZE) % COLS;
    const row = Math.floor(y / CELL_SIZE) % ROWS;
    return this.grid[((row % ROWS) + ROWS) % ROWS * COLS + ((col % COLS) + COLS) % COLS];
  }

  /** Get speed multiplier at world position */
  getSpeedMult(x: number, y: number): number {
    return BIOME_PROPS[this.getBiome(x, y)].speedMult;
  }

  /** Get vision multiplier at world position */
  getVisionMult(x: number, y: number): number {
    return BIOME_PROPS[this.getBiome(x, y)].visionMult;
  }

  /** Get plant spawn chance multiplier at world position */
  getPlantChanceMult(x: number, y: number): number {
    return BIOME_PROPS[this.getBiome(x, y)].plantChanceMult;
  }
}
