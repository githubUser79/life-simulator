import { Genome } from './Genome';

/**
 * Feedforward neural network built from a Genome.
 * Uses Float32Array internally for performance.
 * Supports dynamically added hidden nodes (NEAT-style topology).
 */
export class NeuralNetwork {
  /** Topologically sorted node IDs (evaluation order) */
  private evalOrder: number[] = [];
  /** Float32 buffer holding node values during forward pass */
  private values!: Float32Array;
  /** Map node ID → index in values array */
  private idToIdx: Map<number, number> = new Map();
  /** Precompiled connection list: [fromIdx, toIdx, weight][] */
  private conns: { fromIdx: number; toIdx: number; weight: number }[] = [];
  /** Bias per node index */
  private biases!: Float32Array;
  /** Indices that are input nodes */
  private inputIndices: number[] = [];
  /** Indices that are output nodes */
  private outputIndices: number[] = [];
  /** Number of nodes */
  private nodeCount!: number;

  constructor(genome: Genome) {
    this.buildFromGenome(genome);
  }

  private buildFromGenome(genome: Genome): void {
    // Build id → index mapping
    this.idToIdx.clear();
    genome.nodes.forEach((n, i) => this.idToIdx.set(n.id, i));
    this.nodeCount = genome.nodes.length;

    this.values = new Float32Array(this.nodeCount);
    this.biases = new Float32Array(this.nodeCount);

    // Store biases
    for (const n of genome.nodes) {
      const idx = this.idToIdx.get(n.id)!;
      this.biases[idx] = n.bias;
    }

    // Input / output indices
    this.inputIndices = genome.nodes
      .filter((n) => n.type === 'input')
      .map((n) => this.idToIdx.get(n.id)!);
    this.outputIndices = genome.nodes
      .filter((n) => n.type === 'output')
      .map((n) => this.idToIdx.get(n.id)!);

    // Topological sort (Kahn's algorithm)
    const inDegree = new Map<number, number>();
    const adjList = new Map<number, number[]>();

    for (const n of genome.nodes) {
      inDegree.set(n.id, 0);
      adjList.set(n.id, []);
    }
    for (const c of genome.connections) {
      if (!c.enabled) continue;
      adjList.get(c.from)?.push(c.to);
      inDegree.set(c.to, (inDegree.get(c.to) ?? 0) + 1);
    }

    const queue: number[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    this.evalOrder = [];
    while (queue.length > 0) {
      const n = queue.shift()!;
      this.evalOrder.push(n);
      for (const neighbor of adjList.get(n) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    // Precompile connections for fast evaluation
    this.conns = [];
    for (const c of genome.connections) {
      if (!c.enabled) continue;
      const fi = this.idToIdx.get(c.from);
      const ti = this.idToIdx.get(c.to);
      if (fi !== undefined && ti !== undefined) {
        this.conns.push({ fromIdx: fi, toIdx: ti, weight: c.weight });
      }
    }
  }

  /** Run a forward pass. Returns NN_OUTPUTS values (tanh activated). */
  inference(inputs: number[]): number[] {
    // Clear values
    this.values.fill(0);

    // Set input values
    for (let i = 0; i < this.inputIndices.length && i < inputs.length; i++) {
      this.values[this.inputIndices[i]] = inputs[i];
    }

    // Evaluate non-input nodes in topological order
    for (const nodeId of this.evalOrder) {
      const idx = this.idToIdx.get(nodeId)!;
      // Skip input nodes
      if (this.inputIndices.includes(idx)) continue;

      let sum = this.biases[idx];
      for (const c of this.conns) {
        if (c.toIdx === idx) {
          sum += this.values[c.fromIdx] * c.weight;
        }
      }
      this.values[idx] = Math.tanh(sum);
    }

    // Collect outputs
    const result: number[] = [];
    for (const oi of this.outputIndices) {
      result.push(this.values[oi]);
    }
    return result;
  }

  /** Alias for inference (backward compat) */
  forward(inputs: number[]): number[] {
    return this.inference(inputs);
  }
}
