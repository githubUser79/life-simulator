import { Application, Container, Graphics } from 'pixi.js';
import { World } from './simulation/World';
import { Creature } from './entities/Creature';
import { Plant } from './entities/Plant';
import { FoodDrop } from './entities/FoodDrop';
import { CreatureRenderer } from './rendering/CreatureRenderer';
import { PlantRenderer } from './rendering/PlantRenderer';
import { FoodRenderer } from './rendering/FoodRenderer';
import { castRays } from './simulation/Raycasting';
import { NeuralNetViz } from './ui/NeuralNetViz';
import { PopulationGraph } from './ui/PopulationGraph';
import { Minimap } from './ui/Minimap';
import { StatsPanel } from './ui/StatsPanel';
import { HUD } from './ui/HUD';
import { DevTools } from './ui/DevTools';
import { AutoBalancer } from './ai/AutoBalancer';
import { getDaylightFactor } from './simulation/Raycasting';
import { Heatmap } from './rendering/Heatmap';
import { TerrainRenderer } from './rendering/TerrainRenderer';
import { Commentator } from './ai/Commentator';
import { CommentaryPanel } from './ui/CommentaryPanel';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  BACKGROUND_COLOR,
  GRID_LINE_COLOR,
  GRID_CELL_SIZE,
  MAX_DT,
  FLASH_DURATION,
  RAY_ZONE_COLORS,
  CREATURE_FOV,
  NUM_ZONES,
  MAX_RAY_DISTANCE,
  SPATIAL_CELL_SIZE,
} from './config';

// ── App state ──
let selectedCreature: Creature | null = null;
let cameraX = 0;
let cameraY = 0;
let zoom = 1;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragCamStartX = 0;
let dragCamStartY = 0;
let startTime = 0;

// ── Renderer maps ──
const creatureRenderers = new Map<Creature, CreatureRenderer>();
const plantRenderers = new Map<Plant, PlantRenderer>();
const foodRenderers = new Map<FoodDrop, FoodRenderer>();

// ── Flash animation tracking ──
const flashTimers = new Map<Creature, number>();

async function main() {
  const app = new Application();
  await app.init({
    background: BACKGROUND_COLOR,
    resizeTo: window,
    antialias: true,
  });
  document.getElementById('app')!.appendChild(app.canvas);

  let world = new World();
  startTime = performance.now();

  // ── World container (scrollable/zoomable) ──
  const worldContainer = new Container();
  app.stage.addChild(worldContainer);

  // Background grid
  const gridGfx = new Graphics();
  drawGrid(gridGfx);
  worldContainer.addChild(gridGfx);

  // Terrain overlay (between grid and entities)
  const terrainRenderer = new TerrainRenderer();
  terrainRenderer.render(world.terrain);
  worldContainer.addChild(terrainRenderer.gfx);

  // Shadow layer (behind entities)
  const shadowLayer = new Container();
  worldContainer.addChild(shadowLayer);

  // Entity layer
  const entityLayer = new Container();
  worldContainer.addChild(entityLayer);

  // Heatmap layer (between entities and rays)
  const heatmap = new Heatmap();
  worldContainer.addChild(heatmap.container);

  // Ray overlay layer
  const rayLayer = new Graphics();
  worldContainer.addChild(rayLayer);

  // Spatial grid debug layer
  const spatialGridGfx = new Graphics();
  worldContainer.addChild(spatialGridGfx);

  // ── UI layer (fixed on screen) ──
  const uiLayer = new Container();
  app.stage.addChild(uiLayer);

  const nnViz = new NeuralNetViz();
  uiLayer.addChild(nnViz.container);

  const popGraph = new PopulationGraph();
  uiLayer.addChild(popGraph.container);

  const minimap = new Minimap();
  uiLayer.addChild(minimap.container);
  minimap.onNavigate = (worldX, worldY) => {
    // Center camera on clicked world position, deselect creature
    selectedCreature = null;
    nnViz.setCreature(null);
    statsPanel.setCreature(null);
    cameraX = worldX - window.innerWidth / (2 * zoom);
    cameraY = worldY - window.innerHeight / (2 * zoom);
  };

  const statsPanel = new StatsPanel();
  uiLayer.addChild(statsPanel.container);

  const hud = new HUD();
  uiLayer.addChild(hud.container);

  // AI Auto-Balancer
  const autoBalancer = new AutoBalancer();

  // AI Commentator
  const commentator = new Commentator();
  commentator.setCanvas(app.canvas as HTMLCanvasElement);
  // Keep reference for potential cleanup (panel attaches itself to DOM)
  void new CommentaryPanel(commentator);

  // Dev Tools
  const devTools = new DevTools(world, autoBalancer, () => {
    // Reset: clear renderers, reset world
    creatureRenderers.clear();
    plantRenderers.clear();
    foodRenderers.clear();
    entityLayer.removeChildren();
    shadowLayer.removeChildren();
    world.reset();
    selectedCreature = null;
    nnViz.setCreature(null);
    statsPanel.setCreature(null);
    commentator.reset();
    terrainRenderer.render(world.terrain);
    startTime = performance.now();
  });

  function layoutUI() {
    // Use window dimensions directly — app.screen may lag behind on resize
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Minimap: top-right
    minimap.container.position.set(w - 440, 10);
    // Population graphs: stacked below minimap on the right
    popGraph.container.position.set(w - 440, 450);
    // StatsPanel: bottom-left
    statsPanel.container.position.set(10, h - 300);
    // HUD: bottom-center
    hud.container.position.set(w / 2 - 215, h - 100);
  }
  layoutUI();
  window.addEventListener('resize', () => {
    // Delay to let Pixi finish its own resize first
    requestAnimationFrame(layoutUI);
  });

  // HUD callbacks
  hud.onPauseToggle = () => { world.paused = !world.paused; };
  hud.onMaxSpeedToggle = () => {
    world.maxSpeed = !world.maxSpeed;
    world.ticksPerFrame = world.maxSpeed ? 10 : devTools.state.speedMultiplier;
  };
  hud.onSettingsToggle = () => { devTools.toggle(); };

  // ── Input handling ──
  const canvas = app.canvas;

  canvas.addEventListener('wheel', (e: WheelEvent) => {
    const oldZoom = zoom;
    zoom *= e.deltaY < 0 ? 1.1 : 0.9;
    zoom = Math.max(0.5, Math.min(3, zoom));
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    cameraX += mx / oldZoom - mx / zoom;
    cameraY += my / oldZoom - my / zoom;
  });

  canvas.addEventListener('pointerdown', (e: PointerEvent) => {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragCamStartX = cameraX;
    dragCamStartY = cameraY;
  });

  canvas.addEventListener('pointermove', (e: PointerEvent) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    // If user intentionally drags, stop following creature
    if ((dx > 5 || dy > 5) && selectedCreature) {
      selectedCreature = null;
      nnViz.setCreature(null);
      statsPanel.setCreature(null);
    }
    cameraX = dragCamStartX - (e.clientX - dragStartX) / zoom;
    cameraY = dragCamStartY - (e.clientY - dragStartY) / zoom;
  });

  canvas.addEventListener('pointerup', (e: PointerEvent) => {
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    isDragging = false;
    if (dx < 5 && dy < 5) {
      handleClick(e, world, canvas, nnViz, statsPanel);
    }
  });

  // Prevent stuck drag state when pointer leaves canvas
  canvas.addEventListener('pointerleave', () => { isDragging = false; });
  canvas.addEventListener('pointercancel', () => { isDragging = false; });

  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      world.paused = !world.paused;
    }
    if (e.code === 'Escape') {
      selectedCreature = null;
      nnViz.setCreature(null);
      statsPanel.setCreature(null);
    }
  });

  // ── Main loop ──
  let lastFrameTime = performance.now();

  app.ticker.add(() => {
    const now = performance.now();
    const frameTime = now - lastFrameTime;
    lastFrameTime = now;
    // dt capping
    const deltaMs = Math.min(app.ticker.deltaMS, MAX_DT);

    // Simulation ticks
    for (let i = 0; i < world.ticksPerFrame; i++) {
      world.tick(1);
    }

    // Heatmap (decay only runs during simulation ticks)
    if (!world.paused) {
      for (let i = 0; i < world.ticksPerFrame; i++) heatmap.tick();
    }
    heatmap.visible = devTools.state.showHeatmap;

    // Process world events for animations
    for (const ev of world.events) {
      if (ev.type === 'eat') {
        flashTimers.set(ev.entity, FLASH_DURATION);
        heatmap.recordEat(ev.entity.position.x, ev.entity.position.y);
      } else if (ev.type === 'death') {
        heatmap.recordDeath(ev.entity.position.x, ev.entity.position.y);
      }
    }

    // Follow selected creature
    if (selectedCreature && selectedCreature.alive) {
      cameraX = selectedCreature.position.x - app.screen.width / (2 * zoom);
      cameraY = selectedCreature.position.y - app.screen.height / (2 * zoom);
    }

    // Update camera
    worldContainer.position.set(-cameraX * zoom, -cameraY * zoom);
    worldContainer.scale.set(zoom);

    // Viewport bounds for culling
    const vpLeft = cameraX - 50;
    const vpTop = cameraY - 50;
    const vpRight = cameraX + app.screen.width / zoom + 50;
    const vpBottom = cameraY + app.screen.height / zoom + 50;

    // ── Sync renderers with entities (viewport culling) ──
    syncRenderers(world, entityLayer, shadowLayer, deltaMs, vpLeft, vpTop, vpRight, vpBottom);

    // ── Update fade animations ──
    for (const entity of world.entities) {
      entity.updateFade(deltaMs);
    }

    // ── Flash animations ──
    for (const [creature, remaining] of flashTimers) {
      if (creature.destroyed || creature.container.destroyed) {
        flashTimers.delete(creature);
        continue;
      }
      const newRemaining = remaining - deltaMs;
      if (newRemaining <= 0) {
        flashTimers.delete(creature);
        creature.container.tint = 0xffffff;
      } else {
        flashTimers.set(creature, newRemaining);
        const t = newRemaining / FLASH_DURATION;
        creature.container.tint = lerpColorNum(0xffffff, 0xffffcc, t);
      }
    }

    // ── Draw rays for focused creature ──
    rayLayer.clear();
    const rayCreatures = devTools.state.showAllRays
      ? [...world.predators, ...world.prey, ...world.omnivores].filter((c) => c.alive)
      : selectedCreature && selectedCreature.alive ? [selectedCreature] : [];

    for (const creature of rayCreatures) {
      drawCreatureRays(rayLayer, creature, world);
    }

    // ── Draw zone sectors if enabled ──
    if (devTools.state.showZoneSectors && selectedCreature && selectedCreature.alive) {
      drawZoneSectors(rayLayer, selectedCreature);
    }

    // ── Day/Night cycle – tint the world container ──
    const daylight = getDaylightFactor(world.tickCount);
    worldContainer.alpha = 0.4 + daylight * 0.6; // dim at night

    // ── Heatmap ──
    heatmap.render();

    // ── Spatial grid debug ──
    spatialGridGfx.clear();
    if (devTools.state.showSpatialGrid) {
      drawSpatialGrid(spatialGridGfx);
    }

    // ── Update UI ──
    const timeSeconds = (now - startTime) / 1000;
    const stats = world.stats;

    nnViz.update(world.tickCount);
    statsPanel.render();

    if (world.tickCount % 5 === 0) {
      popGraph.push(stats.predators, stats.prey, stats.omnivores, stats.plants, stats.food);
      popGraph.render();
    }

    minimap.update(
      world.entities, cameraX, cameraY,
      app.screen.width, app.screen.height, zoom
    );

    hud.update(world.tickCount, timeSeconds, frameTime, world.paused, world.maxSpeed);

    // AI Commentator (also serves as Ollama keep-alive)
    const popSnap = { ...stats, tick: world.tickCount };
    commentator.recordStats(popSnap);
    void commentator.tryComment(world.tickCount, popSnap);

    // AI Auto-Balancer
    void autoBalancer.tick(
      world.tickCount,
      popSnap,
      world.params,
      (changes) => {
        Object.assign(world.params, changes);
        devTools.refreshSliders();
      },
    );
  });
}

function handleClick(
  e: PointerEvent, world: World, canvas: HTMLCanvasElement,
  nnViz: NeuralNetViz, statsPanel: StatsPanel
) {
  const rect = canvas.getBoundingClientRect();
  const worldX = cameraX + (e.clientX - rect.left) / zoom;
  const worldY = cameraY + (e.clientY - rect.top) / zoom;

  let best: Creature | null = null;
  let bestDist = 30;
  for (const c of [...world.predators, ...world.prey, ...world.omnivores]) {
    if (!c.alive) continue;
    const dx = c.position.x - worldX;
    const dy = c.position.y - worldY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestDist) { bestDist = d; best = c; }
  }

  selectedCreature = best;
  nnViz.setCreature(best);
  statsPanel.setCreature(best);
}

function isInViewport(
  x: number, y: number,
  vpLeft: number, vpTop: number, vpRight: number, vpBottom: number
): boolean {
  return x >= vpLeft && x <= vpRight && y >= vpTop && y <= vpBottom;
}

function syncRenderers(
  world: World, entityLayer: Container, shadowLayer: Container,
  deltaMs: number,
  vpLeft: number, vpTop: number, vpRight: number, vpBottom: number
) {
  // Creatures
  const aliveCreatures = new Set<Creature>();
  for (const c of [...world.predators, ...world.prey, ...world.omnivores]) {
    aliveCreatures.add(c);
    if (!creatureRenderers.has(c)) {
      const renderer = new CreatureRenderer(c);
      creatureRenderers.set(c, renderer);
      entityLayer.addChild(c.container);

      // Add shadow
      const shadow = new Graphics();
      shadow.circle(0, 0, c.baseRadius * 0.9);
      shadow.fill({ color: 0x000000, alpha: 0.3 });
      shadow.position.set(c.position.x + 3, c.position.y + 3);
      shadow.scale.set(0.9);
      (c as any).__shadow = shadow;
      shadowLayer.addChild(shadow);
    }

    // Viewport culling: only render if visible
    const inView = isInViewport(c.position.x, c.position.y, vpLeft, vpTop, vpRight, vpBottom);
    if (inView) {
      creatureRenderers.get(c)!.render(0, deltaMs);
    }

    // Update shadow position
    const shadow = (c as any).__shadow as Graphics | undefined;
    if (shadow) {
      shadow.position.set(c.position.x + 3, c.position.y + 3);
      shadow.visible = inView;
    }

    // Death shrink animation
    if (!c.alive && !c.destroyed) {
      const t = Math.min(c.container.alpha, 1); // alpha is already decreasing via fade
      c.container.scale.set(t);
    }
  }
  for (const [c] of creatureRenderers) {
    if (!aliveCreatures.has(c) && c.destroyed) {
      creatureRenderers.delete(c);
      const shadow = (c as any).__shadow as Graphics | undefined;
      if (shadow && !shadow.destroyed) { shadow.destroy(); }
      c.destroy();
    }
  }

  // Plants
  const alivePlants = new Set<Plant>();
  for (const p of world.plants) {
    alivePlants.add(p);
    if (!plantRenderers.has(p)) {
      const renderer = new PlantRenderer(p);
      plantRenderers.set(p, renderer);
      entityLayer.addChild(p.container);
    }
    const inView = isInViewport(p.position.x, p.position.y, vpLeft, vpTop, vpRight, vpBottom);
    if (inView) {
      plantRenderers.get(p)!.render(0, deltaMs);
    }
  }
  for (const [p] of plantRenderers) {
    if (!alivePlants.has(p) && p.destroyed) {
      plantRenderers.delete(p);
      p.destroy();
    }
  }

  // Food
  const aliveFood = new Set<FoodDrop>();
  for (const f of world.food) {
    aliveFood.add(f);
    if (!foodRenderers.has(f)) {
      const renderer = new FoodRenderer(f);
      foodRenderers.set(f, renderer);
      entityLayer.addChild(f.container);
    }
    const inView = isInViewport(f.position.x, f.position.y, vpLeft, vpTop, vpRight, vpBottom);
    if (inView) {
      foodRenderers.get(f)!.render(0, deltaMs);
    }
  }
  for (const [f] of foodRenderers) {
    if (!aliveFood.has(f) && f.destroyed) {
      foodRenderers.delete(f);
      f.destroy();
    }
  }
}

/** Draw rays from a creature to its detected entities */
function drawCreatureRays(gfx: Graphics, creature: Creature, world: World) {
  const zones = castRays(creature, world.grid);
  const fov = CREATURE_FOV;
  const halfFov = fov / 2;
  const zoneWidth = fov / NUM_ZONES;

  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    if (zone.normalizedDist >= 1) continue; // no hit

    const zoneAngle = -halfFov + (i + 0.5) * zoneWidth;
    const absAngle = creature.direction + zoneAngle;
    const dist = zone.normalizedDist * MAX_RAY_DISTANCE;

    const endX = creature.position.x + Math.cos(absAngle) * dist;
    const endY = creature.position.y + Math.sin(absAngle) * dist;

    const color = RAY_ZONE_COLORS[i] ?? 0xffffff;
    const alpha = 0.3 + (1 - zone.normalizedDist) * 0.5;

    gfx.moveTo(creature.position.x, creature.position.y);
    gfx.lineTo(endX, endY);
    gfx.stroke({ color, width: 1.5, alpha });
  }
}

/** Draw FOV zone sectors for a creature */
function drawZoneSectors(gfx: Graphics, creature: Creature) {
  const fov = CREATURE_FOV;
  const halfFov = fov / 2;
  const zoneWidth = fov / NUM_ZONES;

  for (let i = 0; i < NUM_ZONES; i++) {
    const startAngle = creature.direction - halfFov + i * zoneWidth;
    const endAngle = startAngle + zoneWidth;
    const color = RAY_ZONE_COLORS[i] ?? 0xffffff;

    gfx.moveTo(creature.position.x, creature.position.y);
    gfx.arc(creature.position.x, creature.position.y, MAX_RAY_DISTANCE, startAngle, endAngle);
    gfx.lineTo(creature.position.x, creature.position.y);
    gfx.fill({ color, alpha: 0.08 });
    gfx.stroke({ color, width: 0.5, alpha: 0.3 });
  }
}

/** Draw spatial grid debug overlay */
function drawSpatialGrid(gfx: Graphics) {
  for (let x = 0; x <= WORLD_WIDTH; x += SPATIAL_CELL_SIZE) {
    gfx.moveTo(x, 0);
    gfx.lineTo(x, WORLD_HEIGHT);
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += SPATIAL_CELL_SIZE) {
    gfx.moveTo(0, y);
    gfx.lineTo(WORLD_WIDTH, y);
  }
  gfx.stroke({ color: 0xff8800, width: 0.5, alpha: 0.3 });
}

function drawGrid(gfx: Graphics) {
  gfx.clear();
  for (let x = 0; x <= WORLD_WIDTH; x += GRID_CELL_SIZE) {
    gfx.moveTo(x, 0);
    gfx.lineTo(x, WORLD_HEIGHT);
  }
  for (let y = 0; y <= WORLD_HEIGHT; y += GRID_CELL_SIZE) {
    gfx.moveTo(0, y);
    gfx.lineTo(WORLD_WIDTH, y);
  }
  gfx.stroke({ color: GRID_LINE_COLOR, width: 0.5, alpha: 0.5 });
}

function lerpColorNum(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16) |
    (Math.round(ag + (bg - ag) * t) << 8) |
    Math.round(ab + (bb - ab) * t)
  );
}

main();
