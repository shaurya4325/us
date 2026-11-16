import type { Who } from './people';

export type MoodId = 'happy' | 'cute' | 'chill' | 'sleepy' | 'sad' | 'dramatic';

export interface Mood { id: MoodId; label: string; emoji: string; fx: string; tint: string; priority?: boolean }

export const MOODS: Mood[] = [
  { id: 'happy', label: 'Radiant & Happy', emoji: '✨', fx: 'fx-sparkle', tint: '#F5A3C7' },
  { id: 'cute', label: 'Cute & Playful', emoji: '🫧', fx: 'fx-bubble', tint: '#FF7DB5' },
  { id: 'chill', label: 'Chill / Normal', emoji: '🌙', fx: 'fx-velvet', tint: '#C27BA0' },
  { id: 'sleepy', label: 'Sleepy / Low Battery', emoji: '😴', fx: 'fx-stars', tint: '#B9A3E8' },
  { id: 'sad', label: 'Sad / Bothered', emoji: '🌧️', fx: 'fx-rain', tint: '#8FA8D9', priority: true },
  { id: 'dramatic', label: 'Dramatic / Chaotic', emoji: '🎭', fx: 'fx-neon', tint: '#FF3E8A' },
];
export const moodById = (id?: string) => MOODS.find((m) => m.id === id) ?? MOODS[2];

const P = (who: Who, mood: MoodId, n: number) =>
  Array.from({ length: n }, (_, i) => `${import.meta.env.BASE_URL}photos/${who}/${who}-${mood}-${i + 1}.webp`);

// Local photos in public/photos/<who>/. Add files + bump the counts to grow a mood.
export const MOOD_PHOTOS: Record<Who, Partial<Record<MoodId, string[]>>> = {
  arushi: {
    happy: P('arushi', 'happy', 2), cute: P('arushi', 'cute', 2), chill: P('arushi', 'chill', 2),
    sleepy: P('arushi', 'sleepy', 1), sad: P('arushi', 'sad', 1), dramatic: P('arushi', 'dramatic', 2),
  },
  shaurya: {}, // waiting for Shaurya's photos; falls back to his in-app cutout / monogram
};

/** Photo for a person's mood with clean fallbacks: exact mood → chill → any photo → uploaded cutout → null (monogram). */
export function moodPhoto(who: Who, mood: string | undefined, cutout?: string, seed = 0): string | null {
  const set = MOOD_PHOTOS[who];
  const list = set[mood as MoodId] ?? set.chill ?? Object.values(set).flat();
  if (list && list.length) return list[seed % list.length];
  return cutout ?? null;
}
