# Planetfall for Windows

This Electron client loads the canonical production game at https://planetfall.pages.dev/ and connects to the existing authoritative server at https://planetfall-server.onrender.com. It does not bundle a game build or server. Both services must be reachable. The shell version is independent of the remotely deployed game version; there is no native auto-updater.

## Build and run

Use Node 22 on Windows. This directory is an independent npm package to keep Electron out of production server installs. From the repository root:

```powershell
npm ci --prefix desktop
npm --prefix desktop test
npm --prefix desktop start
npm --prefix desktop run pack
npm --prefix desktop run dist
npm run desktop:smoke
```

`dist` creates Windows x64 NSIS setup and portable executables in `dist-desktop/`. The installer is per user, requests no elevation, offers the installation directory and shortcuts, and preserves application data on uninstall. Both variants use the installed user's persistent Electron profile; portable does not promise USB-local saves. The application and installer use `assets/planetfall.ico`. Maintain the desktop version in package.json and lockfile together. Signing requires release credentials configured with electron-builder; an unsigned local build is not a signed release. Publish is disabled by configuration and CLI. No install URL, token, or development origin can be supplied through environment variables or launch arguments.

## Guest account contract

Preload exposes only read-only `window.planetfallDesktop = { platform: 'win32', guestOnly: true }`. There are no callable preload methods or IPC handlers. The web application must use `guestOnly` to suppress account restore/link/switch and present the browser option honestly. Defense in depth blocks all API path segments on both allowed hosts, including malformed and nested encoded paths, all Google navigation, all child windows, and arbitrary external links. Google account progress is supported in the ordinary browser only. The native **Planetfall → Open browser version** action opens the canonical root without carrying account credentials or guest tokens. Guest identity and preferences remain in `persist:planetfall-guest` across launches; desktop guest progress and browser identity are separate.

## Security and recovery

Remote content runs with sandbox and context isolation, without Node integration or webview support. Network access permits only the two approved HTTPS/WSS hosts on the standard port. Navigation is limited to the canonical Pages site. Downloads and new windows are denied. Pointer lock and fullscreen are allowed only for the canonical game in the main frame. Clipboard sanitized write is allowed only for the same trusted main frame while focused and transient user activation is present, checked in an isolated world without synthesizing a gesture. Clipboard permission checks return false to require a fresh request, so no persistent clipboard grant is retained. Clipboard reading, camera, microphone, notifications and other permissions are denied. There is no certificate exception or arbitrary external-URL action. Fullscreen is available in the native View menu (F11). The recovery page also offers a direct canonical HTTPS Retry connection link. Retry/reload uses Ctrl+R and always reloads the canonical root.

Website load failure or renderer crash displays a local script-free connection recovery document. It explains that multiplayer outages after the website loads remain in-game connection errors; the shell does not claim the server is available or that offline multiplayer works.

## Validation

`npm --prefix desktop test` exercises production URL policy, blocked OAuth, startup settings, permission denial, network allowlisting, fallback/retry, and packaging boundaries with a mocked Electron process. Release validation must also launch the unpacked executable and test real WebGL/gameplay, guest preferences after restart, reconnect, denied navigation, fullscreen, offline retry, installation/shortcut/uninstall, and signed artifact status. Unit tests do not substitute for those checks.

`npm run desktop:smoke` requires the built `dist-desktop/win-unpacked/Planetfall.exe` and the root development dependencies. It launches that actual executable with an unreachable loopback proxy, verifies offline recovery, and serves an intercepted renderer fixture at the canonical origin. It tests native sandboxing, keyboard/pointer capture, transient clipboard writes, denied navigation/account requests, fullscreen and preference persistence across restart without creating production players. Its fixture is not a gameplay acceptance test. Artifacts go into a fresh system temporary directory. The package embeds its source Git revision; final release packaging must run at the approved main revision. No test fixture or diagnostic script is included in the packaged application.

API references: [Electron webContents](https://www.electronjs.org/docs/latest/api/web-contents), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [electron-builder NSIS](https://www.electron.build/docs/nsis/).
