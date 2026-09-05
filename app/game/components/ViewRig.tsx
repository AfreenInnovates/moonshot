"use client";

import { useEffect, useRef, useState, type ComponentRef } from "react";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { roomById } from "../level";
import { clampDt } from "../runtime";
import { useGame } from "../store";

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
function SpectatorRig({ active }: { active: boolean }) {
  const mode = useGame((s) => s.mode);
  const thiefRoom = useGame((s) => s.room);
  // a posted spectator stays on their own room; solo follows the thief around
  const room = mode.kind === "spectator" ? mode.watching : thiefRoom;
  const posted = mode.kind === "spectator";
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const orbit = useRef<ComponentRef<typeof OrbitControls>>(null);
  const [start] = useState(() => roomById(room).cam);
  const want = useRef({
    pos: new THREE.Vector3(...start.pos),
    target: new THREE.Vector3(...start.target),
  });
  const following = useRef(true);

  useEffect(() => {
    const r = roomById(room);
    want.current.pos.set(...r.cam.pos);
    want.current.target.set(...r.cam.target);
    following.current = true;
  }, [room]);

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
    if (cam.current.position.distanceTo(want.current.pos) < 0.05)
      following.current = false;
  });

  return (
    <>
      <PerspectiveCamera
        ref={cam}
        makeDefault={active}
        fov={45}
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
          minDistance={posted ? 6 : 4}
          maxDistance={posted ? 26 : 40}
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
