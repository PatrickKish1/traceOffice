/** Trimmed clip served from `public/nameisjev.mp3` (source trimmed at 6.9s). */
const JEV_CLIP_URL = "/nameisjev.mp3";
const MUTE_STORAGE_KEY = "traceoffice-jev-muted";

let clip: HTMLAudioElement | null = null;
let warmed = false;
let lastHoverAt = 0;
let lastDeskAt = 0;
let muted = false;

function readStoredMute() {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
}

muted = readStoredMute();

function clipElement() {
  if (!clip) {
    clip = new Audio(JEV_CLIP_URL);
    clip.preload = "auto";
  }
  return clip;
}

export function isJevMuted() {
  return muted;
}

export function setJevMuted(value: boolean) {
  muted = value;
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(MUTE_STORAGE_KEY, value ? "1" : "0");
  }
  if (value) stopJevClip();
}

export function toggleJevMuted() {
  setJevMuted(!muted);
  return muted;
}

export function stopJevClip() {
  const audio = clip;
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
}

/** Load the clip once; safe to call from idle time or after first user gesture. */
export function warmJevClip() {
  if (warmed) return;
  warmed = true;
  clipElement().load();
}

function startClip(force: boolean) {
  if (muted) return;
  if (typeof document !== "undefined" && document.hidden) return;
  const audio = clipElement();
  if (!force && !audio.paused) return;
  audio.currentTime = 0;
  void audio.play().catch(() => {
    /* autoplay policy until the user has clicked the page */
  });
}

/** Hover / manual replay from the 3D hit area. */
export function playJevClip(options?: { restart?: boolean }) {
  if (muted) return;
  const force = options?.restart ?? false;
  const now = performance.now();
  if (!force && now - lastHoverAt < 1200) return;
  lastHoverAt = now;
  startClip(force);
}

/** Fires when Jev is standing at a showcase desk; throttled so the walk loop stays cheap. */
export function playJevClipAtDesk() {
  if (muted) return;
  const now = performance.now();
  if (now - lastDeskAt < 800) return;
  lastDeskAt = now;
  startClip(true);
}
