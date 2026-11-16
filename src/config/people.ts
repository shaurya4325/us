export type Who = 'shaurya' | 'arushi';
export interface Look { skin: number; hair: number; outfit: number; trim: number; cape: number; shoe: number; girl: boolean }
export const PEOPLE: Record<Who, { name: string; doc: string; initial: string; aura: string; look: Look }> = {
  shaurya: {
    name: 'Shaurya', doc: 'Dr. Shaurya', initial: 'S', aura: '#F5A3C7',
    look: { skin: 0xf2c6a5, hair: 0x2a1a17, outfit: 0x34406b, trim: 0xf5a3c7, cape: 0xe9b38f, shoe: 0x3b2a26, girl: false },
  },
  arushi: {
    name: 'Arushi', doc: 'Dr. Arushi', initial: 'A', aura: '#FF3E8A',
    look: { skin: 0xf6cfb3, hair: 0x2b1713, outfit: 0xff7db5, trim: 0xfff1f6, cape: 0xfff4f8, shoe: 0xd94f86, girl: true },
  },
};
/** outfit palettes the wardrobe mirror cycles through (synced) */
export const CAPES = [0xe9b38f, 0xfff4f8, 0xff7db5, 0x9fd8ff, 0xb9a3e8, 0xffd27a];
export const other = (w: Who): Who => (w === 'shaurya' ? 'arushi' : 'shaurya');
export const nameOf = (w?: string) => (w === 'shaurya' || w === 'arushi' ? PEOPLE[w].name : 'Someone');
