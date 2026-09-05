import { WATCHABLE, type PlayerInfo, type RoomState } from "./types";

/** Small deterministic PRNG so every client draws the same roles. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * One thief, everyone else posted to a single room each.
 * Driven by the room's seed rather than by whoever happens to be hosting, so
 * every client - and the server - lands on the same draw.
 */
export function assignRoles(players: PlayerInfo[], seed: number): PlayerInfo[] {
  if (players.length === 0) return players;
  const rng = mulberry32(seed);
  const order = [...players].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const [thief, ...rest] = order;
  const assigned: PlayerInfo[] = [{ ...thief, role: "thief", watching: null }];
  rest.forEach((p, i) =>
    assigned.push({
      ...p,
      role: "spectator",
      watching: WATCHABLE[i % WATCHABLE.length],
    }),
  );
  // keep the original join order so the lobby list does not jump around
  return players.map((p) => assigned.find((a) => a.id === p.id)!);
}

/**
 * What the room actually looks like right now. Once the countdown has run out
 * the draw is a pure function of the record, so nobody has to wait for another
 * client to tell them the run started.
 */
export function resolveRoom(room: RoomState | null): RoomState | null {
  if (!room) return null;
  if (room.phase !== "countdown" || room.startsAt === null) return room;
  if (Date.now() < room.startsAt) return room;
  return {
    ...room,
    phase: "playing",
    startsAt: null,
    players: assignRoles(room.players, room.seed),
  };
}
