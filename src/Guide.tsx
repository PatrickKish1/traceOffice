export default function Guide() {
  return <article className="guide">
    <a className="brand" href="/" aria-label="TraceOffice home">trace<span className="wordmark-dot">office</span></a>
    <p className="eyebrow"><span /> HOW TO USE IT</p>
    <h1>Plug an agent in, then watch the floor.</h1>
    <p className="guide-lead">The office is a view of work that already exists somewhere else. An empty room shows four named preview agents, a manager, and Jev walking the desks. Those people are not live sessions.</p>

    <section>
      <h2>What you can do on this computer</h2>
      <ol>
        <li><b>Open the room.</b> http://127.0.0.1:3000 is enough. No key is required.</li>
        <li><b>Choose the people.</b> Room studio → Characters. Pick a character pack and a manager, then Apply to room. Trace, Signal, Patch, Relay, and Jev all swap looks together; names stay the same.</li>
        <li><b>Bring real sessions.</b> Import agents, pick a platform tile, then choose local files or the cloud connect screen. Local is what seats a character. A file touched in the last five minutes sits and works. The preview crew steps aside while that feed is connected.</li>
      </ol>
    </section>

    <section>
      <h2>Grok</h2>
      <p>Watch Grok sessions only works after a Grok session exists for this project. The reader opens <code>~/.grok/sessions</code> and uses <code>summary.json</code> and <code>signals.json</code>. It does not open the chat. This computer has no Grok session folder yet, so the button reports that none were found. Start a session in this project, or point <code>TRACE_SESSION_CWD</code> at the folder that has one.</p>
    </section>

    <section>
      <h2>The Cursor key on the Neatlogs screen</h2>
      <p>Settings → Integrations → Cursor asks for an <code>api_key</code>. That box wants a <b>Cursor</b> key, not the Neatlogs ingest key already in <code>.env</code>.</p>
      <p>Create it in the Cursor dashboard: open <a href="https://cursor.com/dashboard">cursor.com/dashboard</a>, then API Keys. If a general dashboard key is rejected when Neatlogs tries to start an agent, use the key under Cloud Agents → My Settings → API Keys. That second key is the one that can launch a cloud agent.</p>
      <p>Neatlogs uses it for code-fix workflows. A fix suggestion can be sent to a Cursor cloud agent, which opens a pull request. GitHub has to be connected in Neatlogs first, because the agent needs a repository. This does not read the Cursor chats on your computer, and it does not put those agents on the office floor.</p>
      <p>The other direction uses the Neatlogs project key. Cursor can call Neatlogs over MCP with <code>Authorization: Bearer</code> set to <code>NEATLOGS_API_KEY</code>, against <code>https://ingest.neatlogs.com/mcp</code>. That lets Cursor search traces. It is a different key from the one you paste into Connect Cursor.</p>
    </section>

    <section>
      <h2>Neatlogs</h2>
      <p>TraceOffice is not a second Neatlogs. Neatlogs stores traces and already has the coding-agent Connect buttons for Claude Code, Codex, and Cursor. This office does not call those APIs. The ingest key in <code>.env</code> can send traces in. It cannot list them back out, and nothing in the 3D room reads the Neatlogs trace list. The floor only shows sessions this app reads locally, or a snapshot you import.</p>
      <p>Cloud in Import agents opens <a href="https://app.neatlogs.com/settings/account/coding-agents">Neatlogs coding agents</a> so you approve the tool there. That approval does not copy cloud agents onto the floor yet. Local watch is the path that does.</p>
    </section>

    <section>
      <h2>Jev and the manager</h2>
      <p>Jev does not patrol the preview row. He waits in the aisle until a <b>new</b> agent appears in your roster, walks to that desk for a hand-off, runs the local rule check (<code>src/jev/triage.ts</code>), then returns to wait. Trace, Signal, Patch, and Relay are decorative until you import real sessions. Mute his line with the speaker control next to Pause office.</p>
      <p>For messy natural language (optional, not every frame), this repo wires <a href="https://github.com/sgoedecke/system-one">system-one</a> behind <code>POST /api/jev/triage</code>. Install <code>pip install system-one typesafe-sdk torch transformers</code>, set <code>JEV_SYSTEM_ONE=1</code>, and run <code>scripts/jev-system-one-triage.py</code>. OpenJev is not used. The 3D view always keeps the rule engine so it stays smooth.</p>
      <p>The manager, Mara, Nils, or Ada, stands off the row and is the person the crew reports to for Neatlogs review. Mara is not wired to the dashboard yet.</p>
    </section>

    <p><a href="/">Back to the office</a></p>
  </article>;
}
