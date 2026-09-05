/**
 * SpacetimeDB Module — One Heist, Two Realities
 *
 * The authoritative room server for the heist. Clients subscribe to these
 * tables over the SpacetimeDB WebSocket and call the reducers below.
 *
 * Shape of a run:
 *   create_room  -> a host opens a room and gets a code
 *   join_room    -> players drop in through the shared link
 *   start_run    -> countdown begins; roles are drawn from the room seed
 *   publish_world-> the thief's client streams the world 12x a second
 *   discover_item-> a spectator scans something hidden in their room
 *   end_run      -> escaped or caught
 *
 * Roles are drawn from `seed` with the same shuffle the web client uses, so a
 * client can predict the draw the instant the countdown ends and the server
 * stays the source of truth.
 */

import { ScheduleAt, schema, table, t, type ReducerCtx } from 'spacetimedb/server';

const WATCHABLE = ['lobby', 'sec', 'vault'] as const;
const MIN_PLAYERS = 2;
const SPECTATOR_REJOIN_MS = 20_000n;

const spectatorGrace = table(
  { public: true },
  {
    id: t.u64().autoInc().primaryKey(),
    scheduled_at: t.scheduleAt(),
    room_code: t.string(),
    player_id: t.string(),
    identity: t.string(),
    connection_id: t.string(),
    expires_at: t.u64(),
  },
);

const spacetimedb = schema({
  game_room: table(
    { public: true },
    {
      code: t.string().primaryKey(),
      host: t.string(),
      max_players: t.u32(),
      /** lobby | countdown | playing | ended */
      phase: t.string(),
      /** epoch millis the run begins; 0 unless counting down */
      starts_at: t.u64(),
      /** shared randomness for the role draw */
      seed: t.u32(),
      /** escaped | down | "" */
      result: t.string(),
      created_at: t.u64(),
    }
  ),

  player: table(
    { public: true },
    {
      /** `${room_code}:${identity}` so one person can be in one room at a time */
      id: t.string().primaryKey(),
      room_code: t.string(),
      identity: t.string(),
      name: t.string(),
      /** "" until the draw, then thief | spectator */
      role: t.string(),
      /** the single room a spectator is posted to */
      watching: t.string(),
      joined_at: t.u64(),
      connected: t.bool(),
      rejoin_until: t.u64(),
      connection_id: t.string(),
    }
  ),

  /** One row per room: everything a viewer needs to draw the run. */
  thief_state: table(
    { public: true },
    {
      room_code: t.string().primaryKey(),
      x: t.f32(),
      y: t.f32(),
      z: t.f32(),
      yaw: t.f32(),
      /** which room of the building the thief is standing in */
      area: t.string(),
      hp: t.f32(),
      alarm: t.f32(),
      spotted: t.bool(),
      keycard: t.bool(),
      code_found: t.bool(),
      vault_open: t.bool(),
      alarm_disabled: t.bool(),
      escaped: t.bool(),
      loot: t.u32(),
      score: t.u32(),
      /**
       * Guard transforms, camera yaws and collected ids as JSON. These change
       * shape as the level grows; keeping them opaque here means the level can
       * be edited without a schema migration.
       */
      extra: t.string(),
      updated_at: t.u64(),
    }
  ),

  discovered_item: table(
    { public: true },
    {
      /** `${room_code}:${item_id}` */
      id: t.string().primaryKey(),
      room_code: t.string(),
      item_id: t.string(),
      /** identity of the spectator who scanned it */
      by: t.string(),
      at: t.u64(),
    }
  ),

  game_event: table(
    { public: true },
    {
      id: t.u64().autoInc().primaryKey(),
      room_code: t.string(),
      /** info | good | bad */
      tone: t.string(),
      text: t.string(),
      at: t.u64(),
    }
  ),
  spectator_grace: spectatorGrace,
});

export default spacetimedb;

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

const nowMs = (ts: { toMillis(): bigint }) => ts.toMillis();
type HeistContext = ReducerCtx<typeof spacetimedb.schemaType>;

function endRoom(ctx: HeistContext, code: string, result: string, text: string) {
  const room = ctx.db.game_room.code.find(code);
  if (!room || room.phase === 'ended') return;

  const thiefState = ctx.db.thief_state.room_code.find(code);
  if (thiefState) ctx.db.thief_state.room_code.delete(code);
  for (const item of ctx.db.discovered_item.iter()) {
    if (item.room_code === code) ctx.db.discovered_item.id.delete(item.id);
  }
  for (const grace of ctx.db.spectator_grace.iter()) {
    if (grace.room_code === code) ctx.db.spectator_grace.id.delete(grace.id);
  }

  const at = nowMs(ctx.timestamp);
  ctx.db.game_room.code.update({ ...room, phase: 'ended', starts_at: 0n, result });
  ctx.db.game_event.insert({
    id: 0n,
    room_code: code,
    tone: 'bad',
    text,
    at,
  });
}

function startSpectatorGrace(
  ctx: HeistContext,
  code: string,
  playerId: string,
  connectionId: string,
  at: bigint,
) {
  const room = ctx.db.game_room.code.find(code);
  const player = ctx.db.player.id.find(playerId);
  if (!room || room.phase !== 'playing' || !player || player.role !== 'spectator') return;

  const expiresAt = at + SPECTATOR_REJOIN_MS;
  for (const grace of ctx.db.spectator_grace.iter()) {
    if (grace.player_id === player.id) ctx.db.spectator_grace.id.delete(grace.id);
  }
  ctx.db.player.id.update({
    ...player,
    connected: false,
    rejoin_until: expiresAt,
    connection_id: connectionId,
  });
  ctx.db.spectator_grace.insert({
    id: 0n,
    scheduled_at: ScheduleAt.time(expiresAt * 1_000n),
    room_code: room.code,
    player_id: player.id,
    identity: player.identity,
    connection_id: connectionId,
    expires_at: expiresAt,
  });
}

/** Same deterministic PRNG the web client uses, so both agree on the draw. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/* reducers                                                                    */
/* -------------------------------------------------------------------------- */

export const create_room = spacetimedb.reducer(
  { code: t.string(), max_players: t.u32(), seed: t.u32(), name: t.string() },
  (ctx, { code, max_players, seed, name }) => {
    if (ctx.db.game_room.code.find(code)) throw new Error('room code taken');
    const at = nowMs(ctx.timestamp);
    const host = ctx.sender.toHexString();

    ctx.db.game_room.insert({
      code,
      host,
      max_players: Math.min(Math.max(max_players, 2), 4),
      phase: 'lobby',
      starts_at: 0n,
      seed,
      result: '',
      created_at: at,
    });

    ctx.db.player.insert({
      id: `${code}:${host}`,
      room_code: code,
      identity: host,
      name,
      role: '',
      watching: '',
      joined_at: at,
      connected: true,
      rejoin_until: 0n,
      connection_id: ctx.connectionId?.toHexString() ?? '',
    });
  }
);

export const join_room = spacetimedb.reducer(
  { code: t.string(), name: t.string() },
  (ctx, { code, name }) => {
    const room = ctx.db.game_room.code.find(code);
    if (!room) throw new Error('no such room');

    const identity = ctx.sender.toHexString();
    const id = `${code}:${identity}`;
    const existing = ctx.db.player.id.find(id);
    if (existing) {
      if (room.phase === 'ended') throw new Error('that run is over');
      for (const grace of ctx.db.spectator_grace.iter()) {
        if (grace.player_id === id) ctx.db.spectator_grace.id.delete(grace.id);
      }
      // reconnecting - keep whatever role they already hold
      ctx.db.player.id.update({
        ...existing,
        name,
        connected: true,
        rejoin_until: 0n,
        connection_id: ctx.connectionId?.toHexString() ?? existing.connection_id,
      });
      return;
    }

    if (room.phase !== 'lobby') throw new Error('that run has already started');

    let seats = 0;
    for (const p of ctx.db.player.iter()) if (p.room_code === code) seats++;
    if (seats >= room.max_players) throw new Error('room is full');

    const at = nowMs(ctx.timestamp);
    ctx.db.player.insert({
      id,
      room_code: code,
      identity,
      name,
      role: '',
      watching: '',
      joined_at: at,
      connected: true,
      rejoin_until: 0n,
      connection_id: ctx.connectionId?.toHexString() ?? '',
    });

    // second player through the door starts the ten second clock
    if (room.phase === 'lobby' && seats + 1 >= 2) {
      ctx.db.game_room.code.update({
        ...room,
        host: room.host || identity,
        phase: 'countdown',
        starts_at: at + 10_000n,
      });
    } else if (!room.host) {
      ctx.db.game_room.code.update({ ...room, host: identity });
    }
  }
);

export const leave_room = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const identity = ctx.sender.toHexString();
    const id = `${code}:${identity}`;
    const player = ctx.db.player.id.find(id);
    if (!player) return;

    const room = ctx.db.game_room.code.find(code);
    if (!room) {
      ctx.db.player.id.delete(id);
      return;
    }

    for (const grace of ctx.db.spectator_grace.iter()) {
      if (grace.player_id === id) ctx.db.spectator_grace.id.delete(grace.id);
    }

    if (player.role === 'thief' && room.phase === 'playing') {
      ctx.db.player.id.delete(id);
      endRoom(ctx, code, 'thief-left', 'THE THIEF LEFT. THIS GAME IS OVER.');
      return;
    }

    if (player.role === 'spectator' && room.phase === 'playing') {
      startSpectatorGrace(
        ctx,
        code,
        id,
        ctx.connectionId?.toHexString() ?? player.connection_id,
        nowMs(ctx.timestamp),
      );
      return;
    }

    ctx.db.player.id.delete(id);

    const remaining = [...ctx.db.player.iter()].filter((p) => p.room_code === code);
    let host = room.host;
    if (room.host === identity || !remaining.some((p) => p.identity === host)) {
      const nextHost = remaining.reduce<typeof remaining[number] | null>(
        (candidate, current) =>
          !candidate ||
          current.joined_at < candidate.joined_at ||
          (current.joined_at === candidate.joined_at && current.id < candidate.id)
            ? current
            : candidate,
        null,
      );
      host = nextHost?.identity ?? '';
    }

    const waitingAgain = room.phase === 'countdown' && remaining.length < MIN_PLAYERS;
    ctx.db.game_room.code.update({
      ...room,
      host,
      phase: waitingAgain ? 'lobby' : room.phase,
      starts_at: waitingAgain ? 0n : room.starts_at,
    });
  }
);

/**
 * A live connection is authoritative presence. Spectators keep their role and
 * seat for one scheduled grace window; a disconnected thief ends the run.
 */
export const on_disconnect = spacetimedb.clientDisconnected((ctx) => {
  const connectionId = ctx.connectionId?.toHexString();
  if (!connectionId) return;

  const at = nowMs(ctx.timestamp);
  for (const player of ctx.db.player.iter()) {
    if (player.connection_id !== connectionId || !player.connected) continue;
    const room = ctx.db.game_room.code.find(player.room_code);
    if (!room || room.phase === 'ended') continue;

    if (player.role === 'thief' && room.phase === 'playing') {
      ctx.db.player.id.update({ ...player, connected: false });
      endRoom(ctx, room.code, 'thief-left', 'THE THIEF LEFT. THIS GAME IS OVER.');
      continue;
    }

    if (player.role !== 'spectator' || room.phase !== 'playing') continue;

    startSpectatorGrace(ctx, room.code, player.id, connectionId, at);
  }
});

/** Server-side expiry for a spectator that did not reconnect in time. */
export const expire_spectator = spacetimedb.reducer(
  { onSchedule: spectatorGrace },
  { grace: spectatorGrace.rowType },
  (ctx, { grace }) => {
    const scheduled = ctx.db.spectator_grace.id.find(grace.id);
    if (!scheduled) return;
    ctx.db.spectator_grace.id.delete(grace.id);

    const room = ctx.db.game_room.code.find(grace.room_code);
    const player = ctx.db.player.id.find(grace.player_id);
    if (
      !room ||
      !player ||
      player.identity !== grace.identity ||
      player.connection_id !== grace.connection_id ||
      player.connected ||
      player.rejoin_until !== grace.expires_at
    )
      return;

    ctx.db.player.id.delete(player.id);
    if (room.phase === 'playing') {
      endRoom(
        ctx,
        room.code,
        'spectator-left',
        'SPECTATOR DID NOT RETURN. START A NEW GAME.',
      );
    }
  },
);

/** Host can cut the wait short. */
export const start_run = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const room = ctx.db.game_room.code.find(code);
    if (!room) throw new Error('no such room');
    if (room.host !== ctx.sender.toHexString())
      throw new Error('only the host can start');
    if (room.phase !== 'lobby') throw new Error('run already started');

    let players = 0;
    for (const p of ctx.db.player.iter()) if (p.room_code === code) players++;
    if (players < MIN_PLAYERS) throw new Error('at least two players are required');

    ctx.db.game_room.code.update({
      ...room,
      phase: 'countdown',
      starts_at: nowMs(ctx.timestamp) + 1_500n,
    });
  }
);

/**
 * Draw the roles. Safe to call from any client once the clock has run out -
 * the result only depends on the room seed and the sorted player list, so
 * whoever calls it first writes what everyone else already predicted.
 */
export const draw_roles = spacetimedb.reducer(
  { code: t.string() },
  (ctx, { code }) => {
    const room = ctx.db.game_room.code.find(code);
    if (!room || room.phase !== 'countdown') return;
    if (nowMs(ctx.timestamp) < room.starts_at) throw new Error('too early');

    const players = [...ctx.db.player.iter()]
      .filter((p) => p.room_code === code)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (players.length === 0) return;

    const rng = mulberry32(room.seed);
    const order = [...players];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    order.forEach((p, i) => {
      ctx.db.player.id.update({
        ...p,
        role: i === 0 ? 'thief' : 'spectator',
        watching: i === 0 ? '' : WATCHABLE[(i - 1) % WATCHABLE.length],
      });
    });

    ctx.db.game_room.code.update({
      ...room,
      phase: 'playing',
      starts_at: 0n,
    });

    ctx.db.thief_state.insert({
      room_code: code,
      x: 0,
      y: 1.1,
      z: 15.5,
      yaw: 0,
      area: 'outside',
      hp: 100,
      alarm: 0,
      spotted: false,
      keycard: false,
      code_found: false,
      vault_open: false,
      alarm_disabled: false,
      escaped: false,
      loot: 0,
      score: 0,
      extra: '{}',
      updated_at: nowMs(ctx.timestamp),
    });
  }
);

/** The thief's client owns the simulation and pushes the world here. */
export const publish_world = spacetimedb.reducer(
  {
    code: t.string(),
    x: t.f32(),
    y: t.f32(),
    z: t.f32(),
    yaw: t.f32(),
    area: t.string(),
    hp: t.f32(),
    alarm: t.f32(),
    spotted: t.bool(),
    keycard: t.bool(),
    code_found: t.bool(),
    vault_open: t.bool(),
    alarm_disabled: t.bool(),
    escaped: t.bool(),
    loot: t.u32(),
    score: t.u32(),
    extra: t.string(),
  },
  (ctx, args) => {
    const room = ctx.db.game_room.code.find(args.code);
    if (!room || room.phase !== 'playing') throw new Error('run is not active');

    const me = ctx.db.player.id.find(
      `${args.code}:${ctx.sender.toHexString()}`
    );
    if (!me || me.role !== 'thief' || !me.connected)
      throw new Error('only the connected thief publishes');

    const row = {
      room_code: args.code,
      x: args.x,
      y: args.y,
      z: args.z,
      yaw: args.yaw,
      area: args.area,
      hp: args.hp,
      alarm: args.alarm,
      spotted: args.spotted,
      keycard: args.keycard,
      code_found: args.code_found,
      vault_open: args.vault_open,
      alarm_disabled: args.alarm_disabled,
      escaped: args.escaped,
      loot: args.loot,
      score: args.score,
      extra: args.extra,
      updated_at: nowMs(ctx.timestamp),
    };

    if (ctx.db.thief_state.room_code.find(args.code))
      ctx.db.thief_state.room_code.update(row);
    else ctx.db.thief_state.insert(row);
  }
);

/** A spectator scanning something hidden in the room they were posted to. */
export const discover_item = spacetimedb.reducer(
  { code: t.string(), item_id: t.string() },
  (ctx, { code, item_id }) => {
    const identity = ctx.sender.toHexString();
    const room = ctx.db.game_room.code.find(code);
    const me = ctx.db.player.id.find(`${code}:${identity}`);
    if (!room || room.phase !== 'playing' || !me || !me.connected)
      throw new Error('not in an active room');

    const id = `${code}:${item_id}`;
    if (ctx.db.discovered_item.id.find(id)) return;

    const at = nowMs(ctx.timestamp);
    ctx.db.discovered_item.insert({
      id,
      room_code: code,
      item_id,
      by: identity,
      at,
    });
    ctx.db.game_event.insert({
      id: 0n,
      room_code: code,
      tone: 'good',
      text: `${me.name} scanned ${item_id}`,
      at,
    });
  }
);

export const log_event = spacetimedb.reducer(
  { code: t.string(), tone: t.string(), text: t.string() },
  (ctx, { code, tone, text }) => {
    const room = ctx.db.game_room.code.find(code);
    const me = ctx.db.player.id.find(`${code}:${ctx.sender.toHexString()}`);
    if (
      !room ||
      room.phase !== 'playing' ||
      !me ||
      me.role !== 'spectator' ||
      !me.connected ||
      (!tone.startsWith('command:') && tone !== 'voice')
    )
      throw new Error('only an active spectator can command');
    ctx.db.game_event.insert({
      id: 0n,
      room_code: code,
      tone,
      text,
      at: nowMs(ctx.timestamp),
    });
  }
);

export const end_run = spacetimedb.reducer(
  { code: t.string(), result: t.string() },
  (ctx, { code, result }) => {
    const room = ctx.db.game_room.code.find(code);
    if (!room || room.phase === 'ended') return;
    ctx.db.game_room.code.update({ ...room, phase: 'ended', result });
    ctx.db.game_event.insert({
      id: 0n,
      room_code: code,
      tone: result === 'escaped' ? 'good' : 'bad',
      text: result === 'escaped' ? 'The thief got out.' : 'The thief went down.',
      at: nowMs(ctx.timestamp),
    });
  }
);
