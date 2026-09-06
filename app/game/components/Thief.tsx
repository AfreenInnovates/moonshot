"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useKeyboardControls } from "@react-three/drei";
import {
  CapsuleCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { roomAt, THIEF_SPAWN } from "../level";
import { pressJump, pressUse } from "../controls";
import { clampDt, runtime } from "../runtime";
import { useGame, useIsHost } from "../store";
import { Label, NeonBox } from "./Markers";

export type Controls =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "sprint"
  | "use"
  | "jump";

const WALK = 3.6;
const RUN = 5.8;
/** ~1.1m of clearance under the level's -18 gravity: a hop, not a moon jump. */
const JUMP_V = 6.2;
/** Standing on the floor puts the capsule centre here (0.5 half + 0.32 radius). */
const GROUNDED_Y = 0.95;
/** A jump pressed just before landing still counts, which stops it eating inputs. */
const JUMP_BUFFER_MS = 160;
/** eye offset from the capsule centre (centre sits 0.85 above the floor) */
const EYE = 0.8;

/** The blocky figure, shared by the local and the streamed thief. */
function ThiefFigure({ invisible }: { invisible?: boolean }) {
  const opacity = invisible ? 0.3 : 1;
  const transparent = invisible;
  return (
    <group>
      <mesh position={[-0.13, 0.35, 0]}>
        <boxGeometry args={[0.2, 0.7, 0.24]} />
        <meshStandardMaterial color="#1b1c20" roughness={0.9} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0.13, 0.35, 0]}>
        <boxGeometry args={[0.2, 0.7, 0.24]} />
        <meshStandardMaterial color="#1b1c20" roughness={0.9} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0, 1.03, 0]}>
        <boxGeometry args={[0.56, 0.72, 0.3]} />
        <meshStandardMaterial color="#101318" roughness={0.9} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[-0.36, 1.03, 0]}>
        <boxGeometry args={[0.16, 0.66, 0.22]} />
        <meshStandardMaterial color="#101318" roughness={0.9} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0.36, 1.03, 0]}>
        <boxGeometry args={[0.16, 0.66, 0.22]} />
        <meshStandardMaterial color="#101318" roughness={0.9} transparent={transparent} opacity={opacity} />
      </mesh>
      <mesh position={[0, 1.57, 0]}>
        <boxGeometry args={[0.36, 0.38, 0.34]} />
        <meshStandardMaterial color="#e8b02a" roughness={0.75} transparent={transparent} opacity={opacity} />
      </mesh>
    </group>
  );
}

/** Small overhead heading marker so spectators can read movement instantly. */
function HeadingBeacon() {
  return (
    <group position={[0, 2.35, 0]}>
      <mesh position={[0, 0, 0.27]}>
        <boxGeometry args={[0.045, 0.045, 0.48]} />
        <meshBasicMaterial color="#ffd23b" />
      </mesh>
      <mesh position={[0, 0, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.14, 0.28, 4]} />
        <meshBasicMaterial color="#ffd23b" />
      </mesh>
    </group>
  );
}

/** Soft blob under a character so it reads as standing on the floor. */
export function ContactShade() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <circleGeometry args={[0.5, 20]} />
      <meshBasicMaterial color="#05070a" transparent opacity={0.3} />
    </mesh>
  );
}

/** The thief as driven by this client: physics body, input, first person camera. */
function LocalThief() {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const overlay = useRef<THREE.Group>(null);
  const eyeTarget = useRef(new THREE.Vector3());
  const bobT = useRef(0);
  const [sub, get] = useKeyboardControls<Controls>();

  const view = useGame((s) => s.view);
  const hp = useGame((s) => s.hp);
  const resetSeq = useGame((s) => s.resetSeq);
  const firstPerson = view === "thief";

  // the on-screen buttons call the same two functions, so a thumb and a key
  // press are the same action
  useEffect(
    () =>
      sub(
        (s) => s.use,
        (pressed) => pressed && pressUse(),
      ),
    [sub],
  );

  useEffect(
    () =>
      sub(
        (s) => s.jump,
        (pressed) => pressed && pressJump(),
      ),
    [sub],
  );

  useEffect(() => {
    const rb = body.current;
    if (!rb) return;
    rb.setTranslation(
      { x: THIEF_SPAWN[0], y: THIEF_SPAWN[1], z: THIEF_SPAWN[2] },
      true,
    );
    rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    eyeTarget.current.set(THIEF_SPAWN[0], THIEF_SPAWN[1] + EYE, THIEF_SPAWN[2]);
  }, [resetSeq]);

  useFrame((state, rawDt) => {
    const rb = body.current;
    if (!rb) return;
    const dt = clampDt(rawDt);

    const t = rb.translation();
    runtime.thief.set(t.x, t.y, t.z);
    runtime.room = roomAt(t.x, t.z);

    const down = hp > 0 ? get() : ({} as Record<Controls, boolean>);
    // keys and the on-screen stick add together, so either drives the thief
    const stick = hp > 0 ? runtime.touchMove : { x: 0, y: 0 };
    const f = THREE.MathUtils.clamp(
      (down.forward ? 1 : 0) - (down.back ? 1 : 0) + stick.y,
      -1,
      1,
    );
    const r = THREE.MathUtils.clamp(
      (down.right ? 1 : 0) - (down.left ? 1 : 0) + stick.x,
      -1,
      1,
    );

    const cam = state.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1);
    fwd.normalize();
    const side = new THREE.Vector3().crossVectors(
      fwd,
      new THREE.Vector3(0, 1, 0),
    );

    const move = new THREE.Vector3()
      .addScaledVector(fwd, f)
      .addScaledVector(side, r);
    const moving = move.lengthSq() > 1e-4;
    // a stick pushed halfway should walk, not sprint, so keep its magnitude
    const throttle = Math.min(1, move.length());
    if (moving) move.normalize();

    const speed = (down.sprint ? RUN : WALK) * (moving ? throttle : 0);
    const v = rb.linvel();
    // the floor is flat everywhere the thief can walk, so resting height is a
    // cheaper and steadier ground test than a per-frame raycast
    const grounded = t.y <= GROUNDED_Y;
    const wantsJump = performance.now() - runtime.jumpAt < JUMP_BUFFER_MS;
    if (wantsJump && grounded && hp > 0) runtime.jumpAt = -1e9;
    rb.setLinvel(
      {
        x: move.x * speed,
        y: wantsJump && grounded && hp > 0 ? JUMP_V : v.y,
        z: move.z * speed,
      },
      true,
    );

    // in first person the thief faces wherever they are looking, and that is
    // the heading spectators steer by - a LEFT call has to mean the thief's
    // left. Only the top-down views fall back to the travel direction.
    if (firstPerson) runtime.thiefYaw = Math.atan2(fwd.x, fwd.z);
    else if (moving) runtime.thiefYaw = Math.atan2(move.x, move.z);
    if (visual.current) {
      visual.current.rotation.y = runtime.thiefYaw;
      bobT.current += moving ? dt * (down.sprint ? 12 : 8) : 0;
      visual.current.position.y = moving
        ? Math.abs(Math.sin(bobT.current)) * 0.05
        : 0;
    }

    if (firstPerson) {
      eyeTarget.current.set(
        t.x,
        t.y + EYE + (moving ? Math.sin(bobT.current * 2) * 0.02 : 0),
        t.z,
      );
      cam.position.lerp(eyeTarget.current, 1 - Math.exp(-dt * 24));
    }

    if (overlay.current) overlay.current.position.set(t.x, 0, t.z);
  });

  const [invisible, setInvisible] = useState(false);
  useFrame(() => {
    const isNowInvis = useGame.getState().invisibleUntil > Date.now();
    if (invisible !== isNowInvis) setInvisible(isNowInvis);
  });

  const dead = hp <= 0;

  return (
    <>
      <RigidBody
        ref={body}
        type="dynamic"
        colliders={false}
        position={THIEF_SPAWN}
        enabledRotations={[false, false, false]}
        friction={0}
        linearDamping={6}
        mass={1}
        ccd
        userData={{ tag: "thief" }}
      >
        <CapsuleCollider args={[0.5, 0.32] as [number, number]} />
        <group ref={visual} position={[0, -0.85, 0]} visible={!firstPerson}>
          <ThiefFigure invisible={invisible} />
          <ContactShade />
          {!firstPerson && <HeadingBeacon />}
        </group>
      </RigidBody>

      <group ref={overlay}>
        {!firstPerson && (
          <>
            <NeonBox
              position={[0, 0.95, 0]}
              size={[0.85, 1.9, 0.55]}
              color={dead ? "#ff3b47" : "#ffd23b"}
              opacity={0.07}
            />
            <Label
              position={[0, 2.25, 0]}
              color={dead ? "#ff3b47" : "#ffd23b"}
              text={dead ? "Thief (down)" : "Thief"}
            />
          </>
        )}
      </group>
    </>
  );
}

/** The thief as streamed to a spectator: no physics, just a smoothed avatar. */
function RemoteThief() {
  const group = useRef<THREE.Group>(null);
  const mode = useGame((s) => s.mode);
  const thiefRoom = useGame((s) => s.room);
  const hp = useGame((s) => s.hp);
  // a roaming spectator follows the thief, so the thief is always in shot
  const roam = mode.kind === "spectator" && !!mode.roam;
  const watching = mode.kind === "spectator" ? mode.watching : null;
  const inMyRoom = roam || (watching !== null && thiefRoom === watching);

  const [invisible, setInvisible] = useState(false);
  useFrame((_, rawDt) => {
    const isNowInvis = useGame.getState().invisibleUntil > Date.now();
    if (invisible !== isNowInvis) setInvisible(isNowInvis);
    
    const g = group.current;
    const n = runtime.netThief;
    if (!g) return;
    g.visible = inMyRoom && !!n;
    if (!n) return;
    const k = Math.min(1, clampDt(rawDt) * 9);
    runtime.thief.lerp(new THREE.Vector3(n.x, n.y, n.z), k);
    runtime.thiefYaw +=
      (((n.yaw - runtime.thiefYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
    g.position.set(runtime.thief.x, runtime.thief.y - 0.85, runtime.thief.z);
    g.rotation.y = runtime.thiefYaw;
  });

  return (
    <group ref={group} visible={false}>
      <ThiefFigure invisible={invisible} />
      <ContactShade />
      <HeadingBeacon />
      {inMyRoom && (
        <>
          <NeonBox
            position={[0, 0.95, 0]}
            size={[0.85, 1.9, 0.55]}
            color={hp <= 0 ? "#ff3b47" : "#ffd23b"}
            opacity={0.07}
          />
          <Label
            position={[0, 2.25, 0]}
            color={hp <= 0 ? "#ff3b47" : "#ffd23b"}
            text={hp <= 0 ? "Thief (down)" : "Thief"}
          />
        </>
      )}
    </group>
  );
}

export default function Thief() {
  const isHost = useIsHost();
  return isHost ? <LocalThief /> : <RemoteThief />;
}
