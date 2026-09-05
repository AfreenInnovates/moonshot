type Signal = "command" | "alert" | "discover";

let context: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") return null;
  context ??= new AudioContext();
  void context.resume();
  return context;
}

/** Small synthesized UI signals keep the prototype self-contained and license-safe. */
export function playSignal(signal: Signal) {
  const audio = getContext();
  if (!audio) return;

  const now = audio.currentTime;
  const frequencies =
    signal === "alert"
      ? [110, 82]
      : signal === "discover"
        ? [520, 760]
        : [240, 420];
  const duration = signal === "alert" ? 0.22 : 0.1;

  frequencies.forEach((frequency, index) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = signal === "alert" ? "sawtooth" : "square";
    oscillator.frequency.setValueAtTime(frequency, now + index * duration * 0.8);
    gain.gain.setValueAtTime(0.0001, now + index * duration * 0.8);
    gain.gain.exponentialRampToValueAtTime(0.045, now + index * duration * 0.8 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * duration * 0.8 + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(now + index * duration * 0.8);
    oscillator.stop(now + index * duration * 0.8 + duration + 0.02);
  });
}
