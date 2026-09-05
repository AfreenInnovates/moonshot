"use client";

import { DbConnection } from "./spacetime";
import type { DbView } from "./spacetime";
import type { RoomId } from "../level";
import type { CommandCode } from "../commands";
import type {
  JoinFailure,
  NetClient,
  NetMessage,
  Phase,
  PlayerInfo,
  RoomState,
  Snapshot,
  StartResult,
  VoiceTransmission,
} from "./types";
import { WATCHABLE } from "./types";

const PHASES: Phase[] = ["lobby", "countdown", "playing", "ended"];
const COMMAND_CODES: CommandCode[] = ["LEFT", "RIGHT", "FORWARD", "BACK", "RUN", "HIDE", "STOP"];

type SnapshotExtra = Pick<Snapshot, "guards" | "cams" | "collected" | "doorsOpen" | "explored">;

type RoomWaiter = {
  matches: (room: RoomState) => boolean;
  resolve: (room: RoomState) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const roomId = (value: string): RoomId | null =>
  (WATCHABLE as readonly string[]).includes(value) ? (value as RoomId) : null;

const phase = (value: string): Phase =>
  PHASES.includes(value as Phase) ? (value as Phase) : "lobby";

const joinFailure = (error: unknown): JoinFailure => {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("full")) return "full";
  if (lower.includes("started") || lower.includes("over") || lower.includes("countdown"))
    return "unavailable";
  return "notfound";
};

const startFailure = (error: unknown): StartResult => {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("only the host")) return { ok: false, error: "not-host" };
  if (lower.includes("at least") || lower.includes("minimum"))
    return { ok: false, error: "not-ready" };
  if (lower.includes("started") || lower.includes("countdown") || lower.includes("phase"))
    return { ok: false, error: "started" };
  return { ok: false, error: "notfound" };
};

const commandFromTone = (tone: string): CommandCode | null => {
  const value = tone.startsWith("command:") ? tone.slice("command:".length) : "";
  return COMMAND_CODES.includes(value as CommandCode) ? (value as CommandCode) : null;
};

const voiceFromEvent = (text: string): VoiceTransmission | null => {
  try {
    const value = JSON.parse(text) as Partial<VoiceTransmission>;
    if (
      typeof value.id !== "string" ||
      typeof value.by !== "string" ||
      typeof value.audioUrl !== "string" ||
      typeof value.t !== "number" ||
      !COMMAND_CODES.includes(value.command as CommandCode)
    )
      return null;
    return {
      id: value.id,
      command: value.command as CommandCode,
      by: value.by,
      audioUrl: value.audioUrl,
      t: value.t,
    };
  } catch {
    return null;
  }
};

/**
 * One SpacetimeDB identity per tab.
 *
 * A seat is `${code}:${identity}`, so every tab has to authenticate as somebody
 * different or two people on one machine claim the same seat and the room looks
 * like it only ever filled once. The suffix lives in sessionStorage: it
 * survives a refresh - which is how a player gets their seat back - and a new
 * tab starts a new person.
 */
function identitySuffix() {
  const key = "heist:spacetime-tab";
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) return stored;
    const fresh = Math.random().toString(36).slice(2, 10);
    sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // no session storage: a fresh identity every load still connects, it just
    // cannot reclaim a seat across a refresh
    return Math.random().toString(36).slice(2, 10);
  }
}

/** SpacetimeDB transport used by the deployed application. */
export class SpacetimeNet implements NetClient {
  readonly kind = "spacetime" as const;
  private conn: DbConnection | null = null;
  private listeners = new Set<(m: NetMessage) => void>();
  private code = "";
  private myId = "";
  private identity = "";
  private room: RoomState | null = null;
  private roomWaiters = new Set<RoomWaiter>();
  private drawTimer: ReturnType<typeof setTimeout> | null = null;
  private commandsReady = false;

  async connect(code: string): Promise<void> {
    this.code = code;
    this.commandsReady = false;
    if (this.conn) this.disconnect();

    const host = process.env.NEXT_PUBLIC_SPACETIME_HOST || "wss://maincloud.spacetimedb.com";
    const database = process.env.NEXT_PUBLIC_SPACETIME_MODULE_NAME || "one-heist-spacetime";
    const tokenKey = `heist:spacetime-token:${host}:${database}:${identitySuffix()}`;
    let token = "";
    try {
      token = localStorage.getItem(tokenKey) ?? "";
    } catch {
      /* anonymous identity can still connect without persistence */
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        if (error) reject(error);
        else resolve();
      };

      const conn = DbConnection.builder()
        .withUri(host)
        .withDatabaseName(database)
        .withToken(token)
        .onConnect((connectedConn, identity, nextToken) => {
          void connectedConn;
          this.identity = identity.toHexString();
          try {
            localStorage.setItem(tokenKey, nextToken);
          } catch {
            /* private browsing can still use this live connection */
          }
          finish();
        })
        .onConnectError((context, error) => {
          void context;
          finish(error);
        })
        .build();

      this.conn = conn;

      conn.db.gameRoom.onInsert((ctx, row) => {
        void ctx;
        if (row.code === this.code) this.notifyRoomChange(conn.db);
      });
      conn.db.gameRoom.onUpdate((ctx, oldRow, newRow) => {
        void ctx;
        void oldRow;
        if (newRow.code === this.code) this.notifyRoomChange(conn.db);
      });
      conn.db.player.onInsert((ctx, row) => {
        void ctx;
        if (row.roomCode === this.code) this.notifyRoomChange(conn.db);
      });
      conn.db.player.onUpdate((ctx, oldRow, newRow) => {
        void ctx;
        void oldRow;
        if (newRow.roomCode === this.code) this.notifyRoomChange(conn.db);
      });
      conn.db.player.onDelete((ctx, row) => {
        void ctx;
        if (row.roomCode === this.code) this.notifyRoomChange(conn.db);
      });
      conn.db.thiefState.onInsert((ctx, row) => {
        void ctx;
        if (row.roomCode === this.code) this.notifyWorldState(conn.db);
      });
      conn.db.thiefState.onUpdate((ctx, oldRow, newRow) => {
        void ctx;
        void oldRow;
        if (newRow.roomCode === this.code) this.notifyWorldState(conn.db);
      });
      conn.db.discoveredItem.onInsert((ctx, row) => {
        void ctx;
        if (!this.commandsReady || row.roomCode !== this.code) return;
        for (const cb of this.listeners) {
          cb({
            type: "discover",
            itemId: row.itemId,
            by: row.by === this.identity ? this.myId : `${this.code}:${row.by}`,
          });
        }
      });
      conn.db.gameEvent.onInsert((ctx, row) => {
        void ctx;
        if (row.roomCode !== this.code) return;
        if (row.tone === "voice") {
          const voice = voiceFromEvent(row.text);
          if (voice) for (const cb of this.listeners) cb({ type: "voice", ...voice });
          return;
        }
        const command = commandFromTone(row.tone);
        if (command) {
          const by = row.text.startsWith("command:") ? row.text.slice("command:".length) : `${this.code}:?`;
          for (const cb of this.listeners) cb({ type: "command", command, by, t: Number(row.at) });
          return;
        }

        if (row.tone.startsWith("powerup:")) {
          const effect = row.tone.slice("powerup:".length) as "heal" | "invis";
          const by = row.text;
          for (const cb of this.listeners) cb({ type: "powerup", effect, by, t: Number(row.at) });
        }
      });

      conn.subscriptionBuilder()
        .onApplied((ctx) => {
          this.commandsReady = true;
          this.notifyRoomChange(ctx.db);
          this.notifyWorldState(ctx.db);
        })
        .subscribe([
          `SELECT * FROM game_room WHERE code = '${code}'`,
          `SELECT * FROM player WHERE room_code = '${code}'`,
          `SELECT * FROM thief_state WHERE room_code = '${code}'`,
          `SELECT * FROM discovered_item WHERE room_code = '${code}'`,
          `SELECT * FROM game_event WHERE room_code = '${code}'`,
        ]);

      setTimeout(() => finish(new Error("Timed out connecting to SpacetimeDB")), 5000);
    });
  }

  private waitForRoom(matches: RoomWaiter["matches"]): Promise<RoomState> {
    if (this.room && matches(this.room)) return Promise.resolve(this.room);
    return new Promise((resolve, reject) => {
      const waiter = {} as RoomWaiter;
      waiter.matches = matches;
      waiter.resolve = (room) => {
        clearTimeout(waiter.timeout);
        this.roomWaiters.delete(waiter);
        resolve(room);
      };
      waiter.reject = (error) => {
        clearTimeout(waiter.timeout);
        this.roomWaiters.delete(waiter);
        reject(error);
      };
      waiter.timeout = setTimeout(() => waiter.reject(new Error("Timed out waiting for room state")), 5000);
      this.roomWaiters.add(waiter);
    });
  }

  private scheduleRoleDraw(room: RoomState) {
    if (this.drawTimer) clearTimeout(this.drawTimer);
    this.drawTimer = null;
    if (room.phase !== "countdown" || room.startsAt === null) return;
    const code = room.code;
    const delay = Math.max(0, room.startsAt - Date.now()) + 25;
    this.drawTimer = setTimeout(() => {
      this.drawTimer = null;
      const conn = this.conn;
      if (!conn || this.code !== code) return;
      void conn.reducers.drawRoles({ code }).catch(() => {
        if (this.room?.phase === "countdown") this.scheduleRoleDraw(this.room);
      });
    }, delay);
  }

  private notifyRoomChange(db: DbView) {
    const r = db.gameRoom.code.find(this.code);
    if (!r) return;
    const players: PlayerInfo[] = [];
    for (const p of db.player.iter()) {
      if (p.roomCode !== this.code) continue;
      players.push({
        id: p.id,
        name: p.name,
        role: p.role === "thief" || p.role === "spectator" ? p.role : null,
        watching: roomId(p.watching),
        joinedAt: Number(p.joinedAt),
        // the published module has no disconnect bookkeeping, so a seat that
        // exists is a seat that is held
        connected: true,
        rejoinUntil: 0,
      });
    }
    const state: RoomState = {
      code: r.code,
       hostId: r.host ? `${this.code}:${r.host}` : "",
      maxPlayers: r.maxPlayers,
      phase: phase(r.phase),
      startsAt: Number(r.startsAt) || null,
      players,
      createdAt: Number(r.createdAt),
      seed: r.seed,
       result:
         r.result === "escaped" ||
         r.result === "down" ||
         r.result === "thief-left" ||
         r.result === "spectator-left"
           ? r.result
           : null,
    };
    this.room = state;
    this.scheduleRoleDraw(state);
    for (const cb of this.listeners) cb({ type: "room", room: state });
    for (const waiter of this.roomWaiters) if (waiter.matches(state)) waiter.resolve(state);
  }

  private notifyWorldState(db: DbView) {
    const ts = db.thiefState.roomCode.find(this.code);
    if (!ts) return;
    let extra: Partial<SnapshotExtra> = {};
    try {
      extra = JSON.parse(ts.extra) as Partial<SnapshotExtra>;
    } catch {
      // Ignore malformed optional render data and keep the authoritative state.
    }
    const items: string[] = [];
    for (const item of db.discoveredItem.iter()) if (item.roomCode === this.code) items.push(item.itemId);
    const log: Snapshot["log"] = [];
    for (const ev of db.gameEvent.iter()) {
      if (ev.roomCode !== this.code || commandFromTone(ev.tone) || ev.tone === "voice") continue;
      log.push({
        id: Number(ev.id),
        text: ev.text,
        tone: ev.tone === "good" || ev.tone === "bad" ? ev.tone : "info",
      });
    }
    const snap: Snapshot = {
      t: Number(ts.updatedAt),
      thief: [ts.x, ts.y, ts.z, ts.yaw],
      room: ts.area as Snapshot["room"],
      hp: ts.hp,
      alarm: ts.alarm,
      spotted: ts.spotted,
      keycard: ts.keycard,
      codeFound: ts.codeFound,
      vaultOpen: ts.vaultOpen,
      alarmDisabled: ts.alarmDisabled,
      escaped: ts.escaped,
      down: ts.hp <= 0,
      loot: ts.loot,
      score: ts.score,
      guards: {},
      cams: {},
      collected: [],
      doorsOpen: [],
      explored: [],
      discovered: items,
      log,
      ...extra,
    };
    for (const cb of this.listeners) cb({ type: "world", snap });
  }

  disconnect(): void {
    if (this.drawTimer) clearTimeout(this.drawTimer);
    this.drawTimer = null;
    for (const waiter of this.roomWaiters) waiter.reject(new Error("Disconnected from SpacetimeDB"));
    this.roomWaiters.clear();
    this.commandsReady = false;
    this.room = null;
    this.myId = "";
    this.identity = "";
    this.conn?.disconnect();
    this.conn = null;
    this.listeners.clear();
  }

  async createRoom(room: RoomState): Promise<RoomState | null> {
    const conn = this.conn;
    if (!conn) return null;
    try {
      await conn.reducers.createRoom({
        code: room.code,
        maxPlayers: room.maxPlayers,
        seed: room.seed,
        name: "Host",
      });
      return room;
    } catch {
      // The module refuses a code it already holds. That is the normal case
      // when the host reloads their own room - the room they wanted exists, so
      // hand it back and let the join below reclaim their seat, rather than
      // telling them their own room does not exist.
      const existing = conn.db.gameRoom.code.find(room.code);
      if (existing) return this.room ?? room;
      return null;
    }
  }

  async join(code: string, player: PlayerInfo): Promise<{ room: RoomState } | { error: JoinFailure }> {
    if (!this.conn) return { error: "notfound" };
    this.myId = `${code}:${this.identity}`;
    player.id = this.myId;
    try {
      await this.conn.reducers.joinRoom({ code, name: player.name });
      const room = await this.waitForRoom(
        (current) =>
          current.code === code &&
          current.players.some((candidate) => candidate.id === this.myId && candidate.name === player.name) &&
          (current.players.length < 2 || current.phase !== "lobby"),
      );
      return { room: this.room ?? room };
    } catch (error) {
      return { error: joinFailure(error) };
    }
  }

  leave(code: string): void {
    if (this.conn) void this.conn.reducers.leaveRoom({ code }).catch(() => {});
  }

  async start(code: string, playerId: string): Promise<StartResult> {
    void playerId;
    if (!this.conn) return { ok: false, error: "notfound" };
    try {
      await this.conn.reducers.startRun({ code });
      return { ok: true };
    } catch (error) {
      return startFailure(error);
    }
  }

  send(msg: NetMessage): void {
    if (!this.conn) return;
    if (msg.type === "world") {
      const snap = msg.snap;
      void this.conn.reducers.publishWorld({
        code: this.code,
        x: snap.thief[0],
        y: snap.thief[1],
        z: snap.thief[2],
        yaw: snap.thief[3],
        area: snap.room,
        hp: snap.hp,
        alarm: snap.alarm,
        spotted: snap.spotted,
        keycard: snap.keycard,
        codeFound: snap.codeFound,
        vaultOpen: snap.vaultOpen,
        alarmDisabled: snap.alarmDisabled,
        escaped: snap.escaped,
        loot: snap.loot,
        score: snap.score,
        extra: JSON.stringify({
          guards: snap.guards,
          cams: snap.cams,
          collected: snap.collected,
          doorsOpen: snap.doorsOpen,
          explored: snap.explored,
        }),
      });
    } else if (msg.type === "discover") {
      void this.conn.reducers.discoverItem({ code: this.code, itemId: msg.itemId });
    } else if (msg.type === "command") {
      void this.sendSpacetimeCommand(msg);
    } else if (msg.type === "powerup") {
      void this.conn.reducers.logEvent({
        code: this.code,
        tone: `powerup:${msg.effect}`,
        text: msg.by,
      });
    }
  }

  private async sendSpacetimeCommand(msg: Extract<NetMessage, { type: "command" }>) {
    const conn = this.conn;
    const code = this.code;
    if (!conn) return;

    try {
      await conn.reducers.logEvent({
        code,
        tone: `command:${msg.command}`,
        text: `command:${msg.by}`,
      });
    } catch {
      return;
    }

    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "synthesize", command: msg.command }),
      });
      if (!response.ok || this.conn !== conn) return;
      const result = (await response.json()) as { audioUrl?: string };
      if (!result.audioUrl) return;
      await conn.reducers.logEvent({
        code,
        tone: "voice",
        text: JSON.stringify({
          id: `${code}:${crypto.randomUUID()}`,
          command: msg.command,
          by: msg.by,
          audioUrl: result.audioUrl,
          t: Date.now(),
        }),
      });
    } catch {
      // Visual commands remain usable when the voice service is unavailable.
    }
  }

  onMessage(cb: (m: NetMessage) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
