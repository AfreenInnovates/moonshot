"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import GameShell from "../../game/GameShell";
import { roomById } from "../../game/level";
import { COUNTDOWN_MS, type RoomState } from "../../game/net/types";
import { resolveRoom, useSession } from "../../game/session";
import { useGame } from "../../game/store";

const NAME_KEY = "heist:name";

/** Read browser storage without tripping hydration or effect-ordering rules. */
const noSubscribe = () => () => {};
function useStored<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noSubscribe, read, () => serverValue);
}

function useCountdown(startsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startsAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 150);
    return () => clearInterval(t);
  }, [startsAt]);
  if (startsAt === null) return null;
  return Math.max(0, Math.ceil((startsAt - now) / 1000));
}

export default function RoomClient({ code }: { code: string }) {
  const connect = useSession((s) => s.connect);
  const leave = useSession((s) => s.leave);
  const startNow = useSession((s) => s.startNow);
  const status = useSession((s) => s.status);
  const rawRoom = useSession((s) => s.room);
  const myId = useSession((s) => s.myId);
  const isHost = useSession((s) => s.isHost);

  const [edited, setEdited] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  const readName = useCallback(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? "";
    } catch {
      return "";
    }
  }, []);
  const readSeat = useCallback(() => {
    try {
      const seat = sessionStorage.getItem(`heist:host:${code}`);
      return seat ? Number(seat) : null;
    } catch {
      return null;
    }
  }, [code]);

  const storedName = useStored(readName, "");
  const hostSize = useStored(readSeat, null);
  const name = edited ?? storedName;

  useEffect(() => () => leave(), [leave]);

  const countdown = useCountdown(
    rawRoom?.phase === "countdown" ? rawRoom.startsAt : null,
  );
  // the draw happens on the clock, not when the host's tab wakes up; the
  // countdown ticker above is what re-renders us as the clock runs out
  const room = resolveRoom(rawRoom);
  const me = room?.players.find((p) => p.id === myId) ?? null;

  // hand the drawn role to the game
  useEffect(() => {
    if (room?.phase !== "playing" || !me?.role) return;
    const game = useGame.getState();
    game.reset();
    game.setMode(
      me.role === "thief"
        ? { kind: "thief" }
        : { kind: "spectator", watching: me.watching ?? "lobby" },
    );
  }, [room?.phase, me?.role, me?.watching]);

  const join = async () => {
    const n = name.trim() || `player-${Math.floor(Math.random() * 900 + 100)}`;
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {
      /* ignore */
    }
    setJoining(true);
    const seed: RoomState | undefined =
      hostSize !== null
        ? {
            code,
            hostId: "",
            maxPlayers: hostSize,
            phase: "lobby",
            startsAt: null,
            players: [],
            createdAt: Date.now(),
            seed: Math.floor(Math.random() * 2 ** 31),
            result: null,
          }
        : undefined;
    await connect(code, n, seed);
    setJoining(false);
  };

  /* ---------------------------------------------------------------- gate */

  if (status === "idle") {
    return (
      <Frame code={code}>
        <div className="mb-4 inline-block border-2 border-[#111216] bg-[#e9ff4f] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-[3px_3px_0_#111216]">Access gate</div>
        <h1 className="text-4xl font-black uppercase leading-none tracking-[-0.06em] sm:text-5xl">
          {hostSize !== null ? "Open your room" : "Join room"}{" "}
          <span className="font-mono text-[#3b63ff]">{code}</span>
        </h1>
        <p className="mt-4 max-w-lg border-l-4 border-[#3b63ff] pl-4 text-sm font-medium leading-relaxed text-[#5a5960]">
          {hostSize !== null
            ? `Up to ${hostSize} players. Share the link once you are in.`
            : "Pick a name and drop in. Roles are drawn when the countdown ends."}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <input
            value={name}
            onChange={(e) => setEdited(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            placeholder="your name"
            maxLength={16}
            className="brutal-input w-56 px-3 py-3 text-sm font-bold outline-none"
          />
          <button
            onClick={join}
            disabled={joining}
            className="brutal-button px-5 py-3 disabled:cursor-wait disabled:opacity-50"
          >
            {joining ? "Connecting..." : hostSize !== null ? "Open room ->" : "Join ->"}
          </button>
        </div>
      </Frame>
    );
  }

  if (status === "connecting") {
    return (
      <Frame code={code}>
        <div className="flex items-center gap-3 border-2 border-[#111216] bg-[#e9ff4f] p-4 shadow-[4px_4px_0_#111216]">
          <span className="signal-pulse h-3 w-3 rounded-full bg-[#3b63ff]" />
          <div><p className="text-xs font-black uppercase tracking-widest">Opening secure room</p><p className="mt-1 text-xs font-medium text-[#4e4d53]">Finding the facility signal for {code}...</p></div>
        </div>
      </Frame>
    );
  }

  if (status === "notfound" || status === "full") {
    return (
      <Frame code={code}>
        <div className="mb-4 inline-block border-2 border-[#111216] bg-[#ff5b55] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-[3px_3px_0_#111216]">Signal error</div>
        <h1 className="text-4xl font-black uppercase leading-none tracking-[-0.06em] sm:text-5xl">
          {status === "full" ? "That room is full" : "No such room"}
        </h1>
        <p className="mt-4 max-w-lg border-l-4 border-[#ff5b55] pl-4 text-sm font-medium leading-relaxed text-[#5a5960]">
          {status === "full"
            ? "Every seat is taken. Ask the host to start a new one."
            : "Nobody is hosting this code in this browser. Rooms live in the tab that created them."}
        </p>
        <Link
          href="/rooms"
          className="brutal-button mt-8 px-5 py-3"
        >
          Back to rooms -&gt;
        </Link>
      </Frame>
    );
  }

  /* --------------------------------------------------------------- game */

  if (room?.phase === "playing" && me?.role) {
    return (
      <main className="relative flex-1">
        <GameShell
          title={
            me.role === "thief"
              ? `Thief · room ${code}`
              : `${roomById(me.watching ?? "lobby").name} · room ${code}`
          }
        />
      </main>
    );
  }

  /* -------------------------------------------------------------- lobby */

  const link =
    typeof window !== "undefined" ? `${location.origin}/room/${code}` : "";

  return (
    <Frame code={code}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-[#111216] pb-5">
        <div><div className="mb-3 inline-block bg-[#111216] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#e9ff4f]">Crew lobby / live</div><h1 className="text-4xl font-black uppercase leading-none tracking-[-0.06em] sm:text-5xl">
          Room <span className="font-mono text-[#3b63ff]">{code}</span>
        </h1>
        </div><span className="border-2 border-[#111216] bg-[#e9ff4f] px-3 py-2 text-[11px] font-black uppercase tracking-widest shadow-[3px_3px_0_#111216]">
          {room ? `${room.players.length}/${room.maxPlayers} players` : "..."}
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          readOnly
          value={link}
          className="brutal-input w-full max-w-xl px-3 py-3 font-mono text-xs text-[#5a5960] outline-none sm:flex-1"
        />
        <button
          onClick={() => {
            navigator.clipboard?.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="brutal-button px-4 py-3"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {room?.players.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between border-2 border-[#111216] bg-[#fffdf7] px-4 py-3 text-sm shadow-[3px_3px_0_#111216]"
          >
            <span className={p.id === myId ? "font-black text-[#111216]" : "font-semibold text-[#5a5960]"}>
              {p.name}
              {p.id === room.hostId && (
                <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-[#3b63ff]">
                  host
                </span>
              )}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#24a866]">
              {p.id === myId ? "you" : "ready"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        {room?.phase === "countdown" ? (
          <div className="flex items-baseline gap-3 border-2 border-[#111216] bg-[#111216] px-4 py-3 text-[#f2eee5] shadow-[4px_4px_0_#3b63ff]">
            <span className="font-mono text-5xl font-black text-[#e9ff4f]">
              {countdown ?? Math.ceil(COUNTDOWN_MS / 1000)}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#f2eee5]/70">
              draw at zero
            </span>
          </div>
        ) : (
          <span className="border-l-4 border-[#3b63ff] pl-3 text-xs font-bold text-[#5a5960]">
            Waiting for one more player...
          </span>
        )}
        {isHost && room?.phase !== "playing" && (
          <button
            onClick={startNow}
            className="brutal-button-dark bg-[#111216] px-4 py-3"
          >
            Start now -&gt;
          </button>
        )}
      </div>

      <p className="mt-8 max-w-lg border-t border-[#111216]/20 pt-4 text-[11px] font-semibold leading-relaxed text-[#6c6b70]">
        One player is drawn as the thief and walks in from the street. Everyone
        else is posted to a single room - lobby, security or vault - and can only
        see that one. Talk to each other; the thief cannot see any of the
        security layer.
      </p>
    </Frame>
  );
}

function Frame({ code, children }: { code: string; children: React.ReactNode }) {
  return (
    <main className="brutal-grid relative min-h-0 flex-1 overflow-y-auto text-[#111216]">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-5 sm:px-8 sm:py-8">
        <Link
          href="/rooms"
          className="border-b-2 border-[#111216] pb-4 text-[11px] font-black uppercase tracking-[0.18em] hover:text-[#3b63ff]"
        >
          &lt;- rooms
        </Link>
        <div className="mt-12 max-w-3xl">{children}</div>
        <div className="mt-auto pt-16 text-[10px] font-bold uppercase tracking-[0.16em] text-[#77757a]">
          room / {code} / local signal
        </div>
      </div>
    </main>
  );
}
