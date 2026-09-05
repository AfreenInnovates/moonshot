"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import type { Vec3 } from "../level";

type P = { position: Vec3; rotationY?: number };

export function Desk({
  position,
  rotationY = 0,
  size = [2.2, 0.75, 1.0],
}: P & { size?: Vec3 }) {
  const [w, h, d] = size;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, h, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, 0.08, d]} />
        <meshStandardMaterial color="#6b5236" roughness={0.8} />
      </mesh>
      {(
        [
          [-w / 2 + 0.12, -d / 2 + 0.12],
          [w / 2 - 0.12, -d / 2 + 0.12],
          [-w / 2 + 0.12, d / 2 - 0.12],
          [w / 2 - 0.12, d / 2 - 0.12],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <mesh key={i} position={[x, h / 2, z]} castShadow>
          <boxGeometry args={[0.09, h, 0.09]} />
          <meshStandardMaterial color="#4a3925" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function Monitor({
  position,
  rotationY = 0,
  scale = 1,
  feed = "#123047",
}: P & { scale?: number; feed?: string }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <boxGeometry args={[0.34, 0.05, 0.22]} />
        <meshStandardMaterial color="#1d1f22" />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[0.07, 0.26, 0.07]} />
        <meshStandardMaterial color="#1d1f22" />
      </mesh>
      <mesh position={[0, 0.52, 0]} castShadow>
        <boxGeometry args={[0.92, 0.56, 0.06]} />
        <meshStandardMaterial color="#141619" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.52, 0.035]}>
        <planeGeometry args={[0.85, 0.48]} />
        <meshStandardMaterial
          color="#0b1622"
          emissive={feed}
          emissiveIntensity={0.75}
        />
      </mesh>
    </group>
  );
}

/** The three-up camera wall from the security room. */
export function MonitorBank({ position, rotationY = 0 }: P) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Monitor position={[-1.05, 0, 0.05]} rotationY={0.25} feed="#14324a" />
      <Monitor position={[0, 0, 0]} feed="#123f36" />
      <Monitor position={[1.05, 0, 0.05]} rotationY={-0.25} feed="#3a2440" />
      {/* keyboard */}
      <mesh position={[0, 0.03, 0.5]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.62, 0.03, 0.2]} />
        <meshStandardMaterial color="#26292e" />
      </mesh>
    </group>
  );
}

export function Chair({ position, rotationY = 0 }: P) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[0.52, 0.09, 0.5]} />
        <meshStandardMaterial color="#232629" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.8, -0.22]} castShadow>
        <boxGeometry args={[0.5, 0.6, 0.09]} />
        <meshStandardMaterial color="#232629" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.45, 8]} />
        <meshStandardMaterial color="#151719" />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.28, 0.3, 0.06, 10]} />
        <meshStandardMaterial color="#151719" />
      </mesh>
    </group>
  );
}

export function Shelf({
  position,
  rotationY = 0,
  books = true,
}: P & { books?: boolean }) {
  const cols = ["#7a5c3a", "#3f5f52", "#6a4550", "#4d5a72", "#7a6c3a"];
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.95, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, 1.9, 1.5]} />
        <meshStandardMaterial color="#54544f" roughness={0.85} />
      </mesh>
      {books &&
        [0.4, 0.95, 1.5].map((y, r) =>
          cols.map((c, i) => (
            <mesh
              key={`${r}-${i}`}
              position={[0.06, y, -0.4 + i * 0.19]}
              castShadow
            >
              <boxGeometry args={[0.22, 0.3, 0.13]} />
              <meshStandardMaterial color={c} roughness={0.9} />
            </mesh>
          )),
        )}
    </group>
  );
}

export function Cabinet({ position, rotationY = 0 }: P) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.62, 1.3, 0.75]} />
        <meshStandardMaterial color="#5c5f59" roughness={0.8} metalness={0.15} />
      </mesh>
      {[0.3, 0.72, 1.14].map((y, i) => (
        <mesh key={i} position={[0.32, y, 0]}>
          <boxGeometry args={[0.03, 0.3, 0.6]} />
          <meshStandardMaterial color="#4a4d48" />
        </mesh>
      ))}
    </group>
  );
}

export function Locker({ position, rotationY = 0 }: P) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 2.0, 1.2]} />
        <meshStandardMaterial color="#4f5a55" roughness={0.75} metalness={0.2} />
      </mesh>
      {[-0.3, 0.3].map((z, i) => (
        <mesh key={i} position={[0.29, 1.0, z]}>
          <boxGeometry args={[0.02, 1.85, 0.52]} />
          <meshStandardMaterial color="#465049" />
        </mesh>
      ))}
    </group>
  );
}

export function Plant({ position, scale = 1 }: { position: Vec3; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.19, 0.44, 12]} />
        <meshStandardMaterial color="#3e4348" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos((i / 5) * Math.PI * 2) * 0.16,
            0.7 + (i % 3) * 0.16,
            Math.sin((i / 5) * Math.PI * 2) * 0.16,
          ]}
          rotation={[0.3 * Math.cos(i), i, 0.3 * Math.sin(i)]}
          castShadow
        >
          <boxGeometry args={[0.42, 0.05, 0.16]} />
          <meshStandardMaterial color="#2f6a3f" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

export function WaterCooler({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.42, 1.0, 0.42]} />
        <meshStandardMaterial color="#d8d6cf" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.28, 0]} castShadow>
        <cylinderGeometry args={[0.19, 0.22, 0.56, 14]} />
        <meshStandardMaterial
          color="#2f7fb5"
          transparent
          opacity={0.75}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

export function Crate({
  position,
  size = 0.85,
  color = "#6f7a3e",
}: {
  position: Vec3;
  size?: number;
  color?: string;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={[size, size, size]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

export function WoodCrate({ position, size = 1 }: { position: Vec3; size?: number }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[size, size, size]} />
        <meshStandardMaterial color="#7a5a34" roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, (s * size) / 2 + 0.01 * s]}>
          <boxGeometry args={[size * 0.98, size * 0.14, 0.02]} />
          <meshStandardMaterial color="#5f4526" />
        </mesh>
      ))}
    </group>
  );
}

export function Whiteboard({ position, rotationY = 0 }: P) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.0, 1.2, 0.06]} />
        <meshStandardMaterial color="#d9d7d0" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[1.86, 1.06]} />
        <meshStandardMaterial color="#eceae3" />
      </mesh>
      {/* scribbled floorplan */}
      {[
        [-0.5, 0.2, 0.5, 0.02],
        [-0.5, -0.25, 0.5, 0.02],
        [-0.26, -0.02, 0.02, 0.45],
        [0.24, -0.02, 0.02, 0.45],
        [0.55, 0.3, 0.4, 0.02],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, 0.045]}>
          <planeGeometry args={[w, h]} />
          <meshBasicMaterial color="#5d7fa6" />
        </mesh>
      ))}
    </group>
  );
}

export function CeilingLight({
  position,
  intensity = 7,
  cast = false,
  color = "#ffeecc",
}: {
  position: Vec3;
  intensity?: number;
  cast?: boolean;
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.9, 0.12, 0.55]} />
        <meshStandardMaterial color="#cfcdc6" />
      </mesh>
      <mesh position={[0, -0.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.75, 0.45]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={color}
          emissiveIntensity={1.7}
        />
      </mesh>
      <pointLight
        position={[0, -0.45, 0]}
        intensity={intensity}
        distance={14}
        decay={2}
        color={color}
        castShadow={cast}
        shadow-mapSize={[768, 768]}
        shadow-bias={-0.001}
        shadow-normalBias={0.035}
      />
    </group>
  );
}

/** Thin wayfinding insert that sits above the floor without z-fighting. */
export function FloorMark({
  position,
  size,
  color,
  rotationY = 0,
  opacity = 0.5,
}: {
  position: Vec3;
  size: [number, number];
  color: string;
  rotationY?: number;
  opacity?: number;
}) {
  return (
    <mesh
      position={[position[0], 0.012, position[2]]}
      rotation={[-Math.PI / 2, 0, rotationY]}
      renderOrder={1}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
      />
    </mesh>
  );
}

/** A flat wall console used to give each room a readable visual anchor. */
export function WallPanel({
  position,
  width = 2.8,
  color = "#4aa8ff",
  rotationY = 0,
}: {
  position: Vec3;
  width?: number;
  color?: string;
  rotationY?: number;
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[width, 1.5, 0.12]} />
        <meshStandardMaterial color="#1b2027" roughness={0.75} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.48, 0.07]}>
        <boxGeometry args={[width - 0.26, 0.08, 0.025]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * (width / 3.8), 1.05, 0.07]}>
          <boxGeometry args={[width / 5.5, 0.4, 0.025]} />
          <meshStandardMaterial
            color="#10151c"
            emissive={color}
            emissiveIntensity={0.18 + (i + 1) * 0.08}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 0.07]}>
        <boxGeometry args={[width - 0.26, 0.035, 0.025]} />
        <meshBasicMaterial color="#5b6470" transparent opacity={0.65} />
      </mesh>
    </group>
  );
}

/** Narrow light blade for room edges and important thresholds. */
export function LightBar({
  position,
  width = 2,
  color = "#39ff88",
  rotationY = 0,
}: {
  position: Vec3;
  width?: number;
  color?: string;
  rotationY?: number;
}) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <boxGeometry args={[width, 0.045, 0.045]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
    </mesh>
  );
}

/** A compact row of status blocks for the security room. */
export function ControlRack({
  position,
  color = "#39ff88",
}: {
  position: Vec3;
  color?: string;
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <group position={position}>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.72, 2.1, 0.5]} />
        <meshStandardMaterial color="#242a31" roughness={0.82} metalness={0.25} />
      </mesh>
      {[0.35, 0.78, 1.21, 1.64].map((y, i) => (
        <group key={y}>
          <mesh position={[0, y, 0.27]}>
            <boxGeometry args={[0.48, 0.09, 0.025]} />
            <meshStandardMaterial color="#0e1319" />
          </mesh>
          <mesh position={[-0.2 + (i % 2) * 0.18, y, 0.29]}>
            <boxGeometry args={[0.035, 0.035, 0.018]} />
            <meshBasicMaterial color={i === 1 ? "#ff5b55" : color} />
          </mesh>
        </group>
      ))}
      </group>
    </RigidBody>
  );
}

/** Tall server cabinet that gives the security room vertical scale. */
export function ServerRack({
  position,
  color = "#39ff88",
}: {
  position: Vec3;
  color?: string;
}) {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <group position={position}>
      <mesh position={[0, 1.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 2.7, 0.72]} />
        <meshStandardMaterial color="#20252b" roughness={0.78} metalness={0.28} />
      </mesh>
      <mesh position={[0, 2.45, 0.37]}>
        <boxGeometry args={[0.7, 0.04, 0.025]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {[0.55, 0.9, 1.25, 1.6, 1.95].map((y, i) => (
        <group key={y}>
          <mesh position={[0, y, 0.37]}>
            <boxGeometry args={[0.7, 0.13, 0.025]} />
            <meshStandardMaterial color="#0d1116" />
          </mesh>
          <mesh position={[-0.25 + (i % 3) * 0.2, y, 0.39]}>
            <boxGeometry args={[0.025, 0.025, 0.018]} />
            <meshBasicMaterial color={i === 2 ? "#ff5b55" : color} />
          </mesh>
        </group>
      ))}
      </group>
    </RigidBody>
  );
}

/** Heavy pedestal that makes the vault objective feel deliberate. */
export function VaultPedestal({ position }: { position: Vec3 }) {
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <group position={position}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.15, 0.4, 0.9]} />
        <meshStandardMaterial color="#3a3530" roughness={0.7} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.43, 0]}>
        <boxGeometry args={[0.92, 0.05, 0.68]} />
        <meshStandardMaterial color="#8c6e2f" emissive="#5a3f0b" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.49, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.34]} />
        <meshStandardMaterial color="#dfc15b" metalness={0.8} roughness={0.2} />
      </mesh>
      </group>
    </RigidBody>
  );
}

/** Reception counter for the lobby. */
export function Reception({ position, rotationY = 0 }: P) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 1.1, 0.7]} />
        <meshStandardMaterial color="#4a4e55" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.14, 0.06]} castShadow>
        <boxGeometry args={[4.5, 0.09, 0.95]} />
        <meshStandardMaterial color="#8b9099" roughness={0.8} />
      </mesh>
      <mesh position={[-2.05, 0.55, -0.9]} castShadow receiveShadow>
        <boxGeometry args={[0.7, 1.1, 2.0]} />
        <meshStandardMaterial color="#4a4e55" roughness={0.85} />
      </mesh>
      <mesh position={[-2.05, 1.14, -0.9]} castShadow>
        <boxGeometry args={[0.95, 0.09, 2.1]} />
        <meshStandardMaterial color="#8b9099" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function Sofa({ position, rotationY = 0 }: P) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.28, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.0, 0.42, 0.8]} />
        <meshStandardMaterial color="#33383f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.62, -0.32]} castShadow>
        <boxGeometry args={[2.0, 0.55, 0.18]} />
        <meshStandardMaterial color="#3a4048" roughness={0.95} />
      </mesh>
    </group>
  );
}

/** Slow breathing status LED, used to make rooms feel alive without flicker. */
export function StatusLight({
  position,
  color = "#39ff88",
  speed = 1.6,
}: {
  position: Vec3;
  color?: string;
  speed?: number;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }, rawDt) => {
    if (mat.current) {
      const target = 1.05 + (Math.sin(clock.elapsedTime * speed) * 0.5 + 0.5) * 0.55;
      mat.current.emissiveIntensity +=
        (target - mat.current.emissiveIntensity) * Math.min(1, rawDt * 8);
    }
  });
  return (
    <mesh position={position}>
      <sphereGeometry args={[0.035, 8, 8]} />
      <meshStandardMaterial
        ref={mat}
        color={color}
        emissive={color}
        emissiveIntensity={1.4}
      />
    </mesh>
  );
}
