// Every item that can sit in the Shared Vault, plus the tools and their five upgrade tiers.
// The vault is the shared `inv` map in the world doc, so either partner can craft with anything the other gathered.
import type { BiomeId } from './biomes';

export type ItemCat = 'res' | 'mat' | 'gem' | 'treat' | 'plush' | 'decor' | 'gift';
export type Buff = 'speed' | 'hearts' | 'energy' | 'love' | 'cozy';
export interface ItemDef { name: string; icon: string; cat: ItemCat; tint?: string; biome?: BiomeId; buff?: Buff; blurb?: string }

const pink = 'hue-rotate(295deg) saturate(1.5) brightness(1.18)', blue = 'hue-rotate(175deg) saturate(1.6) brightness(1.05)';
export const ITEMS = {
  // Sunlit Prairie
  wood: { name: 'Birch Wood', icon: '🪵', cat: 'res', biome: 'prairie' },
  stone: { name: 'Cloud Stone', icon: '🪨', cat: 'res', biome: 'prairie' },
  crystal: { name: 'Rose Crystal', icon: '💎', cat: 'res', tint: 'hue-rotate(120deg) saturate(1.3)', biome: 'prairie' },
  flower: { name: 'Wildflowers', icon: '🌼', cat: 'res', biome: 'prairie' },
  fish: { name: 'Koi', icon: '🐟', cat: 'res' },
  bug: { name: 'Butterfly', icon: '🦋', cat: 'res' },
  roseOre: { name: 'Rose-Gold Ore', icon: '🪨', cat: 'res', tint: 'sepia(1) saturate(3.5) hue-rotate(-25deg) brightness(1.15)', biome: 'prairie' },
  // Sakura Wind-Blossom Grove
  sakuraWood: { name: 'Sakura Timber', icon: '🪵', cat: 'res', tint: pink, biome: 'sakura' },
  silk: { name: 'Blossom Silk', icon: '🎀', cat: 'res', biome: 'sakura' },
  pinkQuartz: { name: 'Pink Quartz', icon: '💎', cat: 'res', tint: 'hue-rotate(110deg) saturate(1.1) brightness(1.25)', biome: 'sakura' },
  nectar: { name: 'Cherry Nectar', icon: '🍒', cat: 'res', biome: 'sakura' },
  // Azure Whisper Woods
  azureWood: { name: 'Azure Heartwood', icon: '🪵', cat: 'res', tint: blue, biome: 'azure' },
  sap: { name: 'Lumina Sap', icon: '🧪', cat: 'res', tint: 'hue-rotate(-60deg) saturate(1.4)', biome: 'azure' },
  moss: { name: 'Glow-Moss', icon: '🌿', cat: 'res', tint: 'hue-rotate(70deg) saturate(1.6) brightness(1.25)', biome: 'azure' },
  moonstone: { name: 'Moonstone', icon: '🌙', cat: 'res', biome: 'azure' },
  // Cloud-Reach Starlight Cliffs
  shard: { name: 'Starlight Shard', icon: '🌟', cat: 'res', biome: 'cliffs' },
  skyQuartz: { name: 'Sky-Quartz', icon: '💎', cat: 'res', tint: 'hue-rotate(40deg) saturate(.7) brightness(1.35)', biome: 'cliffs' },
  cotton: { name: 'Cloud-Cotton Fluff', icon: '☁️', cat: 'res', biome: 'cliffs' },
  // Crystal Dew Lagoon
  clay: { name: 'Dew Clay', icon: '🟤', cat: 'res', biome: 'lagoon' },
  seaGlass: { name: 'Sea-Glass', icon: '🧊', cat: 'res', tint: 'hue-rotate(-25deg) saturate(1.6)', biome: 'lagoon' },
  pearl: { name: 'Pearl Shell', icon: '🦪', cat: 'res', biome: 'lagoon' },
  driftwood: { name: 'Driftwood', icon: '🪵', cat: 'res', tint: 'grayscale(.75) brightness(1.25)', biome: 'lagoon' },
  sand: { name: 'Blush Sand', icon: '🏜️', cat: 'res', biome: 'lagoon' },
  // furnace & kiln
  roseIngot: { name: 'Rose-Gold Ingot', icon: '🧈', cat: 'mat', tint: 'hue-rotate(-30deg) saturate(1.5) brightness(1.05)' },
  brick: { name: 'Rose-Glazed Brick', icon: '🧱', cat: 'mat', tint: 'hue-rotate(-12deg) saturate(.75) brightness(1.25)' },
  sunGlass: { name: 'Sun-Glass Pane', icon: '🪟', cat: 'mat' },
  gem: { name: 'Tool Upgrade Gem', icon: '💠', cat: 'gem', blurb: 'Found in ancient structures. The anvil needs these.' },
  star: { name: 'Love Star', icon: '💫', cat: 'gem', blurb: 'Earned from co-op quests. Spend them at the Adventure Board.' },
  // kitchen hearth treats
  mochi: { name: 'Sakura Mochi', icon: '🍡', cat: 'treat', buff: 'speed', blurb: '+20% speed for 3 minutes' },
  tart: { name: 'Berry Heart Tart', icon: '🥧', cat: 'treat', buff: 'hearts', blurb: 'Heart footsteps for 3 minutes' },
  cocoaStar: { name: 'Starlight Hot Cocoa', icon: '☕', cat: 'treat', buff: 'energy', blurb: 'Refills your energy' },
  cocoaRose: { name: 'Rose Hot Cocoa', icon: '🧋', cat: 'treat', buff: 'love', blurb: 'Fills the love meter at once' },
  momos: { name: 'Momos', icon: '🥟', cat: 'treat', buff: 'cozy', blurb: 'Share them: +30 energy' },
  cake: { name: 'Strawberry Cake', icon: '🍰', cat: 'treat', buff: 'cozy', blurb: 'Share it: +30 energy' },
  ramen: { name: 'Ramen', icon: '🍜', cat: 'treat', buff: 'speed', blurb: '+20% speed for 3 minutes' },
  // petal loom
  plushMochi: { name: 'Mochi Bunny Plush', icon: '🐰', cat: 'plush' },
  plushKuro: { name: 'Kuro Pink-Plum Bunny', icon: '🐇', cat: 'plush' },
  plushCoco: { name: 'Coco Bear Plush', icon: '🧸', cat: 'plush' },
  plushStar: { name: 'Starlight Bunny', icon: '🐰', cat: 'plush', tint: 'hue-rotate(200deg) brightness(1.2)' },
  bouquet: { name: 'Blossom Bouquet', icon: '💐', cat: 'gift' },
  // placeable decor
  rug: { name: 'Velvet Heart Rug', icon: '🧶', cat: 'decor' },
  curtain: { name: 'Blossom Curtains', icon: '🎏', cat: 'decor' },
  lantern: { name: 'Sakura Lantern', icon: '🏮', cat: 'decor' },
  pot: { name: 'Clay Flower Pot', icon: '🪴', cat: 'decor' },
  lights: { name: 'Fairy Lights', icon: '✨', cat: 'decor' },
  pillow: { name: 'Heart Pillow', icon: '💗', cat: 'decor' },
  chime: { name: 'Sea-Glass Wind Chime', icon: '🎐', cat: 'decor' },
  lamp: { name: 'Bunny Moon Lamp', icon: '💡', cat: 'decor' },
  shelf: { name: 'Little Bookshelf', icon: '📚', cat: 'decor' },
} satisfies Record<string, ItemDef>;
export type ItemId = keyof typeof ITEMS;
export const item = (id: string): ItemDef => (ITEMS as Record<string, ItemDef>)[id] ?? { name: id, icon: '❔', cat: 'res' };
export const GIFTABLE = (id: string) => ['treat', 'plush', 'gift'].includes(item(id).cat) || ['flower', 'nectar', 'pearl', 'seaGlass', 'crystal'].includes(id);

/* ---------------- tools ---------------- */
export type ToolId = 'hatchet' | 'pickaxe' | 'sickle' | 'can' | 'net' | 'rod' | 'hammer' | 'brush';
export interface ToolDef { name: string; icon: string; does: string; tiered?: boolean }
export const TOOLS: Record<ToolId, ToolDef> = {
  hatchet: { name: 'Hatchet', icon: '🪓', does: 'Chop trees (upgrade at the anvil)', tiered: true },
  pickaxe: { name: 'Pickaxe', icon: '⛏️', does: 'Mine stone, quartz and crystals', tiered: true },
  sickle: { name: 'Sickle', icon: '🌾', does: 'Harvest silk, moss, cotton and nectar', tiered: true },
  can: { name: 'Watering Can', icon: '🪴', does: 'Plant and water saplings' },
  net: { name: 'Butterfly Net', icon: '🥅', does: 'Catch butterflies and fireflies' },
  rod: { name: 'Fishing Rod', icon: '🎣', does: 'Fish koi in ponds, streams and the lagoon' },
  hammer: { name: 'Blueprint Hammer', icon: '🔨', does: 'Build and expand the house anywhere' },
  brush: { name: 'Velvet Paintbrush', icon: '🖌️', does: 'Dye the walls and floors of a room' },
};
export const TOOL_ORDER: ToolId[] = ['hatchet', 'pickaxe', 'sickle', 'net', 'rod', 'can', 'hammer', 'brush'];
export const TIERS = [
  { name: 'Wood', color: 0xc08a5e, css: '#c08a5e' },
  { name: 'Cloudstone', color: 0xe4def0, css: '#e4def0' },
  { name: 'Sakura-Azure', color: 0x9fd8ff, css: '#ff9ec4' },
  { name: 'Rose-Gold', color: 0xf2b8a0, css: '#f2b8a0' },
  { name: 'Starlight', color: 0xfff0b0, css: '#fff0b0' },
] as const;

export type Cost = Partial<Record<ItemId, number>>;
export const canAfford = (inv: Record<string, number> | undefined, c: Cost) => Object.entries(c).every(([k, v]) => (inv?.[k] ?? 0) >= (v ?? 0));
export const costText = (c: Cost) => Object.entries(c).map(([k, v]) => `${item(k).icon}${v}`).join(' ');
export const negate = (c: Cost) => Object.fromEntries(Object.entries(c).map(([k, v]) => [`inv.${k}`, -(v ?? 0)]));
/** Craft Together: 25% off every ingredient */
export const together = (c: Cost): Cost => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, Math.max(1, Math.ceil((v ?? 0) * 0.75))]));
