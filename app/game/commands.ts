export type CommandCode =
  | "LEFT"
  | "RIGHT"
  | "FORWARD"
  | "BACK"
  | "RUN"
  | "HIDE"
  | "STOP";

export interface CommandDef {
  code: CommandCode;
  label: string;
  detail: string;
  color: string;
}

export const COMMANDS: CommandDef[] = [
  { code: "LEFT", label: "Move left", detail: "take the west side", color: "#4aa8ff" },
  { code: "RIGHT", label: "Move right", detail: "take the east side", color: "#39ff88" },
  { code: "FORWARD", label: "Go forward", detail: "push deeper", color: "#ffd23b" },
  { code: "BACK", label: "Go back", detail: "fall back", color: "#ff9f43" },
  { code: "RUN", label: "Run now", detail: "move fast", color: "#ff7ad9" },
  { code: "HIDE", label: "Break sight", detail: "get out of view", color: "#c8ff3b" },
  { code: "STOP", label: "Stop", detail: "hold position", color: "#ff5b55" },
];

export const commandByCode = (code: CommandCode) =>
  COMMANDS.find((command) => command.code === code)!;
