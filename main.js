// NEON TERMINAL — main process (Electron)
const { app, BrowserWindow, ipcMain, shell, globalShortcut, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const pty = require('@lydell/node-pty');

app.setName('Neon Terminal');
if (process.env.NEON_USERDATA) app.setPath('userData', process.env.NEON_USERDATA); // isolated tests
// Windows app identifier (taskbar). If you change the icon and Windows shows the old one, bump the version.
const APP_ID = 'NeonTerminal.Hex.1';
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

// Single instance: if one is already running, this one exits right away (before creating anything).
// (app.quit() before 'ready' can hang; hence app.exit)
if (!app.requestSingleInstanceLock()) { app.exit(0); return; }

// in the installed app the shell scripts live outside the asar (PowerShell can't read inside it)
const SHELL_DIR = path.join(__dirname.replace(/app\.asar$/, 'app.asar.unpacked'), 'shell');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

// ---------------------------------------------------------------- settings
function systemLanguage() {
  const loc = (Intl.DateTimeFormat().resolvedOptions().locale || process.env.LANG || 'en').toLowerCase();
  return loc.startsWith('ca') ? 'ca' : loc.startsWith('es') ? 'es' : 'en';
}

const DEFAULT_SETTINGS = {
  theme: 'claude',
  fontFamily: "'Cascadia Code', 'Cascadia Mono', Consolas, 'Courier New', monospace",
  fontSize: 15,
  lineHeight: 1.15,
  letterSpacing: 0,
  cursorStyle: 'bar',          // block | underline | bar
  cursorBlink: true,
  scrollback: 10000,
  opacity: 0.86,               // terminal background opacity (0-1)
  backgroundEffect: 'grid',    // grid | particles | matrix | stars | none
  effectIntensity: 0.6,
  effectSpeed: 1,
  effectColor: '',             // background effect color ('' = theme accent color)
  backgroundImage: '',         // background image/GIF path
  backgroundImageOpacity: 0.35,
  backgroundBlur: 0,           // image blur in px
  backgroundFit: 'cover',      // cover | contain | tile | center
  gradient: true,              // color gradient over the background
  accentOverride: '',          // forces a UI accent color
  uiFont: "'Segoe UI Variable', 'Segoe UI', sans-serif",
  borderRadius: 12,
  borderGlow: true,            // glowing border around the window
  paneGap: 6,
  padding: 10,
  glow: true,
  glowStrength: 6,
  scanlines: false,
  renderer: 'dom',             // dom (allows glow) | webgl (faster)
  windowEffect: 'acrylic',     // acrylic | mica | tabbed | none (Windows 11)
  copyOnSelect: true,
  clickableCommands: true,     // install commands in the output run with one click
  rightClickPaste: true,
  bellSound: true,
  confirmClose: true,
  defaultProfile: 'claude',
  startupSplit: 'powershell',  // pane opened below Claude at startup (null = none)
  splitRatio: 0.3,             // bottom pane size (0-1)
  claudeArgs: [],              // extra arguments for claude, e.g. ["--continue"]
  claudeCwd: '',               // Claude working folder ('' = user folder)
  notifyMode: 'always',        // always | auto (only when you're not looking at the pane) | off
  notifySound: true,
  notifyDuration: 8,           // seconds
  notifyPosition: 'bottom-right', // bottom-right | top-right | bottom-left | top-left
  autoStart: true,             // start with Windows
  alwaysOnTop: false,
  windowWidth: 780,
  windowHeight: 580,
  globalHotkey: 'Control+Alt+Space',   // show/hide the window (Quake style)
  startupCommands: [],         // commands run when every PowerShell tab opens
  snippets: [
    { name: 'System info', command: 'sysinfo' },
    { name: 'Public IP', command: 'myip' },
    { name: 'Open ports', command: 'ports' },
    { name: 'Weather', command: 'weather' },
    { name: 'Git status', command: 'git status -sb' }
  ],
  customProfiles: [],          // [{ id, name, icon, command, args, cwd, env }]
  customThemes: {},            // { name: { ...colors } } — see README
  keybindings: {},             // overrides shortcuts, e.g. { "newTab": "Ctrl+Shift+T" }
  language: systemLanguage(),  // ca | es | en (defaults to the system language)
  restoreSession: true,        // reopens last time's tabs and splits
  claudeContinueOnRestore: true,
  lastSession: null,
  workspaces: {},              // { name: layout }
  showQuickBar: false,         // pinned quick-command bar (otherwise the ⚡ dropdown)
  errorHelp: true,             // "Ask Claude" button when a command fails
  longCmdNotify: true,
  longCmdSeconds: 30,
  typingSound: 'off',          // off | soft | retro | mech | scifi
  soundVolume: 0.5,
  doneSound: true,
  autoTheme: 'off',            // off | time | wallpaper
  dayTheme: 'glass',
  nightTheme: 'cyberpunk',
  dayStart: '08:00',
  nightStart: '20:00',
  wallpaperAsBackground: false,
  focusMode: false,
  sshHosts: [],                // [{ name, host, user, port, key, extra }]
  irc: { nick: '', realname: '', favorites: [], customNetworks: [] }
};

// native dialog texts (the rest of the UI is translated in the renderer)
const MAIN_TR = {
  'dlg.close': ['Tancar', 'Cerrar', 'Close'],
  'dlg.cancel': ['Cancel·lar', 'Cancelar', 'Cancel'],
  'dlg.pickImage': ['Tria una imatge de fons', 'Elige una imagen de fondo', 'Choose a background image'],
  'dlg.images': ['Imatges', 'Imágenes', 'Images'],
  'dlg.theme': ['Tema', 'Tema', 'Theme'],
  'dlg.saveRecording': ['Desar la gravació', 'Guardar la grabación', 'Save recording'],
  'dlg.pickKey': ['Tria la clau privada SSH', 'Elige la clave privada SSH', 'Choose SSH private key'],
  'shortcut.desc': ['Neon Terminal amb Claude Code', 'Neon Terminal con Claude Code', 'Neon Terminal with Claude Code']
};
const tr = (k) => { const e = MAIN_TR[k]; if (!e) return k; return e[{ ca: 0, es: 1, en: 2 }[settings.language] ?? 0] || e[0]; };

// Repairs UTF-8 text read as Windows-1252 (e.g. "pÃƒÂºblica" → "pública"), even if it happened twice
const CP1252 = { 0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B,
  0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A,
  0x203A: 0x9B, 0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F };
function fixMojibake(s) {
  for (let pass = 0; pass < 3 && /[ÃÂâ][\u0080-ÿŒ-™]/.test(s); pass++) {
    const bytes = [];
    for (const ch of s) {
      const c = ch.codePointAt(0);
      if (c < 256) bytes.push(c); else if (CP1252[c] !== undefined) bytes.push(CP1252[c]); else return s;
    }
    const decoded = Buffer.from(bytes).toString('utf8');
    if (decoded.includes('�')) return s;
    s = decoded;
  }
  return s;
}
function deepFix(v) {
  if (typeof v === 'string') return fixMojibake(v);
  if (Array.isArray(v)) return v.map(deepFix);
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[fixMojibake(k)] = deepFix(v[k]); return o; }
  return v;
}

function loadSettings() {
  try {
    const text = fs.readFileSync(SETTINGS_FILE, 'utf8').replace(/^﻿/, '');
    const raw = JSON.parse(text);
    const fixed = deepFix(raw);
    const merged = { ...DEFAULT_SETTINGS, ...fixed };
    if (JSON.stringify(fixed) !== JSON.stringify(raw)) { try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8'); } catch {} }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(s) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
}

let settings = loadSettings();
if (!fs.existsSync(SETTINGS_FILE)) saveSettings(settings);

// ---------------------------------------------------------------- profiles
function exists(p) { try { return fs.existsSync(p); } catch { return false; } }

function findInPath(exe) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const d of dirs) {
    const full = path.join(d, exe);
    if (exists(full)) return full;
  }
  return null;
}

function detectProfiles() {
  const sys32 = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  const neonPs = path.join(SHELL_DIR, 'neon.ps1');
  const psArgs = ['-NoLogo', '-NoExit', '-ExecutionPolicy', 'Bypass', '-Command', `. '${neonPs}'`];
  const list = [];

  const home = os.homedir();
  const claude = findInPath('claude.exe')
    || [path.join(home, '.local', 'bin', 'claude.exe'), path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'claude.exe')].find(exists);
  const claudeCmd = !claude && findInPath('claude.cmd');
  const claudeArgs = [...(HOOKS_FILE ? ['--settings', HOOKS_FILE] : []), ...(settings.claudeArgs || [])];
  if (claude) list.push({ id: 'claude', name: 'Claude Code', icon: 'claude', command: claude, args: claudeArgs, cwd: settings.claudeCwd || home });
  else if (claudeCmd) list.push({ id: 'claude', name: 'Claude Code', icon: 'claude', command: path.join(sys32, 'cmd.exe'), args: ['/c', claudeCmd, ...claudeArgs], cwd: settings.claudeCwd || home });

  list.push({ id: 'powershell', name: 'PowerShell', icon: 'powershell', command: path.join(sys32, 'WindowsPowerShell', 'v1.0', 'powershell.exe'), args: psArgs });

  const pwsh = findInPath('pwsh.exe') || ['C:\\Program Files\\PowerShell\\7\\pwsh.exe'].find(exists);
  if (pwsh) list.push({ id: 'pwsh', name: 'PowerShell 7', icon: 'pwsh', command: pwsh, args: psArgs });

  list.push({ id: 'cmd', name: 'Command Prompt', icon: 'cmd', command: path.join(sys32, 'cmd.exe'), args: ['/k', path.join(SHELL_DIR, 'neon.cmd')] });

  const gitBash = ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe'].find(exists);
  if (gitBash) list.push({ id: 'gitbash', name: 'Git Bash', icon: 'git', command: gitBash, args: ['--login', '-i'] });

  if (exists(path.join(sys32, 'wsl.exe'))) list.push({ id: 'wsl', name: 'WSL (Linux)', icon: 'linux', command: path.join(sys32, 'wsl.exe'), args: [] });

  const python = findInPath('python.exe');
  if (python && !python.includes('WindowsApps')) list.push({ id: 'python', name: 'Python', icon: 'python', command: python, args: [] });

  const node = findInPath('node.exe');
  if (node) list.push({ id: 'node', name: 'Node.js', icon: 'node', command: node, args: [] });

  for (const p of settings.customProfiles || []) {
    if (p && p.id && p.command) list.push({ icon: 'star', args: [], ...p });
  }

  // saved SSH servers
  const ssh = findInPath('ssh.exe') || [path.join(sys32, 'OpenSSH', 'ssh.exe')].find(exists);
  if (ssh) for (const h of settings.sshHosts || []) {
    if (!h || !h.name || !h.host) continue;
    const args = [];
    if (h.port && +h.port !== 22) args.push('-p', String(h.port));
    if (h.key) args.push('-i', h.key);
    if (h.extra) args.push(...String(h.extra).split(/\s+/).filter(Boolean));
    args.push(h.user ? `${h.user}@${h.host}` : h.host);
    list.push({ id: 'ssh:' + h.name, name: h.name, icon: 'server', command: ssh, args, ssh: true });
  }

  // built-in app panes (not processes)
  list.push({ id: 'monitor', name: 'Monitor', icon: 'cpu', kind: 'monitor' });
  list.push({ id: 'irc', name: 'IRC', icon: 'irc', kind: 'irc' });
  return list;
}

// ---------------------------------------------------------------- Claude hooks → notifications
// Claude sessions opened in Neon load these hooks via --settings
// (Claude Code's global settings are never touched).
const NOTIFY_TOKEN = crypto.randomBytes(16).toString('hex');
let notifyPort = 0;
let HOOKS_FILE = null;

function writeHooksFile() {
  const fwd = (p) => p.replace(/\\/g, '/');
  // with Node.js (faster) when available; otherwise the PowerShell version (always available on Windows)
  const node = findInPath('node.exe');
  const ps = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const run = node
    ? `"${fwd(node)}" "${fwd(path.join(SHELL_DIR, 'claude-hook.js'))}"`
    : `"${fwd(ps)}" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "${fwd(path.join(SHELL_DIR, 'claude-hook.ps1'))}"`;
  const cmd = (ev) => [{ hooks: [{ type: 'command', command: `${run} ${ev}`, timeout: 8 }] }];
  const config = {
    // inside Neon, notifications come from the app (not Claude Code's Windows ones)
    preferredNotifChannel: 'notifications_disabled',
    inputNeededNotifEnabled: false,
    agentPushNotifEnabled: false,
    hooks: {
      Stop: cmd('stop'),
      Notification: cmd('notification'),
      PreToolUse: [{ matcher: 'AskUserQuestion', hooks: cmd('question')[0].hooks }]
    }
  };
  const file = path.join(app.getPath('userData'), 'claude-hooks.json');
  fs.writeFileSync(file, JSON.stringify(config, null, 2));
  return file;
}
HOOKS_FILE = writeHooksFile();

const notifyServer = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/claude') { res.statusCode = 404; return res.end(); }
  let body = '';
  req.on('data', (c) => { body += c; if (body.length > 1e5) req.destroy(); });
  req.on('end', () => {
    res.end('ok');
    let data;
    try { data = JSON.parse(body); } catch { return; }
    if (data.token !== NOTIFY_TOKEN) return;
    if (win && !win.isDestroyed()) win.webContents.send('claude:event', { ptyId: data.ptyId, event: data.event, message: data.message, cwd: data.cwd });
  });
});
let profiles = detectProfiles();

// the startup shells need the notification port in their environment
notifyServer.listen(0, '127.0.0.1', () => { notifyPort = notifyServer.address().port; prewarmStartup(); });

// ---------------------------------------------------------------- ptys
const ptys = new Map();
let nextPtyId = 1;
const ptyOut = new Map(); // id → output buffered while no window has adopted the pty (prewarm)

function sendToWin(channel, ...args) { if (win && !win.isDestroyed()) win.webContents.send(channel, ...args); }
function resolveProfile(profileId) { return profiles.find(p => p.id === profileId && !p.kind) || profiles.find(p => !p.kind); }

function createPty({ profileId, cols, rows, cwd, extraArgs }) {
  const profile = resolveProfile(profileId);
  const id = nextPtyId++;
  // don't inherit markers from other sessions (VS Code / Claude Code)
  const base = { ...process.env };
  for (const k of Object.keys(base)) if (k === 'ELECTRON_RUN_AS_NODE' || k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_')) delete base[k];
  const env = {
    ...base,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    TERM_PROGRAM: 'NeonTerminal',
    NEON_TERMINAL: '1',
    NEON_SHELL_DIR: SHELL_DIR,
    NEON_PORT: String(notifyPort),
    NEON_TOKEN: NOTIFY_TOKEN,
    NEON_PTY_ID: String(id),
    NEON_STARTUP: (settings.startupCommands || []).join(';'),
    NEON_LANG: settings.language || 'ca',
    NEON_LONGCMD: settings.longCmdNotify ? String(settings.longCmdSeconds || 30) : '0',
    NEON_ERRHELP: settings.errorHelp ? '1' : '0',
    ...(profile.env || {})
  };
  const startDir = cwd && exists(cwd) ? cwd : profile.cwd || os.homedir();
  const proc = pty.spawn(profile.command, [...(profile.args || []), ...(extraArgs || [])], {
    name: 'xterm-256color',
    cols: cols || 100,
    rows: rows || 30,
    cwd: startDir,
    env,
    useConpty: true
  });
  ptys.set(id, proc);
  proc.onData(data => { const buf = ptyOut.get(id); if (buf) buf.push(data); else sendToWin('pty:data', id, data); });
  proc.onExit(({ exitCode }) => {
    ptys.delete(id);
    // a prewarmed pty that died before being adopted: the renderer will spawn a fresh one
    if (ptyOut.delete(id)) { prewarmed = prewarmed.filter(w => w.id !== id); return; }
    sendToWin('pty:exit', id, exitCode);
  });
  return { id, profile: { id: profile.id, name: profile.name, icon: profile.icon } };
}

// ---------------------------------------------------------------- prewarm
// Claude and PowerShell take 1-2 s to be ready, so the startup panes are spawned while the window
// loads; the renderer adopts them when it asks for the same panes (boot.js does the same walk).
let prewarmed = [];
const ptyKey = (o) => [resolveProfile(o.profileId).id, o.cwd || '', ...(o.extraArgs || [])].join('\n');

function startupPanes() {
  const valid = (id) => profiles.some(p => p.id === id);
  const isPty = (id) => profiles.some(p => p.id === id && !p.kind) || !valid(id);
  const layout = settings.restoreSession && settings.lastSession;
  if (layout && layout.tabs && layout.tabs.length) {
    const out = [];
    let continued = !settings.claudeContinueOnRestore;
    const walk = (n) => {
      if (!n) return;
      if (!n.p) return (n.c || []).forEach(walk);
      const pid = valid(n.p) ? n.p : settings.defaultProfile;
      const extraArgs = [];
      if (pid === 'claude' && !continued) { extraArgs.push('--continue'); continued = true; }
      if (isPty(pid)) out.push({ profileId: pid, cwd: n.cwd, extraArgs });
    };
    layout.tabs.forEach(walk);
    return out;
  }
  const def = valid(settings.defaultProfile) ? settings.defaultProfile : profiles.find(p => !p.kind).id;
  const split = def === 'claude' && settings.startupSplit && valid(settings.startupSplit) ? settings.startupSplit : null;
  return [def, split].filter(id => id && isPty(id)).map(profileId => ({ profileId }));
}

function prewarmStartup() {
  try {
    const sizes = settings.startupSizes || [];
    // first launch: rough guess from the window size (the pty is resized when adopted)
    const w = (settings.windowBounds && settings.windowBounds.width) || settings.windowWidth || 780;
    const h = (settings.windowBounds && settings.windowBounds.height) || settings.windowHeight || 580;
    const guess = { cols: Math.max(40, Math.floor((w - 40) / (settings.fontSize * 0.6))), rows: Math.max(10, Math.floor((h - 90) / (settings.fontSize * settings.lineHeight * 1.25))) };
    prewarmed = startupPanes().slice(0, 8).map((opts, index) => {
      const size = sizes[index] || guess;
      const res = createPty({ ...opts, ...size });
      ptyOut.set(res.id, []);
      return { ...res, ...size, index, key: ptyKey(opts) };
    });
  } catch { prewarmed = []; }
  // never adopted (the layout changed, the window failed…): don't leave them running
  setTimeout(() => { for (const w of prewarmed) { const p = ptys.get(w.id); ptyOut.delete(w.id); if (p) { try { p.kill(); } catch {} ptys.delete(w.id); } } prewarmed = []; }, 30000);
}

function adoptPrewarmed(opts) {
  const i = prewarmed.findIndex(w => w.key === ptyKey(opts));
  if (i < 0) return null;
  const [w] = prewarmed.splice(i, 1);
  const initial = (ptyOut.get(w.id) || []).join('');
  ptyOut.delete(w.id);
  const proc = ptys.get(w.id);
  if (!proc) return null;
  if (opts.cols > 0 && opts.rows > 0 && (opts.cols !== w.cols || opts.rows !== w.rows)) {
    try { proc.resize(opts.cols, opts.rows); } catch {}
    // remember the real size so the next launch spawns it right away
    const sizes = [...(settings.startupSizes || [])];
    sizes[w.index] = { cols: opts.cols, rows: opts.rows };
    settings.startupSizes = sizes;
    saveSettings(settings);
  }
  return { id: w.id, profile: w.profile, initial };
}

// ---------------------------------------------------------------- window
let win;

// acrylic / mica / tabbed: Windows 11 material (Windows rounds the window to 8px)
// transparent: truly transparent window (the app draws corners and transparency; restart needed)
// none: opaque
const MATERIALS = ['acrylic', 'mica', 'tabbed'];
let createdTransparent = false;

function applyWindowEffect() {
  if (!win || process.platform !== 'win32' || createdTransparent) return;
  try { win.setBackgroundMaterial(MATERIALS.includes(settings.windowEffect) ? settings.windowEffect : 'none'); } catch {}
  try { win.setBackgroundColor(MATERIALS.includes(settings.windowEffect) ? '#00000000' : '#0b0a10'); } catch {}
}

function applyAutoStart() {
  if (process.platform !== 'win32') return;
  // Unpackaged: electron.exe + app path. Packaged: just the exe.
  const args = app.isPackaged ? ['--autostart'] : [path.resolve(__dirname), '--autostart'];
  try { app.setLoginItemSettings({ openAtLogin: !!settings.autoStart, path: process.execPath, args, name: 'NeonTerminal' }); } catch {}
}

// ---------------------------------------------------------------- taskbar icon
// Without this, pinning the app makes Windows show electron.exe's icon.
// installed: the icon lives inside the executable (Windows can't read files inside the asar)
const ICON_ICO = app.isPackaged ? process.execPath : path.join(__dirname, 'src', 'icon-hex.ico');

function relaunchArgs() { return app.isPackaged ? '' : `"${path.resolve(__dirname)}"`; }

function applyTaskbarIdentity() {
  if (process.platform !== 'win32' || !win) return;
  try {
    win.setAppDetails({
      appId: APP_ID,
      appIconPath: ICON_ICO,
      appIconIndex: 0,
      relaunchCommand: `"${process.execPath}" ${relaunchArgs()}`.trim(),
      relaunchDisplayName: 'Neon Terminal'
    });
  } catch {}
}

// Keeps the shortcuts (Start Menu and Desktop) with the right icon and AppUserModelID
function ensureShortcuts() {
  if (process.platform !== 'win32') return;
  const targets = [
    path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Neon Terminal.lnk'),
    path.join(app.getPath('desktop'), 'Neon Terminal.lnk')
  ];
  for (const lnk of targets) {
    if (lnk.includes('Desktop') && !exists(lnk)) continue; // don't recreate the desktop shortcut if you deleted it
    try {
      shell.writeShortcutLink(lnk, exists(lnk) ? 'replace' : 'create', {
        target: process.execPath,
        args: relaunchArgs(),
        cwd: __dirname,
        icon: ICON_ICO,
        iconIndex: 0,
        appUserModelId: APP_ID,
        description: tr('shortcut.desc')
      });
    } catch {}
  }
}

// ---------------------------------------------------------------- notification window
let notifyWin = null;
let notifyQueue = [];
let notifyReady = false;
let uiStyle = {};
const NOTIFY_W = 380;

function positionNotify(height) {
  if (!notifyWin) return;
  const { screen } = require('electron');
  const area = screen.getPrimaryDisplay().workArea;
  const pos = settings.notifyPosition || 'bottom-right';
  const h = Math.max(10, Math.min(height, area.height - 20));
  const x = pos.endsWith('left') ? area.x + 6 : area.x + area.width - NOTIFY_W - 6;
  const y = pos.startsWith('top') ? area.y + 6 : area.y + area.height - h - 6;
  notifyWin.setBounds({ x, y, width: NOTIFY_W, height: h });
}

function ensureNotifyWin() {
  if (notifyWin && !notifyWin.isDestroyed()) return notifyWin;
  notifyReady = false;
  notifyWin = new BrowserWindow({
    width: NOTIFY_W, height: 10, frame: false, transparent: true, resizable: false, movable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: false, show: false, hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false }
  });
  notifyWin.setAlwaysOnTop(true, 'screen-saver');
  notifyWin.loadFile(path.join(__dirname, 'src', 'notify.html'));
  notifyWin.webContents.once('did-finish-load', () => {
    notifyReady = true;
    for (const n of notifyQueue) notifyWin.webContents.send('notify:show', n);
    notifyQueue = [];
  });
  notifyWin.on('closed', () => { notifyWin = null; });
  return notifyWin;
}

function showNotification(n) {
  const payload = { ...n, style: { ...uiStyle, sound: settings.notifySound, duration: settings.notifyDuration, position: settings.notifyPosition } };
  ensureNotifyWin();
  if (notifyReady) notifyWin.webContents.send('notify:show', payload);
  else notifyQueue.push(payload);
  if (win && !win.isFocused()) win.flashFrame(true);
}

function createWindow() {
  const { screen } = require('electron');
  const area = screen.getPrimaryDisplay().workArea;
  createdTransparent = settings.windowEffect === 'transparent';
  // last size and position (if still within a screen)
  const saved = settings.windowBounds;
  const visible = saved && screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return saved.x + 80 < a.x + a.width && saved.x + saved.width - 80 > a.x && saved.y + 40 < a.y + a.height && saved.y + 20 > a.y - 20;
  });
  const width = visible ? saved.width : settings.windowWidth || 780;
  const height = visible ? saved.height : settings.windowHeight || 580;
  win = new BrowserWindow({
    width,
    height,
    // by default, bottom-right corner like a floating chat
    x: visible ? saved.x : area.x + area.width - width - 24,
    y: visible ? saved.y : area.y + area.height - height - 24,
    minWidth: 420,
    minHeight: 300,
    alwaysOnTop: !!settings.alwaysOnTop,
    frame: false,
    transparent: createdTransparent,
    backgroundColor: createdTransparent || MATERIALS.includes(settings.windowEffect) ? '#00000000' : '#0b0a10',
    backgroundMaterial: process.platform === 'win32' && MATERIALS.includes(settings.windowEffect) ? settings.windowEffect : undefined,
    title: 'Neon Terminal',
    icon: path.join(__dirname, 'src', 'icon-hex.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      plugins: true // PDF viewer for file preview
    }
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  // automated tests (see diag.js)
  if (process.env.NEON_SCREENSHOT) require('./diag')({ app, win, ptys, getNotifyWin: () => notifyWin, showNotification });
  win.on('focus', () => win.flashFrame(false));
  applyTaskbarIdentity();
  if (visible && saved.maximized) win.maximize();
  // save size/position when they change (and on close)
  let boundsTimer = null;
  const saveBounds = () => {
    if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen() || process.env.NEON_SCREENSHOT) return;
    const b = win.getNormalBounds(); // "restored" size even when maximized
    settings.windowBounds = { x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() };
    saveSettings(settings);
  };
  const queueSave = () => { clearTimeout(boundsTimer); boundsTimer = setTimeout(saveBounds, 600); };
  win.on('resize', queueSave);
  win.on('move', queueSave);
  win.on('close', () => { clearTimeout(boundsTimer); saveBounds(); });
  win.on('maximize', () => win.webContents.send('win:state', 'maximized'));
  win.on('unmaximize', () => win.webContents.send('win:state', 'normal'));
  win.on('closed', () => {
    for (const p of ptys.values()) { try { p.kill(); } catch {} }
    ptys.clear();
    win = null;
    if (notifyWin) notifyWin.destroy();
  });
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  if (!settings.globalHotkey) return;
  try {
    globalShortcut.register(settings.globalHotkey, () => {
      if (!win) return createWindow();
      if (win.isVisible() && win.isFocused()) win.hide();
      else { win.show(); win.focus(); }
    });
  } catch {}
}

// ---------------------------------------------------------------- system stats
let lastCpu = os.cpus();
function cpuPercent() {
  const now = os.cpus();
  let idle = 0, total = 0;
  now.forEach((c, i) => {
    const prev = lastCpu[i] ? lastCpu[i].times : c.times;
    for (const k in c.times) total += c.times[k] - prev[k];
    idle += c.times.idle - prev.idle;
  });
  lastCpu = now;
  return total ? Math.round(100 * (1 - idle / total)) : 0;
}

setInterval(() => {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('sys:stats', {
    cpu: cpuPercent(),
    memUsed: os.totalmem() - os.freemem(),
    memTotal: os.totalmem()
  });
}, 2000);

// ---------------------------------------------------------------- IPC
ipcMain.handle('pty:create', (e, opts) => adoptPrewarmed(opts) || createPty(opts));
ipcMain.on('pty:write', (e, id, data) => { const p = ptys.get(id); if (p) p.write(data); });
ipcMain.on('pty:resize', (e, id, cols, rows) => {
  const p = ptys.get(id);
  if (p && cols > 0 && rows > 0) { try { p.resize(cols, rows); } catch {} }
});
ipcMain.on('pty:kill', (e, id) => { const p = ptys.get(id); if (p) { try { p.kill(); } catch {} ptys.delete(id); } });

ipcMain.handle('profiles:list', () => profiles);
ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:defaults', () => DEFAULT_SETTINGS);
ipcMain.handle('settings:set', (e, patch) => {
  const prevEffect = settings.windowEffect;
  const prevHotkey = settings.globalHotkey;
  settings = { ...settings, ...patch };
  saveSettings(settings);
  if (settings.windowEffect !== prevEffect) applyWindowEffect();
  if (settings.globalHotkey !== prevHotkey) registerHotkey();
  if ('autoStart' in patch) applyAutoStart();
  if ('alwaysOnTop' in patch && win) win.setAlwaysOnTop(!!settings.alwaysOnTop);
  if (['claudeArgs', 'claudeCwd', 'sshHosts', 'customProfiles'].some(k => k in patch)) refreshProfiles();
  return settings;
});
ipcMain.handle('settings:reset', () => {
  // keeps the window size; everything else goes back to defaults
  settings = { ...DEFAULT_SETTINGS, windowBounds: settings.windowBounds };
  saveSettings(settings);
  applyWindowEffect(); registerHotkey(); applyAutoStart(); refreshProfiles();
  if (win) win.setAlwaysOnTop(!!settings.alwaysOnTop);
  return settings;
});
function refreshProfiles() {
  profiles = detectProfiles();
  if (win && !win.isDestroyed()) win.webContents.send('profiles:changed', profiles);
}
ipcMain.on('settings:open-file', () => shell.openPath(SETTINGS_FILE));
ipcMain.handle('settings:path', () => SETTINGS_FILE);

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win:close', () => win && win.close());
ipcMain.on('win:fullscreen', () => win && win.setFullScreen(!win.isFullScreen()));
ipcMain.on('win:devtools', () => win && win.webContents.toggleDevTools());
ipcMain.on('open:external', (e, url) => { if (/^(https?|mailto):/i.test(url)) shell.openExternal(url); });
ipcMain.on('open:path', (e, p) => shell.openPath(p));
ipcMain.handle('clip:read', async () => { try { return String(await require('electron').clipboard.readText() || ''); } catch { return ''; } });
ipcMain.handle('clip:write', async (e, t) => { try { await require('electron').clipboard.writeText(String(t ?? '')); return true; } catch { return false; } });
ipcMain.on('notify:show', (e, n) => showNotification(n));
ipcMain.on('notify:resize', (e, h) => {
  if (!notifyWin) return;
  positionNotify(h + 4);
  if (h > 0 && !notifyWin.isVisible()) notifyWin.showInactive();
});
ipcMain.on('notify:empty', () => { if (notifyWin) notifyWin.hide(); });
ipcMain.on('notify:click', (e, ptyId) => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
  win.webContents.send('pty:focus', ptyId);
});
ipcMain.on('notify:clear', (e, ptyId) => { if (notifyWin && notifyReady) notifyWin.webContents.send('notify:clear', ptyId); });
ipcMain.on('theme:ui', (e, style) => { uiStyle = style; });
ipcMain.handle('dialog:image', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: tr('dlg.pickImage'),
    properties: ['openFile'],
    filters: [{ name: tr('dlg.images'), extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'] }]
  });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('dialog:key', async () => {
  const r = await dialog.showOpenDialog(win, { title: tr('dlg.pickKey'), defaultPath: path.join(os.homedir(), '.ssh'), properties: ['openFile', 'showHiddenFiles'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('theme:export', async (e, name, data) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: `${name}.neon-theme.json`, filters: [{ name: tr('dlg.theme'), extensions: ['json'] }] });
  if (r.canceled) return false;
  fs.writeFileSync(r.filePath, JSON.stringify(data, null, 2));
  return true;
});
ipcMain.handle('theme:import', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: tr('dlg.theme'), extensions: ['json'] }] });
  if (r.canceled) return null;
  try { return JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch { return null; }
});
ipcMain.handle('dialog:confirm', async (e, message) => {
  const r = await dialog.showMessageBox(win, { type: 'question', buttons: [tr('dlg.close'), tr('dlg.cancel')], defaultId: 1, cancelId: 1, message });
  return r.response === 0;
});

const irc = require('./irc')(ipcMain, () => win);
app.on('before-quit', () => irc.closeAll());

// ---------------------------------------------------------------- lifecycle
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

// only the permissions the app uses (system fonts, capture for recording, clipboard, full screen)
const ALLOWED_PERMISSIONS = new Set(['local-fonts', 'media', 'display-capture', 'clipboard-read', 'clipboard-sanitized-write', 'fullscreen']);

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(ALLOWED_PERMISSIONS.has(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => ALLOWED_PERMISSIONS.has(perm));
  const { desktopCapturer } = require('electron');
  require('./main-features')({ ipcMain, dialog, app, session, desktopCapturer, getWin: () => win, findInPath, tr });
  createWindow();
  registerHotkey();
  // not needed to show the window: done once it has loaded
  setTimeout(() => { ensureShortcuts(); applyAutoStart(); }, 3000);
});
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
