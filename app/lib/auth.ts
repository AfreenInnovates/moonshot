export const SPACETIME_AUTH_TOKEN_KEY = "heist:spacetime-auth-token";
export const PROFILE_NAME_KEY = "heist:name";

export function claimString(
  claims: Record<string, unknown> | undefined,
  key: string,
) {
  const value = claims?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function profileNameFromClaims(claims: Record<string, unknown> | undefined) {
  const email = claimString(claims, "email");
  const name =
    claimString(claims, "name") ||
    claimString(claims, "preferred_username") ||
    email.split("@")[0] ||
    "Player";

  return name.replace(/\s+/g, " ").slice(0, 16);
}
