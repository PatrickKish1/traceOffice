import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Coffee,
  Globe2,
  Heart,
  Maximize,
  Moon,
  MousePointer2,
  BookOpen,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { isJevMuted, setJevMuted } from "./audio/jevSound";
import OfficeWorld from "./components/OfficeWorld";
import { recipeFromSeed } from "./components/office/characters/characterEngine";
import { SHOWCASE_CHARACTERS, showcaseState, type ShowcaseState } from "./showcase";
import "./components/office/showcase.css";
import type { AgentInteraction, OfficeAgent, OfficeSnapshot } from "./types";
import {
  agentActivityLabel,
  agentDisplayName,
  agentIsVisible,
  DISCONNECTED_RETENTION_MS,
  officeSummary,
} from "./officeActivity";
import { STATUS_LABELS, liveInteractions } from "./officeBehavior";
import { floorAdvice } from "./floorAdvice";
import { demoAgents } from "./demoFloor";
import { BUSINESS_PLAN } from "./businessPlan";
import { useRobotsSessions, type LocalHarness, type LocalSource, type SessionProject } from "./integrations/codex/useRobotsSessions";
import { useLiveRoom } from "./integrations/codex/useLiveRoom";
import LiveRoomBar from "./components/import/LiveRoomBar";
import Welcome from "./components/import/Welcome";
import { mergeOfficeAgents, readSavedOffice, serializeOffice, OFFICE_STORAGE_KEY } from "./officeStore";

import RoomStudio from "./components/RoomStudio";
import {
  characterCast, DEFAULT_SHARE, EMPTY_PROFILE, EMPTY_STATS, managerLook, MANAGER_NAMES, readGuestRoom,
  type GuestRoom, type KnowledgeBook, type RoomProfile, type RoomProject,
  type RoomStats, type ShareOptions,
} from "./socialRoom";

function readRoomDraft() {
  try {
    const raw = localStorage.getItem("dots-room-draft-v1");
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const validTheme = ["studio", "grove", "coastal", "cosmic"].includes(value.profile?.theme);
    return {
      profile: validTheme && typeof value.profile?.displayName === "string" && typeof value.profile?.socialUrl === "string" && typeof value.profile?.interests === "string" ? { ...value.profile, cast: characterCast(value.profile.cast), manager: managerLook(value.profile.manager) } as RoomProfile : EMPTY_PROFILE,
      books: Array.isArray(value.books) ? value.books.filter((book: KnowledgeBook) => book && typeof book.id === "string" && typeof book.title === "string" && typeof book.summary === "string").slice(0, 8) as KnowledgeBook[] : [],
      projects: Array.isArray(value.projects) ? value.projects.filter((project: RoomProject) => project && typeof project.id === "string" && typeof project.title === "string" && typeof project.url === "string").slice(0, 8) as RoomProject[] : [],
      stats: value.stats && typeof value.stats === "object" ? { ...EMPTY_STATS, ...value.stats, agentTotals: value.stats.agentTotals && typeof value.stats.agentTotals === "object" ? value.stats.agentTotals : {} } as RoomStats : EMPTY_STATS,
      share: value.share && typeof value.share === "object" ? { ...DEFAULT_SHARE, ...value.share } as ShareOptions : DEFAULT_SHARE,
    };
  } catch { return null; }
}
const roomDraft = readRoomDraft();

export default function App() {
  const live = useLiveRoom();
  const [saved] = useState(() => {
    try { return readSavedOffice(localStorage); }
    catch { return { agents: [], interactions: [], error: "Browser storage is unavailable. Your office cannot be saved on this device." }; }
  });
  const [welcome, setWelcome] = useState(false);
  const [showcaseActivities, setShowcaseActivities] = useState(() => SHOWCASE_CHARACTERS.map((_, index) => showcaseState(0, index)));
  function updateShowcase(index: number, activity: ShowcaseState) {
    setShowcaseActivities(current => current[index].phase === activity.phase ? current : current.map((state, i) => i === index ? activity : state));
  }
  const [agents, setAgents] = useState<OfficeAgent[]>(() => saved.agents.map(agent => ({ ...agent,
    status: agent.status === 'working' ? 'unknown' : agent.status,
  })));
  const agentsRef = useRef(agents);
  const [officeError, setOfficeError] = useState(saved.error);
  const [interactions, setInteractions] = useState<AgentInteraction[]>(saved.interactions);
  const [interactionClock, setInteractionClock] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [demoOn, setDemoOn] = useState(false);
  const [demoCast, setDemoCast] = useState<OfficeAgent[]>([]);
  const [jevMuted, setJevMutedState] = useState(() => isJevMuted());
  const [planOpen, setPlanOpen] = useState(false);
  const [drill, setDrill] = useState<OfficeAgent | null>(null);
  const [drillError, setDrillError] = useState("");
  const [drillRunning, setDrillRunning] = useState(false);
  const [night, setNight] = useState(true);
  const [feedPlatform, setFeedPlatform] = useState<string | null>(null);
  const [projectPicker, setProjectPicker] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [help, setHelp] = useState(false);
  const [ready, setReady] = useState(false);
  const [studioTab, setStudioTab] = useState<"profile" | "social" | "library" | "projects" | "invite" | "characters" | null>(null);
  const [profile, setProfile] = useState<RoomProfile>(roomDraft?.profile ?? EMPTY_PROFILE);
  const [books, setBooks] = useState<KnowledgeBook[]>(roomDraft?.books ?? []);
  const [projects, setProjects] = useState<RoomProject[]>(roomDraft?.projects ?? []);
  const [stats, setStats] = useState<RoomStats>(roomDraft?.stats ?? EMPTY_STATS);
  const [share, setShare] = useState<ShareOptions>(roomDraft?.share ?? DEFAULT_SHARE);
  const [guest, setGuest] = useState<GuestRoom | null>(() => readGuestRoom(window.location.hash));
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [openedBooks, setOpenedBooks] = useState<string[]>([]);
  useEffect(() => {
    try { localStorage.setItem("dots-room-draft-v1", JSON.stringify({ profile, books, projects, stats, share })); }
    catch { /* The current room remains usable when browser storage is unavailable. */ }
  }, [profile, books, projects, stats, share]);
  useEffect(() => {
    const update = () => { setGuest(readGuestRoom(window.location.hash)); setSelected(null); setSelectedBook(null); setSelectedProject(null); setOpenedBooks([]); };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const office = useRef<HTMLDivElement>(null);
  const visibleProfile = guest?.profile ?? profile;
  const visibleBooks = guest?.books ?? books;
  const visibleProjects = guest?.projects ?? projects;
  function addAgents(incoming: OfficeAgent[], incomingLinks: AgentInteraction[] = []) {
    const merged = mergeOfficeAgents(agentsRef.current, incoming);
    const links = [...new Map([...interactions, ...incomingLinks].map((link) => [
      `${link.fromId}:${link.toId}:${link.at}:${link.kind}`, link,
    ])).values()].filter((link) => merged.some((a) => a.id === link.fromId) && merged.some((a) => a.id === link.toId)).slice(-100);
    try { localStorage.setItem(OFFICE_STORAGE_KEY, serializeOffice(merged, links)); }
    catch { throw new Error("This browser could not save the office. Free some browser storage and try importing again."); }
    agentsRef.current = merged;
    setAgents(merged);
    setInteractions(links);
    setOfficeError("");
    return merged;
  }
  function dismissWelcome() { setWelcome(false); }
  const [localSnapshot, setLocalSnapshot] = useState<OfficeSnapshot>({ version: 1, agents: [] });
  useEffect(() => {
    if (!demoOn) {
      setDemoCast([]);
      return;
    }
    const started = Date.now();
    const tick = () => setDemoCast(demoAgents(Date.now() - started));
    tick();
    const timer = window.setInterval(tick, 400);
    return () => window.clearInterval(timer);
  }, [demoOn]);
  const local = useRobotsSessions((snapshot) => {
    setInteractions(snapshot.interactions ?? []);
    setInteractionClock(Date.now());
    setLocalSnapshot(snapshot);
  });
  const visibleAgents = (local.enabled ? localSnapshot.agents : agents).map((a) =>
    local.enabled ? { ...a, ownerName: a.ownerName ?? localStorage.getItem('dots-uploader-name') ?? undefined,
      status: local.state === 'connected' ? a.status : 'offline' as const,
      disconnectedAt: local.state === 'connected' ? a.disconnectedAt : local.disconnectedAt } : a,
  );
  useEffect(() => {
    if (!interactions.length && !live.interactions.length) return;
    const timer = setInterval(() => setInteractionClock(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [interactions.length, live.interactions.length]);
  const baseAgents = demoOn ? demoCast : live.roomId ? live.agents : guest?.agents ?? visibleAgents;
  const sourceAgents = drill && !baseAgents.some((agent) => agent.id === drill.id) ? [...baseAgents, drill] : baseAgents;
  const roomAgents = sourceAgents.filter(agent => agentIsVisible(agent));
  useEffect(() => {
    const expires = sourceAgents.filter(agent => agent.status === 'offline' && agentIsVisible(agent))
      .map(agent => Date.parse(agent.disconnectedAt ?? agent.updatedAt) + DISCONNECTED_RETENTION_MS);
    if (!expires.length) return;
    const timer = setTimeout(() => setInteractionClock(Date.now()), Math.max(1, Math.min(...expires) - Date.now()));
    return () => clearTimeout(timer);
  }, [sourceAgents, interactionClock]);
  const summary = officeSummary(roomAgents);
  const advice = floorAdvice(roomAgents);
  async function runRecovery() {
    setDrillRunning(true);
    setDrillError("");
    try {
      const response = await fetch("/api/office/recover", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Recovery check failed.");
      if (data.agent) {
        setDrill(data.agent);
        setSelected(data.agent.id);
      }
    } catch (error) {
      setDrillError(error instanceof Error ? error.message : "Recovery check failed.");
    } finally {
      setDrillRunning(false);
    }
  }
  const activeLinks = demoOn ? [] : live.roomId ? liveInteractions(roomAgents, live.interactions, interactionClock)
    : guest || (local.enabled && local.state !== "connected")
      ? [] : liveInteractions(roomAgents, interactions, interactionClock);
  const linkedPartner = (id: string) => {
    const link = activeLinks.find((item) => item.fromId === id || item.toId === id);
    return link && roomAgents.find((item) => item.id === (link.fromId === id ? link.toId : link.fromId));
  };
  const agent = roomAgents.find((a) => a.id === selected);
  const book = visibleBooks.find((item) => item.id === selectedBook);
  const project = visibleProjects.find((item) => item.id === selectedProject);
  function selectAgent(id: string) { setSelected(id); setSelectedBook(null); setSelectedProject(null); }
  function selectBook(id: string) { setSelected(null); setSelectedProject(null); setSelectedBook(id); setOpenedBooks((current) => current.includes(id) ? current : [...current, id]); }
  function selectProject(id: string) { setSelected(null); setSelectedBook(null); setSelectedProject(id); }
  function leaveGuest() { window.location.hash = ""; setGuest(null); }
  function joinGuest() {
    if (!guest) return;
    try {
      const incoming = guest.agents.map((a) => ({ ...a, id: `invite:${guest.createdAt}:${a.id}` }));
      addAgents(incoming);
      local.disconnect();
      setPaused(false);
      leaveGuest();
      dismissWelcome();
    } catch (e) { setOfficeError(e instanceof Error ? e.message : "Unable to join this snapshot."); }
  }
  const behavior = (a: OfficeAgent) => linkedPartner(a.id) ? `Working with ${linkedPartner(a.id)!.name}` : agentActivityLabel(a) ?? STATUS_LABELS[a.status];
  const severalProjects = new Set(roomAgents.map((agent) => agent.project).filter(Boolean)).size > 1;
  const rosterTitle = (agent: OfficeAgent) => severalProjects && agent.project ? agent.project : agentDisplayName(agent);
  const rosterDetail = (agent: OfficeAgent) => severalProjects ? `${agent.name} · ${behavior(agent)}` : behavior(agent);
  function watchLocal(source: LocalSource = "grok", harness: LocalHarness = "") {
    setSelected(null);
    setWelcome(false);
    setPaused(false);
    local.connect(source, harness);
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="TraceOffice home">
          <span className="dotmark">
            <i />
            <i />
            <i />
            <i />
          </span>
          trace<span className="wordmark-dot">office</span>
        </a>
        <div className="header-divider" />
        <span className="office-name">
          Agent office <span>HQ</span>
        </span>
        {guest ? <nav aria-label="Shared room"><span className="guest-nav-label">Visiting {guest.profile.displayName}</span><button onClick={leaveGuest}>Back to my room</button></nav> : <nav aria-label="Agents">
          <span className="agents-heading">
            <Users size={15} />
            Agents {roomAgents.length > 0 && <small>{roomAgents.length}</small>}
          </span>
        </nav>}
        <div className="topbar-actions">
          {guest && <button className="import-button" onClick={joinGuest}><Users size={15} /> Join snapshot with my agents</button>}
          {!guest && <button className="studio-button" onClick={() => setPlanOpen(true)}>Business plan</button>}
          {!guest && <a className="studio-button" href="/guides">Guide</a>}
          {!guest && <button className="studio-button" onClick={() => setStudioTab("profile")}><Palette size={15} /> Room studio</button>}
          {!guest && <button className="studio-button social-top-button" title="Import LinkedIn or X" onClick={() => setStudioTab("social")}><Globe2 size={15} /> Import social</button>}
          {!guest && <button className="studio-button demo-button" type="button" aria-pressed={demoOn} title={demoOn ? "Stop demo" : "Play demo"} onClick={() => { setSelected(null); setDemoOn((on) => !on); }}>{demoOn ? <Pause size={15} /> : <Play size={15} />} {demoOn ? "Stop demo" : "Play demo"}</button>}
          {!guest && <button className="import-button" onClick={() => setWelcome(true)}><ArrowDownToLine size={15} /> Import agents</button>}
        </div>
      </header>
      <main>
        <aside className={`sidebar ${guest ? "guest-sidebar" : ""}`}>
          <div className="eyebrow"><span /> {guest ? "FRIEND'S ROOM" : "A NEW WAY TO WORK"}</div>
          <h1>{guest ? guest.profile.displayName : profile.displayName === "My room" ? <>Running is not<br />{" "}the same as working<span>.</span></> : <>{profile.displayName}<span>.</span></>}</h1>
          <p className="intro">{guest ? "Join combines these shared agents with yours in this browser. Changes are not sent to the host." : profile.interests || "The office shows who is seated. Neatlogs keeps the record of what they did."}</p>
          {!guest && (demoOn ? (
            <section className="floor-agent" aria-label="Demo">
              <b>Four floors, in this browser</b>
              <p>Agents arrive, one fails, then recovers. Nothing is posted to Neatlogs.</p>
            </section>
          ) : (
            <section className="floor-agent" aria-label="Floor agent">
              <b>{advice.title}</b>
              <p>{advice.detail}</p>
              <div>
                {advice.agentId && <button type="button" onClick={() => selectAgent(advice.agentId!)}>Show that session</button>}
                <button type="button" disabled={drillRunning} onClick={runRecovery}>{drillRunning ? "Checking…" : "Run recovery check"}</button>
              </div>
              {drillError && <small role="alert">{drillError}</small>}
            </section>
          ))}
          {visibleProfile.socialUrl && <a className="social-link" href={visibleProfile.socialUrl} target="_blank" rel="noreferrer">View social profile <ArrowUpRight size={12} /></a>}
          <div className="section-heading">
            {guest ? "SHARED AGENTS" : "YOUR OFFICE"}
            <span>{roomAgents.length}</span>
          </div>
          {roomAgents.length ? (
            <div className="roster">
              {roomAgents.map((a) => (
                <button
                  className={`roster-item ${selected === a.id ? "selected" : ""}`}
                  key={a.id}
                  onClick={() => selectAgent(a.id)}
                >
                  <span
                    className="avatar"
                    style={
                      {
                        "--avatar": recipeFromSeed(a.id).skin,
                      } as React.CSSProperties
                    }
                  >
                    <span className="eyes">••</span>
                  </span>
                  <span>
                    <b title={rosterTitle(a)}>{rosterTitle(a)}</b>
                    <small>{rosterDetail(a)}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-team">
              <Users size={25} />
              <h3>{guest ? "No agents shared" : "Room for your team"}</h3>
              <p>{guest ? "This invitation did not include agent sessions." : "Import a real agent snapshot to bring your own coworkers into the office."}</p>
              {!guest && <button onClick={() => setWelcome(true)}>Bring your agents <ArrowUpRight size={14} /></button>}
            </div>
          )}
          <section className="showcase-activity" aria-label="Showcase activity">
            <b>Preview crew · they report to {MANAGER_NAMES[managerLook(visibleProfile.manager)]}</b>
            {SHOWCASE_CHARACTERS.map((character, index) => <div key={character.id} data-showcase-id={character.id} data-phase={showcaseActivities[index].phase}>
              <span>{character.name}</span><small>{showcaseActivities[index].label}</small>
            </div>)}
          </section>
          {!guest && <LiveRoomBar live={live} onImport={() => setWelcome(true)} />}
          {(visibleBooks.length > 0 || visibleProjects.length > 0) && <div className="room-collections">
            {visibleBooks.length > 0 && <button onClick={() => guest ? selectBook(visibleBooks[0].id) : setStudioTab("library")}><BookOpen size={15} /><span>Learning library</span><b>{visibleBooks.length}</b></button>}
            {visibleBooks.length > 0 && <small>{openedBooks.filter((id) => visibleBooks.some((item) => item.id === id)).length} of {visibleBooks.length} books explored</small>}
            {visibleProjects.length > 0 && <button onClick={() => guest ? selectProject(visibleProjects[0].id) : setStudioTab("projects")}><Sparkles size={15} /><span>Project wall</span><b>{visibleProjects.length}</b></button>}
          </div>}
          {guest?.stats && <div className="friend-stats"><b>Shared totals</b><span>Tokens <strong>{guest.stats.totalTokens === null ? "Not shared" : guest.stats.totalTokens.toLocaleString()}</strong></span><span>Spend <strong>{guest.stats.totalSpend === null ? "Not shared" : `${guest.stats.currency} ${guest.stats.totalSpend.toFixed(2)}`}</strong></span><small>Owner-entered snapshot</small></div>}
          <div className="sidebar-bottom">
            {!guest && !live.roomId && local.enabled && !demoOn && (
              <div className="connection-summary">
                <b>
                  {local.project || "Local sessions"} ·{" "}
                  {local.state === "connected" ? "local feed" : local.state}
                </b>
                <span>
                  {roomAgents.length} recent sessions
                  {local.total ? ` of ${local.total}` : ""}
                </span>
                {local.catalog.length > 0 && (
                  <LocalFeed
                    catalog={local.catalog}
                    platform={feedPlatform}
                    onPlatform={setFeedPlatform}
                    onToggle={local.toggleProject}
                    onShowMore={() => setProjectPicker(true)}
                  />
                )}
                <button
                  onClick={() => {
                    local.disconnect();
                    setFeedPlatform(null);
                    setInteractions([]);
                  }}
                >
                  Disconnect
                </button>
              </div>
            )}

            <div className="coffee-note">
              <Coffee size={18} />
              <p>
                {guest ? "A friend's shared world." : "A window into your team."}
                <small>
                  {guest ? "Read-only invitation snapshot" : live.roomId
                      ? `Live room · ${live.state}` : local.enabled
                      ? "Recorded status and links · refreshed every 5s"
                      : "Imported snapshots are not live connections."}
                </small>
              </p>
            </div>
          </div>
        </aside>
        <section
          className={`world ${night ? "night" : ""}`}
          ref={office}
          aria-label="Office playground"
        >
          <div className="world-top">
            <div className="world-caption">
              <span className="live-dot" />
              {!roomAgents.length ? `Preview · ${MANAGER_NAMES[managerLook(visibleProfile.manager)]} is reviewing` : demoOn ? "DEMO" : guest ? "FRIEND'S ROOM" : live.roomId ? "LIVE AGENT ROOM" : "YOUR AGENT OFFICE"}
              <span className="mode-label">
                {demoOn ? "Simulated" : guest ? "Shared snapshot" : live.roomId ? live.state : local.enabled
                      ? local.state === "connected"
                        ? "Local feed"
                        : local.state
                      : "Snapshot"}
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="How to explore"
              onClick={() => setHelp(!help)}
            >
              <CircleHelp size={18} />
            </button>
          </div>
          {officeError && <p className="office-error" role="alert">{officeError}</p>}
          <OfficeWorld
            agents={roomAgents}
            interactions={activeLinks}
            paused={paused}
            night={night}
            cameraKey={cameraKey}
            selected={selected}
            onSelect={selectAgent}
            profile={visibleProfile}
            books={visibleBooks}
            projects={visibleProjects}
            selectedBook={selectedBook}
            selectedProject={selectedProject}
            onSelectBook={selectBook}
            onSelectProject={selectProject}
            onReady={() => setReady(true)}
            showcaseActivities={showcaseActivities}
            onShowcaseActivity={updateShowcase}
          />
          {!guest && !live.roomId &&
            local.enabled &&
            local.state === "loading" &&
            !agents.length && (
              <div className="connection-banner" role="status">
                Reading local sessions…
              </div>
            )}
          {!guest && !live.roomId && local.error && (
            <div className="connection-banner error" role="alert">
              {local.error}
            </div>
          )}
          {!guest && roomAgents.length > 0 && (
            <section className="office-summary" aria-label="Office summary">
              <span>IN THE OFFICE</span>
              <p>{summary}</p>
            </section>
          )}
          {activeLinks.length > 0 && <div className="collaboration-banner" role="status">
            <b>Recent session link</b>
            {activeLinks.map((link) => {
              const from = roomAgents.find((item) => item.id === link.fromId);
              const to = roomAgents.find((item) => item.id === link.toId);
              return <button key={`${link.fromId}-${link.toId}`} onClick={() => selectAgent(link.fromId)}>
                {from?.name} + {to?.name} · {link.kind === "delegation" ? "delegation" : "message call"}
              </button>;
            })}
          </div>}
          {!ready && <div className="loading-state">Opening the office…</div>}
          {help && (
            <div className="help-card">
              <b>Make yourself at home.</b>
              <p>
                Overview fits the room · Top view shows the floor plan. Drag to orbit,
                scroll or use +/− to zoom, and enable Pan or right-drag to move. On touchscreens,
                pinch to zoom and use two fingers to pan. Click a
                agent to see its activity. Trace, Signal, Patch, and Relay sit the preview desks and report to {MANAGER_NAMES[managerLook(visibleProfile.manager)]}. Jev hands off when a new agent joins. Pick up the toy hammer and tap a coworker.
                Escape or right-click puts it down.
              </p>
              <small>
                Live positions follow recorded session state. Play appears only after a recent recorded link between two working sessions.
              </small>
            </div>
          )}
          {(agent || book || project) && (
            <div className="detail-card">
              <button
                className="close"
                aria-label="Close details"
                onClick={() => { setSelected(null); setSelectedBook(null); setSelectedProject(null); }}
              >
                <X size={16} />
              </button>
              <span className="eyebrow">
                {book ? "LEARNING BOOK" : project ? "PROJECT WALL" : agent?.harness}
              </span>
              <h2>{book?.title ?? project?.title ?? (agent && agentDisplayName(agent))}</h2>
              {agent && <p className="session-title">{agent.name}</p>}
              {book && <><p>{book.summary}</p>{book.sessionId && !guest && <small>Linked to {agents.find((item) => item.id === book.sessionId)?.name ?? "a session"}</small>}<span className="detail-tag"><BookOpen size={12} /> {openedBooks.length} of {visibleBooks.length} books explored</span></>}
              {project && <><p>A project pinned to this room.</p>{project.url && <a className="detail-link" href={project.url} target="_blank" rel="noreferrer">Open project <ArrowUpRight size={13} /></a>}</>}
              {!book && !project && <>
              {agent && (
                <span className={`agent-behavior ${agent.status}`}>
                  {behavior(agent)}
                </span>
              )}
              {agent && linkedPartner(agent.id) && <small>Recent recorded session link with {linkedPartner(agent.id)!.name}. The play animation shows that link, not message contents.</small>}
              {agent && (
                <small>
                  {agent.status === "working"
                    ? "Session task"
                    : "Last session task"}
                </small>
              )}
              <p>
                {agent?.task ??
                  "No current task reported."}
              </p>
              {agent && (
                  <>
                    <dl>
                      <div>
                        <dt>Status</dt>
                        <dd>{agent.status === "idle" ? "chilling" : agent.status}</dd>
                      </div>
                      <div>
                        <dt>Model</dt>
                        <dd>{agent.model ?? "Not reported"}</dd>
                      </div>
                      {guest?.stats?.agentTotals?.[agent.id] && <><div><dt>Total tokens</dt><dd>{guest.stats.agentTotals[agent.id].totalTokens === null ? "Not reported" : guest.stats.agentTotals[agent.id].totalTokens!.toLocaleString()}</dd></div><div><dt>Spend</dt><dd>{guest.stats.agentTotals[agent.id].totalSpend === null ? "Not reported" : `USD ${guest.stats.agentTotals[agent.id].totalSpend!.toFixed(2)}`}</dd></div></>}
                    </dl>
                    {demoOn ? (
                      <small>Simulated session. Nothing was sent.</small>
                    ) : agent.traceUrl ? (
                      <a className="detail-link" href={agent.traceUrl} target="_blank" rel="noreferrer">Open this session in Neatlogs <ArrowUpRight size={13} /></a>
                    ) : (
                      <button type="button" className="detail-link" onClick={() => navigator.clipboard.writeText(agent.id)}>Copy session id for Neatlogs</button>
                    )}
                    {!demoOn && <small>Workflow trace-office. The office shows who is seated. Neatlogs shows the trace.</small>}
                    <small>
                      Source event {new Date(agent.updatedAt).toLocaleString()}
                    </small>
                    {agent.status === 'offline' && <small>Disconnected {new Date(agent.disconnectedAt ?? agent.updatedAt).toLocaleString()} · hidden after 30 minutes</small>}
                    {!guest && !live.roomId && local.enabled && !demoOn && (
                      <small className="context-note">
                        Live status follows actual session events. Disconnected sources stay unconfirmed.
                      </small>
                    )}
                  </>
              )}
              </>}
            </div>
          )}
          <div className="world-bottom">
            <span className="interaction-hint">
              <MousePointer2 size={13} />
              Drag to orbit · scroll to zoom · right-drag to pan
            </span>
            <div className="world-controls">
              <button
                aria-label={paused ? "Resume office" : "Pause office"}
                title={paused ? "Resume office" : "Pause office"}
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play size={17} /> : <Pause size={17} />}
              </button>
              <button
                aria-label={jevMuted ? "Unmute Jev" : "Mute Jev"}
                title={jevMuted ? "Unmute Jev’s line" : "Mute Jev’s line"}
                aria-pressed={jevMuted}
                onClick={() => {
                  setJevMuted(!isJevMuted());
                  setJevMutedState(isJevMuted());
                }}
              >
                {jevMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
              </button>
              <span />
              <button
                aria-label="Reset camera"
                title="Reset camera"
                onClick={() => setCameraKey((k) => k + 1)}
              >
                <RotateCcw size={17} />
              </button>
              <button
                aria-label={night ? "Switch to daytime" : "Switch to nighttime"}
                title="Change lighting"
                onClick={() => setNight(!night)}
              >
                {night ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              {document.fullscreenEnabled && <button
                aria-label="Toggle fullscreen"
                title="Fullscreen"
                onClick={() => {
                  if (document.fullscreenElement) document.exitFullscreen();
                  else
                    office.current
                      ?.requestFullscreen()
                      .catch(() =>
                        setOfficeError("Fullscreen is unavailable in this browser."),
                      );
                }}
              >
                <Maximize size={17} />
              </button>}
            </div>
            <span className="corner-note">
              TraceOffice the workspace of the future.
            </span>
          </div>
        </section>
      </main>
      <footer>
        <span>
          <span className="footer-dot" />
          {demoOn ? `${roomAgents.length} simulated agents · stays in this browser` : guest ? `${guest.profile.displayName} · shared snapshot` : live.roomId
              ? `${roomAgents.length} agents · live room ${live.state}`
              : local.enabled
                ? `${roomAgents.length} sessions · ${local.state} · checked ${local.observedAt ? new Date(local.observedAt).toLocaleTimeString() : "—"}`
                : `${roomAgents.length} imported agents · snapshot mode`}
        </span>
      </footer>
      {!guest && studioTab && <RoomStudio key={studioTab} initialTab={studioTab} profile={profile} onProfile={setProfile} books={books} onBooks={setBooks} projects={projects} onProjects={setProjects} stats={stats} onStats={setStats} share={share} onShare={setShare} agents={roomAgents} onClose={() => setStudioTab(null)} />}
      {planOpen && !guest && (
        <div className="plan-sheet" role="dialog" aria-label="Business plan">
          <button type="button" className="close" aria-label="Close business plan" onClick={() => setPlanOpen(false)}><X size={16} /></button>
          <p className="eyebrow"><span /> PREPARED FOR CFO.AI</p>
          <h2>Hosted room, {BUSINESS_PLAN.price}</h2>
          <p>{BUSINESS_PLAN.offer}</p>
          <table>
            <thead><tr><th></th><th>Base</th><th>Growth</th></tr></thead>
            <tbody>
              {BUSINESS_PLAN.rows.map((row) => (
                <tr key={row.label}><td>{row.label}</td><td>{row.base}</td><td>{row.growth}</td></tr>
              ))}
            </tbody>
          </table>
          <p>{BUSINESS_PLAN.runwayNote}</p>
          <small>These figures are planning assumptions. Saving them into a live cfo.ai workspace still needs browser sign-in at the cfo.ai MCP connection.</small>
        </div>
      )}
      {projectPicker && !guest && (
        <ProjectPicker
          catalog={local.catalog}
          platform={feedPlatform}
          onToggle={local.toggleProject}
          onClose={() => setProjectPicker(false)}
        />
      )}
      {welcome && !guest && <Welcome live={live} existingCount={roomAgents.length} onExplore={dismissWelcome} onWatchLocal={watchLocal} onSocialImport={() => { dismissWelcome(); setStudioTab("social"); }} onImport={(imported, importedLinks) => {
        addAgents(imported, importedLinks);
        setInteractionClock(Date.now());
        local.disconnect();
        setPaused(false);
        dismissWelcome();
      }} />}

    </div>
  );
}

const PLATFORM_ORDER = ["cursor", "claude", "codex", "grok", "chatgpt"];
const FEED_PREVIEW = 4;

function platformName(id: string) {
  if (id === "cursor") return "Cursor";
  if (id === "claude") return "Claude";
  if (id === "codex") return "Codex";
  if (id === "grok") return "Grok";
  if (id === "chatgpt") return "ChatGPT";
  return id;
}

function platformsIn(catalog: SessionProject[]) {
  const present = new Set(catalog.flatMap((item) => item.platforms ?? []));
  return [
    ...PLATFORM_ORDER.filter((id) => present.has(id)),
    ...[...present].filter((id) => !PLATFORM_ORDER.includes(id)),
  ];
}

function projectsFor(catalog: SessionProject[], platform: string | null, drilled: boolean) {
  const listed = catalog.filter((item) => !drilled || !platform || (item.platforms ?? []).includes(platform));
  return [...listed.filter((item) => item.connected), ...listed.filter((item) => !item.connected)];
}

function ProjectChips({ projects, onToggle }: { projects: SessionProject[]; onToggle: (id: string) => void }) {
  return <div className="project-picks" aria-label="Projects">
    {projects.map((item) => (
      <button key={item.id} type="button" aria-pressed={item.connected} onClick={() => onToggle(item.id)}>
        {item.label} · {item.sessions}
      </button>
    ))}
  </div>;
}

function LocalFeed({
  catalog, platform, onPlatform, onToggle, onShowMore,
}: {
  catalog: SessionProject[];
  platform: string | null;
  onPlatform: (id: string | null) => void;
  onToggle: (id: string) => void;
  onShowMore: () => void;
}) {
  const platforms = platformsIn(catalog);
  const filtering = platforms.length >= 2 && Boolean(platform);
  const projects = projectsFor(catalog, platform, filtering);
  return <>
    {platforms.length >= 2 && <div className="project-picks" aria-label="Platforms">
      <button type="button" aria-pressed={!platform} onClick={() => onPlatform(null)}>All</button>
      {platforms.map((id) => (
        <button key={id} type="button" aria-pressed={platform === id} onClick={() => onPlatform(id)}>{platformName(id)}</button>
      ))}
    </div>}
    <ProjectChips projects={projects.slice(0, FEED_PREVIEW)} onToggle={onToggle} />
    {projects.length > FEED_PREVIEW && <button type="button" className="feed-more" onClick={onShowMore}>Show more</button>}
  </>;
}

function ProjectPicker({
  catalog, platform, onToggle, onClose,
}: {
  catalog: SessionProject[];
  platform: string | null;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const platforms = platformsIn(catalog);
  const projects = projectsFor(catalog, platform, platforms.length >= 2);
  return <div className="modal-backdrop" onClick={onClose}>
    <div className="modal project-picker" role="dialog" aria-label="Choose a project" onClick={(event) => event.stopPropagation()}>
      <button type="button" className="close" aria-label="Close projects" onClick={onClose}><X size={16} /></button>
      <h2>{platform ? platformName(platform) : "Projects"}</h2>
      <p>Pick a project to seat it. Press it again to take it off the floor.</p>
      <ProjectChips projects={projects} onToggle={onToggle} />
    </div>
  </div>;
}
