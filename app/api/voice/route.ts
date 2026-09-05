import { COMMANDS, type CommandCode } from "../../game/commands";
import { broadcast, getRoom } from "../../lib/roomStore";
import {
  createVoiceAsset,
  getVoiceAsset,
  VoiceProviderError,
} from "../../lib/voice";

export const dynamic = "force-dynamic";

const INTRO_TEXT =
  "Welcome to Blind Run. You cannot rely on sight. The Spectator sees the path and guides you. The Thief must listen, move, and trust the voice. In the dark, communication is survival.";

const COMMAND_TEXT: Record<CommandCode, string> = {
  LEFT: "Go left.",
  RIGHT: "Go right.",
  FORWARD: "Go forward.",
  BACK: "Go back.",
  RUN: "Run now.",
  HIDE: "Hide.",
  STOP: "Stop.",
};

const isCommand = (value: unknown): value is CommandCode =>
  typeof value === "string" && COMMANDS.some((command) => command.code === value);

function audioResponse(asset: Awaited<ReturnType<typeof createVoiceAsset>>) {
  return new Response(asset.audio, {
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
}

function providerErrorResponse(error: unknown, context: string) {
  if (error instanceof VoiceProviderError) {
    console.error(`[Smallest.ai] ${context}`, {
      code: error.code,
      status: error.status,
      detail: error.providerDetail,
    });
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          providerStatus: error.status,
          detail: error.providerDetail,
        },
      },
      { status: error.status },
    );
  }

  console.error(`[Smallest.ai] ${context}`, error);
  return Response.json(
    { error: { code: "provider_failure", message: "Unexpected voice provider failure" } },
    { status: 502 },
  );
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  if (query.get("kind") === "intro") {
    try {
      return audioResponse(await createVoiceAsset("intro", INTRO_TEXT));
    } catch (error) {
      return providerErrorResponse(error, "intro synthesis failed");
    }
  }

  const id = query.get("id");
  const asset = id ? getVoiceAsset(id) : null;
  return asset
    ? audioResponse(asset)
    : Response.json({ error: "Audio expired" }, { status: 404 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "command" | "synthesize";
    code?: string;
    playerId?: string;
    command?: CommandCode;
  };
  if (!isCommand(body.command)) return Response.json({ error: "invalid command" }, { status: 400 });

  if (body.action === "synthesize") {
    try {
      const asset = await createVoiceAsset(`command:${body.command}`, COMMAND_TEXT[body.command]);
      return Response.json({ audioUrl: `/api/voice?id=${encodeURIComponent(asset.id)}` });
    } catch (error) {
      return providerErrorResponse(error, "command synthesis failed");
    }
  }

  if (body.action !== "command" || !body.code || !body.playerId) {
    return Response.json({ error: "invalid voice command" }, { status: 400 });
  }

  const code = body.code.toUpperCase();
  const room = getRoom(code);
  const player = room?.players.find((candidate) => candidate.id === body.playerId);
  if (!room || room.phase !== "playing" || player?.role !== "spectator") {
    return Response.json({ error: "only an active spectator can command" }, { status: 403 });
  }

  // Preserve the existing visual command immediately, even if TTS is unavailable.
  broadcast(code, { type: "command", command: body.command, by: body.playerId, t: Date.now() });

  let asset;
  try {
    asset = await createVoiceAsset(`command:${body.command}`, COMMAND_TEXT[body.command]);
  } catch (error) {
    return providerErrorResponse(error, "room command synthesis failed");
  }

  const currentRoom = getRoom(code);
  const currentPlayer = currentRoom?.players.find((candidate) => candidate.id === body.playerId);
  if (!currentRoom || currentRoom.phase !== "playing" || currentPlayer?.role !== "spectator") {
    return Response.json(
      { ok: false, voice: false, error: { code: "room_invalid", message: "The room is no longer active" } },
      { status: 409 },
    );
  }

  broadcast(code, {
    type: "voice",
    id: `${code}:${crypto.randomUUID()}`,
    command: body.command,
    by: body.playerId,
    audioUrl: `/api/voice?id=${encodeURIComponent(asset.id)}`,
    t: Date.now(),
  });
  return Response.json({ ok: true, voice: true });
}
