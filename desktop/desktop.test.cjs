'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { approvedNavigation, approvedNetwork, windowOptions, PRODUCTION_URL } = require('./policy.cjs');
test('production navigation accepts only canonical HTTPS and excludes accounts', () => {
  assert.ok(approvedNavigation(PRODUCTION_URL));
  for (const url of ['https://planetfall.pages.dev.evil.test/', 'https://evil.test/', 'http://planetfall.pages.dev/',
    'file:///C:/Windows/system.ini', 'javascript:alert(1)', 'https://user@planetfall.pages.dev/',
    'https://planetfall.pages.dev:444/', 'https://planetfall.pages.dev/api/account/start',
    'https://planetfall.pages.dev/api/%61ccount/complete', 'https://accounts.google.com/']) assert.equal(approvedNavigation(url), false, url);
});
test('live server HTTPS and WSS work; insecure and account requests fail closed', () => {
  assert.ok(approvedNetwork('wss://planetfall-server.onrender.com/socket.io/?transport=websocket'));
  assert.ok(approvedNetwork('https://planetfall-server.onrender.com/socket.io/'));
  assert.equal(approvedNavigation('https://planetfall-server.onrender.com/'), false);
  for (const url of ['ws://planetfall-server.onrender.com/', 'https://planetfall-server.onrender.com/api/account/session', 'https://localhost:3000/', 'https://accounts.google.com/']) assert.equal(approvedNetwork(url), false);
});
test('malformed, nested-encoded and ambiguous API paths fail closed', () => {
  for (const origin of ['https://planetfall.pages.dev', 'https://planetfall-server.onrender.com']) {
    for (const pathname of ['/api', '/API/account', '/%61pi/account', '/%2561pi%252faccount/start', '/%252561pi/account',
      '/foo/%2e%2e/api/account', '//api/account', '/%5capi/account', '/%2fapi/account', '/api%2Faccount', '/assets/%zz', '/assets/%', '/assets/%E0%A4']) {
      assert.equal(approvedNetwork(origin + pathname), false, origin + pathname);
    }
  }
  assert.ok(approvedNetwork(PRODUCTION_URL + 'assets/game.js'));
});
test('startup secures renderer, denies popups/permissions/downloads and recovers failed loads', async () => {
  let instance, requestHandler, permissionHandler, checkHandler, menu, active = true;
  const guest = new EventEmitter();
  guest.setPermissionRequestHandler = callback => { permissionHandler = callback; };
  guest.setPermissionCheckHandler = callback => { checkHandler = callback; assert.equal(callback(), false); };
  guest.webRequest = { onBeforeRequest: callback => { requestHandler = callback; } };
  class Window extends EventEmitter {
    constructor(options) { super(); instance = this; this.options = options; this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = callback => { assert.equal(callback().action, 'deny'); };
      this.webContents.executeJavaScriptInIsolatedWorld = async (world, scripts, gesture) => {
        assert.equal(world, 999); assert.equal(scripts[0].code, 'navigator.userActivation.isActive'); assert.equal(gesture, false); return active;
      };
      this.webContents.getURL = () => this.url || ''; }
    isDestroyed() { return false; }
    isFocused() { return true; }
    async loadURL(url) { this.url = url; }
  }
  const app = new EventEmitter();
  Object.assign(app, { setName() {}, enableSandbox() {}, setAppUserModelId() {}, requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), quit() {} });
  const electron = { app, BrowserWindow: Window, session: { fromPartition: () => guest },
    Menu: { buildFromTemplate: value => value, setApplicationMenu: value => { menu = value; } }, shell: { openExternal: async url => assert.equal(url, PRODUCTION_URL) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'main.cjs'), 'utf8'), { __dirname,
    require: name => name === 'electron' ? electron : require(name) });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(instance.url, PRODUCTION_URL);
  assert.equal(instance.options.webPreferences.nodeIntegration, false);
  assert.equal(instance.options.webPreferences.sandbox, true);
  assert.equal(instance.options.webPreferences.contextIsolation, true);
  assert.equal(windowOptions.webPreferences.partition, 'persist:planetfall-guest');
  permissionHandler(null, 'media', result => assert.equal(result, false));
  permissionHandler(instance.webContents, 'pointerLock', result => assert.equal(result, true), { isMainFrame: true, requestingUrl: PRODUCTION_URL });
  permissionHandler(instance.webContents, 'pointerLock', result => assert.equal(result, false), { isMainFrame: false, requestingUrl: PRODUCTION_URL });
  permissionHandler(instance.webContents, 'fullscreen', result => assert.equal(result, false), { isMainFrame: true, requestingUrl: 'https://evil.test/' });
  const trusted = { isMainFrame: true, requestingUrl: PRODUCTION_URL };
  const request = (permission, details = trusted) => new Promise(resolve => permissionHandler(instance.webContents, permission, resolve, details));
  assert.equal(checkHandler(instance.webContents, 'pointerLock', PRODUCTION_URL, trusted), true);
  assert.equal(checkHandler(instance.webContents, 'pointerLock', PRODUCTION_URL, { ...trusted, isMainFrame: false }), false);
  assert.equal(checkHandler(instance.webContents, 'clipboard-sanitized-write', PRODUCTION_URL, trusted), false);
  assert.equal(await request('clipboard-sanitized-write'), true);
  active = false;
  assert.equal(await request('clipboard-sanitized-write'), false);
  active = true;
  assert.equal(await request('clipboard-read'), false);
  assert.equal(await request('clipboard-sanitized-write', { ...trusted, isMainFrame: false }), false);
  assert.equal(await request('clipboard-sanitized-write', { ...trusted, requestingUrl: 'https://evil.test/' }), false);
  assert.equal(menu[1].submenu[0].accelerator, 'F11');
  requestHandler({ url: 'https://evil.test/' }, result => assert.equal(result.cancel, true));
  let blocked = false;
  instance.webContents.emit('will-frame-navigate', { url: 'https://accounts.google.com/', preventDefault() { blocked = true; } });
  assert.ok(blocked);
  guest.emit('will-download', { preventDefault() { blocked = true; } });
  instance.webContents.emit('did-fail-load', {}, -105, 'DNS unavailable', PRODUCTION_URL, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(instance.url.endsWith('/offline.html'));
  requestHandler({ url: instance.url }, result => assert.equal(result.cancel, false));
  await menu[0].submenu[0].click();
  assert.equal(instance.url, PRODUCTION_URL);
  await menu[0].submenu[1].click();
});
test('offline recovery provides script-free canonical retry navigation', () => {
  const page = fs.readFileSync(path.join(__dirname, 'offline.html'), 'utf8');
  assert.ok(page.includes(`href="${PRODUCTION_URL}"`));
  assert.ok(page.includes("default-src 'none'"));
  assert.ok(!page.includes('<script'));
});
test('packaging includes only shell and icon, x64 NSIS/portable and no updater', () => {
  const config = require('./electron-builder.cjs');
  assert.equal(config.publish, null);
  assert.equal(config.asar, true);
  assert.deepEqual(config.win.target.map(target => target.target), ['nsis', 'portable']);
  assert.ok(config.win.target.every(target => target.arch.join() === 'x64'));
  assert.ok(config.files.includes('assets/planetfall.ico'));
  assert.ok(!config.files.some(file => /server|client|shared/.test(file)));
  assert.equal(require('./package.json').main, 'main.cjs');
});
