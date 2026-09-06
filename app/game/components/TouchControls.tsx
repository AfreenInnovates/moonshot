"use client";

import { useEffect, useRef, useState } from "react";
import { pressJump, pressUse } from "../controls";
import { runtime } from "../runtime";
import { useGame } from "../store";

/**
 * Phone controls for the thief: a stick on the left thumb, look on the right.
 *
 * Both halves write straight into `runtime`, which is where the simulation
 * already reads input from - nothing here re-renders React per frame. Each
 * surface tracks its own pointer id, so a thumb on the stick and a thumb on the
 * look pad do not steal each other's moves.
 */

const STICK_RADIUS = 56;

function Stick() {
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  useEffect(() => {
    const el = base.current;
    if (!el) return;

    const setKnob = (dx: number, dy: number) => {
      if (knob.current)
        knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    };

    const move = (e: PointerEvent) => {
      if (pointer.current !== e.pointerId) return;
      const r = el.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) {
        dx = (dx / len) * STICK_RADIUS;
        dy = (dy / len) * STICK_RADIUS;
      }
      setKnob(dx, dy);
      // screen-down is "back", so y is inverted into forward/back
      runtime.touchMove.x = dx / STICK_RADIUS;
      runtime.touchMove.y = -dy / STICK_RADIUS;
    };

    const end = (e: PointerEvent) => {
      if (pointer.current !== e.pointerId) return;
      pointer.current = null;
      runtime.touchMove.x = 0;
      runtime.touchMove.y = 0;
      setKnob(0, 0);
    };

    const start = (e: PointerEvent) => {
      pointer.current = e.pointerId;
      el.setPointerCapture(e.pointerId);
      move(e);
    };

    el.addEventListener("pointerdown", start);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return () => {
      el.removeEventListener("pointerdown", start);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
      runtime.touchMove.x = 0;
      runtime.touchMove.y = 0;
    };
  }, []);

  return (
    <div
      ref={base}
      aria-label="Move"
      className="pointer-events-auto relative grid h-[132px] w-[132px] touch-none place-items-center rounded-full border-2 border-white/25 bg-black/35 backdrop-blur-sm"
    >
      <div className="absolute inset-3 rounded-full border border-white/10" />
      <div
        ref={knob}
        className="h-14 w-14 rounded-full border-2 border-[#e9ff4f] bg-[#e9ff4f]/25"
      />
      <span className="pointer-events-none absolute -top-5 text-[9px] font-black uppercase tracking-[0.18em] text-white/45">
        move
      </span>
    </div>
  );
}

/** Everything not under a control is a look surface. */
function LookPad() {
  const pad = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = pad.current;
    if (!el) return;

    const start = (e: PointerEvent) => {
      if (pointer.current !== null) return;
      pointer.current = e.pointerId;
      last.current = { x: e.clientX, y: e.clientY };
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (pointer.current !== e.pointerId) return;
      runtime.touchLook.dx += e.clientX - last.current.x;
      runtime.touchLook.dy += e.clientY - last.current.y;
      last.current = { x: e.clientX, y: e.clientY };
    };
    const end = (e: PointerEvent) => {
      if (pointer.current !== e.pointerId) return;
      pointer.current = null;
    };

    el.addEventListener("pointerdown", start);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    return () => {
      el.removeEventListener("pointerdown", start);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", end);
      el.removeEventListener("pointercancel", end);
    };
  }, []);

  return (
    <div
      ref={pad}
      aria-label="Look around"
      className="pointer-events-auto absolute inset-0 touch-none"
    />
  );
}

function ActionButton({
  label,
  hint,
  color,
  onPress,
}: {
  label: string;
  hint?: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        onPress();
      }}
      className="pointer-events-auto grid h-[74px] w-[74px] touch-none place-items-center rounded-full border-2 bg-black/45 backdrop-blur-sm active:scale-95"
      style={{ borderColor: color }}
    >
      <span
        className="text-[11px] font-black uppercase tracking-[0.08em]"
        style={{ color }}
      >
        {label}
      </span>
      {hint && (
        <span className="text-[8px] font-bold uppercase tracking-wider text-white/50">
          {hint}
        </span>
      )}
    </button>
  );
}

export default function TouchControls() {
  const prompt = useGame((s) => s.prompt);
  const hp = useGame((s) => s.hp);
  const escaped = useGame((s) => s.escaped);
  // only label the interact button with what it would actually do
  const [action, setAction] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => {
      const kind = runtime.useTarget?.kind ?? null;
      setAction(kind === "vent" ? "vent" : kind);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  if (hp <= 0 || escaped) return null;
  const ventHere = action === "vent";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <LookPad />

      {/* the prompt sits above the thumbs where it can be read mid-move */}
      {prompt && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[188px] flex justify-center px-4">
          <div className="border border-yellow-400/60 bg-black/85 px-3 py-1.5 text-center text-[11px] font-semibold text-yellow-200">
            {prompt}
          </div>
        </div>
      )}

      <div className="absolute bottom-5 left-4">
        <Stick />
      </div>

      <div className="absolute bottom-5 right-4 flex flex-col items-end gap-3">
        <ActionButton
          label="E"
          hint="use"
          color={action === "keypad" || action === "alarm" ? "#ffd23b" : "#8b94a1"}
          onPress={pressUse}
        />
        <ActionButton
          label={ventHere ? "EXIT" : "JUMP"}
          hint={ventHere ? "vent" : undefined}
          color={ventHere ? "#39ff88" : "#e9ff4f"}
          onPress={pressJump}
        />
      </div>
    </div>
  );
}
