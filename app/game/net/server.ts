"use client";

import type {
  JoinFailure,
  NetClient,
  NetMessage,
  PlayerInfo,
  RoomState,
} from "./types";

const API = "/api/rooms";

/**
 * Rooms live in the Next server, clients hold one server-sent-events stream
 * each. That means any browser - and any device pointed at this machine's
 * address - can join the same room, not just tabs of one browser.
 */
export class ServerNet implements NetClient {
  readonly kind = "server" as const;
  private es: EventSource | null = null;
  private listeners = new Set<(m: NetMessage) => void>();
  private code = "";

  async connect(code: string) {
    this.code = code;
    this.disconnectStream();
    await new Promise<void>((resolve) => {
      const es = new EventSource(`${API}/stream?code=${encodeURIComponent(code)}`);
      this.es = es;
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      es.onopen = done;
      es.onerror = done; // the polling fallbacks below still work
      es.onmessage = (e) => {
        const msg = JSON.parse(e.data) as NetMessage;
        for (const cb of this.listeners) cb(msg);
      };
      // never hang the UI on a slow stream
      setTimeout(done, 1500);
    });
  }

  private disconnectStream() {
    this.es?.close();
    this.es = null;
  }

  disconnect() {
    this.disconnectStream();
    this.listeners.clear();
  }

  private async post<T>(body: unknown): Promise<T | null> {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return (await res.json().catch(() => null)) as T | null;
      if (res.status === 204) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  async createRoom(room: RoomState) {
    const res = await this.post<{ room: RoomState }>({
      action: "create",
      room,
    });
    return res?.room ?? null;
  }

  async join(code: string, player: PlayerInfo) {
    const res = await this.post<{ room?: RoomState; error?: JoinFailure }>({
      action: "join",
      code,
      player,
    });
    if (res?.room) return { room: res.room };
    return { error: (res?.error ?? "notfound") as JoinFailure };
  }

  leave(code: string, playerId: string) {
    // keepalive so the request still goes out while the tab is closing
    try {
      navigator.sendBeacon?.(
        API,
        new Blob([JSON.stringify({ action: "leave", code, playerId })], {
          type: "application/json",
        }),
      );
    } catch {
      void this.post({ action: "leave", code, playerId });
    }
  }

  start(code: string) {
    void this.post({ action: "start", code });
  }

  send(msg: NetMessage) {
    void this.post({ action: "msg", code: this.code, msg });
  }

  onMessage(cb: (m: NetMessage) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
