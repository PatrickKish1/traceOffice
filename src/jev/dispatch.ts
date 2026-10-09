import { DESKS } from "../officeBehavior.ts";

/** Where Jev waits between hand-offs (aisle, facing the row). */
export const JEV_HOME = { x: 2.4, y: 0.1, z: 6.35 };

export function jevHandoffDeskIndex(agentIndex: number) {
  return agentIndex % DESKS.length;
}

/** Standing spot in the aisle in front of a desk. */
export function jevHandoffPosition(deskIndex: number) {
  const desk = DESKS[deskIndex % DESKS.length];
  return {
    x: desk.x * 1.15,
    y: 0.1,
    z: (desk.z - 1.4) * 1.15,
  };
}
