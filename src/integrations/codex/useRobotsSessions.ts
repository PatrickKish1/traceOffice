import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentInteraction, OfficeAgent, OfficeSnapshot } from "../../types";
import { parseOfficeSnapshot } from "../../snapshot";

export type LocalSource = "grok" | "index" | "editors" | "discover";
export type LocalHarness = "" | "cursor" | "claude";

interface FeedSpec {
  source: LocalSource;
  harness: LocalHarness;
}

interface FeedResult {
  agents: OfficeAgent[];
  interactions: AgentInteraction[];
  state: "loading" | "connected" | "error";
  error: string;
  project: string;
  total: number;
  observedAt: string | null;
}

const FEED_STORAGE = "dots-robots-feeds-v1";
const DISCOVERY_PAUSE = "dots-discovery-paused";
const PROJECT_STORAGE = "dots-discovery-projects-v1";

export interface SessionProject {
  id: string;
  label: string;
  sessions: number;
  current: boolean;
  connected: boolean;
  platforms: string[];
}

function feedId(feed: FeedSpec) {
  return `${feed.source}:${feed.harness}`;
}

function feedLabel(feed: FeedSpec) {
  if (feed.harness === "cursor") return "Cursor";
  if (feed.harness === "claude") return "Claude";
  if (feed.source === "grok") return "Grok";
  if (feed.source === "index") return "Codex";
  if (feed.source === "discover") return "Discovery";
  return "Local";
}

function isSource(value: unknown): value is LocalSource {
  return value === "grok" || value === "index" || value === "editors" || value === "discover";
}

function readFeeds(): FeedSpec[] {
  try {
    if (sessionStorage.getItem(DISCOVERY_PAUSE) === "1") return [];
    const parsed = JSON.parse(sessionStorage.getItem(FEED_STORAGE) ?? "null");
    if (Array.isArray(parsed)) {
      const feeds = parsed.filter((feed) => feed && isSource(feed.source));
      if (feeds.length) return feeds;
    }
  } catch { /* Fall through to the older single-feed flag. */ }
  const stored = sessionStorage.getItem("dots-robots-connected");
  if (stored === "grok" || stored === "index" || stored === "editors") {
    const harness = sessionStorage.getItem("dots-robots-harness");
    return [{ source: stored, harness: harness === "cursor" || harness === "claude" ? harness : "" }];
  }
  return [{ source: "discover", harness: "" }];
}

function readProjectIds(): string[] | null {
  try {
    const raw = sessionStorage.getItem(PROJECT_STORAGE);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id) => typeof id === "string").slice(0, 4);
  } catch {
    return null;
  }
}

export function useRobotsSessions(onSnapshot: (snapshot: OfficeSnapshot) => void) {
  const [feeds, setFeeds] = useState<FeedSpec[]>(readFeeds);
  const [state, setState] = useState<"disconnected" | "loading" | "connected" | "error">("disconnected");
  const [error, setError] = useState("");
  const [disconnectedAt, setDisconnectedAt] = useState<string | undefined>();
  const [observedAt, setObservedAt] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [project, setProject] = useState("");
  const [projectIds, setProjectIds] = useState<string[] | null>(readProjectIds);
  const [catalog, setCatalog] = useState<SessionProject[]>([]);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const receive = useRef(onSnapshot);
  receive.current = onSnapshot;
  const results = useRef(new Map<string, FeedResult>());
  const disconnect = useCallback(() => {
    sessionStorage.setItem(DISCOVERY_PAUSE, "1");
    sessionStorage.removeItem(FEED_STORAGE);
    sessionStorage.removeItem("dots-robots-connected");
    sessionStorage.removeItem("dots-robots-harness");
    sessionStorage.removeItem(PROJECT_STORAGE);
    results.current.clear();
    setFeeds([]);
    setProjectIds(null);
    setCatalog([]);
    setState("disconnected");
    setError("");
    setObservedAt(null);
    setProject("");
    setTotal(0);
    receive.current({ version: 1, agents: [] });
  }, []);
  const connect = useCallback((next: LocalSource = "grok", nextHarness: LocalHarness = "") => {
    setState("loading");
    sessionStorage.removeItem(DISCOVERY_PAUSE);
    setFeeds((current) => {
      const spec = { source: next, harness: nextHarness };
      const base = next === "discover" ? [] : current.filter((feed) => feed.source !== "discover");
      if (base.some((feed) => feedId(feed) === feedId(spec))) return base;
      return [...base, spec];
    });
  }, []);
  const toggleProject = useCallback((id: string) => {
    setProjectIds((current) => {
      const known = catalogRef.current.find((item) => item.current)?.id;
      const base = current ?? (known ? [known] : []);
      const next = base.includes(id) ? base.filter((item) => item !== id) : base.length >= 4 ? base : [...base, id];
      sessionStorage.setItem(PROJECT_STORAGE, JSON.stringify(next));
      return next;
    });
  }, []);
  useEffect(() => {
    if (!feeds.length) return;
    sessionStorage.setItem(FEED_STORAGE, JSON.stringify(feeds));
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    function publish() {
      const agents: OfficeAgent[] = [];
      const interactions: AgentInteraction[] = [];
      let anyConnected = false;
      let allError = true;
      let latest: string | null = null;
      let count = 0;
      const names: string[] = [];
      const problems: string[] = [];
      for (const feed of feeds) {
        const result = results.current.get(feedId(feed));
        names.push(result?.project || feedLabel(feed));
        if (!result) {
          allError = false;
          continue;
        }
        agents.push(...result.agents);
        interactions.push(...result.interactions);
        count += result.total;
        if (result.observedAt && (!latest || result.observedAt > latest)) latest = result.observedAt;
        if (result.state === "connected") {
          anyConnected = true;
          allError = false;
        } else if (result.state === "loading") allError = false;
        else if (result.error) problems.push(result.error);
      }
      receive.current({ version: 1, agents, interactions });
      setTotal(count);
      setProject(names.join(" · "));
      setObservedAt(latest);
      setError(problems[0] ?? "");
      if (anyConnected) {
        setState("connected");
        setDisconnectedAt(undefined);
      } else if (allError && problems.length) {
        setState("error");
        setDisconnectedAt((previous) => previous ?? new Date().toISOString());
      } else setState("loading");
    }
    async function refresh() {
      await Promise.all(feeds.map(async (feed) => {
        const id = feedId(feed);
        try {
          const projectQuery = feed.source === "discover" && projectIds ? `&projects=${encodeURIComponent(projectIds.join(","))}` : "";
          const response = await fetch(`/api/local-agents?source=${feed.source}${feed.harness ? `&harness=${feed.harness}` : ""}${projectQuery}`, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(feed.source === "discover" ? 15000 : 5000)]),
            cache: "no-store",
          });
          if (!response.headers.get("content-type")?.includes("application/json")) {
            throw new Error("Live local import is available when running TraceOffice on your computer.");
          }
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Cannot read local sessions.");
          if (Array.isArray(data.projects)) {
            setCatalog(data.projects.filter((item: SessionProject) => item && typeof item.id === "string" && typeof item.label === "string"));
          }
          const snapshot = parseOfficeSnapshot(JSON.stringify(data));
          snapshot.agents.sort((a, b) => a.id.localeCompare(b.id));
          results.current.set(id, {
            agents: snapshot.agents,
            interactions: snapshot.interactions ?? [],
            state: "connected",
            error: "",
            project: typeof data.project === "string" ? data.project : "",
            total: typeof data.total === "number" ? data.total : snapshot.agents.length,
            observedAt: typeof data.observedAt === "string" ? data.observedAt : null,
          });
        } catch (e) {
          if (cancelled) return;
          const previous = results.current.get(id);
          results.current.set(id, {
            agents: previous?.agents ?? [],
            interactions: previous?.interactions ?? [],
            state: "error",
            error: e instanceof Error ? e.message : "Connection lost.",
            project: previous?.project ?? "",
            total: previous?.total ?? 0,
            observedAt: previous?.observedAt ?? null,
          });
        }
      }));
      if (cancelled) return;
      publish();
      timer = setTimeout(refresh, 5000);
    }
    refresh();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [feeds, projectIds]);
  return {
    connect,
    disconnect,
    toggleProject,
    catalog,
    state,
    error,
    disconnectedAt,
    observedAt,
    total,
    project,
    source: feeds[0]?.source ?? "index",
    enabled: feeds.length > 0,
  };
}
