import { getRoom, subscribe } from "../../../lib/roomStore";

export const dynamic = "force-dynamic";

/**
 * Server-sent events for one room. Every client - thief and spectators alike -
 * holds one of these open; the room record and the thief's world snapshots come
 * down it. Works across browsers and across devices on the same network.
 */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.toUpperCase();
  if (!code) return new Response("code required", { status: 400 });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          open = false;
        }
      };

      unsubscribe = subscribe(code, { id: crypto.randomUUID(), write });

      // hand the newcomer the current record straight away
      const room = getRoom(code);
      write(`data: ${JSON.stringify({ type: "room", room })}\n\n`);

      // keep proxies from closing an idle stream
      ping = setInterval(() => write(": ping\n\n"), 20000);

      const close = () => {
        open = false;
        if (ping) clearInterval(ping);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      request.signal.addEventListener("abort", close);
    },
    cancel() {
      if (ping) clearInterval(ping);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
