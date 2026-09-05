import { resolveRoom } from "../game/net/roles";
import {
  COUNTDOWN_MS,
  MAX_PLAYERS,
  type NetMessage,
  type PlayerInfo,
  type RoomState,
} from "../game/net/types";

/**
 * In-memory room registry for the dev/demo server. Rooms live for as long as
 * the Next process does, which is all a run needs; swap this for the
 * SpacetimeDB module when you want them to outlive the server.
 *
 * Held on globalThis so hot reloads do not drop live rooms.
 */
type Sub = { id: string; write: (chunk: string) => void };

const g = globalThis as unknown as {
  __heistRooms?: Map<string, RoomState>;
  __heistSubs?: Map<string, Set<Sub>>;
};

const rooms = (g.__heistRooms ??= new Map<string, RoomState>());
const subs = (g.__heistSubs ??= new Map<string, Set<Sub>>());

const ROOM_TTL = 6 * 60 * 60 * 1000;

function sweep() {
  const now = Date.now();
  for (const [code, room] of rooms)
    if (now - room.createdAt > ROOM_TTL && !subs.get(code)?.size)
      rooms.delete(code);
}

export function getRoom(code: string): RoomState | null {
  sweep();
  const room = rooms.get(code) ?? null;
  if (!room) return null;
  // apply the draw once the clock has run out so late arrivals agree with
  // everyone who was already watching
  const live = resolveRoom(room);
  if (live && live !== room) rooms.set(code, live);
  return live;
}

export function broadcast(code: string, msg: NetMessage) {
  const payload = `data: ${JSON.stringify(msg)}\n\n`;
  for (const sub of subs.get(code) ?? []) {
    try {
      sub.write(payload);
    } catch {
      subs.get(code)?.delete(sub);
    }
  }
}

function publish(room: RoomState) {
  rooms.set(room.code, room);
  broadcast(room.code, { type: "room", room });
  return room;
}

export function createRoom(seed: RoomState): RoomState {
  const existing = getRoom(seed.code);
  if (existing) return existing;
  return publish({
    ...seed,
    maxPlayers: Math.min(Math.max(seed.maxPlayers, 2), MAX_PLAYERS),
    players: [],
    phase: "lobby",
    startsAt: null,
    createdAt: Date.now(),
  });
}

export type JoinResult =
  | { ok: true; room: RoomState }
  | { ok: false; reason: "notfound" | "full" };

export function joinRoom(code: string, player: PlayerInfo): JoinResult {
  const room = getRoom(code);
  if (!room) return { ok: false, reason: "notfound" };

  const known = room.players.find((p) => p.id === player.id);
  if (known) return { ok: true, room };
  if (room.players.length >= room.maxPlayers) return { ok: false, reason: "full" };
  if (room.phase === "playing" || room.phase === "ended")
    return { ok: false, reason: "full" };

  const players = [...room.players, player];
  const hostId = room.hostId || player.id;
  // the second player through the door starts the clock
  const kickOff = room.phase === "lobby" && players.length >= 2;

  return {
    ok: true,
    room: publish({
      ...room,
      hostId,
      players,
      phase: kickOff ? "countdown" : room.phase,
      startsAt: kickOff ? Date.now() + COUNTDOWN_MS : room.startsAt,
    }),
  };
}

export function leaveRoom(code: string, playerId: string) {
  const room = getRoom(code);
  if (!room) return;
  const players = room.players.filter((p) => p.id !== playerId);
  if (players.length === room.players.length) return;
  publish({ ...room, players });
}

export function startRoom(code: string) {
  const room = getRoom(code);
  if (!room || room.phase === "playing" || room.phase === "ended") return;
  publish({ ...room, phase: "countdown", startsAt: Date.now() + 1500 });
}

export function subscribe(code: string, sub: Sub) {
  let set = subs.get(code);
  if (!set) subs.set(code, (set = new Set()));
  set.add(sub);
  return () => {
    set.delete(sub);
    if (set.size === 0) subs.delete(code);
  };
}
