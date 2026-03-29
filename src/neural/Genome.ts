import { NN_INPUTS, NN_OUTPUTS } from '../config';
import { NeuralNetwork } from './NeuralNetwork';

export interface ConnectionGene {
  from: number;
  to: number;
  weight: number;
  enabled: boolean;
  innovation: number;
}

export interface NodeGene {
  id: number;
  type: 'input' | 'hidden' | 'output';
  bias: number;
}

let globalInnovation = 0;
export function nextInnovation(): number {
  return globalInnovation++;
}

export class Genome {
  nodes: NodeGene[] = [];
  connections: ConnectionGene[] = [];

  constructor() {
    // Create input nodes
    for (let i = 0; i < NN_INPUTS; i++) {
      this.nodes.push({ id: i, type: 'input', bias: 0 });
    }
    // Create output nodes
    for (let i = 0; i < NN_OUTPUTS; i++) {
      this.nodes.push({ id: NN_INPUTS + i, type: 'output', bias: 0 });
    }
    // Random initial connections: each output connected to a few random inputs
    for (let o = 0; o < NN_OUTPUTS; o++) {
      for (let inp = 0; inp < NN_INPUTS; inp++) {
        if (Math.random() < 0.3) {
          this.connections.push({
            from: inp,
            to: NN_INPUTS + o,
            weight: (Math.random() - 0.5) * 2,
            enabled: true,
            innovation: nextInnovation(),
          });
        }
      }
    }
  }

  clone(): Genome {
    const g = Object.create(Genome.prototype) as Genome;
    g.nodes = this.nodes.map((n) => ({ ...n }));
    g.connections = this.connections.map((c) => ({ ...c }));
    return g;
  }

  /** Build a NeuralNetwork from this genome */
  toNeuralNetwork(): NeuralNetwork {
    return new NeuralNetwork(this);
  }

  get maxNodeId(): number {
    return Math.max(...this.nodes.map((n) => n.id));
  }

  /**
   * NEAT-style crossover: combine two parent genomes.
   * Matching genes (same innovation) are randomly inherited from either parent.
   * Disjoint/excess genes come from the fitter parent.
   */
  static crossover(parentA: Genome, parentB: Genome, aIsFitter: boolean): Genome {
    const child = Object.create(Genome.prototype) as Genome;
    const fitter = aIsFitter ? parentA : parentB;
    const other = aIsFitter ? parentB : parentA;

    // Build innovation->connection maps
    const mapA = new Map<number, ConnectionGene>();
    const mapB = new Map<number, ConnectionGene>();
    for (const c of fitter.connections) mapA.set(c.innovation, c);
    for (const c of other.connections) mapB.set(c.innovation, c);

    // Inherit connections
    child.connections = [];
    for (const [innov, geneA] of mapA) {
      const geneB = mapB.get(innov);
      if (geneB) {
        // Matching: random pick
        child.connections.push({ ...(Math.random() < 0.5 ? geneA : geneB) });
      } else {
        // Disjoint/excess from fitter parent
        child.connections.push({ ...geneA });
      }
    }

    // Collect all node IDs referenced by child connections
    const nodeIds = new Set<number>();
    for (const c of child.connections) {
      nodeIds.add(c.from);
      nodeIds.add(c.to);
    }
    // Always include all input/output nodes
    for (const n of fitter.nodes) {
      if (n.type === 'input' || n.type === 'output') nodeIds.add(n.id);
    }

    // Build nodes from both parents, preferring fitter
    const nodeMapA = new Map(fitter.nodes.map(n => [n.id, n]));
    const nodeMapB = new Map(other.nodes.map(n => [n.id, n]));
    child.nodes = [];
    for (const id of nodeIds) {
      const nA = nodeMapA.get(id);
      const nB = nodeMapB.get(id);
      if (nA && nB) {
        child.nodes.push({ ...(Math.random() < 0.5 ? nA : nB) });
      } else {
        child.nodes.push({ ...(nA || nB)! });
      }
    }
    // Sort nodes: inputs first, then hidden, then outputs
    child.nodes.sort((a, b) => {
      const order = { input: 0, hidden: 1, output: 2 };
      return order[a.type] - order[b.type] || a.id - b.id;
    });

    return child;
  }
}
