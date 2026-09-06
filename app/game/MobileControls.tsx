"use client";

import { useEffect, useRef, useState } from "react";
import {
  requestVirtualUse,
  resetVirtualInput,
  setVirtualMove,
  setVirtualSprint,
} from "./input";

const HINT_KEY = "heist:mobile-joystick-hint:v1";
const MAX_DISTANCE = 40;

export function useTouchDevice() {
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    setTouch(media.matches || navigator.maxTouchPoints > 0);
  }, []);

  return touch;
}

function VirtualJoystick() {
  const base = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const update = (clientX: number, clientY: number) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.hypot(dx, dy);
    const scale = distance > MAX_DISTANCE ? MAX_DISTANCE / distance : 1;
    const x = (dx * scale) / MAX_DISTANCE;
    const y = (dy * scale) / MAX_DISTANCE;
    setKnob({ x, y });
    // Screen-up is forward; Thief.tsx still maps this vector through the camera.
    setVirtualMove(x, -y);
  };

  const stop = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    setVirtualMove(0, 0);
  };

  return (
    <div
      ref={base}
      role="application"
      aria-label="Virtual movement joystick"
      className="mobile-joystick z-40 grid h-28 w-28 place-items-center rounded-full border-2 border-white/35 bg-[#111216]/75 shadow-[4px_4px_0_rgba(0,0,0,0.45)]"
      onPointerDown={(event) => {
        event.preventDefault();
        pointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (pointer.current !== event.pointerId) return;
        event.preventDefault();
        update(event.clientX, event.clientY);
      }}
      onPointerUp={(event) => {
        if (pointer.current !== event.pointerId) return;
        event.preventDefault();
        stop();
      }}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      <span className="pointer-events-none absolute h-16 w-16 rounded-full border border-white/15" />
      <span
        className="pointer-events-none h-10 w-10 rounded-full border-2 border-[#e9ff4f] bg-[#e9ff4f]/25 shadow-[0_0_18px_rgba(233,255,79,0.35)]"
        style={{ transform: `translate(${knob.x * 36}px, ${knob.y * 36}px)` }}
      />
      <span className="pointer-events-none absolute bottom-2 text-[8px] font-black uppercase tracking-[0.16em] text-white/55">
        move
      </span>
    </div>
  );
}

function MobileHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, "shown");
      setVisible(true);
      const timeout = window.setTimeout(() => setVisible(false), 6500);
      return () => window.clearTimeout(timeout);
    } catch {
      setVisible(false);
    }
  }, []);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed bottom-[calc(8rem+env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-30 max-w-[12rem] border border-[#e9ff4f] bg-[#111216]/95 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#e9ff4f] shadow-[3px_3px_0_rgba(0,0,0,0.45)]">
      Use the joystick to move.
    </div>
  );
}

export default function MobileControls({
  enabled,
  showUse,
  prompt,
}: {
  enabled: boolean;
  showUse: boolean;
  prompt: string | null;
}) {
  const touch = useTouchDevice();
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!touch || !enabled) resetVirtualInput();
    return () => resetVirtualInput();
  }, [enabled, touch]);

  if (!touch || !enabled) return null;

  return (
    <>
      <VirtualJoystick />
      <div className="mobile-action-controls fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex flex-col items-end gap-2">
        {showUse && (
          <button
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              requestVirtualUse();
            }}
            className="min-h-14 min-w-24 border-2 border-[#e9ff4f] bg-[#111216]/90 px-3 py-2 text-right text-[#e9ff4f] shadow-[4px_4px_0_rgba(0,0,0,0.45)] active:translate-y-0.5"
          >
            <span className="block text-xs font-black uppercase tracking-widest">Use</span>
            <span className="mt-1 block max-w-32 truncate text-[9px] font-medium text-white/70">{prompt}</span>
          </button>
        )}
        <button
          type="button"
          aria-pressed={running}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setRunning(true);
            setVirtualSprint(true);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            setRunning(false);
            setVirtualSprint(false);
          }}
          onPointerCancel={() => {
            setRunning(false);
            setVirtualSprint(false);
          }}
          onLostPointerCapture={() => {
            setRunning(false);
            setVirtualSprint(false);
          }}
          className={`min-h-12 min-w-24 border-2 px-3 py-2 text-xs font-black uppercase tracking-widest shadow-[4px_4px_0_rgba(0,0,0,0.45)] ${running ? "border-[#e9ff4f] bg-[#e9ff4f] text-[#111216]" : "border-white/45 bg-[#111216]/90 text-white"}`}
        >
          Run
        </button>
      </div>
      <MobileHint />
    </>
  );
}
