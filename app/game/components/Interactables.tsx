"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { MARKERS, type MarkerDef } from "../level";
import { useGame } from "../store";
import { Label, MarkerOverlay, NeonBox, useMarker } from "./Markers";

const byId = (id: string) => MARKERS.find((m) => m.id === id) as MarkerDef;

function isThief(other: { rigidBodyObject?: THREE.Object3D | null }) {
  return other.rigidBodyObject?.userData?.tag === "thief";
}

/* ------------------------------------------------------------------ keypad */

function Keypad() {
  const def = byId("keypad");
  const [x, y, z] = def.position;
  const open = useGame((s) => s.vaultOpen);
  return (
    <group>
      <group position={[x, y, z]}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.5, 0.09]} />
          <meshStandardMaterial color="#33363b" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.14, 0.05]}>
          <planeGeometry args={[0.2, 0.1]} />
          <meshStandardMaterial
            color="#0b1a12"
            emissive={open ? "#39ff88" : "#ffd23b"}
            emissiveIntensity={1.3}
          />
        </mesh>
        {[0, 1, 2, 3].map((r) =>
          [0, 1, 2].map((c) => (
            <mesh
              key={`${r}-${c}`}
              position={[-0.07 + c * 0.07, 0.02 - r * 0.06, 0.05]}
            >
              <boxGeometry args={[0.05, 0.045, 0.012]} />
              <meshStandardMaterial color="#c8c7c2" />
            </mesh>
          )),
        )}
      </group>
      <MarkerOverlay def={def} size={[0.42, 0.62, 0.2]} />
    </group>
  );
}

/* ------------------------------------------------------- health / bandages */

function MedPickup({ id, heal }: { id: string; heal: number }) {
  const def = byId(id);
  const [x, y, z] = def.position;
  const taken = useGame((s) => !!s.collected[id]);
  const collect = useGame((s) => s.collect);
  const doHeal = useGame((s) => s.heal);
  const box = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (box.current) box.current.rotation.y = clock.elapsedTime * 0.6;
  });

  if (taken) return null;

  return (
    <group>
      <group ref={box} position={[x, y, z]}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.32, 0.4]} />
          <meshStandardMaterial color="#eae7e0" roughness={0.6} />
        </mesh>
        {[0, 1].map((i) => (
          <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
            <mesh position={[0, 0, 0.21]}>
              <boxGeometry args={[0.19, 0.06, 0.01]} />
              <meshStandardMaterial
                color="#39ff88"
                emissive="#39ff88"
                emissiveIntensity={0.7}
              />
            </mesh>
            <mesh position={[0, 0, 0.21]}>
              <boxGeometry args={[0.06, 0.19, 0.01]} />
              <meshStandardMaterial
                color="#39ff88"
                emissive="#39ff88"
                emissiveIntensity={0.7}
              />
            </mesh>
          </group>
        ))}
      </group>
      <CuboidCollider
        position={[x, y + 0.2, z]}
        args={[0.6, 0.8, 0.6]}
        sensor
        onIntersectionEnter={({ other }) => {
          if (!isThief(other)) return;
          collect(id, def.label);
          doHeal(heal, def.label.toLowerCase());
        }}
      />
      <MarkerOverlay def={def} size={[0.6, 0.55, 0.6]} />
    </group>
  );
}

/* ----------------------------------------------------------------- keycard */

function Keycard() {
  const def = byId("keycard");
  const [x, y, z] = def.position;
  const taken = useGame((s) => !!s.collected.keycard);
  const collect = useGame((s) => s.collect);
  const card = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (card.current) {
      card.current.rotation.y = clock.elapsedTime * 1.1;
      card.current.position.y = y + Math.sin(clock.elapsedTime * 2) * 0.03;
    }
  });

  if (taken) return null;

  return (
    <group>
      <group ref={card} position={[x, y, z]}>
        <mesh castShadow>
          <boxGeometry args={[0.22, 0.32, 0.015]} />
          <meshStandardMaterial
            color="#ffd23b"
            emissive="#ffd23b"
            emissiveIntensity={0.25}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.09, 0.012]}>
          <planeGeometry args={[0.16, 0.08]} />
          <meshBasicMaterial color="#6b5a1a" />
        </mesh>
      </group>
      <CuboidCollider
        position={[x, y, z]}
        args={[0.7, 0.9, 0.7]}
        sensor
        onIntersectionEnter={({ other }) => {
          if (!isThief(other)) return;
          collect("keycard", "Keycard");
        }}
      />
      <MarkerOverlay def={def} size={[0.4, 0.5, 0.4]} />
    </group>
  );
}

/* --------------------------------------------------------------- wall vent */

function Vent({ id }: { id: string }) {
  const def = byId(id);
  const [x, y, z] = def.position;
  const { revealed } = useMarker(def);
  // the extraction hatch is the one thing the thief is allowed to see for
  // themselves - once the keypad has released it, they need to find the way out
  const released = useGame((s) => s.ventOpen) && id === "vault-vent";
  const lit = revealed || released;
  return (
    <group>
      <group position={[x, y, z]} rotation={[0, def.rotationY ?? 0, 0]}>
        <mesh>
          <boxGeometry args={[0.9, 0.6, 0.06]} />
          <meshStandardMaterial color="#7c7a74" roughness={0.7} />
        </mesh>
        {[-0.2, -0.07, 0.06, 0.19].map((oy, i) => (
          <mesh key={i} position={[0, oy, 0.04]}>
            <boxGeometry args={[0.78, 0.07, 0.03]} />
            <meshStandardMaterial color="#4d4b47" />
          </mesh>
        ))}
        {/* an open hatch glows, so the thief can see where they are aiming
            even though the marker itself stays spectator-only */}
        {lit && (
          <mesh position={[0, 0, 0.05]}>
            <planeGeometry args={[0.84, 0.54]} />
            <meshBasicMaterial
              color="#39ff88"
              transparent
              opacity={released ? 0.5 : 0.22}
            />
          </mesh>
        )}
      </group>
      <MarkerOverlay def={def} size={[0.18, 0.72, 1.02]} />
    </group>
  );
}

/* -------------------------------------------------------------- floor trap */

function FloorTrap({ id }: { id: string }) {
  const def = byId(id);
  const [x, , z] = def.position;
  const { revealed, pending } = useMarker(def);
  const damage = useGame((s) => s.damage);
  const plate = useRef<THREE.Mesh>(null);
  const last = useRef(-10);

  useFrame(({ clock }, rawDt) => {
    if (plate.current && revealed) {
      const material = plate.current.material as THREE.MeshBasicMaterial;
      const target = 0.11 + (Math.sin(clock.elapsedTime * 2.1) * 0.5 + 0.5) * 0.05;
      material.opacity += (target - material.opacity) * Math.min(1, rawDt * 7);
    }
  });

  return (
    <group>
      {/* barely-there seam in the floor - this much the thief can see */}
      <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 2.4]} />
        <meshStandardMaterial color="#726f69" roughness={1} />
      </mesh>

      <CuboidCollider
        position={[x, 0.4, z]}
        args={[1.2, 0.6, 1.2]}
        sensor
        onIntersectionEnter={({ other }) => {
          if (!isThief(other)) return;
          const now = performance.now() / 1000;
          if (now - last.current < 2) return;
          last.current = now;
          damage(25, "floor trap");
        }}
      />

      {revealed && (
        <>
          <mesh
            ref={plate}
            position={[x, 0.03, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            renderOrder={2}
          >
            <planeGeometry args={[2.4, 2.4]} />
            <meshBasicMaterial
              color={def.color}
              transparent
              opacity={0.14}
              depthWrite={false}
            />
          </mesh>
          <NeonBox
            position={[x, 0.05, z]}
            size={[2.4, 0.02, 2.4]}
            color={def.color}
            opacity={0}
          />
          <Label
            position={[x, 1.5, z]}
            color={def.color}
            text={def.label}
            sub={def.sub}
          />
        </>
      )}

      {pending && (
        <MarkerOverlay def={def} size={[2.4, 0.02, 2.4]} center={[x, 0.05, z]} />
      )}
    </group>
  );
}

/* ------------------------------------------------------------- alarm panel */

function AlarmPanel() {
  const def = byId("alarm");
  const [x, y, z] = def.position;
  const alarm = useGame((s) => s.alarm);
  const disabled = useGame((s) => s.alarmDisabled);
  const lamp = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(({ clock }, rawDt) => {
    if (lamp.current) {
      const target = disabled
        ? 0.05
        : alarm > 60
          ? 1.1 + (Math.sin(clock.elapsedTime * 5) * 0.5 + 0.5) * 0.9
          : 0.3;
      lamp.current.emissiveIntensity +=
        (target - lamp.current.emissiveIntensity) * Math.min(1, rawDt * 9);
    }
  });

  return (
    <group>
      <group position={[x, y, z]} rotation={[0, def.rotationY ?? 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.36, 0.58, 0.14]} />
          <meshStandardMaterial
            color={disabled ? "#4a4a4a" : "#8d2b2b"}
            roughness={0.6}
          />
        </mesh>
        <mesh position={[0, 0.11, 0.08]}>
          <sphereGeometry args={[0.07, 14, 14]} />
          <meshStandardMaterial
            ref={lamp}
            color={disabled ? "#555555" : "#ff5a5a"}
            emissive="#ff2b2b"
            emissiveIntensity={0.3}
          />
        </mesh>
        <mesh position={[0, -0.13, 0.08]}>
          <boxGeometry args={[0.22, 0.13, 0.03]} />
          <meshStandardMaterial color="#e6e4de" />
        </mesh>
      </group>
      <MarkerOverlay def={def} size={[0.5, 0.72, 0.32]} />
    </group>
  );
}

/* --------------------------------------------------------------- valuables */

function Valuables() {
  const def = byId("valuables");
  const [x, y, z] = def.position;
  const taken = useGame((s) => !!s.collected.valuables);
  const collect = useGame((s) => s.collect);

  if (taken) return null;

  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[x - 0.14 + i * 0.14, y + 0.06 + i * 0.055, z]}
          rotation={[0, i * 0.28, 0]}
          castShadow
        >
          <boxGeometry args={[0.34, 0.1, 0.18]} />
          <meshStandardMaterial color="#d9c15a" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}
      <CuboidCollider
        position={[x, y, z]}
        args={[1.1, 1.1, 1.1]}
        sensor
        onIntersectionEnter={({ other }) => {
          if (!isThief(other)) return;
          collect("valuables", "Valuables", 150);
        }}
      />
      <MarkerOverlay def={def} size={[1.0, 0.9, 0.8]} center={[x, y + 0.1, z]} />
    </group>
  );
}

/* ---------------------------------------------------------- vault contents */

function VaultLoot() {
  const def = byId("vault-loot");
  const [x, y, z] = def.position;
  const taken = useGame((s) => !!s.collected["vault-loot"]);
  const open = useGame((s) => s.vaultOpen);
  const collect = useGame((s) => s.collect);

  return (
    <group>
      {/* shelf inside the vault chamber */}
      <mesh position={[x, 0.45, z]} receiveShadow>
        <boxGeometry args={[2.6, 0.1, 0.7]} />
        <meshStandardMaterial color="#43464a" roughness={0.8} />
      </mesh>
      {!taken &&
        [0, 1, 2, 3, 4, 5].map((i) => (
          <mesh
            key={i}
            position={[
              x - 0.85 + (i % 3) * 0.85,
              0.56 + Math.floor(i / 3) * 0.12,
              z,
            ]}
            castShadow
          >
            <boxGeometry args={[0.6, 0.12, 0.3]} />
            <meshStandardMaterial
              color="#e0c65e"
              metalness={0.75}
              roughness={0.25}
              emissive="#3a2f08"
            />
          </mesh>
        ))}
      {!taken && open && (
        <CuboidCollider
          position={[x, 1, z]}
          args={[1.6, 1.2, 1.0]}
          sensor
          onIntersectionEnter={({ other }) => {
            if (!isThief(other)) return;
            collect("vault-loot", "the vault contents", 500);
          }}
        />
      )}
      {!taken && (
        <MarkerOverlay def={def} size={[2.6, 0.9, 0.8]} center={[x, y, z]} />
      )}
    </group>
  );
}

/* --------------------------------------------------------- vault code note */

function CodeNote() {
  const def = byId("note");
  const [x, y, z] = def.position;
  return (
    <group>
      <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0.4]}>
        <planeGeometry args={[0.24, 0.17]} />
        <meshStandardMaterial color="#e9e4d6" side={THREE.DoubleSide} />
      </mesh>
      <MarkerOverlay def={def} size={[0.36, 0.1, 0.32]} />
    </group>
  );
}

export default function Interactables() {
  return (
    <>
      <Keycard />
      <MedPickup id="health" heal={30} />
      <MedPickup id="bandages" heal={20} />
      <Vent id="sec-vent" />
      <Vent id="vault-vent" />
      <FloorTrap id="sec-trap" />
      <FloorTrap id="vault-trap" />
      <AlarmPanel />
      <CodeNote />
      <Keypad />
      <Valuables />
      <VaultLoot />
    </>
  );
}
