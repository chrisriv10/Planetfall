import type { InputMethod } from "./input";

export type ClassicSpectatorCycleInput = {
  previousPressed: boolean;
  nextPressed: boolean;
  repairPressed: boolean;
  menuX: -1 | 0 | 1;
  menuY: -1 | 0 | 1;
};

export function classicSpectatorCycleDirection(input: ClassicSpectatorCycleInput): -1 | 0 | 1 {
  if (input.previousPressed || input.menuX < 0 || input.menuY < 0) return -1;
  if (input.nextPressed || input.repairPressed || input.menuX > 0 || input.menuY > 0) return 1;
  return 0;
}

export function classicSpectatorPrompt(playerName: string, method: InputMethod): string {
  const controls = method === "gamepad" ? "LB / RB" : "WHEEL / ↑↓";
  return `SPECTATING ${playerName.toUpperCase()}  ·  ${controls} CYCLE`;
}
