"use client";

import { useSyncExternalStore } from "react";

/**
 * True on a device whose primary pointer is a finger.
 *
 * Drives which control scheme the thief gets: pointer lock and a mouse on a
 * desktop, an on-screen stick and a look pad on a phone. Read through
 * useSyncExternalStore so the server render and the first client render agree
 * (the server has no idea what is holding the device, so it says "not coarse").
 */
const QUERY = "(pointer: coarse)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const read = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(QUERY).matches;

export function useCoarsePointer() {
  return useSyncExternalStore(subscribe, read, () => false);
}
