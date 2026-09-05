import { resolveRoom } from "../game/net/roles";
import {
  COUNTDOWN_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  SPECTATOR_REJOIN_MS,
  type NetMessage,
  type PlayerInfo,
  type RoomResult,
  type RoomState,
  type StartFailure,
} from "../game/net/types";

/**
 * In-memory room registry for the dev/demo server. Rooms live for as long as
 * the Next process does, which is all a run needs; swap this for the
 * SpacetimeDB module when you want them to outlive the server.
 *
 * Held on globalThis so hot reloads do not drop live rooms.
 */
type Sub = { id: string; write: (chunk: string) => void };
type GraceTimer = ReturnType<typeof setTimeout>;

const g = globalThis as unknown as {
  __heistRooms?: Map<string, RoomState>;
  __heistSubs?: Map<string, Set<Sub>>;
  __heistGraceTimers?: Map<string, GraceTimer>;
};

const rooms = (g.__heistRooms ??= new Map<string, RoomState>());
const subs = (g.__heistSubs ??= new Map<string, Set<Sub>>());
const graceTimers = (g.__heistGraceTimers ??= new Map<string, GraceTimer>());

const ROOM_TTL = 6 * 60 * 60 * 1000;
const graceKey = (code: string, playerId: string) => `${code}:${playerId}`;

function clearGrace(code: string, playerId: string) {
  const key = graceKey(code, playerId);
  const timer = graceTimers.get(key);
  if (timer) clearTimeout(timer);
  graceTimers.delete(key);
}

function clearRoomGrace(code: string) {
  for (const [key, timer] of graceTimers) {
    if (!key.startsWith(`${code}:`)) continue;
    clearTimeout(timer);
    graceTimers.delete(key);
  }
}

function sweep() {
  const now = Date.now();
  for (const [code, room] of rooms)
    if (now - room.createdAt > ROOM_TTL && !subs.get(code)?.size) {
      clearRoomGrace(code);
      rooms.delete(code);
    }
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

function endRoom(room: RoomState, result: RoomResult) {
  clearRoomGrace(room.code);
  publish({ ...room, phase: "ended", startsAt: null, result });
}

function expireSpectator(code: string, playerId: string, rejoinUntil: number) {
  const room = getRoom(code);
  if (!room) {
    clearGrace(code, playerId);
    return;
  }

  const player = room.players.find((candidate) => candidate.id === playerId);
  if (
    !player ||
    player.role !== "spectator" ||
    player.connected !== false ||
    player.rejoinUntil !== rejoinUntil
  ) {
    clearGrace(code, playerId);
    return;
  }

  clearGrace(code, playerId);
  endRoom(
    { ...room, players: room.players.filter((candidate) => candidate.id !== playerId) },
    "spectator-left",
  );
}

function startSpectatorGrace(room: RoomState, playerId: string) {
  const rejoinUntil = Date.now() + SPECTATOR_REJOIN_MS;
  clearGrace(room.code, playerId);
  publish({
    ...room,
    players: room.players.map((candidate) =>
      candidate.id === playerId
        ? { ...candidate, connected: false, rejoinUntil }
        : candidate,
    ),
  });
  graceTimers.set(
    graceKey(room.code, playerId),
    setTimeout(() => expireSpectator(room.code, playerId, rejoinUntil), SPECTATOR_REJOIN_MS),
  );
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
  | { ok: false; reason: "notfound" | "full" | "unavailable" };

export function joinRoom(code: string, player: PlayerInfo): JoinResult {
  let room = getRoom(code);
  if (!room) return { ok: false, reason: "notfound" };
  if (room.phase === "ended") return { ok: false, reason: "unavailable" };

  let known = room.players.find((p) => p.id === player.id);
  if (known?.connected === false) {
    const rejoinUntil = known.rejoinUntil ?? 0;
    if (rejoinUntil <= Date.now()) {
      expireSpectator(code, player.id, rejoinUntil);
      room = getRoom(code);
      if (!room || room.phase === "ended")
        return { ok: false, reason: room ? "unavailable" : "notfound" };
      known = room.players.find((candidate) => candidate.id === player.id);
    } else {
      clearGrace(code, player.id);
      const players = room.players.map((candidate) =>
        candidate.id === player.id
          ? { ...candidate, name: player.name, connected: true, rejoinUntil: 0 }
          : candidate,
      );
      return { ok: true, room: publish({ ...room, players }) };
    }
  }

  if (known) {
    if (known.name === player.name && known.connected !== false)
      return { ok: true, room };
    const players = room.players.map((p) =>
      p.id === player.id
        ? { ...p, name: player.name, connected: true, rejoinUntil: 0 }
        : p,
    );
    return { ok: true, room: publish({ ...room, players }) };
  }
  if (room.players.length >= room.maxPlayers) return { ok: false, reason: "full" };
  if (room.phase !== "lobby") return { ok: false, reason: "unavailable" };

  const players = [
    ...room.players,
    { ...player, connected: true, rejoinUntil: 0 },
  ];
  const hostId = room.hostId || player.id;
  // the second player through the door starts the clock
  const kickOff = players.length >= MIN_PLAYERS;

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
  const departing = room.players.find((p) => p.id === playerId);
  if (!departing) return;
  clearGrace(code, playerId);

  if (departing.role === "thief" && room.phase === "playing") {
    endRoom(
      {
        ...room,
        players: room.players.filter((p) => p.id !== playerId),
      },
      "thief-left",
    );
    return;
  }
  if (departing.role === "spectator" && room.phase === "playing") {
    startSpectatorGrace(room, playerId);
    return;
  }

  const players = room.players.filter((p) => p.id !== playerId);
  if (players.length === room.players.length) return;

  const hostId =
    players.length === 0
      ? ""
      : room.hostId === playerId ||
          !players.some((player) => player.id === room.hostId)
        ? players[0].id
        : room.hostId;
  const waitingAgain =
    room.phase === "countdown" && players.length < MIN_PLAYERS;

  publish({
    ...room,
    hostId,
    players,
    phase: waitingAgain ? "lobby" : room.phase,
    startsAt: waitingAgain ? null : room.startsAt,
  });
}

/** Called by the local transport when its live client connection disappears. */
export function disconnectRoom(code: string, playerId: string) {
  const room = getRoom(code);
  if (!room) return;
  const player = room.players.find((candidate) => candidate.id === playerId);
  if (!player || player.connected === false) return;

  if (room.phase === "playing" && player.role === "thief") {
    endRoom(
      {
        ...room,
        players: room.players.map((candidate) =>
          candidate.id === playerId ? { ...candidate, connected: false } : candidate,
        ),
      },
      "thief-left",
    );
    return;
  }

  if (room.phase !== "playing" || player.role !== "spectator") return;

  startSpectatorGrace(room, playerId);
}

export type StartRoomResult =
  | { ok: true }
  | { ok: false; error: StartFailure };

export function startRoom(code: string, playerId: string): StartRoomResult {
  const room = getRoom(code);
  if (!room) return { ok: false, error: "notfound" };
  if (room.hostId !== playerId) return { ok: false, error: "not-host" };
  if (room.phase !== "lobby") return { ok: false, error: "started" };
  if (room.players.length < MIN_PLAYERS)
    return { ok: false, error: "not-ready" };

  publish({ ...room, phase: "countdown", startsAt: Date.now() + 1500 });
  return { ok: true };
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
