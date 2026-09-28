# VoxelCraft

A single-player voxel survival game for desktop browsers. Procedural seed-based world,
tool mining, 2×2 / 3×3 crafting, animals, health and hunger, day/night cycle,
and local saves in IndexedDB.

**All assets are original and procedural**: textures, icons, animal skins, the logo,
and sounds are generated in code at startup (there are no third-party image or audio
files). The typeface is [Pixelify Sans](https://fonts.google.com/specimen/Pixelify+Sans)
(SIL Open Font License), bundled via `@fontsource`.

## Requirements

- Node.js 20+ (tested with Node 24) and npm
- A desktop browser with WebGL, Web Workers, IndexedDB, and Pointer Lock
  (recent Chrome, Edge, Firefox, or Safari)

## Install and run

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # type-check + production bundle in dist/
npm run preview    # serves dist/
npm run test       # unit + integration tests (Vitest)
npm run lint       # ESLint + tsc
```

## Controls

| Action | Default key |
|---|---|
| Move | W A S D |
| Jump / swim up | Space |
| Sprint | Left Shift (forward only, and only with hunger > 6) |
| Attack / mine (hold) | Left click |
| Use / place / eat (hold) | Right click |
| Inventory | E |
| Hotbar | 1–9, mouse wheel |
| Drop item | Q |
| Camera (1st person / 3rd behind / 3rd in front) | F5 |
| Debug overlay | F3 |
| Pause | Esc |
| Dev console (`npm run dev` only) | `/` or T |

Everything except 1–9 and Esc can be rebound in **Settings → Controls**; conflicts are
highlighted in red. In the inventory: left click picks up, places, or swaps; right click
splits a stack or places one item; Shift+click moves items between the hotbar and the
inventory (or crafts the maximum possible from the crafting output). Clicking outside
the panel drops the item.

## Creating a world

**Singleplayer → Create New World**. The seed can be a number, any text (it is hashed),
or empty (random); **Random Seed** fills one in. You can also change the world rules:
`keepInventory`, the day/night cycle, and animal spawning. The same seed always
generates exactly the same terrain.

## Mechanics

- **Terrain**: 16×16×128 chunks, seeded simplex noise (continents + hills + detail),
  plains / forest / beach / ocean biomes, sea level 28, trees with 4–6 block trunks.
- **Mining**: `time = hardness / speed`. Hardness is the time by hand (dirt 0.7 s,
  wood 2.5 s, stone 6 s); the correct tool multiplies speed by ×4 (wood) or ×6 (stone);
  a sword is slower than the hand except on leaves. Stone only drops an item when mined
  with a pickaxe. 8 crack stages, plus particles and a sound per material. Tools wear
  out (wood 60 uses, stone 132) and then break.
- **Crafting**: shaped recipes (with mirroring) and shapeless recipes, defined in
  `src/config/recipes.ts`. Log → 4 planks, 2 planks → 4 sticks, 4 planks → crafting
  table, wood and stone tools (the table is required, 3×3).
- **Health and hunger**: 20 HP / 20 hunger points. Exhaustion builds up from walking,
  sprinting, jumping, swimming, attacking, and mining; every 1.0 of exhaustion costs
  1 hunger point. Hunger ≥ 18 regenerates health; hunger ≤ 6 disables sprinting; hunger
  0 deals damage. Falls of more than 3 blocks deal damage. Eating: hold right click for
  1.2 s (+3 hunger).
- **Animals**: pigs and cows with idle / wander / flee AI, they jump 1-block steps,
  avoid cliffs and water, take knockback, and flee when hit. They drop raw meat (and
  leather for cows). Population cap of 40; they respawn slowly.
- **World**: 20-minute day/night cycle, fog tied to render distance, clouds,
  sun/moon/stars, and semi-transparent water that slows movement and tints the camera.

## Architecture

```
src/
  app/        GameSession (headless simulation), Game (orchestrator + states),
              WorldRuntime (presentation of a world), GameLoop (fixed 60 Hz timestep),
              StateMachine, MenuScene (menu background)
  world/      World (chunks + diffs), WorldGenerator, TreeGenerator, Noise, SeededRandom,
              TerrainMesher (face culling + AO), Raycast (DDA), ChunkManager (streaming),
              ChunkWorkerPool + chunk.worker (generation and meshing in Web Workers), coords
  player/     Player, PlayerController (movement), PlayerInteraction (mine/place/
              attack/eat), PlayerStats (health/hunger), PlayerCamera (1st/3rd person)
  physics/    VoxelPhysics: AABB swept per axis against voxels (player, animals, items)
  items/      ItemRegistry, ItemStack, Mining (timings/harvest), DropSystem, PickupEntity
  inventory/  Inventory, Hotbar, SlotActions, CraftingGrid, Recipe, RecipeRegistry
  entities/   Entity, Animal, AnimalAI, EntityManager (spawn, latent state per chunk)
  combat/     AttackSystem (entity raycast), DamageSystem (damage, knockback, flee)
  render/     Renderer, ChunkRenderer, EntityRenderer, BoxModel, ItemMeshes, HeldItem,
              BlockHighlight, Particles, Sky, Textures
  assets/     Procedural painting: TerrainTextures, ItemIcons, SkinTextures
  audio/      SoundSynth (offline synthesis), SoundRegistry, AudioManager (buses + 3D),
              AmbientAudio (wind, birds, crickets, generative music)
  ui/         DOM screens: MainMenu, WorldSelect, WorldCreate, Loading, Pause, Settings,
              Death, HUD, InventoryUI, CraftingUI, DevConsole
  save/       SaveManager (IndexedDB), WorldSerializer, SettingsStorage (localStorage)
  config/     blocks, items, recipes, animals, playerModel, defaults (constants and settings)
```

Principles:

- **Data-driven**: blocks, items, tools, recipes, and animals are data in `src/config/`.
  Adding a block means one entry in `blocks.ts` (plus a texture painter if it uses a new one).
- **Simulation separated from rendering**: `GameSession` does not touch the DOM, WebGL,
  or audio; it reports facts through an `EventBus` (`block:broken`, `item:picked`,
  `player:damaged`…) that audio, particles, and the UI listen to. That is why all the
  logic is tested without a browser.
- **Determinism**: everything procedural comes from `hash3(seed, …)` / `SeededRandom`;
  trees that cross chunk borders are derived from world coordinates, not from load order.
- **Chunks**: one mesh per chunk (opaque + water), exposed faces only, immediate remesh
  of the edited chunk (and of the neighbor if the block is on the edge). New chunks are
  generated and meshed in workers; edited ones are handled on the main thread (< 10 ms).
- **States**: `BOOT → MAIN_MENU → WORLD_SELECT → WORLD_CREATE → LOADING_WORLD → PLAYING ⇄
  INVENTORY / PAUSED / DEAD`, `SETTINGS`. The input context (game / UI) follows the state.

## Save format

IndexedDB database `voxelcraft`, stores `worlds` (metadata, for fast listing) and `saves`
(body). Only what cannot be regenerated is stored:

```ts
interface WorldSave {
  metadata: { id, name, seed, createdAt, updatedAt, version }
  player: { position, rotation, health, hunger, exhaustion, selectedHotbarSlot,
            inventory: { slot, stack: { itemId, count, damage? } }[], spawnPoint }
  modifiedChunks: { key: "cx,cz", changes: [blockIndex, blockId, ...] }[]
  entities: ({ type: 'animal', kind, x, y, z, yaw, health } |
             { type: 'item', itemId, count, damage?, x, y, z, age })[]
  spawnedChunks: string[]   // chunks that already did their initial animal spawn
  time: number              // world clock in seconds
  rules: { keepInventory, dayNightCycle, animalSpawning }
}
```

Load: `seed → regenerate chunk → apply diffs → restore entities` (animals in unloaded
chunks stay latent until their chunk comes back). Autosave every 30 s, on pause, when
returning to the menu, and (best effort) when the tab is hidden or closed. Settings and
the last world used are stored in `localStorage`. Invalid data in a save is discarded
instead of breaking the load.

## Testing

`npm run test` runs 81 tests (Vitest, no browser):

- coordinates (negatives, edges, indices), generation (determinism, different seeds,
  presence of every block, trees never underwater, safe spawn)
- inventory (merge, split, full, non-stackable tools, validation), crafting
  (every recipe, mirroring, invalid recipes, consumption), mining (speeds, drops by tier)
- hunger (exhaustion, sprint, starvation, regeneration), physics (falling, tunnels, walls,
  overlap recovery), raycast, pickups (once only, delay, full inventory, despawn),
  animals (damage, flee, latency, persistence), mesher (culling between blocks and
  between chunks, water), state machine, keybind conflicts
- serialization (JSON round trip, no duplicate drops, corrupt data) and IndexedDB
  (`fake-indexeddb`)
- **golden path** (`tests/goldenPath.test.ts`): starting with nothing, find a tree,
  chop 3 logs by hand, pick them up, craft planks, sticks, and a crafting table using
  the same click API as the UI, place the table, open it with right click, craft a
  wooden pickaxe, dig down to stone, mine 3 stone, craft a stone pickaxe, kill a pig,
  pick up the meat, get hungry, eat, save and reload, checking position, inventory,
  health, hunger, and blocks.

## Known limitations

- No light propagation (caves/tunnels look lit, softened by AO); no real-time shadows.
- Static water: it does not flow; breaking a block next to water turns it into water.
- Face-culling meshing, without greedy meshing.
- No caves, ores, furnace, or hostile mobs (see the specification's stretch goals).
- Visual interpolation applies only to the camera/player; animals are drawn at the
  position of the last 60 Hz tick.
- The browser limits pointer lock: after leaving with Esc you have to wait about 1 s
  before capturing the mouse again ("Click to resume" appears).
- "Quit Game" cannot close a tab the script did not open; it shows a message.
