"use client";

import { ServerNet } from "./server";
import { SpacetimeNet } from "./spacetimeNet";
import type { NetClient } from "./types";

/**
 * Which transport carries a room.
 *
 * - `server` (default): rooms live in this Next server's memory, clients hold
 *   an SSE stream each. Works across browsers and across devices pointed at
 *   this machine.
 * - `spacetime`: the SpacetimeDB module in `spacetime/`, once its
 *   bindings are generated. Same six methods, one reducer each.
 */
export function createNet(): NetClient {
  return process.env.NEXT_PUBLIC_NET_TRANSPORT === "server"
    ? new ServerNet()
    : new SpacetimeNet();
}

export * from "./types";
