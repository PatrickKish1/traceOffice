import { useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** Full nuke → rebuild cycle (seconds). */
export const NUKE_DURATION = 4.4;
const BLAST_AT = 0.55;
const REFORM_AT = 2.05;

export function nukePhase(startedAt: number | null, now = performance.now()) {
  if (startedAt === null) return { active: false, t: 0, shell: 1, shake: 0, flash: 0, reform: 0, blast: false };
  const t = Math.min(NUKE_DURATION, (now - startedAt) / 1000);
  const active = t < NUKE_DURATION;
  const flash = t < BLAST_AT ? Math.sin((t / BLAST_AT) * Math.PI) : 0;
  const collapse = t < BLAST_AT ? 1 - (t / BLAST_AT) ** 1.8 : 0;
  const reform = t > REFORM_AT ? 1 - (1 - Math.min(1, (t - REFORM_AT) / (NUKE_DURATION - REFORM_AT))) ** 2 : 0;
  const shell = collapse > 0 ? Math.max(0.02, 1 - collapse * 0.98) : reform > 0 ? 0.02 + reform * 0.98 : 0.02;
  const shake = t < BLAST_AT ? (t / BLAST_AT) * 0.35 : t < REFORM_AT ? 0.12 : 0;
  return { active, t, shell, shake, flash, reform, blast: t >= BLAST_AT * 0.85 && t < REFORM_AT };
}

const DEBRIS = 48;

export function WorkspaceNukeFlash({ startedAt }: { startedAt: number | null }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    if (!mat.current) return;
    const { flash } = nukePhase(startedAt);
    mat.current.opacity = flash * 0.72;
  });
  if (startedAt === null) return null;
  return (
    <mesh position={[0, 2.2, 0]} renderOrder={999}>
      <sphereGeometry args={[22, 16, 12]} />
      <meshBasicMaterial ref={mat} color="#fff4e8" transparent depthWrite={false} toneMapped={false} opacity={0} />
    </mesh>
  );
}

export function WorkspaceMushroom({
  startedAt,
  center = [0, 0.1, 0] as [number, number, number],
}: {
  startedAt: number | null;
  center?: [number, number, number];
}) {
  const stem = useRef<THREE.Mesh>(null);
  const cap = useRef<THREE.Mesh>(null);
  const debris = useRef<THREE.InstancedMesh>(null);
  const debrisMat = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dirs = useMemo(
    () =>
      Array.from({ length: DEBRIS }, (_, i) => {
        const y = 1 - 2 * (i + 0.5) / DEBRIS;
        const r = Math.sqrt(1 - y * y);
        const a = i * Math.PI * (3 - Math.sqrt(5));
        return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      }),
    [],
  );
  useFrame(() => {
    const phase = nukePhase(startedAt);
    const show = phase.blast || (phase.reform > 0 && phase.t < NUKE_DURATION - 0.2);
    if (stem.current) stem.current.visible = show;
    if (cap.current) cap.current.visible = show;
    if (!debris.current || !debrisMat.current || startedAt === null) return;
    debris.current.visible = phase.blast;
    if (!phase.blast) return;
    const age = phase.t - BLAST_AT * 0.85;
    debrisMat.current.opacity = Math.max(0, 1 - age / 1.1);
    dirs.forEach((dir, i) => {
      const lag = (i % 5) * 0.04;
      const a = Math.max(0, age - lag);
      const spread = (2.2 + (i % 4) * 0.3) * (1 - Math.exp(-a * 2.2));
      dummy.position.set(center[0], center[1], center[2]).add(dir.clone().multiplyScalar(spread));
      dummy.position.y += 1.2 + a * 3.5 - a * a * 0.8;
      const s = 0.12 + (i % 3) * 0.05;
      dummy.scale.setScalar(s * Math.max(0.15, 1 - a / 1.4));
      dummy.updateMatrix();
      debris.current!.setMatrixAt(i, dummy.matrix);
    });
    debris.current.instanceMatrix.needsUpdate = true;
    if (stem.current && cap.current) {
      const grow = Math.min(1, age * 1.6);
      stem.current.scale.set(1, 0.4 + grow * 2.8, 1);
      cap.current.scale.set(0.5 + grow * 2.4, 0.35 + grow * 1.1, 0.5 + grow * 2.4);
      cap.current.position.y = 0.5 + grow * 2.6;
    }
  });
  if (startedAt === null) return null;
  return (
    <group position={center}>
      <mesh ref={stem} visible={false}>
        <cylinderGeometry args={[0.35, 0.55, 1, 16]} />
        <meshBasicMaterial color="#c4b8a8" toneMapped={false} />
      </mesh>
      <mesh ref={cap} visible={false} position={[0, 0.5, 0]}>
        <sphereGeometry args={[1, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshBasicMaterial color="#ff6b3d" toneMapped={false} />
      </mesh>
      <instancedMesh ref={debris} args={[undefined, undefined, DEBRIS]} visible={false} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial ref={debrisMat} color="#ff9a5c" transparent toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

export function NukeWorkspaceShell({
  startedAt,
  reducedMotion,
  children,
}: {
  startedAt: number | null;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const root = useRef<THREE.Group>(null);
  const shake = useNukeShellTransform(startedAt, reducedMotion);
  useFrame(() => {
    if (!root.current) return;
    const phase = nukePhase(startedAt);
    if (!phase.active) {
      root.current.scale.setScalar(1);
      root.current.position.set(0, 0, 0);
      return;
    }
    root.current.scale.setScalar(phase.shell);
    root.current.position.copy(shake.current);
    root.current.position.y += (1 - phase.shell) * 0.35;
  });
  return <group ref={root}>{children}</group>;
}

export function useNukeShellTransform(startedAt: number | null, reducedMotion: boolean) {
  const offset = useRef(new THREE.Vector3());
  useFrame(() => {
    if (reducedMotion || startedAt === null) {
      offset.current.set(0, 0, 0);
      return;
    }
    const { shake } = nukePhase(startedAt);
    if (shake <= 0) {
      offset.current.set(0, 0, 0);
      return;
    }
    const n = performance.now() * 0.02;
    offset.current.set((Math.sin(n * 7) + Math.sin(n * 13)) * shake * 0.25, 0, (Math.cos(n * 9) + Math.cos(n * 11)) * shake * 0.25);
  });
  return offset;
}
