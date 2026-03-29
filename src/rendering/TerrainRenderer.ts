import { Graphics } from 'pixi.js';
import { TerrainGrid, BIOME_PROPS } from '../simulation/TerrainGrid';

export class TerrainRenderer {
  gfx: Graphics;

  constructor() {
    this.gfx = new Graphics();
  }

  /** Render the terrain grid (call once, or on terrain regeneration) */
  render(terrain: TerrainGrid): void {
    this.gfx.clear();

    for (let row = 0; row < terrain.rows; row++) {
      for (let col = 0; col < terrain.cols; col++) {
        const biome = terrain.grid[row * terrain.cols + col];
        const props = BIOME_PROPS[biome];
        if (props.alpha <= 0) continue; // grassland = transparent

        const x = col * terrain.cellSize;
        const y = row * terrain.cellSize;
        this.gfx.rect(x, y, terrain.cellSize, terrain.cellSize);
        this.gfx.fill({ color: props.color, alpha: props.alpha });
      }
    }
  }
}
