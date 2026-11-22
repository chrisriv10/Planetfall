'use strict';
const PRODUCTION_URL = 'https://planetfall.pages.dev/';
const SERVER_ORIGIN = 'https://planetfall-server.onrender.com';
function parsed(value) { try { return new URL(value); } catch { return null; } }
function approvedNetwork(value) {
  const url = parsed(value);
  if (!url || url.username || url.password) return false;
  if (!['https:', 'wss:'].includes(url.protocol)) return false;
  if (!['planetfall.pages.dev', 'planetfall-server.onrender.com'].includes(url.hostname) || (url.port && url.port !== '443')) return false;
  // Desktop is a separate persistent guest profile, never an embedded OAuth client.
  const pathname = decodedPath(url.pathname);
  return pathname !== null && !/(?:^|\/)api(?:\/|$)/i.test(pathname);
}
function decodedPath(value) {
  // Repeated decoding catches encoded separators and nested encodings. A fixed
  // budget and malformed-escape rejection keep ambiguous paths fail-closed.
  for (let depth = 0; depth < 8; depth++) {
    if (!value.includes('%')) return value.replaceAll('\\', '/');
    try { value = decodeURIComponent(value); } catch { return null; }
  }
  return value.includes('%') ? null : value.replaceAll('\\', '/');
}
function approvedNavigation(value) {
  const url = parsed(value);
  return !!url && url.origin === new URL(PRODUCTION_URL).origin && approvedNetwork(value) && url.protocol === 'https:';
}
const windowOptions = Object.freeze({
  width: 1440, height: 900, minWidth: 960, minHeight: 640,
  title: 'Planetfall', backgroundColor: '#080e1a', show: false,
  webPreferences: Object.freeze({ nodeIntegration: false, contextIsolation: true, sandbox: true,
    webSecurity: true, allowRunningInsecureContent: false, webviewTag: false,
    partition: 'persist:planetfall-guest' }),
});
module.exports = { PRODUCTION_URL, SERVER_ORIGIN, approvedNetwork, approvedNavigation, windowOptions };
