import { Entity } from '../entities/Entity';
import { Predator } from '../entities/Predator';
import { Prey } from '../entities/Prey';
import { Omnivore } from '../entities/Omnivore';
import { Plant } from '../entities/Plant';
import { FoodDrop } from '../entities/FoodDrop';
import { Creature } from '../entities/Creature';
import { Genome } from '../neural/Genome';
import { mutate } from '../neural/Evolution';
import { SpatialGrid } from './SpatialGrid';
import { castRays, getDaylightFactor } from './Raycasting';
import { PheromoneGrid } from './PheromoneGrid';
import { TerrainGrid } from './TerrainGrid';
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  INITIAL_PREDATORS,
  INITIAL_PREY,
  INITIAL_PLANTS,
  PLANT_REPRODUCE_CHANCE,
  PLANT_REPRODUCE_RADIUS,
  PLANT_MAX_COUNT,
  PREDATOR_BASE_RADIUS,
  PREY_BASE_RADIUS,
  FOOD_ENERGY_VALUE,
  SPLIT_ENERGY_THRESHOLD,
  FOOD_DROP_CHANCE_ON_DEATH,
  PLANT_REGEN_BOOST_THRESHOLD,
  PLANT_REGEN_BOOST_FACTOR,
  MIN_PREDATORS,
  MIN_PREY,
  PASSIVE_ENERGY_GAIN,
  PRED_PREY_EQUILIBRIUM_RATIO,
  PREDATOR_CROWDING_DRAIN,
  PREDATOR_HUNT_COOLDOWN,
  PREY_SAFETY_BONUS,
  PREY_SCARCITY_THRESHOLD,
  PLANT_MAX_AGE,
  PLANT_CLUSTER_RADIUS,
  PLANT_CLUSTER_MAX,
  INITIAL_OMNIVORES,
  OMNIVORE_BASE_RADIUS,
  MIN_OMNIVORES,
} from '../config';

export type WorldEvent =
  | { type: 'eat'; entity: Creature }
  | { type: 'death'; entity: Entity }
  | { type: 'birth'; entity: Entity; parent: Creature };

/** Mutable balance parameters – can be tweaked live via settings panel */
export interface BalanceParams {
  plantReproduceChance: number;
  plantMaxCount: number;
  passiveEnergyGain: number;
  predatorCrowdingDrain: number;
  huntCooldown: number;
  preySafetyBonus: number;
  preyScarcityThreshold: number;
  splitEnergyThreshold: number;
  predEatEnergy: number;
  preyEatEnergy: number;
  predEatReserve: number;
  preyEatReserve: number;
  equilibriumRatio: number;
  plantRegenBoostFactor: number;
  plantMaxAge: number;
}

export function defaultBalanceParams(): BalanceParams {
  return {
    plantReproduceChance: PLANT_REPRODUCE_CHANCE,
    plantMaxCount: PLANT_MAX_COUNT,
    passiveEnergyGain: PASSIVE_ENERGY_GAIN,
    predatorCrowdingDrain: PREDATOR_CROWDING_DRAIN,
    huntCooldown: PREDATOR_HUNT_COOLDOWN,
    preySafetyBonus: PREY_SAFETY_BONUS,
    preyScarcityThreshold: PREY_SCARCITY_THRESHOLD,
    splitEnergyThreshold: SPLIT_ENERGY_THRESHOLD,
    predEatEnergy: 0.2,
    preyEatEnergy: 0.2,
    predEatReserve: 0.08,
    preyEatReserve: 0.08,
    equilibriumRatio: PRED_PREY_EQUILIBRIUM_RATIO,
    plantRegenBoostFactor: PLANT_REGEN_BOOST_FACTOR,
    plantMaxAge: PLANT_MAX_AGE,
  };
}

export class World {
  entities: Entity[] = [];
  predators: Predator[] = [];
  prey: Prey[] = [];
  omnivores: Omnivore[] = [];
  plants: Plant[] = [];
  food: FoodDrop[] = [];
  grid: SpatialGrid;
  pheromones: PheromoneGrid;
  terrain: TerrainGrid;

  tickCount = 0;
  paused = false;
  maxSpeed = false;
  ticksPerFrame = 1;

  /** Live-tunable balance parameters */
  params: BalanceParams = defaultBalanceParams();

  /** Events from the last tick – consumed by the renderer for animations */
  events: WorldEvent[] = [];

  private toAdd: Entity[] = [];
  private toRemove: Entity[] = [];

  constructor() {
    this.grid = new SpatialGrid();
    this.pheromones = new PheromoneGrid();
    this.terrain = new TerrainGrid();
    this.populate();
  }

  private populate(): void {
    for (let i = 0; i < INITIAL_PREDATORS; i++) {
      this.spawnPredator(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT);
    }
    for (let i = 0; i < INITIAL_PREY; i++) {
      this.spawnPrey(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT);
    }
    for (let i = 0; i < INITIAL_OMNIVORES; i++) {
      this.spawnOmnivore(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT);
    }
    for (let i = 0; i < INITIAL_PLANTS; i++) {
      this.spawnPlant(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT);
    }
  }

  reset(): void {
    // Destroy all entities
    for (const e of this.entities) e.destroy();
    this.entities = [];
    this.predators = [];
    this.prey = [];
    this.omnivores = [];
    this.plants = [];
    this.food = [];
    this.toAdd = [];
    this.toRemove = [];
    this.grid.clear();
    this.pheromones.reset();
    this.tickCount = 0;
    this.events = [];
    this.populate();
    // Flush pending adds
    for (const e of this.toAdd) this.addEntity(e);
    this.toAdd = [];
  }

  spawnPredator(x: number, y: number, genome?: ConstructorParameters<typeof Predator>[2]): Predator {
    const p = new Predator(x, y, genome);
    p.startFadeIn();
    this.toAdd.push(p);
    return p;
  }

  spawnPrey(x: number, y: number, genome?: ConstructorParameters<typeof Prey>[2]): Prey {
    const p = new Prey(x, y, genome);
    p.startFadeIn();
    this.toAdd.push(p);
    return p;
  }

  spawnOmnivore(x: number, y: number, genome?: ConstructorParameters<typeof Omnivore>[2]): Omnivore {
    const o = new Omnivore(x, y, genome);
    o.startFadeIn();
    this.toAdd.push(o);
    return o;
  }

  spawnPlant(x: number, y: number): Plant {
    const p = new Plant(x, y);
    p.startFadeIn();
    this.toAdd.push(p);
    return p;
  }

  spawnFood(x: number, y: number): FoodDrop {
    const f = new FoodDrop(x, y);
    f.startFadeIn();
    this.toAdd.push(f);
    return f;
  }

  private addEntity(entity: Entity): void {
    this.entities.push(entity);
    this.grid.insert(entity);
    if (entity instanceof Predator) this.predators.push(entity);
    else if (entity instanceof Omnivore) this.omnivores.push(entity);
    else if (entity instanceof Prey) this.prey.push(entity);
    else if (entity instanceof Plant) this.plants.push(entity);
    else if (entity instanceof FoodDrop) this.food.push(entity);
  }

  private removeEntity(entity: Entity): void {
    this.grid.remove(entity);
    this.entities = this.entities.filter((e) => e !== entity);
    if (entity instanceof Predator) this.predators = this.predators.filter((e) => e !== entity);
    else if (entity instanceof Omnivore) this.omnivores = this.omnivores.filter((e) => e !== entity);
    else if (entity instanceof Prey) this.prey = this.prey.filter((e) => e !== entity);
    else if (entity instanceof Plant) this.plants = this.plants.filter((e) => e !== entity);
    else if (entity instanceof FoodDrop) {
      this.food = this.food.filter((e) => e !== entity);
    }
  }

  tick(dt: number): void {
    if (this.paused) return;
    this.tickCount++;
    this.events = [];

    // 1. Creatures: raycasting → NN inference → velocity update
    for (const creature of [...this.predators, ...this.prey, ...this.omnivores]) {
      if (!creature.alive) continue;

      const zones = castRays(creature, this.grid, this.tickCount);
      const splitReadiness = creature.energy >= this.params.splitEnergyThreshold ? 1 : creature.energy / this.params.splitEnergyThreshold;
      const cx = creature.position.x;
      const cy = creature.position.y;
      const cdir = creature.direction;

      const inputs: number[] = [
        creature.health,
        creature.energy,
        splitReadiness,
        creature.reserve,
      ];
      for (const z of zones) {
        inputs.push(z.normalizedDist, z.relativeAngle, z.attractiveness);
      }

      // Directional smell: gradient per channel (forward + lateral)
      const dGrad = this.pheromones.gradient(cx, cy, 'danger', cdir);
      const tGrad = this.pheromones.gradient(cx, cy, 'territory', cdir);
      const sGrad = this.pheromones.gradient(cx, cy, 'scent', cdir);
      inputs.push(dGrad.forward, dGrad.lateral, tGrad.forward, tGrad.lateral, sGrad.forward, sGrad.lateral);

      // Environment awareness
      inputs.push(
        getDaylightFactor(this.tickCount),                        // daylight 0-1
        this.terrain.getSpeedMult(cx, cy) / 1.2,                 // terrain type normalized (desert=1.0, water=0.42)
        creature.speed / creature.maxSpeed,                       // own speed 0-1
      );

      const output = creature.think(inputs);
      creature.direction += output.angular * creature.turnSpeed;
      const terrainSpeed = this.terrain.getSpeedMult(cx, cy);
      const speed = Math.abs(output.linear) * creature.maxSpeed * terrainSpeed;
      creature.velocity.x = Math.cos(creature.direction) * speed;
      creature.velocity.y = Math.sin(creature.direction) * speed;

      // Pheromone output: creature decides whether to emit
      if (output.emit > 0.3) {
        const emitStrength = Math.min(output.emit, 1) * 0.5;
        if (creature instanceof Predator) {
          this.pheromones.emit(cx, cy, 'territory', emitStrength);
        } else if (creature instanceof Omnivore) {
          this.pheromones.emit(cx, cy, 'scent', emitStrength);
        } else {
          this.pheromones.emit(cx, cy, 'danger', emitStrength); // prey can warn others
        }
      }
    }

    // 2. Update all entities
    for (const entity of this.entities) {
      if (!entity.alive) continue;
      entity.update(dt);
    }

    // 3. Pheromone decay + diffuse (emission is now NN-controlled in step 1)
    this.pheromones.tick();
    if (this.tickCount % 10 === 0) this.pheromones.diffuse();

    // 4. Collisions
    this.handleCollisions();

    // 4. Health update
    for (const creature of [...this.predators, ...this.prey, ...this.omnivores]) {
      if (!creature.alive) continue;
      if (creature.reserve <= 0 && creature.energy <= 0) {
        creature.takeDamage(0.001 * dt);
      }
    }

    // 4b. Plant aging – old plants die to prevent permanent clusters
    for (const plant of this.plants) {
      if (!plant.alive) continue;
      if (plant.age > this.params.plantMaxAge) {
        plant.takeDamage(1);
      }
    }

    // 5. Handle deaths
    for (const entity of this.entities) {
      if (entity.destroyed) {
        this.toRemove.push(entity);
      }
    }

    // 6. Population snapshot (cached for all subsequent steps)
    const alivePredCount = this.predators.filter((p) => p.alive).length;
    const alivePreyCount = this.prey.filter((p) => p.alive).length;

    // 7. Reproduction with optional crossover
    for (const creature of [...this.predators, ...this.prey, ...this.omnivores]) {
      if (!creature.alive) continue;
      if (creature.energy >= this.params.splitEnergyThreshold) {
        // 20% chance of crossover with a nearby same-species creature
        let child: Creature;
        if (Math.random() < 0.2) {
          const partner = this.findCrossoverPartner(creature);
          if (partner) {
            const fitnessA = creature.age * 0.01 + creature.splits * 3 + creature.kills * 2;
            const fitnessB = partner.age * 0.01 + partner.splits * 3 + partner.kills * 2;
            const childGenome = Genome.crossover(creature.genome, partner.genome, fitnessA >= fitnessB);
            mutate(childGenome, Math.max(fitnessA, fitnessB));
            if (creature instanceof Predator) {
              child = new Predator(creature.position.x, creature.position.y, childGenome);
            } else if (creature instanceof Omnivore) {
              child = new Omnivore(creature.position.x, creature.position.y, childGenome);
            } else {
              child = new Prey(creature.position.x, creature.position.y, childGenome);
            }
            child.energy = creature.energy * 0.4;
            creature.energy *= 0.4;
            creature.reserve = 0;
            creature.splits++;
            // Traits: average parents + mutation
            child.toxicity = Math.max(0, Math.min(1, (creature.toxicity + partner.toxicity) / 2 + (Math.random() - 0.5) * 0.1));
            child.poisonResistance = Math.max(0, Math.min(1, (creature.poisonResistance + partner.poisonResistance) / 2 + (Math.random() - 0.5) * 0.1));
            child.defense = Math.max(0, Math.min(1, (creature.defense + partner.defense) / 2 + (Math.random() - 0.5) * 0.1));
            child.lineageId = creature.lineageId;
            child.generation = Math.max(creature.generation, partner.generation) + 1;
            child.parentId = creature.creatureId;
          } else {
            child = creature.reproduce();
          }
        } else {
          child = creature.reproduce();
        }
        child.startFadeIn();
        this.toAdd.push(child);
        this.events.push({ type: 'birth', entity: child, parent: creature });
      }
    }

    // 8. Plant reproduction – boosted when prey count is low
    if (this.plants.length < this.params.plantMaxCount) {
      const reproduceChance = alivePreyCount < PLANT_REGEN_BOOST_THRESHOLD
        ? this.params.plantReproduceChance * this.params.plantRegenBoostFactor
        : this.params.plantReproduceChance;

      for (const plant of this.plants) {
        if (!plant.alive || !plant.grown) continue;
        if (Math.random() < reproduceChance) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * PLANT_REPRODUCE_RADIUS;
          const nx = plant.position.x + Math.cos(angle) * dist;
          const ny = plant.position.y + Math.sin(angle) * dist;
          const wx = ((nx % WORLD_WIDTH) + WORLD_WIDTH) % WORLD_WIDTH;
          const wy = ((ny % WORLD_HEIGHT) + WORLD_HEIGHT) % WORLD_HEIGHT;

          // Terrain + cluster check
          const terrainPlantMult = this.terrain.getPlantChanceMult(wx, wy);
          if (terrainPlantMult <= 0) continue; // no plants in water
          if (Math.random() > terrainPlantMult) continue; // terrain reduces chance
          const nearbyPlants = this.grid.getNearby(wx, wy, PLANT_CLUSTER_RADIUS);
          const plantCount = nearbyPlants.filter((e) => e instanceof Plant && e.alive).length;
          if (plantCount < PLANT_CLUSTER_MAX) {
            this.spawnPlant(wx, wy);
          }
        }
      }
    }

    // 9. Passive energy gain so early-gen creatures don't all starve
    for (const creature of [...this.predators, ...this.prey, ...this.omnivores]) {
      if (!creature.alive) continue;
      creature.addEnergy(this.params.passiveEnergyGain * dt);
    }

    // 10. Density-dependent balance (Lotka-Volterra pressure)
    const actualRatio = alivePreyCount > 0
      ? alivePredCount / alivePreyCount
      : alivePredCount > 0 ? Infinity : 0;

    // Predator crowding: if ratio exceeds equilibrium, predators lose extra energy
    if (actualRatio > this.params.equilibriumRatio) {
      const overshoot = (actualRatio - this.params.equilibriumRatio) / this.params.equilibriumRatio;
      const drain = this.params.predatorCrowdingDrain * Math.min(overshoot, 5) * dt;
      for (const pred of this.predators) {
        if (!pred.alive) continue;
        pred.energy = Math.max(0, pred.energy - drain);
        pred.ticksSinceLastMeal++;
      }
    } else {
      for (const pred of this.predators) {
        if (pred.alive) pred.ticksSinceLastMeal++;
      }
    }

    // Prey survival bonus: scarcer prey get a small energy boost
    if (alivePreyCount < this.params.preyScarcityThreshold) {
      const scarcity = 1 - alivePreyCount / this.params.preyScarcityThreshold;
      const bonus = this.params.preySafetyBonus * scarcity * dt;
      for (const p of this.prey) {
        if (!p.alive) continue;
        p.addEnergy(bonus);
      }
    }

    // 11. Random plant spawns across the map (prevents clustering)
    if (this.plants.length < this.params.plantMaxCount) {
      // Scale spawn rate: more random spawns when plants are below max
      const fillRatio = this.plants.length / this.params.plantMaxCount;
      const randomSpawnChance = 0.02 * (1 - fillRatio); // up to 2% when empty, 0% when full
      if (Math.random() < randomSpawnChance) {
        const rx = Math.random() * WORLD_WIDTH;
        const ry = Math.random() * WORLD_HEIGHT;
        if (this.terrain.getPlantChanceMult(rx, ry) > 0) {
          this.spawnPlant(rx, ry);
        }
      }
    }

    // 12. Population maintenance – respawn if too few
    if (alivePredCount < MIN_PREDATORS) {
      for (let i = alivePredCount; i < MIN_PREDATORS; i++) {
        this.spawnPredator(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT);
      }
    }
    if (alivePreyCount < MIN_PREY) {
      for (let i = alivePreyCount; i < MIN_PREY; i++) {
        this.spawnPrey(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT);
      }
    }
    const aliveOmniCount = this.omnivores.filter((o) => o.alive).length;
    if (aliveOmniCount < MIN_OMNIVORES) {
      for (let i = aliveOmniCount; i < MIN_OMNIVORES; i++) {
        this.spawnOmnivore(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT);
      }
    }

    // 13. Process pending add/remove
    for (const e of this.toAdd) this.addEntity(e);
    for (const e of this.toRemove) this.removeEntity(e);
    this.toAdd = [];
    this.toRemove = [];

    // Update spatial grid
    for (const entity of this.entities) {
      this.grid.update(entity);
    }
  }

  private handleCollisions(): void {
    // Track eaten targets this tick (one-to-one)
    const eatenThisTick = new Set<Creature>();

    // Predator eats Prey or Omnivore
    for (const pred of this.predators) {
      if (!pred.alive) continue;
      const nearby = this.grid.getNearby(
        pred.position.x, pred.position.y,
        PREDATOR_BASE_RADIUS + Math.max(PREY_BASE_RADIUS, OMNIVORE_BASE_RADIUS)
      );
      for (const other of nearby) {
        if (other === pred || !other.alive) continue;
        if ((other instanceof Prey || other instanceof Omnivore) && !eatenThisTick.has(other)) {
          const target = other as Creature;
          eatenThisTick.add(target);

          // Fight back: target may damage attacker
          if (target.defense > 0 && Math.random() < target.defense) {
            pred.takeDamage(target.defense * 0.15);
          }

          target.takeDamage(0.3);
          this.pheromones.emit(target.position.x, target.position.y, 'danger', 2.0);

          // Poison: toxic prey/omnivore damages the predator
          const poisonDmg = target.toxicity * 0.3 * (1 - pred.poisonResistance);
          if (poisonDmg > 0) pred.takeDamage(poisonDmg);

          const cooldownFactor = Math.min(pred.ticksSinceLastMeal / this.params.huntCooldown, 1);
          pred.addEnergy(this.params.predEatEnergy * cooldownFactor);
          pred.reserve = Math.min(1, pred.reserve + this.params.predEatReserve * cooldownFactor);
          pred.ticksSinceLastMeal = 0;
          this.events.push({ type: 'eat', entity: pred });
          if (!target.alive) {
            pred.kills++;
            this.events.push({ type: 'death', entity: target });
            if (Math.random() < FOOD_DROP_CHANCE_ON_DEATH) {
              this.spawnFood(target.position.x, target.position.y);
            }
          }
          break;
        }
      }
    }

    // Omnivore eats Prey, Predator, or Plant (no cannibalism — no other Omnivores)
    for (const omni of this.omnivores) {
      if (!omni.alive) continue;
      const nearby = this.grid.getNearby(
        omni.position.x, omni.position.y,
        OMNIVORE_BASE_RADIUS + Math.max(PREY_BASE_RADIUS, PREDATOR_BASE_RADIUS, 12)
      );
      for (const other of nearby) {
        if (other === omni || !other.alive) continue;
        // Eat prey or predator (not other omnivores = no cannibalism)
        if ((other instanceof Prey || other instanceof Predator) && !eatenThisTick.has(other as Creature)) {
          const target = other as Creature;
          eatenThisTick.add(target);

          // Fight back
          if (target.defense > 0 && Math.random() < target.defense) {
            omni.takeDamage(target.defense * 0.15);
          }

          target.takeDamage(0.2); // weaker bite than predator
          this.pheromones.emit(target.position.x, target.position.y, 'danger', 1.0);

          // Poison
          const poisonDmg = target.toxicity * 0.25 * (1 - omni.poisonResistance);
          if (poisonDmg > 0) omni.takeDamage(poisonDmg);
          const cooldownFactor = Math.min(omni.ticksSinceLastMeal / this.params.huntCooldown, 1);
          omni.addEnergy(this.params.predEatEnergy * 0.7 * cooldownFactor);
          omni.reserve = Math.min(1, omni.reserve + 0.05 * cooldownFactor);
          omni.ticksSinceLastMeal = 0;
          this.events.push({ type: 'eat', entity: omni });
          if (!target.alive) {
            omni.kills++;
            this.events.push({ type: 'death', entity: target });
            if (Math.random() < FOOD_DROP_CHANCE_ON_DEATH) {
              this.spawnFood(target.position.x, target.position.y);
            }
          }
          break;
        }
        // Eat plant
        if (other instanceof Plant && other.grown) {
          omni.addEnergy(this.params.preyEatEnergy * 0.8);
          omni.reserve = Math.min(1, omni.reserve + 0.06);
          other.takeDamage(1);
          this.events.push({ type: 'eat', entity: omni });
          break;
        }
      }
    }

    // Prey eats Plant (one plant per prey per tick)
    for (const p of this.prey) {
      if (!p.alive) continue;
      const nearby = this.grid.getNearby(
        p.position.x, p.position.y,
        PREY_BASE_RADIUS + 12
      );
      for (const other of nearby) {
        if (other === p || !other.alive) continue;
        if (other instanceof Plant && other.grown) {
          p.addEnergy(this.params.preyEatEnergy);
          p.reserve = Math.min(1, p.reserve + this.params.preyEatReserve);
          other.takeDamage(1);
          this.events.push({ type: 'eat', entity: p });
          break; // one plant per prey per tick
        }
      }
    }

    // Predators + Omnivores eat FoodDrop (auto-pickup in larger radius)
    for (const hunter of [...this.predators, ...this.omnivores]) {
      if (!hunter.alive) continue;
      const nearby = this.grid.getNearby(
        hunter.position.x, hunter.position.y,
        hunter.baseRadius + 40
      );
      for (const other of nearby) {
        if (other === hunter || !other.alive) continue;
        if (other instanceof FoodDrop) {
          const cooldownFactor = Math.min(hunter.ticksSinceLastMeal / this.params.huntCooldown, 1);
          const efficiency = hunter instanceof Predator ? 1.0 : 0.7;
          hunter.addEnergy(FOOD_ENERGY_VALUE * cooldownFactor * efficiency);
          hunter.ticksSinceLastMeal = 0;
          other.takeDamage(1);
          this.events.push({ type: 'eat', entity: hunter });
          break;
        }
      }
    }
  }

  /** Find a nearby same-species creature for crossover */
  private findCrossoverPartner(creature: Creature): Creature | null {
    const nearby = this.grid.getNearby(creature.position.x, creature.position.y, 150);
    for (const other of nearby) {
      if (other === creature || !other.alive) continue;
      if (!(other instanceof Creature)) continue;
      // Same species check (exact class match)
      if (creature.constructor !== other.constructor) continue;
      // Must have some fitness
      const fitness = other.age * 0.01 + other.splits * 3 + other.kills * 2;
      if (fitness > 1) return other;
    }
    return null;
  }

  /** Find the best genome (most kills + splits) among all living creatures */
  getBestGenome(): { genome: object; fitness: number } | null {
    let best: Creature | null = null;
    let bestFitness = -1;
    for (const c of [...this.predators, ...this.prey, ...this.omnivores]) {
      if (!c.alive) continue;
      const fitness = c.kills * 2 + c.splits * 3 + c.age * 0.01;
      if (fitness > bestFitness) {
        bestFitness = fitness;
        best = c;
      }
    }
    if (!best) return null;
    return {
      genome: {
        nodes: best.genome.nodes,
        connections: best.genome.connections,
      },
      fitness: bestFitness,
    };
  }

  /** Import a genome and spawn a predator + prey with it */
  importGenome(data: { nodes: any[]; connections: any[] }): void {
    const genome = Object.create(Genome.prototype) as Genome;
    genome.nodes = data.nodes;
    genome.connections = data.connections;

    // Spawn one predator and one prey with the imported genome
    const cx = WORLD_WIDTH / 2;
    const cy = WORLD_HEIGHT / 2;

    const pred = new Predator(cx - 80, cy, genome.clone());
    pred.startFadeIn();
    this.toAdd.push(pred);

    const omni = new Omnivore(cx, cy, genome.clone());
    omni.startFadeIn();
    this.toAdd.push(omni);

    const prey = new Prey(cx + 80, cy, genome.clone());
    prey.startFadeIn();
    this.toAdd.push(prey);
  }

  get stats() {
    return {
      predators: this.predators.filter((p) => p.alive).length,
      prey: this.prey.filter((p) => p.alive).length,
      omnivores: this.omnivores.filter((o) => o.alive).length,
      plants: this.plants.filter((p) => p.alive).length,
      food: this.food.filter((f) => f.alive).length,
      tick: this.tickCount,
    };
  }
}
