import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Start a headless Vite SSR module loader for web TypeScript/TSX modules under test. */
export async function openWebModules() {
  const server = await createServer({
    configFile: false,
    root: path.join(ROOT, 'web'),
    resolve: { alias: { '@': path.join(ROOT, 'web/src') } },
    server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true },
    appType: 'custom',
  });
  return {
    load: (specifier) => server.ssrLoadModule(specifier),
    close: () => server.close(),
  };
}
