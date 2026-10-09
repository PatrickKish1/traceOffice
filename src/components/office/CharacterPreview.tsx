import { useEffect, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  CREW_ROLES,
  createVariantCharacter,
  packMascotKind,
  type CrewRole,
  type MascotCharacter,
} from "./characters/characterEngine";
import Mara from "./Tibo";
import type { CharacterCast, ManagerLook } from "../../socialRoom";

function PackActor({ cast, role, position }: { cast: CharacterCast; role: CrewRole; position: [number, number, number] }) {
  const root = useRef<THREE.Group>(null);
  const actor = useRef<MascotCharacter | null>(null);
  useEffect(() => {
    const instance = createVariantCharacter(`preview-${cast}-${role}`, cast, packMascotKind(cast, role));
    actor.current = instance;
    root.current?.add(instance.group);
    return () => {
      instance.dispose();
      actor.current = null;
    };
  }, [cast, role]);
  useFrame(({ clock }) => {
    actor.current?.update(clock.elapsedTime, 0);
    if (root.current) root.current.rotation.y = Math.sin(clock.elapsedTime * 0.9 + position[0]) * 0.35;
  });
  return <group ref={root} position={position} scale={0.72} />;
}

function Aim({ at }: { at: [number, number, number] }) {
  useFrame(({ camera }) => {
    camera.lookAt(at[0], at[1], at[2]);
  });
  return null;
}

function Stage({ children, camera, at }: { children: ReactNode; camera: [number, number, number]; at: [number, number, number] }) {
  return <Canvas
    className="cast-preview-canvas"
    camera={{ position: camera, fov: 26 }}
    dpr={[1, 1.5]}
    gl={{ antialias: true, alpha: true }}
  >
    <color attach="background" args={["#18211e"]} />
    <ambientLight intensity={0.95} />
    <directionalLight position={[1.6, 2.8, 2.2]} intensity={1.45} />
    <Aim at={at} />
    {children}
  </Canvas>;
}

/** Mini lineup of Trace, Signal, Patch, Relay for the selected character pack. */
export function CastPreview({ cast }: { cast: CharacterCast }) {
  return <span className="cast-preview cast-preview-lineup" aria-hidden="true">
    <Stage camera={[0.1, 1.05, 5.2]} at={[0, 0.65, 0]}>
      {CREW_ROLES.map((role, index) => (
        <PackActor
          key={role}
          cast={cast}
          role={role}
          position={[(index - 1.5) * 0.62, -0.12, 0]}
        />
      ))}
    </Stage>
  </span>;
}

export function ManagerPreview({ look }: { look: ManagerLook }) {
  return <span className="cast-preview" aria-hidden="true">
    <Stage camera={[0.85, 1.35, 6.4]} at={[0, 1.28, 0]}>
      <Mara celebrating={false} look={look} preview />
    </Stage>
  </span>;
}
