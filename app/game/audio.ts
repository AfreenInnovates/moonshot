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

type VoiceJob = {
  id: string;
  url: string;
  valid: () => boolean;
};

const voiceQueue: VoiceJob[] = [];
const playedVoice = new Set<string>();
let activeVoice: HTMLAudioElement | null = null;

function playNextVoice() {
  if (activeVoice || voiceQueue.length === 0) return;
  const job = voiceQueue.shift()!;
  if (!job.valid()) {
    playNextVoice();
    return;
  }

  const audio = new Audio(job.url);
  activeVoice = audio;
  const finish = () => {
    if (activeVoice !== audio) return;
    activeVoice = null;
    audio.onended = null;
    audio.onerror = null;
    playNextVoice();
  };
  audio.onended = finish;
  audio.onerror = finish;
  void audio.play().catch(finish);
}

/** Play a room command once, in order, while the thief is still active. */
export function enqueueVoice(id: string, url: string, valid: () => boolean) {
  if (typeof window === "undefined" || playedVoice.has(id)) return;
  playedVoice.add(id);
  voiceQueue.push({ id, url, valid });
  playNextVoice();
}

export function clearVoiceQueue() {
  voiceQueue.length = 0;
  if (!activeVoice) return;
  activeVoice.pause();
  activeVoice.src = "";
  activeVoice = null;
}

let narrationKey: string | null = null;
let narrationAudio: HTMLAudioElement | null = null;

/** Autoplay when allowed; retry the same one-shot audio from the existing UI click. */
export function playNarrationOnce(key: string, url: string) {
  if (typeof window === "undefined") return;
  if (narrationKey === key && narrationAudio) {
    if (narrationAudio.paused && !narrationAudio.ended) void narrationAudio.play().catch(() => {});
    return;
  }
  narrationKey = key;
  narrationAudio = new Audio(url);
  narrationAudio.preload = "auto";
  void narrationAudio.play().catch(() => {});
}
