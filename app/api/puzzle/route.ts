import { NextResponse } from "next/server";
import OpenAI from "openai";
import { isPuzzle, puzzleFor } from "../../game/puzzles";

/**
 * One scan puzzle. The client already has a playable local puzzle on screen
 * before this is called, so this route only ever has to be *better* - and it
 * has to be quick, because the client stops waiting after about a second and a
 * half. Anything slow, missing or malformed falls straight back to the same
 * bank the client drew from.
 */

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const SYSTEM = `You write one very easy multiple-choice question for a heist game.
A spectator is scanning an object in a room and has about 20 seconds to answer.

Rules:
- One sentence. Plain words. Aim it at a player who has never seen this room.
- The question must be about the object named by the user, or a trivially easy
  count/sequence (like 2, 4, 6, ?).
- Exactly 3 options, 1-4 words each. The right answer must be obvious to anyone
  who read the question.
- Never rely on outside knowledge, wordplay or trick phrasing.

Reply with JSON only:
{"question": "...", "options": ["...", "...", "..."], "correct": 0, "hint": "one short line saying what the object is"}
"correct" is the index of the right option and must vary between requests.`;

export async function POST(req: Request) {
  let itemId = "";
  let itemLabel = "";
  let roomName = "";
  try {
    const body = (await req.json()) as {
      itemId?: string;
      itemLabel?: string;
      roomName?: string;
    };
    itemId = body.itemId ?? "";
    itemLabel = body.itemLabel ?? "";
    roomName = body.roomName ?? "";
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!itemLabel && !itemId)
    return NextResponse.json({ error: "Missing itemLabel" }, { status: 400 });

  const local = puzzleFor(itemId || itemLabel);
  if (!openai) return NextResponse.json(local);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Object: ${itemLabel || itemId}. Room: ${roomName || "the facility"}.`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = completion.choices[0]?.message?.content;
    const data: unknown = result ? JSON.parse(result) : null;
    // the model is an upgrade, never a source of a broken card
    return NextResponse.json(isPuzzle(data) ? data : local);
  } catch (error) {
    console.error("Puzzle API error:", error);
    return NextResponse.json(local);
  }
}
