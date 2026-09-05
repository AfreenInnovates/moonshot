"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CAMERAS, type CameraDef } from "../level";
import { runtime } from "../runtime";
import { useGame, useIsHost } from "../store";
import { Label, MarkerOverlay, useMarker } from "./Markers";

function Camera({ def }: { def: CameraDef }) {
  const yawG = useRef<THREE.Group>(null);
  const pitchG = useRef<THREE.Group>(null);
  const coneMat = useRef<THREE.MeshBasicMaterial>(null);
  const { revealed, pending } = useMarker(def);
  const disabled = useGame((s) => s.alarmDisabled);
  const isHost = useIsHost();

  useFrame(({ clock }, rawDt) => {
    // the host owns the sweep; spectators replay the yaw they are sent
    const yaw = isHost
      ? def.baseYaw + Math.sin(clock.elapsedTime * def.speed) * def.sweep
      : (runtime.camYaw[def.id] ?? def.baseYaw);
    runtime.camYaw[def.id] = yaw;
    if (yawG.current) yawG.current.rotation.y = yaw;
    if (pitchG.current) pitchG.current.rotation.x = def.pitch;
    if (coneMat.current) {
      const seen = runtime.seenBy.has(def.id);
      const target = disabled ? 0.04 : seen ? 0.25 : 0.13;
      coneMat.current.opacity +=
        (target - coneMat.current.opacity) * Math.min(1, rawDt * 8);
    }
  });

  const radius = Math.tan(def.fov) * def.range;
  const lo = def.labelOffset ?? [0, 0.7, 0];

  return (
    <group position={def.position}>
      <group ref={yawG}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.3, 10]} />
          <meshStandardMaterial color="#3c3e42" />
        </mesh>
        <group ref={pitchG}>
          <mesh castShadow>
            <boxGeometry args={[0.22, 0.2, 0.42]} />
            <meshStandardMaterial color="#2f3236" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, -0.24]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.07, 0.09, 0.12, 14]} />
            <meshStandardMaterial color="#101215" metalness={0.5} />
          </mesh>
          {/* the hidden cameras have no status light to give them away */}
          {def.reveal === "spectator" && (
            <mesh position={[0.06, 0.11, -0.1]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshStandardMaterial
                color={disabled ? "#334" : "#ff3b47"}
                emissive={disabled ? "#111" : "#ff3b47"}
                emissiveIntensity={disabled ? 0.1 : 2}
              />
            </mesh>
          )}

          {/* vision cone - spectator information, never drawn for the thief */}
          {revealed && (
            /* apex sits on the lens and the cone widens away from it, so the
               spectator reads the sweep as reach rather than as a funnel */
            <mesh
              position={[0, 0, -def.range / 2]}
              rotation={[Math.PI / 2, 0, 0]}
              renderOrder={1}
            >
              <coneGeometry args={[radius, def.range, 28, 1, true]} />
              <meshBasicMaterial
                ref={coneMat}
                color={def.color}
                transparent
                opacity={0.13}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}
        </group>
      </group>

      {revealed && (
        <Label
          position={[lo[0], lo[1], lo[2]]}
          color={def.color}
          text={disabled ? "Camera (disabled)" : def.label}
          sub={def.sub}
        />
      )}
      {pending && (
        <MarkerOverlay def={def} size={[0.4, 0.4, 0.6]} center={[0, 0, 0]} />
      )}
    </group>
  );
}

export default function SecurityCameras() {
  return (
    <>
      {CAMERAS.map((c) => (
        <Camera key={c.id} def={c} />
      ))}
    </>
  );
}
