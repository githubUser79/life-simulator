import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Creature } from '../entities/Creature';

const VIZ_WIDTH = 430;
const VIZ_HEIGHT = 450;
const HEADER = 30;
const PADDING = 24;
const NODE_RADIUS = 10;
const BORDER_COLOR = 0x44bbdd;

const titleStyle = new TextStyle({
  fontSize: 15,
  fill: 0x88aacc,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontWeight: '600',
});

const labelStyle = new TextStyle({
  fontSize: 11,
  fill: 0x88aacc,
  fontFamily: 'monospace',
});

const INPUT_LABELS = [
  'Health', 'Energy', 'Split', 'Reserve',
  'Z0 dist', 'Z0 ang', 'Z0 attr',
  'Z1 dist', 'Z1 ang', 'Z1 attr',
  'Z2 dist', 'Z2 ang', 'Z2 attr',
  'Z3 dist', 'Z3 ang', 'Z3 attr',
  'Z4 dist', 'Z4 ang', 'Z4 attr',
  'Danger→', 'Danger↔', 'Terr→', 'Terr↔', 'Scent→', 'Scent↔',
  'Daylight', 'Terrain', 'MySpeed',
];

const OUTPUT_LABELS = ['Turn', 'Speed', 'Emit'];

export class NeuralNetViz {
  container: Container;
  private bg: Graphics;
  private gfx: Graphics;
  private labelsContainer: Container;
  private titleText: Text;
  private creature: Creature | null = null;
  private lastUpdateTick = 0;

  constructor() {
    this.container = new Container();
    this.container.position.set(10, 10);

    this.bg = new Graphics();
    this.bg.roundRect(0, 0, VIZ_WIDTH, VIZ_HEIGHT, 6);
    this.bg.fill({ color: 0x0a0e14, alpha: 0.88 });
    this.bg.roundRect(0, 0, VIZ_WIDTH, VIZ_HEIGHT, 6);
    this.bg.stroke({ color: BORDER_COLOR, width: 1, alpha: 0.4 });
    this.container.addChild(this.bg);

    this.titleText = new Text({ text: 'Evolving AIs - Neural Network', style: titleStyle });
    this.titleText.position.set(10, 5);
    this.container.addChild(this.titleText);

    this.gfx = new Graphics();
    this.container.addChild(this.gfx);

    this.labelsContainer = new Container();
    this.container.addChild(this.labelsContainer);
  }

  setCreature(creature: Creature | null): void {
    this.creature = creature;
    this.lastUpdateTick = -10;
  }

  update(tick: number): void {
    if (!this.creature || !this.creature.alive) {
      this.gfx.clear();
      this.labelsContainer.removeChildren();
      this.container.visible = false;
      return;
    }

    if (tick - this.lastUpdateTick < 10) return;
    this.lastUpdateTick = tick;
    this.container.visible = true;

    this.gfx.clear();
    this.labelsContainer.removeChildren();

    const genome = this.creature.genome;
    const inputNodes = genome.nodes.filter((n) => n.type === 'input');
    const outputNodes = genome.nodes.filter((n) => n.type === 'output');
    const hiddenNodes = genome.nodes.filter((n) => n.type === 'hidden');

    const positions = new Map<number, { x: number; y: number }>();
    const drawH = VIZ_HEIGHT - HEADER - PADDING;

    // Input nodes: left column
    const inputX = PADDING + 40;
    for (let i = 0; i < inputNodes.length; i++) {
      const y = HEADER + PADDING / 2 + (i / (inputNodes.length - 1)) * drawH;
      positions.set(inputNodes[i].id, { x: inputX, y });
    }

    // Output nodes: right column
    const outputX = VIZ_WIDTH - PADDING - 30; // room for labels
    for (let i = 0; i < outputNodes.length; i++) {
      const y = HEADER + drawH / 2 + (i - (outputNodes.length - 1) / 2) * 40;
      positions.set(outputNodes[i].id, { x: outputX, y });
    }

    // Hidden nodes: middle area
    const hiddenX = (inputX + outputX) / 2;
    for (let i = 0; i < hiddenNodes.length; i++) {
      const y = HEADER + PADDING / 2 + ((i + 1) / (hiddenNodes.length + 1)) * drawH;
      positions.set(hiddenNodes[i].id, { x: hiddenX, y });
    }

    // Draw connections
    for (const conn of genome.connections) {
      if (!conn.enabled) continue;
      const from = positions.get(conn.from);
      const to = positions.get(conn.to);
      if (!from || !to) continue;

      const color = conn.weight > 0 ? 0x44cc66 : 0xcc4444;
      const width = Math.min(3, Math.abs(conn.weight) * 1.5);

      this.gfx.moveTo(from.x, from.y);
      this.gfx.lineTo(to.x, to.y);
      this.gfx.stroke({ color, width, alpha: 0.4 });
    }

    // Draw nodes
    for (const node of genome.nodes) {
      const pos = positions.get(node.id);
      if (!pos) continue;

      const active = Math.abs(node.bias) > 0.1;
      const color = node.bias > 0 ? 0x44cc66 : node.bias < 0 ? 0xcc4444 : 0x556677;

      this.gfx.circle(pos.x, pos.y, NODE_RADIUS);
      if (active) {
        this.gfx.fill({ color, alpha: 0.9 });
      } else {
        this.gfx.fill({ color: 0x1a1e28, alpha: 0.8 });
        this.gfx.circle(pos.x, pos.y, NODE_RADIUS);
        this.gfx.stroke({ color: 0x445566, width: 1 });
      }
    }

    // Input labels
    for (let i = 0; i < inputNodes.length; i++) {
      const pos = positions.get(inputNodes[i].id)!;
      const label = new Text({ text: INPUT_LABELS[i] || `I${i}`, style: labelStyle });
      label.anchor.set(1, 0.5);
      label.position.set(pos.x - NODE_RADIUS - 3, pos.y);
      this.labelsContainer.addChild(label);
    }

    // Output labels
    for (let i = 0; i < outputNodes.length; i++) {
      const pos = positions.get(outputNodes[i].id)!;
      const label = new Text({ text: OUTPUT_LABELS[i] || `O${i}`, style: labelStyle });
      label.anchor.set(0, 0.5);
      label.position.set(pos.x + NODE_RADIUS + 3, pos.y);
      this.labelsContainer.addChild(label);
    }
  }
}
