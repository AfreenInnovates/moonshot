"use client";

import { create } from "zustand";
import { createNet } from "./net";
import type { CommandCode } from "./commands";
import {
  MAX_PLAYERS,
  newId,
  type NetClient,
  type NetMessage,
  type PlayerInfo,
  type RoomState,
  type Snapshot,
} from "./net/types";

export { assignRoles, resolveRoom } from "./net/roles";

export type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "notfound"
  | "full";

interface SessionState {
  net: NetClient | null;
  status: SessionStatus;
  code: string | null;
  myId: string | null;
  room: RoomState | null;
  /** true while this tab owns the room record */
  isHost: boolean;
  /** latest snapshot received from the thief's client (spectators only) */
  lastSnapshot: Snapshot | null;
  /** local receive time, so live status is not affected by device clock skew */
  lastSnapshotAt: number;

  connect: (code: string, name: string, asHost?: RoomState) => Promise<void>;
  leave: () => void;
  startNow: () => void;
  sendDiscover: (itemId: string) => void;
  sendCommand: (command: CommandCode) => void;
  publish: (snap: Snapshot) => void;
  onSnapshot: (cb: (s: Snapshot) => void) => () => void;
  onDiscover: (cb: (itemId: string) => void) => () => void;
  onCommand: (cb: (command: CommandCode, by: string) => void) => () => void;
}

const snapshotSubs = new Set<(s: Snapshot) => void>();
const discoverSubs = new Set<(id: string) => void>();
const commandSubs = new Set<(command: CommandCode, by: string) => void>();
let unsubscribe: (() => void) | null = null;

export const useSession = create<SessionState>()((set, get) => ({
  net: null,
  status: "idle",
  code: null,
  myId: null,
  room: null,
  isHost: false,
  lastSnapshot: null,
  lastSnapshotAt: 0,

  connect: async (code, name, seedRoom) => {
    get().leave();

    const net = createNet();
    const myId = newId();
    const me: PlayerInfo = {
      id: myId,
      name: name.trim() || "player",
      role: null,
      watching: null,
      joinedAt: Date.now(),
    };

    set({ net, myId, code, status: "connecting" });

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
      }
    });

    try {
      await net.connect(code);
      if (seedRoom) {
        const created = await net.createRoom({ ...seedRoom, hostId: "" });
        if (!created) {
          net.disconnect();
          set({ status: "notfound", net: null });
          return;
        }
      }
    } catch {
      net.disconnect();
      set({ status: "notfound", net: null });
      return;
    }

    const result = await net.join(code, me);
    if ("error" in result) {
      set({ status: result.error === "full" ? "full" : "notfound" });
      return;
    }
    set({
      myId: me.id,
      room: result.room,
      status: "connected",
      isHost: result.room.hostId === me.id,
    });
  },

  startNow: () => {
    const s = get();
    if (!s.code) return;
    s.net?.start(s.code);
  },

  leave: () => {
    const s = get();
    if (s.net && s.myId && s.code) s.net.leave(s.code, s.myId);
    unsubscribe?.();
    unsubscribe = null;
    s.net?.disconnect();
    snapshotSubs.clear();
    discoverSubs.clear();
    commandSubs.clear();
    set({
      net: null,
      status: "idle",
      code: null,
      myId: null,
      room: null,
      isHost: false,
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
    s.net?.send({ type: "command", command, by: s.myId ?? "?", t: Date.now() });
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
}));

/** Convenience selectors */
export const myPlayer = (s: SessionState): PlayerInfo | null =>
  s.room?.players.find((p) => p.id === s.myId) ?? null;

export const roomIsFull = (r: RoomState | null) =>
  !!r && r.players.length >= Math.min(r.maxPlayers, MAX_PLAYERS);
