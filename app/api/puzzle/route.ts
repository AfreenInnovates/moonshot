import { NextResponse } from "next/server";
import OpenAI from "openai";

// Optional: if the user hasn't set the key, we can provide a fallback puzzle or let it fail gracefully.
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function POST(req: Request) {
  try {
    const { itemLabel, roomName } = await req.json();

    if (!itemLabel) {
      return NextResponse.json({ error: "Missing itemLabel" }, { status: 400 });
    }

    if (!openai) {
      // Fallback puzzle if no API key is provided
      return NextResponse.json({
        question: `System offline. Quick manual override for: ${itemLabel}?`,
        options: ["Bypass", "Reroute", "Short-circuit"],
        correct: 0,
      });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI generating very simple, 1st grade level riddles for a game.
The player is trying to scan an item: "{itemLabel}" in room "{roomName}".
Generate a very short, extremely easy 1-sentence riddle or trivia question related to scanning or bypassing this item.
Provide exactly 3 short options (1-3 words each) for the answer. Make sure the correct answer is obvious.
Return the result as a JSON object with this exact structure:
{
  "question": "The short riddle string",
  "options": ["Option 1", "Option 2", "Option 3"],
  "correct": 0 // The index of the correct option (0, 1, or 2)
}
Make the correct index random each time. Ensure the response is valid JSON.`,
        },
        {
          role: "user",
          content: `Generate a puzzle for item: ${itemLabel} in room: ${roomName}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = completion.choices[0].message.content;
    if (!result) {
      throw new Error("No content from OpenAI");
    }

    const data = JSON.parse(result);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Puzzle API error:", error);
    // Fallback on error
    return NextResponse.json({
      question: "Connection scrambled. Which frequency stabilizes the scan?",
      options: ["104.2 Hz", "88.9 Hz", "144.0 Hz"],
      correct: 2,
    });
  }
}
