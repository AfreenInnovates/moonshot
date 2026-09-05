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
  return message.toLowerCase().includes("full") ? "full" : "notfound";
};

const commandFromTone = (tone: string): CommandCode | null => {
  const value = tone.startsWith("command:") ? tone.slice("command:".length) : "";
  return COMMAND_CODES.includes(value as CommandCode) ? (value as CommandCode) : null;
};

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
        .withToken("")
        .onConnect((connectedConn, identity) => {
          void connectedConn;
          this.identity = identity.toHexString();
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
        const command = commandFromTone(row.tone);
        if (!command) return;
        const by = row.text.startsWith("command:") ? row.text.slice("command:".length) : `${this.code}:?`;
        for (const cb of this.listeners) cb({ type: "command", command, by, t: Number(row.at) });
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
      });
    }
    const state: RoomState = {
      code: r.code,
      hostId: `${this.code}:${r.host}`,
      maxPlayers: r.maxPlayers,
      phase: phase(r.phase),
      startsAt: Number(r.startsAt) || null,
      players,
      createdAt: Number(r.createdAt),
      seed: r.seed,
      result: r.result === "escaped" || r.result === "down" ? r.result : null,
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
      if (ev.roomCode !== this.code || commandFromTone(ev.tone)) continue;
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
    if (!this.conn) return null;
    try {
      await this.conn.reducers.createRoom({ code: room.code, maxPlayers: room.maxPlayers, seed: room.seed, name: "Host" });
      return room;
    } catch {
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
    if (this.conn) this.conn.reducers.leaveRoom({ code });
  }

  start(code: string): void {
    if (this.conn) this.conn.reducers.startRun({ code });
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
      // log_event already exists in the deployed module. A reserved tone keeps
      // commands realtime without requiring a production schema migration.
      void this.conn.reducers.logEvent({
        code: this.code,
        tone: `command:${msg.command}`,
        text: `command:${msg.by}`,
      });
    }
  }

  onMessage(cb: (m: NetMessage) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
