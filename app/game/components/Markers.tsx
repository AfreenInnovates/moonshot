"use client";

import { useRef, useState } from "react";
import { Html, Edges } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isRevealed, type MarkerDef, type Vec3 } from "../level";
import { playSignal } from "../audio";
import { useSession } from "../session";
import { useGame, useRoomVisible } from "../store";

/** Screen-space neon chip, same language as the reference mock. */
export function Label({
  position,
  color,
  text,
  sub,
  faint = false,
}: {
  position: Vec3;
  color: string;
  text: string;
  sub?: string;
  faint?: boolean;
}) {
  return (
    <Html
      position={position}
      center
      zIndexRange={[20, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: 11,
          lineHeight: 1.15,
          fontWeight: 600,
          letterSpacing: 0.2,
          color,
          background: "rgba(8,12,18,0.86)",
          border: `1px solid ${color}`,
          borderRadius: 4,
          padding: "3px 7px",
          opacity: faint ? 0.55 : 1,
          boxShadow: `0 0 10px ${color}55`,
        }}
      >
        {text}
        {sub ? (
          <div
            style={{
              fontSize: 9,
              fontWeight: 500,
              opacity: 0.75,
              letterSpacing: 0.1,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    </Html>
  );
}

/** Glowing wireframe volume drawn around a physical prop. */
export function NeonBox({
  position,
  rotation = [0, 0, 0],
  size,
  color,
  opacity = 0.1,
  pulse = false,
}: {
  position: Vec3;
  rotation?: Vec3;
  size: Vec3;
  color: string;
  opacity?: number;
  pulse?: boolean;
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (pulse && mat.current)
      mat.current.opacity =
        opacity * (0.55 + 0.45 * Math.sin(clock.elapsedTime * 3));
  });
  return (
    <mesh position={position} rotation={rotation} renderOrder={2}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        ref={mat}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
      />
      <Edges color={color} lineWidth={2} />
    </mesh>
  );
}

/** The clickable "something is here" blip used in discovery mode. */
function Blip({
  position,
  color,
  onClick,
}: {
  position: Vec3;
  color: string;
  onClick: () => void;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock, camera }) => {
    const t = (clock.elapsedTime % 1.6) / 1.6;
    if (ring.current) {
      ring.current.scale.setScalar(0.35 + t * 1.1);
      (ring.current.material as THREE.MeshBasicMaterial).opacity =
        (1 - t) * 0.7;
      ring.current.quaternion.copy(camera.quaternion);
    }
    if (core.current)
      core.current.scale.setScalar(
        (hovered ? 1.35 : 1) *
          (0.9 + 0.1 * Math.sin(clock.elapsedTime * 5)),
      );
  });

  return (
    <group position={position}>
      {/* generous invisible hit area - the visible dot is tiny */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={core} renderOrder={3} raycast={() => null}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          depthTest={false}
        />
      </mesh>
      <mesh ref={ring} renderOrder={3}>
        <ringGeometry args={[0.24, 0.3, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
      <Html
        position={[0, 0.42, 0]}
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          style={{
            fontFamily: "var(--font-geist-mono), monospace",
            fontSize: 10,
            fontWeight: 700,
            color,
            border: `1px dashed ${color}`,
            borderRadius: 4,
            padding: "2px 6px",
            background: "rgba(8,12,18,0.7)",
            opacity: hovered ? 1 : 0.8,
          }}
        >
          ? scan
        </div>
      </Html>
    </group>
  );
}

export interface MarkerViewState {
  /** fully revealed: neon outline + label */
  revealed: boolean;
  /** discovery-tier and still unfound: show a clickable blip instead */
  pending: boolean;
  discover: () => void;
}

export function useMarker(def: MarkerDef): MarkerViewState {
  const view = useGame((s) => s.view);
  const discovered = useGame((s) => !!s.discovered[def.id]);
  // a room is legible once the thief has been in it, or - in multiplayer - if
  // this is the one room you were posted to
  const visible = useRoomVisible(def.room);
  const spectating = useGame((s) => s.mode.kind === "spectator");
  const discoverFn = useGame((s) => s.discover);
  const sendDiscover = useSession((s) => s.sendDiscover);
  const revealed = visible && isRevealed(def.reveal, view, discovered);
  return {
    revealed: revealed && (def.reveal === "spectator" || discovered),
    pending:
      visible &&
      view === "discovery" &&
      def.reveal === "discovery" &&
      !discovered,
    discover: () => {
      discoverFn(def.id, def.label);
      playSignal("discover");
      if (spectating) sendDiscover(def.id);
    },
  };
}

/**
 * Standard overlay for a prop: neon volume + chip when revealed, clickable
 * blip while the spectator has not found it yet. Renders nothing in thief view.
 */
export function MarkerOverlay({
  def,
  size,
  rotation,
  center,
}: {
  def: MarkerDef;
  size: Vec3;
  rotation?: Vec3;
  center?: Vec3;
}) {
  const { revealed, pending, discover } = useMarker(def);
  const p = center ?? def.position;
  const lo = def.labelOffset ?? [0, 0.7, 0];

  if (pending)
    return (
      <Blip
        position={[p[0], p[1] + 0.25, p[2]]}
        color={def.color}
        onClick={discover}
      />
    );

  if (!revealed) return null;

  return (
    <>
      <NeonBox position={p} rotation={rotation} size={size} color={def.color} />
      <Label
        position={[p[0] + lo[0], p[1] + lo[1], p[2] + lo[2]]}
        color={def.color}
        text={def.label}
        sub={def.sub}
      />
    </>
  );
}
