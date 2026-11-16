// The world's sound facade: every effect is a real recorded sample (src/audio/SoundEffectsManager.ts) and the
// soundtrack is the zone-crossfaded Kevin MacLeod set (src/audio/BiomeAudioManager.ts).
import { isMuted, musicLevel } from '../lib/fx';
import { playNote, playSfx, setSfxMuted, warmSfx } from '../audio/SoundEffectsManager';
import { setMusicMuted, setMusicVolume, setZone, unlockMusic } from '../audio/BiomeAudioManager';
import type { Zone } from '../data/biomes';

export const sound = (name: string, opt?: { vol?: number; rate?: number; delay?: number }) => { if (!isMuted()) playSfx(name, opt); };
export const note = (midi: number) => { if (!isMuted()) playNote(midi); };
/** music for a zone (biome, house, night) */
export const music = (z: Zone | null) => setZone(z);
/** call after the sound settings change */
export function syncMute() { setSfxMuted(isMuted()); const m = musicLevel(); setMusicMuted(m <= 0); setMusicVolume(m); }
let warmed = false;
export function unlockAudio() { if (!warmed) { warmed = true; syncMute(); warmSfx(); } unlockMusic(); }
syncMute();
