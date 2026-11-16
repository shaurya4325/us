// Everything buildable, craftable and adoptable in the world. Costs are shared between both players.
export type Res = 'wood' | 'stone' | 'crystal' | 'flower' | 'fish' | 'bug';
export type Cost = Partial<Record<Res, number>>;
export const RES_ICON: Record<Res, string> = { wood: '🪵', stone: '🪨', crystal: '💎', flower: '🌼', fish: '🐟', bug: '🦋' };

export type ToolId = 'hatchet' | 'pickaxe' | 'can' | 'net' | 'rod';
export const TOOLS: Record<ToolId, { name: string; icon: string; cost: Cost; does: string }> = {
  hatchet: { name: 'Rose-Gold Hatchet', icon: '🪓', cost: { wood: 3, stone: 2 }, does: 'Chop trees 2× faster' },
  pickaxe: { name: 'Starlight Pickaxe', icon: '⛏️', cost: { wood: 4, stone: 3 }, does: 'Mine stone fast, unlocks rose-crystals' },
  can: { name: 'Meadow Watering Can & Trowel', icon: '🪴', cost: { wood: 3, flower: 2 }, does: 'Plant saplings and flowers' },
  net: { name: 'Butterfly Net', icon: '🥅', cost: { wood: 4, flower: 3 }, does: 'Catch butterflies and fireflies' },
  rod: { name: 'Bamboo Fishing Rod', icon: '🎣', cost: { wood: 5, bug: 1 }, does: 'Fish koi from the pond' },
};

export type RoomType = 'bedroom' | 'kitchen' | 'greenhouse' | 'pool' | 'cinema' | 'observatory' | 'cuddle' | 'nursery' | 'gallery' | 'rooftop';
export const ROOMS: Record<RoomType, { name: string; icon: string; cost: Cost; floor: number; wall: number; blurb: string }> = {
  bedroom: { name: 'Cozy Starter Bedroom', icon: '🛏️', cost: { wood: 8, stone: 5 }, floor: 0xc99a7a, wall: 0xf3d6dc, blurb: 'Canopy bed, fairy lights, plushie shelf, wardrobe mirror' },
  kitchen: { name: "Couple's Kitchen & Bakery", icon: '🍰', cost: { wood: 12, stone: 8, flower: 2 }, floor: 0xe8d2b8, wall: 0xfde7d2, blurb: 'Cook momos, cocoa, strawberry cake and ramen together' },
  greenhouse: { name: 'Botanical Glass Greenhouse', icon: '🌿', cost: { wood: 10, stone: 6, flower: 6 }, floor: 0x9fc98a, wall: 0xd8f3e4, blurb: 'Glass roof, flower beds, hanging vines, swinging loveseat' },
  pool: { name: 'Glass-Roof Pool & Spa', icon: '🏊', cost: { wood: 10, stone: 14, crystal: 2 }, floor: 0xdfeef0, wall: 0xcdeef2, blurb: 'Turquoise pool, heart floaties, steamy jacuzzi' },
  cinema: { name: 'Velvet Cinema & Arcade Den', icon: '🎬', cost: { wood: 14, stone: 6, crystal: 2 }, floor: 0x4a1d33, wall: 0x6b2547, blurb: 'Projector screen, beanbags, popcorn, two-player table' },
  observatory: { name: 'Stargazing Observatory & Studio', icon: '🔭', cost: { wood: 12, stone: 10, crystal: 4 }, floor: 0x37406b, wall: 0x2b3256, blurb: 'Glass dome, brass telescope, piano, vinyl player' },
  cuddle: { name: 'Cuddle Corner Sanctuary', icon: '🧸', cost: { wood: 8, flower: 4, bug: 2 }, floor: 0xf7c9da, wall: 0xffe3ee, blurb: 'Pillow fort and squishy Kuro, Mochi & Coco' },
  nursery: { name: 'Pet Nursery & Playroom', icon: '🐾', cost: { wood: 10, stone: 4, fish: 2 }, floor: 0xf1dfb0, wall: 0xfff2cf, blurb: 'Pet beds, treat bowls, toy tunnel, grooming station' },
  gallery: { name: '"Until We Marry" Memory Gallery', icon: '🖼️', cost: { wood: 10, stone: 8, crystal: 3 }, floor: 0xd9c2a5, wall: 0xf4e8dc, blurb: 'Framed photos, milestone trophies, wishlist wall' },
  rooftop: { name: 'Secret Rooftop Hideout', icon: '🏮', cost: { wood: 14, stone: 6, crystal: 3, flower: 3 }, floor: 0xa9744f, wall: 0x8a5a3c, blurb: 'Lantern deck, hammock, wish jar' },
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
export const DISHES = [
  { id: 'momos', name: 'Momos', icon: '🥟' }, { id: 'cocoa', name: 'Hot Cocoa', icon: '☕' },
  { id: 'cake', name: 'Strawberry Cake', icon: '🍰' }, { id: 'ramen', name: 'Ramen', icon: '🍜' },
];
export const WHISPERS = [
  'psst… you look extra cute today', 'I would share my last momo with you (maybe)', 'guess who is my favourite person? 👀',
  'you are so annoying… annoyingly adorable', 'race you to the pond, loser makes cocoa', 'I like you a normal amount (a lot)',
  'stop being so pretty, I cannot focus on chopping', 'you owe me one hug, collecting it now',
];

export const canAfford = (inv: Record<string, number> | undefined, c: Cost) => Object.entries(c).every(([k, v]) => (inv?.[k] ?? 0) >= (v ?? 0));
export const costText = (c: Cost) => Object.entries(c).map(([k, v]) => `${RES_ICON[k as Res]}${v}`).join(' ');
export const negate = (c: Cost) => Object.fromEntries(Object.entries(c).map(([k, v]) => [`inv.${k}`, -(v ?? 0)]));
