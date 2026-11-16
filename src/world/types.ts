import type * as THREE from 'three';
import type { PetId, RoomCell, ToolId } from './catalog';
import type { Who } from '../config/people';
import type { BiomeId, Surface } from '../data/biomes';
import type { CoopTasks } from './CoopTasks';

export interface Interactable { id: string; x: number; z: number; y?: number; r: number; label: string; icon: string; tool?: ToolId; needs?: ToolId; minTier?: number; hint?: string }

export interface Decor { item: string; s: 'over' | 'inside'; x: number; y: number; z: number; r: number; by: Who; at: number }
export interface WorldDoc {
  inv?: Record<string, number>;                 // the Shared Vault
  tools?: Partial<Record<ToolId, boolean>>;
  tiers?: Partial<Record<ToolId, number>>;      // 0 Wood … 4 Starlight
  rooms?: Record<string, RoomCell>;
  nodes?: Record<string, number>;               // node id -> respawn time (ms)
  planted?: Record<string, { x: number; z: number; at: number; by: Who }>;
  cables?: Record<string, { at: number; by: Who }>;
  pets?: Partial<Record<PetId, { owner: Who; at: number }>>;
  capes?: Partial<Record<Who, number>>;
  dishes?: Record<string, number>;
  wishes?: Record<string, { text: string; by: Who; at: number }>;
  stats?: Record<string, number>;
  // expansion
  stations?: Record<string, number>;            // placed functional blocks
  ruins?: Record<string, number>;               // unsealed structures
  chests?: Record<string, string | number>;     // two-key chests: day opened (+ "<id>First")
  lore?: Record<string, number>;
  bp?: Record<string, boolean>;                 // room blueprints unlocked
  bridges?: Record<string, number>;
  giants?: Record<string, { hp?: number; down?: number }>;
  quests?: Record<string, { p?: Record<string, number>; c?: Record<string, boolean> }>;
  visits?: Record<string, Partial<Record<BiomeId, boolean>>>;
  unlocks?: Record<string, boolean>;
  decor?: Record<string, Decor | null>;
  paint?: Record<string, { wall?: number; floor?: number }>;
  engraved?: Record<string, { item: string; at: number }>;
  giftbox?: Partial<Record<Who, Record<string, number>>>;
}

/** what a scene can ask of the engine */
export interface EngineAPI {
  me: Who; partnerName: string; world: WorldDoc; now: () => number; host: boolean;
  toolFor: (t?: ToolId) => boolean; tier: (t: ToolId) => number; held: () => ToolId | 'none';
  give: (res: Record<string, number>, x: number, y: number, z: number, label?: string) => void;
  patch: (fields: Record<string, any>, incs?: Record<string, number>) => void;
  quest: (ev: string, n?: number) => Record<string, number>;
  fx: (kind: 'leaf' | 'blossom' | 'spark' | 'stone' | 'crystal' | 'splash' | 'heart' | 'gold' | 'star', x: number, y: number, z: number, n?: number) => void;
  sound: (s: string, opt?: { vol?: number; rate?: number; delay?: number }) => void;
  ui: (panel: string, data?: any) => void;
  toast: (title: string, body?: string) => void;
  swing: () => void; hitStop: (ms: number) => void; shake: (a: number) => void;
  play: (anim: string, secs: number) => void;
  enter: () => void; exit: () => void;
  player: { x: number; y: number; z: number };
  partnerAt: { x: number; y: number; z: number; here: boolean };
  holding: () => boolean;
  synergy: () => number;
  coop: CoopTasks;
}

export interface SceneAPI {
  kind: 'over' | 'inside';
  scene: THREE.Scene;
  spawn: (who: Who) => [number, number, number];
  /** floor height under (x,z) reachable from height y, or null if blocked */
  ground: (x: number, z: number, y: number) => number | null;
  interactables: (px: number, pz: number, py: number, eng: EngineAPI) => Interactable[];
  interact: (id: string, eng: EngineAPI) => void;
  setWorld: (w: WorldDoc, eng: EngineAPI) => void;
  update: (dt: number, t: number, eng: EngineAPI) => void;
  surface: (x: number, z: number, y: number) => Surface;
  levelOf?: (y: number) => number;
  dispose: () => void;
}
