"use client";

import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { roomById, type RoomDef } from "../level";
import { clampDt } from "../runtime";
import { useGame } from "../store";

/** Corners of a room, at floor level and at head height. */
function roomCorners(room: RoomDef) {
  const b = room.bounds;
  const out: THREE.Vector3[] = [];
  for (const x of [b.minX, b.maxX])
    for (const z of [b.minZ, b.maxZ])
      for (const y of [0, 2.4]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

/**
 * How far back this room has to be viewed from to hold all of it on screen.
 *
 * The pose in `level.ts` fixes the *direction* - behind the door the thief
 * walks in through - but the distance that fits depends on the window: a tall
 * narrow window has a much narrower horizontal field than a wide one, and the
 * far corners slide off the sides. Solving for it here means the spectator
 * always gets the whole room whatever shape their window is, instead of a
 * framing that only works on the laptop it was authored on.
 */
function fitDistance(room: RoomDef, aspect: number, fov: number) {
  const target = new THREE.Vector3(...room.cam.target);
  const dir = new THREE.Vector3(...room.cam.pos).sub(target).normalize();
  const corners = roomCorners(room);
  const probe = new THREE.PerspectiveCamera(fov, aspect, 0.1, 400);
  const MARGIN = 0.92;

  const overflow = (d: number) => {
    probe.position.copy(target).addScaledVector(dir, d);
    probe.lookAt(target);
    probe.updateMatrixWorld(true);
    probe.updateProjectionMatrix();
    let worst = 0;
    for (const c of corners) {
      const p = c.clone().project(probe);
      worst = Math.max(worst, Math.abs(p.x), Math.abs(p.y));
    }
    return worst;
  };

  const authored = new THREE.Vector3(...room.cam.pos).distanceTo(target);
  if (overflow(authored) <= MARGIN) return authored;
  let lo = authored;
  let hi = authored * 4;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (overflow(mid) > MARGIN) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Mouse look for the thief. Uses pointer lock when the browser allows it and
 * falls back to click-drag when it does not (embedded frames, some previews).
 */
function FirstPersonLook() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    const euler = new THREE.Euler(0, 0, 0, "YXZ");
    let dragging = false;

    const onDown = () => {
      dragging = true;
      try {
        const p = el.requestPointerLock() as unknown as Promise<void> | void;
        if (p && typeof (p as Promise<void>).catch === "function")
          (p as Promise<void>).catch(() => {});
      } catch {
        /* pointer lock unavailable - drag look still works */
      }
    };
    const onUp = () => {
      dragging = false;
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el && !dragging) return;
      euler.setFromQuaternion(camera.quaternion);
      euler.y -= e.movementX * 0.0022;
      euler.x = THREE.MathUtils.clamp(
        euler.x - e.movementY * 0.0022,
        -1.35,
        1.35,
      );
      camera.quaternion.setFromEuler(euler);
    };

    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [gl, camera]);

  return null;
}

/**
 * The spectator camera rides along with the thief: whenever the thief moves
 * into another room the framing slides over to that room, so the map reveals
 * itself as the run goes on instead of being handed over all at once.
 *
 * A posted spectator's framing is bolted down - no orbit, no pan. Their room is
 * always drawn from the same angle, so "left" and "right" mean the same thing
 * to them and to the thief every time they call one out. Solo play keeps the
 * free camera, since there is nobody to give directions to.
 */
const FOV = 45;

function SpectatorRig({ active }: { active: boolean }) {
  const mode = useGame((s) => s.mode);
  const thiefRoom = useGame((s) => s.room);
  // a posted spectator stays on their own room; solo follows the thief around
  const room = mode.kind === "spectator" ? mode.watching : thiefRoom;
  const posted = mode.kind === "spectator";
  // re-fit when the window changes shape, so a resize never crops the room
  const aspect = useThree((s) => s.viewport.aspect);
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const orbit = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [start] = useState(() => roomById(room).cam);
  const want = useRef({
    pos: new THREE.Vector3(...start.pos),
    target: new THREE.Vector3(...start.target),
  });
  const following = useRef(true);

  // how far back this window has to sit to hold the whole room
  const fitted = useMemo(
    () =>
      posted
        ? fitDistance(roomById(room), aspect || 1.6, FOV)
        : new THREE.Vector3(...roomById(room).cam.pos).distanceTo(
            new THREE.Vector3(...roomById(room).cam.target),
          ),
    [room, posted, aspect],
  );

  useEffect(() => {
    const r = roomById(room);
    want.current.target.set(...r.cam.target);
    if (posted) {
      // keep the authored direction, take whatever distance shows the room
      const dir = new THREE.Vector3(...r.cam.pos)
        .sub(want.current.target)
        .normalize();
      want.current.pos.copy(want.current.target).addScaledVector(dir, fitted);
    } else {
      want.current.pos.set(...r.cam.pos);
    }
    // a posted spectator never turns the camera, so there is nothing to ease:
    // put the aim on the room at once and let only the position slide
    if (posted && orbit.current) {
      orbit.current.target.copy(want.current.target);
      orbit.current.update();
    }
    following.current = true;
  }, [room, posted, fitted]);

  // hand the fresh target to the controls whenever they mount
  useEffect(() => {
    if (active && orbit.current) {
      orbit.current.target.copy(want.current.target);
      orbit.current.update();
    }
  }, [active]);

  useFrame((_, rawDt) => {
    if (!cam.current || !following.current) return;
    const k = Math.min(1, clampDt(rawDt) * 2.4);
    cam.current.position.lerp(want.current.pos, k);
    if (orbit.current) {
      orbit.current.target.lerp(want.current.target, k);
      orbit.current.update();
    } else {
      cam.current.lookAt(want.current.target);
    }
    // Where the camera is aimed matters as much as where it stands, and the two
    // converge at different speeds. Stopping on the position alone froze the
    // aim wherever it had got to - which left the side rooms staring at the
    // floor instead of down the room, while the lobby looked fine only because
    // its target is a metre from the origin the aim was still sat on.
    const arrived =
      cam.current.position.distanceTo(want.current.pos) < 0.05 &&
      (!orbit.current ||
        orbit.current.target.distanceTo(want.current.target) < 0.05);
    if (arrived) following.current = false;
  });

  return (
    <>
      <PerspectiveCamera
        ref={cam}
        makeDefault={active}
        fov={FOV}
        near={0.1}
        far={400}
        position={start.pos}
      />
      {active && (
        <OrbitControls
          ref={orbit}
          makeDefault
          /* posted spectators get a fixed frame: zoom only, so the room never
             turns under them and the thief's heading stays readable */
          enableRotate={!posted}
          enablePan={!posted}
          /* the posted framing already starts wide enough to see the whole
             room and the door the thief comes through; this is only headroom
             to lean in or pull further back, measured off that fitted distance
             so it means the same thing on every window shape */
          minDistance={posted ? fitted * 0.45 : 4}
          maxDistance={posted ? fitted * 1.8 : 40}
          maxPolarAngle={posted ? 1.3 : 1.52}
          enableDamping
          dampingFactor={0.08}
          onStart={() => {
            // a posted spectator can only dolly, and that must not cancel the
            // slide back to their room's framing
            if (!posted) following.current = false;
          }}
        />
      )}
    </>
  );
}

/**
 * One rig, three views. The simulation is identical in all of them - only the
 * camera and the amount of information drawn on top of the world changes.
 */
export default function ViewRig() {
  const view = useGame((s) => s.view);
  const first = view === "thief";

  return (
    <>
      <fogExp2 attach="fog" args={["#0d141d", 0.006]} />

      {/* thief: eyes inside the character, driven by Thief.tsx */}
      <PerspectiveCamera makeDefault={first} fov={74} near={0.06} far={400} />
      {first && <FirstPersonLook key="fps" />}

      <SpectatorRig active={!first} />

      <ambientLight
        intensity={first ? 0.52 : 0.44}
        color={first ? "#c6cfdd" : "#aeb8c6"}
      />
      <hemisphereLight
        color="#dfe7f4"
        groundColor="#2b2f36"
        intensity={first ? 0.46 : 0.38}
      />
    </>
  );
}
