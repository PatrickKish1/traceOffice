import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Billboard,
  ContactShadows,
  OrbitControls,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";
type OrbitControlsImpl = {
  enableDamping: boolean;
  target: THREE.Vector3;
  update: () => void;
  dollyIn: (scale?: number) => void;
  dollyOut: (scale?: number) => void;
};
import { Eye, Grid2X2, Hand, Minus, Plus } from "lucide-react";
import { roomCameraFrame, type RoomView } from "./office/camera";
import "./office/camera.css";
import { AgentNameplate } from "./office/AgentNameplate";
import { SHOWCASE_CHARACTERS, showcasePose, showcaseState, type ShowcaseState } from "../showcase";
import { InstancedFurnitureItems } from "../features/retro-office/objects/furniture";
import type { FurnitureItem } from "../features/retro-office/core/types";
import {
  createVariantCharacter,
  packKindForAgent,
  packKindForShowcase,
  packMascotKind,
  type MascotCharacter,
} from "./office/characters/characterEngine";
import type { AgentStatus, OfficeAgent } from "../types";
import { agentDisplayName } from "../officeActivity";
import Mara from "./office/Tibo";
import ToyHammer from "./office/ToyHammer";
import {
  NUKE_DURATION,
  NukeWorkspaceShell,
  WorkspaceMushroom,
  WorkspaceNukeFlash,
  nukePhase,
} from "./office/WorkspaceNuke";
import { MANAGER_NAMES, characterCast, managerLook, type CharacterCast, type KnowledgeBook, type RoomProfile, type RoomProject, type RoomTheme } from "../socialRoom";
import {
  officeLayout,
  loungeLayout,
  SHOWCASE_DESKS,
  CHAIR_PLACEMENT,
  officePose,
  FLOOR_GAP,
  floorKey,
  stackFloors,
  type LiveInteraction,
} from "../officeBehavior";
import { jevAtShowcaseDesk, jevTriageAgent } from "../jev/triage";
import { JEV_HOME, jevHandoffDeskIndex, jevHandoffPosition } from "../jev/dispatch";
import { JEV_HANDOFF_DWELL_SECONDS, JEV_WALK_SPEED } from "../jev/jevMotion";
import { playJevClip, playJevClipAtDesk, warmJevClip } from "../audio/jevSound";

const noop = () => {};
const PALETTES: Record<RoomTheme, { backdrop: string; floor: string; wall: string; rug: string; lounge: string; window: string; accent: string }> = {
  studio: { backdrop: "#101614", floor: "#1a2420", wall: "#24302b", rug: "#1e3a32", lounge: "#2a2420", window: "#1a3040", accent: "#1f6f52" },
  grove: { backdrop: "#101814", floor: "#1a2820", wall: "#24342c", rug: "#1a4034", lounge: "#2a2820", window: "#163828", accent: "#2f8f62" },
  coastal: { backdrop: "#101618", floor: "#1a2428", wall: "#243038", rug: "#1a3840", lounge: "#2a2824", window: "#163040", accent: "#2a7f8f" },
  cosmic: { backdrop: "#12141c", floor: "#1c2030", wall: "#262838", rug: "#2a2848", lounge: "#2a2430", window: "#242048", accent: "#5b4fc7" },
};
const STATUS_COLOR: Record<AgentStatus, string> = {
  working: "#55b67a", idle: "#d9aa56", blocked: "#e49352",
  error: "#d96b6b", offline: "#909b9c", unknown: "#9a96b1",
};
function Label({
  text,
  subtitle,
  position,
  rotation = [0, 0, 0],
  width = 3,
  height = 0.65,
  bg = "#edf0db",
  color = "#526447",
  fontSize = 36,
}: {
  text: string;
  subtitle?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  bg?: string;
  color?: string;
  fontSize?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = subtitle ? 256 : 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, canvas.height);
    ctx.fillStyle = color;
    ctx.font = `600 ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (subtitle) {
      ctx.font = "600 54px sans-serif";
      ctx.fillText(text, 384, 70, 708);
      ctx.font = "700 66px sans-serif";
      ctx.fillText(subtitle, 384, 176, 708);
    } else ctx.fillText(text, 384, 80, 720);
    const value = new THREE.CanvasTexture(canvas);
    value.colorSpace = THREE.SRGBColorSpace;
    return value;
  }, [text, subtitle, bg, color, fontSize]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
    </mesh>
  );
}
function Furniture({ total }: { total: number }) {
  const items = useMemo(() => {
    const result: FurnitureItem[] = [];
    const add = (type: string, x: number, z: number, facing = 0) =>
      result.push({
        _uid: `${type}-${result.length}`,
        type,
        x: (x + 16.2) / 0.018,
        y: (z + 16.2) / 0.018,
        facing,
      });
    const place = (type: string, centerX: number, centerZ: number, facing = 0) => {
      const footprint = type === "chair" ? [24, 24] : type === "computer" ? [30, 20] : [100, 55];
      add(type, centerX - (footprint[0] * 0.018) / 2, centerZ - (footprint[1] * 0.018) / 2, facing);
    };
    for (const { x, z } of [...officeLayout(total).desks, ...SHOWCASE_DESKS]) {
      place("desk_cubicle", x, z);
      place("computer", x + 0.15, z - 0.12);
      place("chair", x + CHAIR_PLACEMENT.x, z + CHAIR_PLACEMENT.z);
    }
    add("bookshelf", -7.5, -5.4);
    add("bookshelf", -5.2, -5.4);
    add("coffee_machine", 3.6, -5.2);
    add("cabinet", 3.2, -5.5);
    for (const [x, z] of [
      [-7.6, 4.5],
      [7.7, -5],
      [-7.6, -2],
      [4.8, 4.8],
    ])
      add("plant", x, z);
    add("lamp", 7.9, 4.4);
    return result;
  }, [total]);
  return (
    <group scale={[1.15, 1.15, 1.15]}>
      {[...new Set(items.map((i) => i.type))].map((type) => (
        <InstancedFurnitureItems
          key={type}
          itemType={type}
          items={items.filter((i) => i.type === type)}
          onItemClick={noop}
        />
      ))}
    </group>
  );
}
function Box({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: [number, number, number];
  color: string;
}) {
  return (
    <RoundedBox
      args={size}
      radius={0.06}
      smoothness={2}
      position={position}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial color={color} roughness={0.85} />
    </RoundedBox>
  );
}
function Room({ night, profile, total }: { night: boolean; profile: RoomProfile; total: number }) {
  const layout = officeLayout(total);
  const palette = PALETTES[profile.theme];
  const backWall = useRef<THREE.Group>(null);
  const leftWall = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (backWall.current) backWall.current.visible = camera.position.z >= -7.9;
    if (leftWall.current) leftWall.current.visible = camera.position.x >= layout.x - layout.width / 2 + 0.1;
  });
  return (
    <>
      <Box
        position={[layout.x, -0.32, layout.z]}
        size={[layout.width, 0.6, layout.depth]}
        color={night ? "#121816" : palette.lounge}
      />
      <Box
        position={[layout.x, 0.015, layout.z]}
        size={[layout.width - 0.3, 0.06, layout.depth - 0.3]}
        color={night ? "#1a2420" : palette.floor}
      />
      {Array.from({ length: Math.floor(layout.width) }, (_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[layout.x - layout.width / 2 + 0.7 + i, 0.052, layout.z]}
        >
          <planeGeometry args={[0.016, layout.depth - 0.5]} />
          <meshStandardMaterial color={night ? "#24302b" : palette.wall} />
        </mesh>
      ))}
      <group ref={leftWall} name="Left cutaway wall"><Box
        position={[layout.x - layout.width / 2 + 0.1, 1.35, layout.z]}
        size={[0.22, 2.7, layout.depth]}
        color={night ? "#1c2824" : palette.wall}
      /></group>
      <group ref={backWall} name="Back cutaway wall"><Box
        position={[layout.x, 1.35, -7.9]}
        size={[layout.width, 2.7, 0.22]}
        color={night ? "#1c2824" : palette.wall}
      />
      {[-7, -2, 3].map((x) => (
        <group key={x} position={[x, 1.7, -7.74]}>
          <Box position={[0, 0, 0]} size={[3.1, 1.55, 0.12]} color="#a6bdbb" />
          <Box
            position={[0, 0, 0.08]}
            size={[2.83, 1.3, 0.035]}
            color={night ? "#163044" : palette.window}
          />
          <Box
            position={[0, 0, 0.12]}
            size={[0.07, 1.35, 0.04]}
            color="#f4f0e7"
          />
        </group>
      ))}
      <Label
        text={`${profile.displayName.toUpperCase().slice(0, 24)} · ${profile.theme.toUpperCase()}`}
        position={[7.5, 1.8, -7.69]}
        width={3.8}
        height={0.85}
        bg={palette.accent}
        color="#f9f9f2"
        fontSize={55}
      />
      {profile.theme === "cosmic" && Array.from({ length: 12 }, (_, index) => <mesh key={index} position={[-8.7 + (index % 6) * 3.2, 1.8 + (index % 2) * 0.38, -7.72]}><sphereGeometry args={[0.055, 8, 8]} /><meshBasicMaterial color="#fcf5c9" /></mesh>)}
      </group>
      <Box
        position={[layout.carpet.x, 0.07, layout.carpet.z]}
        size={[layout.carpet.width, 0.05, layout.carpet.depth]}
        color={night ? "#547366" : palette.rug}
      />
      <Box position={[11.2, 0.075, layout.z]} size={[14.4, 0.06, layout.depth - 1]} color={night ? "#806955" : palette.lounge} />
      <group name="Chilling lounge">
        {loungeLayout(total).sofas.map(({ x, z }, index) => <group key={index} name={`Lounge sofa ${index + 1}`} position={[x, 0, z]}>
          <Box position={[0, 0.34, 0]} size={[4.2, 0.6, 1.8]} color={night ? "#766c83" : palette.accent} />
          <Box position={[0, 1.2, -0.72]} size={[4.2, 1.2, 0.38]} color={night ? "#766c83" : palette.accent} />
          {[-1.96, 1.96].map(side => <Box key={side} position={[side, 0.8, 0]} size={[0.3, 0.65, 1.8]} color={palette.accent} />)}
          {[-1, 1].map(side => <Box key={side} position={[side, 0.67, 0.12]} size={[1.75, 0.22, 1.35]} color={night ? "#978995" : palette.lounge} />)}
        </group>)}
      </group>
      <Label
        text="MAKE ROOM FOR IDEAS"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[layout.carpet.x, 0.12, layout.carpet.z]}
        width={5.5}
        height={0.7}
        bg={palette.rug}
        color="#dce5cf"
      />
      <Label
        text={`${profile.displayName.toUpperCase().slice(0, 22)}  HQ`}
        position={[0, -0.25, 8.05]}
        width={2.7}
        height={0.35}
        bg={palette.lounge}
      />
      <Label text="WORK STATIONS" rotation={[-Math.PI / 2, 0, 0]} position={[-2.5, 0.12, -1.75]} width={3.1} height={0.42} bg={night ? "#547366" : palette.rug} color="#f7f8ef" />
      <Label text="CHILLING LOUNGE" rotation={[-Math.PI / 2, 0, 0]} position={[11.2, 0.12, 5.6]} width={4.1} height={0.5} bg={night ? "#806955" : palette.lounge} color="#fffaf0" />
      <Furniture total={total} />
    </>
  );
}
function KnowledgeDisplay({ books, selected, onSelect, accent }: {
  books: KnowledgeBook[]; selected: string | null; onSelect: (id: string) => void; accent: string;
}) {
  if (!books.length) return null;
  const covers = ["#e8a36f", "#78afad", "#ad91c6", "#d1b46f", "#91b98b", "#d8899a", "#7c9ac1", "#d5a881"];
  return <group position={[15.5, 0, 5.5]}>
    <RoundedBox args={[3.2, 0.24, 2.2]} radius={0.08} smoothness={2} position={[0, 0.2, 0]} castShadow receiveShadow><meshStandardMaterial color="#e5d8be" roughness={0.8} /></RoundedBox>
    <Label text="THE LEARNING LIBRARY" position={[0, 0.32, 1.13]} width={2.3} height={0.28} bg={accent} color="#fffdf4" fontSize={68} />
    {books.slice(0, 8).map((book, index) => {
      const x = -0.9 + (index % 3) * 0.9;
      const z = -0.65 + Math.floor(index / 3) * 0.62;
      return <group key={book.id} position={[books.length === 1 ? 0 : x, 0.42, books.length === 1 ? -0.05 : z]} scale={books.length === 1 ? 2 : 1.12} rotation={[0, (index % 2 ? 0.13 : -0.1), 0]}
        onClick={(event) => { event.stopPropagation(); onSelect(book.id); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = "auto"; }}>
        <mesh castShadow receiveShadow><boxGeometry args={[0.72, 0.14, 0.46]} /><meshStandardMaterial color={covers[index]} roughness={0.63} /></mesh>
        <mesh position={[-0.32, 0.01, 0]}><boxGeometry args={[0.045, 0.16, 0.46]} /><meshStandardMaterial color="#f8e5ba" /></mesh>
        <Label text={book.title.slice(0, 28)} rotation={[-Math.PI / 2, 0, 0]} position={[0.03, 0.077, 0]} width={0.61} height={0.34} bg={covers[index]} color="#253029" fontSize={70} />
        {selected === book.id && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}><ringGeometry args={[0.47, 0.53, 32]} /><meshBasicMaterial color="#f8ca57" side={THREE.DoubleSide} /></mesh>}
      </group>;
    })}
  </group>;
}
function ProjectWall({ projects, selected, onSelect, accent }: {
  projects: RoomProject[]; selected: string | null; onSelect: (id: string) => void; accent: string;
}) {
  return <group>{projects.slice(0, 8).map((project, index) => <group key={project.id}
    position={[-10.22, index < 4 ? 1.85 : 0.75, -4.5 + (index % 4) * 2.4]}
    rotation={[0, Math.PI / 2, 0]}
    onClick={(event) => { event.stopPropagation(); onSelect(project.id); }}
    onPointerOver={() => { document.body.style.cursor = "pointer"; }}
    onPointerOut={() => { document.body.style.cursor = "auto"; }}>
    <mesh><boxGeometry args={[1.75, 0.86, 0.09]} /><meshStandardMaterial color={selected === project.id ? "#f0c55d" : accent} /></mesh>
    <Label text={project.title.slice(0, 30)} position={[0, 0, 0.052]} width={1.6} height={0.48} bg="#fbfaf1" color="#334335" fontSize={67} />
  </group>)}</group>;
}
function TeamUp({ slot, accent, paused, reducedMotion }: { slot: number; accent: string; paused: boolean; reducedMotion: boolean }) {
  const orb = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const x = slot === 0 ? 3.6 : -4.2;
  useFrame((_, dt) => {
    if (!paused && !reducedMotion) elapsed.current += Math.min(dt, 0.05);
    if (orb.current) {
      orb.current.position.x = Math.sin(elapsed.current * 2.6) * 0.72;
      orb.current.position.y = 1.16 + Math.abs(Math.sin(elapsed.current * 2.6)) * 0.42;
      orb.current.rotation.y = elapsed.current * 2;
    }
  });
  return <group position={[x, 0, 2.5]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.09, 0]}>
      <ringGeometry args={[1.38, 1.46, 48]} />
      <meshBasicMaterial color={accent} transparent opacity={0.7} side={THREE.DoubleSide} />
    </mesh>
    <group ref={orb}>
      <mesh><sphereGeometry args={[0.22, 20, 16]} /><meshStandardMaterial color="#fff8d7" emissive={accent} emissiveIntensity={0.8} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.32, 0.035, 8, 32]} /><meshBasicMaterial color={accent} /></mesh>
    </group>
    <Billboard position={[0, 2.85, 0]}><Label text="TEAM UP" position={[0, 0, 0]} width={1.65} height={0.38} bg={accent} color="#fffdf2" fontSize={75} /></Billboard>
  </group>;
}
// Keep late imports on the same circuit as the residents already in the room.
function OfficeAnimationClock({ paused, time }: { paused: boolean; time: { current: number } }) {
  useFrame((_, dt) => {
    if (!paused) time.current += Math.min(dt, 0.1);
  }, -1);
  return null;
}
function Walker({
  id,
  index,
  total,
  paused,
  selected,
  onSelect,
  status,
  nukeStartedAt,
  hammerHeld,
  hitAt,
  onHit,
  retrying = false,
  animationTime,
  agent,
  reducedMotion,
  interaction,
  showcase,
  cast,
}: {
  id: string;
  index: number;
  total: number;
  paused: boolean;
  selected: boolean;
  onSelect: () => void;
  status: AgentStatus | "preview";
  nukeStartedAt: number | null;
  hammerHeld: boolean;
  hitAt?: number;
  onHit: () => void;
  retrying?: boolean;
  animationTime: { current: number };
  agent?: OfficeAgent;
  showcase?: { index: number; state: ShowcaseState; onActivity: (index: number, state: ShowcaseState) => void };
  reducedMotion: boolean;
  interaction?: { slot: number; side: "from" | "to" };
  cast: CharacterCast;
}) {
  const mascot = useRef<MascotCharacter | null>(null);
  const parent = useRef<THREE.Group>(null);
  const visual = useRef<THREE.Group>(null);
  const initialPose = useRef(showcase ? showcasePose(showcase.index, 0, total) : officePose(status, index, animationTime.current, total));
  const mascotKind = showcase
    ? packKindForShowcase(cast, id)
    : packKindForAgent(cast, id);
  useEffect(() => {
    const instance = createVariantCharacter(id, cast, mascotKind);
    mascot.current = instance;
    visual.current?.add(instance.group);
    return () => {
      instance.dispose();
      mascot.current = null;
    };
  }, [id, cast, mascotKind]);
  useFrame((_, dt) => {
    const elapsed = reducedMotion ? 0 : animationTime.current;
    const pose = showcase ? showcasePose(showcase.index, elapsed, total) : officePose(status, index, elapsed, total, retrying, interaction);
    if (showcase) {
      const state = showcaseState(elapsed, showcase.index);
      if (state.phase !== showcase.state.phase) showcase.onActivity(showcase.index, state);
    }
    if (visual.current) {
      const impact = hitAt === undefined || reducedMotion ? 0 : Math.max(0, 1 - (performance.now() - hitAt) / 400);
      visual.current.scale.set(1 + impact * 0.18, 1 - impact * 0.2, 1 + impact * 0.18);
      visual.current.rotation.z = Math.sin(impact * Math.PI * 3) * 0.15;
      if (nukeStartedAt !== null && !reducedMotion) {
        const phase = nukePhase(nukeStartedAt);
        const burst = Math.max(0, 1 - phase.shell);
        const wobble = Math.sin(index * 1.7 + phase.t * 14) * burst;
        visual.current.position.set(wobble * 2.2, burst * 4.5, Math.cos(index * 2.1 + phase.t * 11) * burst * 2.2);
      } else {
        visual.current.position.set(0, 0, 0);
      }
    }
    if (parent.current) {
      const target = new THREE.Vector3(pose.x, pose.y, pose.z);
      const moving = parent.current.position.distanceTo(target) > 0.12;
      if (reducedMotion) parent.current.position.copy(target);
      else parent.current.position.lerp(target, 1 - Math.exp(-dt * 5));
      parent.current.rotation.y = pose.facing;
      mascot.current?.update(
        reducedMotion ? 0 : animationTime.current,
        paused || reducedMotion ? 0 : pose.walking || moving ? 1 : 0,
        pose.sitting && (!moving || reducedMotion),
        status === "idle" || status === "offline",
      );
    }
  });
  return (
    <group
      ref={parent}
      name={`${showcase ? "office-showcase" : "office-agent"}:${id}`}
      position={[
        initialPose.current.x,
        initialPose.current.y,
        initialPose.current.z,
      ]}
      rotation={[0, initialPose.current.facing, 0]}
      onClick={(e) => {
        e.stopPropagation();
        if (!hammerHeld) onSelect();
      }}
      onPointerDown={(e) => {
        if (!hammerHeld || e.button !== 0 || nukeStartedAt !== null) return;
        e.stopPropagation();
        onHit();
      }}
      onPointerOver={() => {
        if (!hammerHeld) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      <group ref={visual} name="Agent model" />
      {hammerHeld && <mesh name="Hammer hit area" position={[0, 1, 0]} visible={false}>
        <sphereGeometry args={[1.8, 12, 8]} />
      </mesh>}
      {(status === "error" || status === "blocked") && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.7, 40]} />
          <meshBasicMaterial color={status === "error" ? "#ff6b6b" : "#f0a05a"} side={THREE.DoubleSide} />
        </mesh>
      )}
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.7, 0.77, 64]} />
          <meshBasicMaterial color="#f2b94a" side={THREE.DoubleSide} />
        </mesh>
      )}
      {agent ? <AgentNameplate name={agentDisplayName(agent)} color={STATUS_COLOR[agent.status]} selected={selected} />
        : showcase && <AgentNameplate name={SHOWCASE_CHARACTERS[showcase.index].name} color="#8b9b70" selected={selected} />}
    </group>
  );
}
function CameraReset({ resetKey, total, view }: { resetKey: number; total: number; view: RoomView | null }) {
  const { camera, controls, invalidate, size } = useThree();
  useEffect(() => {
    if (!view || !(camera instanceof THREE.PerspectiveCamera)) return;
    const frame = roomCameraFrame(total, size.width / size.height, camera.fov, view);
    const orbit = controls as OrbitControlsImpl | null;
    // Clear pending drag damping before applying a preset.
    if (orbit) { orbit.enableDamping = false; orbit.update(); }
    camera.position.copy(frame.position);
    orbit?.target.copy(frame.target);
    camera.lookAt(frame.target);
    orbit?.update();
    if (orbit) orbit.enableDamping = true;
    invalidate();
  }, [resetKey, total, view, camera, controls, invalidate, size.width, size.height]);
  return null;
}
const SHOWCASE_IDS = SHOWCASE_CHARACTERS.map((character) => character.id);

function Jev({
  cast,
  paused,
  agents,
  showcaseActivities,
}: {
  cast: CharacterCast;
  paused: boolean;
  agents: OfficeAgent[];
  showcaseActivities: ShowcaseState[];
}) {
  const root = useRef<THREE.Group>(null);
  const visual = useRef<THREE.Group>(null);
  const mascot = useRef<MascotCharacter | null>(null);
  const home = useMemo(() => new THREE.Vector3(JEV_HOME.x, JEV_HOME.y, JEV_HOME.z), []);
  const target = useRef(new THREE.Vector3());
  const mode = useRef<"idle" | "walking" | "handoff">("idle");
  const handoffTimer = useRef(0);
  const handoffAudio = useRef(false);
  const seenAgents = useRef(new Set<string>());
  const rosterPrimed = useRef(false);
  const agentQueue = useRef<{ index: number; localIndex: number; y: number }[]>([]);
  const [handoffAgentIndex, setHandoffAgentIndex] = useState<number | null>(null);
  const handoffLabel = useMemo(() => {
    if (handoffAgentIndex === null) {
      return agents.length ? "Next spawn, please" : "Idle — import agents";
    }
    const agent = agents[handoffAgentIndex];
    if (agent) return jevTriageAgent(agent).subtitle;
    const desk = jevHandoffDeskIndex(handoffAgentIndex);
    return jevAtShowcaseDesk(desk, agents, showcaseActivities, SHOWCASE_IDS).subtitle;
  }, [handoffAgentIndex, agents, showcaseActivities]);
  useEffect(() => {
    if (!rosterPrimed.current) {
      for (const agent of agents) seenAgents.current.add(agent.id);
      rosterPrimed.current = true;
      return;
    }
    const floors = stackFloors(agents);
    for (let index = 0; index < agents.length; index++) {
      const agent = agents[index];
      if (seenAgents.current.has(agent.id)) continue;
      seenAgents.current.add(agent.id);
      if (agent.status === "working" || agent.status === "unknown") {
        const key = floorKey(agent.harness);
        const localIndex = agents.filter((item) => floorKey(item.harness) === key).findIndex((item) => item.id === agent.id);
        agentQueue.current.push({ index, localIndex, y: Math.max(0, floors.indexOf(key)) * FLOOR_GAP });
      }
    }
  }, [agents]);
  useEffect(() => {
    const instance = createVariantCharacter("jev-supervisor", cast, packMascotKind(cast, "jev"));
    mascot.current = instance;
    visual.current?.add(instance.group);
    return () => {
      instance.dispose();
      mascot.current = null;
    };
  }, [cast]);
  useFrame(({ clock }, dt) => {
    if (!root.current) return;
    const walk = paused ? 0 : 1;
    if (mode.current === "idle") {
      root.current.position.lerp(home, 1 - Math.exp(-dt * 5 * walk));
      root.current.rotation.y = THREE.MathUtils.lerp(root.current.rotation.y, 0.35, 1 - Math.exp(-dt * 4 * walk));
      mascot.current?.update(clock.elapsedTime, 0, false, true);
      if (!paused && agentQueue.current.length > 0) {
        const next = agentQueue.current.shift()!;
        const agentIndex = next.index;
        const spot = jevHandoffPosition(jevHandoffDeskIndex(next.localIndex));
        target.current.set(spot.x, spot.y + next.y, spot.z);
        mode.current = "walking";
        handoffAudio.current = false;
        setHandoffAgentIndex(agentIndex);
      }
      return;
    }
    if (mode.current === "walking") {
      const dist = root.current.position.distanceTo(target.current);
      const step = Math.min(1, (JEV_WALK_SPEED * dt * walk) / Math.max(dist, 0.001));
      root.current.position.lerp(target.current, step);
      root.current.rotation.y = Math.atan2(
        target.current.x - root.current.position.x,
        target.current.z - root.current.position.z,
      );
      mascot.current?.update(clock.elapsedTime, walk, false, false);
      if (dist < 0.12) {
        root.current.position.copy(target.current);
        mode.current = "handoff";
        handoffTimer.current = JEV_HANDOFF_DWELL_SECONDS;
      }
      return;
    }
    handoffTimer.current -= dt * walk;
    mascot.current?.update(clock.elapsedTime, 0, true, false);
    if (!handoffAudio.current) {
      handoffAudio.current = true;
      playJevClipAtDesk();
    }
    if (handoffTimer.current <= 0) {
      mode.current = "idle";
      setHandoffAgentIndex(null);
    }
  });
  return <group ref={root} name="jev-supervisor">
    <group ref={visual} />
    <mesh
      name="Jev hit area"
      position={[0, 1.05, 0]}
      visible={false}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
        playJevClip();
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
      onClick={(event) => {
        event.stopPropagation();
        playJevClip({ restart: true });
      }}
    >
      <capsuleGeometry args={[0.55, 1.1, 6, 12]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
    <Billboard position={[0, 2.15, 0]}>
      <Label text="JEV" subtitle={handoffLabel} position={[0, 0, 0]} width={3.2} height={0.7} bg="#141c19" color="#e7f2ec" />
    </Billboard>
  </group>;
}

export default function OfficeWorld({
  agents,
  interactions,
  paused,
  night,
  cameraKey,
  selected,
  onSelect,
  profile,
  books,
  projects,
  selectedBook,
  selectedProject,
  onSelectBook,
  onSelectProject,
  onReady,
  showcaseActivities,
  onShowcaseActivity,
}: {
  agents: OfficeAgent[];
  interactions: LiveInteraction[];
  paused: boolean;
  night: boolean;
  cameraKey: number;
  selected: string | null;
  onSelect: (id: string) => void;
  profile: RoomProfile;
  books: KnowledgeBook[];
  projects: RoomProject[];
  selectedBook: string | null;
  selectedProject: string | null;
  onSelectBook: (id: string) => void;
  onSelectProject: (id: string) => void;
  onReady: () => void;
  showcaseActivities: ShowcaseState[];
  onShowcaseActivity: (index: number, state: ShowcaseState) => void;
}) {
  const [nukeStartedAt, setNukeStartedAt] = useState<number | null>(null);
  const animationTime = useRef(0);
  const [hammerHeld, setHammerHeld] = useState(false);
  const [orbit, setOrbit] = useState<OrbitControlsImpl | null>(null);
  const [view, setView] = useState<RoomView | null>("overview");
  const [viewKey, setViewKey] = useState(0);
  const [panMode, setPanMode] = useState(false);
  useEffect(() => { setView("overview"); }, [cameraKey]);
  useEffect(() => {
    warmJevClip();
    const unlock = () => warmJevClip();
    window.addEventListener("pointerdown", unlock, { once: true, passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  function chooseView(next: RoomView) {
    setView(next);
    setViewKey((key) => key + 1);
  }
  const [swingAt, setSwingAt] = useState(0);
  const [hammerHits, setHammerHits] = useState<Record<string, number>>({});
  const [lastHit, setLastHit] = useState<string | null>(null);
  const dropHammer = useCallback(() => setHammerHeld(false), []);
  const swingHammer = useCallback(() => setSwingAt(performance.now()), []);
  function hitAgent(id: string, name: string) {
    const at = performance.now();
    setSwingAt(at);
    setHammerHits((hits) => ({ ...hits, [id]: at }));
    setLastHit(name);
  }
  const hasAgents = agents.length > 0;
  useEffect(() => {
    if (nukeStartedAt === null) return;
    const timer = setTimeout(() => setNukeStartedAt(null), NUKE_DURATION * 1000);
    return () => clearTimeout(timer);
  }, [nukeStartedAt]);
  function resetWithNuke() {
    setNukeStartedAt(performance.now());
  }
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const palette = PALETTES[profile.theme];
  const cast = characterCast(profile.cast);
  const manager = managerLook(profile.manager);
  const managerName = MANAGER_NAMES[manager];
  const floors = stackFloors(agents);
  const floorGroups = floors.length
    ? floors.map((key, index) => ({ key, y: index * FLOOR_GAP, agents: agents.filter((agent) => floorKey(agent.harness) === key) }))
    : [{ key: "preview", y: 0, agents: [] as OfficeAgent[] }];
  return (
    <>
    <Canvas
      shadows
      dpr={[1, 1.7]}
      camera={{ position: [18, 17, 20], fov: 38 }}
      onCreated={onReady}
      aria-label={`Interactive 3D office · ${officeLayout(agents.length).desks.length} desks`}
      style={{ cursor: hammerHeld ? "none" : "auto" }}
    >
      <OfficeAnimationClock paused={paused} time={animationTime} />
      <color attach="background" args={[night ? "#0c1210" : palette.backdrop]} />
      <ambientLight intensity={night ? 0.45 : 0.7} />
      <hemisphereLight args={["#8fd9c4", "#1a2420", night ? 0.35 : 0.55]} />
      <directionalLight
        position={[-6, 18, 8]}
        intensity={night ? 1.35 : 1.7}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.001}
      />
      <WorkspaceNukeFlash startedAt={nukeStartedAt} />
      <WorkspaceMushroom startedAt={nukeStartedAt} center={[officeLayout(agents.length).carpet.x, 0.1, officeLayout(agents.length).carpet.z]} />
      <NukeWorkspaceShell startedAt={nukeStartedAt} reducedMotion={reducedMotion}>
      {floorGroups.map((floor) => <group key={floor.key} position={[0, floor.y, 0]} name={`${floor.key} floor`}>
      <Suspense fallback={null}>
        <Room night={night} profile={profile} total={floor.agents.length} />
      </Suspense>
      {floor.y === 0 && <>
        <KnowledgeDisplay books={books} selected={selectedBook} onSelect={onSelectBook} accent={palette.accent} />
        <ProjectWall projects={projects} selected={selectedProject} onSelect={onSelectProject} accent={palette.accent} />
        {interactions.map((link) => <TeamUp key={`${link.fromId}-${link.toId}`} slot={link.slot} accent={palette.accent} paused={paused} reducedMotion={reducedMotion} />)}
        <Mara celebrating={nukeStartedAt !== null} look={manager} />
        <ToyHammer held={hammerHeld} swingAt={swingAt} reducedMotion={reducedMotion} onPickUp={() => { document.body.style.cursor = "auto"; onSelect(""); setHammerHeld(true); }} onDrop={dropHammer} onSwing={swingHammer} />
        {!hammerHeld && <Billboard position={[0, 2.4, 6.4]}>
          <Label text="TOY HAMMER" subtitle="Pick up. Tap a coworker." position={[0, 0, 0]} width={2.7} height={0.7} bg="#fff4db" color="#594b32" />
        </Billboard>}
      </>}
      {floor.key !== "preview" && <Billboard position={[7.2, 3.4, 4.2]}>
        <Label text={floor.key.toUpperCase()} subtitle={`${floor.agents.length} sessions`} position={[0, 0, 0]} width={3.2} height={0.7} bg="#141c19" color="#e7f2ec" />
      </Billboard>}
      {floor.agents.map((a) => ({
            id: a.id,
            label: a.name,
            status: a.status,
            retrying: a.health?.retrying,
            agent: a,
            interaction: (() => {
              const link = interactions.find((item) => item.fromId === a.id || item.toId === a.id);
              return link ? { slot: link.slot, side: link.fromId === a.id ? "from" as const : "to" as const } : undefined;
            })(),
          })).map((a, i, array) => (
        <Walker
          key={`${cast}-${a.id}`}
          {...a}
          index={i}
          total={array.length}
          animationTime={animationTime}
          paused={paused}
          nukeStartedAt={nukeStartedAt}
          hammerHeld={hammerHeld}
          hitAt={hammerHits[a.id]}
          onHit={() => hitAgent(a.id, a.label ?? "coworker")}
          reducedMotion={reducedMotion}
          selected={selected === a.id}
          onSelect={() => onSelect(a.id)}
          cast={cast}
        />
      ))}
      </group>)}
      <Jev cast={cast} paused={paused} agents={agents} showcaseActivities={showcaseActivities} />
      {agents.length === 0 && SHOWCASE_CHARACTERS.map((character, index) => <Walker
        key={`${cast}-${character.id}`} id={character.id} index={50 + index} total={agents.length}
        status={showcaseActivities[index].status} animationTime={animationTime} paused={paused} reducedMotion={reducedMotion}
        selected={selected === character.id} onSelect={() => onSelect(character.id)}
        nukeStartedAt={nukeStartedAt} hammerHeld={hammerHeld} hitAt={hammerHits[character.id]}
        onHit={() => hitAgent(character.id, character.name)}
        showcase={{ index, state: showcaseActivities[index], onActivity: onShowcaseActivity }}
        cast={cast}
      />)}
      <ContactShadows
        position={[0, -0.66, 0]}
        opacity={0.3}
        scale={120}
        blur={2.6}
        far={10}
        resolution={512}
        frames={1}
      />
      </NukeWorkspaceShell>
      <group position={[8.1, 0.1, 5.6]} name="Mara review station">
        <Box position={[0, 0.15, 0]} size={[1.7, 0.3, 1.7]} color="#394940" />
        <Box position={[0, 0.66, 0]} size={[1.05, 0.8, 1.05]} color="#e8dec9" />
        <mesh position={[0, 1.1, 0]} castShadow>
          <cylinderGeometry args={[0.69, 0.69, 0.14, 48]} />
          <meshStandardMaterial color="#444c49" metalness={0.65} roughness={0.3} />
        </mesh>
        <group position={[0, nukeStartedAt === null ? 1.3 : 1.15, 0]}>
          <mesh name="3D reset button" castShadow onClick={(event) => { event.stopPropagation(); resetWithNuke(); }}
            onPointerOver={() => { document.body.style.cursor = "pointer"; }}
            onPointerOut={() => { document.body.style.cursor = "auto"; }}>
            <cylinderGeometry args={[0.57, 0.62, 0.3, 48]} />
            <meshStandardMaterial color="#e6533d" roughness={0.3} emissive="#ff5a2e" emissiveIntensity={nukeStartedAt === null ? 0.12 : 0.55} />
          </mesh>
          <Label text="NUKE" position={[0, 0.155, 0]} rotation={[-Math.PI / 2, 0, 0]} width={0.85} height={0.3} bg="#e6533d" color="#fff7eb" fontSize={150} />
        </group>
        <Billboard position={[-1.15, 4.35, 0]}>
          <Label text={managerName.toUpperCase()} subtitle="Reviews every run." position={[0, 0, 0]} width={3.7} height={0.9} bg="#141c19" color="#e7f2ec" />
        </Billboard>
      </group>
      <CameraReset resetKey={cameraKey + viewKey} total={agents.length} view={view} />
      <OrbitControls
        ref={setOrbit}
        makeDefault
        enabled={!hammerHeld}
        target={[0, 0.2, 0]}
        minDistance={6}
        maxDistance={600}
        maxPolarAngle={Math.PI / 2.25}
        minPolarAngle={0.001}
        zoomToCursor
        screenSpacePanning={false}
        mouseButtons={{ LEFT: panMode ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        touches={{ ONE: panMode ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        onStart={() => setView(null)}
        enableDamping
      />
    </Canvas>
    <div className="room-toys">
      <button className="world-reset-hit" aria-label="Nuke the workspace (visual only)" disabled={nukeStartedAt !== null} onClick={resetWithNuke}>Nuke</button>
      <button className="hammer-pickup" aria-label={hammerHeld ? 'Put down toy hammer' : 'Pick up toy hammer'} onClick={() => {
        if (hammerHeld) dropHammer();
        else { document.body.style.cursor = 'auto'; onSelect(''); setHammerHeld(true); }
      }}>{hammerHeld ? 'Put down hammer' : 'Toy hammer'}</button>
    </div>
    <div className="room-camera" role="toolbar" aria-label="Room camera">
      <button aria-label="Room overview" title="Fit the whole room" aria-pressed={view === "overview"} disabled={hammerHeld} onClick={() => chooseView("overview")}><Eye size={16} /><span>Overview</span></button>
      <button aria-label="Top view" title="See the floor plan from above" aria-pressed={view === "overhead"} disabled={hammerHeld} onClick={() => chooseView("overhead")}><Grid2X2 size={16} /><span>Top view</span></button>
      <span />
      <button aria-label="Zoom in" title="Zoom in" disabled={hammerHeld} onClick={() => orbit?.dollyIn(0.8)}><Plus size={16} /></button>
      <button aria-label="Zoom out" title="Zoom out" disabled={hammerHeld} onClick={() => orbit?.dollyOut(0.8)}><Minus size={16} /></button>
      <button aria-label="Pan camera" title="Drag to move around the room" aria-pressed={panMode} disabled={hammerHeld} onClick={() => setPanMode((active) => !active)}><Hand size={16} /><span>Pan</span></button>
    </div>
    <div className="hammer-hint" role="status" aria-live="polite">
      {hammerHeld ? "Hammer in hand · click near a coworker · Esc or right-click to put down" : "Pick up the toy hammer in the office"}
      <small>{lastHit ? `${lastHit} got a playful tap.` : "Toy interaction · source status stays intact"}</small>
    </div>
    <div className="tibo-reset-hint" role="status" aria-live="polite">
      {nukeStartedAt !== null ? "Workspace nuked — reforming…" : hasAgents ? `${managerName} reviews the floor. Red NUKE button = blow it up & rebuild (cosmetic).` : `Trace, Signal, Patch, and Relay report to ${managerName}. Jev waits for a new agent to hand off.`}
      <small>Visual only · agent sessions stay intact</small>
    </div>
    </>
  );
}
