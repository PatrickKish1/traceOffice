import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { localCodexPlugin } from "./server/codex-sessions.mjs";
import { jevBridgePlugin } from "./server/jev-bridge.mjs";
export default defineConfig({
  plugins: [react(), localCodexPlugin(), jevBridgePlugin()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { proxy: { '/api/live': { target: 'http://127.0.0.1:8787', ws: true } } },
});
