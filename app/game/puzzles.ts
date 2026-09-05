/**
 * Scan puzzles.
 *
 * A spectator taps a blip, answers one short question, and the thing is
 * identified. The question is a beat of tension, not a wall: every answer is
 * readable straight off the card, and the `hint` line says what the item
 * actually is, so a player who has never seen the room still knows what to
 * press. Nothing here needs a network round trip - the modal has a puzzle the
 * frame it opens.
 */

export interface Puzzle {
  question: string;
  options: string[];
  /** index into `options` */
  correct: number;
  /** what the spectator is looking at, in one plain line */
  hint: string;
}

interface Entry {
  question: string;
  answer: string;
  wrong: [string, string];
  hint: string;
}

const BANK: Record<string, Entry> = {
  "sec-cam-b": {
    question: "This camera has no status light, so the thief cannot spot it. What do you call out?",
    answer: "Keep out of its cone",
    wrong: ["Walk right past it", "Stand still in front of it"],
    hint: "A hidden camera watches exactly like a visible one.",
  },
  "vault-cam-b": {
    question: "A second camera covers the vault with no light on it. What do you call out?",
    answer: "Keep out of its cone",
    wrong: ["Wave at the lens", "Stop underneath it"],
    hint: "A hidden camera watches exactly like a visible one.",
  },
  "sec-vent": {
    question: "A floor vent opens into this room. What is it useful for?",
    answer: "Getting in without the door",
    wrong: ["Storing the loot", "Turning the lights on"],
    hint: "A vent is a second way into the room.",
  },
  "sec-trap": {
    question: "A pressure trap takes 25 HP off anyone who steps on it. What do you call out?",
    answer: "Walk around it",
    wrong: ["Step on it once", "Run straight over it"],
    hint: "Floor trap - contact costs the thief health.",
  },
  "vault-trap": {
    question: "A pressure trap takes 25 HP off anyone who steps on it. What do you call out?",
    answer: "Walk around it",
    wrong: ["Jump on it twice", "Stand on it and wait"],
    hint: "Floor trap - contact costs the thief health.",
  },
  alarm: {
    question: "Switching this panel off blinds every camera in the building. Is that good for the thief?",
    answer: "Yes - the cameras go dark",
    wrong: ["No - it calls the guards", "No - it locks the vault"],
    hint: "Alarm panel. The thief disables it with E.",
  },
  note: {
    question: "The note on the desk reads 4 - 7 - 1 - 2. Relay it back exactly.",
    answer: "4-7-1-2",
    wrong: ["7-4-2-1", "1-2-4-7"],
    hint: "This is the vault code. Read it left to right.",
  },
  "sec-network": {
    question: "The node wants the next number in its sequence: 2, 4, 6, ?",
    answer: "8",
    wrong: ["9", "12"],
    hint: "Network node. Count up by two.",
  },
  "sec-coffee": {
    question: "The guard's coffee is still steaming. What does that tell you?",
    answer: "The guard is close by",
    wrong: ["The guard went home", "The room is empty tonight"],
    hint: "Hot coffee means somebody just put it down.",
  },
  bandages: {
    question: "Bandages restore 20 HP. Who should pick them up?",
    answer: "The thief",
    wrong: ["The guard", "Nobody"],
    hint: "A health pickup sitting in the lobby.",
  },
  "lobby-guestlog": {
    question: "The guest log signs people in on the hour: 09:00, 10:00, 11:00, ?",
    answer: "12:00",
    wrong: ["11:30", "09:30"],
    hint: "Guest log. One entry every hour.",
  },
  "lobby-terminal": {
    question: "The reception terminal wants the next number: 3, 6, 9, ?",
    answer: "12",
    wrong: ["10", "15"],
    hint: "Reception terminal. Count up by three.",
  },
  valuables: {
    question: "These valuables are worth 150 to the score. What do you call out?",
    answer: "Take them",
    wrong: ["Leave them", "Break them"],
    hint: "Loose valuables in the vault room.",
  },
  "vault-vent-override": {
    question: "The override switch opens the vent from this side. What does that give the thief?",
    answer: "A way back out",
    wrong: ["More health", "A louder alarm"],
    hint: "Vent override. It unlocks a second route.",
  },
  "vault-deposit-box": {
    question: "The deposit box is numbered one higher than 41. Which box is it?",
    answer: "42",
    wrong: ["40", "14"],
    hint: "Safe deposit box. Add one to 41.",
  },
};

const FALLBACK: Entry = {
  question: "Run the scan on this object to log it for the crew?",
  answer: "Run the scan",
  wrong: ["Cancel the scan", "Wipe the log"],
  hint: "Scanning shares what you found with everyone watching.",
};

/** Tiny deterministic hash so an item's options do not reshuffle mid-answer. */
function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 3;
}

/**
 * The puzzle for one marker. `attempt` moves the right answer to a different
 * slot on a retry, so a second try is still a read rather than a guess from
 * muscle memory.
 */
export function puzzleFor(id: string, attempt = 0): Puzzle {
  const entry = BANK[id] ?? FALLBACK;
  const slot = (hash(id) + attempt) % 3;
  const options = [...entry.wrong];
  options.splice(slot, 0, entry.answer);
  return {
    question: entry.question,
    options,
    correct: slot,
    hint: entry.hint,
  };
}

/** Shape check for a puzzle handed back by the AI route. */
export function isPuzzle(value: unknown): value is Puzzle {
  const p = value as Partial<Puzzle> | null;
  return (
    !!p &&
    typeof p.question === "string" &&
    p.question.length > 0 &&
    Array.isArray(p.options) &&
    p.options.length === 3 &&
    p.options.every((o) => typeof o === "string" && o.length > 0) &&
    typeof p.correct === "number" &&
    p.correct >= 0 &&
    p.correct < 3
  );
}
