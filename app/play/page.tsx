"use client";

import { useEffect } from "react";
import GameShell from "../game/GameShell";
import { useGame } from "../game/store";

export default function PlayPage() {
  useEffect(() => {
    const g = useGame.getState();
    g.setMode({ kind: "solo" });
    g.reset();
  }, []);

  return (
    <main className="relative flex-1">
      <GameShell title="Solo sandbox" />
    </main>
  );
}
