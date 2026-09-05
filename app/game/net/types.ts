import type { RoomId } from "../level";
import type { CommandCode } from "../commands";

export type Role = "thief" | "spectator";
export type Phase = "lobby" | "countdown" | "playing" | "ended";

/** Rooms a spectator can be posted to. One each, no overlap while there are seats. */
export const WATCHABLE: RoomId[] = ["lobby", "sec", "vault"];

export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const COUNTDOWN_MS = 10_000;
export const SPECTATOR_REJOIN_MS = 20_000;

export type RoomResult = "escaped" | "down" | "thief-left" | "spectator-left";

export interface PlayerInfo {
  id: string;
  name: string;
  role: Role | null;
  /** the single room this spectator is posted to */
  watching: RoomId | null;
  joinedAt: number;
  /** Set by the authoritative transport while a spectator is in grace. */
  connected?: boolean;
  rejoinUntil?: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  maxPlayers: number;
  phase: Phase;
  /** epoch ms the run begins, while phase === "countdown" */
  startsAt: number | null;
  players: PlayerInfo[];
  createdAt: number;
  /** shared randomness for the role draw */
  seed: number;
  result: RoomResult | null;
}

export interface VoiceTransmission {
  id: string;
  command: CommandCode;
  by: string;
  audioUrl: string;
  t: number;
}

/** Everything a viewer needs to draw the run. Published by the thief's client. */
export interface Snapshot {
  t: number;
  /** x, y, z, yaw */
  thief: [number, number, number, number];
  room: RoomId;
  hp: number;
  alarm: number;
  spotted: boolean;
  /** patrol id -> x, z, yaw */
  guards: Record<string, [number, number, number]>;
  /** camera id -> yaw */
  cams: Record<string, number>;
  keycard: boolean;
  codeFound: boolean;
  vaultOpen: boolean;
  alarmDisabled: boolean;
  escaped: boolean;
  down: boolean;
  loot: number;
  score: number;
  collected: string[];
  discovered: string[];
  doorsOpen: string[];
  explored: RoomId[];
  log: { id: number; text: string; tone: "info" | "good" | "bad" }[];
}

export type NetMessage =
  /** a client announcing itself to the host */
  | { type: "hello"; player: PlayerInfo }
  /** the host's authoritative room record */
  | { type: "room"; room: RoomState }
  /** the thief's client publishing the world */
  | { type: "world"; snap: Snapshot }
  /** a spectator scanning something hidden */
  | { type: "discover"; itemId: string; by: string }
  /** a spectator sending a short call sign to the thief */
  | { type: "command"; command: CommandCode; by: string; t: number }
  /** a server-hosted TTS reference for the same room-scoped command */
  | ({ type: "voice" } & VoiceTransmission)
  | { type: "bye"; id: string };

export type JoinFailure = "notfound" | "full" | "unavailable";
export type StartFailure = "notfound" | "not-host" | "not-ready" | "started";
export type StartResult =
  | { ok: true }
  | { ok: false; error: StartFailure };

/**
 * One transport, so the game does not care whether rooms live in this Next
 * server's memory or in a SpacetimeDB module. Each method maps onto one
 * reducer on the SpacetimeDB side.
 */
export interface NetClient {
  readonly kind: "server" | "spacetime";
  /** open the live stream for a room */
  connect(code: string): Promise<void>;
  disconnect(intentional?: boolean): void;
  createRoom(room: RoomState): Promise<RoomState | null>;
  join(
    code: string,
    player: PlayerInfo,
  ): Promise<{ room: RoomState } | { error: JoinFailure }>;
  leave(code: string, playerId: string): void;
  start(code: string, playerId: string): Promise<StartResult>;
  /** fan-out only: world snapshots and scans */
  send(msg: NetMessage): void;
  onMessage(cb: (m: NetMessage) => void): () => void;
}

export const newCode = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 5; i++)
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

export const newId = () =>
  `p_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
