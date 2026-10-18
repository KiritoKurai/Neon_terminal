// Floating notification window (styled with the active skin)
const api = window.neon;
const stack = document.getElementById('stack');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const KINDS = {
  stop: { icon: 'claude', title: 'Claude ha acabat' },
  question: { icon: 'question', title: 'Claude et fa una pregunta' },
  permission: { icon: 'shield', title: 'Claude necessita permís' },
  waiting: { icon: 'hourglass', title: 'Claude t\'espera' },
  info: { icon: 'logo', title: 'Neon Terminal' }
};

let audioCtx;
function chime(kind) {
  try {
    audioCtx = audioCtx || new AudioContext();
    const notes = kind === 'question' || kind === 'permission' ? [660, 880, 990] : [880, 1320];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * 0.09;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.connect(g).connect(audioCtx.destination);
      o.start(t); o.stop(t + 0.4);
    });
  } catch {}
}

function applyStyle(style) {
  if (!style) return;
  const root = document.documentElement.style;
  for (const k of ['accent', 'accent2', 'bg', 'surface', 'text', 'muted']) if (style[k]) root.setProperty('--' + k, style[k]);
  if (style.radius != null) root.setProperty('--radius', style.radius + 'px');
  if (style.font) root.setProperty('--ui-font', style.font);
  document.body.classList.toggle('top', style.position && style.position.startsWith('top'));
}

function reportHeight() {
  requestAnimationFrame(() => api.notifyResize(Math.ceil(stack.getBoundingClientRect().height)));
}

function dismiss(card) {
  if (card.dataset.gone) return;
  card.dataset.gone = '1';
  card.classList.add('out');
  setTimeout(() => { card.remove(); reportHeight(); if (!stack.children.length) api.notifyEmpty(); }, 240);
}

api.onNotify((n) => {
  applyStyle(n.style);
  const k = KINDS[n.kind] || KINDS.info;
  const card = document.createElement('div');
  card.className = 'card ' + n.kind;
  card.dataset.pty = n.ptyId;
  card.innerHTML = `
    <button class="close" title="${esc(n.dismiss || '')}">${icon('close')}</button>
    <div class="icon">${icon(k.icon)}</div>
    <div class="body">
      <div class="title">${esc(n.title || k.title)} <small>${esc(n.where || '')}</small></div>
      <div class="msg">${esc(n.message || '')}</div>
      <div class="actions"><button class="open">${esc(n.button || 'OK')}</button></div>
    </div>
    <div class="bar"></div>`;
  const dur = (n.style && n.style.duration) || 8;
  const sticky = n.kind === 'question' || n.kind === 'permission';
  const bar = card.querySelector('.bar');
  if (!sticky) bar.style.animation = `shrink ${dur}s linear forwards`; else bar.style.width = '100%';
  card.querySelector('.close').onclick = (e) => { e.stopPropagation(); dismiss(card); };
  card.onclick = () => { api.notifyClick(n.ptyId); dismiss(card); };
  let timer = sticky ? null : setTimeout(() => dismiss(card), dur * 1000);
  card.onmouseenter = () => { clearTimeout(timer); bar.style.animationPlayState = 'paused'; };
  card.onmouseleave = () => { if (!sticky) { bar.style.animationPlayState = 'running'; timer = setTimeout(() => dismiss(card), 2500); } };
  // at most 4 cards
  while (stack.children.length >= 4) stack.firstElementChild.remove();
  stack.appendChild(card);
  if (n.style && n.style.sound) chime(n.kind);
  reportHeight();
});

api.onNotifyClear((ptyId) => { for (const c of [...stack.children]) if (c.dataset.pty == ptyId) dismiss(c); });
