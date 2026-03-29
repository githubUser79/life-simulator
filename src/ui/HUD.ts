import { Container, Graphics, Text, TextStyle } from 'pixi.js';

const HUD_WIDTH = 430;
const HUD_HEIGHT = 90;
const BORDER_COLOR = 0x44bbdd;

const labelStyle = new TextStyle({
  fontSize: 13,
  fill: 0x88aacc,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
});

const valueStyle = new TextStyle({
  fontSize: 26,
  fill: 0xeeeeff,
  fontFamily: 'monospace',
  fontWeight: 'bold',
});

const smallValueStyle = new TextStyle({
  fontSize: 18,
  fill: 0xccccdd,
  fontFamily: 'monospace',
});

const btnStyle = new TextStyle({
  fontSize: 14,
  fill: 0x44ddee,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontWeight: '600',
});

export class HUD {
  container: Container;
  private bg: Graphics;
  private tickValue: Text;
  private timeValue: Text;
  private frameValue: Text;
  private pauseBtnText: Text;
  private speedBtnText: Text;

  onPauseToggle: (() => void) | null = null;
  onMaxSpeedToggle: (() => void) | null = null;
  onSettingsToggle: (() => void) | null = null;

  constructor() {
    this.container = new Container();

    this.bg = new Graphics();
    this.bg.roundRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 10);
    this.bg.fill({ color: 0x0a0e14, alpha: 0.88 });
    this.bg.roundRect(0, 0, HUD_WIDTH, HUD_HEIGHT, 10);
    this.bg.stroke({ color: BORDER_COLOR, width: 1.5, alpha: 0.4 });
    this.container.addChild(this.bg);

    // Ticks (left)
    const tickLabel = new Text({ text: 'Ticks', style: labelStyle });
    tickLabel.position.set(18, 8);
    this.container.addChild(tickLabel);
    this.tickValue = new Text({ text: '0', style: smallValueStyle });
    this.tickValue.position.set(18, 26);
    this.container.addChild(this.tickValue);

    // Time (center, large)
    const timeLabel = new Text({ text: 'Time', style: labelStyle });
    timeLabel.anchor.set(0.5, 0);
    timeLabel.position.set(HUD_WIDTH / 2, 5);
    this.container.addChild(timeLabel);
    this.timeValue = new Text({ text: '0s', style: valueStyle });
    this.timeValue.anchor.set(0.5, 0);
    this.timeValue.position.set(HUD_WIDTH / 2, 22);
    this.container.addChild(this.timeValue);

    // Frame (right)
    const frameLabel = new Text({ text: 'Frame', style: labelStyle });
    frameLabel.anchor.set(1, 0);
    frameLabel.position.set(HUD_WIDTH - 18, 8);
    this.container.addChild(frameLabel);
    this.frameValue = new Text({ text: '0ms', style: smallValueStyle });
    this.frameValue.anchor.set(1, 0);
    this.frameValue.position.set(HUD_WIDTH - 18, 26);
    this.container.addChild(this.frameValue);

    // Buttons row
    const btnY = 58;
    const pauseBtn = this.createButton('pause', 18, btnY, 100);
    pauseBtn.on('pointerdown', () => this.onPauseToggle?.());
    this.pauseBtnText = pauseBtn.getChildAt(1) as Text;

    const speedBtn = this.createButton('1x', 126, btnY, 80);
    speedBtn.on('pointerdown', () => this.onMaxSpeedToggle?.());
    this.speedBtnText = speedBtn.getChildAt(1) as Text;

    // Settings button (clickable!)
    const settingsBtn = this.createButton('settings', HUD_WIDTH - 118, btnY, 100);
    settingsBtn.on('pointerdown', () => this.onSettingsToggle?.());
  }

  private createButton(label: string, x: number, y: number, w: number): Container {
    const btn = new Container();
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    const bg = new Graphics();
    bg.roundRect(0, 0, w, 26, 6);
    bg.fill({ color: 0x44bbdd, alpha: 0.12 });
    bg.roundRect(0, 0, w, 26, 6);
    bg.stroke({ color: BORDER_COLOR, width: 1, alpha: 0.4 });
    btn.addChild(bg);

    const text = new Text({ text: label, style: btnStyle });
    text.anchor.set(0.5, 0.5);
    text.position.set(w / 2, 13);
    btn.addChild(text);

    this.container.addChild(btn);
    return btn;
  }

  update(tick: number, timeSeconds: number, frameTimeMs: number, paused: boolean, maxSpeed: boolean): void {
    this.tickValue.text = String(tick);
    this.timeValue.text = `${Math.floor(timeSeconds)}s`;
    this.frameValue.text = `${frameTimeMs.toFixed(1)}ms`;
    this.pauseBtnText.text = paused ? 'play' : 'pause';
    this.speedBtnText.text = maxSpeed ? 'max speed' : '1x';
  }
}
