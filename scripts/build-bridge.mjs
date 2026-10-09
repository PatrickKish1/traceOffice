import { build } from 'esbuild';
await build({ entryPoints: ['scripts/codex-bridge.mjs'], outfile: 'public/agent-bridge.mjs', bundle: true, platform: 'node', format: 'esm', target: 'node22' });
