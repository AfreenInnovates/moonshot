"use client";

import { useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { ESCAPE_Z } from "../level";
import { useGame } from "../store";
import { Label } from "./Markers";

function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          top: { value: new THREE.Color("#070b14") },
          bottom: { value: new THREE.Color("#1d2a3a") },
        },
        vertexShader: `
          varying vec3 vP;
          void main() {
            vP = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          varying vec3 vP;
          uniform vec3 top;
          uniform vec3 bottom;
          void main() {
            float h = normalize(vP).y * 0.5 + 0.5;
            gl_FragColor = vec4(mix(bottom, top, smoothstep(0.42, 0.9, h)), 1.0);
          }
        `,
      }),
    [],
  );

  return (
    <mesh material={mat} scale={[1, 1, 1]}>
      <sphereGeometry args={[120, 32, 20]} />
    </mesh>
  );
}

function StreetLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 4.4, 8]} />
        <meshStandardMaterial color="#2b2f35" roughness={0.8} />
      </mesh>
      <mesh position={[0, 4.45, 0]}>
        <boxGeometry args={[0.7, 0.16, 0.35]} />
        <meshStandardMaterial
          color="#e8e4d6"
          emissive="#ffe9bb"
          emissiveIntensity={1.4}
        />
      </mesh>
      <pointLight
        position={[0, 4.2, 0]}
        intensity={16}
        distance={18}
        decay={2}
        color="#ffe2b0"
      />
    </group>
  );
}

function Planter({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.6, 1.1]} />
        <meshStandardMaterial color="#4b4f54" roughness={0.9} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[
            Math.cos(i * 1.7) * 0.22,
            0.85 + (i % 2) * 0.18,
            Math.sin(i * 1.7) * 0.22,
          ]}
          rotation={[0.35 * Math.cos(i), i, 0.35 * Math.sin(i)]}
          castShadow
        >
          <boxGeometry args={[0.5, 0.06, 0.2]} />
          <meshStandardMaterial color="#2f6a3f" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

/** Rough city silhouette so the facility does not float in a void. */
function Skyline() {
  const blocks = useMemo(() => {
    const out: { pos: [number, number, number]; size: [number, number, number] }[] =
      [];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = 52 + rnd() * 26;
      const h = 7 + rnd() * 26;
      const w = 6 + rnd() * 9;
      out.push({
        pos: [Math.cos(a) * r, h / 2, Math.sin(a) * r],
        size: [w, h, w],
      });
    }
    return out;
  }, []);

  return (
    <group>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            color="#0f151d"
            emissive="#131c28"
            emissiveIntensity={0.5}
            roughness={1}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Where the run ends - only the spectator layers draw the marker. */
function ExtractionPad() {
  const view = useGame((s) => s.view);
  if (view === "thief") return null;
  return (
    <group position={[0, 0, ESCAPE_Z + 2]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.5, 1.8, 40]} />
        <meshBasicMaterial color="#39ff88" transparent opacity={0.5} />
      </mesh>
      <Label position={[0, 1.2, 0]} color="#39ff88" text="Extraction point" />
    </group>
  );
}

export default function Exterior() {
  const thiefView = useGame((s) => s.view === "thief");

  return (
    <>
      <Sky />

      {/* ground + an invisible perimeter so nobody walks into the void */}
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, -0.14, 6]} receiveShadow>
          <boxGeometry args={[220, 0.24, 220]} />
          <meshStandardMaterial color="#22262b" roughness={1} />
        </mesh>
        <CuboidCollider position={[0, -0.25, 6]} args={[110, 0.25, 110]} />
        <CuboidCollider position={[0, 3, 30]} args={[40, 4, 0.5]} />
        <CuboidCollider position={[0, 3, -18]} args={[40, 4, 0.5]} />
        <CuboidCollider position={[-32, 3, 6]} args={[0.5, 4, 40]} />
        <CuboidCollider position={[32, 3, 6]} args={[0.5, 4, 40]} />
      </RigidBody>

      {/* plaza in front of the entrance */}
      <mesh position={[0, 0.02, 16]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 12]} />
        <meshStandardMaterial color="#3a3e44" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.035, 12.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.2, 4]} />
        <meshStandardMaterial color="#474b51" roughness={0.95} />
      </mesh>

      {/* entrance canopy and sign */}
      <group visible={thiefView}>
        <mesh position={[0, 3.5, 11.6]} castShadow>
          <boxGeometry args={[7.4, 0.25, 2.6]} />
          <meshStandardMaterial color="#33383e" roughness={0.8} />
        </mesh>
      </group>
      <mesh position={[0, 4.3, 10.4]}>
        <boxGeometry args={[4.6, 0.7, 0.15]} />
        <meshStandardMaterial
          color="#12161c"
          emissive="#2b6fa8"
          emissiveIntensity={0.5}
        />
      </mesh>

      <Planter position={[-2.9, 0, 11.6]} />
      <Planter position={[2.9, 0, 11.6]} />
      <StreetLamp position={[-8.5, 0, 13.5]} />
      <StreetLamp position={[8.5, 0, 13.5]} />
      <StreetLamp position={[-8.5, 0, 22]} />
      <StreetLamp position={[8.5, 0, 22]} />

      {/* bollards along the plaza edge */}
      {[-6, -3.5, 3.5, 6].map((x) => (
        <mesh key={x} position={[x, 0.45, 21.5]} castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.9, 8]} />
          <meshStandardMaterial color="#4a4f55" roughness={0.8} />
        </mesh>
      ))}

      <Skyline />
      <ExtractionPad />

      {/* moonlight */}
      <directionalLight
        position={[24, 30, 26]}
        intensity={0.48}
        color="#9fb6d8"
      />
      <directionalLight
        position={[-20, 16, -24]}
        intensity={0.22}
        color="#7f93b5"
      />
    </>
  );
}
