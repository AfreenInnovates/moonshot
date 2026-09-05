"use client";

import { ServerNet } from "./server";
import { SpacetimeNet } from "./spacetimeNet";
import type { NetClient } from "./types";

/**
 * Which transport carries a room.
 *
 * - `spacetime` (default): the published SpacetimeDB module in `spacetime/`.
 *   One authoritative database every client subscribes to, so room records and
 *   world snapshots arrive live no matter where the page is served from. This
 *   is the only transport that works on a serverless deployment.
 * - `server`: rooms live in this Next server's memory and clients hold an SSE
 *   stream each. Fine for one long-lived `next dev` process on one machine,
 *   but on Vercel every request can land on a different instance - the thief's
 *   snapshots and the spectators' streams end up in different lambdas and the
 *   spectator view never updates. Opt in with `NEXT_PUBLIC_NET_TRANSPORT=server`.
 */
export function createNet(): NetClient {
  return process.env.NEXT_PUBLIC_NET_TRANSPORT === "server"
    ? new ServerNet()
    : new SpacetimeNet();
}

export * from "./types";
