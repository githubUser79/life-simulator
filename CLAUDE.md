# Life Simulator – CLAUDE.md

## Projektübersicht
Ein evolutionärer Life-Simulator mit neuronalen Netzen, inspiriert von
https://www.youtube.com/watch... (NEAT-Evolution, Raycasting-Vision).

## Tech Stack
- Pixi.js v8 (WebGL) für Rendering
- TypeScript (strict mode)
- Vite als Dev-Server
- Keine externen Physik-Engines

## Projektstruktur
src/
  entities/
    Entity.ts           # Basis-Klasse (Position, Velocity, Health, Energy)
    Creature.ts         # Basis für Predator & Prey (Squish-Animation, Augen)
    Predator.ts         # Frisst Prey und Food-Drops
    Prey.ts             # Frisst Plants, flieht vor Predators
    Plant.ts            # Wächst autonom, vermehrt sich lokal
    FoodDrop.ts         # Entsteht wenn Predator/Prey stirbt
  neural/
    NeuralNetwork.ts    # Feedforward NN mit variablen Hidden Nodes
    Genome.ts           # Gene: Connections + Nodes mit Gewichten
    Evolution.ts        # Mutation: Gewicht ändern / neue Connection / neuer Node
  simulation/
    World.ts            # Haupt-Simulation, Tick-Loop, Entity-Management
    SpatialGrid.ts      # Grid-basiertes Spatial Hashing für Performance
    Raycasting.ts       # 5 Zonen à N Rays, gibt [dist, angle, attractiveness] zurück
  ui/
    NeuralNetViz.ts     # Pixi Graphics: NN-Visualisierung links
    PopulationGraph.ts  # Pixi Graphics: Linien-Graphen rechts
    Minimap.ts          # Minimap oben rechts
    StatsPanel.ts       # Health/Energy/Split/Reserve Bars
    HUD.ts              # Ticks, Time, Frame-Time, Pause/Play/MaxSpeed
  rendering/
    CreatureRenderer.ts # Procedurales Blob-Rendering mit Squish-Animation
    PlantRenderer.ts    # Kleeblattsymbol animiert
  main.ts               # Pixi Application, Loop, UI-Initialisierung

## Konstanten (config.ts)
- WORLD_SIZE: 4000x4000 (scrollbare Welt)
- VIEWPORT: Fenstergröße
- INITIAL_PREDATORS: 20
- INITIAL_PREY: 100
- INITIAL_PLANTS: 200
- MAX_RAY_DISTANCE: 300
- NUM_ZONES: 5 (30 Rays total)
- CREATURE_FOV: 180° (gleich für beide Spezies)
- ENERGY_MOVE_COST: speed² * 0.001
- MUTATION_WEIGHT_DELTA: 0.3

## NN Input (28 Inputs)
Health, Energy, Split-Readiness, Reserve,
dann für jede Zone 0-4: [dist, angle, attractiveness]
dann 6 Geruchsgradienten: [danger→, danger↔, territory→, territory↔, scent→, scent↔]
dann 3 Umgebung: [daylight, terrain, mySpeed]
= 4 + 5*3 + 6 + 3 = 28 Inputs

## NN Output (3 Outputs)
Turn, Speed, Emit (Pheromon-Emission)
- angular_velocity (Drehrate)
- linear_velocity (Vorwärtsgeschwindigkeit)

## Rendering-Stil
- Creatures: Organischer Blob (kein Kreis!) aus mehreren überlappenden
  ellipsen die per Sinus-Wave pulsieren → Squish-Effekt
- Augen: 2 weiße Kreise mit schwarzen Pupillen, Pupillen zeigen
  in Bewegungsrichtung
- Predator: Rosa/Rot, größer
- Prey: Blau/Türkis, mittel
- Plant: Grünes Kleeblatt (4 Herzformen), wächst animiert
- Food: Goldener Kreis mit Ring, pulsiert leicht
- Background: Dunkelgrau (#404040) mit feinem Gitter
- Rays: Halbtransparent, farbig per Zonen-Typ

## Wichtige Regeln
1. SpatialGrid MUSS für alle Kollisions-/Proximity-Checks verwendet werden
2. Creature-Animation läuft unabhängig vom Simulations-Tick (Pixi Ticker)
3. Neural Network Inference NUR bei Simulations-Tick (nicht per Frame)
4. Plants haben KEIN NN – rein deterministisch
5. Food hat KEIN NN – statisch
6. Entities die sterben: fadeOut-Animation, dann destroy()
7. Neue Entities: fadeIn-Animation
8. Alle Magic Numbers in config.ts auslagern
