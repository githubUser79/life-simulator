import { Container, Graphics, Text, TextStyle } from 'pixi.js';

const PANEL_WIDTH = 430;
const PANEL_HEIGHT = 120;
const PANEL_GAP = 8;
const MAX_POINTS = 300;
const BORDER_COLOR = 0x44bbdd;

interface GraphPanel {
  color: number;
  label: string;
  data: number[];
  bg: Graphics;
  gfx: Graphics;
  titleText: Text;
  valueText: Text;
}

const titleStyle = new TextStyle({
  fontSize: 14,
  fill: 0x88aacc,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontWeight: '600',
});

const valueStyle = new TextStyle({
  fontSize: 18,
  fill: 0x44ddbb,
  fontFamily: 'monospace',
  fontWeight: 'bold',
});

export class PopulationGraph {
  container: Container;
  private panels: GraphPanel[];

  constructor() {
    this.container = new Container();

    const defs = [
      { color: 0x44bbdd, label: 'Prey population' },
      { color: 0xddaa33, label: 'Omnivore population' },
      { color: 0xe85577, label: 'Predator population' },
      { color: 0xffcc44, label: 'Food quantity' },
      { color: 0x44cc66, label: 'Plant count' },
    ];

    this.panels = defs.map((def, i) => {
      const y = i * (PANEL_HEIGHT + PANEL_GAP);

      const bg = new Graphics();
      bg.roundRect(0, y, PANEL_WIDTH, PANEL_HEIGHT, 8);
      bg.fill({ color: 0x0a0e14, alpha: 0.88 });
      bg.roundRect(0, y, PANEL_WIDTH, PANEL_HEIGHT, 8);
      bg.stroke({ color: BORDER_COLOR, width: 1.5, alpha: 0.5 });
      this.container.addChild(bg);

      const gfx = new Graphics();
      this.container.addChild(gfx);

      const titleText = new Text({ text: def.label, style: titleStyle });
      titleText.position.set(12, y + 6);
      this.container.addChild(titleText);

      const valueText = new Text({ text: '0', style: valueStyle });
      valueText.anchor.set(1, 0);
      valueText.position.set(PANEL_WIDTH - 12, y + 4);
      this.container.addChild(valueText);

      return { ...def, data: [], bg, gfx, titleText, valueText };
    });
  }

  push(predators: number, prey: number, omnivores: number, plants: number, food: number): void {
    const values = [prey, omnivores, predators, food, plants];
    for (let i = 0; i < this.panels.length; i++) {
      this.panels[i].data.push(values[i]);
      if (this.panels[i].data.length > MAX_POINTS) {
        this.panels[i].data.shift();
      }
    }
  }

  render(): void {
    for (let pi = 0; pi < this.panels.length; pi++) {
      const panel = this.panels[pi];
      panel.gfx.clear();

      const lastVal = panel.data.length > 0 ? panel.data[panel.data.length - 1] : 0;
      panel.valueText.text = String(lastVal);

      if (panel.data.length < 2) continue;

      let maxVal = 1;
      for (const v of panel.data) {
        if (v > maxVal) maxVal = v;
      }

      const pad = 12;
      const yOff = pi * (PANEL_HEIGHT + PANEL_GAP) + 28;
      const w = PANEL_WIDTH - pad * 2;
      const h = PANEL_HEIGHT - 36;
      const step = w / (MAX_POINTS - 1);

      // Area fill
      panel.gfx.moveTo(pad, yOff + h);
      for (let i = 0; i < panel.data.length; i++) {
        const x = pad + i * step;
        const y = yOff + h - (panel.data[i] / maxVal) * h;
        panel.gfx.lineTo(x, y);
      }
      panel.gfx.lineTo(pad + (panel.data.length - 1) * step, yOff + h);
      panel.gfx.fill({ color: panel.color, alpha: 0.15 });

      // Line
      panel.gfx.moveTo(pad, yOff + h - (panel.data[0] / maxVal) * h);
      for (let i = 1; i < panel.data.length; i++) {
        const x = pad + i * step;
        const y = yOff + h - (panel.data[i] / maxVal) * h;
        panel.gfx.lineTo(x, y);
      }
      panel.gfx.stroke({ color: panel.color, width: 2, alpha: 0.9 });
    }
  }

  get totalHeight(): number {
    return this.panels.length * (PANEL_HEIGHT + PANEL_GAP) - PANEL_GAP;
  }
}
