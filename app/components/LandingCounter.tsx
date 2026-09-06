"use client";

import { useEffect, useState } from "react";
import { DbConnection, type DbView } from "../game/net/spacetime";

const BASE_LANDED = 150;

function landingCount(db: DbView) {
  return BASE_LANDED + Array.from(db.landingVisit.iter()).length;
}

export default function LandingCounter() {
  const [count, setCount] = useState(BASE_LANDED);

  useEffect(() => {
    let disposed = false;
    let connection: DbConnection | null = null;
    const host = process.env.NEXT_PUBLIC_SPACETIME_HOST || "wss://maincloud.spacetimedb.com";
    const database = process.env.NEXT_PUBLIC_SPACETIME_MODULE_NAME || "one-heist-spacetime";
    const tokenKey = `moonshot:landing-token:${host}:${database}`;
    let token = "";

    try {
      token = localStorage.getItem(tokenKey) ?? "";
    } catch {
      // A private browser can still count this visit for the current session.
    }

    connection = DbConnection.builder()
      .withUri(host)
      .withDatabaseName(database)
      .withToken(token)
      .onConnect((connected, _identity, nextToken) => {
        try {
          localStorage.setItem(tokenKey, nextToken);
        } catch {
          // The live connection still works when storage is unavailable.
        }

        connected.db.landingVisit.onInsert(() => {
          if (!disposed && connection) setCount(landingCount(connection.db));
        });

        connected
          .subscriptionBuilder()
          .onApplied((ctx) => {
            if (disposed) return;
            setCount(landingCount(ctx.db));
            void connected.reducers.registerLanding({});
          })
          .subscribe(["SELECT * FROM landing_visit"]);
      })
      .onConnectError(() => {
        // Keep the seeded social-proof count if the public stats connection is unavailable.
      })
      .build();

    const timeout = window.setTimeout(() => connection?.disconnect(), 5000);

    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      connection?.disconnect();
    };
  }, []);

  return <>{count.toLocaleString("en-US")}</>;
}
