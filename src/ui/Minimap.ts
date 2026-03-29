import { Container, Graphics } from 'pixi.js';
import { Predator } from '../entities/Predator';
import { Prey } from '../entities/Prey';
import { Omnivore } from '../entities/Omnivore';
import { Plant } from '../entities/Plant';
import { WORLD_WIDTH, WORLD_HEIGHT, PREDATOR_COLOR, PREY_COLOR, OMNIVORE_COLOR, PLANT_COLOR } from '../config';
import type { Entity } from '../entities/Entity';

const MAP_SIZE = 430;
const SCALE_X = MAP_SIZE / WORLD_WIDTH;
const SCALE_Y = MAP_SIZE / WORLD_HEIGHT;
const BORDER_COLOR = 0x44bbdd;

export class Minimap {
  container: Container;
  private bg: Graphics;
  private dots: Graphics;
  private viewport: Graphics;
  private hitArea: Graphics;
  private frameCounter = 0;

  /** Called when user clicks on the minimap — receives world coordinates */
  onNavigate: ((worldX: number, worldY: number) => void) | null = null;

  constructor() {
    this.container = new Container();

    this.bg = new Graphics();
    this.bg.roundRect(0, 0, MAP_SIZE, MAP_SIZE, 8);
    this.bg.fill({ color: 0x0a0e14, alpha: 0.88 });
    this.bg.roundRect(0, 0, MAP_SIZE, MAP_SIZE, 8);
    this.bg.stroke({ color: BORDER_COLOR, width: 1.5, alpha: 0.5 });
    this.container.addChild(this.bg);

    this.dots = new Graphics();
    this.container.addChild(this.dots);

    this.viewport = new Graphics();
    this.container.addChild(this.viewport);

    // Invisible hit area for click detection (on top of everything)
    this.hitArea = new Graphics();
    this.hitArea.roundRect(0, 0, MAP_SIZE, MAP_SIZE, 8);
    this.hitArea.fill({ color: 0x000000, alpha: 0.001 }); // nearly invisible but hittable
    this.hitArea.eventMode = 'static';
    this.hitArea.cursor = 'pointer';
    this.container.addChild(this.hitArea);

    this.hitArea.on('pointerdown', (e) => {
      const local = this.container.toLocal(e.global);
      const worldX = local.x / SCALE_X;
      const worldY = local.y / SCALE_Y;
      this.onNavigate?.(worldX, worldY);
    });
  }

  update(
    entities: Entity[],
    cameraX: number,
    cameraY: number,
    viewWidth: number,
    viewHeight: number,
    zoom: number,
  ): void {
    this.frameCounter++;

    // Always update viewport rectangle (cheap, needs to track camera movement)
    this.viewport.clear();
    const vw = (viewWidth / zoom) * SCALE_X;
    const vh = (viewHeight / zoom) * SCALE_Y;
    const vx = cameraX * SCALE_X;
    const vy = cameraY * SCALE_Y;
    this.viewport.rect(vx, vy, vw, vh);
    this.viewport.stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });

    // Redraw entity dots every 10 frames (expensive)
    if (this.frameCounter % 10 !== 0) return;

    this.dots.clear();

    for (const e of entities) {
      if (!e.alive) continue;
      const mx = e.position.x * SCALE_X;
      const my = e.position.y * SCALE_Y;

      let color = 0xffffff;
      let size = 2.5;
      if (e instanceof Predator) { color = PREDATOR_COLOR; size = 3; }
      else if (e instanceof Omnivore) { color = OMNIVORE_COLOR; size = 2.5; }
      else if (e instanceof Prey) { color = PREY_COLOR; size = 2.5; }
      else if (e instanceof Plant) { color = PLANT_COLOR; size = 1.5; }
      else continue;

      this.dots.circle(mx, my, size);
      this.dots.fill({ color });
    }
  }
}
