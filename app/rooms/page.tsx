"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MAX_PLAYERS, newCode } from "../game/net/types";

export default function RoomsPage() {
  const router = useRouter();
  const [size, setSize] = useState(4);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  // arriving from a "Join a room" button: put the cursor where it is wanted
  useEffect(() => {
    if (window.location.hash !== "#join") return;
    codeInput.current?.scrollIntoView({ block: "center" });
    codeInput.current?.focus();
  }, []);

  const create = () => {
    const c = newCode();
    try {
      sessionStorage.setItem(`heist:host:${c}`, String(size));
    } catch {
      /* private mode: the room still works, just not across a refresh */
    }
    router.push(`/room/${c}`);
  };

  const join = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) {
      setError("That does not look like a room code.");
      return;
    }
    router.push(`/room/${c}`);
  };

  return (
    <main className="brutal-grid relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto text-[#111216]">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col px-5 py-5 sm:px-8 sm:py-8">
        <nav className="flex items-center justify-between border-b-2 border-[#111216] pb-4">
          <Link
            href="/"
            className="text-[11px] font-black uppercase tracking-[0.18em] hover:text-[#3b63ff]"
          >
            &lt;- back to base
          </Link>
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]"><span className="signal-pulse h-2 w-2 rounded-full bg-[#24d17e]" /> room control</span>
        </nav>

        <header className="grid gap-6 py-10 lg:grid-cols-[1fr_0.7fr] lg:items-end lg:py-16">
          <div>
            <div className="mb-4 inline-block border-2 border-[#111216] bg-[#e9ff4f] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] shadow-[3px_3px_0_#111216]">Lobby terminal / 02</div>
            <h1 className="text-5xl font-black uppercase leading-[0.88] tracking-[-0.07em] sm:text-7xl">Set the<br /><span className="text-[#3b63ff]">crew loose.</span></h1>
          </div>
          <p className="max-w-md border-l-4 border-[#3b63ff] pl-4 text-sm font-medium leading-relaxed text-[#4e4d53]">Create a room, share the code, then wait for a second player. The facility starts drawing roles as soon as the crew is in.</p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="brutal-panel p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b-2 border-[#111216] pb-4">
              <div><h2 className="text-xs font-black uppercase tracking-[0.2em]">New room</h2><p className="mt-2 text-sm font-medium text-[#5a5960]">You are the operator. Choose how many seats the run needs.</p></div>
              <span className="font-mono text-xs font-bold text-[#3b63ff]">CREATE_01</span>
            </div>
            <div className="mt-6 flex flex-wrap items-end gap-5">
              <label className="flex flex-col gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#5a5960]">
                Players
                </span>
              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="brutal-input w-full max-w-64 px-3 py-3 text-sm font-bold outline-none"
              >
                {Array.from({ length: MAX_PLAYERS - 1 }, (_, i) => i + 2).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n} players — 1 thief, {n - 1} spectator
                      {n - 1 > 1 ? "s" : ""}
                    </option>
                  ),
                )}
              </select>
            </label>
            <button
              onClick={create}
              className="brutal-button px-5 py-3"
            >
              Open room -&gt;
            </button>
            </div>
            <p className="mt-6 max-w-lg border-t border-[#111216]/20 pt-4 text-[11px] font-semibold leading-relaxed text-[#6c6b70]">Three spectators cover every room: lobby, security, vault. Fewer players means some rooms go unwatched. You can still start with two.</p>
          </section>

          <section id="join" className="brutal-panel-dark scroll-mt-6 p-5 text-[#f2eee5] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-[#f2eee5]/30 pb-4"><div><h2 className="text-xs font-black uppercase tracking-[0.2em]">Join with a code</h2><p className="mt-2 text-sm font-medium text-[#f2eee5]/65">Already have a crew? Drop into their signal.</p></div><span className="font-mono text-xs font-bold text-[#e9ff4f]">JOIN_02</span></div>
            <div className="mt-6 flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-2"><span className="text-[10px] font-black uppercase tracking-widest text-[#f2eee5]/60">Room code</span><input ref={codeInput} value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(null); }} onKeyDown={(e) => e.key === "Enter" && join()} placeholder="ABCDE" maxLength={6} className="w-40 border-2 border-[#f2eee5] bg-transparent px-3 py-3 font-mono text-sm tracking-[0.3em] text-[#f2eee5] outline-none placeholder:text-[#f2eee5]/30 focus:border-[#e9ff4f]" /></label>
              <button onClick={join} className="brutal-button-dark min-h-12 px-5 py-3">Join -&gt;</button>
            </div>
            {error && <p className="mt-4 border-l-2 border-[#ff5b55] pl-3 text-[11px] font-bold text-[#ff8b86]">{error}</p>}
          </section>
        </div>

        <section className="grid gap-4 py-10 sm:grid-cols-3">
          {[['01', 'Make the room', 'Pick the number of seats and open the facility.'], ['02', 'Share the signal', 'Copy the generated room link and send it to your crew.'], ['03', 'Watch the draw', 'Two players starts the clock. Roles are hidden until zero.']].map(([n, title, text]) => <div key={n} className="border-t-2 border-[#111216] pt-4"><span className="font-mono text-sm font-bold text-[#3b63ff]">{n}</span><h3 className="mt-2 text-sm font-black uppercase tracking-wide">{title}</h3><p className="mt-2 text-xs font-medium leading-relaxed text-[#66656a]">{text}</p></div>)}
        </section>
      </div>
    </main>
  );
}
