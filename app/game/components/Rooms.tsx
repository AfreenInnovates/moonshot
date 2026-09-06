"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { clampDt } from "../runtime";
import { useGame } from "../store";
import {
  Cabinet,
  CeilingLight,
  Chair,
  ControlRack,
  Crate,
  Desk,
  FloorMark,
  LightBar,
  Locker,
  Monitor,
  MonitorBank,
  Plant,
  Reception,
  ServerRack,
  Shelf,
  Sofa,
  StatusLight,
  WaterCooler,
  WallPanel,
  VaultPedestal,
  Whiteboard,
  WoodCrate,
} from "./Furniture";
import { Label } from "./Markers";

const ROOM_COLORS = {
  lobby: "#4aa8ff",
  security: "#39ff88",
  vault: "#ffd23b",
};

function RoomSign({
  position,
  title,
  code,
  color,
  rotationY = 0,
}: {
  position: [number, number, number];
  title: string;
  code: string;
  color: string;
  rotationY?: number;
}) {
  const showLabel = useGame((s) => s.view !== "thief");
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[3.5, 0.72, 0.08]} />
        <meshStandardMaterial color="#11161d" roughness={0.65} metalness={0.25} />
      </mesh>
      <mesh position={[-1.3, 0.14, 0.05]}>
        <boxGeometry args={[0.85, 0.05, 0.018]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[-0.1, 0.14, 0.05]}>
        <boxGeometry args={[0.85, 0.05, 0.018]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} />
      </mesh>
      <mesh position={[1.1, 0.14, 0.05]}>
        <boxGeometry args={[0.45, 0.05, 0.018]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {showLabel && (
        <Label position={[0, 0.02, 0.08]} color={color} text={title} sub={code} />
      )}
    </group>
  );
}

function FloorGuide({ color, x = 0 }: { color: string; x?: number }) {
  return (
    <group>
      <FloorMark position={[x, 0, 8.55]} size={[0.14, 2.6]} color={color} opacity={0.8} />
      <FloorMark position={[x, 0, 5.9]} size={[0.14, 2.2]} color={color} opacity={0.45} />
      <FloorMark position={[x, 0, 3.6]} size={[0.14, 1.4]} color={color} opacity={0.22} />
    </group>
  );
}

/** Accent strip along one wall of a room. `cx` is that room's centre in x. */
function RoomEdgeLights({
  color,
  z,
  cx = 0,
  count = 5,
}: {
  color: string;
  z: number;
  cx?: number;
  count?: number;
}) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <LightBar key={i} position={[cx - 4.2 + i * 2.1, 0.08, z]} width={1.05} color={color} />
      ))}
    </group>
  );
}

/** Spectators get the architectural shell, but only their room's contents. */
function RoomContents({
  room,
  children,
}: {
  room: "lobby" | "sec" | "vault";
  children: React.ReactNode;
}) {
  const mode = useGame((s) => s.mode);
  const explored = useGame((s) => !!s.explored[room]);
  const visible =
    mode.kind !== "spectator"
      ? true
      : mode.roam
        ? explored
        : mode.watching === room;
  return visible ? <group>{children}</group> : null;
}

function PortalFrame({
  position,
  label,
  color,
  rotationY = 0,
}: {
  position: [number, number, number];
  label: string;
  color: string;
  rotationY?: number;
}) {
  const showLabel = useGame((s) => s.view !== "thief");
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[-0.95, 1.3, 0]} castShadow>
        <boxGeometry args={[0.12, 2.6, 0.2]} />
        <meshStandardMaterial color="#383d44" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0.95, 1.3, 0]} castShadow>
        <boxGeometry args={[0.12, 2.6, 0.2]} />
        <meshStandardMaterial color="#383d44" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh position={[0, 2.58, 0]}>
        <boxGeometry args={[2.02, 0.12, 0.2]} />
        <meshStandardMaterial color="#383d44" roughness={0.7} metalness={0.25} />
      </mesh>
      <LightBar position={[-0.52, 2.58, 0.13]} width={0.55} color={color} />
      <LightBar position={[0.52, 2.58, 0.13]} width={0.55} color={color} />
      {showLabel && <Label position={[0, 2.98, 0.08]} color={color} text={label} sub="connected passage" />}
    </group>
  );
}

/* --------------------------------------------------------------- lobby ---- */

function Lobby() {
  return (
    <RoomContents room="lobby">
      <RigidBody type="fixed" colliders="cuboid">
        <Reception position={[-2.6, 0, 5.0]} />
        <Sofa position={[3.9, 0, 4.2]} rotationY={-Math.PI / 2} />
        {/* low display block in the middle of the room */}
        <mesh position={[0, 0.22, -1.2]} castShadow receiveShadow>
          <boxGeometry args={[1.6, 0.44, 1.6]} />
          <meshStandardMaterial color="#3f434a" roughness={0.8} />
        </mesh>
      </RigidBody>

      <Plant position={[0, 0.44, -1.2]} scale={1.25} />
      <Plant position={[-4.7, 0, 6.2]} />
      <Plant position={[4.7, 0, 6.2]} />
      <Plant position={[-4.7, 0, -6.2]} />
      <Plant position={[4.7, 0, -6.2]} />
      <Monitor position={[-3.9, 1.19, 4.7]} rotationY={0.2} scale={0.7} />

      <RoomSign position={[0, 2.82, -6.82]} title="LOBBY" code="ORIENTATION HUB / 01" color={ROOM_COLORS.lobby} />
      <WallPanel position={[3.75, 0, -6.72]} width={1.8} color={ROOM_COLORS.lobby} />
      <FloorGuide color={ROOM_COLORS.lobby} />
      <RoomEdgeLights color={ROOM_COLORS.lobby} z={-6.68} />
      <FloorMark position={[0, 0, 0.2]} size={[7.4, 0.08]} color={ROOM_COLORS.lobby} opacity={0.3} />
      <PortalFrame position={[-5.62, 0, 2.5]} label="SECURITY" color={ROOM_COLORS.security} rotationY={Math.PI / 2} />
      <PortalFrame position={[5.62, 0, 2.5]} label="VAULT" color={ROOM_COLORS.vault} rotationY={-Math.PI / 2} />

      {/* wayfinding sign on the north wall */}
      <group position={[0, 2.5, -6.8]}>
        <mesh>
          <boxGeometry args={[3.0, 0.7, 0.06]} />
          <meshStandardMaterial color="#22262c" roughness={0.6} />
        </mesh>
        <mesh position={[-0.75, 0, 0.04]}>
          <planeGeometry args={[1.2, 0.16]} />
          <meshBasicMaterial color="#4aa8ff" />
        </mesh>
        <mesh position={[0.78, 0, 0.04]}>
          <planeGeometry args={[1.2, 0.16]} />
          <meshBasicMaterial color="#ffd23b" />
        </mesh>
      </group>

      <CeilingLight position={[0, 3.55, 4.2]} cast color="#d9e8ff" />
      <CeilingLight position={[0, 3.55, -0.5]} color="#d9e8ff" />
      <CeilingLight position={[0, 3.55, -5.2]} color="#d9e8ff" />
      <pointLight position={[0, 2.4, -6.1]} intensity={0.45} distance={8} decay={2} color="#2d6bff" />
    </RoomContents>
  );
}

/* ------------------------------------------------------- security room ---- */

function SecurityRoom() {
  return (
    <RoomContents room="sec">
      <RigidBody type="fixed" colliders="cuboid">
        <Desk position={[-15, 0, -5.9]} size={[5.2, 0.75, 1.1]} />
        <Desk position={[-9.6, 0, 2.6]} size={[1.8, 0.72, 0.9]} rotationY={0.2} />
        <Locker position={[-21.5, 0, -5.2]} />
        <Locker position={[-21.5, 0, -3.9]} />
        <Shelf position={[-21.5, 0, 0.4]} />
        <Cabinet position={[-8.6, 0, -4.4]} rotationY={Math.PI} />
        <Cabinet position={[-8.6, 0, -3.5]} rotationY={Math.PI} />
      </RigidBody>

      <WaterCooler position={[-20.6, 0, 4.8]} />

      <MonitorBank position={[-15, 0.79, -5.75]} />
      <Chair position={[-15, 0, -4.6]} rotationY={Math.PI} />
      <Monitor position={[-9.6, 0.76, 2.6]} rotationY={Math.PI + 0.2} scale={0.8} />
      <Whiteboard position={[-10.6, 2.1, -6.8]} />
      <Plant position={[-8.9, 0, 5.6]} />
      <Crate position={[-19.4, 0.42, 6.2]} size={0.84} color="#6f7a3e" />
      <Crate position={[-18.5, 0.42, 6.2]} size={0.84} color="#6f7a3e" />
      <StatusLight position={[-15, 1.62, -6.4]} color="#39ff88" />
      <RoomSign position={[-15, 2.82, -6.82]} title="SECURITY" code="SURVEILLANCE DECK / 02" color={ROOM_COLORS.security} />
      <WallPanel position={[-10.15, 0, -6.72]} width={2.2} color={ROOM_COLORS.security} />
      <ControlRack position={[-20.8, 0, -5.9]} color={ROOM_COLORS.security} />
      <ControlRack position={[-19.8, 0, -5.9]} color="#ff5b55" />
      <ServerRack position={[-20.8, 0, 1.1]} color={ROOM_COLORS.security} />
      <ServerRack position={[-19.8, 0, 1.1]} color={ROOM_COLORS.security} />
      <ServerRack position={[-18.8, 0, 1.1]} color="#ff5b55" />
      <RoomEdgeLights color={ROOM_COLORS.security} z={-6.68} cx={-15} />
      <FloorMark position={[-15, 0, 1]} size={[0.1, 9.5]} color={ROOM_COLORS.security} opacity={0.3} />

      <CeilingLight position={[-18.5, 3.55, -3.5]} cast color="#d6ffe8" />
      <CeilingLight position={[-11.5, 3.55, -3.5]} color="#d6ffe8" />
      <CeilingLight position={[-15, 3.55, -5.6]} color="#d6ffe8" />
      <CeilingLight position={[-15, 3.55, 3.5]} color="#d6ffe8" />
      <pointLight position={[-15, 2.5, -6.2]} intensity={0.55} distance={9} decay={2} color="#39ff88" />
      <pointLight position={[-15, 2.1, 4.5]} intensity={0.35} distance={7} decay={2} color="#ff3b47" />
    </RoomContents>
  );
}

/* ---------------------------------------------------------- vault room ---- */

/** The round door sitting in the north-wall opening of the vault room. */
function VaultDoor() {
  const open = useGame((s) => s.vaultOpen);
  const pivot = useRef<THREE.Group>(null);
  const wheel = useRef<THREE.Group>(null);

  useFrame((_, rawDt) => {
    const dt = clampDt(rawDt);
    if (pivot.current) {
      const target = open ? -1.4 : 0;
      pivot.current.rotation.y +=
        (target - pivot.current.rotation.y) * Math.min(1, dt * 1.4);
    }
    if (wheel.current && open) wheel.current.rotation.z += dt * 1.2;
  });

  return (
    <group>
      {/* reinforced surround */}
      <mesh position={[15, 1.5, -6.82]} receiveShadow>
        <boxGeometry args={[4.6, 3.4, 0.12]} />
        <meshStandardMaterial color="#6d6b66" roughness={0.8} />
      </mesh>
      <mesh position={[15, 1.5, -6.9]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.72, 1.72, 0.08, 40]} />
        <meshStandardMaterial
          color="#0d0f12"
          emissive={open ? "#e8b24a" : "#000000"}
          emissiveIntensity={open ? 0.5 : 0}
        />
      </mesh>

      <group ref={pivot} position={[13.45, 1.5, -6.75]}>
        <group position={[1.55, 0, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[1.68, 1.68, 0.3, 44]} />
            <meshStandardMaterial color="#a3a29d" roughness={0.55} metalness={0.35} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]}>
            <torusGeometry args={[1.44, 0.05, 10, 44]} />
            <meshStandardMaterial color="#8b8a86" metalness={0.4} />
          </mesh>
          <group ref={wheel} position={[0, 0, 0.24]}>
            <mesh>
              <torusGeometry args={[0.5, 0.07, 10, 30]} />
              <meshStandardMaterial color="#b7b6b1" metalness={0.5} roughness={0.4} />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} rotation={[0, 0, (i * Math.PI) / 2.5]}>
                <boxGeometry args={[0.98, 0.07, 0.07]} />
                <meshStandardMaterial color="#b7b6b1" metalness={0.5} />
              </mesh>
            ))}
            <mesh>
              <sphereGeometry args={[0.14, 16, 16]} />
              <meshStandardMaterial color="#9a9994" metalness={0.6} />
            </mesh>
          </group>
        </group>
      </group>

      {/* the shut door is solid */}
      {!open && (
        <CuboidCollider position={[15, 1.5, -6.9]} args={[1.8, 1.5, 0.2]} />
      )}
    </group>
  );
}

function VaultRoom() {
  return (
    <RoomContents room="vault">
      <RigidBody type="fixed" colliders="cuboid">
        <WoodCrate position={[20.7, 0.5, 4.3]} />
        <WoodCrate position={[20.7, 1.5, 4.3]} />
        <WoodCrate position={[19.5, 0.5, 4.9]} />
        <Desk position={[10.6, 0, 4.3]} size={[1.7, 0.75, 0.9]} />
        <Locker position={[21.4, 0, -4.4]} />
        <Locker position={[21.4, 0, -3.1]} />
        <Cabinet position={[8.6, 0, -4.4]} />
        <Crate position={[8.9, 0.42, 5.4]} size={0.84} color="#5f6a3a" />
      </RigidBody>

      <VaultDoor />
      <Plant position={[9.0, 0, 6.2]} />
      <StatusLight position={[17.6, 1.95, -6.7]} color="#ffd23b" speed={2.4} />
      <VaultPedestal position={[10.6, 0, 4.3]} />
      <RoomSign position={[15, 2.82, 6.82]} rotationY={Math.PI} title="VAULT" code="PRIMARY OBJECTIVE / 03" color={ROOM_COLORS.vault} />
      <WallPanel position={[9.2, 0, 6.72]} width={1.8} color={ROOM_COLORS.vault} rotationY={Math.PI} />
      <FloorMark position={[15, 0, 1.5]} size={[0.12, 8.2]} color={ROOM_COLORS.vault} opacity={0.3} />
      <FloorMark position={[15, 0, -5.2]} size={[5.4, 0.12]} color={ROOM_COLORS.vault} opacity={0.55} />
      <RoomEdgeLights color={ROOM_COLORS.vault} z={6.68} cx={15} />

      <CeilingLight position={[11.5, 3.55, -3]} cast color="#fff0c2" />
      <CeilingLight position={[18.5, 3.55, -3]} color="#fff0c2" />
      <CeilingLight position={[15, 3.55, -5.5]} color="#fff0c2" />
      <CeilingLight position={[15, 3.55, 3.5]} color="#fff0c2" />
      <pointLight position={[15, 2.2, -6.3]} intensity={0.65} distance={9} decay={2} color="#ff9f43" />

      {/* inside the annex */}
      <pointLight
        position={[15, 2.4, -8.6]}
        intensity={4}
        distance={6}
        decay={2}
        color="#ffd9a0"
      />
    </RoomContents>
  );
}

/* --------------------------------------------------------- entrance ------- */

function Entrance() {
  return (
    <group>
      {/* glass doors, permanently open */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * 1.05, 1.3, 10.5]}
          rotation={[0, s * 0.5, 0]}
          castShadow
        >
          <boxGeometry args={[1.35, 2.5, 0.07]} />
          <meshStandardMaterial
            color="#9fd2e6"
            transparent
            opacity={0.25}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.015, 9.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.4, 1.6]} />
        <meshStandardMaterial color="#33363b" roughness={1} />
      </mesh>
      <CeilingLight position={[0, 3.4, 8.8]} intensity={7} />
    </group>
  );
}

export default function Rooms() {
  return (
    <>
      <Entrance />
      <Lobby />
      <SecurityRoom />
      <VaultRoom />
    </>
  );
}
