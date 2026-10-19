// NEON TERMINAL — renderer (core: tabs, panes, shortcuts, palette, menus)
const api = window.neon;
const $ = (s) => document.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const App = window.App = {
  settings: null,
  defaults: null,
  profiles: [],
  tabs: [],
  active: null,
  paneByPty: new Map(),
  paneByEl: new WeakMap(),
  special: {},          // built-in pane types: { monitor: {...}, irc: {...} }
  hooks: { input: [], session: [] },
  nextId: 1
};

// ------------------------------------------------------------------ shortcuts
const DEFAULT_KEYS = {
  newTab: 'Ctrl+Shift+T',
  newClaude: 'Ctrl+Shift+A',
  closePane: 'Ctrl+Shift+W',
  nextTab: 'Ctrl+Tab',
  prevTab: 'Ctrl+Shift+Tab',
  splitRight: 'Ctrl+Shift+D',
  splitDown: 'Ctrl+Shift+E',
  toggleShell: 'Ctrl+`',
  focusNextPane: 'Alt+ArrowRight',
  focusPrevPane: 'Alt+ArrowLeft',
  palette: 'Ctrl+Shift+P',
  search: 'Ctrl+Shift+F',
  history: 'Ctrl+R',
  settings: 'Ctrl+,',
  zoomIn: 'Ctrl+=',
  zoomOut: 'Ctrl+-',
  zoomReset: 'Ctrl+0',
  clear: 'Ctrl+Shift+K',
  fullscreen: 'F11',
  focusMode: 'Ctrl+Shift+M',
  quickBar: 'Ctrl+Shift+B',
  record: 'Ctrl+Alt+R',
  monitor: 'Ctrl+Shift+U',
  irc: 'Ctrl+Shift+L',
  saveWorkspace: '',
  explainLast: 'Ctrl+Shift+X',
  alwaysOnTop: 'Ctrl+Shift+Space'
};
const ACTIONS = Object.keys(DEFAULT_KEYS);
const actionLabel = (a) => t('act.' + a);

function keyString(e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  let k = e.key;
  if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
  else if (e.code === 'Backquote') k = '`';
  else if (e.code === 'Equal') k = '=';
  else if (e.code === 'Minus') k = '-';
  else if (e.code === 'Comma') k = ',';
  else if (e.code === 'Space') k = 'Space';
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return '';
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join('+');
}

function keymap() {
  const map = {};
  const binds = { ...DEFAULT_KEYS, ...(App.settings.keybindings || {}) };
  for (const [action, combo] of Object.entries(binds)) if (combo) map[combo.replace(/\+([a-z])$/, (m, c) => '+' + c.toUpperCase())] = action;
  for (let i = 1; i <= 9; i++) map['Ctrl+' + i] = 'tab' + i;
  return map;
}

// Ctrl+R inside Claude Code belongs to it (chat history): don't intercept it
function appAction(e, pane) {
  if (!App.settings) return null; // still loading
  const action = keymap()[keyString(e)];
  if (!action) return null;
  if (action === 'history' && pane && (isClaude(pane.profile?.id) || pane.kind)) return null;
  return action;
}

function handleShortcut(e) {
  const action = appAction(e, App.active?.focused);
  if (!action) return false;
  e.preventDefault();
  runAction(action);
  return true;
}

// ------------------------------------------------------------------ themes
function allThemes() { return { ...window.NEON_THEMES, ...(App.dynamicThemes || {}), ...(App.settings.customThemes || {}) }; }

function effectiveThemeId() { return (window.Features && Features.autoThemeId && Features.autoThemeId()) || App.settings.theme; }

function currentTheme() {
  const themes = allThemes();
  const base = themes[effectiveThemeId()] || themes.claude;
  const parent = base.base && themes[base.base] ? themes[base.base] : window.NEON_THEMES.claude;
  const th = { ui: { ...parent.ui, ...(base.ui || {}) }, term: { ...parent.term, ...(base.term || {}) } };
  if (App.settings.accentOverride) { th.ui.accent = App.settings.accentOverride; th.term.cursor = App.settings.accentOverride; }
  return th;
}

function termOptions() {
  const s = App.settings;
  return {
    fontFamily: s.fontFamily, fontSize: s.fontSize, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
    cursorStyle: s.cursorStyle, cursorBlink: s.cursorBlink, scrollback: s.scrollback,
    allowTransparency: true, allowProposedApi: true, macOptionIsMeta: true, rightClickSelectsWord: false,
    theme: { ...currentTheme().term, background: '#00000000' } // transparent: the app paints the background
  };
}

function applySettings() {
  const s = App.settings, th = currentTheme(), root = document.documentElement.style;
  for (const k of ['accent', 'accent2', 'bg', 'surface', 'text', 'muted']) root.setProperty('--' + k, th.ui[k]);
  root.setProperty('--term-opacity', s.opacity);
  root.setProperty('--radius', s.borderRadius + 'px');
  // Windows 11 rounds opaque/material windows to 8px by itself: the app border must match.
  const nativeRound = api.isWin11 && s.windowEffect !== 'transparent';
  root.setProperty('--win-radius', (nativeRound ? 8 : api.platform === 'win32' && s.windowEffect !== 'transparent' ? 0 : s.borderRadius) + 'px');
  root.setProperty('--glow', s.glowStrength + 'px');
  root.setProperty('--gap', s.paneGap + 'px');
  root.setProperty('--pad', s.padding + 'px');
  root.setProperty('--ui-font', s.uiFont);
  root.setProperty('--term-font', s.fontFamily);
  const bgImage = s.backgroundImage || (s.wallpaperAsBackground && App.wallpaperPath) || '';
  root.setProperty('--bg-img', bgImage ? `url("${fileUrl(bgImage)}")` : 'none');
  root.setProperty('--bg-img-opacity', s.backgroundImageOpacity);
  root.setProperty('--bg-blur', s.backgroundBlur + 'px');
  root.setProperty('--bg-size', s.backgroundFit === 'tile' || s.backgroundFit === 'center' ? 'auto' : s.backgroundFit);
  root.setProperty('--bg-repeat', s.backgroundFit === 'tile' ? 'repeat' : 'no-repeat');
  document.body.classList.toggle('glow', !!s.glow && s.renderer !== 'webgl');
  document.body.classList.toggle('scanlines', !!s.scanlines);
  document.body.classList.toggle('gradient', !!s.gradient);
  document.body.classList.toggle('border-glow', !!s.borderGlow);
  document.body.classList.toggle('focus-mode', !!s.focusMode);
  $('#pin-btn').classList.toggle('on', !!s.alwaysOnTop);
  $('#quickbar').classList.toggle('hidden', !s.showQuickBar);

  const opts = termOptions();
  for (const tab of App.tabs) for (const p of tab.panes) {
    for (const k of ['fontFamily', 'fontSize', 'lineHeight', 'letterSpacing', 'cursorStyle', 'cursorBlink', 'scrollback', 'theme']) p.term.options[k] = opts[k];
    if (!p.kind) setRenderer(p);
    fitPane(p);
  }
  NeonFX.set({ effect: s.backgroundEffect, color: s.effectColor || th.ui.accent, color2: th.ui.accent2, intensity: s.effectIntensity, speed: s.effectSpeed ?? 1 });
  api.sendUiStyle({ ...th.ui, radius: s.borderRadius, font: s.uiFont });
  window.Features && Features.renderQuickBar && Features.renderQuickBar();
}

function fileUrl(p) {
  if (/^(https?|file|data|blob):/i.test(p)) return p;
  return 'file:///' + encodeURI(p.replace(/\\/g, '/')).replace(/#/g, '%23');
}

// debounced save, accumulating the patch so quick changes aren't lost
let saveTimer = null;
const pendingPatch = {};
function setSetting(patch, { silent } = {}) {
  Object.assign(pendingPatch, patch);
  const langChanged = 'language' in patch && patch.language !== App.settings.language;
  App.settings = { ...App.settings, ...patch };
  if (langChanged) applyLanguage();
  if (!silent) applySettings();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { const p = { ...pendingPatch }; for (const k in pendingPatch) delete pendingPatch[k]; api.settings.set(p); }, 200);
}

function applyLanguage() {
  t.setLang(App.settings.language || 'ca');
  t.apply();
  renderTabs();
  updateStatus();
  for (const tab of App.tabs) for (const p of tab.panes) { renderPaneLabel(p); if (p.kind && App.special[p.kind]?.relabel) App.special[p.kind].relabel(p); }
  window.Features && Features.renderQuickBar && Features.renderQuickBar();
}

// ------------------------------------------------------------------ Claude notifications
function paneVisibleToUser(pane) { return document.hasFocus() && !document.hidden && App.active === pane.tab; }

api.onClaudeEvent(({ ptyId, event, message }) => {
  const pane = App.paneByPty.get(ptyId);
  if (!pane) return;
  let kind = event;
  if (event === 'notification') kind = /permission|permís|permiso|approve/i.test(message) ? 'permission' : 'waiting';
  // the "waiting for input" message comes after a Stop: don't repeat it
  if (kind === 'waiting' && pane.lastClaudeEvent === 'stop' && Date.now() - pane.lastClaudeAt < 120000) return;
  pane.lastClaudeEvent = kind;
  pane.lastClaudeAt = Date.now();

  const visible = paneVisibleToUser(pane);
  if (!visible) { pane.tab.attention = kind; renderTabs(); }
  const mode = App.settings.notifyMode;
  if (mode === 'off') return;
  if (mode === 'auto' && visible) {
    if (pane !== pane.tab.focused || kind !== 'stop') pane.el.animate([{ boxShadow: '0 0 34px var(--accent)' }, { boxShadow: 'none' }], 900);
    return;
  }
  const where = pane.cwd ? pane.cwd.split(/[\\/]/).filter(Boolean).pop() : '';
  const clean = String(message || '').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();
  notify({ kind, ptyId, message: clean || (kind === 'stop' ? t('notify.ready') : ''), where: t('notify.where', { n: App.tabs.indexOf(pane.tab) + 1 }) + (where ? ' · ' + where : '') });
});

// sends an app notification with already translated texts
function notify(n) {
  const titles = { stop: 'notify.stop', question: 'notify.question', permission: 'notify.permission', waiting: 'notify.waiting' };
  api.showNotification({
    ...n,
    title: n.title || (titles[n.kind] ? t(titles[n.kind]) : t('app.name')),
    button: n.button || (n.kind === 'stop' ? t('notify.view') : n.kind === 'info' ? t('notify.open') : t('notify.reply')),
    dismiss: t('notify.dismiss')
  });
}

api.onPtyFocus((ptyId) => {
  const pane = App.paneByPty.get(ptyId);
  if (!pane) return;
  activateTab(pane.tab);
  focusPane(pane);
});

window.addEventListener('focus', () => {
  const tab = App.active;
  if (tab && tab.attention) { tab.attention = null; renderTabs(); }
});

// ------------------------------------------------------------------ panes
function setRenderer(pane) {
  const want = App.settings.renderer === 'webgl';
  if (want && !pane.webgl) {
    try {
      pane.webgl = new WebglAddon.WebglAddon();
      pane.webgl.onContextLoss(() => { pane.webgl.dispose(); pane.webgl = null; });
      pane.term.loadAddon(pane.webgl);
    } catch { pane.webgl = null; }
  } else if (!want && pane.webgl) {
    pane.webgl.dispose(); pane.webgl = null;
  }
}

function fitPane(p) {
  if (!p.el.isConnected || !p.el.offsetParent) return;
  try {
    if (p.kind) return p.fit.fit();
    const b = p.term.buffer.active, atBottom = b.viewportY >= b.baseY;
    p.fit.fit();
    // with some heights/scalings the last row overflows a few pixels and gets clipped: drop one
    const scr = p.termEl.querySelector('.xterm-screen');
    if (scr && scr.getBoundingClientRect().height > p.termEl.getBoundingClientRect().height + 0.5 && p.term.rows > 2) p.term.resize(p.term.cols, p.term.rows - 1);
    if (atBottom) p.term.scrollToBottom();
  } catch {}
}

function profileById(id) { return App.profiles.find(p => p.id === id); }
// 'claude' or an extra account ('claude:<id>')
function isClaude(id) { return id === 'claude' || String(id || '').startsWith('claude:'); }
// the Claude account to open by default: the default profile if it's one, otherwise the main one
function defaultClaude() { const d = App.settings.defaultProfile; return isClaude(d) && profileById(d) ? d : 'claude'; }
function profileName(p) { return p?.kind ? t('profile.' + p.kind) : p?.name || '…'; }

function renderPaneLabel(pane) {
  if (!pane.profile) return;
  pane.label.innerHTML = icon(pane.profile.icon) + '<span>' + esc(profileName(pane.profile)) + '</span>';
}

// Creates a pane. opts: { cwd, extraArgs }
async function createPane(tab, profileId, place = (paneEl) => tab.el.appendChild(paneEl), opts = {}) {
  const profile = profileById(profileId);
  const pane = { id: App.nextId++, tab, profileId, title: '', cwd: opts.cwd || '', exited: false };
  pane.el = el('div', 'pane');
  pane.label = el('div', 'pane-label');
  pane.el.append(pane.label);
  App.paneByEl.set(pane.el, pane);

  // built-in app panes (monitor, IRC): no process
  if (profile && profile.kind && App.special[profile.kind]) {
    pane.kind = profile.kind;
    pane.profile = { id: profile.id, name: profile.name, icon: profile.icon, kind: profile.kind };
    pane.body = el('div', 'special-body ' + profile.kind);
    pane.el.append(pane.body);
    pane.el.tabIndex = -1;
    pane.term = {
      options: {}, cols: 0, rows: 0, focus: () => (pane.focusTarget || pane.el).focus(), dispose: () => {}, clear: () => {}, reset: () => {}, write: () => {},
      hasSelection: () => false, getSelection: () => '', clearSelection: () => {}, buffer: { active: { length: 0, viewportY: 0, getLine: () => undefined } }
    };
    pane.fit = { fit: () => App.special[pane.kind].resize?.(pane) };
    pane.search = { findNext() {}, findPrevious() {}, clearDecorations() {} };
    place(pane.el);
    pane.el.addEventListener('mousedown', () => setFocused(pane));
    renderPaneLabel(pane);
    tab.panes.push(pane);
    App.special[pane.kind].mount(pane);
    new ResizeObserver(() => fitPane(pane)).observe(pane.el);
    renderTabs(); updateStatus(); saveSessionSoon();
    return pane;
  }

  pane.termEl = el('div', 'term');
  pane.exitHint = el('div', 'exit-hint');
  pane.el.append(pane.termEl, pane.exitHint);

  const term = pane.term = new Terminal(termOptions());
  pane.fit = new FitAddon.FitAddon();
  pane.search = new SearchAddon.SearchAddon();
  term.loadAddon(pane.fit);
  term.loadAddon(pane.search);
  term.loadAddon(new WebLinksAddon.WebLinksAddon((e, uri) => api.openExternal(uri)));
  term.loadAddon(new Unicode11Addon.Unicode11Addon());
  term.unicode.activeVersion = '11';

  term.attachCustomKeyEventHandler((e) => {
    if (e.type !== 'keydown') return true;
    if (appAction(e, pane)) return false; // app shortcut
    // Ctrl+C with a selection = copy
    if (e.ctrlKey && !e.shiftKey && e.code === 'KeyC' && term.hasSelection()) { api.clipboard.write(term.getSelection()); term.clearSelection(); toast(t('toast.copied')); e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyC') { if (term.hasSelection()) api.clipboard.write(term.getSelection()); e.preventDefault(); return false; }
    // Ctrl+V: paste text. Without text (e.g. an image), send ^V: Claude Code uses it to paste images
    if (e.ctrlKey && !e.altKey && e.code === 'KeyV') {
      e.preventDefault();
      api.clipboard.read().then((text) => { if (text) term.paste(text); else if (!e.shiftKey) writePane(pane, '\x16'); });
      return false;
    }
    // Shift+Enter = new line in Claude Code (sends Meta+Enter)
    if (e.shiftKey && !e.ctrlKey && !e.altKey && e.key === 'Enter') { writePane(pane, '\x1b\r'); e.preventDefault(); return false; }
    return true;
  });

  place(pane.el);
  term.open(pane.termEl);
  setRenderer(pane);
  fitPane(pane);

  term.parser.registerOscHandler(7777, (data) => { handleOsc(pane, data); return true; });
  registerCommandLinks(pane);
  term.onTitleChange((title) => { pane.title = title; renderTabs(); });
  term.onSelectionChange(() => { if (App.settings.copyOnSelect && term.hasSelection()) api.clipboard.write(term.getSelection()); });
  term.onBell(() => { if (App.settings.bellSound) beep(); pane.el.animate([{ boxShadow: '0 0 30px var(--accent)' }, { boxShadow: 'none' }], 400); });
  term.onData((d) => {
    if (pane.exited) { if (d === '\r') restartPane(pane); return; }
    writePane(pane, d);
    for (const h of App.hooks.input) h(pane, d);
  });
  term.onResize(({ cols, rows }) => { if (pane.ptyId) api.pty.resize(pane.ptyId, cols, rows); updateStatus(); });
  term.textarea.addEventListener('focus', () => setFocused(pane));
  pane.el.addEventListener('mousedown', () => setFocused(pane));
  pane.el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (term.hasSelection()) { api.clipboard.write(term.getSelection()); term.clearSelection(); toast(t('toast.copied')); }
    else if (App.settings.rightClickPaste) api.clipboard.read().then((txt) => { if (txt) term.paste(txt); });
  });
  new ResizeObserver(() => fitPane(pane)).observe(pane.el);

  tab.panes.push(pane);
  await spawnPty(pane, opts.extraArgs);
  saveSessionSoon();
  return pane;
}

async function spawnPty(pane, extraArgs) {
  const { term } = pane;
  const res = await api.pty.create({ profileId: pane.profileId, cols: term.cols, rows: term.rows, cwd: pane.cwd || undefined, extraArgs });
  pane.ptyId = res.id;
  pane.profile = res.profile;
  pane.profileId = res.profile.id;
  pane.exited = false;
  pane.el.classList.remove('exited');
  pane.exitHint.textContent = t('pane.exitedHint');
  renderPaneLabel(pane);
  if (isClaude(res.profile.id) && !pane.cwd) pane.cwd = App.settings.claudeCwd || '';
  if (res.initial) term.write(res.initial); // output of a pty spawned while the window loaded
  App.paneByPty.set(res.id, pane);
  renderTabs();
  updateStatus();
}

function writePane(pane, data) { if (pane.ptyId && !pane.exited) api.pty.write(pane.ptyId, data); }

async function restartPane(pane) {
  pane.term.reset();
  await spawnPty(pane);
}

api.pty.onData((id, data) => { const p = App.paneByPty.get(id); if (p) p.term.write(data); });
api.pty.onExit((id, code) => {
  const p = App.paneByPty.get(id);
  if (!p) return;
  App.paneByPty.delete(id);
  p.exited = true;
  p.ptyId = null;
  p.el.classList.add('exited');
  p.exitHint.textContent = t('pane.exitedHint');
  p.term.write(`\r\n\x1b[2m${t('pane.exited', { code })}\x1b[0m\r\n`);
});

// ------------------------------------------------------------------ clickable commands
// Detects install commands in the output and makes them runnable with one click
const RUNNABLE_RE = new RegExp(
  '(?:winget\\s+(?:install|upgrade|search)|choco\\s+install|scoop\\s+install|pipx?\\s+install|pip3\\s+install|py(?:thon)?3?\\s+-m\\s+pip\\s+install|' +
  'npm\\s+(?:i|install)|pnpm\\s+(?:add|install)|yarn\\s+(?:global\\s+)?add|bun\\s+(?:add|install)|cargo\\s+install|go\\s+install|gem\\s+install|' +
  'dotnet\\s+tool\\s+install|Install-Module|Install-Package|wsl\\s+--install|rustup\\s+(?:install|component\\s+add)|' +
  // Neon's own update commands (shell/neon-audit.ps1)
  'srvupgrade|\\bupgrade(?=\\s+(?:all|win)\\b))' +
  '\\s+[^`\'"()\\[\\]<>|&;\\r\\n]*?(?=\\s{2,}|[`\'"()\\[\\]<>|&;]|\\s*$)', 'gi');

function findRunnable(text) {
  const out = [];
  RUNNABLE_RE.lastIndex = 0;
  let m;
  while ((m = RUNNABLE_RE.exec(text))) {
    const cmd = m[0].replace(/[\s.,:;!?\\]+$/, '');
    if (cmd.split(/\s+/).length < 3 && !/^(wsl|Install-Module|Install-Package|srvupgrade|upgrade)/i.test(cmd)) continue; // needs at least one package
    out.push({ index: m.index, cmd });
  }
  return out;
}

let linkTip;
function showLinkTip(e, text) {
  if (!linkTip) { linkTip = el('div', 'link-tip'); document.body.appendChild(linkTip); }
  linkTip.innerHTML = `${icon('play')}<span>${esc(t('link.run'))}</span><code>${esc(text)}</code>`;
  linkTip.style.left = Math.min(e.clientX + 12, window.innerWidth - 340) + 'px';
  linkTip.style.top = e.clientY + 18 + 'px';
  linkTip.classList.add('show');
}
function hideLinkTip() { if (linkTip) linkTip.classList.remove('show'); }

function registerCommandLinks(pane) {
  const term = pane.term;
  term.registerLinkProvider({
    provideLinks(y, callback) {
      if (App.settings.clickableCommands === false) return callback(undefined);
      const line = term.buffer.active.getLine(y - 1);
      if (!line) return callback(undefined);
      const links = findRunnable(line.translateToString(true)).map(({ index, cmd }) => ({
        text: cmd,
        range: { start: { x: index + 1, y }, end: { x: index + cmd.length, y } },
        decorations: { underline: true, pointerCursor: true },
        activate: (e, txt) => { hideLinkTip(); runCommandFrom(pane, txt); },
        hover: (e, txt) => showLinkTip(e, txt),
        leave: () => hideLinkTip()
      }));
      callback(links.length ? links : undefined);
    }
  });
}

// Runs a command in a shell: if it comes from Claude (or a built-in pane), uses or opens a shell
async function shellPaneFor(pane) {
  if (pane && !pane.kind && !isClaude(pane.profile?.id) && !pane.exited) return pane;
  const tab = pane ? pane.tab : App.active;
  let target = tab.panes.find(p => !p.kind && !isClaude(p.profile?.id) && !p.exited);
  if (!target) {
    activateTab(tab);
    if (pane) focusPane(pane);
    target = await splitPane('column', App.settings.startupSplit || 'powershell', App.settings.splitRatio);
    await sleep(1800); // wait for the new shell's prompt
  }
  return target;
}
async function runCommandFrom(pane, cmd) {
  const target = await shellPaneFor(pane);
  writePane(target, cmd + '\r');
  focusPane(target);
  toast(t('toast.running', { cmd }));
}

function setFocused(pane) {
  const tab = pane.tab;
  tab.focused = pane;
  if (pane.ptyId) api.clearNotification(pane.ptyId); // you're looking at it: dismiss its notifications
  for (const p of tab.panes) p.el.classList.toggle('focused', p === pane && tab.panes.length > 1);
  updateStatus();
  if (tab.panes.length > 1) renderTabs();
}

function focusPane(pane) { if (pane) { setFocused(pane); pane.term.focus(); } }

// ------------------------------------------------------------------ splits (nested)
function makeSplitter() {
  const sp = el('div', 'splitter');
  sp.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const a = sp.previousElementSibling, b = sp.nextElementSibling;
    const row = sp.parentElement.classList.contains('row');
    const start = row ? e.clientX : e.clientY;
    const sa = row ? a.offsetWidth : a.offsetHeight, sb = row ? b.offsetWidth : b.offsetHeight;
    const ga = parseFloat(a.style.flexGrow || 1), gb = parseFloat(b.style.flexGrow || 1);
    sp.classList.add('active');
    const move = (ev) => {
      const d = (row ? ev.clientX : ev.clientY) - start;
      const na = Math.max(60, sa + d), nb = Math.max(60, sb - d), total = ga + gb;
      a.style.flexGrow = total * na / (na + nb);
      b.style.flexGrow = total * nb / (na + nb);
    };
    const up = () => { sp.classList.remove('active'); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); saveSessionSoon(); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
  return sp;
}

const setDir = (box, dir) => { box.classList.remove('row', 'column'); box.classList.add(dir); };

async function splitPane(direction, profileId, ratio) {
  const tab = App.active;
  if (!tab) return;
  const target = tab.focused || tab.panes[tab.panes.length - 1];
  // default: below Claude opens a shell; below a shell, the same shell
  const fromClaude = isClaude(target?.profile?.id) || target?.kind;
  const pid = profileId || (fromClaude ? (App.settings.startupSplit || 'powershell') : (target?.profileId || App.settings.defaultProfile));

  const box = target.el.parentElement;
  const boxCount = [...box.children].filter(c => !c.classList.contains('splitter')).length;
  const sp = makeSplitter();
  const place = (paneEl) => {
    if (boxCount === 1 || box.classList.contains(direction)) {
      setDir(box, direction);
      target.el.after(sp, paneEl);
    } else {
      // different direction: the focused pane becomes a sub-container
      const sub = el('div', 'split ' + direction);
      sub.style.flexGrow = target.el.style.flexGrow || 1;
      target.el.style.flexGrow = 1;
      target.el.replaceWith(sub);
      sub.append(target.el, sp, paneEl);
    }
    if (ratio) {
      target.el.style.flexGrow = (1 - ratio) * 10;
      paneEl.style.flexGrow = ratio * 10;
    }
  };
  const pane = await createPane(tab, pid, place);
  tab.el.classList.toggle('single', tab.panes.length === 1);
  focusPane(pane);
  return pane;
}

function disposePane(pane) {
  if (pane.ptyId) { api.pty.kill(pane.ptyId); App.paneByPty.delete(pane.ptyId); }
  if (pane.kind) App.special[pane.kind]?.unmount?.(pane);
  pane.term.dispose();
}

function closePane(pane) {
  pane = pane || App.active?.focused;
  if (!pane) return;
  const tab = pane.tab;
  disposePane(pane);
  const box = pane.el.parentElement;
  const sp = pane.el.previousElementSibling?.classList.contains('splitter') ? pane.el.previousElementSibling : pane.el.nextElementSibling;
  if (sp && sp.classList.contains('splitter')) sp.remove();
  pane.el.remove();
  // a sub-container with a single child is dissolved
  const kids = [...box.children];
  if (box !== tab.el && kids.length === 1) {
    kids[0].style.flexGrow = box.style.flexGrow || 1;
    box.replaceWith(kids[0]);
  }
  tab.panes = tab.panes.filter(p => p !== pane);
  if (!tab.panes.length) return closeTab(tab);
  tab.el.classList.toggle('single', tab.panes.length === 1);
  focusPane(tab.panes[tab.panes.length - 1]);
  renderTabs();
  saveSessionSoon();
}

// ------------------------------------------------------------------ tabs
// Queued: opening a terminal inside a hidden tab makes xterm measure 0px and hang
let tabQueue = Promise.resolve();
function newTab(...args) {
  const run = tabQueue.then(() => createTab(...args));
  tabQueue = run.catch(() => {});
  return run;
}

function makeTab() {
  const tab = { id: App.nextId++, panes: [], focused: null };
  tab.el = el('div', 'tab-view split row single');
  $('#workspace').appendChild(tab.el);
  App.tabs.push(tab);
  activateTab(tab);
  return tab;
}

async function createTab(profileId, { split, ratio, cwd } = {}) {
  const tab = makeTab();
  const pane = await createPane(tab, profileId || App.settings.defaultProfile, undefined, { cwd });
  focusPane(pane);
  if (split) { await splitPane('column', split, ratio); focusPane(pane); }
  return tab;
}

function activateTab(tab) {
  App.active = tab;
  tab.attention = null;
  for (const x of App.tabs) x.el.classList.toggle('active', x === tab);
  renderTabs();
  requestAnimationFrame(() => { for (const p of tab.panes) fitPane(p); if (tab.focused) tab.focused.term.focus(); updateStatus(); });
}

function closeTab(tab) {
  for (const p of [...tab.panes]) disposePane(p);
  tab.el.remove();
  const i = App.tabs.indexOf(tab);
  App.tabs.splice(i, 1);
  if (!App.tabs.length) {
    // you closed everything on purpose: next time the default layout opens
    return api.settings.set({ lastSession: null }).finally(() => api.win.close());
  }
  activateTab(App.tabs[Math.min(i, App.tabs.length - 1)]);
  saveSessionSoon();
}

// Clean title: shells set long paths (C:\Python314\python.exe, MINGW64:/c/...) → show the profile name
function paneTitle(p) {
  if (!p) return '…';
  if (p.kind) return App.special[p.kind]?.title?.(p) || profileName(p.profile);
  const name = profileName(p.profile);
  let title = (p.title || '').trim();
  if (isClaude(p.profile?.id)) {
    title = title.replace(/^[^\p{L}\p{N}]+/u, '').trim(); // Claude sets "✳ conversation topic"
    return title && !/^claude( code)?$/i.test(title) ? title : name;
  }
  if (!title || /[\\/]/.test(title) || /\.exe\b/i.test(title) || /^(MINGW|MSYS|Administrador|Administrator)/i.test(title) || title.length > 40) return name;
  return title;
}
function tabTitle(tab) { return paneTitle(tab.focused || tab.panes[0]); }

function renderTabs() {
  const box = $('#tabs');
  box.innerHTML = '';
  App.tabs.forEach((tab, i) => {
    const p = tab.focused || tab.panes[0];
    const tEl = el('div', 'tab' + (tab === App.active ? ' active' : '') + (tab.attention ? ' attention ' + tab.attention : ''));
    tEl.draggable = true;
    tEl.title = tab.panes.map(x => `${profileName(x.profile)}: ${x.title || paneTitle(x)}`).join('\n');
    const inner = el('div', 'tab-inner');
    inner.innerHTML = `<span class="tab-icon">${icon(p?.profile?.icon || 'terminal')}</span><span class="title">${esc(tabTitle(tab))}</span>${tab.panes.length > 1 ? `<span class="count">${tab.panes.length}</span>` : ''}<span class="dot"></span>`;
    const c = el('button', 'close', icon('close'));
    c.title = t('tab.close');
    c.onclick = (e) => { e.stopPropagation(); closeTab(tab); };
    inner.appendChild(c);
    tEl.appendChild(inner);
    tEl.onclick = () => activateTab(tab);
    tEl.onauxclick = (e) => { if (e.button === 1) closeTab(tab); };
    tEl.ondragstart = () => { tEl.classList.add('dragging'); App.dragTab = i; };
    tEl.ondragend = () => tEl.classList.remove('dragging');
    tEl.ondragover = (e) => e.preventDefault();
    tEl.ondrop = () => { const [m] = App.tabs.splice(App.dragTab, 1); App.tabs.splice(i, 0, m); renderTabs(); saveSessionSoon(); };
    box.appendChild(tEl);
  });
  box.querySelector('.tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
$('#tabs').addEventListener('wheel', (e) => { $('#tabs').scrollLeft += e.deltaY; e.preventDefault(); }, { passive: false });

// ------------------------------------------------------------------ session (tabs and splits layout)
function serializeNode(node) {
  const pane = App.paneByEl.get(node);
  if (pane) return { p: pane.profileId, cwd: pane.cwd || undefined, g: parseFloat(node.style.flexGrow) || undefined };
  const kids = [...node.children].filter(c => c.classList.contains('pane') || c.classList.contains('split'));
  return { d: node.classList.contains('column') ? 'column' : 'row', g: parseFloat(node.style.flexGrow) || undefined, c: kids.map(serializeNode) };
}
function serializeLayout() {
  return { active: App.tabs.indexOf(App.active), tabs: App.tabs.map(tab => serializeNode(tab.el)) };
}

async function buildNode(tab, node, container, isRoot, ctx) {
  if (node.p) {
    let pid = profileById(node.p) ? node.p : App.settings.defaultProfile;
    const extraArgs = [];
    // --continue on the first pane of each account (same rule as the prewarm in main.js)
    ctx.continued = ctx.continued || new Set();
    if (isClaude(pid) && ctx.continueClaude && !ctx.continued.has(pid)) { extraArgs.push('--continue'); ctx.continued.add(pid); }
    const pane = await createPane(tab, pid, (e) => { if (node.g) e.style.flexGrow = node.g; container.appendChild(e); }, { cwd: node.cwd, extraArgs });
    return pane;
  }
  let box = container;
  if (!isRoot) { box = el('div', 'split'); if (node.g) box.style.flexGrow = node.g; container.appendChild(box); }
  setDir(box, node.d || 'row');
  let first = null;
  for (let i = 0; i < (node.c || []).length; i++) {
    if (i > 0) box.appendChild(makeSplitter());
    const p = await buildNode(tab, node.c[i], box, false, ctx);
    first = first || p;
  }
  return first;
}

async function restoreLayout(layout, { continueClaude } = {}) {
  if (!layout || !layout.tabs || !layout.tabs.length) return false;
  const ctx = { continueClaude };
  for (const node of layout.tabs) {
    await (tabQueue = tabQueue.then(async () => {
      const tab = makeTab();
      // a tab's root is its container (tab.el); a single-pane node goes straight inside
      const first = await buildNode(tab, node, tab.el, !node.p, ctx);
      if (!tab.panes.length) { tab.el.remove(); App.tabs.splice(App.tabs.indexOf(tab), 1); return; }
      tab.el.classList.toggle('single', tab.panes.length === 1);
      if (first) focusPane(first);
    }).catch(() => {}));
  }
  const act = App.tabs[layout.active] || App.tabs[0];
  if (act) activateTab(act);
  return App.tabs.length > 0;
}

let sessionTimer = null;
function saveSessionSoon() {
  if (!App.settings || !App.booted) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => { if (App.settings.restoreSession) setSetting({ lastSession: serializeLayout() }, { silent: true }); }, 1500);
}

// ------------------------------------------------------------------ OSC commands from the shell
// The PowerShell module sends: ESC ] 7777 ; key=value BEL
function handleOsc(pane, data) {
  const i = data.indexOf('=');
  const key = i < 0 ? data : data.slice(0, i);
  const val = i < 0 ? '' : data.slice(i + 1);
  const num = parseFloat(val);
  const bool = (v) => !['off', '0', 'false', 'no'].includes(String(v).toLowerCase());
  switch (key) {
    case 'cwd': if (pane.cwd !== val) { pane.cwd = val; updateStatus(); saveSessionSoon(); } break;
    case 'theme':
      if (allThemes()[val]) { setSetting({ theme: val }); toast(t('toast.theme', { name: allThemes()[val].label })); }
      else toast(t('toast.themeUnknown', { name: val }));
      break;
    case 'effect': if (NeonFX.effects.includes(val)) setSetting({ backgroundEffect: val }); break;
    case 'intensity': if (!isNaN(num)) setSetting({ effectIntensity: num }); break;
    case 'speed': if (!isNaN(num)) setSetting({ effectSpeed: num }); break;
    case 'opacity': if (!isNaN(num)) setSetting({ opacity: Math.min(1, Math.max(0, num)) }); break;
    case 'fontsize': if (!isNaN(num)) setSetting({ fontSize: num }); break;
    case 'font': setSetting({ fontFamily: val }); break;
    case 'glow': setSetting({ glow: bool(val) }); break;
    case 'scanlines': setSetting({ scanlines: bool(val) }); break;
    case 'accent': setSetting({ accentOverride: val }); break;
    case 'bgimage': setSetting({ backgroundImage: val }); break;
    case 'blur': if (!isNaN(num)) setSetting({ backgroundBlur: num }); break;
    case 'cursor': setSetting({ cursorStyle: val }); break;
    case 'lang': if (['ca', 'es', 'en'].includes(val)) setSetting({ language: val }); break;
    case 'set': try { setSetting(JSON.parse(val)); } catch { toast(t('toast.invalidJson')); } break;
    case 'notify': notify({ kind: 'info', message: val, ptyId: pane.ptyId }); break;
    case 'toast': toast(val); break;
    case 'settings': openSettings(); break;
    case 'palette': openPalette(); break;
    case 'split': splitPane(val === 'right' ? 'row' : 'column'); break;
    case 'newtab': newTab(val || undefined); break;
    case 'top': setSetting({ alwaysOnTop: bool(val) }); break;
    case 'focus': setSetting({ focusMode: bool(val) }); break;
    default: window.Features && Features.osc && Features.osc(pane, key, val);
  }
}

// ------------------------------------------------------------------ actions
async function runAction(action) {
  const tab = App.active;
  const F = window.Features || {};
  const actions = {
    newTab: () => newTab(),
    newClaude: () => newTab(defaultClaude(), { split: App.settings.startupSplit, ratio: App.settings.splitRatio }),
    closePane: () => closePane(),
    nextTab: () => activateTab(App.tabs[(App.tabs.indexOf(tab) + 1) % App.tabs.length]),
    prevTab: () => activateTab(App.tabs[(App.tabs.indexOf(tab) - 1 + App.tabs.length) % App.tabs.length]),
    splitRight: () => splitPane('row'),
    splitDown: () => splitPane('column'),
    toggleShell: async () => {
      const shellPane = tab.panes.find(p => !p.kind && !isClaude(p.profile?.id));
      const claudePane = tab.panes.find(p => isClaude(p.profile?.id));
      if (!shellPane) return splitPane('column', App.settings.startupSplit || 'powershell', App.settings.splitRatio);
      focusPane(tab.focused === shellPane && claudePane ? claudePane : shellPane);
    },
    focusNextPane: () => { const i = tab.panes.indexOf(tab.focused); focusPane(tab.panes[(i + 1) % tab.panes.length]); },
    focusPrevPane: () => { const i = tab.panes.indexOf(tab.focused); focusPane(tab.panes[(i - 1 + tab.panes.length) % tab.panes.length]); },
    palette: () => openPalette(),
    search: () => openSearch(),
    settings: () => openSettings(),
    zoomIn: () => setSetting({ fontSize: Math.min(40, App.settings.fontSize + 1) }),
    zoomOut: () => setSetting({ fontSize: Math.max(8, App.settings.fontSize - 1) }),
    zoomReset: () => setSetting({ fontSize: App.defaults.fontSize }),
    clear: () => tab.focused?.term.clear(),
    fullscreen: () => api.win.fullscreen(),
    alwaysOnTop: () => { setSetting({ alwaysOnTop: !App.settings.alwaysOnTop }); toast(App.settings.alwaysOnTop ? t('toast.topOn') : t('toast.topOff')); },
    history: () => F.openHistory && F.openHistory(),
    focusMode: () => { setSetting({ focusMode: !App.settings.focusMode }); if (App.settings.focusMode) toast(t('toast.focusOn', { key: keyFor('focusMode') })); },
    quickBar: () => setSetting({ showQuickBar: !App.settings.showQuickBar }),
    record: () => F.toggleRecording && F.toggleRecording(),
    monitor: () => splitPane('row', 'monitor'),
    irc: () => {
      // if a chat is already open, go there; otherwise open it in a new tab
      for (const x of App.tabs) { const p = x.panes.find(q => q.kind === 'irc'); if (p) { activateTab(x); return focusPane(p); } }
      return newTab('irc');
    },
    saveWorkspace: () => F.saveWorkspacePrompt && F.saveWorkspacePrompt(),
    explainLast: () => F.explainLast && F.explainLast(),
    devtools: () => api.win.devtools(),
    openSettingsFile: () => api.settings.openFile(),
    reload: () => location.reload()
  };
  if (/^tab\d$/.test(action)) { const x = App.tabs[+action.slice(3) - 1]; if (x) activateTab(x); return; }
  if (actions[action]) await actions[action]();
}
function keyFor(action) { return ({ ...DEFAULT_KEYS, ...(App.settings.keybindings || {}) })[action] || ''; }

// ------------------------------------------------------------------ command palette
function paletteItems() {
  const items = [];
  for (const a of ACTIONS) items.push({ cat: t('cat.action'), label: actionLabel(a), kbd: keyFor(a), run: () => runAction(a) });
  for (const a of ['openSettingsFile', 'devtools', 'reload']) items.push({ cat: t('cat.action'), label: t('act.' + a), run: () => runAction(a) });
  for (const p of App.profiles) items.push({ cat: p.ssh ? t('cat.ssh') : t('cat.shell'), icon: p.icon, label: p.ssh ? t('act.ssh', { name: p.name }) : t('act.newTabWith', { name: profileName(p) }), run: () => newTab(p.id) });
  for (const p of App.profiles) items.push({ cat: t('cat.split'), icon: p.icon, label: t('act.splitWith', { name: profileName(p) }), run: () => splitPane('column', p.id) });
  for (const name of Object.keys(App.settings.workspaces || {})) items.push({ cat: t('cat.workspace'), icon: 'layout', label: t('act.openWorkspace', { name }), run: () => window.Features.openWorkspace(name) });
  for (const [id, th] of Object.entries(allThemes())) items.push({ cat: t('cat.theme'), label: th.label || id, run: () => setSetting({ theme: id, autoTheme: 'off' }) });
  for (const fx of NeonFX.effects) items.push({ cat: t('cat.effect'), label: t('fx.' + fx), run: () => setSetting({ backgroundEffect: fx }) });
  for (const l of ['ca', 'es', 'en']) items.push({ cat: t('cat.lang'), icon: 'globe', label: t('lang.' + l), run: () => setSetting({ language: l }) });
  items.push({ cat: t('cat.style'), label: t('act.glow'), run: () => setSetting({ glow: !App.settings.glow }) });
  items.push({ cat: t('cat.style'), label: t('act.scanlines'), run: () => setSetting({ scanlines: !App.settings.scanlines }) });
  items.push({ cat: t('cat.style'), label: t('act.gradient'), run: () => setSetting({ gradient: !App.settings.gradient }) });
  items.push({ cat: t('cat.style'), label: t('act.pickBg'), run: async () => { const p = await api.pickImage(); if (p) setSetting({ backgroundImage: p }); } });
  items.push({ cat: t('cat.style'), label: t('act.removeBg'), run: () => setSetting({ backgroundImage: '' }) });
  for (const s of App.settings.snippets || []) items.push({ cat: t('cat.snippet'), label: s.name, kbd: s.command, run: () => runCommandFrom(App.active?.focused, s.command) });
  return items;
}

let palSel = 0, palFiltered = [];
function openPalette() {
  closeMenu();
  $('#palette').classList.remove('hidden');
  const input = $('#palette-input');
  input.value = '';
  renderPalette();
  input.focus();
}
function closePalette() { $('#palette').classList.add('hidden'); App.active?.focused?.term.focus(); }
function fuzzy(q, s) {
  q = q.toLowerCase(); s = s.toLowerCase();
  let i = 0;
  for (const c of s) if (c === q[i]) i++;
  return i === q.length;
}
function renderPalette() {
  const q = $('#palette-input').value.trim();
  palFiltered = paletteItems().filter(it => !q || fuzzy(q, it.cat + ' ' + it.label));
  palSel = Math.min(palSel, Math.max(0, palFiltered.length - 1));
  const list = $('#palette-list');
  list.innerHTML = '';
  palFiltered.slice(0, 90).forEach((it, i) => {
    const row = el('div', 'pal-item' + (i === palSel ? ' sel' : ''), `<span class="cat">${esc(it.cat)}</span>${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span>${it.kbd ? `<span class="kbd">${esc(it.kbd)}</span>` : ''}`);
    row.onmouseenter = () => { palSel = i; list.querySelectorAll('.pal-item').forEach((r, j) => r.classList.toggle('sel', j === i)); };
    row.onclick = () => { closePalette(); it.run(); };
    list.appendChild(row);
  });
  list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
}
$('#palette-input').addEventListener('input', () => { palSel = 0; renderPalette(); });
$('#palette-input').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { palSel = Math.min(palSel + 1, palFiltered.length - 1); renderPalette(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { palSel = Math.max(palSel - 1, 0); renderPalette(); e.preventDefault(); }
  else if (e.key === 'Enter') { const it = palFiltered[palSel]; closePalette(); if (it) it.run(); }
  else if (e.key === 'Escape') closePalette();
});
$('#palette').addEventListener('mousedown', (e) => { if (e.target.id === 'palette') closePalette(); });

// ------------------------------------------------------------------ search
function openSearch() {
  $('#searchbar').classList.remove('hidden');
  const i = $('#search-input');
  i.focus(); i.select();
}
function closeSearch() { $('#searchbar').classList.add('hidden'); App.active?.focused?.search.clearDecorations(); App.active?.focused?.term.focus(); }
function doSearch(back) {
  const p = App.active?.focused, q = $('#search-input').value;
  if (!p || !q) return;
  const ui = currentTheme().ui;
  const opts = { decorations: { matchBackground: ui.accent2 + '66', activeMatchBackground: ui.accent + 'aa', matchOverviewRuler: ui.accent2, activeMatchColorOverviewRuler: ui.accent } };
  back ? p.search.findPrevious(q, opts) : p.search.findNext(q, opts);
}
$('#search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch(e.shiftKey);
  else if (e.key === 'Escape') closeSearch();
});
$('#search-input').addEventListener('input', () => doSearch(false));
$('#search-next').onclick = () => doSearch(false);
$('#search-prev').onclick = () => doSearch(true);
$('#search-close').onclick = closeSearch;

// ------------------------------------------------------------------ profile menu
function menuItem(ic, label, kbd, run) {
  const it = el('div', 'menu-item', `${icon(ic)}<span>${esc(label)}</span>${kbd ? `<span class="kbd">${esc(kbd)}</span>` : ''}`);
  it.onclick = () => { closeMenu(); run(); };
  return it;
}
function openProfileMenu() {
  const menu = $('#profile-menu');
  if (!menu.classList.contains('hidden')) return closeMenu();
  menu.innerHTML = '';
  const shells = App.profiles.filter(p => !p.ssh && !p.kind), ssh = App.profiles.filter(p => p.ssh), special = App.profiles.filter(p => p.kind);
  for (const p of shells) menu.appendChild(menuItem(p.icon, profileName(p), '', () => newTab(p.id)));
  if (special.length) { menu.appendChild(el('div', 'menu-sep')); for (const p of special) menu.appendChild(menuItem(p.icon, profileName(p), keyFor(p.kind), () => p.kind === 'irc' ? runAction('irc') : newTab(p.id))); }
  if (ssh.length) { menu.appendChild(el('div', 'menu-head', esc(t('menu.ssh')))); for (const p of ssh) menu.appendChild(menuItem(p.icon, p.name, '', () => newTab(p.id))); }
  menu.appendChild(el('div', 'menu-sep'));
  menu.appendChild(menuItem('splitDown', t('act.splitDown'), keyFor('splitDown'), () => splitPane('column')));
  menu.appendChild(menuItem('splitRight', t('act.splitRight'), keyFor('splitRight'), () => splitPane('row')));
  menu.appendChild(menuItem('sliders', t('menu.customize'), keyFor('settings'), () => openSettings()));
  const r = $('#profile-btn').getBoundingClientRect();
  menu.style.left = Math.min(r.left, window.innerWidth - 250) + 'px';
  menu.style.top = r.bottom + 4 + 'px';
  menu.style.maxHeight = (window.innerHeight - r.bottom - 16) + 'px';
  menu.classList.remove('hidden');
  $('#profile-btn').classList.add('on');
}
function closeMenu() { $('#profile-menu').classList.add('hidden'); $('#profile-btn').classList.remove('on'); }
// close on outside click (capture phase: the terminal doesn't swallow it), on Esc or on blur
document.addEventListener('mousedown', (e) => { if (!e.target.closest('#profile-menu') && !e.target.closest('#profile-btn')) closeMenu(); }, true);
window.addEventListener('blur', closeMenu);

// ------------------------------------------------------------------ settings
function openSettings(section) {
  closeMenu();
  $('#settings').classList.remove('hidden');
  window.SettingsUI.render(section);
}
function closeSettings() { $('#settings').classList.add('hidden'); window.SettingsUI.cleanup(); App.active?.focused?.term.focus(); }
$('#settings-close').onclick = closeSettings;
$('#settings').addEventListener('mousedown', (e) => { if (e.target.id === 'settings') closeSettings(); });

// ------------------------------------------------------------------ status bar
function updateStatus() {
  const p = App.active?.focused;
  $('#st-profile').innerHTML = p?.profile ? `${icon(p.profile.icon)}<span>${esc(profileName(p.profile))}</span>` : '';
  $('#st-cwd').textContent = p?.cwd || '';
  $('#st-cwd').title = p?.cwd || '';
  $('#st-size').textContent = p && !p.kind ? `${p.term.cols}×${p.term.rows}` : '';
}
api.onStats(({ cpu, memUsed, memTotal }) => {
  $('#st-cpu').textContent = `CPU ${cpu}%`;
  $('#st-mem').textContent = `RAM ${(memUsed / 1073741824).toFixed(1)}/${(memTotal / 1073741824).toFixed(0)} GB`;
});
setInterval(() => { $('#st-clock').textContent = new Date().toLocaleTimeString(t.locale(), { hour: '2-digit', minute: '2-digit' }); }, 1000);

// ------------------------------------------------------------------ utilities
let toastTimer;
function toast(msg) {
  const tEl = $('#toast');
  tEl.textContent = msg;
  tEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => tEl.classList.remove('show'), 2000);
}

let audioCtx;
function beep() {
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.06, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.16);
  } catch {}
}

// Dialog asking for text (workspace name, etc.)
function askText(title, value = '') {
  return new Promise((resolve) => {
    const box = $('#prompt'), input = $('#prompt-input');
    $('#prompt-title').textContent = title;
    input.value = value;
    box.classList.remove('hidden');
    input.focus(); input.select();
    const done = (v) => { box.classList.add('hidden'); input.onkeydown = null; $('#prompt-ok').onclick = $('#prompt-cancel').onclick = null; App.active?.focused?.term.focus(); resolve(v); };
    input.onkeydown = (e) => { if (e.key === 'Enter') done(input.value.trim() || null); if (e.key === 'Escape') done(null); };
    $('#prompt-ok').onclick = () => done(input.value.trim() || null);
    $('#prompt-cancel').onclick = () => done(null);
  });
}

// ------------------------------------------------------------------ global events
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#profile-menu').classList.contains('hidden')) { closeMenu(); e.preventDefault(); return; }
    if (!$('#settings').classList.contains('hidden')) return closeSettings();
    if (!$('#searchbar').classList.contains('hidden')) return closeSearch();
  }
  // inside panels and dialogs shortcuts aren't intercepted (except Esc)
  if (e.target.closest && e.target.closest('#settings, #palette, #searchbar, #history, #prompt, .special-body input, .special-body textarea')) return;
  handleShortcut(e);
}, true);

window.addEventListener('resize', () => document.body.classList.toggle('compact', window.innerWidth < 640));
document.body.classList.toggle('compact', window.innerWidth < 640);

$('#new-tab').onclick = () => newTab();
$('#profile-btn').onclick = openProfileMenu;
$('#settings-btn').onclick = () => openSettings();
$('#palette-btn').onclick = openPalette;
$('#pin-btn').onclick = () => runAction('alwaysOnTop');
$('#rec-btn').onclick = () => runAction('record');
$('#win-min').onclick = api.win.minimize;
$('#win-max').onclick = api.win.maximize;
$('#win-close').onclick = async () => {
  const live = App.tabs.reduce((n, x) => n + x.panes.filter(p => !p.exited && !p.kind).length, 0);
  if (App.settings.confirmClose && live > 2 && !(await api.confirm(t('confirm.close', { n: live })))) return;
  if (App.settings.restoreSession) await api.settings.set({ lastSession: serializeLayout() });
  api.win.close();
};
$('#titlebar').addEventListener('dblclick', (e) => { if (e.target.classList.contains('drag')) api.win.maximize(); });
api.win.onState((s) => {
  document.body.classList.toggle('maximized', s === 'maximized');
  $('#win-max').innerHTML = icon(s === 'maximized' ? 'winRestore' : 'winMax');
});
api.onProfilesChanged((list) => { App.profiles = list; });

// API for the other modules
Object.assign(App, {
  setSetting, applySettings, allThemes, currentTheme, toast, notify, askText, keyString, keyFor, runAction,
  DEFAULT_KEYS, ACTIONS, actionLabel, profileName, isClaude, defaultClaude, newTab, splitPane, focusPane, activateTab, closePane,
  runCommandFrom, shellPaneFor, writePane, serializeLayout, restoreLayout, saveSessionSoon, renderTabs, updateStatus
});
