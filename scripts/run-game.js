import { access, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readLeaderboard } from './leaderboard-store.js';
import { distPath, startStaticServer } from './static-server.js';

try {
  const { values } = parseArgs({ options: { 'export-leaderboard': { type: 'string' }, port: { type: 'string' } } });
  if ('export-leaderboard' in values) {
    const leaderboard = await readLeaderboard();
    await writeFile(values['export-leaderboard'], JSON.stringify(leaderboard, null, 2) + '\n');
  } else {
    const port = Number(values.port ?? 4173);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
    await access(join(distPath, 'index.html')).catch(() => { throw new Error('Build the game first with npm run build'); });
    const { url } = await startStaticServer({ port, useLeaderboard: true });
    console.log('Đảo Đèn Lồng · ' + url);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
