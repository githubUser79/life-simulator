import { Genome, nextInnovation } from './Genome';
import { MUTATION_WEIGHT_DELTA } from '../config';

/**
 * Adaptive mutation system with elitism.
 *
 * fitness = age * 0.01 + splits * 3 + kills * 2
 *
 * High fitness → lower mutation chance, smaller nudges (protect good genomes)
 * Low fitness  → higher mutation chance, bigger nudges (explore more)
 *
 * Mutation types:
 *   - mutateWeight:    adjust a weight or bias
 *   - addConnection:   connect two unconnected nodes
 *   - addNode:         split a connection with a new hidden node
 *   - removeConnection: prune an enabled connection
 *   - removeNode:      remove a hidden node with no dependencies
 *   - toggleConnection: enable/disable a connection
 */

/** How many mutations to apply, based on fitness */
function getMutationCount(fitness: number): number {
  // Elitism: high-fitness parents sometimes pass genome unchanged
  if (fitness > 15 && Math.random() < 0.2) return 0; // 20% elitism for top performers
  if (fitness > 8 && Math.random() < 0.1) return 0;  // 10% elitism for good performers

  // Adaptive count: weak creatures get more mutations (explore harder)
  if (fitness < 1) return Math.random() < 0.4 ? 3 : 2;  // 2-3 mutations
  if (fitness < 5) return Math.random() < 0.3 ? 2 : 1;   // 1-2 mutations
  return 1; // proven genome: just 1 careful mutation
}

/** Adaptive weight delta: smaller nudges for high-fitness parents */
function getWeightDelta(fitness: number): number {
  if (fitness > 15) return MUTATION_WEIGHT_DELTA * 0.5;  // very careful
  if (fitness > 8) return MUTATION_WEIGHT_DELTA * 0.7;   // careful
  if (fitness < 1) return MUTATION_WEIGHT_DELTA * 1.5;   // aggressive
  return MUTATION_WEIGHT_DELTA;                           // normal
}

/**
 * Apply adaptive mutations to a child genome.
 * @param fitness Parent's fitness score (age * 0.01 + splits * 3 + kills * 2)
 */
export function mutate(genome: Genome, fitness = 0): void {
  const count = getMutationCount(fitness);

  for (let i = 0; i < count; i++) {
    applySingleMutation(genome, fitness);
  }
}

function applySingleMutation(genome: Genome, fitness: number): void {
  const roll = Math.random();

  // Adaptive probabilities: high-fitness → more weight tweaks, less structural change
  if (fitness > 10) {
    // Conservative: 85% weight, 8% connection, 3% node, 3% remove, 1% toggle
    if (roll < 0.85) mutateWeight(genome, fitness);
    else if (roll < 0.93) addConnection(genome);
    else if (roll < 0.96) addNode(genome);
    else if (roll < 0.99) removeConnection(genome);
    else toggleConnection(genome);
  } else if (fitness > 3) {
    // Balanced: 65% weight, 15% connection, 8% node, 8% remove, 4% toggle
    if (roll < 0.65) mutateWeight(genome, fitness);
    else if (roll < 0.80) addConnection(genome);
    else if (roll < 0.88) addNode(genome);
    else if (roll < 0.96) removeConnection(genome);
    else toggleConnection(genome);
  } else {
    // Exploratory: 50% weight, 20% connection, 15% node, 10% remove, 5% toggle
    if (roll < 0.50) mutateWeight(genome, fitness);
    else if (roll < 0.70) addConnection(genome);
    else if (roll < 0.85) addNode(genome);
    else if (roll < 0.95) removeConnection(genome);
    else toggleConnection(genome);
  }
}

/**
 * Modify a random weight or bias with adaptive delta.
 */
function mutateWeight(genome: Genome, fitness: number): void {
  const delta = getWeightDelta(fitness);
  const targets: Array<{ type: 'conn'; idx: number } | { type: 'bias'; idx: number }> = [];

  genome.connections.forEach((_, i) => targets.push({ type: 'conn', idx: i }));
  genome.nodes.forEach((n, i) => {
    if (n.type !== 'input') targets.push({ type: 'bias', idx: i });
  });

  if (targets.length === 0) return;
  const target = targets[Math.floor(Math.random() * targets.length)];

  if (target.type === 'conn') {
    const conn = genome.connections[target.idx];
    if (Math.random() < 0.85) {
      conn.weight += (Math.random() - 0.5) * 2 * delta;
    } else {
      conn.weight = (Math.random() - 0.5) * 2;
    }
  } else {
    const node = genome.nodes[target.idx];
    if (Math.random() < 0.85) {
      node.bias += (Math.random() - 0.5) * 2 * delta;
    } else {
      node.bias = (Math.random() - 0.5) * 2;
    }
  }
}

/**
 * Add a new connection between two previously unconnected nodes.
 */
function addConnection(genome: Genome): void {
  const nonInput = genome.nodes.filter((n) => n.type !== 'input');
  if (nonInput.length === 0) return;

  for (let attempt = 0; attempt < 20; attempt++) {
    const from = genome.nodes[Math.floor(Math.random() * genome.nodes.length)];
    const to = nonInput[Math.floor(Math.random() * nonInput.length)];
    if (from.id === to.id) continue;

    const exists = genome.connections.some(
      (c) => c.from === from.id && c.to === to.id
    );
    if (exists) continue;

    genome.connections.push({
      from: from.id,
      to: to.id,
      weight: (Math.random() - 0.5) * 2,
      enabled: true,
      innovation: nextInnovation(),
    });
    return;
  }
}

/**
 * Split an existing connection by inserting a new hidden node.
 */
function addNode(genome: Genome): void {
  const enabled = genome.connections.filter((c) => c.enabled);
  if (enabled.length === 0) return;

  const conn = enabled[Math.floor(Math.random() * enabled.length)];
  conn.enabled = false;

  const newId = genome.maxNodeId + 1;
  genome.nodes.push({ id: newId, type: 'hidden', bias: 0 });

  genome.connections.push({
    from: conn.from,
    to: newId,
    weight: 1.0,
    enabled: true,
    innovation: nextInnovation(),
  });
  genome.connections.push({
    from: newId,
    to: conn.to,
    weight: conn.weight,
    enabled: true,
    innovation: nextInnovation(),
  });
}

/**
 * Remove a random enabled connection (pruning).
 * Keeps the network from growing endlessly.
 */
function removeConnection(genome: Genome): void {
  const enabled = genome.connections.filter((c) => c.enabled);
  if (enabled.length <= 1) return; // keep at least one connection

  const conn = enabled[Math.floor(Math.random() * enabled.length)];
  conn.enabled = false;
}

/**
 * Toggle a random connection on/off.
 * Allows re-enabling previously disabled connections.
 */
function toggleConnection(genome: Genome): void {
  if (genome.connections.length === 0) return;
  const conn = genome.connections[Math.floor(Math.random() * genome.connections.length)];
  // Don't disable the last enabled connection
  if (conn.enabled) {
    const enabledCount = genome.connections.filter((c) => c.enabled).length;
    if (enabledCount <= 1) return;
  }
  conn.enabled = !conn.enabled;
}
