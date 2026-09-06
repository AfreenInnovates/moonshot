"use client";

import { useEffect } from "react";
import { AuthProvider as OidcAuthProvider, useAuth } from "react-oidc-context";
import { PROFILE_NAME_KEY, SPACETIME_AUTH_TOKEN_KEY, profileNameFromClaims } from "../lib/auth";

const AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_SPACETIME_AUTH_CLIENT_ID;
const AUTH_ENABLED = Boolean(AUTH_CLIENT_ID);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://moonshot-dun-phi.vercel.app";

function AuthStorageBridge({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  useEffect(() => {
    const user = auth.user;
    if (!user) {
      try {
        localStorage.removeItem(SPACETIME_AUTH_TOKEN_KEY);
      } catch {
        // Private browsing can still use the current auth session.
      }
      return;
    }

    const claims = user.profile as Record<string, unknown>;
    const token = user.id_token || user.access_token;
    try {
      if (token) localStorage.setItem(SPACETIME_AUTH_TOKEN_KEY, token);
      localStorage.setItem(PROFILE_NAME_KEY, profileNameFromClaims(claims));
    } catch {
      // The OIDC provider keeps the active session in memory.
    }
  }, [auth.user]);

  return children;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!AUTH_ENABLED) return children;

  return (
    <OidcAuthProvider
      authority="https://auth.spacetimedb.com/oidc"
      client_id={AUTH_CLIENT_ID}
      redirect_uri={`${SITE_URL}/`}
      post_logout_redirect_uri={`${SITE_URL}/`}
      scope="openid profile email"
      response_type="code"
      automaticSilentRenew
      onSigninCallback={() => window.history.replaceState({}, document.title, "/")}
    >
      <AuthStorageBridge>{children}</AuthStorageBridge>
    </OidcAuthProvider>
  );
}
