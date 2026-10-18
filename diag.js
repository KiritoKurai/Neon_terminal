// Diagnostic mode for automated tests (never active in normal use).
// Variables: NEON_SCREENSHOT=path.png (required), NEON_WAIT/NEON_WAIT2 (ms), NEON_TYPE (text for the last shell),
// NEON_JS (code for the UI), NEON_KEYS ("Control+C", "RightClick@x,y", "LeftClickJS"), NEON_NOTIFY_TEST=1
const fs = require('fs');

module.exports = function startDiag({ app, win, ptys, getNotifyWin, showNotification }) {
  const env = process.env;
  win.setAlwaysOnTop(true);
  win.webContents.on('console-message', (e) => { if (e.level !== 'info' && e.level !== 'debug') console.log(`[renderer:${e.level}] ${e.message}`); });

  if (env.NEON_NOTIFY_TEST) setTimeout(() => {
    showNotification({ kind: 'stop', ptyId: 1, title: 'Claude', message: 'Test notification', where: 'Test' });
    showNotification({ kind: 'question', ptyId: 1, title: 'Claude', message: 'Test question?', where: 'Test' });
  }, 3000);

  setTimeout(async () => {
    if (env.NEON_TYPE) { const last = [...ptys.values()].pop(); if (last) last.write(env.NEON_TYPE.replace(/\\r/g, '\r')); }
    if (env.NEON_JS) win.webContents.executeJavaScript(env.NEON_JS).catch((err) => console.log('NEON_JS error', err.message));
    if (env.NEON_KEYS) setTimeout(() => sendKeys(win, env.NEON_KEYS), 1500);
    setTimeout(() => capture(app, win, getNotifyWin()), +(env.NEON_WAIT2 || 3000));
  }, +(env.NEON_WAIT || 6000));
};

async function sendKeys(win, spec) {
  const { clipboard } = require('electron');
  await Promise.resolve(clipboard.writeText('ABANS')).catch(() => {});
  win.focus();
  for (const combo of spec.split(' ')) {
    if (combo === 'LeftClickJS') {
      const [x, y] = await win.webContents.executeJavaScript('window.__clickAt');
      win.webContents.sendInputEvent({ type: 'mouseMove', x, y });
      await new Promise(r => setTimeout(r, 400));
      win.webContents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 });
      win.webContents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 });
      continue;
    }
    const m = combo.match(/^RightClick@(\d+),(\d+)$/);
    if (m) {
      const [x, y] = [+m[1], +m[2]];
      for (const type of ['mouseDown', 'mouseUp', 'contextMenu']) win.webContents.sendInputEvent({ type, x, y, button: 'right', clickCount: 1 });
      continue;
    }
    const parts = combo.split('+'), keyCode = parts.pop(), modifiers = parts.map(p => p.toLowerCase());
    win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
    win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
  }
  setTimeout(async () => console.log('CLIPBOARD=[' + String(await clipboard.readText()).slice(0, 80) + ']'), 500);
}

async function capture(app, win, notifyWin) {
  const out = process.env.NEON_SCREENSHOT;
  const withTimeout = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
  try {
    await withTimeout(win.webContents.executeJavaScript('1'));
    try { fs.writeFileSync(out, (await withTimeout(win.webContents.capturePage())).toPNG()); } catch (err) { console.log('capture failed', err.message); }
    const dump = await win.webContents.executeJavaScript(`App.tabs.flatMap(t => t.panes).map(p => { const b = p.term.buffer.active, o = []; for (let i = 0; i < b.length; i++) o.push(b.getLine(i).translateToString(true)); return '=== ' + (p.profile && p.profile.name) + '\\n' + o.join('\\n').trim(); }).join('\\n\\n')`);
    fs.writeFileSync(out + '.txt', dump);
    if (notifyWin && notifyWin.isVisible()) fs.writeFileSync(out + '.notify.png', (await withTimeout(notifyWin.webContents.capturePage())).toPNG());
  } catch (err) {
    console.log('diag error', err);
  } finally {
    app.exit(0);
  }
}
