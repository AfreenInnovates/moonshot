"use client";

import { useEffect, useState } from "react";
import { useGame } from "./store";

interface PuzzleModalProps {
  itemLabel: string;
  roomName: string;
  onSuccess: () => void;
  onFailure: () => void;
}

interface PuzzleData {
  question: string;
  options: string[];
  correct: number;
}

export default function PuzzleModal({
  itemLabel,
  roomName,
  onSuccess,
  onFailure,
}: PuzzleModalProps) {
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const [loading, setLoading] = useState(true);
  const addIntel = useGame((s) => s.addIntel);
  const push = useGame((s) => s.push);

  useEffect(() => {
    let active = true;
    fetch("/api/puzzle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemLabel, roomName }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setPuzzle(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setPuzzle({
          question: "Scan failed. Override connection manually?",
          options: ["Override", "Reroute", "Abort"],
          correct: 0,
        });
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [itemLabel, roomName]);

  useEffect(() => {
    if (loading || !puzzle) return;
    if (timeLeft <= 0) {
      push("Puzzle timeout. No intel gained.", "bad");
      onFailure();
      return;
    }
    const tick = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(tick);
  }, [loading, puzzle, timeLeft, onFailure, push]);

  if (loading) {
    return (
      <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
        <div className="hud-panel w-[min(20rem,calc(100vw-2rem))] border-l-[#ffd23b] p-4 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffd23b]">
            Intercepting signal...
          </div>
          <div className="mt-2 text-xs text-zinc-400">Connecting to {itemLabel}</div>
        </div>
      </div>
    );
  }

  if (!puzzle) return null;

  const handleSelect = (index: number) => {
    if (index === puzzle.correct) {
      addIntel(50);
      push("+50 Intel Points!", "good");
      onSuccess();
    } else {
      push("Incorrect bypass. No intel gained.", "bad");
      onFailure();
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm">
      <div className="hud-panel w-[min(24rem,calc(100vw-2rem))] border-l-[#ffd23b] p-5 shadow-[4px_4px_0_#ffd23b]">
        <div className="mb-4 flex items-center justify-between border-b border-white/20 pb-3">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffd23b]">
            Discovery Override
          </span>
          <span className={`font-mono text-xs font-bold ${timeLeft <= 5 ? "text-[#ff6b73]" : "text-zinc-300"}`}>
            0:{timeLeft.toString().padStart(2, "0")}
          </span>
        </div>

        <h3 className="mb-6 text-sm font-bold uppercase text-zinc-100">
          {puzzle.question}
        </h3>

        <div className="flex flex-col gap-2">
          {puzzle.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              className="border border-white/20 bg-white/5 p-2.5 text-center text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/10 hover:text-white"
            >
              {opt}
            </button>
          ))}
        </div>

        {/* timer bar */}
        <div className="mt-4 h-1 w-full overflow-hidden bg-white/10">
          <div
            className="h-full bg-[#ffd23b] transition-all duration-1000 ease-linear"
            style={{ width: `${(timeLeft / 15) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
