"use client";

import { useEffect, useRef } from "react";
import { ESCAPE_Z, PATROLS, ROOMS, roomById, type RoomId } from "../level";
import { guardState, runtime } from "../runtime";
import { useGame } from "../store";

const MIN_X = -23.5;
const MAX_X = 23.5;
const MIN_Z = -11;
const MAX_Z = 20;
const W = MAX_X - MIN_X;
const H = MAX_Z - MIN_Z;

const sx = (x: number) => x - MIN_X;
const sy = (z: number) => z - MIN_Z;

const PLAN: RoomId[] = ["sec", "wcorr", "lobby", "ecorr", "vault", "entry", "annex"];

const SHORT: Partial<Record<RoomId, string>> = {
  sec: "SEC",
  wcorr: "W",
  lobby: "LOBBY",
  ecorr: "E",
  vault: "VAULT",
  entry: "ENTRY",
  annex: "VAULT",
};

/** Flat floorplan with a dot for the thief. Reads runtime directly at 20hz. */
export default function Minimap() {
  const mode = useGame((s) => s.mode);
  const thiefRoom = useGame((s) => s.room);
  const watching = mode.kind === "spectator" ? mode.watching : null;
  // the thief must not get guard positions for free
  const showGuards = mode.kind !== "thief";
  const thief = useRef<SVGCircleElement>(null);
  const thiefDirection = useRef<SVGLineElement>(null);
  const guards = useRef<(SVGCircleElement | null)[]>([]);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 50) return;
      last = t;
      if (thief.current) {
        thief.current.setAttribute("cx", String(sx(runtime.thief.x)));
        thief.current.setAttribute("cy", String(sy(runtime.thief.z)));
      }
      if (thiefDirection.current) {
        const length = 2.6;
        thiefDirection.current.setAttribute("x1", String(sx(runtime.thief.x)));
        thiefDirection.current.setAttribute("y1", String(sy(runtime.thief.z)));
        thiefDirection.current.setAttribute(
          "x2",
          String(sx(runtime.thief.x) + Math.sin(runtime.thiefYaw) * length),
        );
        thiefDirection.current.setAttribute(
          "y2",
          String(sy(runtime.thief.z) + Math.cos(runtime.thiefYaw) * length),
        );
      }
      PATROLS.forEach((p, i) => {
        const el = guards.current[i];
        if (!el) return;
        const g = guardState(p.id);
        el.setAttribute("cx", String(sx(g.pos.x)));
        el.setAttribute("cy", String(sy(g.pos.z)));
        const visible =
          showGuards && (watching ? watching === p.room : true);
        el.setAttribute("opacity", visible ? "0.9" : "0");
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [watching, showGuards]);

  return (
    <div className="hud-panel hud-panel-blue p-2">
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-widest text-zinc-500">
        <span>Floorplan</span>
        <span className="text-zinc-400">{thiefRoom}</span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-[132px] w-[196px] overflow-visible"
        role="img"
        aria-label="Facility floorplan"
      >
        {/* street / approach */}
        <rect
          x={sx(-14)}
          y={sy(10.5)}
          width={28}
          height={9}
          fill="#12161c"
          stroke="#2a313a"
          strokeWidth={0.2}
        />
        <g stroke="#606b79" strokeWidth={0.28} strokeDasharray="0.8 0.55" opacity={0.7}>
          <path d={`M ${sx(-15)} ${sy(0)} L ${sx(0)} ${sy(0)} L ${sx(15)} ${sy(0)}`} fill="none" />
          <path d={`M ${sx(0)} ${sy(0)} L ${sx(0)} ${sy(8.7)}`} fill="none" />
          <path d={`M ${sx(15)} ${sy(0)} L ${sx(15)} ${sy(-8.5)}`} fill="none" />
        </g>
        {PLAN.map((id) => {
          const r = ROOMS.find((x) => x.id === id)!;
          const b = r.bounds;
          const mine = watching === id;
          return (
            <g key={id}>
              <rect
                x={sx(b.minX)}
                y={sy(b.minZ)}
                width={b.maxX - b.minX}
                height={b.maxZ - b.minZ}
                fill={mine ? "#1d2b24" : "#171c23"}
                stroke={mine ? "#39ff88" : "#39414d"}
                strokeWidth={mine ? 0.5 : 0.25}
              />
              <text
                x={sx((b.minX + b.maxX) / 2)}
                y={sy((b.minZ + b.maxZ) / 2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={mine ? "#baffd4" : "#697382"}
                fontSize={id === "lobby" || id === "vault" || id === "entry" ? 1.45 : 1.1}
                fontFamily="monospace"
                fontWeight="700"
              >
                {SHORT[id]}
              </text>
            </g>
          );
        })}

        {/* extraction */}
        <circle
          cx={sx(0)}
          cy={sy(ESCAPE_Z + 2)}
          r={1.1}
          fill="none"
          stroke="#39ff88"
          strokeWidth={0.35}
        />

        {PATROLS.map((p, i) => (
          <circle
            key={p.id}
            ref={(el) => {
              guards.current[i] = el;
            }}
            r={0.8}
            fill="#4aa8ff"
            opacity={0}
          />
        ))}

        <line
          ref={thiefDirection}
          x1={sx(0)}
          y1={sy(0)}
          x2={sx(0)}
          y2={sy(2.6)}
          stroke="#ffd23b"
          strokeWidth={0.45}
          strokeLinecap="square"
        />
        <circle ref={thief} r={1.05} fill="#ffd23b" stroke="#000" strokeWidth={0.2} />
      </svg>
      <div className="mt-1 flex gap-3 text-[9px] text-zinc-500">
        <span className="text-yellow-300">● thief</span>
        <span className="text-yellow-300">→ heading</span>
        {showGuards && <span className="text-sky-400">● guard</span>}
        {watching && <span className="text-emerald-400">▭ your room</span>}
      </div>
      <div className="mt-1 text-[9px] uppercase tracking-widest text-zinc-600">
        {roomById(thiefRoom).name} / live position
      </div>
    </div>
  );
}
