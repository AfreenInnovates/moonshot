"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import * as THREE from "three";
import {
  CAMERAS,
  DOORS,
  ESCAPE_Z,
  MARKERS,
  PATROLS,
  roomAt,
  type MarkerDef,
} from "../level";
import { clampDt, guardState, runtime } from "../runtime";
import { useGame } from "../store";

const pos = (id: string) =>
  new THREE.Vector3(...(MARKERS.find((m) => m.id === id) as MarkerDef).position);

const keypadPos = pos("keypad");
const alarmPos = pos("alarm");

const tmpDir = new THREE.Vector3();
const tmpTo = new THREE.Vector3();
const tmpEye = new THREE.Vector3();
const tmpStart = new THREE.Vector3();
const forward = new THREE.Vector3();
const euler = new THREE.Euler(0, 0, 0, "YXZ");

const flat = (a: THREE.Vector3, b: THREE.Vector3) =>
  Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Everything the world knows: line of sight from cameras and guards, the alarm
 * meter, damage, which room the thief is in, and what pressing E would do.
 * None of this is view-specific - the views only decide what gets drawn.
 */
export default function Systems() {
  const { world, rapier } = useRapier();
  const rayRef = useRef<InstanceType<typeof rapier.Ray> | null>(null);
  const acc = useRef(0);
  const alarm = useRef(0);
  const resetSeq = useGame((s) => s.resetSeq);

  useEffect(() => {
    alarm.current = 0;
    runtime.alert = 0;
    runtime.lastSeen = -100;
    runtime.lastTrapHit = -10;
    runtime.useTarget = null;
    runtime.seenBy.clear();
  }, [resetSeq]);

  const seesThief = (
    origin: THREE.Vector3,
    yaw: number,
    pitch: number,
    range: number,
    fov: number,
  ) => {
    tmpTo.set(runtime.thief.x, runtime.thief.y + 0.35, runtime.thief.z);
    tmpDir.subVectors(tmpTo, origin);
    const dist = tmpDir.length();
    if (dist > range) return false;
    tmpDir.divideScalar(dist);

    euler.set(pitch, yaw, 0);
    forward.set(0, 0, -1).applyEuler(euler);
    if (forward.dot(tmpDir) < Math.cos(fov)) return false;

    // start past the viewer's own collider, stop short of the thief's, so the
    // only thing the ray can hit is scenery in between
    const maxToi = dist - 1.05;
    if (maxToi <= 0.05) return true;
    tmpStart.copy(origin).addScaledVector(tmpDir, 0.55);
    rayRef.current ??= new rapier.Ray(tmpStart, tmpDir);
    rayRef.current.origin = tmpStart;
    rayRef.current.dir = tmpDir;
    return !world.castRay(
      rayRef.current,
      maxToi,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
    );
  };

  useFrame((_, rawDt) => {
    const dt = clampDt(rawDt);
    const store = useGame.getState();
    if (store.escaped) return;

    /* --- which room are we in --------------------------------------- */
    runtime.room = roomAt(runtime.thief.x, runtime.thief.z);

    /* --- line of sight ---------------------------------------------- */
    runtime.seenBy.clear();
    if (!store.alarmDisabled) {
      for (const cam of CAMERAS) {
        if (cam.room !== runtime.room) continue;
        tmpEye.set(...cam.position);
        const yaw = runtime.camYaw[cam.id] ?? cam.baseYaw;
        if (seesThief(tmpEye, yaw, cam.pitch, cam.range, cam.fov))
          runtime.seenBy.add(cam.id);
      }
    }

    let guardDist = Infinity;
    for (const p of PATROLS) {
      const g = guardState(p.id);
      tmpEye.set(g.pos.x, g.pos.y + 1.45, g.pos.z);
      const d = flat(g.pos, runtime.thief);
      guardDist = Math.min(guardDist, d);
      if (
        d < 1.7 ||
        seesThief(tmpEye, g.yaw, 0, p.vision.range, p.vision.fov)
      )
        runtime.seenBy.add(p.id);
    }

    /* --- alarm meter ------------------------------------------------ */
    const now = performance.now() / 1000;
    const isVisible = store.invisibleUntil < Date.now();
    const seen = isVisible && runtime.seenBy.size > 0 && store.hp > 0;
    if (seen) runtime.lastSeen = now;
    alarm.current = THREE.MathUtils.clamp(
      alarm.current + (seen ? 22 : -20) * dt,
      0,
      100,
    );
    runtime.alert = alarm.current;

    /* --- damage ----------------------------------------------------- */
    if (store.hp > 0) {
      if (alarm.current >= 100) store.drain(5 * dt);
      if (guardDist < 1.5) store.drain(8 * dt);
    }

    /* --- what would E do right now ---------------------------------- */
    let useTarget: typeof runtime.useTarget = null;
    if (flat(runtime.thief, keypadPos) < 2.2 && !store.vaultOpen)
      useTarget = { kind: "keypad", id: "keypad" };
    else if (flat(runtime.thief, alarmPos) < 2.2 && !store.alarmDisabled)
      useTarget = { kind: "alarm", id: "alarm" };
    runtime.useTarget = useTarget;

    /* --- locked doors ----------------------------------------------- */
    let lockedNear: string | null = null;
    for (const d of DOORS) {
      if (!d.lock || store.keycard || store.doorsOpen[d.id]) continue;
      if (Math.hypot(runtime.thief.x - d.at[0], runtime.thief.z - d.at[2]) < 2.4)
        lockedNear = d.label;
    }

    /* --- getting out ------------------------------------------------ */
    const gotLoot = !!store.collected["vault-loot"];
    if (gotLoot && runtime.thief.z > ESCAPE_Z && store.hp > 0) store.escape();

    /* --- push to react at ~12hz ------------------------------------- */
    acc.current += dt;
    if (acc.current > 0.08) {
      acc.current = 0;
      store.enterRoom(runtime.room);
      if (Math.abs(store.alarm - alarm.current) > 0.8 || seen !== store.spotted)
        store.setAlarm(alarm.current, seen);

      const prompt = store.escaped
        ? null
        : useTarget?.kind === "keypad"
          ? store.codeFound
            ? "Press E to enter the code"
            : "Press E to try the keypad"
          : useTarget?.kind === "alarm"
            ? "Press E to disable the alarm panel"
            : lockedNear
              ? `${lockedNear} is locked - the keycard is in the security room`
              : gotLoot
                ? "Get out through the lobby entrance"
                : store.vaultOpen
                  ? "The vault is open - take what is inside"
                  : null;
      store.setPrompt(prompt);
    }
  });

  return null;
}
