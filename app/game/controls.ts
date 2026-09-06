"use client";

import { runtime } from "./runtime";
import { useGame } from "./store";

/**
 * The two thief actions, in one place.
 *
 * A key press and a thumb on a button have to mean exactly the same thing, so
 * neither the keyboard subscription nor the on-screen buttons own this logic -
 * they both call in here.
 */

/** `E` / the INTERACT button: whatever the thief is standing next to. */
export function pressUse() {
  const game = useGame.getState();
  if (game.hp <= 0) return;
  const target = runtime.useTarget;
  if (target?.kind === "keypad") game.tryKeypad();
  else if (target?.kind === "alarm") game.disableAlarm();
}

/** `Space` / the JUMP button: the extraction vent if stood in it, else a hop. */
export function pressJump() {
  const game = useGame.getState();
  if (game.hp <= 0) return;
  if (runtime.useTarget?.kind === "vent") {
    game.ventExit();
    return;
  }
  runtime.jumpAt = performance.now();
}
