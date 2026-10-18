// Built-in IRC chat (app pane). Connections live in the main process (irc.js).
(() => {
  const NETWORKS = [
    { id: 'libera', name: 'Libera.Chat', host: 'irc.libera.chat', port: 6697, tls: true, tag: 'irc.tag.tech' },
    { id: 'oftc', name: 'OFTC', host: 'irc.oftc.net', port: 6697, tls: true, tag: 'irc.tag.tech' },
    { id: 'hispano', name: 'Chat-Hispano', host: 'irc.chathispano.com', port: 6697, tls: true, tag: 'irc.tag.spanish' },
    { id: 'rizon', name: 'Rizon', host: 'irc.rizon.net', port: 6697, tls: true, tag: 'irc.tag.anime' },
    { id: 'dalnet', name: 'DALnet', host: 'irc.dal.net', port: 6697, tls: true, tag: 'irc.tag.social' },
    { id: 'efnet', name: 'EFnet', host: 'irc.efnet.org', port: 6697, tls: true, tag: 'irc.tag.classic' },
    { id: 'ircnet', name: 'IRCnet', host: 'open.ircnet.net', port: 6667, tls: false, tag: 'irc.tag.classic' },
    { id: 'undernet', name: 'Undernet', host: 'irc.undernet.org', port: 6667, tls: false, tag: 'irc.tag.social' },
    { id: 'quakenet', name: 'QuakeNet', host: 'irc.quakenet.org', port: 6667, tls: false, tag: 'irc.tag.gaming' }
  ];
  const STATUS = '*';
  const HOT = '#hot'; // special view: active channels across all networks (not a network)
  const MAIN_NETS = ['libera', 'oftc', 'hispano', 'rizon', 'dalnet'];
  const MAX_MSGS = 1500;
  const S = () => App.settings;
  const lc = (s) => String(s || '').toLowerCase();
  const isChan = (s) => /^[#&!+]/.test(s || '');
  const strip = (s) => String(s || '').replace(/\x03(\d{1,2}(,\d{1,2})?)?|[\x02\x0F\x16\x1D\x1F\x1E\x11]/g, '');
  const hhmm = () => new Date().toLocaleTimeString(t.locale(), { hour: '2-digit', minute: '2-digit' });

  // ---------------------------------------------------------------- shared state
  const IRC = window.IRC = { nets: {}, panes: new Set() };
  const allNetworks = () => [...NETWORKS, ...((S().irc && S().irc.customNetworks) || [])];
  const ircCfg = () => ({ nick: '', realname: '', favorites: [], customNetworks: [], ...(S().irc || {}) });
  const saveIrc = (patch) => App.setSetting({ irc: { ...ircCfg(), ...patch } }, { silent: true });

  function net(id) {
    if (!IRC.nets[id]) {
      const cfg = allNetworks().find(n => n.id === id);
      IRC.nets[id] = { id, cfg, status: 'disconnected', nick: '', bufs: new Map(), list: [], listing: false, rejoin: new Set() };
      buf(id, STATUS, cfg ? cfg.name : id);
    }
    return IRC.nets[id];
  }
  function buf(netId, name, display) {
    const n = IRC.nets[netId] || net(netId);
    const key = name === STATUS ? STATUS : lc(name);
    if (!n.bufs.has(key)) n.bufs.set(key, { key, name: display || name, topic: '', users: new Map(), msgs: [], times: [], unread: 0, mention: false, joined: false, query: name !== STATUS && !isChan(name) });
    return n.bufs.get(key);
  }
  // messages per minute in a channel you're in (average over the last 5 minutes)
  const RATE_WINDOW = 5 * 60 * 1000;
  function rate(b) {
    const now = Date.now();
    while (b.times.length && now - b.times[0] > RATE_WINDOW) b.times.shift();
    return Math.round(b.times.length / 5 * 10) / 10;
  }
  const rateLabel = (r) => (r >= 10 ? Math.round(r) : r) + '/min';

  function push(netId, name, m) {
    const b = buf(netId, name);
    if (m.type === 'msg' || m.type === 'action') b.times.push(Date.now());
    b.msgs.push({ time: hhmm(), ...m });
    if (b.msgs.length > MAX_MSGS) b.msgs.splice(0, b.msgs.length - MAX_MSGS);
    const viewed = [...IRC.panes].some(p => p.irc.view.net === netId && p.irc.view.buf === b.key && document.hasFocus() && App.active === p.tab);
    if (!viewed && (m.type === 'msg' || m.type === 'action')) { b.unread++; if (m.mention) b.mention = true; }
    for (const p of IRC.panes) if (p.irc.view.net === netId && p.irc.view.buf === b.key) appendMsg(p, b.msgs[b.msgs.length - 1]);
    scheduleSide();
  }

  // ---------------------------------------------------------------- connection
  async function connect(id) {
    const n = net(id);
    let nick = ircCfg().nick;
    if (!nick) {
      nick = await App.askText(t('irc.chooseNick'), 'neon' + Math.floor(1000 + Math.random() * 9000));
      if (!nick) return;
      nick = nick.replace(/[^A-Za-z0-9_\-\[\]\\^{}|`]/g, '').slice(0, 16) || 'neon' + Date.now() % 10000;
      saveIrc({ nick });
    }
    n.nick = nick;
    n.status = 'connecting';
    push(id, STATUS, { type: 'sys', text: t('irc.connecting', { host: `${n.cfg.host}:${n.cfg.port}` }) });
    await api.irc.connect(id, { host: n.cfg.host, port: n.cfg.port, tls: n.cfg.tls, nick, realname: ircCfg().realname || 'Neon Terminal' });
    renderAll();
  }
  function disconnect(id) { api.irc.disconnect(id); const n = net(id); n.status = 'disconnected'; for (const b of n.bufs.values()) b.joined = false; renderAll(); }
  const send = (id, line) => api.irc.send(id, line);
  function say(id, target, text) {
    const n = net(id);
    for (const chunk of text.match(/[\s\S]{1,400}/g) || []) {
      send(id, `PRIVMSG ${target} :${chunk}`);
      push(id, target, { type: 'msg', nick: n.nick, text: chunk, self: true });
    }
  }
  // joins a channel; the requesting pane switches to it when the server confirms
  function join(id, chan, pane) {
    const n = net(id);
    if (pane) pane.irc.pendingOpen = lc(chan);
    if (n.status !== 'connected') {
      n.rejoin.add(chan);
      if (n.status === 'disconnected') return connect(id);
      return; // already connecting: it will join when done
    }
    send(id, `JOIN ${chan}`);
  }
  function requestList(id) { const n = net(id); n.list = []; n.listing = true; send(id, 'LIST >25'); renderAll(); }

  // ---------------------------------------------------------------- server events
  api.irc.onEvent((ev) => {
    const n = net(ev.net);
    if (ev.type === 'status') {
      n.status = ev.status;
      if (ev.nick) n.nick = ev.nick;
      if (ev.status === 'connected') {
        push(ev.net, STATUS, { type: 'sys', text: t('irc.connected', { nick: n.nick }) });
        // rejoin the channels you were in (or the one requested before connecting)
        for (const c of n.rejoin) send(ev.net, `JOIN ${c}`);
        n.rejoin.clear();
        requestList(ev.net);
      }
      if (ev.status === 'disconnected') { for (const b of n.bufs.values()) { if (b.joined) n.rejoin.add(b.name); b.joined = false; } push(ev.net, STATUS, { type: 'sys', text: t('irc.disconnected') }); }
      renderAll();
      return;
    }
    if (ev.type === 'error') { push(ev.net, STATUS, { type: 'err', text: ev.message }); return; }
    const m = ev.msg, me = lc(n.nick), P = m.params;
    switch (m.command) {
      case 'PRIVMSG': case 'NOTICE': {
        let target = P[0], text = P[1] || '';
        if (text.startsWith('\x01') && m.command === 'PRIVMSG') {
          const ctcp = text.slice(1, -1);
          if (/^ACTION /.test(ctcp)) { text = ctcp.slice(7); } else { if (/^VERSION/.test(ctcp)) send(ev.net, `NOTICE ${m.nick} :\x01VERSION Neon Terminal\x01`); break; }
          const where = lc(target) === me ? m.nick : target;
          push(ev.net, where, { type: 'action', nick: m.nick, text: strip(text), mention: mentions(text, n.nick) && lc(m.nick) !== me });
          break;
        }
        const where = !m.nick || m.nick.includes('.') || target === '*' ? STATUS : lc(target) === me ? m.nick : target;
        const mention = lc(target) === me || mentions(text, n.nick);
        push(ev.net, where, { type: m.command === 'NOTICE' ? 'notice' : 'msg', nick: m.nick || m.prefix, text: strip(text), mention: mention && where !== STATUS });
        if (mention && where !== STATUS && lc(m.nick) !== me) maybeNotify(ev.net, where, m.nick, strip(text));
        break;
      }
      case 'JOIN': {
        const chan = P[0];
        const b = buf(ev.net, chan);
        if (lc(m.nick) === me) {
          b.joined = true; b.name = chan;
          // open the channel only in the pane that asked for it or the one browsing this network
          for (const p of IRC.panes) if (p.irc.pendingOpen === lc(chan) || (p.irc.view.net === ev.net && !p.irc.view.buf)) { p.irc.pendingOpen = null; openBuf(p, ev.net, lc(chan)); }
          push(ev.net, chan, { type: 'sys', text: t('irc.youJoined', { chan }) });
        } else { b.users.set(m.nick, ''); push(ev.net, chan, { type: 'join', text: t('irc.joined', { nick: m.nick }) }); }
        renderUsersSoon(ev.net, b.key);
        break;
      }
      case 'PART': {
        const b = buf(ev.net, P[0]);
        if (lc(m.nick) === me) { b.joined = false; push(ev.net, P[0], { type: 'sys', text: t('irc.youLeft') }); }
        else { b.users.delete(m.nick); push(ev.net, P[0], { type: 'part', text: t('irc.left', { nick: m.nick }) + (P[1] ? ` (${strip(P[1])})` : '') }); }
        renderUsersSoon(ev.net, b.key);
        break;
      }
      case 'QUIT':
        for (const b of n.bufs.values()) if (b.users.has(m.nick)) { b.users.delete(m.nick); push(ev.net, b.name, { type: 'part', text: t('irc.quit', { nick: m.nick }) + (P[0] ? ` (${strip(P[0])})` : '') }); renderUsersSoon(ev.net, b.key); }
        break;
      case 'KICK': {
        const b = buf(ev.net, P[0]);
        b.users.delete(P[1]);
        if (lc(P[1]) === me) b.joined = false;
        push(ev.net, P[0], { type: 'part', text: t('irc.kicked', { nick: P[1], by: m.nick }) + (P[2] ? ` (${strip(P[2])})` : '') });
        renderUsersSoon(ev.net, b.key);
        break;
      }
      case 'NICK': {
        const nn = P[0];
        if (lc(m.nick) === me) { n.nick = nn; renderAll(); }
        for (const b of n.bufs.values()) if (b.users.has(m.nick)) { const pre = b.users.get(m.nick); b.users.delete(m.nick); b.users.set(nn, pre); push(ev.net, b.name, { type: 'sys', text: t('irc.nickChange', { old: m.nick, nick: nn }) }); renderUsersSoon(ev.net, b.key); }
        break;
      }
      case '353': {
        const b = buf(ev.net, P[2]);
        for (const raw of (P[3] || '').split(' ').filter(Boolean)) { const pre = (raw.match(/^[~&@%+]+/) || [''])[0]; b.users.set(raw.slice(pre.length), pre[0] || ''); }
        break;
      }
      case '366': renderUsersSoon(ev.net, lc(P[1])); break;
      case '332': { const b = buf(ev.net, P[1]); b.topic = strip(P[2]); renderHeadSoon(); break; }
      case 'TOPIC': { const b = buf(ev.net, P[0]); b.topic = strip(P[1]); push(ev.net, P[0], { type: 'sys', text: t('irc.topicChange', { nick: m.nick, topic: b.topic }) }); renderHeadSoon(); break; }
      case '321': n.list = []; n.listing = true; break;
      case '322': n.list.push({ chan: P[1], users: +P[2] || 0, topic: strip(P[3] || '').replace(/^\[[^\]]*\]\s*/, '') }); if (n.list.length % 200 === 0) renderBrowserSoon(); break;
      case '323': n.listing = false; n.list.sort((a, b) => b.users - a.users); renderBrowserSoon(); break;
      case '433': push(ev.net, STATUS, { type: 'err', text: t('irc.nickInUse', { nick: P[1] }) }); break;
      case 'PONG': case 'MODE': case 'CAP': break;
      default:
        if (/^\d{3}$/.test(m.command)) {
          const text = strip(P.slice(1).join(' '));
          if (text) push(ev.net, STATUS, { type: +m.command >= 400 ? 'err' : 'server', text });
        }
    }
  });

  function mentions(text, nick) { return !!nick && new RegExp(`(^|[^\\w])${nick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`, 'i').test(text); }
  function maybeNotify(netId, where, from, text) {
    const visible = [...IRC.panes].some(p => p.irc.view.net === netId && p.irc.view.buf === lc(where) && document.hasFocus() && App.active === p.tab);
    if (visible) return;
    App.notify({ kind: 'info', title: `${where} · ${from}`, message: text, ptyId: null, where: net(netId).cfg?.name || netId });
    if (App.settings.notifySound !== false) window.Features?.Sound?.done(true);
  }

  // ---------------------------------------------------------------- interface
  const nickColor = (nick) => { let h = 0; for (const c of String(nick)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360}, 75%, 68%)`; };
  const linkify = (s) => esc(s).replace(/\b(https?:\/\/[^\s<>"']+)/g, '<a href="$1" class="irc-link">$1</a>');

  function openBuf(pane, netId, key) {
    pane.irc.view = { net: netId, buf: key };
    const b = net(netId).bufs.get(key);
    if (b) { b.unread = 0; b.mention = false; }
    renderPane(pane);
    pane.irc.input?.focus();
  }

  function renderAll() { for (const p of IRC.panes) renderPane(p); }
  let sideRaf, browserTimer, headRaf;
  function scheduleSide() { cancelAnimationFrame(sideRaf); sideRaf = requestAnimationFrame(() => { for (const p of IRC.panes) renderSide(p); App.renderTabs(); }); }
  function renderBrowserSoon() { clearTimeout(browserTimer); browserTimer = setTimeout(() => { for (const p of IRC.panes) if (!p.irc.view.buf) { renderHead(p); renderMain(p); } }, 120); }
  function renderHeadSoon() { cancelAnimationFrame(headRaf); headRaf = requestAnimationFrame(() => { for (const p of IRC.panes) renderHead(p); }); }
  function renderUsersSoon(netId, key) { for (const p of IRC.panes) if (p.irc.view.net === netId && p.irc.view.buf === key) renderUsers(p); scheduleSide(); }

  function renderPane(pane) { renderSide(pane); renderHead(pane); renderMain(pane); renderUsers(pane); App.renderTabs(); } // the tab title is the open channel
  // message rates decay over time: refresh the sidebar every 30 s
  setInterval(() => { if (IRC.panes.size) scheduleSide(); }, 30000);

  function renderSide(pane) {
    const side = pane.irc.side, cfg = ircCfg();
    const favs = cfg.favorites || [];
    let html = `<div class="irc-me" title="${esc(t('irc.changeNick'))}">${icon('users')}<span>${esc(cfg.nick || t('irc.noNick'))}</span></div>`;
    const hotCount = Object.values(IRC.nets).reduce((a, n) => a + (n.status === 'connected' ? n.list.length : 0), 0);
    html += `<div class="irc-hot${pane.irc.view.net === HOT ? ' active' : ''}" data-act="hot">${icon('flame')}<span>${esc(t('irc.hot'))}</span>${hotCount ? `<b>${hotCount > 999 ? Math.round(hotCount / 1000) + 'k' : hotCount}</b>` : ''}</div>`;
    html += `<div class="irc-sec">${esc(t('irc.networks'))}</div>`;
    for (const cfgNet of allNetworks()) {
      const n = IRC.nets[cfgNet.id];
      const st = n ? n.status : 'disconnected';
      const active = pane.irc.view.net === cfgNet.id;
      if (!n || st === 'disconnected') { html += `<div class="irc-net${active ? ' active' : ''}" data-net="${cfgNet.id}"><i class="st ${st}"></i><span>${esc(cfgNet.name)}</span></div>`; continue; }
      html += `<div class="irc-net open${active && !pane.irc.view.buf ? ' active' : ''}" data-net="${cfgNet.id}"><i class="st ${st}"></i><span>${esc(cfgNet.name)}</span><button class="mini" data-act="disc" title="${esc(t('irc.disconnect'))}">${icon('power')}</button></div>`;
      for (const b of n.bufs.values()) {
        if (b.key !== STATUS && !b.joined && !b.query) continue;
        const sel = active && pane.irc.view.buf === b.key;
        const r = b.key !== STATUS ? rate(b) : 0;
        html += `<div class="irc-buf${sel ? ' active' : ''}${b.mention ? ' mention' : ''}" data-net="${cfgNet.id}" data-buf="${esc(b.key)}" title="${r ? esc(t('irc.activity', { r: rateLabel(r) })) : ''}">${b.key === STATUS ? icon('server') : b.query ? icon('users') : icon('hash')}<span>${esc(b.key === STATUS ? t('irc.server') : b.name.replace(/^#/, ''))}</span>${r ? `<small class="rate${r >= 5 ? ' hot' : ''}">${rateLabel(r)}</small>` : ''}${b.unread ? `<b>${b.unread > 99 ? '99+' : b.unread}</b>` : ''}</div>`;
      }
    }
    html += `<div class="irc-sec">${esc(t('irc.favorites'))}</div>`;
    if (!favs.length) html += `<div class="irc-empty">${esc(t('irc.noFavorites'))}</div>`;
    for (const f of favs) html += `<div class="irc-fav" data-net="${f.net}" data-chan="${esc(f.chan)}">${icon('starFill')}<span>${esc(f.chan)}</span><small>${esc((allNetworks().find(n => n.id === f.net) || {}).name || f.net)}</small></div>`;
    side.innerHTML = html;
  }

  function currentBuf(pane) { const v = pane.irc.view; return v.net && v.net !== HOT && v.buf ? IRC.nets[v.net]?.bufs.get(v.buf) : null; }
  const isFav = (netId, chan) => (ircCfg().favorites || []).some(f => f.net === netId && lc(f.chan) === lc(chan));
  function toggleFav(netId, chan) {
    const favs = ircCfg().favorites || [];
    saveIrc({ favorites: isFav(netId, chan) ? favs.filter(f => !(f.net === netId && lc(f.chan) === lc(chan))) : [...favs, { net: netId, chan }] });
    renderAll();
  }

  function renderHead(pane) {
    const head = pane.irc.head, v = pane.irc.view, b = currentBuf(pane);
    if (!v.net) { head.innerHTML = `${icon('globe')}<b>${esc(t('irc.title'))}</b><span class="topic">${esc(t('irc.pickNetwork'))}</span>`; return; }
    if (v.net === HOT) {
      const nets = Object.values(IRC.nets).filter(n => n.status === 'connected');
      const total = nets.reduce((a, n) => a + n.list.length, 0);
      head.innerHTML = `${icon('flame')}<b>${esc(t('irc.hot'))}</b><span class="topic">${esc(nets.length ? t('irc.hotCount', { n: total, nets: nets.length }) : t('irc.hotSub'))}</span>` +
        (nets.length ? `<button class="mini" data-act="refreshAll" title="${esc(t('irc.refreshAll'))}">${icon('reload')}</button>` : '');
      return;
    }
    const n = net(v.net);
    if (!b) {
      head.innerHTML = `${icon('globe')}<b>${esc(n.cfg.name)}</b><span class="topic">${esc(n.status === 'connected' ? t('irc.channelsCount', { n: n.list.length }) : t('irc.st.' + n.status))}</span>` +
        (n.status === 'connected' ? `<button class="mini" data-act="refresh" title="${esc(t('irc.refresh'))}">${icon('reload')}</button>` : '');
      return;
    }
    head.innerHTML = `${b.key === STATUS ? icon('server') : b.query ? icon('users') : icon('hash')}<b>${esc(b.key === STATUS ? n.cfg.name : b.name)}</b><span class="topic" title="${esc(b.topic)}">${linkify(b.topic || '')}</span>` +
      (b.key !== STATUS && !b.query ? `<button class="mini${isFav(v.net, b.name) ? ' on' : ''}" data-act="fav" title="${esc(t('irc.favorite'))}">${icon(isFav(v.net, b.name) ? 'starFill' : 'star')}</button><button class="mini" data-act="users" title="${esc(t('irc.users'))}">${icon('users')}<small>${b.users.size || ''}</small></button>` : '') +
      `<button class="mini" data-act="browse" title="${esc(t('irc.browse'))}">${icon('globe')}</button>` +
      (b.key !== STATUS ? `<button class="mini" data-act="leave" title="${esc(t('irc.leave'))}">${icon('logout')}</button>` : '');
  }

  function msgHtml(m) {
    const time = `<span class="time">${m.time}</span>`;
    if (m.type === 'msg' || m.type === 'notice') return `<div class="irc-msg${m.mention ? ' mention' : ''}${m.self ? ' self' : ''}${m.type === 'notice' ? ' notice' : ''}">${time}<span class="nick" style="color:${nickColor(m.nick)}">${esc(m.nick)}</span><span class="text">${linkify(m.text)}</span></div>`;
    if (m.type === 'action') return `<div class="irc-msg action${m.mention ? ' mention' : ''}">${time}<span class="text">✱ <b style="color:${nickColor(m.nick)}">${esc(m.nick)}</b> ${linkify(m.text)}</span></div>`;
    return `<div class="irc-msg ${m.type}">${time}<span class="text">${linkify(m.text)}</span></div>`;
  }
  function appendMsg(pane, m) {
    const box = pane.irc.content;
    if (!box.classList.contains('chat')) return;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.insertAdjacentHTML('beforeend', msgHtml(m));
    while (box.childElementCount > 800) box.firstElementChild.remove();
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  function renderMain(pane) {
    const v = pane.irc.view, box = pane.irc.content, b = currentBuf(pane);
    pane.irc.inputBar.classList.toggle('hidden', !b);
    if (b) {
      box.className = 'irc-content chat';
      box.innerHTML = b.msgs.slice(-500).map(msgHtml).join('');
      box.scrollTop = box.scrollHeight;
      pane.irc.input.placeholder = b.key === STATUS ? t('irc.cmdPlaceholder') : t('irc.msgPlaceholder', { target: b.name });
      return;
    }
    box.className = 'irc-content browser';
    const connectedNets = Object.values(IRC.nets).filter(x => x.status === 'connected');

    // "Active channels" view: every channel of the connected networks
    if (v.net === HOT) {
      if (!connectedNets.length) {
        box.innerHTML = `<div class="irc-intro">${icon('flame')}<h3>${esc(t('irc.hot'))}</h3><p>${esc(t('irc.hotEmpty'))}</p>` +
          `<button class="btn big" data-act="connectMain">${icon('globe')}<span>${esc(t('irc.connectMain'))}</span></button></div>` + netCards();
        return;
      }
      const rows = connectedNets.flatMap(x => x.list.map(c => ({ ...c, net: x.id })));
      box.innerHTML = channelTable(pane, rows, true, connectedNets.some(x => x.listing));
      bindTools(pane, null);
      return;
    }

    // no network: cards to connect
    const n = v.net ? IRC.nets[v.net] : null;
    if (!v.net || !n || n.status !== 'connected') {
      box.innerHTML = `<div class="irc-intro">${icon('irc')}<h3>${esc(t('irc.welcome'))}</h3><p>${esc(t('irc.welcomeSub'))}</p></div>` + netCards();
      return;
    }
    // the network's channel list
    box.innerHTML = channelTable(pane, n.list.map(c => ({ ...c, net: n.id })), false, n.listing);
    bindTools(pane, n.id);
  }

  function netCards() {
    return `<div class="irc-nets">${allNetworks().map(c => {
      const st = IRC.nets[c.id]?.status || 'disconnected';
      return `<div class="irc-netcard" data-net="${c.id}"><div class="nc-top"><i class="st ${st}"></i><b>${esc(c.name)}</b>${c.tls ? `<span class="tls">TLS</span>` : ''}</div><small>${esc(c.host)}</small><span class="tag">${esc(t(c.tag || 'irc.tag.custom'))}</span><button class="btn" data-act="connect"${st !== 'disconnected' ? ' disabled' : ''}>${esc(st === 'connected' ? t('irc.st.connected') : st === 'disconnected' ? t('common.connect') : t('irc.st.connecting'))}</button></div>`;
    }).join('')}</div>`;
  }

  // Channel table (one network or all): search, sort, minimum users and activity of channels you're in.
  // IRC doesn't report message counts for channels you aren't in: popularity is measured in users.
  const MIN_USERS = [0, 10, 50, 100, 500];
  function channelTable(pane, rows, multi, loading) {
    const ui = pane.irc, q = lc(ui.filter || ''), min = ui.minUsers || 0;
    const list = rows.filter(c => c.users >= min && (!q || lc(c.chan).includes(q) || lc(c.topic).includes(q)));
    if (ui.sort === 'name') list.sort((a, b) => a.chan.localeCompare(b.chan)); else list.sort((a, b) => b.users - a.users);
    const shown = list.slice(0, 400), max = Math.max(1, ...shown.map(c => c.users));
    const netName = (id) => (allNetworks().find(x => x.id === id) || {}).name || id;
    const tools = `<div class="irc-tools"><input class="irc-filter" placeholder="${esc(t('irc.filter'))}" value="${esc(ui.filter || '')}">` +
      `<select class="irc-sort"><option value="users"${ui.sort !== 'name' ? ' selected' : ''}>${esc(t('irc.sortUsers'))}</option><option value="name"${ui.sort === 'name' ? ' selected' : ''}>${esc(t('irc.sortName'))}</option></select>` +
      `<select class="irc-min">${MIN_USERS.map(m => `<option value="${m}"${m === min ? ' selected' : ''}>${esc(m ? t('irc.minUsers', { n: m }) : t('irc.allSizes'))}</option>`).join('')}</select>` +
      (multi ? '' : `<input class="irc-joininput" placeholder="${esc(t('irc.joinPlaceholder'))}"><button class="btn" data-act="joinTyped">${icon('plus')}<span>${esc(t('irc.join'))}</span></button>`) + `</div>`;
    const row = (c) => {
      const b = IRC.nets[c.net]?.bufs.get(lc(c.chan)), joined = b && b.joined, r = joined ? rate(b) : 0, fav = isFav(c.net, c.chan);
      return `<div class="irc-row${multi ? ' multi' : ''}" data-net="${c.net}" data-chan="${esc(c.chan)}">` +
        `<button class="mini star${fav ? ' on' : ''}" data-act="favrow">${icon(fav ? 'starFill' : 'star')}</button><b>${esc(c.chan)}</b>` +
        (multi ? `<span class="netb">${esc(netName(c.net))}</span>` : '') +
        `<span class="users">${icon('users')}${c.users}<i class="heat" style="--v:${Math.max(4, c.users / max * 100)}%"></i></span>` +
        `<span class="topic">${r ? `<em class="rate${r >= 5 ? ' hot' : ''}">${icon('flame')}${rateLabel(r)}</em> ` : ''}${linkify(c.topic)}</span>` +
        `<button class="btn${joined ? ' joined' : ''}" data-act="${joined ? 'openrow' : 'joinrow'}">${esc(joined ? t('common.open') : t('irc.join'))}</button></div>`;
    };
    let body = '';
    if (loading && !rows.length) body = `<div class="irc-empty">${esc(t('irc.loadingList'))}</div>`;
    else if (!shown.length) body = `<div class="irc-empty">${esc(t('irc.noResults'))}</div>`;
    else body = `<div class="irc-list">${shown.map(row).join('')}</div>` + (list.length > shown.length ? `<div class="irc-empty">${esc(t('irc.more', { n: list.length - shown.length }))}</div>` : '');
    return tools + body;
  }

  function bindTools(pane, netId) {
    const box = pane.irc.content;
    const f = box.querySelector('.irc-filter');
    f.oninput = () => { pane.irc.filter = f.value; const pos = f.selectionStart; renderMain(pane); const nf = pane.irc.content.querySelector('.irc-filter'); nf.focus(); nf.setSelectionRange(pos, pos); };
    box.querySelector('.irc-sort').onchange = (e) => { pane.irc.sort = e.target.value; renderMain(pane); };
    box.querySelector('.irc-min').onchange = (e) => { pane.irc.minUsers = +e.target.value; renderMain(pane); };
    const ji = box.querySelector('.irc-joininput');
    if (ji) ji.onkeydown = (e) => { if (e.key === 'Enter' && ji.value.trim()) { let c = ji.value.trim(); if (!isChan(c)) c = '#' + c; join(netId, c, pane); ji.value = ''; } };
  }

  function renderUsers(pane) {
    const b = currentBuf(pane), list = pane.irc.users;
    const show = b && b.key !== STATUS && !b.query && pane.irc.showUsers;
    pane.irc.root.classList.toggle('with-users', !!show);
    if (!show) { list.innerHTML = ''; return; }
    const order = { '~': 0, '&': 1, '@': 2, '%': 3, '+': 4, '': 5 };
    const users = [...b.users.entries()].sort((a, c) => (order[a[1]] - order[c[1]]) || a[0].localeCompare(c[0])).slice(0, 1000);
    list.innerHTML = `<div class="irc-sec">${esc(t('irc.usersCount', { n: b.users.size }))}</div>` + users.map(([nick, pre]) => `<div class="irc-user" data-nick="${esc(nick)}"><i>${esc(pre)}</i><span style="color:${nickColor(nick)}">${esc(nick)}</span></div>`).join('');
  }

  // ---------------------------------------------------------------- input commands
  function handleInput(pane, text) {
    const v = pane.irc.view, b = currentBuf(pane);
    if (!v.net || !text.trim()) return;
    const id = v.net;
    if (!text.startsWith('/') || text.startsWith('//')) {
      if (!b || b.key === STATUS) return push(id, STATUS, { type: 'err', text: t('irc.notInChannel') });
      return say(id, b.name, text.replace(/^\/\//, '/'));
    }
    const [cmdRaw, ...rest] = text.slice(1).split(' ');
    const cmd = cmdRaw.toLowerCase(), arg = rest.join(' ');
    switch (cmd) {
      case 'join': case 'j': { const c = rest[0]; if (c) join(id, isChan(c) ? c : '#' + c, pane); break; }
      case 'part': case 'leave': if (b && b.key !== STATUS) { if (b.query) { net(id).bufs.delete(b.key); openBuf(pane, id, STATUS); } else send(id, `PART ${b.name}${arg ? ' :' + arg : ''}`); } break;
      case 'me': if (b && b.key !== STATUS) { send(id, `PRIVMSG ${b.name} :\x01ACTION ${arg}\x01`); push(id, b.name, { type: 'action', nick: net(id).nick, text: arg }); } break;
      case 'msg': case 'query': { const to = rest[0], msg = rest.slice(1).join(' '); if (!to) break; buf(id, to).query = true; if (msg) say(id, to, msg); openBuf(pane, id, lc(to)); break; }
      case 'nick': if (rest[0]) { send(id, `NICK ${rest[0]}`); saveIrc({ nick: rest[0] }); } break;
      case 'topic': if (b) send(id, arg ? `TOPIC ${b.name} :${arg}` : `TOPIC ${b.name}`); break;
      case 'list': requestList(id); pane.irc.filter = arg; openBuf(pane, id, null); break;
      case 'whois': if (rest[0]) { send(id, `WHOIS ${rest[0]}`); openBuf(pane, id, STATUS); } break;
      case 'clear': if (b) { b.msgs = []; renderMain(pane); } break;
      case 'quit': case 'disconnect': disconnect(id); break;
      case 'raw': case 'quote': send(id, arg); break;
      default: send(id, `${cmdRaw.toUpperCase()} ${arg}`.trim());
    }
  }

  // ---------------------------------------------------------------- pane
  App.special.irc = {
    title: (pane) => { const b = currentBuf(pane); return b && b.key !== STATUS ? b.name : pane.irc?.view.net === HOT ? t('irc.hot') : 'IRC'; },
    mount(pane) {
      pane.body.innerHTML = `<div class="irc-root">
        <aside class="irc-side"></aside>
        <section class="irc-main"><header class="irc-head"></header><div class="irc-content"></div>
          <footer class="irc-inputbar hidden"><input class="irc-input" spellcheck="true"><button class="mini send">${icon('send')}</button></footer></section>
        <aside class="irc-users"></aside></div>`;
      const q = (s) => pane.body.querySelector(s);
      pane.irc = { root: q('.irc-root'), side: q('.irc-side'), head: q('.irc-head'), content: q('.irc-content'), users: q('.irc-users'), inputBar: q('.irc-inputbar'), input: q('.irc-input'), view: { net: null, buf: null }, filter: '', showUsers: true, histIdx: -1, hist: [] };
      pane.focusTarget = pane.irc.input;
      // if networks are already connected, start with active channels
      if (Object.values(IRC.nets).some(n => n.status === 'connected')) pane.irc.view = { net: HOT, buf: null };
      IRC.panes.add(pane);
      const inp = pane.irc.input;
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && inp.value) { const v = inp.value; pane.irc.hist.unshift(v); pane.irc.histIdx = -1; inp.value = ''; handleInput(pane, v); }
        else if (e.key === 'ArrowUp' && pane.irc.hist.length) { pane.irc.histIdx = Math.min(pane.irc.histIdx + 1, pane.irc.hist.length - 1); inp.value = pane.irc.hist[pane.irc.histIdx]; e.preventDefault(); }
        else if (e.key === 'ArrowDown') { pane.irc.histIdx = Math.max(pane.irc.histIdx - 1, -1); inp.value = pane.irc.histIdx >= 0 ? pane.irc.hist[pane.irc.histIdx] : ''; e.preventDefault(); }
        else if (e.key === 'Tab') { // nick completion
          e.preventDefault();
          const b = currentBuf(pane); if (!b) return;
          const word = inp.value.slice(0, inp.selectionStart).split(' ').pop();
          if (!word) return;
          const match = [...b.users.keys()].find(n => lc(n).startsWith(lc(word)));
          if (match) { const before = inp.value.slice(0, inp.selectionStart - word.length); inp.value = before + match + (before ? ' ' : ': ') + inp.value.slice(inp.selectionStart); }
        }
      });
      q('.send').onclick = () => { if (inp.value) { handleInput(pane, inp.value); inp.value = ''; inp.focus(); } };
      pane.body.addEventListener('click', async (e) => {
        const a = e.target.closest('a.irc-link'); if (a) { e.preventDefault(); api.openExternal(a.getAttribute('href')); return; }
        const actEl = e.target.closest('[data-act]'), act = actEl?.dataset.act;
        const v = pane.irc.view;
        if (act === 'disc') { e.stopPropagation(); disconnect(actEl.closest('[data-net]').dataset.net); return; }
        if (act === 'connect') { const id = actEl.closest('[data-net]').dataset.net; if (v.net !== HOT) pane.irc.view = { net: id, buf: null }; await connect(id); return; }
        if (act === 'hot') { pane.irc.view = { net: HOT, buf: null }; renderPane(pane); return; }
        if (act === 'connectMain') {
          // connect the main networks (the nick is asked only the first time)
          for (const id of MAIN_NETS) { if (net(id).status === 'disconnected') await connect(id); if (!ircCfg().nick) return; }
          return;
        }
        if (act === 'refreshAll') { for (const x of Object.values(IRC.nets)) if (x.status === 'connected') requestList(x.id); return; }
        if (act === 'refresh') { requestList(v.net); return; }
        if (act === 'openrow') { const r = actEl.closest('[data-chan]'); openBuf(pane, r.dataset.net, lc(r.dataset.chan)); return; }
        if (act === 'browse') { openBuf(pane, v.net, null); return; }
        if (act === 'leave') { handleInput(pane, '/part'); return; }
        if (act === 'users') { pane.irc.showUsers = !pane.irc.showUsers; renderUsers(pane); return; }
        if (act === 'fav') { const b = currentBuf(pane); if (b) toggleFav(v.net, b.name); return; }
        if (act === 'favrow') { const r = actEl.closest('[data-chan]'); toggleFav(r.dataset.net, r.dataset.chan); return; }
        if (act === 'joinrow') { const r = actEl.closest('[data-chan]'); join(r.dataset.net, r.dataset.chan, pane); return; }
        if (act === 'joinTyped') { const ji = pane.body.querySelector('.irc-joininput'); if (ji && ji.value.trim()) { let c = ji.value.trim(); if (!isChan(c)) c = '#' + c; join(v.net, c, pane); } return; }
        const me = e.target.closest('.irc-me');
        if (me) { const nn = await App.askText(t('irc.chooseNick'), ircCfg().nick || ''); if (nn) { saveIrc({ nick: nn }); for (const n of Object.values(IRC.nets)) if (n.status === 'connected') send(n.id, `NICK ${nn}`); renderAll(); } return; }
        const bufEl = e.target.closest('.irc-buf'); if (bufEl) { openBuf(pane, bufEl.dataset.net, bufEl.dataset.buf); return; }
        const netEl = e.target.closest('.irc-net'); if (netEl) { const id = netEl.dataset.net; openBuf(pane, id, null); return; }
        const fav = e.target.closest('.irc-fav'); if (fav) { const id = fav.dataset.net, chan = fav.dataset.chan; const b = IRC.nets[id]?.bufs.get(lc(chan)); if (b && b.joined) openBuf(pane, id, b.key); else { pane.irc.view = { net: id, buf: null }; join(id, chan, pane); renderPane(pane); } return; }
      });
      pane.body.addEventListener('dblclick', (e) => { const u = e.target.closest('.irc-user'); if (u) handleInput(pane, `/query ${u.dataset.nick}`); });
      renderPane(pane);
    },
    relabel(pane) { renderPane(pane); },
    unmount(pane) { IRC.panes.delete(pane); },
    resize() {}
  };
})();
