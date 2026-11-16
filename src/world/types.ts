import type * as THREE from 'three';
import type { PetId, RoomCell, ToolId } from './catalog';
import type { Who } from '../config/people';

export interface Interactable { id: string; x: number; z: number; y?: number; r: number; label: string; icon: string; tool?: ToolId; needs?: ToolId }

export interface WorldDoc {
  inv?: Record<string, number>;
  tools?: Partial<Record<ToolId, boolean>>;
  rooms?: Record<string, RoomCell>;
  nodes?: Record<string, number>;           // node id -> respawn time (ms)
  planted?: Record<string, { x: number; z: number; at: number; by: Who }>;
  cables?: Record<string, { at: number; by: Who }>;
  pets?: Partial<Record<PetId, { owner: Who; at: number }>>;
  capes?: Partial<Record<Who, number>>;
  dishes?: Record<string, number>;
  wishes?: Record<string, { text: string; by: Who; at: number }>;
  stats?: Record<string, number>;
}

/** what a scene can ask of the engine */
export interface EngineAPI {
  me: Who; world: WorldDoc; now: () => number;
  toolFor: (t?: ToolId) => boolean;
  give: (res: Record<string, number>, x: number, y: number, z: number, label?: string) => void;
  patch: (fields: Record<string, any>, incs?: Record<string, number>) => void;
  fx: (kind: 'leaf' | 'blossom' | 'spark' | 'stone' | 'crystal' | 'splash' | 'heart' | 'gold', x: number, y: number, z: number, n?: number) => void;
  sound: (s: string) => void;
  ui: (panel: string, data?: any) => void;
  toast: (title: string, body?: string) => void;
  swing: () => void; hitStop: (ms: number) => void; shake: (a: number) => void;
  play: (anim: string, secs: number) => void;
  enter: () => void; exit: () => void;
  player: { x: number; y: number; z: number };
  synergy: () => number;
}

export interface SceneAPI {
  kind: 'over' | 'inside';
  scene: THREE.Scene;
  spawn: (who: Who) => [number, number, number];
  /** floor height under (x,z) reachable from height y, or null if blocked */
  ground: (x: number, z: number, y: number) => number | null;
  interactables: (px: number, pz: number) => Interactable[];
  interact: (id: string, eng: EngineAPI) => void;
  setWorld: (w: WorldDoc, eng: EngineAPI) => void;
  update: (dt: number, t: number, eng: EngineAPI) => void;
  levelOf?: (y: number) => number;
  dispose: () => void;
}
