import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, FileUp, Globe2, Play, RefreshCw, X } from "lucide-react";
import type { AgentInteraction, OfficeAgent, OfficeSnapshot } from "../../types";
import { parseOfficeSnapshot } from "../../snapshot";
import { liveImportPrompt } from "../../integrations/codex/importPrompt";
import { liveApiBase, type LiveRoomConnection } from "../../integrations/codex/useLiveRoom";
import { AGENT_PLATFORMS, agentPlatform, type ConnectMode, type PlatformId } from "../../integrations/agentPlatforms";
import type { LocalHarness, LocalSource } from "../../integrations/codex/useRobotsSessions";
import "./welcome.css";

export default function Welcome({ onImport, onExplore, onSocialImport, onWatchLocal, existingCount = 0, live }: {
  onImport: (agents: OfficeAgent[], interactions?: AgentInteraction[]) => void;
  onExplore: () => void;
  onSocialImport: () => void;
  onWatchLocal?: (source: LocalSource, harness?: LocalHarness) => void;
  existingCount?: number;
  live: LiveRoomConnection;
}) {
  const [project, setProject] = useState("");
  const [ownerName, setOwnerName] = useState(() => live.credential?.ownerName ?? localStorage.getItem('dots-uploader-name') ?? '');
  const [preparing, setPreparing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"platform" | "mode" | "details">("platform");
  const [platformId, setPlatformId] = useState<PlatformId | null>(null);
  const [mode, setMode] = useState<ConnectMode | null>(null);
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const promptInput = useRef<HTMLTextAreaElement>(null);
  const promptDetails = useRef<HTMLDetailsElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  const receive = (data: OfficeSnapshot) => {
    setSnapshot(data);
    setSelected(new Set(data.agents.map((a) => a.id)));
    setError("");
  };

  const prompt = live.credential ? liveImportPrompt(project, {
    url: `${liveApiBase}/api/live/rooms/${live.credential.roomId}/feed`, token: live.credential.uploadToken,
    bridgeUrl: `${window.location.origin}/agent-bridge.mjs`,
  }) : "";

  function explore() {
    const name = ownerName.trim();
    if (name) localStorage.setItem('dots-uploader-name', name);
    onExplore();
  }

  async function prepareLive() {
    setPreparing(true); setError('');
    try {
      if (live.roomId) await live.join(ownerName); else await live.create(ownerName);
      localStorage.setItem('dots-uploader-name', ownerName.trim());
      setCopied(false);
    }
    catch (e) {
      const message = e instanceof Error ? e.message : "";
      setError(/unavailable|failed to fetch|network|ECONNREFUSED/i.test(message)
        ? "Create live room needs a second process, npm run dev:relay, on port 8787. That process is not running. You do not need it to put agents on this floor. Use Watch local sessions."
        : message || "Unable to prepare the room.");
    }
    finally { setPreparing(false); }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setError("");
    } catch {
      if (promptDetails.current) promptDetails.current.open = true;
      promptInput.current?.focus();
      promptInput.current?.select();
      setError("Clipboard unavailable. The prompt is selected; copy it with your keyboard.");
    }
  }

  const nameField = <>
    <label className="project-label" htmlFor="uploader-name">Your name</label>
    <input id="uploader-name" className="project-input" autoComplete="name" maxLength={60} value={ownerName} onChange={e => { setOwnerName(e.target.value); setCopied(false); }} />
    <small className="project-hint">Shown above your bots. This name is provided by you.</small>
  </>;
  return (
    <dialog ref={dialog} className="welcome-overlay" aria-labelledby="welcome-title" onCancel={(event) => { event.preventDefault(); explore(); }}>
        <section className="welcome-card" aria-label="Import your agent sessions">
          <button className="welcome-close" aria-label="Close import" onClick={explore}><X size={18} /></button>
          {snapshot ? <>
            <div className="welcome-heading"><span className="welcome-card-icon"><Check size={20} /></span><span className="eyebrow">SNAPSHOT RECEIVED</span></div>
            <h2 id="welcome-title">{snapshot.agents.length ? "Meet your little coworkers." : "No sessions in this snapshot."}</h2>
            {nameField}
            <p>{snapshot.agents.length ? live.roomId ? "Selected sessions will be visible to everyone in this room. A snapshot does not stream new activity." : "Selected agents join this world. This file is a recorded snapshot; connect live to stream changes." : "Try another project or export a new snapshot."}</p>
            <div className="import-selection">
              {snapshot.agents.map((agent) => <label key={agent.id}>
                <input type="checkbox" checked={selected.has(agent.id)} onChange={() => setSelected((previous) => {
                  const next = new Set(previous); if (next.has(agent.id)) next.delete(agent.id); else next.add(agent.id); return next;
                })} />
                <span><b>{agent.name}</b><small>{agent.history?.length ? `${agent.history.length} recorded events` : "No recorded timeline"} · {agent.model ?? "Model not reported"}</small></span>
              </label>)}
            </div>
            <button className="welcome-action welcome-primary" disabled={!selected.size || adding} onClick={async () => { setAdding(true); try {
              const agents = snapshot.agents.filter(a => selected.has(a.id));
              const interactions = snapshot.interactions?.filter(link => selected.has(link.fromId) && selected.has(link.toId));
              if (live.roomId) { await live.publishSnapshot({ version: 1, agents, interactions }, ownerName); onExplore(); }
              else {
                if (!ownerName.trim() || ownerName.trim().length > 60) throw new Error('Enter your name before adding agents.');
                localStorage.setItem('dots-uploader-name', ownerName.trim());
                onImport(agents.map(a => ({ ...a, ownerName: ownerName.trim(), status: a.status === 'working' ? 'unknown' : a.status })), interactions);
              }
            } catch (e) { setError(e instanceof Error ? e.message : "Unable to add agents."); } finally { setAdding(false); } }}><Play size={16} />{adding ? 'Adding sessions…' : 'Add to this world'}<span>{selected.size}</span></button>
            <button className="welcome-action" onClick={() => { setSnapshot(null); setError(""); }}>Import another snapshot <RefreshCw size={13} /></button>
          </> : <>
            {step === "platform" && <>
              <div className="welcome-heading"><span className="welcome-card-icon">⌘</span><span className="eyebrow">BRING YOUR AGENTS</span></div>
              <h2 id="welcome-title">Pick a platform.</h2>
              <p>Choose where the sessions live. The name and project form comes after you pick cloud or local.</p>
              <div className="platform-grid" role="list">
                {AGENT_PLATFORMS.map((item) => <button key={item.id} type="button" className="platform-tile" role="listitem" onClick={() => { setPlatformId(item.id); setMode(null); setStep("mode"); setError(""); }}>
                  <img className="platform-logo" src={item.logo} alt="" />
                  <b>{item.name}</b>
                </button>)}
              </div>
              {existingCount > 0 && <p className="existing-office">{existingCount} imported {existingCount === 1 ? "agent already lives" : "agents already live"} here. New imports join them.</p>}
              <div className="welcome-divider"><span>or import a saved snapshot</span></div>
              <button className="welcome-action" onClick={() => fileInput.current?.click()}><FileUp size={16} />Import snapshot file<ArrowRight size={16} /></button>
              <p className="welcome-privacy">Only session metadata and activity. No credentials, file contents, or full conversation logs. Neatlogs is the trace store and the coding-agent login. This office is the floor those sessions can sit on.</p>
            </>}
            {step === "mode" && platformId && <>
              <button type="button" className="welcome-back" onClick={() => setStep("platform")}>Back</button>
              <div className="welcome-heading"><img className="platform-logo" src={agentPlatform(platformId).logo} alt="" /><span className="eyebrow">{agentPlatform(platformId).name.toUpperCase()}</span></div>
              <h2 id="welcome-title">Put them on the floor</h2>
              <p>Local sessions are the step that seats a character. Connecting the tool in Neatlogs does not. A live room is only for sharing with someone else, and it needs a relay that is not running right now.</p>
              <button type="button" className="welcome-action welcome-primary" disabled={!agentPlatform(platformId).local || !onWatchLocal} onClick={() => { setMode("local"); setStep("details"); }}>Local sessions<ArrowRight size={16} /></button>
              <button type="button" className="welcome-action" disabled={!agentPlatform(platformId).cloud} onClick={() => { setMode("cloud"); setStep("details"); }}>Cloud<ArrowRight size={16} /></button>
            </>}
            {step === "details" && platformId && mode && <>
              <button type="button" className="welcome-back" onClick={() => setStep("mode")}>Back</button>
              <div className="welcome-heading"><img className="platform-logo" src={agentPlatform(platformId).logo} alt="" /><span className="eyebrow">{mode === "cloud" ? "CLOUD" : "LOCAL"} · {agentPlatform(platformId).name.toUpperCase()}</span></div>
              <h2 id="welcome-title">{mode === "cloud" ? `Connect ${agentPlatform(platformId).name}` : `Watch ${agentPlatform(platformId).name} here`}</h2>
              <p>{mode === "cloud" ? (agentPlatform(platformId).cloud?.detail ?? `${agentPlatform(platformId).name} has no cloud approval flow inside TraceOffice.`) : (agentPlatform(platformId).local?.detail ?? "This platform is not read from local files.")}</p>
              {nameField}
              {mode === "local" && agentPlatform(platformId).local && onWatchLocal && <button className="welcome-action welcome-primary" onClick={() => {
                const local = agentPlatform(platformId).local!;
                if (ownerName.trim()) localStorage.setItem("dots-uploader-name", ownerName.trim());
                onWatchLocal(local.source, local.harness ?? "");
              }}><Play size={16} />Watch local sessions<ArrowRight size={16} /></button>}
              {mode === "cloud" && <>
                <p className="project-hint">You can already be connected on Neatlogs. That login does not send sessions to this office. Go back and choose Local sessions.</p>
                <button type="button" className="welcome-action welcome-primary" onClick={() => { setMode("local"); }}>Use local sessions instead<ArrowRight size={16} /></button>
              </>}
              <details className="prompt-box">
                <summary>Share with other people <span>Optional</span></summary>
                <p className="project-hint">Create live room calls port 8787. That relay is a separate terminal: npm run dev:relay. Skip this if you only want agents on your own floor.</p>
                <label className="project-label" htmlFor="import-project">Project <small>Optional</small></label>
                <input id="import-project" className="project-input" value={project} onChange={(e) => { setProject(e.target.value); setCopied(false); }} />
                {(!live.credential?.ownerName || live.credential.ownerName !== ownerName.trim()) && <button className="welcome-action" onClick={prepareLive} disabled={preparing || !ownerName.trim()}>{preparing ? "Preparing live room…" : live.credential ? "Save uploader name" : live.roomId ? "Join this live room" : "Create live room"}<ArrowRight size={16} /></button>}
                {live.credential?.ownerName === ownerName.trim() && <details className="prompt-box" ref={promptDetails}><summary>Preview prompt <span>Selected live sessions</span></summary><textarea ref={promptInput} aria-label="Live import prompt" readOnly value={prompt} spellCheck={false} /></details>}
                {live.credential?.ownerName === ownerName.trim() && <button className="welcome-action" onClick={copyPrompt} disabled={preparing}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Copied — paste into your agent" : "Copy live prompt"}<ArrowRight size={16} /></button>}
              </details>
            </>}
          </>}
          <input ref={fileInput} type="file" aria-label="Snapshot file" accept=".json,application/json" hidden onChange={async (event) => {
            const file = event.target.files?.[0]; event.target.value = "";
            if (!file) return;
            try {
              if (file.size > 2_000_000) throw new Error("Choose a snapshot smaller than 2 MB.");
              receive(parseOfficeSnapshot(await file.text()));
            } catch (e) { setError(e instanceof Error ? e.message : "Unable to read snapshot."); }
          }} />
          {error && <p className="welcome-error" role="alert">{error}</p>}
          <button className="welcome-action" onClick={onSocialImport}><Globe2 size={16} /> Personalize with LinkedIn or X <ArrowRight size={16} /></button>
          <button className="welcome-action welcome-skip" onClick={explore}>{live.roomId ? 'Go to live room' : 'Explore the office'}<ArrowRight size={16} /></button>
        </section>
    </dialog>
  );
}
