// Renders the icon proposals with Electron (Chromium draws the SVG).
//   electron tools/render-icons.js sheet <output.png>       → contact sheet
//   electron tools/render-icons.js build <key> <folder>      → icon.png + multi-size icon.ico
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const designs = require('./icon-designs');

const SIZES = [256, 128, 64, 48, 40, 32, 24, 20, 16];

async function rasterize(win, svg, size, bg) {
  const js = `(async () => {
    const img = new Image();
    img.src = 'data:image/svg+xml;base64,' + ${JSON.stringify(Buffer.from(svg).toString('base64'))};
    await img.decode();
    const c = document.createElement('canvas'); c.width = c.height = ${size};
    const x = c.getContext('2d');
    ${bg ? `x.fillStyle = ${JSON.stringify(bg)}; x.fillRect(0, 0, ${size}, ${size});` : ''}
    x.imageSmoothingQuality = 'high';
    x.drawImage(img, 0, 0, ${size}, ${size});
    return c.toDataURL('image/png');
  })()`;
  const url = await win.webContents.executeJavaScript(js);
  return Buffer.from(url.split(',')[1], 'base64');
}

function writeIco(file, pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, buf }, i) => {
    const o = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, o); head.writeUInt8(size >= 256 ? 0 : size, o + 1);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(buf.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += buf.length;
  });
  fs.writeFileSync(file, Buffer.concat([head, ...pngs.map(p => p.buf)]));
}

app.whenReady().then(async () => {
  const [mode, a, b] = process.argv.slice(process.argv.findIndex(x => /render-icons\.js$/.test(x)) + 1);
  const win = new BrowserWindow({ show: false });
  await win.loadURL('data:text/html,<html><body></body></html>');
  try {
    if (mode === 'sheet') {
      // contact sheet: each design large + small, on dark and light backgrounds (taskbar)
      const items = Object.entries(designs).map(([k, d]) => ({ k, name: d.name, b64: Buffer.from(d.svg).toString('base64') }));
      const url = await win.webContents.executeJavaScript(`(async () => {
        const items = ${JSON.stringify(items)};
        const W = 300, H = 290, G = 18, cols = 3, rows = Math.ceil(items.length / cols);
        const c = document.createElement('canvas'); c.width = G + cols * (W + G); c.height = G + rows * (H + G);
        const x = c.getContext('2d');
        x.fillStyle = '#1b1b1f'; x.fillRect(0, 0, c.width, c.height);
        const rr = (X, Y, w, h, r, f) => { x.beginPath(); x.roundRect(X, Y, w, h, r); x.fillStyle = f; x.fill(); };
        for (let i = 0; i < items.length; i++) {
          const it = items[i], X = G + (i % cols) * (W + G), Y = G + Math.floor(i / cols) * (H + G);
          rr(X, Y, W, H, 16, '#26262c');
          x.fillStyle = '#eee'; x.font = 'bold 21px Segoe UI'; x.textAlign = 'center';
          x.fillText(it.k + ' · ' + it.name, X + W / 2, Y + 32);
          const img = new Image(); img.src = 'data:image/svg+xml;base64,' + it.b64; await img.decode();
          x.drawImage(img, X + W / 2 - 80, Y + 46, 160, 160);
          rr(X + W / 2 - 62, Y + 222, 48, 48, 6, '#202020'); x.drawImage(img, X + W / 2 - 54, Y + 230, 32, 32);
          rr(X + W / 2 + 14, Y + 222, 48, 48, 6, '#f3f3f3'); x.drawImage(img, X + W / 2 + 22, Y + 230, 32, 32);
        }
        return c.toDataURL('image/png');
      })()`);
      fs.writeFileSync(a, Buffer.from(url.split(',')[1], 'base64'));
    } else if (mode === 'build') {
      const d = designs[a];
      if (!d) throw new Error('Unknown design: ' + a);
      const pngs = [];
      for (const size of SIZES) pngs.push({ size, buf: await rasterize(win, d.svg, size) });
      fs.writeFileSync(path.join(b, 'icon.png'), pngs[0].buf);
      fs.writeFileSync(path.join(b, 'icon.svg'), d.svg.trim());
      // name includes the design: Windows caches icons by file path
      writeIco(path.join(b, `icon-${a.toLowerCase()}.ico`), pngs);
    }
    console.log('ok');
  } catch (e) {
    console.error(e);
  }
  app.exit(0);
});
