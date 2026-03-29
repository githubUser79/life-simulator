// ── World ──
export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 4000;

// ── Population ──
export const INITIAL_PREDATORS = 120;
export const INITIAL_PREY = 500;
export const INITIAL_OMNIVORES = 60;
export const INITIAL_PLANTS = 3000;

// ── Day/Night ──
export const DAY_NIGHT_CYCLE_TICKS = 3000;    // full cycle length
export const NIGHT_RAY_MULTIPLIER = 0.5;       // rays reach 50% at darkest
export const NIGHT_BG_BRIGHTNESS = 0.15;       // background brightness at night (0-1)

// ── Raycasting ──
export const MAX_RAY_DISTANCE = 300;
export const NUM_ZONES = 5;
export const CREATURE_FOV = (180 * Math.PI) / 180; // radians – equal for both species

// ── Neural Network ──
// NN: 4 state + 15 zones + 6 smell gradients + 1 daylight + 1 terrain + 1 speed = 28
export const NN_INPUTS = 28;
// NN: angular_velocity, linear_velocity, emit_pheromone
export const NN_OUTPUTS = 3;

// ── Energy / Health ──
export const ENERGY_MOVE_COST_FACTOR = 0.001; // cost = speed² * factor
export const SPLIT_ENERGY_THRESHOLD = 0.85;

// ── Balance ──
export const FOOD_DROP_CHANCE_ON_DEATH = 0.8;
export const PLANT_REGEN_BOOST_THRESHOLD = 50; // if prey < this, plants grow faster
export const PLANT_REGEN_BOOST_FACTOR = 3;     // multiplier for plant reproduce chance
export const MIN_PREDATORS = 5;   // respawn if population drops below
export const MIN_PREY = 15;       // respawn if population drops below
export const MIN_OMNIVORES = 8;   // respawn if population drops below
export const PASSIVE_ENERGY_GAIN = 0; // no free energy — creatures must eat to survive

// ── Density-Dependent Balance (Lotka-Volterra) ──
export const PRED_PREY_EQUILIBRIUM_RATIO = 0.3;  // ideal: 30 pred per 100 prey
export const PREDATOR_CROWDING_DRAIN = 0.0008;    // extra energy drain per tick when overpopulated
export const PREDATOR_HUNT_COOLDOWN = 200;        // ticks after eating before full energy from next kill
export const PREY_SAFETY_BONUS = 0.0002;          // extra passive energy when prey are scarce (survival aid)
export const PREY_SCARCITY_THRESHOLD = 50;        // prey count below which survival bonus kicks in

// ── Mutation ──
export const MUTATION_WEIGHT_DELTA = 0.3;

// ── Creature sizes ──
export const PREDATOR_BASE_RADIUS = 18;
export const OMNIVORE_BASE_RADIUS = 15;
export const PREY_BASE_RADIUS = 13;
export const PLANT_MAX_RADIUS = 22;
export const FOOD_RADIUS = 8;

// ── Creature speeds ──
export const CREATURE_MAX_SPEED = 2.75; // equal for both species
export const CREATURE_TURN_SPEED = 0.08; // radians per tick

// ── Plant ──
export const PLANT_GROWTH_TIME = 3000; // ms to reach full size
export const PLANT_REPRODUCE_CHANCE = 0.0005;
export const PLANT_REPRODUCE_RADIUS = 250;
export const PLANT_MAX_COUNT = 500;
export const PLANT_MAX_AGE = 1000;            // ticks before a plant dies of old age (~17s at 60fps)
export const PLANT_CLUSTER_RADIUS = 60;       // radius to check for nearby plants
export const PLANT_CLUSTER_MAX = 4;           // max plants within cluster radius

// ── FoodDrop ──
export const FOOD_ENERGY_VALUE = 0.3;
export const FOOD_DECAY_TIME = 15000; // ms until food disappears

// ── Rendering ──
export const BACKGROUND_COLOR = 0x404040;
export const GRID_LINE_COLOR = 0x4a4a4a;
export const GRID_CELL_SIZE = 100;

// ── Spatial Grid ──
export const SPATIAL_CELL_SIZE = 100;

// ── Animation ──
export const FADE_DURATION = 400; // ms for fade in/out
export const FLASH_DURATION = 150; // ms for eating flash
export const MAX_DT = 50; // dt cap in ms

// ── Ray Zone Colors ──
export const RAY_ZONE_COLORS = [0xffffff, 0x4488ff, 0x44cc66, 0xcc4444, 0xffcc44];

// ── Colors ──
export const PREDATOR_COLOR = 0xe85577;
export const OMNIVORE_COLOR = 0xddaa33;
export const PREY_COLOR = 0x44bbdd;
export const PLANT_COLOR = 0x44cc66;
export const FOOD_COLOR = 0xffcc44;
export const FOOD_RING_COLOR = 0xddaa22;
