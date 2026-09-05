"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isPuzzle, puzzleFor, type Puzzle } from "./puzzles";
import { useGame } from "./store";

interface PuzzleModalProps {
  itemId: string;
  itemLabel: string;
  roomName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const SECONDS = 20;
/** How long the AI route gets before the local puzzle is the one you play. */
const AI_GRACE_MS = 1500;

export default function PuzzleModal({
  itemId,
  itemLabel,
  roomName,
  onSuccess,
  onCancel,
}: PuzzleModalProps) {
  const [attempt, setAttempt] = useState(0);
  // there is always a puzzle on screen: the local bank answers instantly and
  // the AI route only ever replaces it before the first tap
  const [puzzle, setPuzzle] = useState<Puzzle>(() => puzzleFor(itemId));
  const [wrong, setWrong] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(SECONDS);
  const touched = useRef(false);
  const addIntel = useGame((s) => s.addIntel);
  const push = useGame((s) => s.push);

  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const giveUp = window.setTimeout(() => abort.abort(), AI_GRACE_MS);
    fetch("/api/puzzle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, itemLabel, roomName }),
      signal: abort.signal,
    })
      .then((res) => res.json())
      .then((data: unknown) => {
        // swapping the question out from under someone mid-answer is worse
        // than showing them the local one, so this only lands untouched
        if (!active || touched.current || !isPuzzle(data)) return;
        setPuzzle({ ...data, hint: data.hint || `${itemLabel} - ${roomName}` });
      })
      .catch(() => {
        /* the local puzzle already on screen is the fallback */
      })
      .finally(() => window.clearTimeout(giveUp));
    return () => {
      active = false;
      abort.abort();
      window.clearTimeout(giveUp);
    };
  }, [itemId, itemLabel, roomName]);

  const cancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  useEffect(() => {
    if (timeLeft <= 0) {
      push("Scan timed out. Tap the blip to try again.", "bad");
      cancel();
      return;
    }
    const tick = window.setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearTimeout(tick);
  }, [timeLeft, cancel, push]);

  const select = (index: number) => {
    touched.current = true;
    if (index === puzzle.correct) {
      addIntel(50);
      push(`+50 intel - ${itemLabel} identified`, "good");
      onSuccess();
      return;
    }
    // a wrong tap costs time, not the scan: reshuffle and let them read again
    setWrong(index);
    const next = attempt + 1;
    setAttempt(next);
    window.setTimeout(() => {
      setPuzzle(puzzleFor(itemId, next));
      setWrong(null);
    }, 500);
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="hud-panel w-[min(26rem,calc(100vw-2rem))] border-l-[#ffd23b] p-5 shadow-[4px_4px_0_#ffd23b]">
        <div className="mb-3 flex items-center justify-between border-b border-white/20 pb-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffd23b]">
            Scan / {roomName}
          </span>
          <span
            className={`font-mono text-xs font-bold ${
              timeLeft <= 5 ? "text-[#ff6b73]" : "text-zinc-300"
            }`}
          >
            0:{timeLeft.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
          {itemLabel}
        </div>
        <h3 className="mt-2 text-sm font-bold leading-snug text-zinc-100">
          {puzzle.question}
        </h3>
        {puzzle.hint && (
          <p className="mt-2 border-l-2 border-[#ffd23b]/50 pl-2 text-[11px] leading-snug text-zinc-400">
            {puzzle.hint}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {puzzle.options.map((opt, i) => (
            <button
              key={`${attempt}-${i}`}
              onClick={() => select(i)}
              disabled={wrong !== null}
              className={`border p-2.5 text-center text-xs font-bold uppercase tracking-wider transition disabled:cursor-not-allowed ${
                wrong === i
                  ? "border-[#ff6b73] bg-[#ff6b73]/15 text-[#ff6b73]"
                  : "border-white/20 bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {wrong !== null
              ? "Not that one - reading again"
              : attempt > 0
                ? "Try again - answers moved"
                : "+50 intel if you get it"}
          </span>
          <button
            onClick={cancel}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-200"
          >
            Cancel
          </button>
        </div>

        {/* timer bar */}
        <div className="mt-3 h-1 w-full overflow-hidden bg-white/10">
          <div
            className="h-full bg-[#ffd23b] transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / SECONDS) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
