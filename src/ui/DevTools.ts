import { World, defaultBalanceParams } from '../simulation/World';
import type { BalanceParams } from '../simulation/World';
import type { AutoBalancer } from '../ai/AutoBalancer';

/**
 * Dev tools + live balance settings panel rendered as HTML overlay.
 * Settings are persisted to localStorage and restored on reload.
 */
export interface DevToolsState {
  showAllRays: boolean;
  showZoneSectors: boolean;
  showSpatialGrid: boolean;
  showHeatmap: boolean;
  speedMultiplier: number;
}

interface SliderDef {
  key: keyof BalanceParams;
  label: string;
  min: number;
  max: number;
  step: number;
}

const STORAGE_KEY = 'life-sim-balance-params';

const BALANCE_SLIDERS: SliderDef[] = [
  { key: 'plantReproduceChance', label: 'Plant Spawn Rate', min: 0.0001, max: 0.005, step: 0.0001 },
  { key: 'plantMaxCount', label: 'Max Plants', min: 100, max: 5000, step: 50 },
  { key: 'plantMaxAge', label: 'Plant Lifespan', min: 100, max: 5000, step: 50 },
  { key: 'plantRegenBoostFactor', label: 'Plant Boost (low prey)', min: 1, max: 10, step: 0.5 },
  { key: 'passiveEnergyGain', label: 'Passive Energy', min: 0, max: 0.002, step: 0.0001 },
  { key: 'splitEnergyThreshold', label: 'Split Threshold', min: 0.5, max: 1, step: 0.05 },
  { key: 'predEatEnergy', label: 'Pred Eat Energy', min: 0.05, max: 0.5, step: 0.01 },
  { key: 'preyEatEnergy', label: 'Prey Eat Energy', min: 0.05, max: 0.5, step: 0.01 },
  { key: 'equilibriumRatio', label: 'Equilibrium Ratio', min: 0.05, max: 1, step: 0.05 },
  { key: 'predatorCrowdingDrain', label: 'Crowding Drain', min: 0, max: 0.005, step: 0.0001 },
  { key: 'huntCooldown', label: 'Hunt Cooldown', min: 10, max: 500, step: 10 },
  { key: 'preySafetyBonus', label: 'Prey Safety Bonus', min: 0, max: 0.002, step: 0.0001 },
  { key: 'preyScarcityThreshold', label: 'Prey Scarcity Thresh', min: 10, max: 200, step: 5 },
];

export class DevTools {
  state: DevToolsState = {
    showAllRays: false,
    showZoneSectors: false,
    showSpatialGrid: false,
    showHeatmap: false,
    speedMultiplier: 1,
  };

  private panel: HTMLDivElement;
  private visible = false;
  private world: World;
  private autoBalancer: AutoBalancer;
  private onReset: () => void;
  private aiLogInterval = 0;

  constructor(world: World, autoBalancer: AutoBalancer, onReset: () => void) {
    this.world = world;
    this.autoBalancer = autoBalancer;
    this.onReset = onReset;

    // Restore saved params from localStorage
    this.loadParams();
    this.loadTargets();

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed; top: 10px; right: 450px; z-index: 100;
      background: rgba(10,14,20,0.92); color: #aac; padding: 14px;
      border-radius: 10px; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12px;
      display: none; min-width: 260px; max-height: 90vh; overflow-y: auto;
      border: 1px solid #44bbdd; box-shadow: 0 0 12px rgba(68,187,221,0.3);
    `;

    // Build HTML
    let slidersHtml = '';
    for (const s of BALANCE_SLIDERS) {
      const val = this.world.params[s.key];
      slidersHtml += `
        <div style="margin:4px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span>${s.label}</span>
            <span id="bv-${s.key}" style="color:#44ddbb;font-family:monospace">${formatVal(val, s)}</span>
          </div>
          <input type="range" id="bs-${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" value="${val}"
            style="width:100%;accent-color:#44bbdd">
        </div>
      `;
    }

    this.panel.innerHTML = `
      <div style="margin-bottom:10px;font-weight:600;color:#44ddee;font-size:14px">Settings</div>

      <div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #334">
        <div style="font-weight:600;color:#88aacc;margin-bottom:6px">Debug</div>
        <label style="display:block;margin:3px 0"><input type="checkbox" id="dt-rays"> Show All Rays</label>
        <label style="display:block;margin:3px 0"><input type="checkbox" id="dt-zones"> Show Zone Sectors</label>
        <label style="display:block;margin:3px 0"><input type="checkbox" id="dt-grid"> Show Spatial Grid</label>
        <label style="display:block;margin:3px 0"><input type="checkbox" id="dt-heatmap"> Show Heatmap</label>
        <div style="margin:6px 0">
          <label>Speed: <span id="dt-speed-val" style="color:#44ddbb">1</span>x</label>
          <input type="range" id="dt-speed" min="1" max="20" value="1" style="width:100%;accent-color:#44bbdd">
        </div>
      </div>

      <div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #334">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:600;color:#88aacc">Balance</span>
          <button id="dt-defaults" style="padding:3px 8px;cursor:pointer;border-radius:4px;border:1px solid #556;
            background:rgba(80,80,100,0.3);color:#889;font-size:10px">Reset Defaults</button>
        </div>
        ${slidersHtml}
      </div>

      <div style="margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #334">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:600;color:#88aacc">AI Balancer</span>
          <label style="cursor:pointer">
            <input type="checkbox" id="dt-ai-toggle" checked> Enabled
          </label>
        </div>
        <div style="margin:4px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px">
            <span>Interval (ticks)</span>
            <span id="dt-ai-interval-val" style="color:#44ddbb;font-family:monospace">1000</span>
          </div>
          <input type="range" id="dt-ai-interval" min="1000" max="20000" step="1000" value="1000"
            style="width:100%;accent-color:#44bbdd">
        </div>
        <div style="margin-top:8px;font-weight:600;color:#6688aa;font-size:11px;margin-bottom:4px">Target Populations (±20%)</div>
        <div style="margin:3px 0">
          <div style="display:flex;justify-content:space-between"><span>Prey</span><span id="dt-tgt-prey-val" style="color:#44ddbb;font-family:monospace">${this.autoBalancer.popTargets.preyIdeal}</span></div>
          <input type="range" id="dt-tgt-prey" min="50" max="5000" step="50" value="${this.autoBalancer.popTargets.preyIdeal}" style="width:100%;accent-color:#44bbdd">
        </div>
        <div style="margin:3px 0">
          <div style="display:flex;justify-content:space-between"><span>Omnivore</span><span id="dt-tgt-omni-val" style="color:#44ddbb;font-family:monospace">${this.autoBalancer.popTargets.omnivoreIdeal}</span></div>
          <input type="range" id="dt-tgt-omni" min="10" max="2000" step="10" value="${this.autoBalancer.popTargets.omnivoreIdeal}" style="width:100%;accent-color:#44bbdd">
        </div>
        <div style="margin:3px 0">
          <div style="display:flex;justify-content:space-between"><span>Predator</span><span id="dt-tgt-pred-val" style="color:#44ddbb;font-family:monospace">${this.autoBalancer.popTargets.predatorIdeal}</span></div>
          <input type="range" id="dt-tgt-pred" min="10" max="2000" step="10" value="${this.autoBalancer.popTargets.predatorIdeal}" style="width:100%;accent-color:#44bbdd">
        </div>
        <div style="margin:3px 0">
          <div style="display:flex;justify-content:space-between"><span>Plants</span><span id="dt-tgt-plants-val" style="color:#44ddbb;font-family:monospace">${this.autoBalancer.popTargets.plantsIdeal}</span></div>
          <input type="range" id="dt-tgt-plants" min="100" max="5000" step="100" value="${this.autoBalancer.popTargets.plantsIdeal}" style="width:100%;accent-color:#44bbdd">
        </div>

        <div id="dt-ai-log" style="margin-top:6px;max-height:120px;overflow-y:auto;font-size:10px;color:#778899">
          <div style="color:#556">AI decisions will appear here...</div>
        </div>
      </div>

      <div style="display:flex;gap:8px">
        <button id="dt-reset" style="flex:1;padding:6px;cursor:pointer;border-radius:6px;border:1px solid #44bbdd;
          background:rgba(68,187,221,0.15);color:#44ddee;font-size:12px">Reset Sim</button>
        <button id="dt-export" style="flex:1;padding:6px;cursor:pointer;border-radius:6px;border:1px solid #44bbdd;
          background:rgba(68,187,221,0.15);color:#44ddee;font-size:12px">Export Genome</button>
        <button id="dt-import" style="flex:1;padding:6px;cursor:pointer;border-radius:6px;border:1px solid #44bbdd;
          background:rgba(68,187,221,0.15);color:#44ddee;font-size:12px">Import Genome</button>
      </div>
    `;
    document.body.appendChild(this.panel);

    // Toggle with backtick key
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {
        this.toggle();
      }
    });

    // Wire up debug controls
    this.panel.querySelector('#dt-rays')!.addEventListener('change', (e) => {
      this.state.showAllRays = (e.target as HTMLInputElement).checked;
    });
    this.panel.querySelector('#dt-zones')!.addEventListener('change', (e) => {
      this.state.showZoneSectors = (e.target as HTMLInputElement).checked;
    });
    this.panel.querySelector('#dt-grid')!.addEventListener('change', (e) => {
      this.state.showSpatialGrid = (e.target as HTMLInputElement).checked;
    });
    this.panel.querySelector('#dt-heatmap')!.addEventListener('change', (e) => {
      this.state.showHeatmap = (e.target as HTMLInputElement).checked;
    });
    this.panel.querySelector('#dt-speed')!.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.state.speedMultiplier = val;
      this.world.ticksPerFrame = val;
      this.panel.querySelector('#dt-speed-val')!.textContent = String(val);
    });
    this.panel.querySelector('#dt-reset')!.addEventListener('click', () => {
      this.onReset();
    });
    this.panel.querySelector('#dt-export')!.addEventListener('click', () => {
      const best = this.world.getBestGenome();
      if (best) {
        const json = JSON.stringify(best, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'best_genome.json';
        a.click();
        URL.revokeObjectURL(url);
      }
    });
    this.panel.querySelector('#dt-import')!.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(reader.result as string);
            this.world.importGenome(data);
          } catch (e) {
            console.warn('[DevTools] Invalid genome file:', e);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
    this.panel.querySelector('#dt-defaults')!.addEventListener('click', () => {
      this.resetDefaults();
    });

    // Wire up AI balancer controls
    this.panel.querySelector('#dt-ai-toggle')!.addEventListener('change', (e) => {
      this.autoBalancer.enabled = (e.target as HTMLInputElement).checked;
    });
    this.panel.querySelector('#dt-ai-interval')!.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.autoBalancer.intervalTicks = val;
      this.panel.querySelector('#dt-ai-interval-val')!.textContent = String(val);
    });

    // Wire up population target sliders
    const tgtSliders: { id: string; key: keyof import('../ai/AutoBalancer').PopTargets }[] = [
      { id: 'dt-tgt-prey', key: 'preyIdeal' },
      { id: 'dt-tgt-omni', key: 'omnivoreIdeal' },
      { id: 'dt-tgt-pred', key: 'predatorIdeal' },
      { id: 'dt-tgt-plants', key: 'plantsIdeal' },
    ];
    for (const s of tgtSliders) {
      this.panel.querySelector(`#${s.id}`)!.addEventListener('input', (e) => {
        const val = parseInt((e.target as HTMLInputElement).value);
        this.autoBalancer.popTargets[s.key] = val;
        this.panel.querySelector(`#${s.id}-val`)!.textContent = String(val);
        this.saveTargets();
      });
    }

    // Periodically update AI log display
    this.aiLogInterval = window.setInterval(() => this.updateAILog(), 2000);

    // Wire up balance sliders with persistence
    for (const s of BALANCE_SLIDERS) {
      this.panel.querySelector(`#bs-${s.key}`)!.addEventListener('input', (e) => {
        const val = parseFloat((e.target as HTMLInputElement).value);
        (this.world.params as any)[s.key] = val;
        this.panel.querySelector(`#bv-${s.key}`)!.textContent = formatVal(val, s);
        this.saveParams();
      });
    }
  }

  /** Toggle settings panel visibility */
  toggle(): void {
    this.visible = !this.visible;
    this.panel.style.display = this.visible ? 'block' : 'none';
  }

  /** Sync all slider UI elements with current world.params (called after AI changes) */
  refreshSliders(): void {
    for (const s of BALANCE_SLIDERS) {
      const val = this.world.params[s.key];
      const slider = this.panel.querySelector(`#bs-${s.key}`) as HTMLInputElement | null;
      if (slider) {
        slider.value = String(val);
        const label = this.panel.querySelector(`#bv-${s.key}`);
        if (label) label.textContent = formatVal(val, s);
      }
    }
    this.saveParams();
  }

  /** Update the AI decision log in the panel */
  private updateAILog(): void {
    const log = this.panel.querySelector('#dt-ai-log');
    if (!log) return;
    const decisions = this.autoBalancer.decisions;
    if (decisions.length === 0) return;

    log.innerHTML = decisions.slice(-5).map((d) => {
      const changes = Object.entries(d.changes)
        .map(([k, v]) => `${k}=${typeof v === 'number' && v < 1 ? (v as number).toFixed(4) : v}`)
        .join(', ');
      const scoreColor = d.outcome === 1 ? '#44cc66' : d.outcome === -1 ? '#cc4444' : '#888';
      const scoreLabel = d.outcome === 1 ? 'HELPED' : d.outcome === -1 ? 'HURT' : d.outcome === 0 ? 'NEUTRAL' : 'pending...';
      const s = d.snapshot;
      const a = d.snapshotAfter;
      const outcomeStr = a
        ? `err ${d.scoreBefore}→${d.scoreAfter} | prey ${s.prey}→${a.prey} omni ${s.omnivores}→${a.omnivores} pred ${s.predators}→${a.predators}`
        : `err ${d.scoreBefore} | prey ${s.prey} omni ${s.omnivores} pred ${s.predators}`;
      return `<div style="margin:3px 0;padding:5px;background:rgba(68,187,221,0.08);border-radius:3px;border-left:3px solid ${scoreColor}">
        <div style="display:flex;justify-content:space-between">
          <span style="color:#44ddbb;font-size:9px">Tick ${d.tick}</span>
          <span style="color:${scoreColor};font-size:9px;font-weight:bold">${scoreLabel}</span>
        </div>
        <div style="color:#aabbcc;margin:2px 0">${d.reasoning}</div>
        <div style="color:#778899;font-size:9px">${outcomeStr}</div>
        ${changes ? `<div style="color:#88cc88;font-size:9px">${changes}</div>` : '<div style="color:#667">No changes</div>'}
      </div>`;
    }).join('');
  }

  /** Update world reference (e.g. after reset) */
  setWorld(world: World): void {
    this.world = world;
  }

  /** Clean up resources */
  destroy(): void {
    clearInterval(this.aiLogInterval);
  }

  /** Save current balance params to localStorage */
  private saveParams(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.world.params));
    } catch { /* ignore */ }
  }

  /** Save population targets to localStorage */
  private saveTargets(): void {
    try {
      localStorage.setItem('life-sim-pop-targets', JSON.stringify(this.autoBalancer.popTargets));
    } catch { /* ignore */ }
  }

  /** Load population targets from localStorage */
  private loadTargets(): void {
    try {
      const raw = localStorage.getItem('life-sim-pop-targets');
      if (!raw) return;
      const saved = JSON.parse(raw);
      Object.assign(this.autoBalancer.popTargets, saved);
    } catch { /* ignore */ }
  }

  /** Load saved params from localStorage into world.params */
  private loadParams(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<BalanceParams>;
      for (const key of Object.keys(saved) as (keyof BalanceParams)[]) {
        if (key in this.world.params && typeof saved[key] === 'number') {
          (this.world.params as any)[key] = saved[key];
        }
      }
    } catch { /* corrupt data — ignore */ }
  }

  /** Reset all sliders to defaults and clear localStorage */
  private resetDefaults(): void {
    const defaults = defaultBalanceParams();
    for (const s of BALANCE_SLIDERS) {
      const val = defaults[s.key] as number;
      (this.world.params as any)[s.key] = val;
      const slider = this.panel.querySelector(`#bs-${s.key}`) as HTMLInputElement;
      slider.value = String(val);
      this.panel.querySelector(`#bv-${s.key}`)!.textContent = formatVal(val, s);
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

function formatVal(val: number, s: SliderDef): string {
  if (s.step >= 1) return String(Math.round(val));
  if (s.step >= 0.01) return val.toFixed(2);
  return val.toFixed(4);
}
