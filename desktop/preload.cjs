'use strict';
const { contextBridge } = require('electron');
// Data only: the remote application receives no OS, IPC, or filesystem powers.
contextBridge.exposeInMainWorld('planetfallDesktop', Object.freeze({ platform: 'win32', guestOnly: true }));
