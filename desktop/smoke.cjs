'use strict';
// Actual packaged Windows executable, with all outbound traffic forced offline.
// A local intercepted renderer fixture tests the native boundary, not gameplay.
const {_electron,expect}=require('../node_modules/@playwright/test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'planetfall-desktop-smoke-'));
const profile=path.join(output,'profile');
const executablePath=path.join(__dirname,'..','dist-desktop','win-unpacked','Planetfall.exe');
if(!fs.existsSync(executablePath))throw Error('Build the Windows distribution before desktop:smoke.');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const fixture=`<!doctype html><html><head><title>Planetfall native boundary fixture</title></head><body>
<h1>Native boundary fixture</h1><button id="lock">Capture pointer</button><button id="copy">Copy invite</button>
<p id="status"></p><p id="keys"></p><a id="external" href="https://example.invalid/">Unapproved destination</a>
<script>document.querySelector('#lock').onclick=()=>document.body.requestPointerLock();
document.querySelector('#copy').onclick=()=>navigator.clipboard.writeText('https://planetfall.pages.dev/?family=planetfall&room=ABC234').then(()=>document.querySelector('#status').textContent='Copied',()=>document.querySelector('#status').textContent='Denied');
addEventListener('keydown',e=>document.querySelector('#keys').textContent=e.code);</script></body></html>`;
async function launch(){
  const app=await _electron.launch({executablePath,args:['--proxy-server=http://127.0.0.1:9',`--user-data-dir=${profile}`],env,timeout:30000});
  const page=await app.firstWindow();
  await expect(page.getByRole('heading',{name:'Planetfall couldn’t load'})).toBeVisible({timeout:30000});
  await page.context().route('https://planetfall.pages.dev/',route=>route.fulfill({status:200,contentType:'text/html',body:fixture}));
  await page.getByRole('link',{name:'Retry connection'}).click();
  await expect(page.getByRole('heading',{name:'Native boundary fixture'})).toBeVisible();
  return {app,page};
}
(async()=>{
  let current=await launch();
  try{
    const preferences=await current.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
    expect(preferences.nodeIntegration).toBe(false);expect(preferences.contextIsolation).toBe(true);expect(preferences.sandbox).toBe(true);
    expect(await current.page.evaluate(()=>({require:typeof window.require,process:typeof window.process,bridge:window.planetfallDesktop}))).toEqual({require:'undefined',process:'undefined',bridge:{platform:'win32',guestOnly:true}});
    await current.page.keyboard.press('KeyW');await expect(current.page.locator('#keys')).toHaveText('KeyW');
    await current.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].focus());
    await current.page.locator('#copy').click();await expect(current.page.locator('#status')).toHaveText('Copied');
    await current.page.locator('#lock').click();await expect.poll(()=>current.page.evaluate(()=>Boolean(document.pointerLockElement))).toBe(true);
    await current.page.evaluate(()=>document.exitPointerLock());
    const accountBlocked=await current.page.evaluate(()=>fetch('/api/account/session',{method:'POST'}).then(()=>false,()=>true));expect(accountBlocked).toBe(true);
    expect(await current.page.evaluate(()=>window.open('https://accounts.google.com/')===null)).toBe(true);
    // Denial intentionally never completes a navigation. Observe retained page
    // state instead of asking Playwright to wait for that prohibited navigation.
    await current.page.locator('#external').click({noWaitAfter:true});expect(current.page.url()).toBe('https://planetfall.pages.dev/');
    // Electron cancels the request before a new document commits; Playwright's
    // locator navigation waiter can remain pending for this intentionally denied
    // destination. Read the still-running document and native loading state.
    expect(await current.page.evaluate(()=>document.querySelector('h1')?.textContent)).toBe('Native boundary fixture');
    expect(await current.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.isLoadingMainFrame())).toBe(false);
    expect(await current.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(1);
    await current.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setFullScreen(true));
    expect(await current.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isFullScreen())).toBe(true);
    await current.app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setFullScreen(false));
    expect(await current.page.evaluate(()=>typeof navigator.getGamepads)).toBe('function');
    await current.page.evaluate(()=>localStorage.setItem('planetfall:desktop-smoke-setting','low'));
    await current.page.screenshot({path:path.join(output,'native-boundary.png')});await current.app.close();
    current=await launch();expect(await current.page.evaluate(()=>localStorage.getItem('planetfall:desktop-smoke-setting'))).toBe('low');
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,executablePath,output,checks:['actual packaged executable','offline recovery and retry','sandbox/context isolation/no Node bridge','keyboard','pointer lock','gesture-only clipboard write','blocked OAuth/API and unapproved navigation','native fullscreen','Gamepad API available (no physical device claim)','persistent renderer preference after restart'],productionRequests:'blocked by loopback dead proxy; renderer fixture only'},null,2));
    console.log(`Desktop executable smoke passed. Evidence: ${output}`);
  }finally{await current.app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
