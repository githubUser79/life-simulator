import { Container } from 'pixi.js';
import { FADE_DURATION } from '../config';

export interface Vec2 {
  x: number;
  y: number;
}

export abstract class Entity {
  position: Vec2;
  velocity: Vec2 = { x: 0, y: 0 };
  health = 1;
  energy = 1;
  reserve = 0;
  age = 0;
  alive = true;
  container: Container;

  /** Fade animation state */
  private _fadingIn = true;
  private _fadingOut = false;
  private _fadeElapsed = 0;
  /** Set to true once the entity is fully faded out and ready for removal */
  destroyed = false;

  constructor(x: number, y: number) {
    this.position = { x, y };
    this.container = new Container();
    this.container.position.set(x, y);
    this.container.alpha = 0; // start invisible for fade-in
  }

  /** Called every simulation tick */
  abstract update(dt: number): void;

  /** Called when health reaches 0 */
  abstract onDeath(): void;

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0 && this.alive) {
      this.alive = false;
      this.onDeath();
      this.startFadeOut();
    }
  }

  heal(amount: number): void {
    this.health = Math.min(1, this.health + amount);
  }

  addEnergy(amount: number): void {
    this.energy = Math.min(1, this.energy + amount);
  }

  /** Start fading in (called after spawn) */
  startFadeIn(): void {
    this._fadingIn = true;
    this._fadingOut = false;
    this._fadeElapsed = 0;
  }

  /** Start fading out (called on death) */
  startFadeOut(): void {
    this._fadingIn = false;
    this._fadingOut = true;
    this._fadeElapsed = 0;
  }

  /** Update fade animation – call from rendering loop (not sim tick) */
  updateFade(dt: number): void {
    if (this.destroyed) return;
    if (this._fadingIn) {
      this._fadeElapsed += dt;
      const t = Math.min(this._fadeElapsed / FADE_DURATION, 1);
      this.container.alpha = t;
      if (t >= 1) this._fadingIn = false;
    } else if (this._fadingOut) {
      this._fadeElapsed += dt;
      const t = Math.min(this._fadeElapsed / FADE_DURATION, 1);
      this.container.alpha = 1 - t;
      if (t >= 1) {
        this.destroyed = true;
      }
    }
  }

  /** Clean up Pixi resources */
  destroy(): void {
    if (!this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }

  get speed(): number {
    return Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
  }
}
