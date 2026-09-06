import Link from "next/link";
import Image from "next/image";
import mascotImg from "../ChatGPT Image Sep 6, 2026, 12_03_22 AM.png";
import LandingCounter from "./components/LandingCounter";
import AuthControls from "./components/AuthControls";

/* ── data ─────────────────────────────────────────────────────────────── */

const STEPS = [
  "Create a room and share the link. Up to four players.",
  "Ten second countdown \u2013 roles are drawn at random.",
  "One thief walks in from the street.",
  "Spectators scan their room and call out what they find.",
  "The thief hears it and acts on it.",
  "Keycard, then the vault code, then the vault.",
  "Get back out to the street.",
];

/* ── page ─────────────────────────────────────────────────────────────── */

export default function Home() {
  return (
    <main className="brutal-grid relative min-h-0 flex-1 overflow-y-auto text-[#111216]">
      <div className="mx-auto flex min-h-full max-w-[1200px] flex-col px-5 py-5 sm:px-8 sm:py-8">

        {/* ═══════════════ NAV ═══════════════ */}
        <nav className="flex items-center justify-between border-b-2 border-[#111216] pb-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-xs font-black uppercase tracking-[0.18em]"
          >
            <span className="relative grid h-8 w-8 place-items-center border-2 border-[#111216] bg-[#e9ff4f] text-[10px]">
              <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden>
                <path d="M7 0L13.9282 12H0.0717969L7 0Z" fill="#111216" />
              </svg>
            </span>
            <span>
              Blind Run{" "}
              <span className="text-[10px] font-bold tracking-[0.12em] text-[#6c6b70]">
                | Trust the Voice
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-6">
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-[#6c6b70] md:block">How to Play</span>
            <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-[#6c6b70] md:block">Features</span>
            <Link href="/play" className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-[#6c6b70] md:block">Play Now</Link>
            <Link href="/rooms#join" className="hidden border-2 border-[#111216] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-[#111216] hover:text-[#f2eee5] sm:block">Join a Room</Link>
            <AuthControls />
            <Link href="/rooms" className="brutal-button px-4 py-2 text-[10px]">Create a Room</Link>
          </div>
        </nav>

        <div className="grid border-b-2 border-[#111216] sm:grid-cols-3">
          <div className="border-b-2 border-[#111216] py-3 sm:border-b-0 sm:border-r-2 sm:pr-4">
            <div className="text-lg font-black uppercase leading-none tracking-tight">
              <LandingCounter />
            </div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6c6b70]">
              Moonshots landed
            </div>
          </div>
          <div className="border-b-2 border-[#111216] py-3 sm:border-b-0 sm:border-r-2 sm:px-4">
            <div className="text-lg font-black uppercase leading-none tracking-tight">3K+</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6c6b70]">
              X views
            </div>
          </div>
          <div className="py-3 sm:pl-4">
            <div className="text-lg font-black uppercase leading-none tracking-tight">20+</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6c6b70]">
              Early playtests
            </div>
          </div>
        </div>

        {/* ═══════════════ HERO ═══════════════ */}
        <section className="grid items-start gap-8 pt-8 pb-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12 lg:pt-10 lg:pb-8">

          {/* ── LEFT: headline + mascot + copy ── */}
          <div className="flex flex-col items-start">
            {/* tags */}
            <div className="mb-4 flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em]">
              <span className="bg-[#111216] px-2.5 py-1 text-[#e9ff4f]">Asymmetric Multiplayer</span>
              <span className="border-2 border-[#111216] px-2.5 py-1">Heist Simulation</span>
            </div>

            {/* headline with overlapping mascot */}
            <div className="relative w-full">
              <h1 className="text-[clamp(3.2rem,9vw,7.5rem)] font-black uppercase leading-[0.84] tracking-[-0.07em]">
                One
                <br />
                Thief.
                <br />
                <span className="text-[#3b63ff]">Multiple</span>
                <br />
                <span className="text-[#3b63ff]">Views.</span>
                <br />
                One way out.
              </h1>

              {/* mascot — overlapping on top of the headline */}
              <div
                className="pointer-events-none absolute z-10"
                style={{ right: "-5%", top: "8%", width: "clamp(140px, 22vw, 260px)", transform: "rotate(6deg)" }}
              >
                <Image
                  src={mascotImg}
                  alt="Blind Run mascot"
                  width={260}
                  height={260}
                  className="drop-shadow-[4px_4px_0_rgba(17,18,22,0.2)]"
                  priority
                />
              </div>

              {/* "Different Eyes. Same Escape." — rotated text near mascot */}
              <div
                className="pointer-events-none absolute hidden lg:block"
                style={{
                  right: "-2%",
                  top: "55%",
                  transform: "rotate(-55deg)",
                  transformOrigin: "center",
                }}
              >
                <span className="text-[11px] font-black uppercase leading-tight tracking-[0.12em] text-[#111216]">
                  Different
                  <br />
                  Eyes.
                  <br />
                  Same
                  <br />
                  Escape.
                </span>
              </div>
            </div>

            {/* supporting copy */}
            <p className="mt-6 max-w-md text-sm font-medium leading-relaxed sm:text-[15px]">
              A real-time multiplayer heist where the thief can&apos;t see.
              Your crew watches, guides, and helps you escape.
              <br />
              Different eyes. Same adventure.
            </p>

            {/* CTA + meta */}
            <div className="mt-6 flex flex-wrap items-end gap-6">
              <Link href="/rooms" className="brutal-button px-5 py-3">
                Create a Room <span className="ml-2">&rarr;</span>
              </Link>
              <Link
                href="/rooms#join"
                className="border-2 border-[#111216] bg-[#fffdf7] px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] shadow-[4px_4px_0_#111216] transition hover:bg-[#111216] hover:text-[#f2eee5] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#111216]"
              >
                Join a Room <span className="ml-2">&rarr;</span>
              </Link>
              <div className="flex gap-5">
                {[
                  { value: "2\u20134", label: "Players" },
                  { value: "~10 Min", label: "Per Run" },
                  { value: "Pure", label: "Teamwork" },
                ].map((m) => (
                  <div key={m.label} className="text-center">
                    <div className="text-base font-black uppercase leading-none tracking-tight">{m.value}</div>
                    <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#6c6b70]">{m.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: facility panel ── */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <Image
              src="/facility.png"
              alt="The Facility"
              width={800}
              height={600}
              className="h-auto w-full border-2 border-[#111216] object-cover"
              priority
            />

            {/* floating badge */}
            <div className="absolute -bottom-4 -right-3 hidden border-2 border-[#111216] bg-[#e9ff4f] px-3 py-2 text-[10px] font-black uppercase tracking-widest shadow-[4px_4px_0_#111216] sm:block">
              Talk or lose
            </div>
          </div>
        </section>

        {/* ═══════════════ BOTTOM ROW: How to Play + Run Protocol ═══════════════ */}
        <section className="grid gap-4 border-t-2 border-[#111216] pt-6 pb-6 lg:grid-cols-[1fr_1.2fr]">

          {/* ── LEFT: How to Play ── */}
          <div className="brutal-panel p-4 sm:p-5">
            <h2 className="mb-4 text-xs font-black uppercase tracking-[0.22em]">How to Play</h2>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  n: "1",
                  name: "Thief View",
                  accent: "#3b63ff",
                  body: "First person, inside the facility. No labels, no camera cones, no traps. One player gets this.",
                },
                {
                  n: "2",
                  name: "Spectator View",
                  accent: "#24d17e",
                  body: "A cutaway of one room. Camera cones, the guard\u2019s patrol, the keypad, the keycard \u2014 the layer the thief is blind to.",
                },
                {
                  n: "3",
                  name: "Discovery Mode",
                  accent: "#e9ff4f",
                  body: "Same room, scanning for what nobody has found yet: hidden cameras, vents, floor traps, the note with the vault code.",
                },
              ].map((v) => (
                <div key={v.n} className="flex flex-col">
                  <span className="mb-2 text-[10px] font-black uppercase tracking-widest" style={{ color: v.accent }}>
                    {v.n}. {v.name}
                  </span>
                  {/* dark screenshot placeholder */}
                  <div className="relative mb-2 aspect-[4/3] overflow-hidden border border-[#111216] bg-[#1b1d24]">
                    <div className="absolute inset-0 opacity-[0.06]" style={{
                      backgroundImage: "linear-gradient(rgba(242,238,229,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(242,238,229,0.5) 1px, transparent 1px)",
                      backgroundSize: "12px 12px",
                    }} />
                    {/* stylized view indicator */}
                    {v.n === "1" && (
                      <>
                        <div className="absolute left-[15%] top-[20%] h-[60%] w-[70%] border border-[#f2eee5]/15" />
                        <div className="absolute bottom-2 left-2 h-1 w-3 bg-[#3b63ff]/40" />
                        <div className="absolute bottom-2 right-2 text-[6px] font-bold uppercase text-[#f2eee5]/20">FPV</div>
                      </>
                    )}
                    {v.n === "2" && (
                      <>
                        <div className="absolute left-[10%] top-[15%] h-[40%] w-[45%] border border-[#24d17e]/25" />
                        <div className="absolute right-[10%] top-[15%] h-[40%] w-[35%] border border-[#24d17e]/25" />
                        <div className="absolute bottom-[15%] left-[20%] h-[25%] w-[60%] border border-[#24d17e]/25" />
                        {/* camera cone */}
                        <svg className="absolute left-[20%] top-[20%] h-4 w-4 text-[#24d17e]/30" viewBox="0 0 16 16" fill="none" aria-hidden>
                          <path d="M8 4L2 12H14Z" fill="currentColor" />
                        </svg>
                        <div className="absolute bottom-2 right-2 text-[6px] font-bold uppercase text-[#f2eee5]/20">Watch</div>
                      </>
                    )}
                    {v.n === "3" && (
                      <>
                        <div className="absolute left-[10%] top-[15%] h-[40%] w-[45%] border border-[#e9ff4f]/20" />
                        <div className="absolute right-[10%] top-[15%] h-[40%] w-[35%] border border-[#e9ff4f]/20" />
                        <div className="absolute bottom-[15%] left-[20%] h-[25%] w-[60%] border border-[#e9ff4f]/20" />
                        {/* discovery blips */}
                        <div className="signal-pulse absolute left-[30%] top-[30%] h-2 w-2 rounded-full bg-[#e9ff4f]/40" />
                        <div className="signal-pulse absolute right-[25%] top-[40%] h-1.5 w-1.5 rounded-full bg-[#e9ff4f]/30" />
                        <div className="signal-pulse absolute bottom-[30%] left-[45%] h-2 w-2 rounded-full bg-[#e9ff4f]/40" />
                        <div className="absolute bottom-2 right-2 text-[6px] font-bold uppercase text-[#f2eee5]/20">Scan</div>
                      </>
                    )}
                  </div>
                  <p className="text-[11px] font-medium leading-snug text-[#45454a]">{v.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT: Run Protocol + mascot tagline ── */}
          <div className="brutal-panel flex flex-col p-4 sm:p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="mb-4 text-xs font-black uppercase tracking-[0.22em]">Run Protocol</h2>
                <ol className="space-y-2">
                  {STEPS.map((s, i) => (
                    <li key={i} className="flex gap-3 border-b border-[#111216]/15 pb-2">
                      <span className="font-mono text-sm font-bold text-[#3b63ff]">0{i + 1}</span>
                      <span className="text-[13px] font-semibold">{s}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* tagline + mascot on the right */}
              <div className="ml-4 hidden flex-shrink-0 flex-col items-end lg:flex" style={{ marginTop: "auto" }}>
                <div className="mb-3 text-right">
                  <div className="text-xl font-black uppercase leading-[1.1] tracking-tight">
                    Small Steps.
                    <br />
                    Big Escapes.
                  </div>
                </div>
                <div className="relative w-[130px]" style={{ transform: "scaleX(-1)" }}>
                  <Image
                    src={mascotImg}
                    alt="Blind Run mascot"
                    width={130}
                    height={130}
                    className="drop-shadow-[3px_3px_0_rgba(17,18,22,0.15)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════ FOOTER ═══════════════ */}
        <footer className="flex flex-col gap-3 border-t-2 border-[#111216] pb-3 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6c6b70] sm:flex-row sm:items-center sm:justify-between">
          <span>Blind Run // Trust the Voice</span>
          <span className="flex items-center gap-2">
            <svg width="14" height="12" viewBox="0 0 14 12" fill="none" aria-hidden>
              <rect x="1" y="3" width="12" height="6" rx="2" stroke="currentColor" strokeWidth="0.8" />
              <line x1="4" y1="6" x2="6" y2="6" stroke="currentColor" strokeWidth="0.8" />
              <line x1="8" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="0.8" />
              <line x1="7" y1="4.5" x2="7" y2="7.5" stroke="currentColor" strokeWidth="0.8" />
            </svg>
            Real People. Real Time.
          </span>
          <span className="flex items-center gap-2">
            A game about teamwork
            <span className="relative inline-block h-5 w-5">
              <Image src={mascotImg} alt="" width={20} height={20} className="object-contain" />
            </span>
          </span>
        </footer>
      </div>
    </main>
  );
}
