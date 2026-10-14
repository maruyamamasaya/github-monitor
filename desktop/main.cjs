const { app, BrowserWindow, Menu, dialog, shell, safeStorage, utilityProcess } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const net = require('node:net');
const os = require('node:os');
const fsSync = require('node:fs');
const { exportData, importData } = require('./data.cjs');
app.setName('GitHub Monitor');
const smoke = process.argv.includes('--smoke-test');
// A fresh profile outside the checkout prevents missing packaged dependencies
// from being supplied by an earlier build or the repository's node_modules.
if (smoke) app.setPath('userData', fsSync.mkdtempSync(path.join(os.tmpdir(), 'github-monitor-smoke-')));

let window;
let server;
let origin;
let busy = false;
let quitting = false;
const keys = ['GITHUB_TOKEN', 'GITHUB_USERNAME', 'GITHUB_AUTHORS', 'GITHUB_EXCLUDED_REPOS', 'GITHUB_INCLUDE_ARCHIVED', 'GITHUB_INCLUDE_FORKS'];
const dataDirectory = () => path.join(app.getPath('userData'), 'data');
const configFile = () => path.join(app.getPath('userData'), 'connection.bin');

async function configuration() {
  try { return JSON.parse(safeStorage.decryptString(await fs.readFile(configFile()))); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw new Error('Connection settings could not be decrypted.'); }
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); });
  });
}
async function stopServer() {
  const child = server;
  server = undefined;
  if (child) await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
}
async function startServer() {
  const config = await configuration();
  const source = app.isPackaged ? path.join(process.resourcesPath, 'server') : path.join(__dirname, 'server');
  // Next's runtime cache must also be writable, even under Program Files / Applications.
  const runtime = path.join(app.getPath('userData'), 'runtime', app.getVersion());
  await fs.mkdir(runtime, { recursive: true });
  await fs.cp(source, runtime, { recursive: true });
  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env };
  for (const key of keys) delete env[key];
  const child = utilityProcess.fork(path.join(__dirname, 'server-worker.cjs'), [], {
    cwd: runtime,
    env: { ...env, ...config, NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: String(port), GITHUB_MONITOR_DATA_DIR: dataDirectory(), GITHUB_MONITOR_SERVER_ENTRY: path.join(runtime, 'server.js') },
    stdio: 'ignore',
  });
  server = child;
  let exited = false;
  child.once('exit', () => {
    exited = true;
    if (server === child) {
      server = undefined;
      if (!quitting) dialog.showErrorBox('GitHub Monitor', 'アプリ内サーバーが停止しました。アプリを再起動してください。');
    }
  });
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && !exited) {
    try {
      // Probe a static asset: startup and data import do not trigger GitHub requests.
      const response = await fetch(`${origin}/icon.svg`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Wait for the local listener. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  await stopServer();
  throw new Error('Local server startup failed');
}
async function perform(task) {
  if (busy) return;
  busy = true;
  try { await task(); }
  catch { dialog.showErrorBox('GitHub Monitor', '操作を完了できませんでした。データの形式・保存先・接続設定を確認してください。既存データがある場合、取り込みはできません。'); }
  finally { busy = false; }
}
async function importConnection() {
  const result = await dialog.showOpenDialog(window, { title: '接続設定用の .env.local を選択', properties: ['openFile', 'showHiddenFiles'] });
  if (result.canceled) return;
  const text = await fs.readFile(result.filePaths[0], 'utf8');
  const config = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(GITHUB_[A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (match && keys.includes(match[1])) config[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  if (!config.GITHUB_TOKEN || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(config.GITHUB_USERNAME || '') || !safeStorage.isEncryptionAvailable()) throw new Error('Invalid connection settings');
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(configFile(), safeStorage.encryptString(JSON.stringify(config)), { mode: 0o600 });
  await stopServer();
  await startServer();
  await window.loadURL(`${origin}/data`);
  await dialog.showMessageBox(window, { message: '接続設定を保存しました。取得済みデータを取り込んでから、メニューの「Dashboard」を開いてください。' });
}
async function importSnapshot() {
  const result = await dialog.showOpenDialog(window, { title: '取得済みデータを取り込む', filters: [{ name: 'GitHub Monitor data', extensions: ['json'] }], properties: ['openFile'] });
  if (result.canceled) return;
  const bundle = JSON.parse(await fs.readFile(result.filePaths[0], 'utf8'));
  await window.loadURL('about:blank');
  await stopServer();
  try { await importData(dataDirectory(), bundle); }
  finally { await startServer(); await window.loadURL(`${origin}/data`); }
}
async function exportSnapshot() {
  const result = await dialog.showSaveDialog(window, { defaultPath: 'github-monitor-data.json', filters: [{ name: 'GitHub Monitor data', extensions: ['json'] }] });
  if (result.canceled) return;
  const bundle = await exportData(dataDirectory());
  await fs.writeFile(result.filePath, JSON.stringify(bundle), { mode: 0o600 });
}
function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'GitHub Monitor', submenu: [
      { label: 'Dashboard', click: () => perform(() => window.loadURL(origin)) },
      { label: '取得済みデータ', click: () => perform(() => window.loadURL(`${origin}/data`)) },
      { type: 'separator' },
      { label: '接続設定を読み込む (.env.local)', click: () => perform(importConnection) },
      { label: '取得済みデータを取り込む', click: () => perform(importSnapshot) },
      { label: '取得済みデータを書き出す', click: () => perform(exportSnapshot) },
      { label: 'データ保存先を開く', click: () => perform(async () => { await fs.mkdir(dataDirectory(), { recursive: true }); await shell.openPath(dataDirectory()); }) },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { role: 'editMenu' }, { role: 'viewMenu' },
  ]));
}
async function openWindow() {
  window = new BrowserWindow({ show: !smoke, width: 1440, height: 960, minWidth: 800, minHeight: 600, title: 'GitHub Monitor', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/github\.com\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  buildMenu();
  // Start on the API-free data viewer to allow migration before the first sync.
  await window.loadURL(`${origin}/data`);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    if (smoke) {
      const snapshot = await exportData(path.join(process.cwd(), '.next/cache/github-monitor'));
      try { await fs.access(dataDirectory()); } catch { if (Object.keys(snapshot.files).length) await importData(dataDirectory(), snapshot); }
    }
    await startServer(); await openWindow();
    if (smoke) {
      for (const route of ['/data', '/data?branches=all', '/data?view=day']) {
        await window.loadURL(`${origin}${route}`);
        // Next streams the loading shell before the cache-backed page is ready.
        const valid = await window.webContents.executeJavaScript(`new Promise(resolve => {
          const deadline = Date.now() + 30000;
          const timer = setInterval(() => {
            if (document.querySelector('main') && document.body.innerText.includes('取得済みデータ')) { clearInterval(timer); resolve(true); }
            else if (Date.now() > deadline) { clearInterval(timer); resolve(false); }
          }, 100);
        })`);
        if (!valid) throw new Error(`Invalid rendered page: ${route}`);
      }
      const before = JSON.stringify(await exportData(dataDirectory()));
      await stopServer(); await startServer(); await window.loadURL(`${origin}/data`);
      if (JSON.stringify(await exportData(dataDirectory())) !== before) throw new Error('Data changed after restart');
      await fs.writeFile(path.join(process.cwd(), 'release/desktop-smoke.png'), (await window.webContents.capturePage()).toPNG());
      console.log('Desktop smoke passed: migrated cache, both scopes, daily view, restart persistence, server shutdown.');
      quitting = true; await stopServer(); app.quit();
    }
  }).catch(async error => {
    if (smoke) {
      console.error('Desktop smoke failed:', error.code || error.name, error.message);
      if (window) await fs.writeFile(path.join(process.cwd(), 'release/desktop-smoke-failure.png'), (await window.webContents.capturePage()).toPNG()).catch(() => {});
      quitting = true; await stopServer(); app.exit(1);
    }
    else { dialog.showErrorBox('GitHub Monitor', '起動できませんでした。アプリを再インストールするか接続設定を確認してください。'); app.quit(); }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (server) { event.preventDefault(); quitting = true; void stopServer().then(() => app.quit()); }
  });
}
