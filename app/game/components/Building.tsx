"use client";

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import {
  DOORS,
  MASSES,
  ROOMS,
  ROOM_H,
  SLABS,
  WALLS,
  WALL_T,
  type DoorDef,
  type RoomDef,
  type WallDef,
} from "../level";
import { clampDt, runtime } from "../runtime";
import { useGame, useRoomVisible } from "../store";
import { Label } from "./Markers";

type Box = { pos: [number, number, number]; size: [number, number, number] };

/** Cut a wall run into segments around its openings, with lintels on top. */
function wallBoxes(def: WallDef): Box[] {
  const h = def.height ?? ROOM_H;
  const out: Box[] = [];
  const push = (u1: number, u2: number, y1: number, y2: number) => {
    if (u2 - u1 < 0.01 || y2 - y1 < 0.01) return;
    const mid = (u1 + u2) / 2;
    const len = u2 - u1;
    const y = (y1 + y2) / 2;
    out.push(
      def.axis === "x"
        ? { pos: [mid, y, def.fixed], size: [len, y2 - y1, WALL_T] }
        : { pos: [def.fixed, y, mid], size: [WALL_T, y2 - y1, len] },
    );
  };

  const ops = [...(def.openings ?? [])].sort((a, b) => a.at - b.at);
  let cursor = def.from;
  for (const op of ops) {
    const a = op.at - op.width / 2;
    const b = op.at + op.width / 2;
    push(cursor, a, 0, h);
    push(a, b, op.height ?? h, h); // lintel
    cursor = b;
  }
  push(cursor, def.to, 0, h);
  return out;
}

function Shell() {
  const thiefView = useGame((s) => s.view === "thief");
  const spectator = useGame((s) => s.mode.kind === "spectator");

  return (
    <RigidBody type="fixed" colliders={false}>
      {/* floors are visual only; Exterior owns the single floor collider */}
      {SLABS.map((s) => {
        const w = s.x2 - s.x1;
        const d = s.z2 - s.z1;
        const cx = (s.x1 + s.x2) / 2;
        const cz = (s.z1 + s.z2) / 2;
        return (
          <group key={s.id}>
            <mesh position={[cx, -WALL_T / 2, cz]} receiveShadow>
              <boxGeometry args={[w, WALL_T, d]} />
              <meshStandardMaterial color={s.color} roughness={0.95} />
            </mesh>
            {s.ceiling && (
              <mesh
                position={[cx, ROOM_H + WALL_T / 2, cz]}
                visible={thiefView}
              >
                <boxGeometry args={[w, WALL_T, d]} />
                <meshStandardMaterial color="#b3b0a8" roughness={1} />
              </mesh>
            )}
          </group>
        );
      })}

      {/* wall runs */}
      {WALLS.map((def) =>
        wallBoxes(def).map((b, i) => (
          <group key={`${def.id}-${i}`}>
          <mesh
              position={[
                b.pos[0],
                spectator ? Math.min(b.size[1], 0.7) / 2 : b.pos[1],
                b.pos[2],
              ]}
              visible={thiefView || !def.cutaway}
              castShadow
              receiveShadow
            >
              <boxGeometry
                args={[
                  b.size[0],
                  spectator ? Math.min(b.size[1], 0.7) : b.size[1],
                  b.size[2],
                ]}
              />
              <meshStandardMaterial color={def.color ?? "#8f8b83"} roughness={0.95} />
            </mesh>
            <CuboidCollider
              position={b.pos}
              args={[b.size[0] / 2, b.size[1] / 2, b.size[2] / 2]}
            />
          </group>
        )),
      )}

      {/* solid structure either side of the connecting passages */}
      {MASSES.map((m, i) => (
        <group key={i}>
          <mesh
            position={[
              (m.x1 + m.x2) / 2,
              spectator ? 0.35 : ROOM_H / 2,
              (m.z1 + m.z2) / 2,
            ]}
            receiveShadow
          >
            <boxGeometry
              args={[m.x2 - m.x1, spectator ? 0.7 : ROOM_H, m.z2 - m.z1]}
            />
            <meshStandardMaterial color="#7f7c75" roughness={0.95} />
          </mesh>
          <CuboidCollider
            position={[(m.x1 + m.x2) / 2, ROOM_H / 2, (m.z1 + m.z2) / 2]}
            args={[(m.x2 - m.x1) / 2, ROOM_H / 2, (m.z2 - m.z1) / 2]}
          />
        </group>
      ))}
    </RigidBody>
  );
}

/* -------------------------------------------------------------------- door */

function Door({ def }: { def: DoorDef }) {
  const open = useGame((s) => !!s.doorsOpen[def.id]);
  const keycard = useGame((s) => s.keycard);
  const openDoor = useGame((s) => s.openDoor);
  const pivot = useRef<THREE.Group>(null);
  const [x, , z] = def.at;

  useFrame((_, rawDt) => {
    const dt = clampDt(rawDt);
    if (!open) {
      const near =
        Math.hypot(runtime.thief.x - x, runtime.thief.z - z) < 2.1 &&
        (!def.lock || keycard);
      if (near) openDoor(def.id);
    }
    if (pivot.current) {
      const target = open ? (def.swing * Math.PI) / 2.2 : 0;
      pivot.current.rotation.y +=
        (target - pivot.current.rotation.y) * Math.min(1, dt * 4);
    }
  });

  const half = def.width / 2;
  // hinge sits at one edge of the opening, panel extends across it
  const hinge: [number, number, number] =
    def.axis === "z" ? [x, 0, z - def.swing * half] : [x - def.swing * half, 0, z];
  const panel: [number, number, number] =
    def.axis === "z"
      ? [0, def.height / 2, def.swing * half]
      : [def.swing * half, def.height / 2, 0];
  const size: [number, number, number] =
    def.axis === "z" ? [0.09, def.height, def.width] : [def.width, def.height, 0.09];

  return (
    <group>
      <group ref={pivot} position={hinge}>
        <group position={panel}>
          <mesh castShadow>
            <boxGeometry args={size} />
            <meshStandardMaterial color="#3f4247" roughness={0.7} />
          </mesh>
          {/* colour band so the two wings read like the map key */}
          <mesh position={[def.axis === "z" ? 0.06 : 0, 0.15, def.axis === "z" ? 0 : 0.06]}>
            <boxGeometry
              args={
                def.axis === "z"
                  ? [0.03, 0.5, def.width * 0.8]
                  : [def.width * 0.8, 0.5, 0.03]
              }
            />
            <meshStandardMaterial
              color={def.color}
              emissive={def.color}
              emissiveIntensity={0.5}
            />
          </mesh>
          <mesh
            position={
              def.axis === "z"
                ? [0.08, -0.05, def.swing * (half - 0.25)]
                : [def.swing * (half - 0.25), -0.05, 0.08]
            }
          >
            <sphereGeometry args={[0.06, 10, 10]} />
            <meshStandardMaterial color="#c9c8c2" metalness={0.6} />
          </mesh>
        </group>
      </group>

      {/* the closed leaf is what actually blocks the thief */}
      {!open && (
        <CuboidCollider
          position={[x, def.height / 2, z]}
          args={
            def.axis === "z"
              ? [0.1, def.height / 2, def.width / 2]
              : [def.width / 2, def.height / 2, 0.1]
          }
        />
      )}
    </group>
  );
}

/* --------------------------------------------------------------- fog of war */

/**
 * Spectators can see the shape of the building from the start, but not what is
 * inside a room until the thief has walked into it.
 */
function RoomFog({ room }: { room: RoomDef }) {
  const explored = useRoomVisible(room.id);
  const thiefView = useGame((s) => s.view === "thief");
  const posted = useGame((s) => s.mode.kind === "spectator");
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const [mounted, setMounted] = useState(!explored);

  useFrame((_, rawDt) => {
    if (!mat.current) return;
    const dt = clampDt(rawDt);
    const target = explored ? 0 : 0.94;
    mat.current.opacity +=
      (target - mat.current.opacity) * Math.min(1, dt * 3.5);
    if (explored && mat.current.opacity < 0.02 && mounted) setMounted(false);
  });

  // Do not leave the room's own fog volume mounted during the spectator role
  // handoff; it reads as a giant wall until the fade has completed.
  if (!mounted || thiefView || explored) return null;

  const b = room.bounds;
  const cx = (b.minX + b.maxX) / 2;
  const cz = (b.minZ + b.maxZ) / 2;

  return (
    <group>
      <mesh position={[cx, ROOM_H / 2 - 0.1, cz]}>
        <boxGeometry
          args={[b.maxX - b.minX - 0.1, ROOM_H - 0.2, b.maxZ - b.minZ - 0.1]}
        />
        <meshBasicMaterial
          ref={mat}
          color="#1a212b"
          transparent
          opacity={0.94}
        />
      </mesh>
      {!explored && (
        <Label
          position={[cx, 2.1, cz]}
          color="#6b7787"
          text={room.name.toUpperCase()}
          sub={posted ? "not your room" : "unexplored - follow the thief in"}
        />
      )}
    </group>
  );
}

export default function Building() {
  return (
    <>
      <Shell />
      {DOORS.map((d) => (
        <Door key={d.id} def={d} />
      ))}
      {ROOMS.filter((r) => r.fog).map((r) => (
        <RoomFog key={r.id} room={r} />
      ))}
    </>
  );
}
