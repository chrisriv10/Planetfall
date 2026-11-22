'use strict';
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PRODUCTION_URL, approvedNetwork, approvedNavigation, windowOptions } = require('./policy.cjs');
const offlineURL = pathToFileURL(path.join(__dirname, 'offline.html')).href;
let window;
app.setName('Planetfall');
app.enableSandbox();
app.setAppUserModelId('games.planetfall.desktop');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  app.whenReady().then(createWindow);
}
async function createWindow() {
  const guest = session.fromPartition(windowOptions.webPreferences.partition);
  const trustedFrame = (contents, details) => !!window && contents === window.webContents && details?.isMainFrame === true &&
    approvedNavigation(details.requestingUrl) && approvedNavigation(contents.getURL());
  const canCapture = (contents, permission, details) => ['pointerLock', 'fullscreen'].includes(permission) && trustedFrame(contents, details);
  guest.setPermissionRequestHandler((contents, permission, callback, details) => {
    if (permission !== 'clipboard-sanitized-write') return callback(canCapture(contents, permission, details));
    if (!trustedFrame(contents, details) || !window.isFocused()) return callback(false);
    // Never grant persistent clipboard permission or synthesize activation.
    // Isolated world keeps the activation check out of remote page JS control.
    contents.executeJavaScriptInIsolatedWorld(999, [{ code: 'navigator.userActivation.isActive' }], false)
      .then(active => callback(active === true && trustedFrame(contents, details) && window.isFocused()), () => callback(false));
  });
  guest.setPermissionCheckHandler((contents, permission, _origin, details) => canCapture(contents, permission, details));
  guest.on('will-download', event => event.preventDefault());
  guest.webRequest.onBeforeRequest((details, callback) => {
    // The only local document is our static, script-free recovery page.
    callback({ cancel: details.url !== offlineURL && !approvedNetwork(details.url) });
  });
  window = new BrowserWindow({ ...windowOptions, icon: path.join(__dirname, 'assets', 'planetfall.ico'),
    webPreferences: { ...windowOptions.webPreferences, preload: path.join(__dirname, 'preload.cjs') } });
  const contents = window.webContents;
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-attach-webview', event => event.preventDefault());
  contents.on('will-navigate', (event, url) => { if (!approvedNavigation(url)) event.preventDefault(); });
  contents.on('will-frame-navigate', event => { if (!approvedNavigation(event.url)) event.preventDefault(); });
  contents.on('will-redirect', (event, url) => { if (!approvedNavigation(url)) event.preventDefault(); });
  contents.on('did-fail-load', (_event, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) showOffline();
  });
  contents.on('render-process-gone', () => showOffline());
  window.once('ready-to-show', () => window.show());
  window.on('closed', () => { window = undefined; });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Planetfall', submenu: [
      { label: 'Retry / reload game', accelerator: 'CmdOrCtrl+R', click: loadGame },
      { label: 'Open browser version', click: () => { void shell.openExternal(PRODUCTION_URL).catch(() => {}); } },
      { type: 'separator' }, { role: 'quit' },
    ] },
    { label: 'View', submenu: [{ role: 'togglefullscreen', accelerator: 'F11' }, { role: 'minimize' }] },
  ]));
  await loadGame();
}
async function loadGame() {
  if (!window || window.isDestroyed()) return;
  try { await window.loadURL(PRODUCTION_URL); } catch { await showOffline(); }
}
async function showOffline() {
  if (!window || window.isDestroyed() || window.webContents.getURL() === offlineURL) return;
  try { await window.loadURL(offlineURL); } catch { /* Closing the window cancels loads. */ }
}
app.on('window-all-closed', () => app.quit());
