// Main-process services for the extra features:
// command history, system monitor, wallpaper, file preview and recording.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');

module.exports = function registerFeatures({ ipcMain, dialog, app, session, desktopCapturer, getWin, findInPath, tr }) {
  // ------------------------------------------------------------ history
  ipcMain.handle('history:get', () => {
    const out = [];
    const read = (file, src) => {
      try {
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        let acc = '';
        for (const l of lines) {
          // PSReadLine stores multi-line commands with a trailing `
          if (l.endsWith('`')) { acc += l.slice(0, -1) + '\n'; continue; }
          const cmd = (acc + l).trim(); acc = '';
          if (cmd && !cmd.startsWith('#')) out.push({ cmd, src });
        }
      } catch {}
    };
    read(path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'PowerShell', 'PSReadLine', 'ConsoleHost_history.txt'), 'PowerShell');
    read(path.join(os.homedir(), '.bash_history'), 'Bash');
    // newest first, no duplicates
    const seen = new Set(), res = [];
    for (let i = out.length - 1; i >= 0 && res.length < 4000; i--) { if (seen.has(out[i].cmd)) continue; seen.add(out[i].cmd); res.push(out[i]); }
    return res;
  });

  // ------------------------------------------------------------ dependencies (installable from the app)
  const DEPS = [
    { id: 'Anthropic.ClaudeCode', exe: 'claude.exe', name: 'Claude Code', required: true, extra: [path.join(os.homedir(), '.local', 'bin', 'claude.exe')] },
    { id: 'Gyan.FFmpeg', exe: 'ffmpeg.exe', name: 'ffmpeg', required: true },
    { id: 'Git.Git', exe: 'git.exe', name: 'Git + Git Bash', extra: ['C:\\Program Files\\Git\\cmd\\git.exe'] },
    { id: 'Microsoft.PowerShell', exe: 'pwsh.exe', name: 'PowerShell 7', extra: ['C:\\Program Files\\PowerShell\\7\\pwsh.exe'] },
    { id: 'OpenJS.NodeJS.LTS', exe: 'node.exe', name: 'Node.js', extra: ['C:\\Program Files\\nodejs\\node.exe'] },
    { id: 'Insecure.Nmap', exe: 'nmap.exe', name: 'Nmap', extra: ['C:\\Program Files (x86)\\Nmap\\nmap.exe'] }
  ];
  ipcMain.handle('deps:check', () => {
    const links = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links');
    return DEPS.map(d => ({ ...d, installed: !!(findInPath(d.exe) || [path.join(links, d.exe), ...(d.extra || [])].find(p => fs.existsSync(p))) }));
  });

  // ------------------------------------------------------------ system monitor
  let monSubs = 0, monTimer = null, lastCpu = os.cpus(), lastNet = null, gpuCache = null, gpuTick = 0, topCache = [], topTick = 0;
  const nvsmi = findInPath('nvidia-smi.exe') || ['C:\\Windows\\System32\\nvidia-smi.exe', 'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe'].find(p => fs.existsSync(p));
  const run = (cmd, args) => new Promise((res) => execFile(cmd, args, { windowsHide: true, timeout: 4000 }, (err, stdout) => res(err ? '' : String(stdout))));

  function cpuStats() {
    const now = os.cpus();
    const cores = now.map((c, i) => {
      const p = lastCpu[i] ? lastCpu[i].times : c.times;
      let total = 0; for (const k in c.times) total += c.times[k] - p[k];
      return total ? Math.round(100 * (1 - (c.times.idle - p.idle) / total)) : 0;
    });
    lastCpu = now;
    return { total: Math.round(cores.reduce((a, b) => a + b, 0) / (cores.length || 1)), cores, model: now[0] ? now[0].model.trim() : '' };
  }
  async function netStats() {
    const s = await run('netstat', ['-e']);
    const line = s.split(/\r?\n/).find(l => /^\s*Bytes/i.test(l));
    if (!line) return null;
    const [rx, tx] = line.trim().split(/\s+/).slice(1).map(Number);
    const now = Date.now();
    let rate = { rx: 0, tx: 0 };
    if (lastNet) { const dt = (now - lastNet.t) / 1000; rate = { rx: Math.max(0, (rx - lastNet.rx) / dt), tx: Math.max(0, (tx - lastNet.tx) / dt) }; }
    lastNet = { rx, tx, t: now };
    return rate;
  }
  async function gpuStats() {
    if (!nvsmi) return null;
    const s = await run(nvsmi, ['--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu', '--format=csv,noheader,nounits']);
    const p = s.split(/\r?\n/)[0]?.split(',').map(x => x.trim());
    if (!p || p.length < 5) return null;
    return { name: p[0], util: +p[1], memUsed: +p[2], memTotal: +p[3], temp: +p[4] };
  }
  async function topProcs() {
    const s = await run('tasklist', ['/fo', 'csv', '/nh']);
    const rows = s.split(/\r?\n/).filter(Boolean).map(l => { const c = l.match(/"([^"]*)"/g)?.map(x => x.slice(1, -1)) || []; return { name: c[0], mem: parseInt((c[4] || '0').replace(/[^\d]/g, ''), 10) * 1024 }; });
    const agg = {};
    for (const r of rows) if (r.name) agg[r.name] = (agg[r.name] || 0) + r.mem;
    return Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, mem]) => ({ name, mem }));
  }
  function diskStats() {
    try { const d = fs.statfsSync(process.env.SystemDrive ? process.env.SystemDrive + '\\' : 'C:\\'); return { total: d.blocks * d.bsize, free: d.bavail * d.bsize }; } catch { return null; }
  }
  async function tick() {
    const w = getWin(); if (!w || w.isDestroyed()) return;
    if (gpuTick++ % 2 === 0) gpuCache = await gpuStats();
    if (topTick++ % 4 === 0) topCache = await topProcs();
    if (w.isDestroyed()) return;
    try { w.webContents.send('monitor:data', {
      cpu: cpuStats(), mem: { used: os.totalmem() - os.freemem(), total: os.totalmem() },
      net: await netStats(), gpu: gpuCache, disk: diskStats(), top: topCache, hasGpu: !!nvsmi, uptime: os.uptime()
    }); } catch {}
  }
  // never two reads at once (if one takes over 1 s, network speeds would be wrong)
  let busy = false;
  const safeTick = () => { if (busy) return; busy = true; tick().catch(() => {}).finally(() => { busy = false; }); };
  ipcMain.on('monitor:subscribe', () => { monSubs++; if (!monTimer) { safeTick(); monTimer = setInterval(safeTick, 1000); } });
  ipcMain.on('monitor:unsubscribe', () => { monSubs = Math.max(0, monSubs - 1); if (!monSubs && monTimer) { clearInterval(monTimer); monTimer = null; } });

  // ------------------------------------------------------------ Windows wallpaper
  ipcMain.handle('wallpaper:get', async () => {
    const s = await run('reg', ['query', 'HKCU\\Control Panel\\Desktop', '/v', 'WallPaper']);
    const m = s.match(/WallPaper\s+REG_SZ\s+(.+)/i);
    if (m && fs.existsSync(m[1].trim())) return m[1].trim();
    const tw = path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
    if (fs.existsSync(tw)) { const dst = path.join(app.getPath('userData'), 'wallpaper.jpg'); try { fs.copyFileSync(tw, dst); return dst; } catch {} }
    return null;
  });

  // ------------------------------------------------------------ file preview
  ipcMain.handle('file:info', (e, p) => {
    try { const st = fs.statSync(p); return { exists: true, size: st.size, isDir: st.isDirectory(), ext: path.extname(p).slice(1).toLowerCase(), name: path.basename(p), path: p }; }
    catch { return { exists: false, path: p }; }
  });
  ipcMain.handle('file:read', (e, p, max = 2 * 1024 * 1024) => {
    try { const fd = fs.openSync(p, 'r'); const buf = Buffer.alloc(Math.min(max, fs.fstatSync(fd).size)); fs.readSync(fd, buf, 0, buf.length, 0); fs.closeSync(fd); return buf.toString('utf8'); }
    catch { return null; }
  });
  ipcMain.handle('dir:list', (e, p) => {
    try { return fs.readdirSync(p, { withFileTypes: true }).slice(0, 500).map(d => ({ name: d.name, dir: d.isDirectory() })); } catch { return []; }
  });

  // ------------------------------------------------------------ window recording
  // Windows can't capture our own window when it uses acrylic/mica (WGC fails):
  // the screen containing the window is captured and the renderer crops the window area.
  const { screen } = require('electron');
  const displayOfWin = () => { const w = getWin(); return w ? screen.getDisplayMatching(w.getBounds()) : screen.getPrimaryDisplay(); };
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const d = displayOfWin();
      callback({ video: sources.find(s => String(s.display_id) === String(d.id)) || sources[0] });
    } catch { callback({}); }
  });
  ipcMain.handle('record:geom', () => { const d = displayOfWin(); return { display: d.bounds, scale: d.scaleFactor }; });

  ipcMain.handle('record:save', async (e, data) => {
    const w = getWin();
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const ffmpeg = findInPath('ffmpeg.exe');
    const r = await dialog.showSaveDialog(w, {
      title: tr('dlg.saveRecording'),
      defaultPath: path.join(app.getPath('videos'), `neon-${stamp}.${ffmpeg ? 'mp4' : 'webm'}`),
      filters: ffmpeg ? [{ name: 'MP4', extensions: ['mp4'] }, { name: 'GIF', extensions: ['gif'] }, { name: 'WebM', extensions: ['webm'] }] : [{ name: 'WebM', extensions: ['webm'] }]
    });
    if (r.canceled) return { ok: false, canceled: true };
    const buf = Buffer.from(data);
    const ext = path.extname(r.filePath).slice(1).toLowerCase();
    if (ext === 'webm' || !ffmpeg) { fs.writeFileSync(ext === 'webm' ? r.filePath : r.filePath.replace(/\.\w+$/, '.webm'), buf); return { ok: true, path: r.filePath }; }
    const tmp = path.join(os.tmpdir(), `neon-rec-${Date.now()}.webm`);
    fs.writeFileSync(tmp, buf);
    const args = ext === 'gif'
      ? ['-y', '-i', tmp, '-vf', 'fps=15,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse', r.filePath]
      : ['-y', '-i', tmp, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', r.filePath];
    const ok = await new Promise((res) => { const p = spawn(ffmpeg, args, { windowsHide: true }); p.on('close', (code) => res(code === 0)); p.on('error', () => res(false)); });
    try { fs.unlinkSync(tmp); } catch {}
    return ok ? { ok: true, path: r.filePath } : { ok: false, message: 'ffmpeg' };
  });
};
