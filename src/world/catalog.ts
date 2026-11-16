// House rooms, pets and couple-action text. Items, tools and costs live in src/data/items.ts (re-exported here).
import type { Cost } from '../data/items';
export { ITEMS, TOOLS, TOOL_ORDER, TIERS, item, canAfford, costText, negate, together, GIFTABLE, type ToolId, type ItemId, type Cost } from '../data/items';

export type RoomType = 'bedroom' | 'kitchen' | 'greenhouse' | 'pool' | 'cinema' | 'observatory' | 'cuddle' | 'nursery' | 'gallery' | 'rooftop' | 'living' | 'music';
export const ROOMS: Record<RoomType, { name: string; icon: string; cost: Cost; floor: number; wall: number; blurb: string }> = {
  bedroom: { name: 'Stargazing Bedroom', icon: '🛏️', cost: { wood: 8, stone: 5 }, floor: 0xc99a7a, wall: 0xf3d6dc, blurb: 'Canopy bed, fairy lights, plushie shelf, wardrobe mirror' },
  living: { name: 'Cozy Living Room', icon: '🛋️', cost: { wood: 10, stone: 6, silk: 2 }, floor: 0xd9b38c, wall: 0xfbe4d8, blurb: 'Big squishy sofa, fireplace, blanket basket, board games' },
  kitchen: { name: 'Dream Kitchen', icon: '🍰', cost: { wood: 12, stone: 8, flower: 2 }, floor: 0xe8d2b8, wall: 0xfde7d2, blurb: 'A kitchen hearth for treats, a table for two' },
  greenhouse: { name: 'Glass Sakura Conservatory', icon: '🌸', cost: { wood: 10, stone: 6, flower: 6 }, floor: 0x9fc98a, wall: 0xd8f3e4, blurb: 'Glass roof, flower beds, a sakura sapling, loveseat swing' },
  cuddle: { name: 'Plushie Loft', icon: '🧸', cost: { wood: 8, flower: 4, bug: 2 }, floor: 0xf7c9da, wall: 0xffe3ee, blurb: 'Pillow fort and squishy Kuro, Mochi & Coco' },
  nursery: { name: 'Pet Nursery & Playroom', icon: '🐾', cost: { wood: 10, stone: 4, fish: 2 }, floor: 0xf1dfb0, wall: 0xfff2cf, blurb: 'Pet beds, treat bowls, toy tunnel, grooming station' },
  pool: { name: 'Indoor Heated Swimming Pool', icon: '🏊', cost: { stone: 12, brick: 4, seaGlass: 3, pearl: 1 }, floor: 0xdfeef0, wall: 0xcdeef2, blurb: 'Warm turquoise pool, heart floaties, steamy jacuzzi' },
  cinema: { name: 'Private Mini-Cinema', icon: '🎬', cost: { wood: 10, silk: 3, crystal: 2 }, floor: 0x4a1d33, wall: 0x6b2547, blurb: 'Projector screen, beanbags, popcorn, two-player arcade' },
  observatory: { name: 'Stargazing Observatory', icon: '🔭', cost: { azureWood: 8, moonstone: 2, crystal: 2 }, floor: 0x37406b, wall: 0x2b3256, blurb: 'Glass dome, brass telescope, piano, vinyl player' },
  music: { name: 'Acoustic Music Corner', icon: '🎸', cost: { sakuraWood: 6, azureWood: 4, sap: 2 }, floor: 0xb98a63, wall: 0xf1dcf2, blurb: 'Guitar, ukulele, record crate, a piano by the window' },
  gallery: { name: 'Our Photo Memory Gallery', icon: '🖼️', cost: { wood: 10, stone: 8, crystal: 3 }, floor: 0xd9c2a5, wall: 0xf4e8dc, blurb: 'Framed photos, milestone trophies, wishlist wall' },
  rooftop: { name: 'Secret Rooftop Hideout', icon: '🏮', cost: { wood: 12, sakuraWood: 4, shard: 2 }, floor: 0xa9744f, wall: 0x8a5a3c, blurb: 'Lantern deck, hammock, wish jar' },
};

export type Side = 'right' | 'left' | 'back' | 'front' | 'up';
export const SIDES: { id: Side; label: string; d: [number, number, number] }[] = [
  { id: 'right', label: 'Right wing', d: [1, 0, 0] }, { id: 'left', label: 'Left wing', d: [-1, 0, 0] },
  { id: 'back', label: 'Back wing', d: [0, -1, 0] }, { id: 'front', label: 'Front wing', d: [0, 1, 0] }, { id: 'up', label: 'Upper floor', d: [0, 0, 1] },
];
export interface RoomCell { id: string; type: RoomType; gx: number; gz: number; lv: number; by: string; at: number }

export type PetId = 'pup' | 'bunny' | 'kitten' | 'panda';
export const PETS: Record<PetId, { name: string; icon: string; cost: Cost; body: number; ear: number }> = {
  pup: { name: 'Cloud Pup', icon: '🐶', cost: { crystal: 2, fish: 1 }, body: 0xffffff, ear: 0xcfe3ff },
  bunny: { name: 'Mochi Bunny', icon: '🐰', cost: { crystal: 2, flower: 3 }, body: 0xffe1ec, ear: 0xff9ec4 },
  kitten: { name: 'Starlight Kitten', icon: '🐱', cost: { crystal: 3, fish: 2 }, body: 0x4b4a6e, ear: 0xffd27a },
  panda: { name: 'Mini Red Panda', icon: '🦊', cost: { crystal: 3, bug: 2 }, body: 0xd8693a, ear: 0x3b2320 },
};

export const CABLE_COST: Cost = { wood: 6, stone: 3 };
export const WHISPERS = [
  'psst… you look extra cute today', 'I would share my last momo with you (maybe)', 'guess who is my favourite person? 👀',
  'you are so annoying… annoyingly adorable', 'race you to the lagoon, loser makes cocoa', 'I like you a normal amount (a lot)',
  'stop being so pretty, I cannot focus on chopping', 'you owe me one hug, collecting it now',
];
/** wall & floor swatches for the Velvet Paintbrush */
export const PAINTS = [0xf3d6dc, 0xffe3ee, 0xfde7d2, 0xd8f3e4, 0xcdeef2, 0xe6dcfa, 0xfff6e8, 0x6b2547, 0x2b3256, 0xc99a7a, 0x9fc98a, 0xb98a63];
