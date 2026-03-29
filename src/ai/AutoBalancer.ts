import type { BalanceParams } from '../simulation/World';

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const MODEL = 'gemma3:12b';

export interface PopSnapshot {
  tick: number;
  predators: number;
  prey: number;
  omnivores: number;
  plants: number;
  food: number;
}

/** Population targets — mutable, settable via UI */
export interface PopTargets {
  preyIdeal: number;
  omnivoreIdeal: number;
  predatorIdeal: number;
  plantsIdeal: number;
}

export function defaultPopTargets(): PopTargets {
  return { preyIdeal: 1000, omnivoreIdeal: 200, predatorIdeal: 300, plantsIdeal: 3000 };
}

function targetsFromIdeal(t: PopTargets) {
  const r = 0.2; // ±20%
  return {
    prey:      { min: Math.round(t.preyIdeal * (1 - r)),     max: Math.round(t.preyIdeal * (1 + r)),     ideal: t.preyIdeal },
    omnivore:  { min: Math.round(t.omnivoreIdeal * (1 - r)),  max: Math.round(t.omnivoreIdeal * (1 + r)),  ideal: t.omnivoreIdeal },
    predator:  { min: Math.round(t.predatorIdeal * (1 - r)),  max: Math.round(t.predatorIdeal * (1 + r)),  ideal: t.predatorIdeal },
    plants:    { min: Math.round(t.plantsIdeal * (1 - r)),    max: Math.round(t.plantsIdeal * (1 + r)),    ideal: t.plantsIdeal },
  };
}

export interface AIDecision {
  tick: number;
  reasoning: string;
  changes: Partial<BalanceParams>;
  timestamp: number;
  scoreBefore: number;
  scoreAfter: number | null;
  outcome: number | null; // +1 improved, 0 neutral, -1 worsened
  snapshot: PopSnapshot;
  snapshotAfter: PopSnapshot | null;
}

const TUNABLE_KEYS: (keyof BalanceParams)[] = [
  'plantReproduceChance', 'plantMaxCount', 'plantMaxAge', 'plantRegenBoostFactor',
  'passiveEnergyGain', 'splitEnergyThreshold', 'predEatEnergy', 'preyEatEnergy',
  'equilibriumRatio', 'predatorCrowdingDrain', 'huntCooldown',
  'preySafetyBonus', 'preyScarcityThreshold',
];

const PARAM_RANGES: Record<string, { min: number; max: number }> = {
  plantReproduceChance: { min: 0.0001, max: 0.005 },
  plantMaxCount: { min: 100, max: 5000 },
  plantMaxAge: { min: 100, max: 5000 },
  plantRegenBoostFactor: { min: 1, max: 10 },
  passiveEnergyGain: { min: 0, max: 0.002 },
  splitEnergyThreshold: { min: 0.5, max: 1 },
  predEatEnergy: { min: 0.05, max: 0.5 },
  preyEatEnergy: { min: 0.05, max: 0.5 },
  equilibriumRatio: { min: 0.05, max: 1 },
  predatorCrowdingDrain: { min: 0, max: 0.005 },
  huntCooldown: { min: 10, max: 500 },
  preySafetyBonus: { min: 0, max: 0.002 },
  preyScarcityThreshold: { min: 10, max: 200 },
};

/**
 * Ecosystem health score (0 = perfect, higher = worse).
 * Measures how far each species is from its ideal population.
 */
function ecosystemError(s: PopSnapshot, t: PopTargets): number {
  const targets = targetsFromIdeal(t);
  const preyErr = Math.abs(s.prey - targets.prey.ideal) / targets.prey.ideal;
  const omniErr = Math.abs(s.omnivores - targets.omnivore.ideal) / targets.omnivore.ideal;
  const predErr = Math.abs(s.predators - targets.predator.ideal) / targets.predator.ideal;
  const plantErr = Math.abs(s.plants - targets.plants.ideal) / targets.plants.ideal;

  const extinctionPenalty =
    (s.prey < 5 ? 5 : 0) +
    (s.omnivores < 3 ? 5 : 0) +
    (s.predators < 3 ? 5 : 0) +
    (s.plants < 20 ? 3 : 0);

  return preyErr + omniErr + predErr + plantErr * 0.5 + extinctionPenalty;
}

function scoreOutcome(errorBefore: number, errorAfter: number): number {
  const improvement = errorBefore - errorAfter;
  if (improvement > 0.1) return 1;
  if (improvement < -0.1) return -1;
  return 0;
}

export class AutoBalancer {
  enabled = true;
  intervalTicks = 1000;
  popTargets: PopTargets = defaultPopTargets();
  private lastRunTick = 0;
  private running = false;
  private history: PopSnapshot[] = [];
  decisions: AIDecision[] = [];

  async tick(
    tick: number,
    stats: PopSnapshot,
    currentParams: BalanceParams,
    applyChanges: (changes: Partial<BalanceParams>) => void,
  ): Promise<void> {
    try {
      if (tick % 100 === 0) {
        this.history.push({ ...stats, tick });
        if (this.history.length > 100) this.history.shift();
      }

      if (!this.enabled) return;
      if (this.running) return;
      if (tick - this.lastRunTick < this.intervalTicks) return;
      if (this.history.length < 5) return;

      this.lastRunTick = tick;
      this.running = true;

      this.scoreLastDecision(stats);

      const decision = await this.analyze(tick, stats, currentParams);
      if (decision) {
        applyChanges(decision.changes);
        this.decisions.push(decision);
        if (this.decisions.length > 20) this.decisions.shift();
      }
    } catch (e) {
      console.warn('[AutoBalancer] error:', e);
    } finally {
      this.running = false;
    }
  }

  private scoreLastDecision(currentStats: PopSnapshot): void {
    const last = this.decisions[this.decisions.length - 1];
    if (!last || last.outcome !== null) return;

    const errorBefore = last.scoreBefore;
    const errorAfter = ecosystemError(currentStats, this.popTargets);

    last.scoreAfter = Math.round(errorAfter * 100) / 100;
    last.snapshotAfter = { ...currentStats };
    last.outcome = scoreOutcome(errorBefore, errorAfter);
  }

  private async analyze(tick: number, currentStats: PopSnapshot, params: BalanceParams): Promise<AIDecision | null> {
    const recent = this.history.slice(-20);
    const latest = recent[recent.length - 1];
    const oldest = recent[0];

    const predTrend = latest.predators - oldest.predators;
    const preyTrend = latest.prey - oldest.prey;
    const omniTrend = latest.omnivores - oldest.omnivores;
    const error = ecosystemError(latest, this.popTargets);

    const tgt = targetsFromIdeal(this.popTargets);
    const statusPrey = latest.prey < tgt.prey.min ? 'CRITICALLY LOW' :
      latest.prey > tgt.prey.max ? 'OVERPOPULATED' : 'OK';
    const statusOmni = latest.omnivores < tgt.omnivore.min ? 'CRITICALLY LOW' :
      latest.omnivores > tgt.omnivore.max ? 'OVERPOPULATED' : 'OK';
    const statusPred = latest.predators < tgt.predator.min ? 'CRITICALLY LOW' :
      latest.predators > tgt.predator.max ? 'OVERPOPULATED' : 'OK';

    // Feedback from previous decisions
    const scoredDecisions = this.decisions.filter((d) => d.outcome !== null);
    let feedbackBlock = '';
    if (scoredDecisions.length > 0) {
      const recentScored = scoredDecisions.slice(-5);
      feedbackBlock = `
PREVIOUS DECISIONS AND OUTCOMES (learn from these!):
${recentScored.map((d) => {
  const label = d.outcome === 1 ? 'HELPED' : d.outcome === -1 ? 'HURT' : 'NEUTRAL';
  const changesStr = Object.entries(d.changes).map(([k, v]) => `${k}=${v}`).join(', ');
  const before = d.snapshot;
  const after = d.snapshotAfter!;
  return `  Tick ${d.tick}: [${label}] error ${d.scoreBefore.toFixed(2)}→${d.scoreAfter?.toFixed(2)}
    Before: prey=${before.prey} omni=${before.omnivores} pred=${before.predators} plants=${before.plants}
    After:  prey=${after.prey} omni=${after.omnivores} pred=${after.predators} plants=${after.plants}
    Changes: ${changesStr || 'none'}
    Reasoning: ${d.reasoning}`;
}).join('\n')}

LEARNING RULES:
- Repeat parameter changes that were marked HELPED
- Reverse or avoid parameter changes that were marked HURT
- If NEUTRAL, try a bigger adjustment or a different parameter
`;
    }

    const prompt = `You are an AI game balancer for a 3-species evolution simulator.
Food chain: Plants → Prey → Omnivore → Predator. Omnivores also eat Plants.

CURRENT STATE (tick ${tick}):
- Prey (blue):     ${latest.prey} [${statusPrey}] (trend: ${preyTrend > 0 ? '+' : ''}${preyTrend}) — ideal: ${tgt.prey.min}-${tgt.prey.max}
- Omnivores (gold): ${latest.omnivores} [${statusOmni}] (trend: ${omniTrend > 0 ? '+' : ''}${omniTrend}) — ideal: ${tgt.omnivore.min}-${tgt.omnivore.max}
- Predators (pink): ${latest.predators} [${statusPred}] (trend: ${predTrend > 0 ? '+' : ''}${predTrend}) — ideal: ${tgt.predator.min}-${tgt.predator.max}
- Plants: ${latest.plants} — ideal: ${tgt.plants.min}-${tgt.plants.max}
- Food drops: ${latest.food}
- Ecosystem error: ${error.toFixed(2)} (0 = perfectly balanced)

POPULATION HISTORY (last ${recent.length} samples):
${recent.map(s => `  tick ${s.tick}: prey=${s.prey} omni=${s.omnivores} pred=${s.predators} plants=${s.plants}`).join('\n')}
${feedbackBlock}
CURRENT SETTINGS:
${TUNABLE_KEYS.map(k => `  ${k}: ${params[k]} (range: ${PARAM_RANGES[k].min} - ${PARAM_RANGES[k].max})`).join('\n')}

BALANCING GUIDE:
- If Prey too low: increase preyEatEnergy, preySafetyBonus, plantReproduceChance
- If Prey too high: decrease preyEatEnergy, increase predEatEnergy
- If Omnivores dominate: increase predEatEnergy, decrease preyEatEnergy (less food for omni)
- If Predators too high: increase predatorCrowdingDrain, decrease predEatEnergy
- If Predators too low: decrease predatorCrowdingDrain, increase predEatEnergy
- If Plants too low: increase plantReproduceChance, plantMaxCount
- equilibriumRatio affects predator crowding pressure threshold

GOAL: All 3 species survive within their ideal ranges. Minimize ecosystem error.

RULES:
- Learn from previous decisions (HELPED/HURT/NEUTRAL)
- Max 3 parameters at once, max 20% change per parameter
- If ecosystem error < 0.5 and all species within range, change nothing
- Keep values within min/max ranges

Respond with ONLY a JSON object:
{
  "reasoning": "what you observe and why you're making these changes",
  "changes": { "paramName": newValue }
}`;

    const response = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.3, num_predict: 400 },
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text: string = data.response || '';
    const jsonStr = extractFirstJson(text);
    if (!jsonStr) return null;

    try {
      const parsed = JSON.parse(jsonStr);
      const reasoning: string = parsed.reasoning || '';
      const rawChanges: Record<string, number> = parsed.changes || {};

      const changes: Partial<BalanceParams> = {};
      for (const [key, val] of Object.entries(rawChanges)) {
        if (!TUNABLE_KEYS.includes(key as keyof BalanceParams)) continue;
        if (typeof val !== 'number' || isNaN(val)) continue;
        const range = PARAM_RANGES[key];
        if (!range) continue;
        (changes as any)[key] = Math.max(range.min, Math.min(range.max, val));
      }

      return {
        tick,
        reasoning,
        changes,
        timestamp: Date.now(),
        scoreBefore: Math.round(error * 100) / 100,
        scoreAfter: null,
        outcome: null,
        snapshot: { ...currentStats },
        snapshotAfter: null,
      };
    } catch {
      return null;
    }
  }
}

function extractFirstJson(text: string): string | null {
  let start = -1;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (start === -1) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}
