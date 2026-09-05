"use client";

import { create } from "zustand";
import { createNet } from "./net";
import { resolveRoom } from "./net/roles";
import type { CommandCode } from "./commands";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  newId,
  type NetClient,
  type NetMessage,
  type PlayerInfo,
  type RoomState,
  type Snapshot,
  type VoiceTransmission,
} from "./net/types";

export { assignRoles, resolveRoom } from "./net/roles";

export type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "notfound"
  | "full"
  | "unavailable";

interface SessionState {
  net: NetClient | null;
  status: SessionStatus;
  code: string | null;
  myId: string | null;
  room: RoomState | null;
  /** true while this tab owns the room record */
  isHost: boolean;
  startError: string | null;
  /** latest snapshot received from the thief's client (spectators only) */
  lastSnapshot: Snapshot | null;
  /** local receive time, so live status is not affected by device clock skew */
  lastSnapshotAt: number;

  connect: (code: string, name: string, asHost?: RoomState) => Promise<void>;
  leave: () => void;
  disconnect: (intentional?: boolean) => void;
  startNow: () => Promise<boolean>;
  sendDiscover: (itemId: string) => void;
  sendCommand: (command: CommandCode) => void;
  publish: (snap: Snapshot) => void;
  onSnapshot: (cb: (s: Snapshot) => void) => () => void;
  onDiscover: (cb: (itemId: string) => void) => () => void;
  onCommand: (cb: (command: CommandCode, by: string) => void) => () => void;
  onVoice: (cb: (voice: VoiceTransmission) => void) => () => void;
}

const snapshotSubs = new Set<(s: Snapshot) => void>();
const discoverSubs = new Set<(id: string) => void>();
const commandSubs = new Set<(command: CommandCode, by: string) => void>();
const voiceSubs = new Set<(voice: VoiceTransmission) => void>();
let unsubscribe: (() => void) | null = null;

function playerIdForRoom(code: string) {
  const key = `heist:player:${code}`;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const id = newId();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return newId();
  }
}

export const useSession = create<SessionState>()((set, get) => ({
  net: null,
  status: "idle",
  code: null,
  myId: null,
  room: null,
  isHost: false,
  startError: null,
  lastSnapshot: null,
  lastSnapshotAt: 0,

  connect: async (code, name, seedRoom) => {
    get().leave();

    const net = createNet();
    const myId = playerIdForRoom(code);
    const me: PlayerInfo = {
      id: myId,
      name: name.trim() || "player",
      role: null,
      watching: null,
      joinedAt: Date.now(),
      connected: true,
      rejoinUntil: 0,
    };

    set({ net, myId, code, status: "connecting", startError: null });

    unsubscribe = net.onMessage((msg: NetMessage) => {
      switch (msg.type) {
        case "room": {
          if (!msg.room || msg.room.code !== get().code) return;
          set({
            room: msg.room,
            status: "connected",
            isHost: msg.room.hostId === get().myId,
          });
          break;
        }
        case "world": {
          set({ lastSnapshot: msg.snap, lastSnapshotAt: Date.now() });
          for (const cb of snapshotSubs) cb(msg.snap);
          break;
        }
        case "discover": {
          if (msg.by === get().myId) return; // we applied it optimistically
          for (const cb of discoverSubs) cb(msg.itemId);
          break;
        }
        case "command": {
          for (const cb of commandSubs) cb(msg.command, msg.by);
          break;
        }
        case "voice": {
          for (const cb of voiceSubs) cb(msg);
          break;
        }
      }
    });

    try {
      await net.connect(code);
      if (seedRoom) {
        const created = await net.createRoom({ ...seedRoom, hostId: "" });
        if (!created) {
          net.disconnect();
          unsubscribe?.();
          unsubscribe = null;
          set({ status: "notfound", net: null });
          return;
        }
      }
    } catch {
      net.disconnect();
      unsubscribe?.();
      unsubscribe = null;
      set({ status: "notfound", net: null });
      return;
    }

    const result = await net.join(code, me);
    if ("error" in result) {
      net.disconnect();
      unsubscribe?.();
      unsubscribe = null;
      set({
        status:
          result.error === "full"
            ? "full"
            : result.error === "unavailable"
              ? "unavailable"
              : "notfound",
        net: null,
      });
      return;
    }
    set({
      myId: me.id,
      room: result.room,
      status: "connected",
      isHost: result.room.hostId === me.id,
    });
  },

  startNow: async () => {
    const s = get();
    if (
      !s.code ||
      !s.myId ||
      !s.net ||
      !s.room ||
      !s.isHost ||
      s.room.phase !== "lobby" ||
      s.room.players.length < MIN_PLAYERS
    )
      return false;

    set({ startError: null });
    const result = await s.net.start(s.code, s.myId);
    if (!result.ok) {
      set({ startError: result.error });
      return false;
    }
    return true;
  },

  leave: () => {
    const s = get();
    if (s.net && s.myId && s.code) s.net.leave(s.code, s.myId);
    get().disconnect(true);
  },

  disconnect: (intentional = false) => {
    const s = get();
    unsubscribe?.();
    unsubscribe = null;
    s.net?.disconnect(intentional);
    snapshotSubs.clear();
    discoverSubs.clear();
    commandSubs.clear();
    voiceSubs.clear();
    set({
      net: null,
      status: "idle",
      code: null,
      myId: null,
      room: null,
      isHost: false,
      startError: null,
      lastSnapshot: null,
      lastSnapshotAt: 0,
    });
  },

  sendDiscover: (itemId) => {
    const s = get();
    s.net?.send({ type: "discover", itemId, by: s.myId ?? "?" });
  },

  sendCommand: (command) => {
    const s = get();
    const room = resolveRoom(s.room);
    const me = room?.players.find((player) => player.id === s.myId);
    if (!s.code || !s.myId || !s.net || room?.phase !== "playing" || me?.role !== "spectator") return;
    s.net.send({ type: "command", command, by: s.myId, t: Date.now() });
  },

  publish: (snap) => {
    get().net?.send({ type: "world", snap });
  },

  onSnapshot: (cb) => {
    snapshotSubs.add(cb);
    return () => snapshotSubs.delete(cb);
  },

  onDiscover: (cb) => {
    discoverSubs.add(cb);
    return () => discoverSubs.delete(cb);
  },

  onCommand: (cb) => {
    commandSubs.add(cb);
    return () => commandSubs.delete(cb);
  },

  onVoice: (cb) => {
    voiceSubs.add(cb);
    return () => voiceSubs.delete(cb);
  },
}));

/** Convenience selectors */
export const myPlayer = (s: SessionState): PlayerInfo | null =>
  s.room?.players.find((p) => p.id === s.myId) ?? null;

export const roomIsFull = (r: RoomState | null) =>
  !!r && r.players.length >= Math.min(r.maxPlayers, MAX_PLAYERS);
