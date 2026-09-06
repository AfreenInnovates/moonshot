"use client";

import { useAuth } from "react-oidc-context";
import { claimString, profileNameFromClaims } from "../lib/auth";

const AUTH_ENABLED = Boolean(process.env.NEXT_PUBLIC_SPACETIME_AUTH_CLIENT_ID);

function ConfiguredAuthControls() {
  const auth = useAuth();

  if (auth.isLoading) {
    return <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#6c6b70]">Checking profile...</span>;
  }

  if (auth.error) {
    return <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff5b55]">Google sign-in unavailable</span>;
  }

  if (!auth.isAuthenticated) {
    return (
      <button
        onClick={() => void auth.signinRedirect()}
        className="border-2 border-[#111216] bg-[#fffdf7] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] shadow-[3px_3px_0_#111216] transition hover:bg-[#111216] hover:text-[#f2eee5]"
      >
        Continue with Google
      </button>
    );
  }

  const claims = auth.user?.profile as Record<string, unknown> | undefined;
  const name = profileNameFromClaims(claims);
  const email = claimString(claims, "email");

  return (
    <details className="relative">
      <summary className="cursor-pointer list-none border-2 border-[#111216] bg-[#e9ff4f] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] shadow-[3px_3px_0_#111216]">
        {name}
      </summary>
      <div className="absolute right-0 top-full z-20 mt-2 w-64 border-2 border-[#111216] bg-[#fffdf7] p-4 text-left shadow-[4px_4px_0_#111216]">
        <p className="text-[10px] font-black uppercase tracking-[0.16em]">Your profile</p>
        <p className="mt-3 text-sm font-black">{name}</p>
        {email && <p className="mt-1 break-all text-[11px] font-medium text-[#6c6b70]">{email}</p>}
        <button
          onClick={() => void auth.signoutRedirect()}
          className="mt-4 border-t border-[#111216]/20 pt-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#6c6b70] hover:text-[#111216]"
        >
          Sign out
        </button>
      </div>
    </details>
  );
}

export default function AuthControls() {
  if (!AUTH_ENABLED) {
    return <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#ff5b55]">Google profile setup required</span>;
  }
  return <ConfiguredAuthControls />;
}
