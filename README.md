# Evolution Life Simulator

A browser-based evolution simulator featuring neural networks, procedural terrain, and AI-powered ecosystem balancing.

Three species — **Predators**, **Omnivores**, and **Prey** — evolve their brains (NEAT Neural Networks) across generations to survive in a dynamic world. A local LLM (Ollama) observes the ecosystem and automatically adjusts balance parameters in a self-improving feedback loop.

## Inspiration

This project was inspired by this video:

**[Evolving AIs - Predator vs Prey by Pezzzottaite](https://www.youtube.com/watch?v=dyvqH7v6V0E&t=396s)**

The core idea — letting creatures with neural networks compete in a 2D world and observing their evolution — originates from this video. This project extends the concept with a third species, terrain biomes, pheromone trails, evolvable traits, and LLM-powered balancing.

## Features

### Three-Species Ecosystem

| Species | Color | Eats | Eaten by |
|---|---|---|---|
| **Prey** | Blue/Cyan | Plants | Predators, Omnivores |
| **Omnivore** | Yellow/Orange | Plants, Prey, Predators | Predators |
| **Predator** | Red/Pink | Prey, Omnivores, FoodDrops | Omnivores |

No cannibalism — no species eats its own kind.

### Neural Networks (NEAT)

Each creature has its own neural network with:

- **28 Inputs**: Health, energy, split readiness, reserve, 5 vision zones (distance/angle/attractiveness each), 6 directional smell gradients, daylight, terrain type, own speed
- **3 Outputs**: Turning, speed, pheromone emission
- **Adaptive Mutation**: Successful genomes are protected (elitism), weak ones mutate more aggressively
- **Crossover**: 20% chance during reproduction — two nearby, fit creatures of the same species combine their genomes (NEAT-style)

### Evolvable Traits

| Trait | Effect | Cost |
|---|---|---|
| **Toxicity** | Poisons the attacker when eaten | Energy drain |
| **Poison Resistance** | Reduces incoming poison damage | Energy drain |
| **Defense** | Chance to deal damage back to the attacker | Energy drain |

Traits are inherited during reproduction and mutate slightly. Evolution finds the optimal balance between protection and energy cost.

### Terrain & Biomes

4 procedurally generated biomes:

| Biome | Speed | Vision | Plants |
|---|---|---|---|
| **Grassland** | 1.0x | 1.0x | Normal |
| **Forest** | 0.8x | 0.6x | 3x more |
| **Desert** | 1.2x | 1.2x | Scarce |
| **Water** | 0.5x | 0.8x | None |

### Pheromones / Scent Trails

Three pheromone channels on a diffusion grid:

- **Danger**: Prey emit alarm signals when attacked — warns other prey
- **Territory**: Predators mark their hunting grounds
- **Scent**: Omnivores leave scent trails

Creatures smell **directionally** (forward/lateral gradients) and actively decide via their NN whether to emit pheromones.

### Day/Night Cycle

- 3000 ticks per full cycle
- At night: world darkens, vision range halved
- Creatures must cope with reduced perception

### AI Control (Ollama)

#### AI Auto-Balancer
- Analyzes the ecosystem every 1000 ticks via Ollama (gemma3:12b)
- Three-species equilibrium with configurable target populations
- **Self-Improving Loop**: Scores previous decisions (HELPED/HURT/NEUTRAL) and learns from outcomes
- Adjustable target populations with +/-20% tolerance

#### AI Commentator
- Sarcastic nature documentary narrator (in German)
- Comments on the simulation every 60 seconds
- Detects notable events (mass extinction, baby boom, ecosystem balance)
- Vision mode: Sends a canvas screenshot to a vision model every 3 minutes
- Doubles as Ollama keep-alive (prevents model unloading after 5 min idle)

### UI

- **Minimap** (430x430) — clickable to navigate
- **5 Population Graphs** (Prey, Omnivore, Predator, Food, Plants)
- **Neural Network Visualizer** — shows the selected creature's brain
- **Creature Inspector** — Age, generation, fitness, kills, splits, brain complexity, traits (toxicity/resistance/defense)
- **Heatmap Overlay** — death/eating hotspots (toggle in settings)
- **HUD** — Ticks, time, frame time, pause/play/speed, settings button
- **AI Commentary Panel** — timestamped AI observations
- **Live Settings** — all balance parameters as sliders, persisted to localStorage
- **Genome Import/Export** — save and load best genomes as JSON

## Prerequisites

- **Node.js** >= 18
- **Ollama** (optional, for AI features) with `gemma3:12b` model

```bash
# Install Ollama: https://ollama.ai
ollama pull gemma3:12b
```

## Installation & Quick Start

```bash
git clone https://github.com/githubUser79/life-simulator.git
cd life-simulator
npm install
npm run dev
```

Open browser: `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

## Controls

| Action | Input |
|---|---|
| **Pan camera** | Click and drag |
| **Zoom** | Mouse wheel |
| **Select creature** | Click on creature |
| **Deselect** | Escape or drag camera |
| **Pause/Play** | Spacebar or HUD button |
| **Open settings** | "settings" button in HUD |
| **Navigate minimap** | Click on minimap |

## Tech Stack

- **TypeScript** + **Vite**
- **PixiJS v8** — 2D rendering
- **Ollama** — Local LLM for AI balancer and commentator
- **NEAT** — NeuroEvolution of Augmenting Topologies (simplified)

## Architecture

```
src/
├── ai/                      # AI control
│   ├── AutoBalancer.ts      # Ecosystem balancer (Ollama)
│   └── Commentator.ts       # Sarcastic commentator + vision
├── entities/                # Game objects
│   ├── Entity.ts            # Base class
│   ├── Creature.ts          # Creature with NN, traits, genealogy
│   ├── Predator.ts          # Predator species
│   ├── Omnivore.ts          # Omnivore species
│   ├── Prey.ts              # Prey species
│   ├── Plant.ts             # Plant with lifespan
│   └── FoodDrop.ts          # Food drop
├── neural/                  # Neural networks
│   ├── Genome.ts            # NEAT genome + crossover
│   ├── NeuralNetwork.ts     # Forward pass
│   └── Evolution.ts         # Adaptive mutation + elitism
├── rendering/               # Visual rendering
│   ├── CreatureRenderer.ts  # Blob rendering with lineage colors
│   ├── PlantRenderer.ts
│   ├── FoodRenderer.ts
│   ├── Heatmap.ts           # Death/eating overlay
│   └── TerrainRenderer.ts   # Biome overlay
├── simulation/              # Game logic
│   ├── World.ts             # Main simulation, collisions, balance
│   ├── Raycasting.ts        # Vision system + day/night
│   ├── SpatialGrid.ts       # Spatial optimization
│   ├── PheromoneGrid.ts     # Scent trails with diffusion
│   └── TerrainGrid.ts       # Procedural terrain
├── ui/                      # User interface
│   ├── HUD.ts               # Ticks, time, buttons
│   ├── Minimap.ts           # Clickable minimap
│   ├── PopulationGraph.ts   # 5 population graphs
│   ├── StatsPanel.ts        # Creature inspector
│   ├── NeuralNetViz.ts      # NN visualization
│   ├── DevTools.ts          # Settings + AI balancer UI
│   └── CommentaryPanel.ts   # AI commentary
├── config.ts                # All configuration constants
└── main.ts                  # Entry point, game loop
```

## License

MIT

---

Built with TypeScript, PixiJS, and [Claude Code](https://claude.ai/claude-code).
