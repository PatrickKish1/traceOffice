import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentInteraction, OfficeAgent, OfficeSnapshot } from "../../types";
import { parseOfficeSnapshot } from "../../snapshot";

export type LocalSource = "grok" | "index" | "editors";
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

function feedId(feed: FeedSpec) {
  return `${feed.source}:${feed.harness}`;
}

function feedLabel(feed: FeedSpec) {
  if (feed.harness === "cursor") return "Cursor";
  if (feed.harness === "claude") return "Claude";
  if (feed.source === "grok") return "Grok";
  if (feed.source === "index") return "Codex";
  return "Local";
}

function readFeeds(): FeedSpec[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(FEED_STORAGE) ?? "null");
    if (Array.isArray(parsed)) {
      return parsed.filter((feed) => feed && (feed.source === "grok" || feed.source === "index" || feed.source === "editors"));
    }
  } catch { /* Fall through to the older single-feed flag. */ }
  const stored = sessionStorage.getItem("dots-robots-connected");
  if (stored !== "grok" && stored !== "index" && stored !== "editors") return [];
  const harness = sessionStorage.getItem("dots-robots-harness");
  return [{ source: stored, harness: harness === "cursor" || harness === "claude" ? harness : "" }];
}

export function useRobotsSessions(onSnapshot: (snapshot: OfficeSnapshot) => void) {
  const [feeds, setFeeds] = useState<FeedSpec[]>(readFeeds);
  const [state, setState] = useState<"disconnected" | "loading" | "connected" | "error">("disconnected");
  const [error, setError] = useState("");
  const [disconnectedAt, setDisconnectedAt] = useState<string | undefined>();
  const [observedAt, setObservedAt] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [project, setProject] = useState("");
  const receive = useRef(onSnapshot);
  receive.current = onSnapshot;
  const results = useRef(new Map<string, FeedResult>());
  const disconnect = useCallback(() => {
    sessionStorage.removeItem(FEED_STORAGE);
    sessionStorage.removeItem("dots-robots-connected");
    sessionStorage.removeItem("dots-robots-harness");
    results.current.clear();
    setFeeds([]);
    setState("disconnected");
    setError("");
    setObservedAt(null);
    setProject("");
    setTotal(0);
    receive.current({ version: 1, agents: [] });
  }, []);
  const connect = useCallback((next: LocalSource = "grok", nextHarness: LocalHarness = "") => {
    setState("loading");
    setFeeds((current) => {
      const spec = { source: next, harness: nextHarness };
      if (current.some((feed) => feedId(feed) === feedId(spec))) return current;
      return [...current, spec];
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
        names.push(feedLabel(feed));
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
          const response = await fetch(`/api/local-agents?source=${feed.source}${feed.harness ? `&harness=${feed.harness}` : ""}`, {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
            cache: "no-store",
          });
          if (!response.headers.get("content-type")?.includes("application/json")) {
            throw new Error("Live local import is available when running TraceOffice on your computer.");
          }
          const data = await response.json();
          if (!response.ok) throw new Error(data.error ?? "Cannot read local sessions.");
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
  }, [feeds]);
  return {
    connect,
    disconnect,
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
