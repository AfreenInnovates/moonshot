import {
  broadcast,
  createRoom,
  getRoom,
  joinRoom,
  leaveRoom,
  startRoom,
} from "../../lib/roomStore";
import type { NetMessage, PlayerInfo, RoomState } from "../../game/net/types";

export const dynamic = "force-dynamic";

type Body =
  | { action: "create"; room: RoomState }
  | { action: "join"; code: string; player: PlayerInfo }
  | { action: "leave"; code: string; playerId: string }
  | { action: "start"; code: string }
  | { action: "msg"; code: string; msg: NetMessage };

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return Response.json({ error: "code required" }, { status: 400 });
  const room = getRoom(code.toUpperCase());
  return Response.json({ room });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Body;

  switch (body.action) {
    case "create":
      return Response.json({ room: createRoom(body.room) });

    case "join": {
      const result = joinRoom(body.code.toUpperCase(), body.player);
      return result.ok
        ? Response.json({ room: result.room })
        : Response.json({ error: result.reason }, { status: 404 });
    }

    case "leave":
      leaveRoom(body.code.toUpperCase(), body.playerId);
      return Response.json({ ok: true });

    case "start":
      startRoom(body.code.toUpperCase());
      return Response.json({ ok: true });

    case "msg":
      // world snapshots and scans are fanned out, never stored
      broadcast(body.code.toUpperCase(), body.msg);
      return new Response(null, { status: 204 });

    default:
      return Response.json({ error: "unknown action" }, { status: 400 });
  }
}
