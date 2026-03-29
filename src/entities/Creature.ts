import { Entity } from './Entity';
import { Genome } from '../neural/Genome';
import { NeuralNetwork } from '../neural/NeuralNetwork';
import {
  ENERGY_MOVE_COST_FACTOR,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '../config';

export abstract class Creature extends Entity {
  genome: Genome;
  brain: NeuralNetwork;
  direction: number; // radians
  kills = 0;
  splits = 0;
  ticksSinceLastMeal = 200; // start ready to hunt (= PREDATOR_HUNT_COOLDOWN)

  // Evolvable traits (inherited + mutated on reproduction)
  toxicity = 0;          // 0-1: how poisonous this creature is to attackers
  poisonResistance = 0;  // 0-1: reduces poison damage taken
  defense = 0;           // 0-1: chance & strength of fighting back

  // Genealogy
  lineageId: number;          // root ancestor ID — same for all descendants
  generation = 0;             // how many splits from the original
  parentId: number | null = null;
  creatureId: number;         // unique ID for this creature

  private static _nextId = 1;
  static nextId(): number { return Creature._nextId++; }

  // Animation state
  animTime = 0;
  squishFactor = 0;
  squishDecay = 0.9;
  prevDirection = 0;

  // Base radii for the blob shape (set once per creature)
  blobRadii: number[] = [];
  baseRadius: number;

  constructor(
    x: number,
    y: number,
    baseRadius: number,
    genome?: Genome
  ) {
    super(x, y);
    this.baseRadius = baseRadius;
    this.direction = Math.random() * Math.PI * 2;
    this.prevDirection = this.direction;

    if (genome) {
      this.genome = genome;
    } else {
      this.genome = new Genome();
    }
    this.brain = this.genome.toNeuralNetwork();

    // Genealogy defaults (overridden in reproduce())
    this.creatureId = Creature.nextId();
    this.lineageId = this.creatureId; // first-gen: lineage = self

    // Generate 8 slightly randomized radii for the blob shape
    for (let i = 0; i < 8; i++) {
      this.blobRadii.push(baseRadius * (0.85 + Math.random() * 0.3));
    }
  }

  /** Feed inputs through the neural network */
  think(inputs: number[]): { angular: number; linear: number; emit: number } {
    const outputs = this.brain.forward(inputs);
    return { angular: outputs[0], linear: outputs[1], emit: outputs[2] ?? 0 };
  }

  /** Clone genome with mutations and create a child */
  abstract reproduce(): Creature;

  update(dt: number): void {
    // Energy cost: base metabolism + movement + traits
    // Base metabolism is high enough that standing still WILL kill you
    const spd = this.speed;
    const moveCost = spd * spd * ENERGY_MOVE_COST_FACTOR * dt;
    const metabolismCost = 0.0012 * dt; // base metabolism — must eat to survive
    const traitCost = (this.toxicity * 0.0002 + this.defense * 0.0001 + this.poisonResistance * 0.0001) * dt;
    this.energy -= moveCost + metabolismCost + traitCost;

    // Reserve decays — stored food spoils over time
    if (this.reserve > 0) {
      const reserveDecay = 0.0005 * dt;
      this.reserve = Math.max(0, this.reserve - reserveDecay);
    }

    // Starvation: energy hits 0 → take health damage
    if (this.energy < 0) {
      this.energy = 0;
      this.takeDamage(0.003 * dt); // faster starvation death
    }

    // Age
    this.age += dt;

    // Move
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // World wrapping
    if (this.position.x < 0) this.position.x += WORLD_WIDTH;
    if (this.position.x > WORLD_WIDTH) this.position.x -= WORLD_WIDTH;
    if (this.position.y < 0) this.position.y += WORLD_HEIGHT;
    if (this.position.y > WORLD_HEIGHT) this.position.y -= WORLD_HEIGHT;

    // Sync container
    this.container.position.set(this.position.x, this.position.y);

    // Squish decay
    this.squishFactor *= this.squishDecay;

    // Detect direction change → trigger squish
    const dirDiff = this.direction - this.prevDirection;
    if (Math.abs(dirDiff) > 0.05) {
      this.squishFactor = Math.min(0.3, Math.abs(dirDiff) * 0.5);
    }
    this.prevDirection = this.direction;
  }

  /** Inherit evolvable traits from parent with small mutation */
  inheritTraits(parent: Creature): void {
    this.toxicity = clampTrait(parent.toxicity + (Math.random() - 0.5) * 0.1);
    this.poisonResistance = clampTrait(parent.poisonResistance + (Math.random() - 0.5) * 0.1);
    this.defense = clampTrait(parent.defense + (Math.random() - 0.5) * 0.1);
  }

  onDeath(): void {
    // Subclasses can override to spawn FoodDrop etc.
  }
}

function clampTrait(v: number): number {
  return Math.max(0, Math.min(1, v));
}
