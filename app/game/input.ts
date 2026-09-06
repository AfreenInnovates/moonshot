"use client";

export type VirtualMove = { x: number; y: number };

let virtualMove: VirtualMove = { x: 0, y: 0 };
let virtualSprint = false;
let virtualUseRequested = false;

export function setVirtualMove(x: number, y: number) {
  virtualMove = { x, y };
}

export function getVirtualMove() {
  return virtualMove;
}

export function setVirtualSprint(active: boolean) {
  virtualSprint = active;
}

export function getVirtualSprint() {
  return virtualSprint;
}

export function requestVirtualUse() {
  virtualUseRequested = true;
}

export function consumeVirtualUse() {
  const requested = virtualUseRequested;
  virtualUseRequested = false;
  return requested;
}

export function resetVirtualInput() {
  virtualMove = { x: 0, y: 0 };
  virtualSprint = false;
  virtualUseRequested = false;
}
