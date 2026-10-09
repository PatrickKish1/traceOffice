# TraceOffice

A dark 3D office where agent runs become characters. Working agents sit at desks. Finished, interrupted, or disconnected agents move to the lounge. Click one to see the status, model, and task that the source actually reported.

TraceOffice is a spatial view for debugging agent work: you see who is working, who failed, and who handed work to someone else. It does not replace a trace viewer. Deep inspection still belongs in the tool that recorded the run.

## Run it

Node.js 22.13 or newer:

```sh
npm install
npm run dev:relay
```

In another terminal, run `npm run dev`, then open http://127.0.0.1:3000. The page proxies the live room relay to port 8787. `npm test` checks snapshots, rooms, session reads, and character variants.

## Bring agents in

On this computer, **Import agents** can watch two local sources. Neither one uploads prompts, reasoning, tool output, or file contents.

- **Cursor and Claude Code** read session file names and modification times under `~/.cursor/projects` and `~/.claude/projects` for this folder. Transcripts are not opened. A file touched in the last five minutes is shown as working at a desk. The preview crew hides while those sessions are connected.
- **Grok sessions** read `~/.grok/sessions` (or `GROK_HOME`) for the current project. Only `summary.json` and `signals.json` are opened. A session touched in the last five minutes is shown as working. Set `TRACE_SESSION_CWD` if the project folder should not be the directory you started the app from.
- **Other local sessions** read the session index already on this machine. That path is loopback-only and is not part of the public worker. Set `DOTS_SESSION_CWD` if it picks the wrong folder.
- **Snapshot file** accepts a version 1 JSON file up to 2 MB. A file is a recording. Working status from a file is shown as unconfirmed.
- **Live room** lets other people watch selected session metadata for 24 hours. Copy the prompt into the agent that can see the sessions, choose the ids, and leave the bridge terminal open.

The bridge checks for changes about every three seconds and sends a small heartbeat when nothing changed. A bridge that stops reporting becomes disconnected after 20 seconds. Those agents leave the room and the roster after 30 minutes. **Disconnect my agents** removes only your contribution.

Room links are private capabilities. There is no account login. The name above a character is the name that person typed.

## What the office shows

Each agent id grows a character from the cast chosen in Room studio → Characters. Desk crew, field team, and signal unit are different bodies. The same id stays stable inside one cast. Error and blocked agents get a ring on the floor. An empty office shows Trace, Signal, Patch, and Relay at their own desks. They report to the manager you picked: Mara, Nils, or Ada. Jev waits in the aisle and walks over when a new agent joins. Those people are a preview. They are not sessions and they are not counted.

Open `/guides` for what can be connected today.

## Environment

Nothing is required to open the office. Optional variables:

- `GROK_HOME` — Grok session folder. Default is `~/.grok`.
- `TRACE_SESSION_CWD` or `DOTS_SESSION_CWD` — project folder for local session reads. Default is the directory you started the app from.
- `DOTS_ROOM_UPLOAD_TOKEN` — set only in the bridge process. The live room gives you this value. Do not commit it.
- `VITE_LIVE_API_URL` — worker origin, only when the page and the relay are on different hosts.
- `ALLOWED_ORIGIN` — site allowed to call the relay, set in `wrangler.jsonc` before deploy.
- `NEATLOGS_API_KEY` — ingest key for an app that calls a model. TraceOffice does not call a model, and an ingest key cannot list traces. Reading runs into the office needs a separate `NEATLOGS_TOKEN` plus `NEATLOGS_PROJECT_ID`.

Keep secrets in `.env`. That file is gitignored.

Furniture and characters are drawn in the scene. No external model pack is required.

## What Neatlogs is

Neatlogs is the trace store. It is not this office, and connecting Cursor inside Neatlogs does not seat a character here.

- **Ingest.** An app or agent sends spans (a run, a tool call, a failure) to `https://ingest.neatlogs.com` with `NEATLOGS_API_KEY`. `npm run neatlogs:send` is a local probe that does only that. The ingest key cannot list traces back out.
- **Investigate.** The Neatlogs dashboard is where you open a trace, a span, and a detection. Reading that list into this app needs `NEATLOGS_TOKEN` and `NEATLOGS_PROJECT_ID`. Those are not wired to the floor yet.
- **Coding agents.** Neatlogs Settings → Coding agents can approve Claude Code, Codex, or Cursor so Neatlogs can launch a cloud agent. That approval stays in Neatlogs.

The floor today is driven by local session files: Cursor, Claude Code, Codex, and Grok. Each platform is its own stacked floor. A file touched in the last five minutes sits and works. Click a character for the status that file reported.

## Direction

The office stays the control room. The next slice is to drive those same characters from Neatlogs traces, and to open the real trace when you click one. Local file watch remains the path that works without a token.

- Pull recent traces and map each agent run onto a desk.
- Failure and recovery change the character (red ring, hand-off) from the trace, not from a guessed animation.
- Click → side panel plus a link into the Neatlogs trace.
- A thin orchestrator can forward one prompt to a registered agent. It does not replace Cursor, Claude, Codex, or Grok.

## Deploy

```sh
npm run build
npx wrangler deploy
```

`wrangler.jsonc` serves the built page and a SQLite Durable Object per room. No API keys are deployed. Set `ALLOWED_ORIGIN` to the site that should call the relay. For a split frontend, build with `VITE_LIVE_API_URL` set to the worker origin.

Rooms allow 50 agents and 100 viewers, then delete their data after 24 hours. Those are product limits, not a load test. Use a paid Cloudflare plan before a public launch, and add room-creation limits before sharing the link widely.
