import { Creature } from './Creature';
import { Genome } from '../neural/Genome';
import { mutate } from '../neural/Evolution';
import { PREDATOR_BASE_RADIUS, CREATURE_MAX_SPEED, CREATURE_TURN_SPEED } from '../config';

export class Predator extends Creature {
  maxSpeed = CREATURE_MAX_SPEED;
  turnSpeed = CREATURE_TURN_SPEED;

  constructor(x: number, y: number, genome?: Genome) {
    super(x, y, PREDATOR_BASE_RADIUS, genome);
    if (!genome) {
      this.poisonResistance = 0.1 + Math.random() * 0.15;
    }
  }

  reproduce(): Predator {
    const childGenome = this.genome.clone();
    const fitness = this.age * 0.01 + this.splits * 3 + this.kills * 2;
    mutate(childGenome, fitness);
    const child = new Predator(this.position.x, this.position.y, childGenome);
    child.energy = this.energy * 0.4;
    this.energy *= 0.4;
    this.reserve = 0;
    this.splits++;

    child.inheritTraits(this);

    // Genealogy
    child.lineageId = this.lineageId;
    child.generation = this.generation + 1;
    child.parentId = this.creatureId;
    return child;
  }
}
