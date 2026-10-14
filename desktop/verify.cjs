const fs = require('node:fs');
const path = require('node:path');
let token = '';
try {
  const line = fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).find(line => /^GITHUB_TOKEN=/.test(line));
  token = line?.slice(line.indexOf('=') + 1).trim().replace(/^(['"])(.*)\1$/, '$2') || '';
} catch (error) { if (error.code !== 'ENOENT') throw error; }
function check(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) check(file);
    else {
      if (/^\.env/.test(entry.name) || ['commits.json', 'commits-all-branches.json', 'source-size.json', 'github-monitor-data.json'].includes(entry.name)) throw new Error('Personal file included in server');
      if (token.length > 10 && fs.readFileSync(file).includes(Buffer.from(token))) throw new Error('Secret included in server');
    }
  }
}
const serverDirectory = path.resolve(process.argv[2] || path.join(__dirname, 'server'));
for (const dependency of ['next', 'react', 'react-dom']) {
  const resolved = require.resolve(dependency, { paths: [serverDirectory] });
  if (!resolved.startsWith(serverDirectory + path.sep)) throw new Error('Server dependency missing from distribution: ' + dependency);
}
check(serverDirectory);
console.log('Desktop server verified: no environment files, personal cache, or configured token.');
