import type { PopSnapshot } from './AutoBalancer';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:12b';
const VISION_MODEL = 'gemma3:12b'; // vision-capable model
const COMMENT_INTERVAL_MS = 60_000; // every 60s — keeps Ollama loaded (5min timeout)
const VISION_INTERVAL_MS = 180_000; // vision every 3 min (heavier)

export interface Comment {
  text: string;
  timestamp: number;
  tick: number;
}

export class Commentator {
  enabled = true;
  comments: Comment[] = [];
  private lastCommentTime = 0;
  private lastVisionTime = 0;
  private running = false;
  private history: PopSnapshot[] = [];
  private prevPred = 0;
  private prevPrey = 0;
  private canvas: HTMLCanvasElement | null = null;

  /** Set the canvas reference for vision screenshots */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /** Reset state (called on simulation reset) */
  reset(): void {
    this.history = [];
    this.prevPred = 0;
    this.prevPrey = 0;
  }

  /** Feed population data (called frequently) */
  recordStats(stats: PopSnapshot): void {
    if (stats.tick % 200 === 0) {
      this.history.push(stats);
      if (this.history.length > 30) this.history.shift();
    }
  }

  /** Check if it's time to comment (called every frame) */
  async tryComment(tick: number, stats: PopSnapshot): Promise<void> {
    if (!this.enabled) return;
    if (this.running) return;
    const now = Date.now();
    if (now - this.lastCommentTime < COMMENT_INTERVAL_MS) return;
    if (this.history.length < 3) return;

    this.lastCommentTime = now;
    this.running = true;

    try {
      const comment = await this.generate(tick, stats);
      if (comment) {
        this.comments.push(comment);
        if (this.comments.length > 50) this.comments.shift();
      }
      this.prevPred = stats.predators;
      this.prevPrey = stats.prey;

      // Vision commentary (less frequent, heavier)
      const now2 = Date.now();
      if (this.canvas && now2 - this.lastVisionTime > VISION_INTERVAL_MS) {
        this.lastVisionTime = now2;
        const vc = await this.generateVision(tick, stats);
        if (vc) {
          this.comments.push(vc);
          if (this.comments.length > 50) this.comments.shift();
        }
      }
    } catch (e) {
      console.warn('[Commentator] error:', e);
    } finally {
      this.running = false;
    }
  }

  private async generate(tick: number, stats: PopSnapshot): Promise<Comment | null> {
    const recent = this.history.slice(-10);
    const ratio = stats.prey > 0 ? (stats.predators / stats.prey).toFixed(2) : 'infinity';
    const predDelta = stats.predators - this.prevPred;
    const preyDelta = stats.prey - this.prevPrey;

    // Detect notable events for more interesting commentary
    const events: string[] = [];
    if (stats.predators < 10) events.push('Predatoren stehen kurz vor dem Aussterben!');
    if (stats.prey < 20) events.push('Prey-Population kritisch niedrig!');
    if (stats.predators > 500) events.push('Predatoren-Schwarm außer Kontrolle!');
    if (stats.prey > 1000) events.push('Prey sind absolut überall!');
    if (stats.plants < 50) events.push('Pflanzen fast ausgerottet — Nahrungskrise!');
    if (stats.plants > 2000) events.push('Die Karte verwandelt sich in einen Dschungel!');
    if (predDelta > 50) events.push(`Predatoren-Babyboom! +${predDelta} seit letztem Check.`);
    if (predDelta < -50) events.push(`Predatoren-Massensterben! ${predDelta} verloren.`);
    if (preyDelta > 100) events.push(`Prey-Population explodiert! +${preyDelta}.`);
    if (preyDelta < -100) events.push(`Prey-Massaker! ${preyDelta} verloren.`);
    if (Math.abs(parseFloat(ratio) - 0.3) < 0.05) events.push('Das Ökosystem ist überraschend ausbalanciert.');

    const recentComments = this.comments.slice(-3).map((c) => c.text).join('\n');

    const prompt = `Du bist ein sarkastischer, witziger Naturfilm-Erzähler, der einen digitalen Evolutions-Simulator beobachtet. Denke an David Attenborough als Stand-up-Comedian. Du kommentierst eine Welt, in der Blob-Kreaturen neuronale Netze entwickeln um zu überleben.

AKTUELLE LAGE (Tick ${tick}, ~${Math.floor(tick / 60)}s vergangen):
- Predatoren (rosa Blobs): ${stats.predators} (${predDelta >= 0 ? '+' : ''}${predDelta} seit letztem Mal)
- Prey (blaue Blobs): ${stats.prey} (${preyDelta >= 0 ? '+' : ''}${preyDelta} seit letztem Mal)
- Omnivoren (gelbe Blobs): ${stats.omnivores} — fressen Prey UND Pflanzen
- Pflanzen (grüne Kleeblätter): ${stats.plants}
- Food-Drops (gold): ${stats.food}
- Pred/Prey Verhältnis: ${ratio}
${events.length > 0 ? '\nBESONDERE EREIGNISSE:\n' + events.map(e => '- ' + e).join('\n') : ''}

VERLAUF:
${recent.map(s => `  Tick ${s.tick}: ${s.predators} Pred, ${s.prey} Prey, ${s.plants} Pflanzen`).join('\n')}

${recentComments ? 'DEINE LETZTEN KOMMENTARE (wiederhole dich nicht!):\n' + recentComments + '\n' : ''}
Schreibe EINEN kurzen, lustigen Kommentar auf DEUTSCH (1-3 Sätze). Sei sarkastisch, dramatisch oder absurd. Nenne konkrete Zahlen. Benutze Metaphern. KEINE Hashtags, KEINE Emojis. Variiere deinen Stil — mal trocken, mal theatralisch, mal philosophisch-absurd.`;

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.9, num_predict: 150 },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    let text: string = (data.response || '').trim();

    // Clean up: remove quotes if the LLM wrapped in them
    if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
    if (!text) return null;

    return { text, timestamp: Date.now(), tick };
  }

  /** Generate a comment based on a screenshot of the simulation */
  private async generateVision(tick: number, stats: PopSnapshot): Promise<Comment | null> {
    if (!this.canvas) return null;

    // Capture canvas as base64 JPEG (smaller than PNG)
    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.6);
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;

    const prompt = `Du siehst einen Screenshot eines Evolutions-Simulators. Rosa/rote Blobs sind Predatoren, blaue/türkise Blobs sind Prey (Beute), grüne Punkte sind Pflanzen, goldene Punkte sind Food-Drops.

Aktuelle Zahlen: ${stats.predators} Predatoren, ${stats.prey} Prey, ${stats.omnivores} Omnivoren, ${stats.plants} Pflanzen (Tick ${tick}).

Beschreibe in 1-2 Sätzen auf DEUTSCH was du SIEHST. Sei sarkastisch und witzig. Kommentiere die räumliche Verteilung, Cluster, ob Predatoren jagen, ob Prey flieht, ob es leere Gebiete gibt. KEINE Emojis, KEINE Hashtags.`;

    try {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: VISION_MODEL,
          prompt,
          images: [base64],
          stream: false,
          options: { temperature: 0.9, num_predict: 150 },
        }),
      });

      if (!response.ok) return null;
      const data = await response.json();
      let text: string = (data.response || '').trim();
      if (text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
      if (!text) return null;

      return { text: `[Vision] ${text}`, timestamp: Date.now(), tick };
    } catch {
      return null;
    }
  }
}
