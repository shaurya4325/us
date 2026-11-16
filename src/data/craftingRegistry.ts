// Recipes for every functional block (Crafting Table, Furnace/Kiln, Starlight Anvil, Petal Loom, Kitchen Hearth),
// the five tool tiers, the daily co-op quests, the lore memory stones and the Love Star shop.
import { TIERS, type Cost, type ItemId, type ToolId } from './items';
import type { RoomType } from '../world/catalog';

export type Station = 'table' | 'furnace' | 'anvil' | 'loom' | 'hearth';
export type Tab = 'Tools' | 'Building' | 'Furniture' | 'Rooms' | 'Decor';
export const TABS: Tab[] = ['Tools', 'Building', 'Furniture', 'Rooms', 'Decor'];

export interface Recipe {
  id: string; station: Station; tab?: Tab; cost: Cost;
  out?: Partial<Record<ItemId, number>>;   // items into the shared vault
  tool?: ToolId;                           // crafts a tool
  block?: Placeable;                       // places a functional block at the homestead camp
  secs?: number;                           // furnace/hearth time
}
export type Placeable = 'furnace' | 'anvil' | 'loom' | 'hearth' | 'chest';
export const BLOCKS: Record<Placeable | 'table' | 'board', { name: string; icon: string; blurb: string }> = {
  table: { name: 'Crafting Table', icon: '🛠️', blurb: 'Tools, blocks, furniture, rooms and decor' },
  furnace: { name: 'Cloud-Stone Furnace', icon: '🔥', blurb: 'Smelts ore, bakes clay, fuses sand into glass' },
  anvil: { name: 'Starlight Anvil', icon: '⚒️', blurb: 'Upgrades tools through five tiers' },
  loom: { name: 'Petal Loom & Dye Vat', icon: '🧵', blurb: 'Plushies, rugs, curtains and the Velvet Paintbrush' },
  hearth: { name: 'Cozy Kitchen Hearth', icon: '🍲', blurb: 'Cooks treats that give little buffs' },
  chest: { name: 'Keepsake Chest', icon: '🧰', blurb: 'Holds lore stones, gifts and things crafted together' },
  board: { name: "Today's Co-Op Quests", icon: '📜', blurb: 'Three shared quests a day, paid in Love Stars' },
};

const R = (id: string, station: Station, cost: Cost, rest: Partial<Recipe> = {}): Recipe => ({ id, station, cost, ...rest });
export const RECIPES: Recipe[] = [
  // Crafting Table · tools
  R('t:hatchet', 'table', { wood: 3, stone: 2 }, { tab: 'Tools', tool: 'hatchet' }),
  R('t:pickaxe', 'table', { wood: 4, stone: 3 }, { tab: 'Tools', tool: 'pickaxe' }),
  R('t:sickle', 'table', { wood: 2, stone: 2, flower: 1 }, { tab: 'Tools', tool: 'sickle' }),
  R('t:net', 'table', { wood: 4, flower: 3 }, { tab: 'Tools', tool: 'net' }),
  R('t:rod', 'table', { wood: 5, bug: 1 }, { tab: 'Tools', tool: 'rod' }),
  R('t:can', 'table', { wood: 3, flower: 2 }, { tab: 'Tools', tool: 'can' }),
  R('t:hammer', 'table', { wood: 4, stone: 4 }, { tab: 'Tools', tool: 'hammer' }),
  // Crafting Table · functional blocks
  R('b:furnace', 'table', { stone: 10, wood: 4 }, { tab: 'Building', block: 'furnace' }),
  R('b:anvil', 'table', { stone: 12, wood: 4, crystal: 1 }, { tab: 'Building', block: 'anvil' }),
  R('b:loom', 'table', { wood: 8, flower: 6 }, { tab: 'Building', block: 'loom' }),
  R('b:hearth', 'table', { stone: 8, wood: 6 }, { tab: 'Building', block: 'hearth' }),
  R('b:chest', 'table', { wood: 8, stone: 2 }, { tab: 'Building', block: 'chest' }),
  // Crafting Table · furniture & decor (placed from the hotbar)
  R('f:lantern', 'table', { sakuraWood: 2, sap: 1 }, { tab: 'Furniture', out: { lantern: 1 } }),
  R('f:shelf', 'table', { wood: 6, azureWood: 2 }, { tab: 'Furniture', out: { shelf: 1 } }),
  R('f:lamp', 'table', { sunGlass: 1, pinkQuartz: 1, moonstone: 1 }, { tab: 'Furniture', out: { lamp: 1 } }),
  R('f:pot', 'table', { brick: 1, flower: 2 }, { tab: 'Furniture', out: { pot: 1 } }),
  R('d:lights', 'table', { crystal: 1, sap: 1 }, { tab: 'Decor', out: { lights: 1 } }),
  R('d:chime', 'table', { seaGlass: 2, driftwood: 1, shard: 1 }, { tab: 'Decor', out: { chime: 1 } }),
  R('d:bouquet', 'table', { flower: 4, silk: 1 }, { tab: 'Decor', out: { bouquet: 1 } }),
  // Cloud-Stone Furnace / Kiln (wood is the fuel)
  R('s:ingot', 'furnace', { roseOre: 2, wood: 1 }, { out: { roseIngot: 1 }, secs: 2.5 }),
  R('s:brick', 'furnace', { clay: 2, wood: 1 }, { out: { brick: 2 }, secs: 2.5 }),
  R('s:glass', 'furnace', { sand: 3, wood: 1 }, { out: { sunGlass: 1 }, secs: 2.5 }),
  R('s:quartz', 'furnace', { stone: 3, crystal: 1, wood: 1 }, { out: { pinkQuartz: 1 }, secs: 3 }),
  // Petal Loom & Dye Vat
  R('l:plushMochi', 'loom', { cotton: 2, silk: 2, flower: 1 }, { out: { plushMochi: 1 } }),
  R('l:plushKuro', 'loom', { cotton: 2, silk: 2, nectar: 1 }, { out: { plushKuro: 1 } }),
  R('l:plushCoco', 'loom', { cotton: 2, silk: 1, driftwood: 1 }, { out: { plushCoco: 1 } }),
  R('l:rug', 'loom', { silk: 3, cotton: 1 }, { out: { rug: 1 } }),
  R('l:curtain', 'loom', { silk: 2, moss: 1 }, { out: { curtain: 1 } }),
  R('l:pillow', 'loom', { cotton: 2, silk: 1 }, { out: { pillow: 1 } }),
  R('l:brush', 'loom', { silk: 2, wood: 1, nectar: 1 }, { tool: 'brush' }),
  // Cozy Kitchen Hearth (cooked with the timing mini-game)
  R('h:mochi', 'hearth', { nectar: 2, flower: 1 }, { out: { mochi: 1 } }),
  R('h:tart', 'hearth', { nectar: 1, sap: 1, flower: 2 }, { out: { tart: 1 } }),
  R('h:cocoaStar', 'hearth', { shard: 1, sap: 1 }, { out: { cocoaStar: 1 } }),
  R('h:cocoaRose', 'hearth', { flower: 3, nectar: 1 }, { out: { cocoaRose: 1 } }),
  R('h:momos', 'hearth', { fish: 1, flower: 1 }, { out: { momos: 2 } }),
  R('h:cake', 'hearth', { nectar: 2, cotton: 1 }, { out: { cake: 1 } }),
  R('h:ramen', 'hearth', { fish: 2, moss: 1 }, { out: { ramen: 1 } }),
];
export const recipesFor = (s: Station, tab?: Tab) => RECIPES.filter((r) => r.station === s && (!tab || r.tab === tab));

/* ---------------- Starlight Anvil: cost to reach tier n (1..4) ---------------- */
export const UPGRADE: Cost[] = [
  {},
  { stone: 6, crystal: 1 },
  { sakuraWood: 4, azureWood: 4, gem: 1 },
  { roseIngot: 3, pinkQuartz: 2, gem: 1 },
  { shard: 4, skyQuartz: 2, gem: 2 },
];
export const tierName = (t: number) => TIERS[Math.max(0, Math.min(4, t))].name;

/* ---------------- room blueprints (scrolls found in the ancient structures) ---------------- */
export const BLUEPRINT_FROM: Partial<Record<RoomType, string>> = {
  living: 'temple', gallery: 'temple', pool: 'shrine', cinema: 'shrine', observatory: 'treehouse', music: 'treehouse', rooftop: 'bells',
};

/* ---------------- Today's Co-Op Quests ---------------- */
export interface Quest { id: string; text: string; ev: string; goal: number; stars: number; coop?: boolean }
export const QUESTS: Quest[] = [
  { id: 'unseal', text: 'Unseal an ancient structure together', ev: 'unseal', goal: 1, stars: 4, coop: true },
  { id: 'giant', text: 'Bring down a giant co-op node in rhythm', ev: 'giant', goal: 1, stars: 4, coop: true },
  { id: 'chest', text: 'Open a Two-Key Treasure Chest', ev: 'chest', goal: 1, stars: 3, coop: true },
  { id: 'ct', text: 'Craft or cook something together', ev: 'ct', goal: 1, stars: 3, coop: true },
  { id: 'tether', text: 'Harvest 8 times linked by the tether', ev: 'tether', goal: 8, stars: 3, coop: true },
  { id: 'azure', text: 'Harvest 6 Azure Heartwood', ev: 'r:azureWood', goal: 6, stars: 2 },
  { id: 'sakura', text: 'Chop 8 Sakura Timber', ev: 'r:sakuraWood', goal: 8, stars: 2 },
  { id: 'pearl', text: 'Find 3 Pearl Shells in the lagoon', ev: 'r:pearl', goal: 3, stars: 2 },
  { id: 'shard', text: 'Collect 4 Starlight Shards', ev: 'r:shard', goal: 4, stars: 2 },
  { id: 'cocoa', text: 'Cook 2 Rose Hot Cocoas & share them', ev: 'cook:cocoaRose', goal: 2, stars: 3 },
  { id: 'cook', text: 'Cook 3 treats at a hearth', ev: 'cook', goal: 3, stars: 2 },
  { id: 'gift', text: 'Send your partner a gift parcel', ev: 'gift', goal: 1, stars: 2 },
  { id: 'hug', text: 'Share 3 hugs', ev: 'hug', goal: 3, stars: 1 },
  { id: 'dance', text: 'Dance together twice', ev: 'dance', goal: 2, stars: 1 },
  { id: 'fish', text: 'Catch 3 koi', ev: 'r:fish', goal: 3, stars: 2 },
  { id: 'visit', text: 'Visit all five biomes together', ev: 'visit', goal: 5, stars: 3, coop: true },
];
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** the same three quests on both phones: seeded by the date, always at least one co-op quest */
export function todaysQuests(day = dayKey()): Quest[] {
  let s = [...day].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 2147483647, 7) || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const coop = QUESTS.filter((q) => q.coop), a = coop[Math.floor(rnd() * coop.length)];
  const pool = QUESTS.filter((q) => q !== a), b = pool.splice(Math.floor(rnd() * pool.length), 1)[0], c = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  return [a, b, c];
}

/* ---------------- Love Star shop ---------------- */
export const SHOP = [
  { id: 'cape6', name: 'Starlight Gold Cape', icon: '🧣', stars: 8, blurb: 'A shimmering golden cape' },
  { id: 'cape7', name: 'Sakura Petal Cape', icon: '🌸', stars: 8, blurb: 'Soft pink, like the grove' },
  { id: 'plushStar', name: 'Starlight Bunny Plush', icon: '🐰', stars: 10, blurb: 'A rare plush, only from stars' },
  { id: 'bp:rooftop', name: 'Secret Rooftop blueprint', icon: '🏮', stars: 12, blurb: 'If the Wind-Bell scroll is too far away' },
  { id: 'trail', name: 'Heart Trail (forever)', icon: '💞', stars: 20, blurb: 'Hearts follow both of your footsteps' },
];

/* ---------------- Lore Memory Stones (sweet, wholesome) ---------------- */
export const LORE: Record<string, { title: string; text: string }[]> = {
  temple: [
    { title: 'The Umbrella Stone', text: 'Two travellers once sheltered here from the rain. One shared an umbrella, the other shared snacks. Neither of them remembered the rain afterwards, only the laughing.' },
    { title: 'The Seventh Pillar', text: 'Carved on the seventh pillar: "Some days are ordinary. The seventh of August was not." Someone drew a tiny heart next to it, then a second, smaller one, as if it were shy.' },
  ],
  shrine: [
    { title: 'Koi Promise', text: 'The shrine keeper wrote that koi swim in pairs when the water is calm. "When one gets lost, the other circles back. Always. That is the whole secret."' },
    { title: 'Lantern Wish', text: 'A faded wish tied to a lantern: "Let them annoy each other a normal amount (a lot) and still choose each other every evening."' },
  ],
  treehouse: [
    { title: 'Observatory Log', text: 'Night 214. Counted stars until we fell asleep. She says I lost count at forty. I say she started laughing at thirty-nine. The telescope was pointed at her the whole time anyway.' },
    { title: 'Pressed Flower', text: 'Between two dusty books, a pressed flower and a note: "Picked this on the walk home. It reminded me of your smile, so obviously I had to steal it."' },
  ],
  bells: [
    { title: 'The Tallest Bell', text: 'The wind rings this bell only when two people stand under it. Legend says it has rung more often in the last few months than in a hundred years.' },
    { title: 'Song of the Chimes', text: '"Distance is just the wind between two bells," the old carving says. "It carries the sound. It never breaks it."' },
  ],
  grotto: [
    { title: 'Pearl Diary', text: 'Found inside a shell: "Today we built a sandcastle and a moat and a tiny bridge. Then we argued about who the castle belonged to. It belongs to us. Obviously."' },
  ],
};
