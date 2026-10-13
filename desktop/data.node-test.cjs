const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { exportData, importData } = require('./data.cjs');

test('transfer preserves commit details, authors, progress and both branch scopes without secrets', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'github-monitor-transfer-'));
  try {
    const original = path.join(root, 'old');
    await fs.mkdir(original);
    const cache = { version: 1, authors: ['alice'], repositories: { 'alice/repo': { commits: { abc: { sha: 'abc', repository: 'alice/repo', authoredAt: '2026-10-01T00:00:00Z', files: [] } }, partial: true, branchHeads: { abc: { since: '2026-07-01', items: [] } }, lastSyncedAt: '2026-10-01' } } };
    for (const name of ['commits.json', 'commits-all-branches.json']) await fs.writeFile(path.join(original, name), JSON.stringify(cache));
    await fs.writeFile(path.join(original, '.env.local'), 'GITHUB_TOKEN=secret');
    const bundle = await exportData(original);
    assert.equal(JSON.stringify(bundle).includes('secret'), false);
    const target = path.join(root, 'new');
    await importData(target, bundle);
    assert.deepEqual(await exportData(target), bundle);
    await assert.rejects(importData(target, bundle), /already exists/);
    assert.deepEqual(await exportData(target), bundle);
    await assert.rejects(importData(path.join(root, 'unsafe'), { ...bundle, files: { '../escape': cache } }), /Unsupported/);
    await assert.rejects(importData(path.join(root, 'invalid'), { ...bundle, files: { 'commits.json': { version: 1, repositories: { bad: {} } } } }), /Invalid/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
