const fs = require('node:fs/promises');
const path = require('node:path');
async function prepare() {
  const target = path.join(__dirname, 'server');
  if (path.resolve(target) !== path.resolve(process.cwd(), 'desktop/server')) throw new Error('Unexpected output directory');
  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(target, { recursive: true });
  await fs.cp('.next/standalone', target, { recursive: true, filter: source => !/(^|[\\/])(?:\.env[^\\/]*|cache|data-transfer)(?:[\\/]|$)/.test(source) });
  await fs.cp('.next/static', path.join(target, '.next/static'), { recursive: true });
  try { await fs.cp('public', path.join(target, 'public'), { recursive: true }); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
prepare().catch(() => { console.error('Desktop server preparation failed.'); process.exitCode = 1; });
