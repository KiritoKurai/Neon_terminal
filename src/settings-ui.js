// Settings panel — everything is saved to settings.json and applied live.
// Includes a preview that reacts to changes and to hovering over options.
window.SettingsUI = (() => {
  const api = window.neon;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = () => window.App.settings;
  let current = 'general';
  let hoverOverride = null;
  let previewFx = null;
  let thumbs = [];
  let detectedFonts = [];

  const set = (patch) => { window.App.setSetting(patch); refreshPreview(); };

  const SECTIONS = [
    ['general', 'sliders', 'set.general'], ['skins', 'skins', 'set.skins'], ['colors', 'droplet', 'set.colors'], ['background', 'layers', 'set.background'],
    ['text', 'type', 'set.text'], ['window', 'window', 'set.window'], ['claude', 'claude', 'set.claude'], ['ssh', 'server', 'set.ssh'],
    ['workspaces', 'layout', 'set.workspaces'], ['irc', 'irc', 'set.irc'], ['sounds', 'volume', 'set.sounds'], ['keys', 'keyboard', 'set.keys'], ['advanced', 'code', 'set.advanced']
  ];
  const WITH_PREVIEW = new Set(['skins', 'colors', 'background', 'text', 'window']);

  const KNOWN_FONTS = ['Cascadia Code', 'Cascadia Mono', 'CaskaydiaCove Nerd Font', 'JetBrains Mono', 'Fira Code', 'Hack', 'Source Code Pro', 'IBM Plex Mono',
    'Roboto Mono', 'Ubuntu Mono', 'Victor Mono', 'Iosevka', 'Space Mono', 'Inconsolata', 'DejaVu Sans Mono', 'Geist Mono', 'Monaspace Neon',
    'Consolas', 'Lucida Console', 'Courier New', 'MS Gothic', 'OCR A Extended'];

  // ---------------------------------------------------------- font detection
  const fctx = document.createElement('canvas').getContext('2d');
  function fontAvailable(family) {
    const test = 'mmmmmmmmmwwwwwlli1O0{}';
    return ['monospace', 'serif', 'sans-serif'].some((base) => {
      fctx.font = `32px ${base}`; const w0 = fctx.measureText(test).width;
      fctx.font = `32px "${family}", ${base}`; return fctx.measureText(test).width !== w0;
    });
  }
  function isMono(family) { fctx.font = `32px "${family}", serif`; return Math.abs(fctx.measureText('iiiiiiii').width - fctx.measureText('WWWWWWWW').width) < 1; }
  const familyCss = (f) => `'${f}', Consolas, monospace`;
  const primaryFont = (css) => String(css || '').split(',')[0].replace(/['"]/g, '').trim();

  // ---------------------------------------------------------- theme
  function resolved(id, withOverride = true) {
    const themes = window.App.allThemes();
    const th = themes[id] || themes.claude;
    const parent = th.base && themes[th.base] ? themes[th.base] : window.NEON_THEMES.claude;
    const r = { label: th.label || id, ui: { ...parent.ui, ...(th.ui || {}) }, term: { ...parent.term, ...(th.term || {}) } };
    if (withOverride && S().accentOverride) { r.ui.accent = S().accentOverride; r.term.cursor = S().accentOverride; }
    return r;
  }
  function editColor(group, key, value) {
    const s = S();
    const custom = { ...(s.customThemes || {}) };
    let id = s.theme;
    if (!custom[id]) {
      const r = resolved(id, false);
      id = id.endsWith('-custom') ? id : id + '-custom';
      custom[id] = custom[id] || { label: r.label + ' ' + t('colors.personal'), ui: { ...r.ui }, term: { ...r.term } };
    }
    const th = custom[id] = { ...custom[id], ui: { ...custom[id].ui }, term: { ...custom[id].term } };
    if (key === 'selectionBackground') value = value + '55';
    th[group][key] = value;
    if (group === 'ui' && key === 'bg') th.term.background = value;
    set({ customThemes: custom, theme: id, autoTheme: 'off' });
  }

  // ---------------------------------------------------------- preview
  function fileUrl(p) {
    if (!p) return '';
    if (/^(https?|file|data):/i.test(p)) return p;
    return 'file:///' + encodeURI(p.replace(/\\/g, '/')).replace(/#/g, '%23');
  }

  function buildPreview() {
    const wrap = document.createElement('div');
    wrap.className = 'pv-wrap';
    wrap.innerHTML = `
      <div class="pv">
        <div class="pv-desk"></div>
        <div class="pv-win">
          <div class="pv-bgimg"></div><canvas class="pv-fx"></canvas><div class="pv-grad"></div>
          <div class="pv-bar">
            <span class="pv-logo">${icon('logo')}</span>
            <span class="pv-tab active">${icon('claude')}<span>Claude Code</span></span>
            <span class="pv-tab">${icon('powershell')}<span>src</span></span>
          </div>
          <div class="pv-term"></div>
          <div class="pv-scan"></div>
        </div>
      </div>
      <div class="pv-side">
        <div class="pv-title">${esc(t('set.preview'))}</div>
        <div class="pv-hint">${esc(t('set.previewHint'))}</div>
        <button class="btn pv-peek" title="${esc(t('set.peekTitle'))}">${icon('eye')}<span>${esc(t('set.peek'))}</span></button>
      </div>`;
    const peek = wrap.querySelector('.pv-peek');
    const on = () => document.body.classList.add('peek');
    const off = () => document.body.classList.remove('peek');
    peek.addEventListener('pointerdown', on);
    peek.addEventListener('pointerup', off);
    peek.addEventListener('pointerleave', off);
    if (previewFx) previewFx.destroy();
    previewFx = createFX(wrap.querySelector('.pv-fx'), { fps: 40 });
    return wrap;
  }

  function refreshPreview() {
    const wrap = document.querySelector('#settings-body .pv-wrap');
    if (!wrap || !previewFx) return;
    const s = { ...S(), ...(hoverOverride || {}) };
    const th = resolved(s.theme, false);
    if (s.accentOverride) { th.ui.accent = s.accentOverride; th.term.cursor = s.accentOverride; }
    const win = wrap.querySelector('.pv-win');
    for (const k of ['accent', 'accent2', 'bg', 'surface', 'text', 'muted']) win.style.setProperty('--' + k, th.ui[k]);
    win.style.setProperty('--pv-opacity', s.opacity);
    win.style.borderRadius = (s.windowEffect === 'transparent' ? Math.min(s.borderRadius, 18) : 8) + 'px';
    win.classList.toggle('acrylic', ['acrylic', 'mica', 'tabbed'].includes(s.windowEffect));
    win.classList.toggle('border-glow', !!s.borderGlow);
    win.querySelector('.pv-grad').style.display = s.gradient ? 'block' : 'none';
    win.querySelector('.pv-scan').style.display = s.scanlines ? 'block' : 'none';
    const img = win.querySelector('.pv-bgimg');
    img.style.backgroundImage = s.backgroundImage ? `url("${fileUrl(s.backgroundImage)}")` : 'none';
    img.style.opacity = s.backgroundImageOpacity;
    img.style.filter = `blur(${s.backgroundBlur * 0.5}px)`;
    img.style.backgroundSize = s.backgroundFit === 'tile' || s.backgroundFit === 'center' ? 'auto' : s.backgroundFit;
    img.style.backgroundRepeat = s.backgroundFit === 'tile' ? 'repeat' : 'no-repeat';

    const c = th.term, glow = s.glow && s.renderer !== 'webgl';
    const term = win.querySelector('.pv-term');
    term.style.fontFamily = s.fontFamily;
    term.style.fontSize = Math.min(s.fontSize, 18) + 'px';
    term.style.lineHeight = s.lineHeight;
    term.style.letterSpacing = s.letterSpacing + 'px';
    term.style.color = c.foreground;
    term.style.textShadow = glow ? `0 0 ${s.glowStrength}px currentColor` : 'none';
    term.style.padding = Math.min(s.padding, 18) + 'px';
    const sp = (color, text) => `<span style="color:${color}">${esc(text)}</span>`;
    term.innerHTML =
      `${sp(c.brightBlack, '╭─')} ${sp(c.brightBlack, '20:14:05')} ${sp(c.blue, '~/src')} ${sp(c.magenta, ' main')} ${sp(c.yellow, '⧗ 1.2s')}<br>` +
      `${sp(c.brightBlack, '╰─')}${sp(c.cyan, '❯')} ${sp(c.yellow, 'git')} status ${sp(c.brightBlack, '-sb')}<br>` +
      `${sp(c.green, '## main')}...${sp(c.red, 'origin/main')} ${sp(c.brightBlack, '[ahead 2]')}<br>` +
      `${sp(c.green, ' M')} src/app.js   ${sp(c.red, '??')} notes.md<br>` +
      `${sp(th.ui.accent, '✳')} ${sp(c.foreground, 'Claude:')} ${sp(c.brightBlack, '3 files ✓')}<br>` +
      `${sp(c.cyan, '❯')} <span class="pv-cursor ${s.cursorStyle} ${s.cursorBlink ? 'blink' : ''}" style="--cur:${c.cursor}"></span>`;
    previewFx.set({ effect: s.backgroundEffect, color: s.effectColor || th.ui.accent, color2: th.ui.accent2, intensity: s.effectIntensity, speed: s.effectSpeed ?? 1 });
  }

  function hoverPreview(elm, patch) {
    elm.addEventListener('mouseenter', () => { hoverOverride = patch; refreshPreview(); });
    elm.addEventListener('mouseleave', () => { hoverOverride = null; refreshPreview(); });
  }

  // ---------------------------------------------------------- controls
  function field(label, hint, control) {
    const row = document.createElement('div');
    row.className = 'field';
    const l = document.createElement('label');
    l.innerHTML = esc(label) + (hint ? `<span class="hint">${esc(hint)}</span>` : '');
    row.append(l, control);
    return row;
  }
  function toggle(key) {
    const w = document.createElement('label');
    w.className = 'switch';
    w.innerHTML = `<input type="checkbox" ${S()[key] ? 'checked' : ''}><span></span>`;
    w.querySelector('input').onchange = (e) => set({ [key]: e.target.checked });
    return w;
  }
  function range(key, min, max, step, fmt = (v) => v) {
    const w = document.createElement('div');
    w.className = 'range-wrap';
    const v0 = S()[key] ?? min;
    w.innerHTML = `<input type="range" min="${min}" max="${max}" step="${step}" value="${v0}"><span>${fmt(v0)}</span>`;
    const [inp, out] = w.children;
    inp.oninput = () => { const v = parseFloat(inp.value); out.textContent = fmt(v); set({ [key]: v }); };
    return w;
  }
  function select(key, options, transform = (v) => v) {
    const s = document.createElement('select');
    for (const o of options) {
      const [val, label] = Array.isArray(o) ? o : [o, o];
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = label;
      if (String(S()[key] ?? '') === String(val)) opt.selected = true;
      s.appendChild(opt);
    }
    s.onchange = () => set({ [key]: transform(s.value) });
    return s;
  }
  function segmented(key, options, { preview = true, after } = {}) {
    const w = document.createElement('div');
    w.className = 'seg';
    for (const [val, label] of options) {
      const b = document.createElement('button');
      b.innerHTML = label;
      b.className = String(S()[key]) === String(val) ? 'on' : '';
      b.onclick = () => { const prev = S()[key]; set({ [key]: val }); w.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); after && after(val, prev); };
      if (preview) hoverPreview(b, { [key]: val });
      w.appendChild(b);
    }
    return w;
  }
  function text(key, placeholder = '', parse = (v) => v, format = (v) => v ?? '') {
    const i = document.createElement('input');
    i.type = 'text'; i.placeholder = placeholder; i.value = format(S()[key]); i.spellcheck = false;
    i.onchange = () => set({ [key]: parse(i.value) });
    return i;
  }
  function timeInput(key) {
    const i = document.createElement('input');
    i.type = 'time'; i.value = S()[key] || '08:00';
    i.onchange = () => set({ [key]: i.value });
    return i;
  }
  function colorInput(value, onChange, allowEmpty) {
    const w = document.createElement('div');
    w.className = 'color-wrap';
    const c = document.createElement('input');
    c.type = 'color';
    c.value = /^#[0-9a-f]{6}/i.test(value || '') ? value.slice(0, 7) : '#888888';
    c.oninput = () => onChange(c.value);
    w.appendChild(c);
    if (allowEmpty) w.appendChild(button(t('common.auto'), () => onChange('')));
    return w;
  }
  function button(label, onClick, cls = '', ic = '') {
    const b = document.createElement('button');
    b.className = 'btn ' + cls; b.innerHTML = (ic ? icon(ic) : '') + `<span>${esc(label)}</span>`; b.onclick = onClick;
    return b;
  }
  function header(title, sub) {
    const f = document.createDocumentFragment();
    const h = document.createElement('h2'); h.textContent = title;
    const p = document.createElement('p'); p.className = 'sub'; p.textContent = sub;
    f.append(h, p);
    return f;
  }
  function sub(title) { const h = document.createElement('h3'); h.className = 'sec'; h.textContent = title; return h; }
  function btnRow(...btns) { const r = document.createElement('div'); r.className = 'btn-row'; r.append(...btns); return r; }
  function textarea(key, ph, fmt, parse) {
    const ta = document.createElement('textarea');
    ta.placeholder = ph; ta.value = fmt(S()[key]); ta.spellcheck = false;
    ta.onchange = () => { try { set({ [key]: parse(ta.value) }); ta.style.borderColor = ''; } catch { ta.style.borderColor = '#e81123'; } };
    return ta;
  }
  const themeOptions = () => Object.entries(window.App.allThemes()).filter(([id]) => id !== 'wallpaper').map(([id, th]) => [id, th.label || id]);

  // ---------------------------------------------------------- sections
  const render = {
    general(body) {
      body.append(header(t('gen.title'), t('gen.sub')));
      body.appendChild(field(t('gen.language'), t('gen.languageHint'), segmented('language', [['ca', 'Català'], ['es', 'Castellano'], ['en', 'English']], {
        preview: false, after: () => { window.App.toast(t('toast.langChanged')); renderNav(); renderBody(); }
      })));
      body.appendChild(field(t('gen.autoStart'), t('gen.autoStartHint'), toggle('autoStart')));
      body.appendChild(field(t('gen.restore'), t('gen.restoreHint'), toggle('restoreSession')));
      body.appendChild(field(t('gen.claudeContinue'), t('gen.claudeContinueHint'), toggle('claudeContinueOnRestore')));
      body.appendChild(field(t('gen.quickBar'), t('gen.quickBarHint'), toggle('showQuickBar')));
      body.appendChild(field(t('gen.errorHelp'), t('gen.errorHelpHint'), toggle('errorHelp')));
      body.appendChild(field(t('gen.longCmd'), t('gen.longCmdHint'), toggle('longCmdNotify')));
      body.appendChild(field('', null, range('longCmdSeconds', 5, 300, 5, (v) => v + 's')));
      body.appendChild(field(t('gen.clickable'), t('gen.clickableHint'), toggle('clickableCommands')));
      body.appendChild(field(t('win.focusMode'), t('win.focusModeHint'), toggle('focusMode')));
    },

    skins(body) {
      body.append(header(t('skins.title'), t('skins.sub')));
      // automatic theme
      const autoBox = document.createElement('div');
      autoBox.className = 'auto-theme';
      body.appendChild(field(t('skins.auto'), t('skins.autoHint'), segmented('autoTheme', [['off', t('skins.autoOff')], ['time', t('skins.autoTime')], ['wallpaper', t('skins.autoWall')]], {
        preview: false,
        after: async (v) => { if (v === 'wallpaper') { await Features.loadWallpaperTheme(); window.App.applySettings(); } renderBody(); }
      })));
      if (S().autoTheme === 'time') {
        body.appendChild(field(t('skins.day'), null, select('dayTheme', themeOptions())));
        body.appendChild(field(t('skins.dayStart'), null, timeInput('dayStart')));
        body.appendChild(field(t('skins.night'), null, select('nightTheme', themeOptions())));
        body.appendChild(field(t('skins.nightStart'), null, timeInput('nightStart')));
      }
      if (S().autoTheme === 'wallpaper') body.appendChild(field(t('skins.wallBg'), null, (() => { const tg = toggle('wallpaperAsBackground'); tg.querySelector('input').addEventListener('change', async () => { if (!window.App.wallpaperPath) await Features.loadWallpaperTheme(); window.App.applySettings(); }); return tg; })()));

      const grid = document.createElement('div');
      grid.className = 'skins';
      const active = Features.autoThemeId() || S().theme;
      for (const id of Object.keys(window.App.allThemes())) {
        const th = resolved(id, false);
        const card = document.createElement('div');
        card.className = 'skin' + (active === id ? ' active' : '');
        card.style.background = th.ui.bg;
        card.style.color = th.ui.text;
        card.style.setProperty('--skin-accent', th.ui.accent);
        card.innerHTML = `
          ${S().customThemes && S().customThemes[id] ? `<span class="badge">${esc(t('skins.personal'))}</span>` : ''}
          <div class="name" style="color:${th.ui.accent}">${esc(th.label)}</div>
          <div class="prompt"><span style="color:${th.term.blue}">~/src</span> <span style="color:${th.term.magenta}"> main</span><br>
          <span style="color:${th.ui.accent}">❯</span> <span style="color:${th.term.yellow}">git</span> status</div>
          <div class="dots">${['red', 'green', 'yellow', 'blue', 'magenta', 'cyan'].map(c => `<i style="background:${th.term[c]}"></i>`).join('')}</div>`;
        card.onclick = () => { set({ theme: id, accentOverride: '', autoTheme: 'off' }); grid.querySelectorAll('.skin').forEach(x => x.classList.toggle('active', x === card)); };
        hoverPreview(card, { theme: id, accentOverride: '' });
        grid.appendChild(card);
      }
      body.appendChild(grid);
      body.appendChild(btnRow(
        button(t('skins.import'), async () => {
          const data = await api.importTheme();
          if (!data || !data.term) return window.App.toast(t('skins.invalid'));
          const id = (data.id || data.label || 'imported').toLowerCase().replace(/[^a-z0-9-]+/g, '-');
          set({ customThemes: { ...(S().customThemes || {}), [id]: data }, theme: id });
          renderBody();
        }, '', 'download'),
        button(t('skins.export'), () => { const r = resolved(S().theme); api.exportTheme(S().theme, { id: S().theme, ...r }); }, '', 'upload'),
        button(t('skins.delete'), () => {
          const c = { ...(S().customThemes || {}) };
          if (!c[S().theme]) return window.App.toast(t('skins.notCustom'));
          delete c[S().theme];
          set({ customThemes: c, theme: 'claude' });
          renderBody();
        }, 'danger', 'trash')
      ));
    },

    colors(body) {
      const th = resolved(S().theme, false);
      body.append(header(t('colors.title'), t('colors.sub', { name: th.label })));
      body.appendChild(field(t('colors.accent'), t('colors.accentHint'), colorInput(S().accentOverride || th.ui.accent, (v) => set({ accentOverride: v }), true)));
      const grid = (group, keys, labels) => {
        const g = document.createElement('div');
        g.className = 'colors-grid';
        keys.forEach((k, i) => {
          const w = colorInput(th[group][k], (v) => editColor(group, k, v));
          const lbl = document.createElement('span'); lbl.textContent = labels[i];
          w.prepend(lbl);
          g.appendChild(w);
        });
        return g;
      };
      body.appendChild(sub(t('colors.ui')));
      const uiKeys = ['accent', 'accent2', 'bg', 'surface', 'text', 'muted'];
      body.appendChild(grid('ui', uiKeys, uiKeys.map(k => t('colors.k.' + k))));
      body.appendChild(sub(t('colors.term')));
      body.appendChild(grid('term', ['foreground', 'cursor', 'selectionBackground'], [t('colors.k.foreground'), t('colors.k.cursor'), t('colors.k.selection')]));
      body.appendChild(sub(t('colors.ansi')));
      const ansi = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'];
      const names = t('colors.ansiNames').split(',');
      body.appendChild(grid('term', [...ansi, ...ansi.map(c => 'bright' + c[0].toUpperCase() + c.slice(1))], [...names, ...names.map(n => n + ' +')]));
    },

    background(body) {
      body.append(header(t('bg.title'), t('bg.sub')));
      const gal = document.createElement('div');
      gal.className = 'fx-gallery';
      const th = resolved(S().theme);
      for (const id of window.FX_IDS) {
        const card = document.createElement('div');
        card.className = 'fx-card' + (S().backgroundEffect === id ? ' active' : '');
        card.innerHTML = `<div class="fx-thumb" style="background:${th.ui.bg}"><canvas></canvas>${id === 'none' ? icon('close') : ''}</div><div class="fx-name">${esc(t('fx.' + id))}</div>`;
        card.onclick = () => { set({ backgroundEffect: id }); gal.querySelectorAll('.fx-card').forEach(x => x.classList.toggle('active', x === card)); };
        hoverPreview(card, { backgroundEffect: id });
        gal.appendChild(card);
        if (id !== 'none') {
          const fx = createFX(card.querySelector('canvas'), { fps: 20, maxDpr: 1 });
          fx.set({ effect: id, color: S().effectColor || th.ui.accent, color2: th.ui.accent2, intensity: Math.max(0.7, S().effectIntensity), speed: S().effectSpeed ?? 1 });
          thumbs.push(fx);
        }
      }
      body.appendChild(gal);
      body.appendChild(field(t('bg.intensity'), null, range('effectIntensity', 0, 1, 0.05, (v) => Math.round(v * 100) + '%')));
      body.appendChild(field(t('bg.speed'), null, range('effectSpeed', 0.1, 3, 0.1, (v) => v.toFixed(1) + '×')));
      body.appendChild(field(t('bg.color'), t('bg.colorHint'), colorInput(S().effectColor || th.ui.accent, (v) => set({ effectColor: v }), true)));
      body.appendChild(sub(t('bg.transparency')));
      body.appendChild(field(t('bg.opacity'), t('bg.opacityHint'), range('opacity', 0, 1, 0.01, (v) => Math.round(v * 100) + '%')));
      body.appendChild(field(t('bg.material'), t('bg.materialHint'), segmented('windowEffect', ['acrylic', 'mica', 'tabbed', 'transparent', 'none'].map(m => [m, t('bg.m.' + m)]), {
        // entering or leaving transparent mode needs a restart (the window is created differently)
        after: (v, prev) => { if (v !== prev && (v === 'transparent' || prev === 'transparent')) window.App.toast(t('common.restartNeeded')); }
      })));
      body.appendChild(sub(t('bg.image')));
      const img = document.createElement('div');
      img.className = 'range-wrap';
      img.append(
        button(t('bg.pick'), async () => { const p = await api.pickImage(); if (p) { set({ backgroundImage: p }); renderBody(); } }, '', 'image'),
        button(t('common.remove'), () => { set({ backgroundImage: '' }); renderBody(); }, '', 'close')
      );
      body.appendChild(field(t('bg.imageLabel'), S().backgroundImage || t('bg.noImage'), img));
      body.appendChild(field(t('bg.imageOpacity'), null, range('backgroundImageOpacity', 0, 1, 0.01, (v) => Math.round(v * 100) + '%')));
      body.appendChild(field(t('bg.blur'), null, range('backgroundBlur', 0, 30, 1, (v) => v + 'px')));
      body.appendChild(field(t('bg.fit'), null, segmented('backgroundFit', ['cover', 'contain', 'tile', 'center'].map(f => [f, t('bg.f.' + f)]))));
      body.appendChild(sub(t('bg.finish')));
      body.appendChild(field(t('bg.gradient'), t('bg.gradientHint'), toggle('gradient')));
      body.appendChild(field(t('bg.scanlines'), t('bg.scanlinesHint'), toggle('scanlines')));
      body.appendChild(field(t('bg.borderGlow'), null, toggle('borderGlow')));
    },

    text(body) {
      body.append(header(t('text.title'), t('text.sub')));
      const fonts = [...new Set([...KNOWN_FONTS.filter(fontAvailable), ...detectedFonts])];
      const currentFont = primaryFont(S().fontFamily);
      if (currentFont && !fonts.includes(currentFont)) fonts.unshift(currentFont);
      const gal = document.createElement('div');
      gal.className = 'font-gallery';
      for (const f of fonts) {
        const card = document.createElement('div');
        card.className = 'font-card' + (f === currentFont ? ' active' : '');
        card.innerHTML = `<div class="font-sample" style="font-family:${esc(familyCss(f))}">Ab0O {}=&gt; ❯_</div><div class="font-name">${esc(f)}</div>`;
        card.onclick = () => { set({ fontFamily: familyCss(f) }); gal.querySelectorAll('.font-card').forEach(x => x.classList.toggle('active', x === card)); };
        hoverPreview(card, { fontFamily: familyCss(f) });
        gal.appendChild(card);
      }
      body.appendChild(gal);
      body.appendChild(btnRow(button(t('text.find'), async () => {
        try {
          const list = await window.queryLocalFonts();
          const fams = [...new Set(list.map(f => f.family))].filter(f => !fonts.includes(f) && isMono(f));
          detectedFonts = [...new Set([...detectedFonts, ...fams])];
          window.App.toast(fams.length ? t('text.found', { n: fams.length }) : t('text.noneFound'));
          renderBody();
        } catch { window.App.toast(t('text.findFail')); }
      }, '', 'search')));
      body.appendChild(field(t('text.custom'), t('text.customHint'), text('fontFamily')));
      body.appendChild(field(t('text.size'), 'Ctrl+= / Ctrl+- / Ctrl+0', range('fontSize', 8, 32, 1, (v) => v + 'px')));
      body.appendChild(field(t('text.lineHeight'), null, range('lineHeight', 1, 2, 0.05, (v) => v.toFixed(2))));
      body.appendChild(field(t('text.letterSpacing'), null, range('letterSpacing', -2, 4, 0.5, (v) => v + 'px')));
      body.appendChild(sub(t('text.glowSec')));
      body.appendChild(field(t('text.glow'), t('text.glowHint'), toggle('glow')));
      body.appendChild(field(t('text.glowStrength'), null, range('glowStrength', 1, 20, 1, (v) => v + 'px')));
      body.appendChild(sub(t('text.cursorSec')));
      body.appendChild(field(t('text.cursorStyle'), null, segmented('cursorStyle', ['bar', 'block', 'underline'].map(c => [c, t('text.c.' + c)]))));
      body.appendChild(field(t('text.blink'), null, toggle('cursorBlink')));
      body.appendChild(sub(t('text.perf')));
      body.appendChild(field(t('text.renderer'), t('text.rendererHint'), segmented('renderer', [['dom', 'DOM'], ['webgl', 'WebGL']])));
      body.appendChild(field(t('text.scrollback'), null, (() => { const i = document.createElement('input'); i.type = 'number'; i.min = 1000; i.max = 200000; i.value = S().scrollback; i.onchange = () => set({ scrollback: parseInt(i.value, 10) }); return i; })()));
    },

    window(body) {
      body.append(header(t('win.title'), t('win.sub')));
      body.appendChild(field(t('win.radius'), t('win.radiusHint'), range('borderRadius', 0, 28, 1, (v) => v + 'px')));
      body.appendChild(field(t('win.gap'), null, range('paneGap', 0, 24, 1, (v) => v + 'px')));
      body.appendChild(field(t('win.padding'), null, range('padding', 0, 32, 1, (v) => v + 'px')));
      body.appendChild(field(t('win.uiFont'), null, text('uiFont')));
      body.appendChild(sub(t('win.behavior')));
      body.appendChild(field(t('win.top'), window.App.keyFor('alwaysOnTop'), toggle('alwaysOnTop')));
      body.appendChild(field(t('win.hotkey'), t('win.hotkeyHint'), text('globalHotkey', 'Control+Alt+Space')));
      body.appendChild(field(t('win.copyOnSelect'), null, toggle('copyOnSelect')));
      body.appendChild(field(t('win.rightClick'), null, toggle('rightClickPaste')));
      body.appendChild(field(t('win.bell'), null, toggle('bellSound')));
      body.appendChild(field(t('win.confirmClose'), null, toggle('confirmClose')));
      body.appendChild(field(t('win.focusMode'), t('win.focusModeHint'), toggle('focusMode')));
    },

    claude(body) {
      body.append(header(t('claude.title'), t('claude.sub')));
      const profs = window.App.profiles.filter(p => !p.kind && !p.ssh).map(p => [p.id, p.name]);
      body.appendChild(field(t('claude.defaultProfile'), null, select('defaultProfile', profs)));
      body.appendChild(field(t('claude.startupSplit'), t('claude.startupSplitHint'), select('startupSplit', [['', t('common.none')], ...window.App.profiles.filter(p => !window.App.isClaude(p.id) && !p.ssh).map(p => [p.id, window.App.profileName(p)])], (v) => v || null)));
      body.appendChild(field(t('claude.splitRatio'), null, range('splitRatio', 0.15, 0.7, 0.05, (v) => Math.round(v * 100) + '%')));
      body.appendChild(field(t('claude.args'), t('claude.argsHint'), text('claudeArgs', '--continue', (v) => v.trim() ? v.trim().split(/\s+/) : [], (v) => (v || []).join(' '))));
      body.appendChild(field(t('claude.cwd'), t('claude.cwdHint'), text('claudeCwd', 'C:\\Users\\...\\dev')));

      // extra accounts (each one = a 'claude:<id>' profile with its own CLAUDE_CONFIG_DIR)
      body.appendChild(sub(t('acc.title')));
      body.appendChild(Object.assign(document.createElement('p'), { className: 'sub', textContent: t('acc.sub') }));
      const accounts = [...(S().claudeAccounts || [])];
      const accList = document.createElement('div');
      accList.className = 'card-list';
      const mainRow = document.createElement('div');
      mainRow.className = 'list-card';
      mainRow.innerHTML = `${icon('claude')}<div class="lc-main"><b>Claude Code</b><small>${esc(t('acc.main'))}</small></div>`;
      accList.appendChild(mainRow);
      if (!accounts.length) accList.appendChild(Object.assign(document.createElement('p'), { className: 'sub', textContent: t('acc.empty') }));
      accounts.forEach((a, i) => {
        const prof = window.App.profiles.find(p => p.id === 'claude:' + a.id);
        const row = document.createElement('div');
        row.className = 'list-card';
        row.innerHTML = `${icon('claude')}<div class="lc-main"><b>${esc(a.name)}</b><small>${esc(prof?.configDir || a.configDir || '')}</small></div>`;
        row.append(
          button(t('common.open'), async () => { closeSettings(); await window.App.newTab('claude:' + a.id, { split: S().startupSplit, ratio: S().splitRatio }); }, '', 'play'),
          button(t('acc.folder'), () => { if (prof?.configDir) api.openPath(prof.configDir); }, '', 'file'),
          button(t('common.edit'), () => accForm(a, i), '', 'sliders'),
          button(t('common.delete'), () => {
            accounts.splice(i, 1);
            const patch = { claudeAccounts: accounts };
            if (S().defaultProfile === 'claude:' + a.id) patch.defaultProfile = 'claude';
            set(patch); window.App.toast(t('acc.deleted')); renderBody();
          }, 'danger', 'trash')
        );
        accList.appendChild(row);
      });
      body.appendChild(accList);
      const accBox = document.createElement('div');
      accBox.className = 'form-box';
      body.appendChild(accBox);
      body.appendChild(btnRow(button(t('acc.new'), () => accForm({ name: '', configDir: '', cwd: '' }, -1), '', 'plus')));
      function accForm(a, idx) {
        accBox.innerHTML = '';
        const inputs = {};
        const mk = (k, label, hint, ph = '') => { const i = document.createElement('input'); i.type = 'text'; i.value = a[k] ?? ''; i.placeholder = ph; i.spellcheck = false; inputs[k] = i; accBox.appendChild(field(label, hint, i)); return i; };
        mk('name', t('acc.name'), idx < 0 ? t('acc.firstLogin') : null);
        mk('configDir', t('acc.dir'), t('acc.dirHint'));
        mk('cwd', t('acc.cwd'), t('claude.cwdHint'), S().claudeCwd || '');
        accBox.appendChild(btnRow(
          button(t('common.save'), () => {
            const v = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()]));
            if (!v.name) return window.App.toast(t('acc.need'));
            const acc = { id: a.id || Date.now().toString(36), name: v.name };
            if (v.configDir) acc.configDir = v.configDir;
            if (v.cwd) acc.cwd = v.cwd;
            if (idx >= 0) accounts[idx] = acc; else accounts.push(acc);
            set({ claudeAccounts: accounts }); // redrawn when the new profile list arrives (below)
          }, '', 'check'),
          button(t('common.cancel'), () => { accBox.innerHTML = ''; })
        ));
        inputs.name.focus();
      }

      body.appendChild(sub(t('claude.notif')));
      body.appendChild(field(t('claude.when'), t('claude.whenHint'), segmented('notifyMode', ['always', 'auto', 'off'].map(m => [m, t('claude.n.' + m)]), { preview: false })));
      body.appendChild(field(t('claude.sound'), null, toggle('notifySound')));
      body.appendChild(field(t('claude.duration'), t('claude.durationHint'), range('notifyDuration', 3, 30, 1, (v) => v + 's')));
      body.appendChild(field(t('claude.position'), null, segmented('notifyPosition', [['bottom-right', '↘'], ['top-right', '↗'], ['bottom-left', '↙'], ['top-left', '↖']], { preview: false })));
      const claudePane = () => { for (const tb of window.App.tabs) for (const p of tb.panes) if (p.profile && p.profile.id === 'claude' && p.ptyId) return p.ptyId; return null; };
      body.appendChild(btnRow(
        button(t('claude.testStop'), () => window.App.notify({ kind: 'stop', ptyId: claudePane(), message: t('notify.testStop'), where: 'Test' }), '', 'bell'),
        button(t('claude.testQuestion'), () => window.App.notify({ kind: 'question', ptyId: claudePane(), message: t('notify.testQuestion'), where: 'Test' }), '', 'question')
      ));

      body.appendChild(sub(t('claude.auto')));
      body.appendChild(field(t('claude.snippets'), t('claude.snippetsHint'),
        textarea('snippets', 'Info | sysinfo', (v) => (v || []).map(s => `${s.name} | ${s.command}`).join('\n'),
          (v) => v.split('\n').filter(l => l.includes('|')).map(l => { const [n, ...c] = l.split('|'); return { name: n.trim(), command: c.join('|').trim() }; }))));
      body.appendChild(field(t('claude.startup'), t('claude.startupHint'),
        textarea('startupCommands', 'Set-Location D:\\dev', (v) => (v || []).join('\n'), (v) => v.split('\n').map(s => s.trim()).filter(Boolean))));
      body.appendChild(field(t('claude.custom'), t('claude.customHint'),
        textarea('customProfiles', '[]', (v) => JSON.stringify(v || [], null, 2), (v) => JSON.parse(v || '[]'))));
    },

    ssh(body) {
      body.append(header(t('ssh.title'), t('ssh.sub')));
      const hosts = [...(S().sshHosts || [])];
      const list = document.createElement('div');
      list.className = 'card-list';
      if (!hosts.length) list.appendChild(Object.assign(document.createElement('p'), { className: 'sub', textContent: t('ssh.empty') }));
      hosts.forEach((h, i) => {
        const row = document.createElement('div');
        row.className = 'list-card';
        row.innerHTML = `${icon('server')}<div class="lc-main"><b>${esc(h.name)}</b><small>${esc((h.user ? h.user + '@' : '') + h.host + (h.port && +h.port !== 22 ? ':' + h.port : ''))}</small></div>`;
        row.append(
          button(t('common.connect'), async () => { closeSettings(); await window.App.newTab('ssh:' + h.name); }, '', 'play'),
          button(t('common.edit'), () => editForm(h, i), '', 'sliders'),
          button(t('common.delete'), () => { hosts.splice(i, 1); set({ sshHosts: hosts }); renderBody(); }, 'danger', 'trash')
        );
        list.appendChild(row);
      });
      body.appendChild(list);
      const formBox = document.createElement('div');
      formBox.className = 'form-box';
      body.appendChild(formBox);
      body.appendChild(btnRow(button(t('ssh.new'), () => editForm({ name: '', host: '', user: '', port: 22, key: '', extra: '' }, -1), '', 'plus')));
      function editForm(h, idx) {
        formBox.innerHTML = '';
        const inputs = {};
        const mk = (k, label, type = 'text') => { const i = document.createElement('input'); i.type = type; i.value = h[k] ?? ''; i.spellcheck = false; inputs[k] = i; formBox.appendChild(field(label, null, i)); return i; };
        mk('name', t('ssh.name')); mk('host', t('ssh.host')); mk('user', t('ssh.user')); mk('port', t('ssh.port'), 'number');
        const key = mk('key', t('ssh.key'));
        formBox.appendChild(btnRow(button(t('ssh.pickKey'), async () => { const p = await api.pickKey(); if (p) key.value = p; }, '', 'file')));
        mk('extra', t('ssh.extra'));
        formBox.appendChild(btnRow(
          button(t('common.save'), () => {
            const v = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()]));
            if (!v.name || !v.host) return window.App.toast(t('ssh.need'));
            v.port = parseInt(v.port, 10) || 22;
            if (idx >= 0) hosts[idx] = v; else hosts.push(v);
            set({ sshHosts: hosts }); renderBody();
          }, '', 'check'),
          button(t('common.cancel'), () => { formBox.innerHTML = ''; })
        ));
        inputs.name.focus();
      }
    },

    workspaces(body) {
      body.append(header(t('ws.title'), t('ws.sub')));
      const ws = S().workspaces || {};
      const list = document.createElement('div');
      list.className = 'card-list';
      const names = Object.keys(ws);
      if (!names.length) list.appendChild(Object.assign(document.createElement('p'), { className: 'sub', textContent: t('ws.empty') }));
      const count = (node) => node.p ? 1 : (node.c || []).reduce((a, c) => a + count(c), 0);
      for (const name of names) {
        const lay = ws[name];
        const row = document.createElement('div');
        row.className = 'list-card';
        row.innerHTML = `${icon('layout')}<div class="lc-main"><b>${esc(name)}</b><small>${esc(t('ws.summary', { tabs: lay.tabs.length, panes: lay.tabs.reduce((a, x) => a + count(x), 0) }))}</small></div>`;
        row.append(
          button(t('common.open'), async () => { closeSettings(); await Features.openWorkspace(name); }, '', 'play'),
          button(t('common.delete'), () => { const c = { ...ws }; delete c[name]; set({ workspaces: c }); renderBody(); }, 'danger', 'trash')
        );
        list.appendChild(row);
      }
      body.appendChild(list);
      body.appendChild(btnRow(button(t('ws.saveCurrent'), async () => { await Features.saveWorkspacePrompt(); renderBody(); }, '', 'plus')));
      body.appendChild(sub(t('gen.restore')));
      body.appendChild(field(t('gen.restore'), t('gen.restoreHint'), toggle('restoreSession')));
      body.appendChild(field(t('gen.claudeContinue'), t('gen.claudeContinueHint'), toggle('claudeContinueOnRestore')));
    },

    irc(body) {
      body.append(header(t('set.irc'), t('ircset.sub')));
      const cfg = { nick: '', realname: '', favorites: [], customNetworks: [], ...(S().irc || {}) };
      const mk = (k, label, hint) => { const i = document.createElement('input'); i.type = 'text'; i.value = cfg[k] || ''; i.spellcheck = false; i.onchange = () => set({ irc: { ...cfg, ...(S().irc || {}), [k]: i.value.trim() } }); body.appendChild(field(label, hint, i)); };
      mk('nick', t('ircset.nick'));
      mk('realname', t('ircset.realname'), t('ircset.realnameHint'));
      const ta = document.createElement('textarea');
      ta.value = JSON.stringify(cfg.customNetworks || [], null, 2); ta.spellcheck = false;
      ta.onchange = () => { try { set({ irc: { ...(S().irc || {}), customNetworks: JSON.parse(ta.value || '[]') } }); ta.style.borderColor = ''; } catch { ta.style.borderColor = '#e81123'; } };
      body.appendChild(field(t('ircset.custom'), t('ircset.customHint'), ta));
      body.appendChild(btnRow(button(t('ircset.open'), () => { closeSettings(); window.App.runAction ? window.App.runAction('irc') : runAction('irc'); }, '', 'irc')));
    },

    sounds(body) {
      body.append(header(t('snd.title'), t('snd.sub')));
      body.appendChild(field(t('snd.typing'), null, segmented('typingSound', ['off', 'soft', 'retro', 'mech', 'scifi'].map(s => [s, t('snd.t.' + s)]), { preview: false, after: (v) => { if (v !== 'off') Features.Sound.key(v); } })));
      body.appendChild(field(t('snd.volume'), null, range('soundVolume', 0, 1, 0.05, (v) => Math.round(v * 100) + '%')));
      body.appendChild(field(t('snd.done'), null, toggle('doneSound')));
      body.appendChild(btnRow(button(t('snd.test'), () => Features.Sound.test(), '', 'volume')));
    },

    keys(body) {
      body.append(header(t('keys.title'), t('keys.sub')));
      const table = document.createElement('table');
      table.className = 'kb-table';
      const binds = { ...window.App.DEFAULT_KEYS, ...(S().keybindings || {}) };
      for (const action of window.App.ACTIONS) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${esc(window.App.actionLabel(action))}</td><td><span class="kbd-chip" tabindex="0">${esc(binds[action] || '—')}</span></td>`;
        const chip = tr.querySelector('.kbd-chip');
        chip.onclick = () => {
          chip.textContent = t('keys.press');
          const onKey = (e) => {
            e.preventDefault(); e.stopPropagation();
            if (e.key === 'Escape') return done(binds[action]);
            if (e.key === 'Delete') return done('', true);
            const k = window.App.keyString(e);
            if (k) done(k, true);
          };
          const done = (val, save) => {
            window.removeEventListener('keydown', onKey, true);
            chip.textContent = val || '—';
            if (save) set({ keybindings: { ...(S().keybindings || {}), [action]: val } });
          };
          window.addEventListener('keydown', onKey, true);
        };
        table.appendChild(tr);
      }
      body.appendChild(table);
      body.appendChild(btnRow(button(t('keys.reset'), () => { set({ keybindings: {} }); renderBody(); }, '', 'reload')));
      const p = document.createElement('p');
      p.className = 'sub';
      p.innerHTML = t('keys.fixed');
      body.appendChild(p);
    },

    async advanced(body) {
      body.append(header(t('adv.title'), t('adv.sub')));
      // dependencies: status and install with winget (runs in a shell pane)
      body.appendChild(sub(t('deps.title')));
      const hint = document.createElement('p'); hint.className = 'sub'; hint.textContent = t('deps.sub');
      body.appendChild(hint);
      const list = document.createElement('div'); list.className = 'card-list';
      for (const d of await api.checkDeps()) {
        const row = document.createElement('div');
        row.className = 'list-card';
        row.innerHTML = `${icon(d.installed ? 'check' : 'download')}<div class="lc-main"><b>${esc(d.name)}</b><small>${esc(d.installed ? t('deps.installed') : d.required ? t('deps.missingRequired') : t('deps.missing'))}</small></div>`;
        if (!d.installed) row.append(button(t('deps.install'), () => { closeSettings(); window.App.runCommandFrom(window.App.active?.focused, `winget install --id ${d.id} -e --accept-source-agreements --accept-package-agreements`); window.App.toast(t('deps.restart')); }, '', 'download'));
        list.appendChild(row);
      }
      body.appendChild(list);
      body.appendChild(sub(t('adv.file')));
      const path = await api.settings.path();
      const p = document.createElement('p'); p.className = 'sub mono'; p.textContent = path;
      body.appendChild(p);
      body.appendChild(btnRow(
        button(t('act.openSettingsFile'), () => api.settings.openFile(), '', 'code'),
        button(t('act.reload'), () => location.reload(), '', 'reload'),
        button('DevTools', () => api.win.devtools(), '', 'terminal'),
        button(t('adv.reset'), async () => {
          if (!(await api.confirm(t('adv.resetConfirm')))) return;
          window.App.settings = await api.settings.reset();
          window.App.applySettings();
          renderBody();
        }, 'danger', 'trash')
      ));
    }
  };

  function cleanup() {
    for (const f of thumbs) f.destroy();
    thumbs = [];
    if (previewFx) { previewFx.destroy(); previewFx = null; }
    hoverOverride = null;
    document.body.classList.remove('peek');
  }

  function renderNav() {
    const nav = $('#settings-nav');
    nav.innerHTML = '';
    for (const [id, ic, key] of SECTIONS) {
      const it = document.createElement('div');
      it.className = 'nav-item' + (id === current ? ' active' : '');
      it.innerHTML = icon(ic) + `<span>${esc(t(key))}</span>`;
      it.onclick = () => { current = id; renderNav(); $('#settings-body').scrollTop = 0; renderBody(); };
      nav.appendChild(it);
    }
  }
  function renderBody() {
    const body = $('#settings-body');
    const scroll = body.scrollTop;
    cleanup();
    body.innerHTML = '';
    if (WITH_PREVIEW.has(current)) body.appendChild(buildPreview());
    const content = document.createElement('div');
    content.className = 'settings-content';
    body.appendChild(content);
    Promise.resolve(render[current](content)).then(() => { body.scrollTop = scroll; refreshPreview(); });
  }

  // the main process rebuilds the profiles (e.g. a new Claude account): show its folder
  api.onProfilesChanged(() => { if (current === 'claude' && !$('#settings').classList.contains('hidden')) setTimeout(renderBody); });

  return {
    render(section) { if (section) current = section; renderNav(); renderBody(); },
    cleanup,
    refresh: refreshPreview
  };
})();
