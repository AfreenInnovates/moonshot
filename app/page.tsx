import Link from "next/link";

const VIEWS = [
  {
    n: "1",
    name: "Thief view",
    color: "#4aa8ff",
    body: "First person, inside the building. A normal facility - no labels, no camera cones, no traps. One player gets this.",
  },
  {
    n: "2",
    name: "Spectator view",
    color: "#39ff88",
    body: "A cutaway of one room. Camera cones, the guard's patrol, the keypad, the keycard - the layer the thief is blind to.",
  },
  {
    n: "3",
    name: "Discovery mode",
    color: "#ffd23b",
    body: "Same room, scanning for what nobody has found yet: hidden cameras, vents, floor traps, the note with the vault code.",
  },
];

const STEPS = [
  "Create a room and share the link. Up to four players.",
  "Ten second countdown - roles are drawn at random.",
  "One thief walks in from the street. Everyone else is posted to a single room and can only see that room.",
  "Spectators scan their room and call out what they find. The thief hears it and acts on it.",
  "Keycard, then the vault code, then the vault. Get back out to the street.",
];

export default function Home() {
  return (
    <main className="brutal-grid relative min-h-0 flex-1 overflow-y-auto text-[#111216]">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-5 py-5 sm:px-8 sm:py-8">
        <nav className="flex items-center justify-between border-b-2 border-[#111216] pb-4">
          <Link href="/" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em]">
            <span className="grid h-7 w-7 place-items-center border-2 border-[#111216] bg-[#e9ff4f] text-[10px]">MH</span>
            Moonshot / 01
          </Link>
          <span className="hidden text-[10px] font-bold uppercase tracking-[0.2em] sm:block">Facility protocol // online</span>
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em]"><span className="signal-pulse h-2 w-2 rounded-full bg-[#24d17e]" /> live build</span>
        </nav>

        <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20 lg:py-20">
          <header className="flex flex-col items-start">
            <div className="mb-6 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em]">
              <span className="bg-[#111216] px-2 py-1 text-[#e9ff4f]">Asymmetric multiplayer</span>
              <span className="border-2 border-[#111216] px-2 py-1">Heist simulation</span>
            </div>
            <h1 className="max-w-3xl text-[clamp(3.4rem,9vw,7.7rem)] font-black uppercase leading-[0.84] tracking-[-0.08em]">
              One thief.
              <br />
              <span className="text-[#3b63ff]">Three views.</span>
              <br />
              One way out.
            </h1>
            <p className="mt-8 max-w-xl border-l-4 border-[#3b63ff] pl-4 text-sm font-medium leading-relaxed sm:text-base">
              Walk into a live facility with no labels, no camera cones and no warning. Your crew sees the security layer, one room at a time. Clear instructions are the only map.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Link href="/rooms" className="brutal-button px-5 py-3">Create a room <span className="ml-3 text-base">-&gt;</span></Link>
              <Link href="/play" className="brutal-button-dark bg-[#111216] px-5 py-3">Try solo</Link>
            </div>
          </header>

          <div className="relative mx-auto w-full max-w-md">
            <div className="brutal-panel-dark relative overflow-hidden p-4 sm:p-6">
              <div className="flex items-center justify-between border-b border-[#f2eee5]/30 pb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f2eee5]/70">
                <span>Observation stack</span>
                <span className="text-[#e9ff4f]">03 / 03</span>
              </div>
              <div className="relative mt-6 aspect-square border-2 border-[#f2eee5]/30 bg-[#1b1d24] p-5">
                <div className="absolute left-[12%] top-[15%] h-[28%] w-[35%] border-2 border-[#3b63ff] bg-[#3b63ff]/10" />
                <div className="absolute right-[12%] top-[15%] h-[28%] w-[35%] border-2 border-[#24d17e] bg-[#24d17e]/10" />
                <div className="absolute bottom-[15%] left-[25%] h-[28%] w-[50%] border-2 border-[#e9ff4f] bg-[#e9ff4f]/10" />
                <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e9ff4f] shadow-[0_0_0_7px_rgba(233,255,79,0.15)]" />
                <div className="absolute left-[14%] top-[10%] text-[9px] font-bold uppercase tracking-widest text-[#3b63ff]">security</div>
                <div className="absolute right-[14%] top-[10%] text-[9px] font-bold uppercase tracking-widest text-[#24d17e]">vault</div>
                <div className="absolute bottom-[10%] left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest text-[#e9ff4f]">lobby / entry</div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-wider text-[#f2eee5]/70">
                <div className="border border-[#3b63ff] p-2"><span className="mb-1 block h-1.5 w-1.5 bg-[#3b63ff]" />thief view</div>
                <div className="border border-[#24d17e] p-2"><span className="mb-1 block h-1.5 w-1.5 bg-[#24d17e]" />crew view</div>
                <div className="border border-[#e9ff4f] p-2"><span className="mb-1 block h-1.5 w-1.5 bg-[#e9ff4f]" />discovery</div>
              </div>
            </div>
            <div className="absolute -bottom-5 -right-3 hidden border-2 border-[#111216] bg-[#e9ff4f] px-3 py-2 text-[10px] font-black uppercase tracking-widest shadow-[4px_4px_0_#111216] sm:block">Talk or lose</div>
          </div>
        </section>

        <section className="grid gap-4 border-t-2 border-[#111216] py-8 sm:grid-cols-3">
          {VIEWS.map((v) => (
            <div key={v.n} className="border-2 border-[#111216] bg-[#f2eee5] p-4 shadow-[4px_4px_0_#111216]">
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest" style={{ color: v.color }}>
                <span>{v.n}. {v.name}</span><span className="text-[#111216]">0{v.n}</span>
              </div>
              <p className="mt-3 text-[13px] font-medium leading-relaxed text-[#45454a]">{v.body}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 border-t-2 border-[#111216] py-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div><h2 className="text-xs font-black uppercase tracking-[0.22em]">Run protocol</h2><p className="mt-3 max-w-xs text-sm font-medium text-[#5a5960]">Every room is a small piece of the same problem. Move carefully, share what you see, and keep the thief moving.</p></div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((s, i) => <li key={i} className="flex gap-3 border-b border-[#111216]/20 pb-3 text-sm font-semibold"><span className="font-mono text-[#3b63ff]">0{i + 1}</span><span>{s}</span></li>)}
          </ol>
        </section>

        <footer className="flex flex-col gap-2 border-t-2 border-[#111216] pt-5 text-[10px] font-bold uppercase tracking-[0.13em] text-[#6c6b70] sm:flex-row sm:justify-between">
          <span>Prototype build / local rooms by default</span>
          <span>Built with Three.js + React Three Fiber + Rapier</span>
        </footer>
      </div>
    </main>
  );
}
