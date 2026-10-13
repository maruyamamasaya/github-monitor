const fs = require('node:fs/promises');
const path = require('node:path');
const names = ['commits.json', 'commits-all-branches.json', 'source-size.json'];

function validate(name, value) {
  if (!names.includes(name) || !value || value.version !== 1 || typeof value.repositories !== 'object' || !value.repositories || Array.isArray(value.repositories)) throw new Error('Unsupported data');
  if (name === 'source-size.json') {
    if (!value.blobs || typeof value.blobs !== 'object') throw new Error('Invalid source-size data');
  } else {
    for (const repository of Object.values(value.repositories)) {
      if (!repository || !repository.commits || typeof repository.commits !== 'object') throw new Error('Invalid commit data');
      for (const commit of Object.values(repository.commits)) {
        if (!commit || typeof commit.sha !== 'string' || typeof commit.authoredAt !== 'string' || typeof commit.repository !== 'string') throw new Error('Invalid commit');
      }
    }
  }
  return value;
}
async function exportData(directory) {
  const files = {};
  for (const name of names) {
    try { files[name] = validate(name, JSON.parse(await fs.readFile(path.join(directory, name), 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { format: 'github-monitor-transfer', version: 1, files };
}
async function importData(directory, bundle) {
  if (bundle?.format !== 'github-monitor-transfer' || bundle.version !== 1 || !bundle.files || !Object.keys(bundle.files).length) throw new Error('Invalid transfer');
  const entries = Object.entries(bundle.files);
  for (const [name, value] of entries) validate(name, value);
  // Never replace a device's newer sync state with an older snapshot.
  for (const name of names) {
    try { await fs.access(path.join(directory, name)); throw new Error('Data already exists. Import into a new app before syncing.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await fs.mkdir(directory, { recursive: true });
  for (const [name, value] of entries) await fs.writeFile(path.join(directory, name), JSON.stringify(value), { flag: 'wx', mode: 0o600 });
}
module.exports = { exportData, importData, validate };
