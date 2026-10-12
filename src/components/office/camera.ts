import * as THREE from "three";
import { FLOOR_GAP, officeLayout } from "../../officeBehavior.ts";

export type RoomView = "overview" | "overhead";

/** Fit every room corner into the perspective frustum, including stacked floors. */
export function roomCameraFrame(total: number, aspect: number, fov: number, view: RoomView, floors = 1) {
  const layout = officeLayout(total);
  const stack = Math.max(1, floors);
  const lift = ((stack - 1) * FLOOR_GAP) / 2;
  const target = new THREE.Vector3(layout.x, 1.5 + lift, layout.z);
  const direction = (view === "overhead"
    ? new THREE.Vector3(0, 1, 0.001)
    : new THREE.Vector3(0.32, 1, 1.1)).normalize();
  const right = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right);
  const vertical = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const horizontal = vertical * aspect;
  let distance = 6;
  for (const x of [-layout.width / 2, layout.width / 2]) {
    for (const y of [-2.15 - lift, 3.4 + (stack - 1) * FLOOR_GAP - lift]) {
      for (const z of [-layout.depth / 2, layout.depth / 2]) {
        const corner = new THREE.Vector3(x, y, z);
        distance = Math.max(distance, corner.dot(direction) + 1.12 * Math.max(
          Math.abs(corner.dot(right)) / horizontal,
          Math.abs(corner.dot(up)) / vertical,
        ));
      }
    }
  }
  return { target, position: target.clone().addScaledVector(direction, distance) };
}
