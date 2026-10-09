import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { ManagerLook } from "../../socialRoom";

const LOOKS: Record<ManagerLook, { skin: string; hair: string; hairAlt: string; shirt: string; pants: string; beard: string; shoes: string }> = {
  mara: { skin: "#e6b08b", hair: "#28211f", hairAlt: "#302521", shirt: "#faf4e9", pants: "#384450", beard: "#675044", shoes: "#f1ede5" },
  nils: { skin: "#c68642", hair: "#1a120e", hairAlt: "#2a1c14", shirt: "#1f6f62", pants: "#1c2428", beard: "#3a2418", shoes: "#d7c4a8" },
  ada: { skin: "#8d5524", hair: "#1a100c", hairAlt: "#3b2414", shirt: "#243044", pants: "#2a2428", beard: "#8d5524", shoes: "#c4b4a0" },
};

function Shape({ position, scale, color }: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
}) {
  return <mesh position={position} scale={scale} castShadow receiveShadow>
    <sphereGeometry args={[1, 24, 16]} />
    <meshStandardMaterial color={color} roughness={0.8} />
  </mesh>;
}

/** World position for the review manager (off the desk row, toward the back of the floor). */
export const MANAGER_WORLD_POSITION: [number, number, number] = [5.8, 0.1, 4.0];

/** Review manager. The room studio picks which person stands here. */
export default function Mara({ celebrating, look = "mara", preview = false }: { celebrating: boolean; look?: ManagerLook; preview?: boolean }) {
  const arm = useRef<THREE.Group>(null);
  const palette = LOOKS[look];
  useFrame(({ clock }) => {
    if (arm.current) arm.current.rotation.z = celebrating
      ? -1.8 + Math.sin(clock.elapsedTime * 9) * 0.2 : -0.25;
  });
  return <group name="Mara" position={preview ? [0, 0, 0] : MANAGER_WORLD_POSITION} rotation={[0, preview ? 0.15 : 0.3, 0]} scale={preview ? 1 : 1.25}>
    {[-1, 1].map((side) => <group key={side}>
      <Shape position={[side * 0.19, 0.51, 0]} scale={[0.18, 0.5, 0.19]} color={palette.pants} />
      <Shape position={[side * 0.19, 0.12, 0.13]} scale={[0.19, 0.12, 0.3]} color={palette.shoes} />
      <Shape position={[side * 0.45, 2.04, 0]} scale={[0.1, 0.15, 0.1]} color={palette.skin} />
    </group>)}
    <Shape position={[0, 1.24, 0]} scale={[0.49, 0.51, 0.29]} color={palette.shirt} />
    <Shape position={[0, 1.63, 0]} scale={[0.17, 0.2, 0.16]} color={palette.skin} />
    <Shape position={[0, 2.09, 0]} scale={[0.46, 0.56, 0.38]} color={palette.skin} />
    <Shape position={[0, 1.88, 0.13]} scale={[0.38, 0.33, 0.3]} color={palette.beard} />
    <Shape position={[0, 1.98, 0.26]} scale={[0.35, 0.31, 0.17]} color={palette.skin} />
    <Shape position={[0, 2.42, -0.055]} scale={[0.47, 0.29, 0.37]} color={palette.hair} />
    {Array.from({ length: 9 }, (_, i) => <group key={i} position={[(i - 4) * 0.075, 2.53, 0.07]} rotation={[0, 0, (i - 4) * 0.12]}>
      <Shape position={[0, 0, 0]} scale={[0.12, 0.21, 0.27]} color={i % 2 ? palette.hairAlt : palette.hair} />
    </group>)}
    {[-1, 1].map((side) => <group key={side}>
      <Shape position={[side * 0.18, 2.2, 0.34]} scale={[0.115, 0.065, 0.043]} color="#fff7ef" />
      <Shape position={[side * 0.18, 2.2, 0.38]} scale={[0.044, 0.051, 0.022]} color="#44382e" />
      <Shape position={[side * 0.17, 2.214, 0.399]} scale={[0.011, 0.013, 0.006]} color="#ffffff" />
      <group position={[side * 0.18, 2.32, 0.32]} rotation={[0, 0, side * -0.12]}>
        <Shape position={[0, 0, 0]} scale={[0.14, 0.037, 0.055]} color="#362923" />
      </group>
    </group>)}
    <Shape position={[0, 2.11, 0.38]} scale={[0.075, 0.14, 0.1]} color={palette.skin} />
    <Shape position={[0, 1.935, 0.405]} scale={[0.215, 0.09, 0.022]} color="#8d4c3e" />
    <Shape position={[0, 1.964, 0.423]} scale={[0.185, 0.05, 0.012]} color="#fff8e7" />
    <Shape position={[-0.52, 1.17, 0]} scale={[0.13, 0.38, 0.13]} color={palette.shirt} />
    <Shape position={[-0.54, 0.86, 0.04]} scale={[0.12, 0.14, 0.12]} color={palette.skin} />
    <group ref={arm} position={[0.45, 1.5, 0]}>
      <Shape position={[0.11, -0.23, 0]} scale={[0.13, 0.32, 0.13]} color={palette.shirt} />
      <Shape position={[0.13, -0.51, 0.03]} scale={[0.12, 0.14, 0.12]} color={palette.skin} />
    </group>
  </group>;
}
