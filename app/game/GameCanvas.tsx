"use client";

import { Suspense } from "react";
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
];

export default function GameCanvas() {
  const isHost = useIsHost();

  return (
    <KeyboardControls map={MAP}>
      <Canvas
        shadows="soft"
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0, touchAction: "none" }}
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
