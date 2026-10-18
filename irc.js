// Minimal IRC client in the main process. The renderer receives parsed lines and builds the UI.
const net = require('net');
const tls = require('tls');

function parseLine(line) {
  const msg = { raw: line, tags: {}, prefix: '', nick: '', command: '', params: [] };
  let rest = line;
  if (rest.startsWith('@')) {
    const sp = rest.indexOf(' ');
    for (const kv of rest.slice(1, sp).split(';')) { const [k, v = ''] = kv.split('='); msg.tags[k] = v; }
    rest = rest.slice(sp + 1);
  }
  if (rest.startsWith(':')) {
    const sp = rest.indexOf(' ');
    msg.prefix = rest.slice(1, sp);
    msg.nick = msg.prefix.split('!')[0];
    rest = rest.slice(sp + 1);
  }
  const ti = rest.indexOf(' :');
  let trailing = null;
  if (ti >= 0) { trailing = rest.slice(ti + 2); rest = rest.slice(0, ti); }
  const parts = rest.split(' ').filter(Boolean);
  msg.command = (parts.shift() || '').toUpperCase();
  msg.params = parts;
  if (trailing !== null) msg.params.push(trailing);
  return msg;
}

// UTF-8 when valid; otherwise Latin-1 (old servers)
function decode(buf) {
  const s = buf.toString('utf8');
  return s.includes('�') ? buf.toString('latin1') : s;
}

class Connection {
  constructor(id, opts, emit) {
    this.id = id; this.opts = opts; this.emit = emit;
    this.nick = opts.nick; this.buffer = Buffer.alloc(0); this.registered = false; this.closing = false;
  }
  connect() {
    const { host, port, tls: useTls } = this.opts;
    this.emit({ type: 'status', status: 'connecting' });
    const onConnect = () => {
      this.emit({ type: 'status', status: 'registering' });
      if (this.opts.password) this.send(`PASS ${this.opts.password}`);
      this.send(`NICK ${this.nick}`);
      this.send(`USER ${this.opts.user || this.nick} 0 * :${this.opts.realname || 'Neon Terminal'}`);
    };
    this.sock = useTls
      ? tls.connect({ host, port, servername: host, rejectUnauthorized: this.opts.verify !== false }, onConnect)
      : net.connect({ host, port }, onConnect);
    this.sock.setKeepAlive(true, 60000);
    this.sock.on('data', (chunk) => this.onData(chunk));
    this.sock.on('error', (err) => this.emit({ type: 'error', message: err.message }));
    this.sock.on('close', () => { this.emit({ type: 'status', status: 'disconnected' }); this.sock = null; });
  }
  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    let idx;
    while ((idx = this.buffer.indexOf(0x0a)) >= 0) {
      let lineBuf = this.buffer.subarray(0, idx);
      this.buffer = this.buffer.subarray(idx + 1);
      if (lineBuf.length && lineBuf[lineBuf.length - 1] === 0x0d) lineBuf = lineBuf.subarray(0, lineBuf.length - 1);
      if (!lineBuf.length) continue;
      const msg = parseLine(decode(lineBuf));
      if (msg.command === 'PING') { this.send(`PONG :${msg.params[msg.params.length - 1] || ''}`); continue; }
      if (msg.command === '001') { this.registered = true; this.nick = msg.params[0] || this.nick; this.emit({ type: 'status', status: 'connected', nick: this.nick }); }
      if (msg.command === '433' && !this.registered) { this.nick = this.nick.slice(0, 14) + '_'; this.send(`NICK ${this.nick}`); }
      if (msg.command === 'NICK' && msg.nick === this.nick) this.nick = msg.params[0];
      this.emit({ type: 'message', msg });
    }
  }
  send(line) {
    if (!this.sock || this.sock.destroyed) return false;
    this.sock.write(line.replace(/[\r\n]+/g, ' ') + '\r\n');
    return true;
  }
  quit(reason) {
    this.closing = true;
    this.send(`QUIT :${reason || 'Neon Terminal'}`);
    setTimeout(() => { try { this.sock && this.sock.destroy(); } catch {} }, 800);
  }
}

module.exports = function registerIrc(ipcMain, getWin) {
  const conns = new Map();
  const emitTo = (id) => (ev) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('irc:event', { net: id, ...ev }); };

  ipcMain.handle('irc:connect', (e, id, opts) => {
    const old = conns.get(id);
    if (old && old.sock && !old.sock.destroyed) return { ok: true, already: true };
    const c = new Connection(id, opts, emitTo(id));
    conns.set(id, c);
    c.connect();
    return { ok: true };
  });
  ipcMain.on('irc:send', (e, id, line) => { const c = conns.get(id); if (c) c.send(line); });
  ipcMain.on('irc:disconnect', (e, id) => { const c = conns.get(id); if (c) { c.quit(); conns.delete(id); } });
  return { closeAll: () => { for (const c of conns.values()) c.quit('Bye'); } };
};
