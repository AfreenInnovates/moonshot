"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { KeyboardControls } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import Building from "./components/Building";
import Exterior from "./components/Exterior";
import Rooms from "./components/Rooms";
import Interactables from "./components/Interactables";
import SecurityCameras from "./components/SecurityCameras";
import Guards from "./components/Guard";
import Thief from "./components/Thief";
import Systems from "./components/Systems";
import NetSync from "./components/NetSync";
import ViewRig from "./components/ViewRig";
import { useIsHost } from "./store";

const MAP = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "back", keys: ["ArrowDown", "KeyS"] },
  { name: "left", keys: ["ArrowLeft", "KeyA"] },
  { name: "right", keys: ["ArrowRight", "KeyD"] },
  { name: "sprint", keys: ["ShiftLeft", "ShiftRight"] },
  { name: "use", keys: ["KeyE"] },
  { name: "jump", keys: ["Space"] },
];

/**
 * Space is the jump key, and the browser has its own ideas about it: it scrolls
 * the page, and if the player last clicked a HUD button it re-presses that
 * button. Swallow it over the game, but leave it alone in a text field.
 */
function useSpaceForJumpOnly() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      )
        return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export default function GameCanvas() {
  const isHost = useIsHost();
  useSpaceForJumpOnly();

  return (
    <KeyboardControls map={MAP}>
      <Canvas
        shadows="soft"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <ViewRig />
          {/* fixed timestep: a frame hitch must not tunnel bodies through walls.
              Spectators never step the world - they replay what they are sent. */}
          <Physics gravity={[0, -18, 0]} paused={!isHost}>
            <Exterior />
            <Building />
            <Rooms />
            <Interactables />
            <SecurityCameras />
            <Guards />
            <Thief />
            {isHost && <Systems />}
          </Physics>
          <NetSync />
        </Suspense>
      </Canvas>
    </KeyboardControls>
  );
}
