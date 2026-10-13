const fs = require('node:fs/promises');
const path = require('node:path');
const { exportData } = require('./data.cjs');
async function run() {
  const bundle = await exportData(path.join(process.cwd(), '.next/cache/github-monitor'));
  if (!Object.keys(bundle.files).length) throw new Error('No cached data');
  await fs.mkdir('data-transfer', { recursive: true });
  await fs.writeFile('data-transfer/github-monitor-data.json', JSON.stringify(bundle), { mode: 0o600 });
  console.log('Saved data-transfer/github-monitor-data.json (no token).');
}
run().catch(() => { console.error('Data export failed.'); process.exitCode = 1; });
