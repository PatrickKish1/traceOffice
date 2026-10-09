import type { CharacterCast } from "../../../socialRoom";
import type { CharacterKind } from "../../../types";

/** Named crew slots — each pack assigns a different mascot silhouette per slot. */
export type CrewRole = "trace" | "signal" | "patch" | "relay" | "jev";

export const CREW_ROLES: readonly CrewRole[] = ["trace", "signal", "patch", "relay"];

export const PACK_LABELS: Record<CharacterCast, { name: string; detail: string }> = {
  person: {
    name: "Dot crew",
    detail: "Trace beret · Signal frog · Patch glasses · Relay shades · Jev crown",
  },
  field: {
    name: "Field pack",
    detail: "Trace yellow ghost · Signal mint glasses · Patch gradient · Relay owl · Jev pink",
  },
  signal: {
    name: "Signal pack",
    detail: "Trace gradient · Signal hex glasses · Patch beret · Relay purple ghost · Jev frog",
  },
};

/** Full character pack: switching cast replaces every desk role + Jev at once. */
export const CHARACTER_PACK: Record<CharacterCast, Record<CrewRole, CharacterKind>> = {
  person: {
    trace: "blue-dot",
    signal: "frog-dot",
    patch: "yellow-dot",
    relay: "pink-dot",
    jev: "purple-dot",
  },
  field: {
    trace: "ghost-yellow",
    signal: "pill-glasses",
    patch: "lovable",
    relay: "owl-dot",
    jev: "pink-dot",
  },
  signal: {
    trace: "lovable",
    signal: "hex-glasses",
    patch: "blue-dot",
    relay: "purple-dot",
    jev: "frog-dot",
  },
};

export function packMascotKind(cast: CharacterCast, role: CrewRole): CharacterKind {
  return CHARACTER_PACK[cast][role];
}

export function showcaseRoleFromId(showcaseId: string): CrewRole {
  const role = showcaseId.replace("showcase-", "");
  if (role === "trace" || role === "signal" || role === "patch" || role === "relay") return role;
  return "trace";
}

export function packKindForShowcase(cast: CharacterCast, showcaseId: string): CharacterKind {
  return packMascotKind(cast, showcaseRoleFromId(showcaseId));
}

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/** Imported agents wear one of the four crew silhouettes from the active pack. */
export function packKindForAgent(cast: CharacterCast, agentId: string): CharacterKind {
  const role = CREW_ROLES[hashSeed(`pack:${agentId}`) % CREW_ROLES.length];
  return packMascotKind(cast, role);
}
