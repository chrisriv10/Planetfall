'use strict';
const {execFileSync}=require('node:child_process');
const path=require('node:path');
module.exports = {
  appId: 'games.planetfall.desktop', productName: 'Planetfall',
  directories: { app: '.', output: '../dist-desktop', buildResources: 'assets' },
  files: ['main.cjs', 'policy.cjs', 'preload.cjs', 'offline.html', 'assets/planetfall.ico', 'package.json'],
  asar: true, npmRebuild: false, publish: null,
  extraMetadata: {planetfallSourceRevision:execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'}).trim()},
  win: { target: [{ target: 'nsis', arch: ['x64'] }, { target: 'portable', arch: ['x64'] }],
    icon: 'assets/planetfall.ico', executableName: 'Planetfall', requestedExecutionLevel: 'asInvoker' },
  nsis: { oneClick: false, perMachine: false, allowElevation: false, allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true, createStartMenuShortcut: true, shortcutName: 'Planetfall',
    artifactName: 'Planetfall-${version}-Setup-${arch}.${ext}', deleteAppDataOnUninstall: false },
  portable: { artifactName: 'Planetfall-${version}-Portable-${arch}.${ext}' },
};
