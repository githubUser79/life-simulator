import { Graphics } from 'pixi.js';
import { Creature } from '../entities/Creature';
import { Predator } from '../entities/Predator';
import { Omnivore } from '../entities/Omnivore';

/**
 * Renders a creature as an organic blob with squish animation and eyes.
 * Each creature gets its own CreatureRenderer attached to its container.
 */
export class CreatureRenderer {
  private creature: Creature;
  private bodyGfx: Graphics;
  private leftEyeWhite: Graphics;
  private rightEyeWhite: Graphics;
  private leftPupil: Graphics;
  private rightPupil: Graphics;
  private color: number;

  // Eye sizes – slightly asymmetric for character
  private leftEyeRadius: number;
  private rightEyeRadius: number;
  private leftPupilRadius: number;
  private rightPupilRadius: number;

  constructor(creature: Creature) {
    this.creature = creature;
    const species: 'pred' | 'omni' | 'prey' =
      creature instanceof Predator ? 'pred' :
      creature instanceof Omnivore ? 'omni' : 'prey';
    this.color = lineageColor(creature.lineageId, species);

    // Body
    this.bodyGfx = new Graphics();
    creature.container.addChild(this.bodyGfx);

    // Eyes – slightly different sizes for organic feel
    this.leftEyeRadius = 5 + Math.random() * 0.8;
    this.rightEyeRadius = 5 - Math.random() * 0.8;
    this.leftPupilRadius = 2.5;
    this.rightPupilRadius = 2.5;

    this.leftEyeWhite = new Graphics();
    this.rightEyeWhite = new Graphics();
    this.leftPupil = new Graphics();
    this.rightPupil = new Graphics();

    creature.container.addChild(this.leftEyeWhite);
    creature.container.addChild(this.rightEyeWhite);
    creature.container.addChild(this.leftPupil);
    creature.container.addChild(this.rightPupil);
  }

  /** Call each frame from Pixi ticker */
  render(_time: number, deltaMs: number): void {
    this.creature.animTime += deltaMs * 0.001; // seconds
    const t = this.creature.animTime;
    const spd = this.creature.speed;
    const dir = this.creature.direction;
    const baseR = this.creature.baseRadius;

    // ── Body blob ──
    this.bodyGfx.clear();

    // Speed-based stretch
    const stretchX = 1 + spd * 0.3;
    const stretchY = 1 - spd * 0.15;

    // Squish deformation
    const sq = this.creature.squishFactor;

    this.bodyGfx.rotation = dir;

    // Build 8-point polygon with animated radii
    const points: number[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const baseRadii = this.creature.blobRadii[i];
      const r =
        baseRadii *
        (1 + 0.08 * Math.sin(t * 3 + i * 0.8)) *
        (1 - sq * Math.cos(angle * 2));

      const px = Math.cos(angle) * r * stretchX;
      const py = Math.sin(angle) * r * stretchY;
      points.push(px, py);
    }

    // Draw smooth blob using quadratic curves through the polygon points
    this.bodyGfx.beginPath();
    const n = 8;
    // Start at midpoint between last and first point
    const mx0 = (points[(n - 1) * 2] + points[0]) / 2;
    const my0 = (points[(n - 1) * 2 + 1] + points[1]) / 2;
    this.bodyGfx.moveTo(mx0, my0);

    for (let i = 0; i < n; i++) {
      const cx = points[i * 2];
      const cy = points[i * 2 + 1];
      const nx2 = points[((i + 1) % n) * 2];
      const ny = points[((i + 1) % n) * 2 + 1];
      const midX = (cx + nx2) / 2;
      const midY = (cy + ny) / 2;
      this.bodyGfx.quadraticCurveTo(cx, cy, midX, midY);
    }
    this.bodyGfx.closePath();
    this.bodyGfx.fill({ color: this.color, alpha: 0.9 });

    // Glow effect – a slightly larger, transparent version
    // (Using a second fill with low alpha as a simple glow approximation)
    this.bodyGfx.beginPath();
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const baseRadii = this.creature.blobRadii[i];
      const r =
        baseRadii *
        1.15 *
        (1 + 0.08 * Math.sin(t * 3 + i * 0.8));
      const px = Math.cos(angle) * r * stretchX;
      const py = Math.sin(angle) * r * stretchY;
      if (i === 0) this.bodyGfx.moveTo(px, py);
      else this.bodyGfx.lineTo(px, py);
    }
    this.bodyGfx.closePath();
    this.bodyGfx.fill({
      color: this.color,
      alpha: 0.15,
    });

    // ── Eyes ──
    const eyeOffsetX = baseR * 0.3;
    const eyeOffsetY = baseR * 0.45;

    // Pupil offset in movement direction (local space, so always forward)
    const pupilShift = 2;

    // Left eye
    this.leftEyeWhite.clear();
    this.leftEyeWhite.circle(0, 0, this.leftEyeRadius);
    this.leftEyeWhite.fill({ color: 0xffffff });
    this.leftEyeWhite.position.set(
      Math.cos(dir) * eyeOffsetY - Math.sin(dir) * eyeOffsetX,
      Math.sin(dir) * eyeOffsetY + Math.cos(dir) * eyeOffsetX
    );

    this.leftPupil.clear();
    this.leftPupil.circle(0, 0, this.leftPupilRadius);
    this.leftPupil.fill({ color: 0x111111 });
    this.leftPupil.position.set(
      this.leftEyeWhite.position.x + Math.cos(dir) * pupilShift,
      this.leftEyeWhite.position.y + Math.sin(dir) * pupilShift
    );

    // Right eye
    this.rightEyeWhite.clear();
    this.rightEyeWhite.circle(0, 0, this.rightEyeRadius);
    this.rightEyeWhite.fill({ color: 0xffffff });
    this.rightEyeWhite.position.set(
      Math.cos(dir) * eyeOffsetY + Math.sin(dir) * eyeOffsetX,
      Math.sin(dir) * eyeOffsetY - Math.cos(dir) * eyeOffsetX
    );

    this.rightPupil.clear();
    this.rightPupil.circle(0, 0, this.rightPupilRadius);
    this.rightPupil.fill({ color: 0x111111 });
    this.rightPupil.position.set(
      this.rightEyeWhite.position.x + Math.cos(dir) * pupilShift,
      this.rightEyeWhite.position.y + Math.sin(dir) * pupilShift
    );
  }
}

/**
 * Generate a unique color for a lineage.
 * Predators: warm hues (reds, oranges, pinks, magentas: 320-60°)
 * Prey:      cool hues (blues, cyans, greens, teals: 140-260°)
 * Same lineageId always produces the same color.
 */
function lineageColor(lineageId: number, species: 'pred' | 'omni' | 'prey'): number {
  const golden = 0.618033988749895;
  const hash = ((lineageId * golden) % 1);

  let hue: number;
  if (species === 'pred') {
    // Warm: 320° to 60° (reds, pinks, magentas)
    hue = (320 + hash * 100) % 360;
  } else if (species === 'omni') {
    // Mid: 30° to 80° (yellows, oranges, ambers)
    hue = 30 + hash * 50;
  } else {
    // Cool: 140° to 260° (blues, cyans, greens)
    hue = 140 + hash * 120;
  }

  return hslToHex(hue, 0.75, 0.55);
}

function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)      { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else              { r = c; b = x; }
  return (Math.round((r + m) * 255) << 16) |
         (Math.round((g + m) * 255) << 8) |
          Math.round((b + m) * 255);
}
