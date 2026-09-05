"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CapsuleCollider,
  RigidBody,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { C, GUARD_LABEL, PATROLS, type PatrolDef } from "../level";
import { clampDt, guardState, runtime } from "../runtime";
import { useGame, useIsHost, useRoomVisible } from "../store";
import { Label, NeonBox } from "./Markers";
import { ContactShade } from "./Thief";

const SPEED = 1.5;
const CHASE_SPEED = 2.4;

function Figure({ suit, skin }: { suit: string; skin: string }) {
  return (
    <group>
      <mesh position={[-0.13, 0.35, 0]}>
        <boxGeometry args={[0.2, 0.7, 0.24]} />
        <meshStandardMaterial color="#22242a" roughness={0.9} />
      </mesh>
      <mesh position={[0.13, 0.35, 0]}>
        <boxGeometry args={[0.2, 0.7, 0.24]} />
        <meshStandardMaterial color="#22242a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.03, 0]}>
        <boxGeometry args={[0.56, 0.72, 0.3]} />
        <meshStandardMaterial color={suit} roughness={0.85} />
      </mesh>
      <mesh position={[-0.36, 1.03, 0]}>
        <boxGeometry args={[0.16, 0.66, 0.22]} />
        <meshStandardMaterial color={suit} roughness={0.85} />
      </mesh>
      <mesh position={[0.36, 1.03, 0]}>
        <boxGeometry args={[0.16, 0.66, 0.22]} />
        <meshStandardMaterial color={suit} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[0.36, 0.34, 0.34]} />
        <meshStandardMaterial color={skin} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.76, 0]}>
        <boxGeometry args={[0.4, 0.12, 0.38]} />
        <meshStandardMaterial color={suit} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.71, -0.24]}>
        <boxGeometry args={[0.36, 0.05, 0.14]} />
        <meshStandardMaterial color={suit} roughness={0.85} />
      </mesh>
    </group>
  );
}

function VisionCone({
  def,
  matRef,
}: {
  def: PatrolDef;
  matRef: React.RefObject<THREE.MeshBasicMaterial | null>;
}) {
  const radius = Math.tan(def.vision.fov) * def.vision.range;
  return (
    <mesh
      position={[0, 1.35, -def.vision.range / 2]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={1}
    >
      <coneGeometry args={[radius, def.vision.range, 24, 1, true]} />
      <meshBasicMaterial
        ref={matRef}
        color={C.blue}
        transparent
        opacity={0.1}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function GuardTag({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <>
      <NeonBox
        position={[0, 0.95, 0]}
        size={[0.85, 1.9, 0.55]}
        color={C.blue}
        opacity={0.08}
      />
      <Label position={[0, 2.2, 0]} color={C.blue} text={GUARD_LABEL} />
    </>
  );
}

/** Patrolling guard simulated on the host. */
function LocalGuard({ def, show }: { def: PatrolDef; show: boolean }) {
  const body = useRef<RapierRigidBody>(null);
  const visual = useRef<THREE.Group>(null);
  const overlay = useRef<THREE.Group>(null);
  const coneMat = useRef<THREE.MeshBasicMaterial>(null);
  const wp = useRef(0);
  const wait = useRef(0);
  const resetSeq = useGame((s) => s.resetSeq);

  useEffect(() => {
    wp.current = 0;
    body.current?.setTranslation(
      { x: def.path[0][0], y: 0, z: def.path[0][1] },
      true,
    );
  }, [resetSeq, def.path]);

  useFrame((_, rawDt) => {
    const rb = body.current;
    if (!rb) return;
    const dt = clampDt(rawDt);
    const state = guardState(def.id);
    const p = rb.translation();
    state.pos.set(p.x, p.y, p.z);

    const chasing =
      runtime.alert > 45 &&
      performance.now() / 1000 - runtime.lastSeen < 5 &&
      runtime.room === def.room;

    const target = chasing
      ? new THREE.Vector2(runtime.thief.x, runtime.thief.z)
      : new THREE.Vector2(...def.path[wp.current]);

    const dir = target.clone().sub(new THREE.Vector2(p.x, p.z));
    const dist = dir.length();

    if (!chasing && dist < 0.35) {
      wait.current += dt;
      if (wait.current > 1.1) {
        wait.current = 0;
        wp.current = (wp.current + 1) % def.path.length;
      }
    } else if (dist > (chasing ? 2.1 : 0.05)) {
      dir.normalize();
      const speed = chasing ? CHASE_SPEED : SPEED;
      rb.setNextKinematicTranslation({
        x: p.x + dir.x * speed * dt,
        y: p.y,
        z: p.z + dir.y * speed * dt,
      });
    }

    // cones look down local -Z, so face travel direction with a half turn
    const wantYaw = Math.atan2(dir.x, dir.y) + Math.PI;
    state.yaw +=
      (((wantYaw - state.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) *
      Math.min(1, dt * 6);
    if (visual.current) visual.current.rotation.y = state.yaw;
    if (overlay.current) overlay.current.position.set(p.x, 0, p.z);
    if (coneMat.current) coneMat.current.opacity = chasing ? 0.22 : 0.1;
  });

  return (
    <>
      <RigidBody
        ref={body}
        type="kinematicPosition"
        colliders={false}
        position={[def.path[0][0], 0, def.path[0][1]]}
        userData={{ tag: "guard" }}
      >
        <CapsuleCollider args={[0.55, 0.35]} position={[0, 0.9, 0]} />
        <group ref={visual}>
          <Figure suit="#2b3f63" skin="#c9a06a" />
          <ContactShade />
          {show && <VisionCone def={def} matRef={coneMat} />}
        </group>
      </RigidBody>
      <group ref={overlay}>
        <GuardTag show={show} />
      </group>
    </>
  );
}

/** Guard streamed from the thief's client. */
function RemoteGuard({ def, show }: { def: PatrolDef; show: boolean }) {
  const group = useRef<THREE.Group>(null);
  const overlay = useRef<THREE.Group>(null);
  const coneMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((_, rawDt) => {
    const n = runtime.netGuards[def.id];
    if (!group.current) return;
    // nothing to draw until the thief's client has told us where this guard is
    group.current.visible = show && !!n;
    if (overlay.current) overlay.current.visible = show && !!n;
    if (!n) return;
    const state = guardState(def.id);
    const k = Math.min(1, clampDt(rawDt) * 9);
    state.pos.lerp(new THREE.Vector3(n[0], 0, n[1]), k);
    state.yaw +=
      (((n[2] - state.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * k;
    group.current.position.set(state.pos.x, 0, state.pos.z);
    group.current.rotation.y = state.yaw;
    overlay.current?.position.set(state.pos.x, 0, state.pos.z);
    if (coneMat.current) coneMat.current.opacity = 0.1;
  });

  return (
    <>
      <group ref={group}>
        <Figure suit="#2b3f63" skin="#c9a06a" />
        <ContactShade />
        {show && <VisionCone def={def} matRef={coneMat} />}
      </group>
      <group ref={overlay}>
        <GuardTag show={show} />
      </group>
    </>
  );
}

function Guard({ def }: { def: PatrolDef }) {
  const isHost = useIsHost();
  const view = useGame((s) => s.view);
  const visible = useRoomVisible(def.room);
  const show = view !== "thief" && visible;
  return isHost ? (
    <LocalGuard def={def} show={show} />
  ) : (
    <RemoteGuard def={def} show={show} />
  );
}

export default function Guards() {
  return (
    <>
      {PATROLS.map((p) => (
        <Guard key={p.id} def={p} />
      ))}
    </>
  );
}
