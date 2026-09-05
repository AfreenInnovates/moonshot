"use client";

import { create } from "zustand";
import type { RoomId } from "./level";
import type { Snapshot } from "./net/types";
import type { CommandCode } from "./commands";

export type ViewMode = "thief" | "spectator" | "discovery";

/**
 * How this client is taking part.
 * - solo: sandbox, you drive the thief and may look through all three views
 * - thief: multiplayer thief; this client also runs the simulation
 * - spectator: multiplayer spectator, posted to exactly one room
 */
export type GameMode =
  | { kind: "solo" }
  | { kind: "thief" }
  | { kind: "spectator"; watching: RoomId };

export const VIEWS: {
  id: ViewMode;
  n: string;
  title: string;
  blurb: string;
  color: string;
}[] = [
  {
    id: "thief",
    n: "1",
    title: "Thief View",
    blurb: "Only sees what's visible. Looks like a normal facility.",
    color: "#4aa8ff",
  },
  {
    id: "spectator",
    n: "2",
    title: "Spectator View",
    blurb: "Sees useful information and some interactable elements.",
    color: "#39ff88",
  },
  {
    id: "discovery",
    n: "3",
    title: "Spectator - Discovery Mode",
    blurb: "Reveals hidden threats, clues and collectibles.",
    color: "#ffd23b",
  },
];

export interface LogEntry {
  id: number;
  text: string;
  tone: "info" | "good" | "bad";
}

export interface CommandTransmission {
  id: number;
  code: CommandCode;
  by: string;
  at: number;
}

let logSeq = 0;

export interface GameState {
  mode: GameMode;
  view: ViewMode;
  hp: number;
  alarm: number;
  spotted: boolean;
  room: RoomId;
  /** thief position on the floorplan, for the minimap (~10hz) */
  thiefXZ: [number, number];
  /** authoritative thief facing, in radians; +Z points south on the map */
  thiefYaw: number;
  explored: Partial<Record<RoomId, boolean>>;
  discovered: Record<string, boolean>;
  collected: Record<string, boolean>;
  keycard: boolean;
  doorsOpen: Record<string, boolean>;
  alarmDisabled: boolean;
  codeFound: boolean;
  vaultOpen: boolean;
  escaped: boolean;
  loot: number;
  score: number;
  prompt: string | null;
  resetSeq: number;
  log: LogEntry[];
  lastCommand: CommandTransmission | null;

  setMode: (m: GameMode) => void;
  setView: (v: ViewMode) => void;
  setPrompt: (p: string | null) => void;
  setThiefXZ: (x: number, z: number) => void;
  enterRoom: (room: RoomId) => void;
  damage: (n: number, reason: string) => void;
  drain: (n: number) => void;
  heal: (n: number, reason: string) => void;
  setAlarm: (v: number, spotted: boolean) => void;
  discover: (id: string, label: string) => void;
  collect: (id: string, label: string, value?: number) => void;
  openDoor: (id: string) => void;
  disableAlarm: () => void;
  tryKeypad: () => void;
  escape: () => void;
  push: (text: string, tone?: LogEntry["tone"]) => void;
  receiveCommand: (code: CommandCode, by: string, at?: number) => void;
  reset: () => void;
  /** spectators mirror the thief client's world */
  applySnapshot: (s: Snapshot) => void;
}

const initial = {
  hp: 100,
  alarm: 0,
  spotted: false,
  room: "outside" as RoomId,
  thiefXZ: [0, 15.5] as [number, number],
  thiefYaw: 0,
  explored: { outside: true, entry: true } as Partial<Record<RoomId, boolean>>,
  discovered: {} as Record<string, boolean>,
  collected: {} as Record<string, boolean>,
  keycard: false,
  doorsOpen: {} as Record<string, boolean>,
  alarmDisabled: false,
  codeFound: false,
  vaultOpen: false,
  escaped: false,
  loot: 0,
  score: 0,
  prompt: null as string | null,
  log: [] as LogEntry[],
  lastCommand: null as CommandTransmission | null,
};

export const useGame = create<GameState>()((set, get) => ({
  mode: { kind: "solo" },
  view: "thief",
  resetSeq: 0,
  ...initial,

  setMode: (mode) =>
    set({
      mode,
      view:
        mode.kind === "thief"
          ? "thief"
          : mode.kind === "spectator"
            ? "spectator"
            : get().view,
    }),

  setView: (view) => set({ view }),

  setPrompt: (prompt) => set((s) => (s.prompt === prompt ? s : { prompt })),

  setThiefXZ: (x, z) =>
    set((s) =>
      Math.abs(s.thiefXZ[0] - x) < 0.05 && Math.abs(s.thiefXZ[1] - z) < 0.05
        ? s
        : { thiefXZ: [x, z] },
    ),

  push: (text, tone = "info") =>
    set((s) => {
      if (s.log[0]?.text === text && s.log[0]?.tone === tone) return s;
      return { log: [{ id: ++logSeq, text, tone }, ...s.log].slice(0, 6) };
    }),

  receiveCommand: (code, by, at = Date.now()) =>
    set({ lastCommand: { id: at, code, by, at } }),

  enterRoom: (room) => {
    if (get().room === room) return;
    const first = !get().explored[room];
    set((s) => ({ room, explored: { ...s.explored, [room]: true } }));
    if (first) {
      const named: Partial<Record<RoomId, string>> = {
        lobby: "the Lobby",
        sec: "the Security Room",
        vault: "the Vault Room",
        annex: "the vault",
      };
      if (named[room]) get().push(`Thief entered ${named[room]}`, "info");
    }
  },

  damage: (n, reason) => {
    const hp = Math.max(0, get().hp - n);
    set({ hp });
    get().push(`-${Math.round(n)} HP - ${reason}`, "bad");
    if (hp === 0) get().push("The thief is down. Run has ended.", "bad");
  },

  drain: (n) => {
    const before = get().hp;
    const hp = Math.max(0, before - n);
    set({ hp });
    if (hp === 0 && before > 0)
      get().push("The thief is down. Run has ended.", "bad");
  },

  heal: (n, reason) => {
    set({ hp: Math.min(100, get().hp + n) });
    get().push(`+${n} HP - ${reason}`, "good");
  },

  setAlarm: (alarm, spotted) => {
    const was = get().spotted;
    set({ alarm: Math.max(0, Math.min(100, alarm)), spotted });
    if (spotted && !was) get().push("The thief has been spotted!", "bad");
  },

  discover: (id, label) => {
    if (get().discovered[id]) return;
    set((s) => ({
      discovered: { ...s.discovered, [id]: true },
      score: s.score + 50,
      codeFound: s.codeFound || id === "note",
    }));
    get().push(`Discovered: ${label}`, "good");
    if (id === "note")
      get().push("Vault code relayed to the thief: 4-7-1-2", "good");
  },

  collect: (id, label, value = 0) => {
    if (get().collected[id]) return;
    set((s) => ({
      collected: { ...s.collected, [id]: true },
      loot: s.loot + value,
      score: s.score + value,
      keycard: s.keycard || id === "keycard",
    }));
    get().push(`Picked up: ${label}`, "good");
  },

  openDoor: (id) =>
    set((s) =>
      s.doorsOpen[id] ? s : { doorsOpen: { ...s.doorsOpen, [id]: true } },
    ),

  disableAlarm: () => {
    if (get().alarmDisabled) return;
    set((s) => ({ alarmDisabled: true, alarm: 0, score: s.score + 100 }));
    get().push("Alarm panel disabled. Cameras are blind now.", "good");
  },

  tryKeypad: () => {
    const s = get();
    if (s.vaultOpen) return;
    if (s.codeFound) {
      set({ vaultOpen: true, score: s.score + 250 });
      s.push("Keypad accepted 4-7-1-2. The vault is open.", "good");
    } else {
      s.push("Keypad locked. The code is written down somewhere.", "bad");
    }
  },

  escape: () => {
    if (get().escaped) return;
    set((s) => ({ escaped: true, score: s.score + 500 }));
    get().push("Out of the building with the loot. Run complete.", "good");
  },

  reset: () => {
    logSeq = 0;
    set((s) => ({ ...initial, resetSeq: s.resetSeq + 1 }));
  },

  applySnapshot: (snap) => {
    const toMap = (ids: string[]) =>
      Object.fromEntries(ids.map((i) => [i, true]));
    set({
      hp: snap.hp,
      alarm: snap.alarm,
      spotted: snap.spotted,
      room: snap.room,
      thiefXZ: [snap.thief[0], snap.thief[2]],
      thiefYaw: snap.thief[3],
      keycard: snap.keycard,
      codeFound: snap.codeFound,
      vaultOpen: snap.vaultOpen,
      alarmDisabled: snap.alarmDisabled,
      escaped: snap.escaped,
      loot: snap.loot,
      score: snap.score,
      collected: toMap(snap.collected),
      discovered: toMap(snap.discovered),
      doorsOpen: toMap(snap.doorsOpen),
      explored: toMap(snap.explored) as Partial<Record<RoomId, boolean>>,
      log: snap.log,
    });
  },
}));

/** Does this client get to see inside the given room? */
export function useRoomVisible(room: RoomId): boolean {
  const mode = useGame((s) => s.mode);
  const explored = useGame((s) => !!s.explored[room]);
  if (mode.kind === "spectator") return mode.watching === room;
  return explored;
}

/** This client owns the simulation (thief input, guards, detection). */
export const useIsHost = () =>
  useGame((s) => s.mode.kind === "solo" || s.mode.kind === "thief");
