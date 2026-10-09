"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SCALE } from "@/features/retro-office/core/constants";
import {
  getItemBaseSize,
  getItemRotationRadians,
  ITEM_FOOTPRINT,
  toWorld,
} from "@/features/retro-office/core/geometry";
import type { FurnitureItem } from "@/features/retro-office/core/types";

const furnitureTemplateCache = new Map<string, THREE.Group>();

type InstancedFurnitureMeshDef = {
  castShadow: boolean;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrixWorld: THREE.Matrix4;
  receiveShadow: boolean;
};

function finish(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function material(color: string, roughness = 0.62, metalness = 0.06, emissive?: string) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive: emissive ? new THREE.Color(emissive) : new THREE.Color("#000000"),
    emissiveIntensity: emissive ? 0.45 : 0,
  });
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  color: string,
  roughness = 0.62,
) {
  const mesh = finish(new THREE.Mesh(new THREE.BoxGeometry(...size), material(color, roughness)));
  mesh.position.set(...position);
  parent.add(mesh);
  return mesh;
}

/** Original furniture, authored in office units and centered on the item footprint. */
function buildTemplate(itemType: string) {
  const cached = furnitureTemplateCache.get(itemType);
  if (cached) return cached;
  const group = new THREE.Group();
  const [footW, footD] = ITEM_FOOTPRINT[itemType] ?? [40, 40];
  const cx = footW * SCALE * 0.5;
  const cz = footD * SCALE * 0.5;
  const wood = "#4a4038";
  const ink = "#1c2622";

  if (itemType === "desk_cubicle" || itemType === "executive_desk") {
    box(group, [1.5, 0.07, 0.82], [cx, 0.74, cz], "#5c6b62");
    box(group, [1.42, 0.62, 0.06], [cx, 0.4, cz - 0.34], "#2e3b36");
    for (const [x, z] of [[-0.66, -0.32], [0.66, -0.32], [-0.66, 0.32], [0.66, 0.32]]) {
      box(group, [0.06, 0.7, 0.06], [cx + x, 0.35, cz + z], ink);
    }
  } else if (itemType === "chair") {
    box(group, [0.46, 0.07, 0.46], [cx, 0.46, cz], "#6b5344");
    box(group, [0.46, 0.42, 0.06], [cx, 0.7, cz + 0.2], "#6b5344");
    for (const x of [-0.18, 0.18]) box(group, [0.05, 0.42, 0.05], [cx + x, 0.22, cz], ink);
  } else if (itemType === "computer") {
    const lift = 0.78;
    box(group, [0.42, 0.28, 0.04], [cx, lift + 0.28, cz], "#101816");
    const screen = finish(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.02), material("#12352c", 0.4, 0.1, "#1f8f62")));
    screen.position.set(cx, lift + 0.28, cz + 0.02);
    group.add(screen);
    box(group, [0.08, 0.12, 0.06], [cx, lift + 0.08, cz], "#2a3330");
    box(group, [0.22, 0.02, 0.1], [cx, lift + 0.02, cz + 0.06], "#2a3330");
  } else if (itemType === "bookshelf") {
    box(group, [0.7, 1.5, 0.28], [cx, 0.75, cz], wood);
    for (const y of [0.35, 0.75, 1.15]) box(group, [0.62, 0.04, 0.24], [cx, y, cz], "#2c241e");
    const spines = ["#3ecf8e", "#7dd3fc", "#fbbf24", "#fb7185"];
    spines.forEach((color, index) => box(group, [0.08, 0.28, 0.16], [cx - 0.22 + index * 0.14, 0.95, cz + 0.02], color));
  } else if (itemType === "plant") {
    box(group, [0.28, 0.24, 0.28], [cx, 0.14, cz], "#6b4a32");
    const leaves = finish(new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), material("#3d8f62", 0.7)));
    leaves.position.set(cx, 0.52, cz);
    leaves.scale.set(1, 0.8, 1);
    group.add(leaves);
  } else if (itemType === "lamp") {
    box(group, [0.28, 0.04, 0.28], [cx, 0.04, cz], "#3a342c");
    box(group, [0.04, 1.15, 0.04], [cx, 0.62, cz], "#c4b08a");
    const shade = finish(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.22, 16), material("#f0c56a", 0.45, 0.05, "#e7a23a")));
    shade.position.set(cx, 1.22, cz);
    group.add(shade);
  } else if (itemType === "coffee_machine") {
    box(group, [0.32, 0.42, 0.28], [cx, 0.28, cz], "#d7c4a8");
    box(group, [0.1, 0.08, 0.08], [cx, 0.2, cz + 0.12], ink);
  } else if (itemType === "cabinet") {
    box(group, [1.3, 0.72, 0.4], [cx, 0.4, cz], "#334049");
    box(group, [0.02, 0.6, 0.02], [cx, 0.4, cz + 0.2], "#9bb0b8");
  } else {
    box(group, [0.6, 0.4, 0.4], [cx, 0.24, cz], "#3d4a44");
  }

  furnitureTemplateCache.set(itemType, group);
  return group;
}

const buildFurnitureItemMatrix = (item: FurnitureItem, itemType: string) => {
  const [wx, , wz] = toWorld(item.x, item.y);
  const yOffset = item.elevation ?? 0;
  const rotY = getItemRotationRadians(item);
  const { width, height } = getItemBaseSize(item);
  const pivotX = width * SCALE * 0.5;
  const pivotZ = height * SCALE * 0.5;
  const containerMatrix = new THREE.Matrix4().makeTranslation(wx, yOffset, wz);
  const pivotMatrix = new THREE.Matrix4().makeTranslation(pivotX, 0, pivotZ);
  const rotationMatrix = new THREE.Matrix4().makeRotationY(rotY);
  const unpivotMatrix = new THREE.Matrix4().makeTranslation(-pivotX, 0, -pivotZ);
  return containerMatrix.multiply(pivotMatrix).multiply(rotationMatrix).multiply(unpivotMatrix);
};

export function InstancedFurnitureItems({
  itemType,
  items,
  onItemClick,
}: {
  itemType: string;
  items: FurnitureItem[];
  onItemClick?: (itemUid: string) => void;
}) {
  const template = useMemo(() => buildTemplate(itemType), [itemType]);
  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const meshDefs = useMemo<InstancedFurnitureMeshDef[]>(() => {
    template.updateMatrixWorld(true);
    const nextDefs: InstancedFurnitureMeshDef[] = [];
    template.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      nextDefs.push({
        castShadow: mesh.castShadow,
        geometry: mesh.geometry,
        material: mesh.material as THREE.Material,
        matrixWorld: mesh.matrixWorld.clone(),
        receiveShadow: mesh.receiveShadow,
      });
    });
    return nextDefs;
  }, [template]);
  const itemMatrices = useMemo(
    () => items.map((item) => buildFurnitureItemMatrix(item, itemType)),
    [itemType, items],
  );
  const itemUidByInstanceId = useMemo(() => items.map((item) => item._uid), [items]);
  const handleClick = useMemo(
    () =>
      onItemClick
        ? (event: ThreeEvent<MouseEvent>) => {
            event.stopPropagation();
            const instanceId = event.instanceId;
            if (typeof instanceId !== "number") return;
            const itemUid = itemUidByInstanceId[instanceId];
            if (itemUid) onItemClick(itemUid);
          }
        : undefined,
    [itemUidByInstanceId, onItemClick],
  );

  useLayoutEffect(() => {
    meshDefs.forEach((def, meshIndex) => {
      const instancedMesh = meshRefs.current[meshIndex];
      if (!instancedMesh) return;
      const worldMatrix = new THREE.Matrix4();
      for (let itemIndex = 0; itemIndex < itemMatrices.length; itemIndex += 1) {
        worldMatrix.multiplyMatrices(itemMatrices[itemIndex], def.matrixWorld);
        instancedMesh.setMatrixAt(itemIndex, worldMatrix);
      }
      instancedMesh.instanceMatrix.needsUpdate = true;
      instancedMesh.computeBoundingSphere();
    });
  }, [itemMatrices, meshDefs]);

  if (items.length === 0) return null;
  return (
    <>
      {meshDefs.map((def, meshIndex) => (
        <instancedMesh
          key={`${itemType}-${meshIndex}`}
          ref={(node) => {
            meshRefs.current[meshIndex] = node;
          }}
          args={[def.geometry, def.material, items.length]}
          castShadow={def.castShadow}
          receiveShadow={def.receiveShadow}
          onClick={handleClick}
        />
      ))}
    </>
  );
}
