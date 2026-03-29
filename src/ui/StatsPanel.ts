import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { Creature } from '../entities/Creature';
import { Predator } from '../entities/Predator';
import { Omnivore } from '../entities/Omnivore';
import { SPLIT_ENERGY_THRESHOLD } from '../config';

const PANEL_WIDTH = 430;
const BAR_HEIGHT = 24;
const BAR_GAP = 8;
const PADDING = 16;
const BORDER_COLOR = 0x44bbdd;

const labelStyle = new TextStyle({
  fontSize: 14,
  fill: 0x88aacc,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
});

const titleStyle = new TextStyle({
  fontSize: 16,
  fill: 0xeeeeff,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontWeight: '600',
});

export class StatsPanel {
  container: Container;
  private bg: Graphics;
  private bars: Graphics;
  private textsContainer: Container;
  private creature: Creature | null = null;

  constructor() {
    this.container = new Container();
    this.bg = new Graphics();
    this.container.addChild(this.bg);
    this.bars = new Graphics();
    this.container.addChild(this.bars);
    this.textsContainer = new Container();
    this.container.addChild(this.textsContainer);
  }

  setCreature(creature: Creature | null): void {
    this.creature = creature;
  }

  render(): void {
    this.bars.clear();
    this.bg.clear();
    this.textsContainer.removeChildren();

    if (!this.creature || !this.creature.alive) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    const c = this.creature;
    const isPred = c instanceof Predator;
    const isOmni = c instanceof Omnivore;
    const speciesName = isPred ? 'Predator' : isOmni ? 'Omnivore' : 'Prey';
    const fitness = (c.age * 0.01 + c.splits * 3 + c.kills * 2);
    const genomeNodes = c.genome.nodes.filter(n => n.type === 'hidden').length;
    const genomeConns = c.genome.connections.filter(cn => cn.enabled).length;

    const barData = [
      { label: 'Health', value: c.health, color: lerpColor(0xcc4444, 0x44cc66, c.health) },
      { label: 'Energy', value: c.energy, color: 0x4488dd },
      { label: 'Reserve', value: c.reserve, color: 0x8866cc },
      { label: 'Split', value: Math.min(1, c.energy / SPLIT_ENERGY_THRESHOLD), color: c.energy >= SPLIT_ENERGY_THRESHOLD ? 0xff8833 : 0x333344 },
    ];

    const infoLines = [
      `Age: ${Math.floor(c.age)}  Gen: ${c.generation}  Fitness: ${fitness.toFixed(1)}`,
      `Kills: ${c.kills}  Splits: ${c.splits}  Brain: ${genomeNodes}h/${genomeConns}c`,
      `Toxic: ${(c.toxicity * 100).toFixed(0)}%  Resist: ${(c.poisonResistance * 100).toFixed(0)}%  Def: ${(c.defense * 100).toFixed(0)}%`,
    ];

    const totalHeight = PADDING * 2 + 22 + barData.length * (BAR_HEIGHT + BAR_GAP) + infoLines.length * 16 + 8;

    // Background
    this.bg.roundRect(0, 0, PANEL_WIDTH, totalHeight, 6);
    this.bg.fill({ color: 0x0a0e14, alpha: 0.88 });
    this.bg.roundRect(0, 0, PANEL_WIDTH, totalHeight, 6);
    this.bg.stroke({ color: BORDER_COLOR, width: 1, alpha: 0.4 });

    // Title
    const title = new Text({
      text: `${speciesName} #${c.creatureId}`,
      style: titleStyle,
    });
    title.position.set(PADDING, PADDING);
    this.textsContainer.addChild(title);

    // Lineage badge
    const lineageText = new Text({
      text: `L:${c.lineageId}`,
      style: { ...labelStyle, fontSize: 10, fill: 0x556677 } as TextStyle,
    });
    lineageText.anchor.set(1, 0);
    lineageText.position.set(PANEL_WIDTH - PADDING, PADDING + 3);
    this.textsContainer.addChild(lineageText);

    let y = PADDING + 24;
    for (const bar of barData) {
      const label = new Text({ text: bar.label, style: labelStyle });
      label.position.set(PADDING, y + 1);
      this.textsContainer.addChild(label);

      const barX = PADDING + 80;
      const barW = PANEL_WIDTH - barX - PADDING;

      // Bar background
      this.bars.roundRect(barX, y, barW, BAR_HEIGHT, 3);
      this.bars.fill({ color: 0x1a1e28 });

      // Bar fill
      const fillW = barW * Math.max(0, Math.min(1, bar.value));
      if (fillW > 0) {
        this.bars.roundRect(barX, y, fillW, BAR_HEIGHT, 3);
        this.bars.fill({ color: bar.color, alpha: 0.85 });
      }

      y += BAR_HEIGHT + BAR_GAP;
    }

    // Info lines
    y += 2;
    for (const line of infoLines) {
      const info = new Text({ text: line, style: { ...labelStyle, fontSize: 11 } as TextStyle });
      info.position.set(PADDING, y);
      this.textsContainer.addChild(info);
      y += 16;
    }
  }
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
