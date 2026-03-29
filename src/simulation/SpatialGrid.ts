import { Entity } from '../entities/Entity';
import { MAX_RAY_DISTANCE, WORLD_WIDTH, WORLD_HEIGHT } from '../config';

const CELL_SIZE = MAX_RAY_DISTANCE;

export class SpatialGrid {
  private cols: number;
  private rows: number;
  private cells: Map<number, Set<Entity>> = new Map();
  /** Track which cell each entity is in for fast removal */
  private entityCell: Map<Entity, number> = new Map();

  constructor() {
    this.cols = Math.ceil(WORLD_WIDTH / CELL_SIZE);
    this.rows = Math.ceil(WORLD_HEIGHT / CELL_SIZE);
  }

  private key(col: number, row: number): number {
    return row * this.cols + col;
  }

  private cellFor(x: number, y: number): number {
    const col = Math.floor(x / CELL_SIZE) % this.cols;
    const row = Math.floor(y / CELL_SIZE) % this.rows;
    return this.key(
      ((col % this.cols) + this.cols) % this.cols,
      ((row % this.rows) + this.rows) % this.rows
    );
  }

  insert(entity: Entity): void {
    const cell = this.cellFor(entity.position.x, entity.position.y);
    if (!this.cells.has(cell)) {
      this.cells.set(cell, new Set());
    }
    this.cells.get(cell)!.add(entity);
    this.entityCell.set(entity, cell);
  }

  remove(entity: Entity): void {
    const cell = this.entityCell.get(entity);
    if (cell !== undefined) {
      this.cells.get(cell)?.delete(entity);
      this.entityCell.delete(entity);
    }
  }

  update(entity: Entity): void {
    const newCell = this.cellFor(entity.position.x, entity.position.y);
    const oldCell = this.entityCell.get(entity);
    if (oldCell === newCell) return;
    this.remove(entity);
    this.insert(entity);
  }

  /** Get all entities within radius of (x, y) */
  getNearby(x: number, y: number, radius: number): Entity[] {
    const result: Entity[] = [];
    const cellRadius = Math.ceil(radius / CELL_SIZE);

    const centerCol = Math.floor(x / CELL_SIZE);
    const centerRow = Math.floor(y / CELL_SIZE);

    for (let dr = -cellRadius; dr <= cellRadius; dr++) {
      for (let dc = -cellRadius; dc <= cellRadius; dc++) {
        const col = ((centerCol + dc) % this.cols + this.cols) % this.cols;
        const row = ((centerRow + dr) % this.rows + this.rows) % this.rows;
        const cell = this.key(col, row);
        const entities = this.cells.get(cell);
        if (!entities) continue;
        for (const e of entities) {
          if (!e.alive) continue;
          // Wrapping-aware distance
          let dx = e.position.x - x;
          let dy = e.position.y - y;
          if (dx > WORLD_WIDTH / 2) dx -= WORLD_WIDTH;
          if (dx < -WORLD_WIDTH / 2) dx += WORLD_WIDTH;
          if (dy > WORLD_HEIGHT / 2) dy -= WORLD_HEIGHT;
          if (dy < -WORLD_HEIGHT / 2) dy += WORLD_HEIGHT;
          if (dx * dx + dy * dy <= radius * radius) {
            result.push(e);
          }
        }
      }
    }
    return result;
  }

  clear(): void {
    this.cells.clear();
    this.entityCell.clear();
  }
}
