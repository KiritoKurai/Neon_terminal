const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (cb) => {
  const fn = (e, ...args) => cb(...args);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
};

const winBuild = process.platform === 'win32' ? parseInt(require('os').release().split('.')[2] || '0', 10) : 0;

contextBridge.exposeInMainWorld('neon', {
  platform: process.platform,
  isWin11: winBuild >= 22000,
  pty: {
    create: (opts) => ipcRenderer.invoke('pty:create', opts),
    write: (id, data) => ipcRenderer.send('pty:write', id, data),
    resize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
    kill: (id) => ipcRenderer.send('pty:kill', id),
    onData: on('pty:data'),
    onExit: on('pty:exit')
  },
  profiles: () => ipcRenderer.invoke('profiles:list'),
  onProfilesChanged: on('profiles:changed'),
  history: () => ipcRenderer.invoke('history:get'),
  monitor: {
    subscribe: () => ipcRenderer.send('monitor:subscribe'),
    unsubscribe: () => ipcRenderer.send('monitor:unsubscribe'),
    onData: on('monitor:data')
  },
  wallpaper: () => ipcRenderer.invoke('wallpaper:get'),
  file: {
    info: (p) => ipcRenderer.invoke('file:info', p),
    read: (p, max) => ipcRenderer.invoke('file:read', p, max),
    list: (p) => ipcRenderer.invoke('dir:list', p)
  },
  saveRecording: (buf) => ipcRenderer.invoke('record:save', buf),
  recordGeom: () => ipcRenderer.invoke('record:geom'),
  pickKey: () => ipcRenderer.invoke('dialog:key'),
  checkDeps: () => ipcRenderer.invoke('deps:check'),
  irc: {
    connect: (id, opts) => ipcRenderer.invoke('irc:connect', id, opts),
    send: (id, line) => ipcRenderer.send('irc:send', id, line),
    disconnect: (id) => ipcRenderer.send('irc:disconnect', id),
    onEvent: on('irc:event')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    defaults: () => ipcRenderer.invoke('settings:defaults'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    reset: () => ipcRenderer.invoke('settings:reset'),
    openFile: () => ipcRenderer.send('settings:open-file'),
    path: () => ipcRenderer.invoke('settings:path')
  },
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    maximize: () => ipcRenderer.send('win:maximize'),
    close: () => ipcRenderer.send('win:close'),
    fullscreen: () => ipcRenderer.send('win:fullscreen'),
    devtools: () => ipcRenderer.send('win:devtools'),
    onState: on('win:state')
  },
  onStats: on('sys:stats'),
  // Claude notifications
  onClaudeEvent: on('claude:event'),
  onPtyFocus: on('pty:focus'),
  showNotification: (n) => ipcRenderer.send('notify:show', n),
  clearNotification: (ptyId) => ipcRenderer.send('notify:clear', ptyId),
  sendUiStyle: (s) => ipcRenderer.send('theme:ui', s),
  // notification window
  onNotify: on('notify:show'),
  onNotifyClear: on('notify:clear'),
  notifyResize: (h) => ipcRenderer.send('notify:resize', h),
  notifyEmpty: () => ipcRenderer.send('notify:empty'),
  notifyClick: (ptyId) => ipcRenderer.send('notify:click', ptyId),
  openExternal: (url) => ipcRenderer.send('open:external', url),
  openPath: (p) => ipcRenderer.send('open:path', p),
  confirm: (msg) => ipcRenderer.invoke('dialog:confirm', msg),
  pickImage: () => ipcRenderer.invoke('dialog:image'),
  exportTheme: (name, data) => ipcRenderer.invoke('theme:export', name, data),
  importTheme: () => ipcRenderer.invoke('theme:import'),
  // In Electron 44 the clipboard is async and lives in the main process
  clipboard: {
    read: () => ipcRenderer.invoke('clip:read'),
    write: (t) => ipcRenderer.invoke('clip:write', t)
  }
});
