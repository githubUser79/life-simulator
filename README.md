# Evolution Life Simulator

Ein browserbasierter Evolutions-Simulator mit neuronalen Netzwerken, prozeduralem Terrain und KI-gesteuertem Balancing.

Drei Spezies — **Predatoren**, **Omnivoren** und **Prey** — entwickeln ihre Gehirne (NEAT Neural Networks) über Generationen weiter, um in einer dynamischen Welt zu überleben. Ein lokales LLM (Ollama) beobachtet das Ökosystem und passt die Balance-Parameter automatisch an.

## Inspiration

Dieses Projekt wurde inspiriert von diesem Video:

**[Evolving AIs - Predator vs Prey, beleuchtet von Pezzzottaite](https://www.youtube.com/watch?v=dyvqH7v6V0E&t=396s)**

Die grundlegende Idee — Kreaturen mit neuronalen Netzwerken in einer 2D-Welt gegeneinander antreten zu lassen und ihre Evolution zu beobachten — stammt aus diesem Video. Dieses Projekt erweitert das Konzept um eine dritte Spezies, Terrain-Biome, Pheromone, evolvierbare Traits und KI-gestütztes Balancing.

## Features

### Drei-Spezies-Ökosystem

| Spezies | Farbe | Frisst | Wird gefressen von |
|---|---|---|---|
| **Prey** | Blau/Cyan | Pflanzen | Predatoren, Omnivoren |
| **Omnivore** | Gelb/Orange | Pflanzen, Prey, Predatoren | Predatoren |
| **Predator** | Rot/Pink | Prey, Omnivoren, FoodDrops | Omnivoren |

Kein Kannibalismus — keine Spezies frisst ihre eigene Art.

### Neuronale Netzwerke (NEAT)

Jede Kreatur hat ein eigenes neuronales Netzwerk mit:

- **28 Inputs**: Gesundheit, Energie, Split-Bereitschaft, Reserve, 5 Sichtzonen (je Distanz/Winkel/Attraktivität), 6 gerichtete Geruchsgradienten, Tageszeit, Terrain-Typ, eigene Geschwindigkeit
- **3 Outputs**: Drehung, Geschwindigkeit, Pheromon-Emission
- **Adaptive Mutation**: Erfolgreiche Genome werden geschützt (Elitismus), schwache mutieren aggressiver
- **Crossover**: 20% Chance bei Reproduktion — zwei nahe, fitte Kreaturen gleicher Art kombinieren ihre Genome

### Evolvierbare Traits

| Trait | Effekt | Kosten |
|---|---|---|
| **Toxicity** | Vergiftet Angreifer beim Fressen | Energiekosten |
| **Poison Resistance** | Reduziert Giftschaden | Energiekosten |
| **Defense** | Chance, dem Angreifer Schaden zuzufügen | Energiekosten |

Traits werden bei Teilung vererbt und mutieren leicht. Evolution findet die optimale Balance zwischen Schutz und Energieverbrauch.

### Terrain & Biome

4 prozedural generierte Biome:

| Biome | Geschwindigkeit | Sichtweite | Pflanzen |
|---|---|---|---|
| **Grasland** | 1.0x | 1.0x | Normal |
| **Wald** | 0.8x | 0.6x | 3x mehr |
| **Wüste** | 1.2x | 1.2x | Kaum |
| **Wasser** | 0.5x | 0.8x | Keine |

### Pheromone / Duftspuren

Drei Pheromon-Kanäle auf einem Diffusions-Grid:

- **Danger**: Prey senden Alarm wenn angegriffen — warnt andere Prey
- **Territory**: Predatoren markieren ihr Revier
- **Scent**: Omnivoren hinterlassen Duftspuren

Kreaturen riechen **gerichtet** (vorwärts/seitlich) und entscheiden über ihr NN aktiv, ob sie Pheromone abgeben.

### Tag/Nacht-Zyklus

- 3000 Ticks pro Zyklus
- Nachts: Welt wird dunkler, Sichtweite halbiert
- Kreaturen müssen mit eingeschränkter Wahrnehmung klarkommen

### KI-Steuerung (Ollama)

#### AI Auto-Balancer
- Analysiert alle 1000 Ticks das Ökosystem via Ollama (gemma3:12b)
- Drei-Spezies-Gleichgewicht mit konfigurierbaren Zielwerten
- **Self-Improving Loop**: Bewertet vorherige Entscheidungen (HELPED/HURT/NEUTRAL) und lernt daraus
- Einstellbare Ziel-Populationen mit +/-20% Toleranz

#### AI Kommentator
- Sarkastischer Naturfilm-Erzähler auf Deutsch
- Kommentiert alle 60 Sekunden das Geschehen
- Erkennt besondere Ereignisse (Massensterben, Babyboom, Balance)
- Vision-Modus: Sendet alle 3 Minuten einen Screenshot an ein Vision-Modell
- Dient gleichzeitig als Ollama Keep-Alive (verhindert Model-Unload)

### UI

- **Minimap** (430x430) — klickbar zum Navigieren
- **5 Populationsgraphen** (Prey, Omnivore, Predator, Food, Plants)
- **Neural Network Visualizer** — zeigt das Gehirn der ausgewählten Kreatur
- **Creature Inspector** — Age, Generation, Fitness, Kills, Splits, Brain-Komplexität, Traits
- **Heatmap Overlay** — Tod/Fress-Hotspots (aktivierbar in Settings)
- **HUD** — Ticks, Zeit, Frame-Time, Pause/Play/Speed, Settings-Button
- **AI Commentary Panel** — deutsche Kommentare mit Timestamps
- **Live Settings** — alle Balance-Parameter als Slider, persistiert in localStorage
- **Genom Import/Export** — beste Genome als JSON speichern und laden

## Voraussetzungen

- **Node.js** >= 18
- **Ollama** (optional, für AI-Features) mit `gemma3:12b` Modell

```bash
# Ollama installieren: https://ollama.ai
ollama pull gemma3:12b
```

## Installation & Start

```bash
git clone https://github.com/githubUser79/life-simulator.git
cd life-simulator
npm install
npm run dev
```

Browser öffnen: `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

## Steuerung

| Aktion | Eingabe |
|---|---|
| **Kamera bewegen** | Maus ziehen |
| **Zoomen** | Mausrad |
| **Kreatur auswählen** | Klick auf Kreatur |
| **Auswahl aufheben** | Escape oder Kamera ziehen |
| **Pause/Play** | Leertaste oder HUD-Button |
| **Settings öffnen** | "settings" Button im HUD |
| **Minimap navigieren** | Klick auf Minimap |

## Tech Stack

- **TypeScript** + **Vite**
- **PixiJS v8** — 2D Rendering
- **Ollama** — Lokales LLM für AI Balancer und Kommentator
- **NEAT** — NeuroEvolution of Augmenting Topologies (vereinfacht)

## Architektur

```
src/
├── ai/                  # KI-Steuerung
│   ├── AutoBalancer.ts  # Ökosystem-Balancer (Ollama)
│   └── Commentator.ts   # Sarkastischer Kommentator + Vision
├── entities/            # Spielobjekte
│   ├── Entity.ts        # Basis-Klasse
│   ├── Creature.ts      # Kreatur mit NN, Traits, Genealogie
│   ├── Predator.ts      # Predator-Spezies
│   ├── Omnivore.ts      # Omnivore-Spezies
│   ├── Prey.ts          # Prey-Spezies
│   ├── Plant.ts         # Pflanze mit Lebensdauer
│   └── FoodDrop.ts      # Nahrungs-Drop
├── neural/              # Neuronale Netzwerke
│   ├── Genome.ts        # NEAT Genom + Crossover
│   ├── NeuralNetwork.ts # Forward-Pass
│   └── Evolution.ts     # Adaptive Mutation + Elitismus
├── rendering/           # Visuelle Darstellung
│   ├── CreatureRenderer.ts  # Blob-Rendering mit Lineage-Farben
│   ├── PlantRenderer.ts
│   ├── FoodRenderer.ts
│   ├── Heatmap.ts       # Tod/Fress-Overlay
│   └── TerrainRenderer.ts  # Biome-Overlay
├── simulation/          # Spiellogik
│   ├── World.ts         # Hauptsimulation, Kollisionen, Balance
│   ├── Raycasting.ts    # Sichtsystem + Tag/Nacht
│   ├── SpatialGrid.ts   # Räumliche Optimierung
│   ├── PheromoneGrid.ts # Duftspuren mit Diffusion
│   └── TerrainGrid.ts   # Prozedurales Terrain
├── ui/                  # Benutzeroberfläche
│   ├── HUD.ts           # Ticks, Zeit, Buttons
│   ├── Minimap.ts       # Klickbare Minimap
│   ├── PopulationGraph.ts  # 5 Populationsgraphen
│   ├── StatsPanel.ts    # Creature Inspector
│   ├── NeuralNetViz.ts  # NN-Visualisierung
│   ├── DevTools.ts      # Settings + AI Balancer UI
│   └── CommentaryPanel.ts  # AI Kommentare
├── config.ts            # Alle Konfigurationskonstanten
└── main.ts              # Entry Point, Game Loop
```

## Lizenz

MIT

---

Erstellt mit TypeScript, PixiJS und Claude Code.
