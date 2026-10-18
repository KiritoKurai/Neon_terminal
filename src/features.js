// Neon Terminal extra features (depend on the renderer.js core)
window.Features = (() => {
  const S = () => App.settings;
  const b64json = (v) => { try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(v), c => c.charCodeAt(0)))); } catch { return null; } };
  const fmtBytes = (n) => { const u = ['B', 'KB', 'MB', 'GB', 'TB']; let i = 0; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return `${n.toFixed(n < 10 && i ? 1 : 0)} ${u[i]}`; };

  // ================================================================ command history (Ctrl+R)
  let hist = [], histSel = 0, histFiltered = [];
  async function openHistory() {
    hist = await api.history();
    $('#history').classList.remove('hidden');
    const input = $('#history-input');
    input.value = '';
    histSel = 0;
    renderHistory();
    input.focus();
  }
  function closeHistory() { $('#history').classList.add('hidden'); App.active?.focused?.term.focus(); }
  function renderHistory() {
    const q = $('#history-input').value.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    histFiltered = hist.filter(h => words.every(w => h.cmd.toLowerCase().includes(w))).slice(0, 200);
    histSel = Math.min(histSel, Math.max(0, histFiltered.length - 1));
    const list = $('#history-list');
    list.innerHTML = '';
    if (!histFiltered.length) { list.appendChild(el('div', 'empty', esc(t('hist.empty')))); return; }
    histFiltered.forEach((h, i) => {
      const html = highlight(h.cmd.split('\n')[0], words);
      const row = el('div', 'pal-item hist-item' + (i === histSel ? ' sel' : ''), `<code>${html}</code><span class="kbd">${esc(h.src)}</span>`);
      row.onmouseenter = () => { histSel = i; list.querySelectorAll('.pal-item').forEach((r, j) => r.classList.toggle('sel', j === i)); };
      row.onclick = (e) => pickHistory(h, e.shiftKey);
      list.appendChild(row);
    });
    list.querySelector('.sel')?.scrollIntoView({ block: 'nearest' });
  }
  // marks matches on the raw text and escapes afterwards (never inside the HTML)
  function highlight(text, words) {
    const marks = new Array(text.length).fill(false), lower = text.toLowerCase();
    for (const w of words) for (let i = lower.indexOf(w); i >= 0; i = lower.indexOf(w, i + 1)) marks.fill(true, i, i + w.length);
    let out = '', open = false;
    for (let i = 0; i < text.length; i++) {
      if (marks[i] !== open) { out += marks[i] ? '<mark>' : '</mark>'; open = marks[i]; }
      out += esc(text[i]);
    }
    return out + (open ? '</mark>' : '');
  }
  async function pickHistory(h, run) {
    closeHistory();
    const target = await App.shellPaneFor(App.active?.focused);
    App.writePane(target, h.cmd + (run ? '\r' : ''));
    App.focusPane(target);
  }
  $('#history-input').addEventListener('input', () => { histSel = 0; renderHistory(); });
  $('#history-input').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { histSel = Math.min(histSel + 1, histFiltered.length - 1); renderHistory(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { histSel = Math.max(histSel - 1, 0); renderHistory(); e.preventDefault(); }
    else if (e.key === 'Enter') { const h = histFiltered[histSel]; if (h) pickHistory(h, e.shiftKey); }
    else if (e.key === 'Escape') closeHistory();
  });
  $('#history').addEventListener('mousedown', (e) => { if (e.target.id === 'history') closeHistory(); });

  // ================================================================ quick command bar
  function renderQuickBar() {
    const bar = $('#quickbar');
    if (!S().showQuickBar) return;
    bar.innerHTML = '';
    for (const s of S().snippets || []) {
      const b = el('button', 'qb-btn', `${icon('bolt')}<span>${esc(s.name)}</span>`);
      b.title = s.command;
      b.onclick = () => App.runCommandFrom(App.active?.focused, s.command);
      bar.appendChild(b);
    }
    const edit = el('button', 'qb-btn qb-edit', icon('plus'));
    edit.title = t('quick.edit');
    edit.onclick = () => openSettings('claude');
    bar.appendChild(edit);
  }

  // ⚡ dropdown with the quick commands (closes on outside click, Esc or blur)
  const qMenu = $('#quick-menu'), qBtn = $('#quick-btn');
  function closeQuickMenu() { qMenu.classList.add('hidden'); qBtn.classList.remove('on'); }
  function openQuickMenu() {
    if (!qMenu.classList.contains('hidden')) return closeQuickMenu();
    closeMenu();
    qMenu.innerHTML = `<div class="menu-head">${esc(t('quick.title'))}</div>`;
    const snippets = S().snippets || [];
    if (!snippets.length) qMenu.appendChild(el('div', 'empty', esc(t('quick.empty'))));
    for (const s of snippets) {
      const it = el('div', 'menu-item', `${icon('bolt')}<span>${esc(s.name)}</span><span class="kbd">${esc(s.command)}</span>`);
      it.onclick = () => { closeQuickMenu(); App.runCommandFrom(App.active?.focused, s.command); };
      qMenu.appendChild(it);
    }
    qMenu.appendChild(el('div', 'menu-sep'));
    const pin = el('div', 'menu-item', `${icon('pin')}<span>${esc(t(S().showQuickBar ? 'quick.unpin' : 'quick.pin'))}</span>`);
    pin.onclick = () => { closeQuickMenu(); App.setSetting({ showQuickBar: !S().showQuickBar }); };
    const edit = el('div', 'menu-item', `${icon('sliders')}<span>${esc(t('quick.edit'))}</span>`);
    edit.onclick = () => { closeQuickMenu(); openSettings('claude'); };
    qMenu.append(pin, edit);
    const r = qBtn.getBoundingClientRect();
    qMenu.style.left = Math.max(8, Math.min(r.right - 280, window.innerWidth - 290)) + 'px';
    qMenu.style.top = r.bottom + 4 + 'px';
    qMenu.style.maxHeight = (window.innerHeight - r.bottom - 16) + 'px';
    qMenu.classList.remove('hidden');
    qBtn.classList.add('on');
  }
  qBtn.onclick = openQuickMenu;
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#quick-menu') && !e.target.closest('#quick-btn')) closeQuickMenu(); }, true);
  window.addEventListener('blur', closeQuickMenu);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !qMenu.classList.contains('hidden')) { closeQuickMenu(); e.preventDefault(); e.stopPropagation(); } }, true);

  // ================================================================ errors → "Ask Claude"
  let lastFail = null;
  function showErrorChip(pane, info) {
    lastFail = { pane, ...info };
    pane.el.querySelector('.err-chip')?.remove();
    const chip = el('div', 'err-chip', `<span class="err-msg">${icon('shield')}<span>${esc(t('err.failed'))}</span></span><button class="btn">${icon('claude')}<span>${esc(t('err.ask'))}</span></button><button class="x">${icon('close')}</button>`);
    chip.querySelector('.btn').onclick = () => { chip.remove(); explain(lastFail); };
    chip.querySelector('.x').onclick = () => chip.remove();
    pane.el.appendChild(chip);
    clearTimeout(pane.errTimer);
    pane.errTimer = setTimeout(() => chip.remove(), 20000);
  }
  async function explain(info) {
    if (!info) return;
    const text = t('err.prompt', { shell: App.profileName(info.pane.profile), cmd: info.cmd, err: String(info.err || '').replace(/\s+/g, ' ').slice(0, 600) });
    const tab = info.pane.tab;
    let claude = tab.panes.find(p => p.profile?.id === 'claude' && !p.exited);
    if (!claude) {
      App.activateTab(tab); App.focusPane(info.pane);
      claude = await App.splitPane('row', 'claude');
      await sleep(5000); // Claude Code takes a few seconds to be ready
    }
    App.writePane(claude, text);
    await sleep(150);
    App.writePane(claude, '\r');
    App.focusPane(claude);
  }

  // ================================================================ shell-specific OSC
  function osc(pane, key, val) {
    switch (key) {
      case 'cmdfail': { const d = b64json(val); if (d && S().errorHelp) showErrorChip(pane, d); break; }
      case 'longdone': {
        const d = b64json(val); if (!d) break;
        if (S().doneSound) Sound.done(d.ok);
        const visible = document.hasFocus() && App.active === pane.tab;
        const msg = `${d.cmd}  ·  ${d.secs}s`;
        if (!visible) App.notify({ kind: 'info', title: d.ok ? t('notify.long') : t('notify.longFail'), message: msg, ptyId: pane.ptyId, where: t('notify.where', { n: App.tabs.indexOf(pane.tab) + 1 }) });
        else App.toast((d.ok ? '✓ ' : '✗ ') + t(d.ok ? 'notify.long' : 'notify.longFail') + ' · ' + d.secs + 's');
        break;
      }
      case 'preview': openPreview(val); break;
    }
  }

  // ================================================================ workspaces
  async function saveWorkspacePrompt() {
    const name = await App.askText(t('ws.promptTitle'), t('ws.default'));
    if (!name) return;
    App.setSetting({ workspaces: { ...(S().workspaces || {}), [name]: App.serializeLayout() } }, { silent: true });
    App.toast(t('toast.wsSaved', { name }));
  }
  async function openWorkspace(name) {
    const ws = (S().workspaces || {})[name];
    if (ws) await App.restoreLayout(ws);
  }

  // ================================================================ system monitor (built-in pane)
  const monitors = new Set();
  const HIST = 60;
  App.special.monitor = {
    title: () => t('mon.title'),
    mount(pane) {
      pane.body.innerHTML = `
        <div class="mon-grid">
          <div class="mon-card" data-k="cpu"><div class="mon-h">${icon('cpu')}<span data-l="mon.cpu"></span><b class="mon-v"></b></div><canvas></canvas><div class="mon-sub"></div><div class="mon-cores"></div></div>
          <div class="mon-card" data-k="ram"><div class="mon-h">${icon('memory')}<span data-l="mon.ram"></span><b class="mon-v"></b></div><canvas></canvas><div class="mon-sub"></div></div>
          <div class="mon-card" data-k="net"><div class="mon-h">${icon('activity')}<span data-l="mon.net"></span><b class="mon-v"></b></div><canvas></canvas><div class="mon-sub"></div></div>
          <div class="mon-card" data-k="gpu"><div class="mon-h">${icon('bolt')}<span data-l="mon.gpu"></span><b class="mon-v"></b></div><canvas></canvas><div class="mon-sub"></div></div>
          <div class="mon-card wide" data-k="top"><div class="mon-h">${icon('layers')}<span data-l="mon.top"></span><b class="mon-v disk"></b></div><div class="mon-top"></div></div>
        </div>`;
      pane.mon = { cpu: [], ram: [], rx: [], tx: [], gpu: [] };
      this.relabel(pane);
      monitors.add(pane);
      if (monitors.size === 1) api.monitor.subscribe();
    },
    relabel(pane) { pane.body.querySelectorAll('[data-l]').forEach(e => { e.textContent = t(e.dataset.l); }); },
    unmount(pane) { monitors.delete(pane); if (!monitors.size) api.monitor.unsubscribe(); },
    resize() {}
  };
  function spark(canvas, series, colors, max) {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
    const c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, h * i / 4); c.lineTo(w, h * i / 4); c.stroke(); }
    series.forEach((s, si) => {
      const col = colors[si];
      const m = max || Math.max(1, ...series.flat());
      c.beginPath();
      s.forEach((v, i) => { const x = w - (s.length - 1 - i) * (w / (HIST - 1)), y = h - (v / m) * (h - 4) - 2; i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.strokeStyle = col; c.lineWidth = 1.6; c.shadowColor = col; c.shadowBlur = 6; c.stroke(); c.shadowBlur = 0;
      if (s.length) { c.lineTo(w, h); c.lineTo(w - (s.length - 1) * (w / (HIST - 1)), h); c.closePath(); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col + '55'); g.addColorStop(1, col + '00'); c.fillStyle = g; c.fill(); }
    });
  }
  api.monitor.onData((d) => {
    const ui = App.currentTheme().ui;
    for (const pane of monitors) {
      const m = pane.mon, push = (arr, v) => { arr.push(v); if (arr.length > HIST) arr.shift(); };
      push(m.cpu, d.cpu.total); push(m.ram, d.mem.used / d.mem.total * 100);
      if (d.net) { push(m.rx, d.net.rx); push(m.tx, d.net.tx); }
      if (d.gpu) push(m.gpu, d.gpu.util);
      const card = (k) => pane.body.querySelector(`[data-k="${k}"]`);
      card('cpu').querySelector('.mon-v').textContent = d.cpu.total + '%';
      card('cpu').querySelector('.mon-sub').textContent = `${d.cpu.model} · ${t('mon.cores', { n: d.cpu.cores.length })}`;
      card('cpu').querySelector('.mon-cores').innerHTML = d.cpu.cores.map(c => `<i style="--v:${c}%" title="${c}%"></i>`).join('');
      spark(card('cpu').querySelector('canvas'), [m.cpu], [ui.accent], 100);
      card('ram').querySelector('.mon-v').textContent = Math.round(d.mem.used / d.mem.total * 100) + '%';
      card('ram').querySelector('.mon-sub').textContent = `${fmtBytes(d.mem.used)} / ${fmtBytes(d.mem.total)}`;
      spark(card('ram').querySelector('canvas'), [m.ram], [ui.accent2], 100);
      if (d.net) {
        card('net').querySelector('.mon-v').textContent = fmtBytes(d.net.rx) + '/s';
        card('net').querySelector('.mon-sub').innerHTML = `<span style="color:${ui.accent}">▼ ${t('mon.down')} ${fmtBytes(d.net.rx)}/s</span> · <span style="color:${ui.accent2}">▲ ${t('mon.up')} ${fmtBytes(d.net.tx)}/s</span>`;
        spark(card('net').querySelector('canvas'), [m.rx, m.tx], [ui.accent, ui.accent2]);
      }
      const g = card('gpu');
      if (d.gpu) {
        g.querySelector('.mon-v').textContent = d.gpu.util + '%';
        g.querySelector('.mon-sub').textContent = `${d.gpu.name} · ${(d.gpu.memUsed / 1024).toFixed(1)}/${(d.gpu.memTotal / 1024).toFixed(1)} GB · ${t('mon.temp')} ${d.gpu.temp}°C`;
        spark(g.querySelector('canvas'), [m.gpu], [ui.accent], 100);
      } else g.querySelector('.mon-sub').textContent = d.hasGpu ? '…' : t('mon.noGpu');
      const top = card('top');
      if (d.disk) top.querySelector('.disk').textContent = `${t('mon.disk')} ${fmtBytes(d.disk.total - d.disk.free)} / ${fmtBytes(d.disk.total)}`;
      const maxMem = Math.max(1, ...(d.top || []).map(p => p.mem));
      top.querySelector('.mon-top').innerHTML = (d.top || []).map(p => `<div class="mon-proc"><span>${esc(p.name)}</span><i style="--v:${p.mem / maxMem * 100}%"></i><b>${fmtBytes(p.mem)}</b></div>`).join('');
    }
  });

  // ================================================================ window recording
  let rec = null;
  async function toggleRecording() {
    if (rec) { if (rec.recorder.state !== 'inactive') rec.recorder.stop(); return; }
    try {
      // capture the screen and crop the window area into a canvas
      const geom = await api.recordGeom();
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream; video.muted = true;
      await video.play();
      const canvas = document.createElement('canvas');
      const even = (n) => Math.max(2, Math.round(n / 2) * 2);
      canvas.width = even(window.innerWidth * geom.scale); canvas.height = even(window.innerHeight * geom.scale);
      const cx = canvas.getContext('2d');
      let drawing = true;
      const draw = () => {
        if (!drawing) return;
        const ratio = video.videoWidth / geom.display.width; // video pixels per logical pixel
        const sx = (window.screenX - geom.display.x) * ratio, sy = (window.screenY - geom.display.y) * ratio;
        cx.drawImage(video, sx, sy, window.innerWidth * ratio, window.innerHeight * ratio, 0, 0, canvas.width, canvas.height);
        if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(draw); else requestAnimationFrame(draw);
      };
      draw();
      const out = canvas.captureStream(30);
      const type = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(out, { mimeType: type, videoBitsPerSecond: 6e6 });
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = async () => {
        drawing = false;
        stream.getTracks().forEach(tr => tr.stop());
        out.getTracks().forEach(tr => tr.stop());
        clearInterval(rec.timer); rec = null;
        $('#rec-indicator').classList.add('hidden'); $('#rec-btn').classList.remove('on');
        const buf = await new Blob(chunks, { type }).arrayBuffer();
        const r = await api.saveRecording(new Uint8Array(buf));
        if (r.ok) App.toast(t('toast.recSaved')); else if (!r.canceled) App.toast(t('toast.recFail', { msg: r.message || '' }));
      };
      recorder.start(500);
      // if the capture is stopped from outside, stop recording too
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { if (rec && rec.recorder.state !== 'inactive') rec.recorder.stop(); });
      const start = Date.now();
      rec = { recorder, chunks, canvas, timer: setInterval(() => { const s = Math.floor((Date.now() - start) / 1000); $('#rec-time').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 500) };
      $('#rec-time').textContent = '00:00';
      $('#rec-indicator').classList.remove('hidden'); $('#rec-btn').classList.add('on');
      App.toast(t('toast.recStart', { key: App.keyFor('record') }));
    } catch (e) { App.toast(t('toast.recFail', { msg: e.message })); }
  }
  $('#rec-indicator').onclick = () => toggleRecording();

  // ================================================================ automatic themes
  function minutes(hhmm) { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); }
  function autoThemeId() {
    const s = S();
    if (s.autoTheme === 'time') {
      const now = new Date(), cur = now.getHours() * 60 + now.getMinutes(), d = minutes(s.dayStart), n = minutes(s.nightStart);
      const isDay = d < n ? cur >= d && cur < n : !(cur >= n && cur < d);
      return isDay ? s.dayTheme : s.nightTheme;
    }
    if (s.autoTheme === 'wallpaper' && App.dynamicThemes && App.dynamicThemes.wallpaper) return 'wallpaper';
    return null;
  }
  let lastAuto = null;
  setInterval(() => { const id = autoThemeId(); if (id && id !== lastAuto) { lastAuto = id; App.applySettings(); } }, 60000);

  // Extracts a palette from the Windows wallpaper and turns it into a theme
  async function loadWallpaperTheme() {
    const p = await api.wallpaper();
    App.wallpaperPath = p;
    if (!p) return null;
    const img = new Image();
    img.src = fileUrl(p);
    try { await img.decode(); } catch { return null; }
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 64, 64);
    const data = x.getImageData(0, 0, 64, 64).data;
    const buckets = {};
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const [h, s, l] = rgbToHsl(r, g, b);
      if (s < 0.25 || l < 0.15 || l > 0.9) continue;
      const key = Math.round(h * 24) % 24; // 24 hue buckets (0 and 1 are the same red)
      buckets[key] = buckets[key] || { n: 0, r: 0, g: 0, b: 0, s: 0 };
      const B = buckets[key]; B.n++; B.r += r; B.g += g; B.b += b; B.s += s;
    }
    const top = Object.entries(buckets).map(([k, B]) => ({ k: +k, score: B.n * (B.s / B.n), rgb: [B.r / B.n, B.g / B.n, B.b / B.n] })).sort((a, b) => b.score - a.score);
    const base = top[0] ? top[0].rgb : [120, 140, 255];
    const hueDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 24 - d); }; // the hue circle wraps around
    const second = top.find(o => hueDist(o.k, top[0]?.k ?? 0) > 3)?.rgb || shift(base, 0.3);
    const accent = vivid(base), accent2 = vivid(second);
    const [hh] = rgbToHsl(...base);
    const bg = hslHex(hh, 0.35, 0.08), surface = hslHex(hh, 0.3, 0.13);
    const wallTheme = { label: t('skins.wallTheme'), base: 'cyberpunk', ui: { accent, accent2, bg, surface, text: '#f3f1f8', muted: hslHex(hh, 0.15, 0.6) }, term: { background: bg, cursor: accent, selectionBackground: accent + '44', magenta: accent2, cyan: accent, brightMagenta: accent2, brightCyan: accent } };
    App.dynamicThemes = { ...(App.dynamicThemes || {}), wallpaper: wallTheme };
    return wallTheme;
  }
  function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; } return [h, s, l]; }
  function hslHex(h, s, l) { const f = (n) => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); }
  function vivid(rgb) { const [h, s] = rgbToHsl(...rgb); return hslHex(h, Math.max(0.65, s), 0.64); }
  function shift(rgb, dh) { const [h, s, l] = rgbToHsl(...rgb); const hex = hslHex((h + dh) % 1, s, l); return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }

  // ================================================================ sounds
  const Sound = (() => {
    let ctx;
    const ac = () => (ctx = ctx || new AudioContext());
    const vol = () => Math.max(0.0002, (S().soundVolume ?? 0.5) * 0.25); // exponential ramps don't accept 0
    function blip(freq, dur, type = 'square', gain = 1, when = 0) {
      const c = ac(), o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + when;
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol() * gain, t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function noise(dur, gain = 1, hp = 2000) {
      const c = ac(), len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol() * gain;
      src.buffer = buf; src.connect(f).connect(g).connect(c.destination); src.start();
    }
    let lastKey = 0;
    return {
      key(kind) {
        const now = performance.now(); if (now - lastKey < 18) return; lastKey = now;
        try {
          if (kind === 'soft') noise(0.03, 0.6, 3000);
          else if (kind === 'mech') { noise(0.045, 1.4, 1200); blip(140 + Math.random() * 40, 0.03, 'triangle', 0.5); }
          else if (kind === 'retro') blip(600 + Math.random() * 300, 0.03, 'square', 0.35);
          else if (kind === 'scifi') blip(1200 + Math.random() * 800, 0.05, 'sine', 0.5);
        } catch {}
      },
      done(ok = true) { try { const n = ok ? [660, 880, 1320] : [440, 330]; n.forEach((f, i) => blip(f, 0.18, 'sine', 0.9, i * 0.09)); } catch {} },
      test() { this.key(S().typingSound === 'off' ? 'mech' : S().typingSound); setTimeout(() => this.done(true), 250); }
    };
  })();
  App.hooks.input.push((pane, d) => { if (S().typingSound && S().typingSound !== 'off' && (S().soundVolume ?? 0.5) > 0 && d.length === 1) Sound.key(S().typingSound); });

  // ================================================================ focus mode
  let revealTimer;
  $('#focus-reveal').addEventListener('mouseenter', () => { document.body.classList.add('focus-peek'); });
  $('#titlebar').addEventListener('mouseleave', () => { clearTimeout(revealTimer); revealTimer = setTimeout(() => document.body.classList.remove('focus-peek'), 500); });
  $('#titlebar').addEventListener('mouseenter', () => clearTimeout(revealTimer));

  // ================================================================ file preview
  const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'avif'], VID = ['mp4', 'webm', 'mov', 'mkv'], AUD = ['mp3', 'wav', 'ogg', 'flac', 'm4a'];
  let previewPath = null;
  async function openPreview(p) {
    const info = await api.file.info(p);
    previewPath = p;
    const body = $('#preview-body');
    $('#preview-name').textContent = info.name || p;
    $('#preview-meta').textContent = info.exists ? (info.isDir ? '' : fmtBytes(info.size)) : '';
    body.innerHTML = '';
    body.className = '';
    $('#preview').classList.remove('hidden');
    if (!info.exists) { body.appendChild(el('div', 'empty', esc(t('prev.notFound')))); return; }
    const url = fileUrl(p), ext = info.ext;
    if (info.isDir) {
      const items = await api.file.list(p);
      body.className = 'pv-dir';
      body.innerHTML = items.map(i => `<div>${icon(i.dir ? 'folder' : 'file')}<span>${esc(i.name)}</span></div>`).join('');
    } else if (IMG.includes(ext)) { body.className = 'pv-media'; body.innerHTML = `<img src="${url}">`; }
    else if (VID.includes(ext)) { body.className = 'pv-media'; body.innerHTML = `<video src="${url}" controls autoplay></video>`; }
    else if (AUD.includes(ext)) { body.className = 'pv-media'; body.innerHTML = `<audio src="${url}" controls autoplay></audio>`; }
    else if (ext === 'pdf') { body.className = 'pv-media'; body.innerHTML = `<iframe src="${url}"></iframe>`; }
    else {
      if (info.size > 5 * 1024 * 1024) { body.appendChild(el('div', 'empty', esc(t('prev.tooLarge', { size: fmtBytes(info.size) })))); return; }
      const text = await api.file.read(p);
      if (text == null || /\u0000/.test(text.slice(0, 2000))) { body.appendChild(el('div', 'empty', esc(t('prev.unsupported')))); return; }
      if (ext === 'json') { body.className = 'pv-code'; try { body.innerHTML = `<pre>${highlightJson(JSON.stringify(JSON.parse(text), null, 2))}</pre>`; } catch { body.innerHTML = `<pre>${esc(text)}</pre>`; } }
      else if (ext === 'md' || ext === 'markdown') {
        body.className = 'pv-md';
        body.innerHTML = markdown(text);
        // images with relative paths: relative to the file's folder
        const dir = p.replace(/[\\/][^\\/]*$/, '');
        body.querySelectorAll('img').forEach(img => { const s = img.getAttribute('src') || ''; if (!/^(https?|data|file):/i.test(s)) img.src = fileUrl(dir + '\\' + s.replace(/\//g, '\\')); });
      }
      else if (ext === 'csv' || ext === 'tsv') { body.className = 'pv-table'; body.innerHTML = csvTable(text, ext === 'tsv' ? '\t' : guessSep(text)); }
      else { body.className = 'pv-code'; body.innerHTML = `<pre>${esc(text)}</pre>`; }
    }
  }
  function closePreview() { $('#preview').classList.add('hidden'); $('#preview-body').innerHTML = ''; App.active?.focused?.term.focus(); }
  $('#preview-close').onclick = closePreview;
  $('#preview-ext').onclick = () => { if (previewPath) api.openPath(previewPath); };
  $('#preview').addEventListener('mousedown', (e) => { if (e.target.id === 'preview') closePreview(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#preview').classList.contains('hidden')) closePreview(); }, true);

  function highlightJson(s) {
    return esc(s).replace(/(&quot;(?:\\.|[^&]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi, (m, str, colon, kw, num) =>
      str ? `<span class="${colon ? 'j-key' : 'j-str'}">${str}</span>${colon || ''}` : kw ? `<span class="j-kw">${kw}</span>` : `<span class="j-num">${num}</span>`);
  }
  function inlineMd(s) {
    return esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }
  function markdown(src) {
    const lines = src.replace(/\r/g, '').split('\n'), out = [];
    let inCode = false, list = null, para = [];
    const flush = () => { if (para.length) { out.push(`<p>${inlineMd(para.join(' '))}</p>`); para = []; } if (list) { out.push(`</${list}>`); list = null; } };
    for (const l of lines) {
      if (l.startsWith('```')) { flush(); out.push(inCode ? '</code></pre>' : '<pre><code>'); inCode = !inCode; continue; }
      if (inCode) { out.push(esc(l) + '\n'); continue; }
      let m;
      if ((m = l.match(/^(#{1,6})\s+(.*)/))) { flush(); out.push(`<h${m[1].length}>${inlineMd(m[2])}</h${m[1].length}>`); }
      else if ((m = l.match(/^\s*[-*+]\s+(.*)/))) { if (para.length) flush(); if (list !== 'ul') { if (list) out.push(`</${list}>`); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inlineMd(m[1])}</li>`); }
      else if ((m = l.match(/^\s*\d+\.\s+(.*)/))) { if (para.length) flush(); if (list !== 'ol') { if (list) out.push(`</${list}>`); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inlineMd(m[1])}</li>`); }
      else if (/^>\s?/.test(l)) { flush(); out.push(`<blockquote>${inlineMd(l.replace(/^>\s?/, ''))}</blockquote>`); }
      else if (/^(-{3,}|\*{3,})$/.test(l.trim())) { flush(); out.push('<hr>'); }
      else if (/^\|.*\|$/.test(l.trim())) { flush(); out.push(l); }
      else if (!l.trim()) flush();
      else para.push(l);
    }
    flush();
    // simple tables
    return out.join('\n').replace(/((?:^\|.*\|$\n?)+)/gm, (block) => {
      const rows = block.trim().split('\n').filter(r => !/^\|\s*:?-{2,}/.test(r));
      return '<table>' + rows.map((r, i) => '<tr>' + r.trim().slice(1, -1).split('|').map(c => i ? `<td>${inlineMd(c.trim())}</td>` : `<th>${inlineMd(c.trim())}</th>`).join('') + '</tr>').join('') + '</table>';
    });
  }
  function guessSep(text) { const l = text.split('\n')[0]; return (l.match(/;/g) || []).length > (l.match(/,/g) || []).length ? ';' : ','; }
  function csvTable(text, sep) {
    const rows = text.replace(/\r/g, '').split('\n').filter(Boolean).slice(0, 500).map(r => r.split(sep));
    return '<table>' + rows.map((r, i) => '<tr>' + r.map(c => i ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('') + '</tr>').join('') + '</table>';
  }
  $('#preview-body').addEventListener('click', (e) => { const a = e.target.closest('a'); if (a) { e.preventDefault(); api.openExternal(a.getAttribute('href')); } });

  return {
    openHistory, renderQuickBar, osc, explainLast: () => explain(lastFail), saveWorkspacePrompt, openWorkspace,
    toggleRecording, autoThemeId, loadWallpaperTheme, Sound, openPreview,
    recState: () => rec && { bytes: rec.chunks.reduce((a, c) => a + c.size, 0), w: rec.canvas.width, h: rec.canvas.height, sample: [...rec.canvas.getContext('2d').getImageData(rec.canvas.width / 2 | 0, rec.canvas.height / 2 | 0, 1, 1).data] }
  };
})();
