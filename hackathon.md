# neatHack build log

## Project

TraceOffice is a local control room for coding agents. It seats Cursor, Claude Code, Codex, and Grok sessions on separate floors so you can see who is working across platforms, and across more than one project. Neatlogs is the observability layer: each discovered session is reported there. The office does not replace the dashboard.

Problem: people run several coding agents in several repos and have no single place to see which session is active, which project it belongs to, or what tools it used.

## Team

Patrick. Publish only this name unless a teammate asks to be listed.

## Stack

- TraceOffice: React, Vite, the local session readers in `server/`
- neatlogs: ingest API, project key `NEATLOGS_API_KEY`, workflow `trace-office`
- Entire: CLI 0.11.4, enabled in this repo for Cursor. Settings are in `.entire/settings.json`. Hooks are in `.cursor/hooks.json`. A checkpoint is written on the next commit, not before.
- cfo.ai: business plan in `evidence/cfo-business-plan.md`, MCP server `https://api.cfo.ai/mcp` in `.cursor/mcp.json`. A live cfo.ai workspace still needs browser sign-in.

## Build log

### 2026-10-10

Completed: discovery already reported two quiet Cursor sessions for this repo to Neatlogs as `cursor-session` spans. Each span has the session id, platform, status, and tool-name counts. Prompt text is not included. The dev server now reads `NEATLOGS_API_KEY` from `.env`.

Completed: projects are connections. The office still opens on the folder it was started in. The sidebar lists other local Cursor and Claude projects. Connecting one adds its sessions. A second project splits platform floors, so Cursor in repo A is not the Cursor floor of repo B. At most four projects are loaded at once.

Completed: a session whose last recorded turn ended in error is shown as `error`. The next Neatlogs span for that session sets `recovered` when the status leaves error or blocked. That is the before/after signal for a fix. A failed turn has not been observed in the two current Cursor sessions, so there is no failure trace to compare yet.

Completed: Entire CLI 0.11.4 is installed and `entire enable --yes --agent cursor` configured this repository. `entire status` reports enabled on `main` for the Cursor agent. No checkpoint id exists yet, because Entire writes one when a commit is made.

Completed: the floor agent reads who is seated and points at a failed session. Run recovery check sends an error span and then a recovered span for `office:recovery-drill`, and seats that agent. A character with a trace id links to `https://app.neatlogs.com/traces/{id}`. The business plan is in the office under Business plan.

Not completed: cfo.ai is not signed in, so that plan is not inside a live workspace. The recovery sends on 2026-10-10 19:46 UTC did not reach Neatlogs because Node saw a certificate for `ingest.neatlogs.com` that does not match the host. Earlier sends the same day did complete. When a trace id is missing, the session panel copies the session id to search workflow `trace-office`.

Tests run: `npm test` — 87 passed.

## Demo

Local: http://127.0.0.1:3000/ after `pnpm dev`. Open the sidebar project chips to connect a second repo. Guide: http://127.0.0.1:3000/guides. Neatlogs dashboard: workflow `trace-office`.

## Known limitations

- Cursor traces are session summaries (tool names and counts), not a full hook tree. Claude's full tree needs `npx @neatlogs/claude-code setup --global`.
- The office does not send prompts. Sessions start in Cursor or Claude Code.
- Project labels are taken from the local session-folder name, so they can look abbreviated.
- Entire is enabled, but a checkpoint id appears only after a commit.
- cfo.ai still needs browser sign-in before the plan lives in a workspace.

## Submission

Required: neatlogs traces, Entire checkpoints or entire-graph output, and a cfo.ai business plan covering pricing, costs, revenue, and runway.

Outstanding: make a commit so Entire writes a checkpoint id; sign in to cfo.ai and save the plan from `evidence/cfo-business-plan.md`; record one failing session and the recovered Neatlogs span.
