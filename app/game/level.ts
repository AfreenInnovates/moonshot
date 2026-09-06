export type Vec3 = [number, number, number];

/* ------------------------------------------------------------------ layout */

export type RoomId =
  | "outside"
  | "entry"
  | "lobby"
  | "wcorr"
  | "ecorr"
  | "sec"
  | "vault"
  | "annex";

export const WALL_T = 0.3;
export const ROOM_H = 3.8;

export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface RoomDef {
  id: RoomId;
  name: string;
  blurb: string;
  bounds: Bounds;
  /** contents stay hidden from spectators until the thief walks in */
  fog: boolean;
  floor: string;
  /**
   * Spectator camera pose for this room.
   *
   * For the three watchable rooms this sits *behind the door the thief walks in
   * through*, looking into the room along the same axis they walk. That is what
   * makes a callout mean anything: the spectator's screen-right is the thief's
   * right, so "LEFT" is the same left for both of them.
   *
   * All three are the same shot, 14 back and 19.3 up - about 54 degrees, 24
   * units out - so a spectator moved between rooms is not re-learning the view.
   *
   * Two rules when touching these. `pos` and `target` must share the axis the
   * thief walks along (equal z for the side rooms, equal x for the lobby): any
   * yaw between them twists left and right apart. And `target` is the *centre
   * of the room*, not the doorway - aiming at the door instead pushes the room
   * a fifth of a frame off-centre and leaves dead space down one side.
   */
  cam: { pos: Vec3; target: Vec3 };
}

/**
 * Facility floorplan, seen from above (+Z is south / towards the street):
 *
 *        ┌──────────────┐        ┌──────────────┐
 *        │ SECURITY     │──┐  ┌──│ VAULT        │   (vault annex sticks out
 *        │              │  │  │  │              │    through the north wall)
 *        └──────────────┘  │  │  └──────────────┘
 *                       ┌──┴──┴──┐
 *                       │ LOBBY  │
 *                       └───┬────┘
 *                        ENTRANCE
 */
export const ROOMS: RoomDef[] = [
  {
    id: "outside",
    name: "Street",
    blurb: "Approach. The facility entrance is straight ahead.",
    bounds: { minX: -14, maxX: 14, minZ: 10.5, maxZ: 26 },
    fog: false,
    floor: "#2c2f33",
    cam: { pos: [0, 15, 33], target: [0, 2, 3] },
  },
  {
    id: "entry",
    name: "Entrance",
    blurb: "Glass doors into the lobby.",
    bounds: { minX: -3, maxX: 3, minZ: 7, maxZ: 10.5 },
    fog: false,
    floor: "#6e6a63",
    cam: { pos: [0, 11, 26], target: [0, 1.6, 6] },
  },
  {
    id: "lobby",
    name: "Lobby",
    blurb: "Central area. Reception, and a door to each wing.",
    bounds: { minX: -5.5, maxX: 5.5, minZ: -7, maxZ: 7 },
    fog: true,
    floor: "#7b7770",
    // entered from the entrance hall, due south
    cam: { pos: [0, 19.9, 14], target: [0, 0.6, 0] },
  },
  {
    id: "wcorr",
    name: "West passage",
    blurb: "Short corridor to the security room.",
    bounds: { minX: -8, maxX: -5.5, minZ: 1, maxZ: 4 },
    fog: false,
    floor: "#6e6a63",
    cam: { pos: [-7, 9, 18], target: [-7, 1.4, 2 ] },
  },
  {
    id: "ecorr",
    name: "East passage",
    blurb: "Short corridor to the vault room.",
    bounds: { minX: 5.5, maxX: 8, minZ: 1, maxZ: 4 },
    fog: false,
    floor: "#6e6a63",
    cam: { pos: [7, 9, 18], target: [7, 1.4, 2] },
  },
  {
    id: "sec",
    name: "Security Room",
    blurb: "Monitors, cameras, controls - and the keycard.",
    bounds: { minX: -22, maxX: -8, minZ: -7, maxZ: 7 },
    fog: true,
    floor: "#78746d",
    // door is in the east wall: look west, the way the thief walks in
    cam: { pos: [-1, 19.9, 0], target: [-15, 0.6, 0] },
  },
  {
    id: "vault",
    name: "Vault Room",
    blurb: "Main objective. High security.",
    bounds: { minX: 8, maxX: 22, minZ: -7, maxZ: 7 },
    fog: true,
    floor: "#78746d",
    // entered through the west wall: look east, the way the thief walks in
    cam: { pos: [1, 19.9, 0], target: [15, 0.6, 0] },
  },
  {
    id: "annex",
    name: "Vault",
    blurb: "Behind the round door.",
    bounds: { minX: 13, maxX: 17, minZ: -10, maxZ: -7 },
    fog: false,
    floor: "#5d5a55",
    cam: { pos: [15, 9, 14], target: [15, 1.4, -7] },
  },
];

export const roomById = (id: RoomId) => ROOMS.find((r) => r.id === id)!;

/** The rooms a spectator can be posted to. */
export const WATCHED_ROOMS: RoomId[] = ["lobby", "sec", "vault"];

/**
 * Which spectator has the thief's ear, or null when nobody does.
 *
 * A spectator is on air exactly while the thief is standing in the room they
 * were posted to - which is exactly while they can see the thief at all. Three
 * people calling "LEFT" about three different rooms is worse than silence, so
 * only one of them is ever live, and someone watching an empty room cannot
 * steer a thief they are not looking at.
 *
 * The corridors, the entrance hall and the street belong to nobody on purpose:
 * they are a few seconds of walking with nothing in them, and folding them into
 * a neighbour would put a spectator on air over a room the thief has not
 * reached yet.
 */
export const commandChannel = (thiefRoom: RoomId): RoomId | null =>
  WATCHED_ROOMS.includes(thiefRoom) ? thiefRoom : null;

/**
 * Can this spectator talk to the thief right now?
 *
 * A crew of one is always on air - there is nobody to talk over, and they are
 * following the thief anyway. With a real crew, only the room the thief is
 * standing in has the channel.
 */
export function channelOpen(
  thiefRoom: RoomId,
  watching: RoomId | null,
  soleSpectator: boolean,
): boolean {
  if (soleSpectator) return true;
  return watching !== null && commandChannel(thiefRoom) === watching;
}

export function roomAt(x: number, z: number): RoomId {
  for (const r of ROOMS) {
    if (r.id === "outside") continue;
    const b = r.bounds;
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return r.id;
  }
  return "outside";
}

/* ------------------------------------------------------------------- walls */

export interface Opening {
  /** position along the wall axis */
  at: number;
  width: number;
  /** clear height of the hole; wall above it becomes a lintel */
  height?: number;
}

export interface WallDef {
  id: string;
  /** "x" walls run along X at a fixed Z, "z" walls run along Z at a fixed X */
  axis: "x" | "z";
  fixed: number;
  from: number;
  to: number;
  openings?: Opening[];
  height?: number;
  /** hidden in spectator views so the building reads as a cutaway */
  cutaway?: boolean;
  color?: string;
}

const OUT = "#6c706d";
const IN = "#8f8b83";

export const WALLS: WallDef[] = [
  // exterior shell
  {
    id: "w-north",
    axis: "x",
    fixed: -7,
    from: -22.15,
    to: 22.15,
    color: OUT,
    // the round vault door lives in this hole
    openings: [{ at: 15, width: 3.6, height: 2.9 }],
  },
  { id: "w-west", axis: "z", fixed: -22, from: -7.15, to: 7.15, color: OUT },
  { id: "w-east", axis: "z", fixed: 22, from: -7.15, to: 7.15, color: OUT },
  {
    id: "w-south-w",
    axis: "x",
    fixed: 7,
    from: -22.15,
    to: -3,
    color: OUT,
    cutaway: true,
  },
  {
    id: "w-south-e",
    axis: "x",
    fixed: 7,
    from: 3,
    to: 22.15,
    color: OUT,
    cutaway: true,
  },
  { id: "w-entry-w", axis: "z", fixed: -3, from: 7, to: 10.65, color: OUT },
  { id: "w-entry-e", axis: "z", fixed: 3, from: 7, to: 10.65, color: OUT },
  {
    id: "w-entry-s",
    axis: "x",
    fixed: 10.5,
    from: -3.15,
    to: 3.15,
    height: 3.2,
    color: OUT,
    openings: [{ at: 0, width: 3.0, height: 2.6 }],
  },

  // vault annex, poking out through the north wall
  { id: "w-annex-w", axis: "z", fixed: 13, from: -10.15, to: -7, color: OUT },
  { id: "w-annex-e", axis: "z", fixed: 17, from: -10.15, to: -7, color: OUT },
  { id: "w-annex-n", axis: "x", fixed: -10, from: 12.85, to: 17.15, color: OUT },

  // interior partitions - each pair frames a short connecting passage
  {
    id: "w-sec-e",
    axis: "z",
    fixed: -8,
    from: -7,
    to: 7,
    color: IN,
    openings: [{ at: 2.5, width: 1.6, height: 2.4 }],
  },
  {
    id: "w-lobby-w",
    axis: "z",
    fixed: -5.5,
    from: -7,
    to: 7,
    color: IN,
    openings: [{ at: 2.5, width: 1.6, height: 2.4 }],
  },
  {
    id: "w-lobby-e",
    axis: "z",
    fixed: 5.5,
    from: -7,
    to: 7,
    color: IN,
    openings: [{ at: 2.5, width: 1.6, height: 2.4 }],
  },
  {
    id: "w-vault-w",
    axis: "z",
    fixed: 8,
    from: -7,
    to: 7,
    color: IN,
    openings: [{ at: 2.5, width: 1.6, height: 2.4 }],
  },
];

/** Solid structure filling the gaps either side of the passages. */
export const MASSES: { x1: number; z1: number; x2: number; z2: number }[] = [
  { x1: -8, z1: -7.15, x2: -5.5, z2: 1 },
  { x1: -8, z1: 4, x2: -5.5, z2: 7.15 },
  { x1: 5.5, z1: -7.15, x2: 8, z2: 1 },
  { x1: 5.5, z1: 4, x2: 8, z2: 7.15 },
];

/** Floor / ceiling slabs. Ceilings are dropped in the spectator views. */
export const SLABS: {
  id: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  color: string;
  ceiling?: boolean;
}[] = [
  { id: "main", x1: -22.15, z1: -7.15, x2: 22.15, z2: 7.15, color: "#7d7a73", ceiling: true },
  { id: "entry", x1: -3.15, z1: 7.15, x2: 3.15, z2: 10.65, color: "#6e6a63", ceiling: true },
  { id: "annex", x1: 12.85, z1: -10.15, x2: 17.15, z2: -7, color: "#5d5a55", ceiling: true },
];

/* ------------------------------------------------------------------- doors */

export interface DoorDef {
  id: string;
  label: string;
  room: RoomId;
  /** centre of the opening */
  at: Vec3;
  /** orientation of the wall the door sits in */
  axis: "x" | "z";
  width: number;
  height: number;
  color: string;
  /** hinge side, so two doors in one passage do not swing into each other */
  swing: 1 | -1;
  lock?: "keycard";
}

export const DOORS: DoorDef[] = [
  {
    id: "door-sec",
    label: "Security room door",
    room: "wcorr",
    at: [-8, 0, 2.5],
    axis: "z",
    width: 1.6,
    height: 2.4,
    color: "#4aa8ff",
    swing: 1,
  },
  {
    id: "door-vault",
    label: "Vault room door",
    room: "ecorr",
    at: [5.5, 0, 2.5],
    axis: "z",
    width: 1.6,
    height: 2.4,
    color: "#ffd23b",
    swing: -1,
    lock: "keycard",
  },
];

/* ----------------------------------------------------------------- markers */

export type Reveal = "spectator" | "discovery";

export type MarkerKind =
  | "camera"
  | "keypad"
  | "guard"
  | "health"
  | "vent"
  | "trap"
  | "alarm"
  | "valuables"
  | "keycard"
  | "note";

export interface MarkerDef {
  id: string;
  kind: MarkerKind;
  label: string;
  sub?: string;
  reveal: Reveal;
  room: RoomId;
  color: string;
  position: Vec3;
  labelOffset?: Vec3;
  rotationY?: number;
}

export const C = {
  red: "#ff3b47",
  yellow: "#ffd23b",
  blue: "#4aa8ff",
  green: "#39ff88",
  cyan: "#3bd8ff",
  lime: "#c8ff3b",
  pink: "#ff7ad9",
};

export interface CameraDef extends MarkerDef {
  kind: "camera";
  /** centre yaw the camera sweeps around; 0 looks down -Z */
  baseYaw: number;
  sweep: number;
  speed: number;
  pitch: number;
  range: number;
  fov: number;
}

export const CAMERAS: CameraDef[] = [
  {
    id: "lobby-cam",
    kind: "camera",
    label: "Camera (active)",
    reveal: "spectator",
    room: "lobby",
    color: C.red,
    position: [-4.9, 3.3, -6.5],
    labelOffset: [0, 0.75, 0],
    baseYaw: -2.5,
    sweep: 0.5,
    speed: 0.33,
    pitch: -0.42,
    range: 10,
    fov: 0.4,
  },
  {
    id: "sec-cam-a",
    kind: "camera",
    label: "Camera (active)",
    reveal: "spectator",
    room: "sec",
    color: C.red,
    position: [-9.2, 3.35, -6.5],
    labelOffset: [0, 0.75, 0],
    baseYaw: -2.35,
    sweep: 0.55,
    speed: 0.3,
    pitch: -0.4,
    range: 11,
    fov: 0.42,
  },
  {
    id: "sec-cam-b",
    kind: "camera",
    label: "Camera (hidden)",
    sub: "no status light",
    reveal: "discovery",
    room: "sec",
    color: C.red,
    position: [-21.3, 3.4, 5.9],
    labelOffset: [0, 0.75, 0],
    baseYaw: 0.75,
    sweep: 0.45,
    speed: 0.26,
    pitch: -0.38,
    range: 11,
    fov: 0.38,
  },
  {
    id: "vault-cam-a",
    kind: "camera",
    label: "Camera (active)",
    reveal: "spectator",
    room: "vault",
    color: C.red,
    position: [9.2, 3.35, -6.5],
    labelOffset: [0, 0.75, 0],
    baseYaw: 2.35,
    sweep: 0.55,
    speed: 0.31,
    pitch: -0.4,
    range: 11,
    fov: 0.42,
  },
  {
    id: "vault-cam-b",
    kind: "camera",
    label: "Camera (hidden)",
    sub: "no status light",
    reveal: "discovery",
    room: "vault",
    color: C.red,
    position: [21.3, 3.4, 5.9],
    labelOffset: [0, 0.75, 0],
    baseYaw: -0.75,
    sweep: 0.45,
    speed: 0.24,
    pitch: -0.38,
    range: 11,
    fov: 0.38,
  },
];

export const MARKERS: MarkerDef[] = [
  /* --- security room ------------------------------------------------ */
  {
    id: "keycard",
    kind: "keycard",
    label: "Keycard",
    sub: "opens the vault room door",
    reveal: "spectator",
    room: "sec",
    color: C.yellow,
    position: [-13.4, 0.95, -5.7],
    labelOffset: [0, 0.7, 0],
  },
  {
    id: "health",
    kind: "health",
    label: "Health pack",
    reveal: "spectator",
    room: "sec",
    color: C.green,
    position: [-20.6, 0.42, 2.4],
    labelOffset: [0, 0.75, 0],
  },
  {
    id: "sec-vent",
    kind: "vent",
    label: "Vent (alternate route)",
    sub: "thief can enter from here",
    reveal: "discovery",
    room: "sec",
    color: C.cyan,
    position: [-21.85, 2.9, -1.2],
    labelOffset: [0.25, 0.8, 0],
    rotationY: Math.PI / 2,
  },
  {
    id: "sec-trap",
    kind: "trap",
    label: "Floor trap (hidden)",
    sub: "-25 HP on contact",
    reveal: "discovery",
    room: "sec",
    color: C.red,
    position: [-16.8, 0.03, 3.1],
    labelOffset: [0, 1.5, 0],
  },
  {
    id: "alarm",
    kind: "alarm",
    label: "Alarm panel",
    sub: "can be disabled (E)",
    reveal: "discovery",
    room: "sec",
    color: C.red,
    position: [-12.2, 2.0, -6.8],
    labelOffset: [0, 0.85, 0],
  },
  {
    id: "note",
    kind: "note",
    label: "Vault code note",
    sub: "4-7-1-2",
    reveal: "discovery",
    room: "sec",
    color: C.pink,
    position: [-16.4, 0.83, -5.7],
    labelOffset: [0, 0.7, 0],
  },
  {
    id: "sec-network",
    kind: "note",
    label: "Network Node",
    sub: "Scan for intel",
    reveal: "discovery",
    room: "sec",
    color: C.cyan,
    position: [-11.0, 1.2, 0.0],
    labelOffset: [0, 0.7, 0],
  },
  {
    id: "sec-coffee",
    kind: "note",
    label: "Guard's Coffee",
    sub: "Scan for intel",
    reveal: "discovery",
    room: "sec",
    color: C.cyan,
    position: [-19.0, 1.0, -4.0],
    labelOffset: [0, 0.7, 0],
  },

  /* --- lobby -------------------------------------------------------- */
  {
    id: "bandages",
    kind: "health",
    label: "Bandages (collect)",
    sub: "+20 HP",
    reveal: "discovery",
    room: "lobby",
    color: C.green,
    position: [-1.1, 0.42, 4.3],
    labelOffset: [0, 0.7, 0],
  },
  {
    id: "lobby-guestlog",
    kind: "note",
    label: "Guest Log",
    sub: "Scan for intel",
    reveal: "discovery",
    room: "lobby",
    color: C.cyan,
    position: [0.0, 1.0, -2.0],
    labelOffset: [0, 0.7, 0],
  },
  {
    id: "lobby-terminal",
    kind: "note",
    label: "Reception Terminal",
    sub: "Scan for intel",
    reveal: "discovery",
    room: "lobby",
    color: C.cyan,
    position: [2.5, 1.1, 0.5],
    labelOffset: [0, 0.7, 0],
  },

  /* --- vault room --------------------------------------------------- */
  {
    id: "keypad",
    kind: "keypad",
    label: "Keypad (needs code)",
    reveal: "spectator",
    room: "vault",
    color: C.yellow,
    position: [17.6, 1.6, -6.75],
    labelOffset: [0.2, 0.85, 0],
  },
  {
    id: "vault-trap",
    kind: "trap",
    label: "Floor trap (hidden)",
    sub: "-25 HP on contact",
    reveal: "discovery",
    room: "vault",
    color: C.red,
    position: [15, 0.03, 2.2],
    labelOffset: [0, 1.5, 0],
  },
  {
    id: "valuables",
    kind: "valuables",
    label: "Valuables (collect)",
    sub: "+150",
    reveal: "discovery",
    room: "vault",
    color: C.lime,
    position: [10.6, 0.86, 4.3],
    labelOffset: [0, 0.8, 0],
  },
  {
    id: "vault-loot",
    kind: "valuables",
    label: "Vault contents",
    sub: "+500 - the objective",
    reveal: "spectator",
    room: "vault",
    color: C.yellow,
    position: [15, 0.75, -8.6],
    labelOffset: [0, 1.0, 0],
  },
  {
    // The way out. Hidden until the spectator posted to the vault scans it, so
    // the run has a second job running alongside the keycard: the thief cannot
    // leave this way until their crew has found the hatch for them.
    id: "vault-vent",
    kind: "vent",
    label: "Extraction vent",
    sub: "jump in to get out",
    reveal: "discovery",
    room: "vault",
    color: C.cyan,
    position: [21.85, 1.05, 2.0],
    labelOffset: [-0.4, 0.9, 0],
    rotationY: -Math.PI / 2,
  },
  {
    id: "vault-deposit-box",
    kind: "note",
    label: "Safe Deposit Box",
    sub: "Scan for intel",
    reveal: "discovery",
    room: "vault",
    color: C.cyan,
    position: [12.0, 1.0, -2.0],
    labelOffset: [0, 0.7, 0],
  },
];

/* ------------------------------------------------------------------ guards */

export interface PatrolDef {
  id: string;
  room: RoomId;
  path: [number, number][];
  vision: { range: number; fov: number };
}

export const PATROLS: PatrolDef[] = [
  {
    id: "guard-sec",
    room: "sec",
    path: [
      [-18.5, -2.5],
      [-18.5, 4.5],
      [-10.5, 4.5],
      [-10.5, -2.5],
    ],
    vision: { range: 7, fov: 0.6 },
  },
  {
    id: "guard-vault",
    room: "vault",
    path: [
      [11.5, -3],
      [19.5, -3],
      [19.5, 3.5],
      [11.5, 3.5],
    ],
    vision: { range: 7, fov: 0.6 },
  },
];

export const GUARD_LABEL = "Guard (patrolling)";

/* ------------------------------------------------------------------ player */

/** The thief starts on the street, outside the building. */
export const THIEF_SPAWN: Vec3 = [0, 1.1, 15.5];

/** Reaching this again with the loot ends the run. */
export const ESCAPE_Z = 13.5;

export function isRevealed(
  reveal: Reveal,
  view: string,
  discovered: boolean,
): boolean {
  if (view === "thief") return false;
  if (reveal === "spectator") return true;
  // discovery-tier markers stay tagged in the plain spectator view once found
  return view === "discovery" || discovered;
}
