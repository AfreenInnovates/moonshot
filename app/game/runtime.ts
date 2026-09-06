import * as THREE from "three";
import { THIEF_SPAWN, type RoomId } from "./level";

/**
 * Frame deltas can spike hard (tab in the background, a long GC pause). Feeding
 * those straight into movement teleports bodies through walls, so every system
 * clamps the delta it integrates with.
 */
export const clampDt = (dt: number) => Math.min(dt, 0.05);

/**
 * Per-frame world state that must not trigger React renders.
 * Systems write here; HUD-facing values are pushed into the zustand store at a
 * throttled rate. When SpacetimeDB lands, this is the layer that gets replaced
 * by replicated rows instead of local simulation.
 */
export const runtime = {
  thief: new THREE.Vector3(...THIEF_SPAWN),
  thiefYaw: 0,
  room: "outside" as RoomId,
  /** live guard transforms, keyed by patrol id */
  guards: {} as Record<string, { pos: THREE.Vector3; yaw: number }>,
  /** live yaw of each security camera, keyed by id */
  camYaw: {} as Record<string, number>,
  seenBy: new Set<string>(),
  /** live alarm level 0..100, mirrored into the store at ~12hz */
  alert: 0,
  /** seconds (perf clock) the thief was last in someone's line of sight */
  lastSeen: -100,
  /** targets streamed in from the thief's client (spectator clients only) */
  netThief: null as null | { x: number; y: number; z: number; yaw: number },
  netGuards: {} as Record<string, [number, number, number]>,
  /** what pressing E - or, for a vent, Space - would do right now */
  useTarget: null as null | {
    kind: "keypad" | "alarm" | "door" | "vent";
    id: string;
  },
  lastTrapHit: -10,

  /* --- input the thief's client reads, whatever device produced it ------- */
  /** perf-clock stamp of the last jump press, consumed by the next frame */
  jumpAt: -1e9,
  /** on-screen stick, -1..1 on each axis; zero when nothing is touching it */
  touchMove: { x: 0, y: 0 },
  /** look delta in pixels accumulated since the last frame drained it */
  touchLook: { dx: 0, dy: 0 },
};

export function guardState(id: string) {
  let g = runtime.guards[id];
  if (!g) {
    g = { pos: new THREE.Vector3(), yaw: 0 };
    runtime.guards[id] = g;
  }
  return g;
}
