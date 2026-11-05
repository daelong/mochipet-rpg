import { readdir, readFile, cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const assetRoot = fileURLToPath(new URL('../assets/', import.meta.url));
export async function checkAssets() {
  const pets = await readdir(path.join(assetRoot, 'pets'));
  let count = 0;
  for (const id of pets) {
    if (!/^(z_[a-z]+|m_[A-Z]{4})$/.test(id)) continue;
    for (const action of ['idle', 'walk', 'play', 'eat', 'happy', 'sad', 'sleep']) {
      for (let frame = 0; frame < 2; frame++) { await readFile(path.join(assetRoot, 'pets', id, `${action}_${frame}_right.png`)); count++; }
    }
  }
  if (count !== 392) throw new Error(`Expected 392 pet frames, found ${count}`);
  for (const id of ['slime', 'mushroom', 'bat', 'foxfire', 'golem', 'shade', 'ghost', 'moon']) await readFile(path.join(assetRoot, 'monsters', `${id}.png`));
}
export function copyAssetsPlugin() {
  let outDir;
  return {
    name: 'mochi-local-assets',
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    configureServer(server) {
      server.middlewares.use('/game-assets', async (req, res, next) => {
        try {
          const raw = decodeURIComponent((req.url ?? '').split('?')[0]);
          if (!/^\/(pets\/(z_[a-z]+|m_[A-Z]{4})\/(idle|walk|play|eat|happy|sad|sleep)_[01]_right|monsters\/[a-z]+)\.png$/.test(raw)) return next();
          const bytes = await readFile(path.join(assetRoot, raw));
          res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'public, max-age=3600'); res.end(bytes);
        } catch { res.statusCode = 404; res.end('Asset not found'); }
      });
    },
    async closeBundle() { await checkAssets(); await mkdir(outDir, {recursive: true}); await cp(assetRoot, path.join(outDir, 'game-assets'), {recursive: true}); }
  };
}
if (process.argv.includes('--check')) { await checkAssets(); console.log('Asset paths verified: 392 pet frames + 8 monsters'); }
