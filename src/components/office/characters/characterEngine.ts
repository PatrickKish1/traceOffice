import * as THREE from "three";
import type { CharacterCast } from "../../../socialRoom";
import type { CharacterKind } from "../../../types";
import { packKindForAgent, packMascotKind } from "./characterPacks.ts";
import {
  createMascotCharacter,
  MASCOT_KINDS,
  type MascotCharacter,
  type MascotKind,
} from "./createMascotCharacter.ts";

export {
  CHARACTER_PACK,
  CREW_ROLES,
  PACK_LABELS,
  packKindForAgent,
  packKindForShowcase,
  packMascotKind,
  type CrewRole,
} from "./characterPacks.ts";

export type { MascotCharacter };

/** Stable look derived from an agent id (mascot kind + height). */
export interface CharacterRecipe {
  seed: string;
  kind: MascotKind;
  skin: string;
  accent: string;
  tall: number;
}

const MASCOT_SKIN: Record<MascotKind, string> = {
  "blue-dot": "#20a9ff",
  "frog-dot": "#b6e645",
  "yellow-dot": "#ffd64a",
  "pink-dot": "#f344bc",
  "purple-dot": "#a365ed",
  lovable: "#f961aa",
  "ghost-yellow": "#ffe14a",
  "pill-glasses": "#3ecf9a",
  "owl-dot": "#e07a3d",
  "hex-glasses": "#6aa6ff",
};

function hashSeed(seed: string) {
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

export function mascotKindFromSeed(seed: string): MascotKind {
  return MASCOT_KINDS[hashSeed(seed || "trace") % MASCOT_KINDS.length];
}

export function resolveMascotKind(seed: string, kind?: CharacterKind): MascotKind {
  if (kind && MASCOT_KINDS.includes(kind as MascotKind)) return kind as MascotKind;
  return mascotKindFromSeed(seed);
}

/** @deprecated use packMascotKind(cast, "trace") for studio cards */
export function castPreviewKind(cast: CharacterCast): CharacterKind {
  return packMascotKind(cast, "trace");
}

export function recipeFromSeed(seed: string): CharacterRecipe {
  const kind = mascotKindFromSeed(seed);
  const hash = hashSeed(seed);
  return {
    seed,
    kind,
    skin: MASCOT_SKIN[kind],
    accent: MASCOT_SKIN[kind],
    tall: 0.98 + ((hash >>> 12) % 10) / 100,
  };
}

/** Builds a coworker from seed, active character pack, and resolved mascot kind. */
export function createVariantCharacter(
  seed: string,
  cast: CharacterCast = "person",
  kind?: CharacterKind,
): MascotCharacter {
  const mascotKind = kind && MASCOT_KINDS.includes(kind as MascotKind)
    ? kind as MascotKind
    : packKindForAgent(cast, seed);
  const hash = hashSeed(seed);
  const recipe: CharacterRecipe = {
    seed,
    kind: mascotKind,
    skin: MASCOT_SKIN[mascotKind],
    accent: MASCOT_SKIN[mascotKind],
    tall: 0.98 + ((hash >>> 12) % 10) / 100,
  };
  const root = new THREE.Group();
  root.name = `variant:${seed}:${cast}`;
  const instance = createMascotCharacter(mascotKind);
  root.add(instance.group);
  instance.group.scale.setScalar(recipe.tall);

  return {
    group: root,
    update: instance.update.bind(instance),
    dispose() {
      instance.dispose();
      root.removeFromParent();
    },
  };
}
