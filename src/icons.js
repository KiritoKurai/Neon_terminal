// Neon Terminal line icons (24×24, stroke). Profile icons use the accent gradient.
(function () {
  const P = {
    // brand
    logo: '<path d="M12 2.3l8.4 4.85v9.7L12 21.7l-8.4-4.85v-9.7z"/><path d="M8.6 9.3l2.9 2.7-2.9 2.7"/><path d="M12.8 14.9h3"/>',
    // profiles
    claude: '<path d="M12 3v5.2M12 15.8V21M3 12h5.2M15.8 12H21M5.6 5.6l3.7 3.7M14.7 14.7l3.7 3.7M5.6 18.4l3.7-3.7M14.7 9.3l3.7-3.7"/>',
    powershell: '<path d="M7 4h14l-3.2 16H3.8z"/><path d="M8.6 8.6l3.8 3.2-4.9 3.4"/><path d="M12.6 15.4h3.6"/>',
    pwsh: '<path d="M7 4h14l-3.2 16H3.8z"/><path d="M8.6 8.6l3.8 3.2-4.9 3.4"/><path d="M12.6 15.4h3.6"/><path d="M18.6 6.8h.01"/>',
    cmd: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 8.2h18"/><path d="M7 11.5l2.6 2.1L7 15.7"/><path d="M12 15.7h4.5"/>',
    git: '<circle cx="6.5" cy="5.5" r="2"/><circle cx="6.5" cy="18.5" r="2"/><circle cx="17.5" cy="8.5" r="2"/><path d="M6.5 7.5v9"/><path d="M17.5 10.5c0 3.6-3 4.4-6 4.6-2.3.2-4 .9-5 1.9"/>',
    linux: '<path d="M12 3c-2.4 0-3.8 1.9-3.8 4.3 0 1.9-1.4 3.3-2.4 5.2S4.3 16.7 5.2 18.6C6.1 20.3 8.6 21 12 21s5.9-.7 6.8-2.4c.9-1.9-.6-4.2-1.6-6.1s-2.4-3.3-2.4-5.2C14.8 4.9 14.4 3 12 3z"/><path d="M10.4 7.4h.01M13.6 7.4h.01"/><path d="M10.8 9.8 12 10.7l1.2-.9"/><path d="M9.5 14.5c.6 1 1.5 1.5 2.5 1.5s1.9-.5 2.5-1.5"/>',
    python: '<path d="M11.8 3C8.3 3 8.5 4.6 8.5 4.6V7h3.6v.8H7S4 7.5 4 11.8c0 4.3 2.7 4.2 2.7 4.2h1.6v-2.2s-.1-2.7 2.6-2.7h3.6s2.5 0 2.5-2.5V5.6S17.4 3 11.8 3z"/><path d="M12.2 21c3.5 0 3.3-1.6 3.3-1.6V17h-3.6v-.8H17s3 .3 3-4c0-4.3-2.7-4.2-2.7-4.2"/><path d="M10.2 5.2h.01M13.8 18.8h.01"/>',
    node: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M12 7.6l3.8 2.2v4.4L12 16.4l-3.8-2.2V9.8z"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01M11 7.5h6M11 16.5h6"/>',
    star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.7l-5.3 2.9 1.1-6-4.4-4.1 6-.8z"/>',
    // window controls
    winMin: '<path d="M5.5 12.5h13"/>',
    winMax: '<rect x="5.5" y="5.5" width="13" height="13" rx="3"/>',
    winRestore: '<rect x="5" y="8.5" width="10.5" height="10.5" rx="2.5"/><path d="M8.5 5.5h7.5a3 3 0 0 1 3 3V16"/>',
    winClose: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    // interface
    plus:'<path d="M12 5v14M5 12h14"/>',
    chevronDown: '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
    pin: '<path d="M9 3.5h6l-.9 5.6 3.9 3V14H6v-1.9l3.9-3z"/><path d="M12 14v6.5"/>',
    command: '<path d="M9 6.5a2.5 2.5 0 1 0-2.5 2.5h11A2.5 2.5 0 1 0 15 6.5v11a2.5 2.5 0 1 0 2.5-2.5h-11A2.5 2.5 0 1 0 9 17.5z"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    skins: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.9-.8 1.9-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8h2.2A4.1 4.1 0 0 0 21 10.9C21 6.5 17 3 12 3z"/><path d="M7.5 11.5h.01M9.8 7.3h.01M14.6 7.3h.01"/>',
    droplet: '<path d="M12 3s6.2 6.6 6.2 11.2a6.2 6.2 0 0 1-12.4 0C5.8 9.6 12 3 12 3z"/><path d="M9.1 14.6a2.9 2.9 0 0 0 2.9 2.9"/>',
    layers: '<path d="M12 3.5l9 4.8-9 4.8-9-4.8z"/><path d="M3 12.5l9 4.8 9-4.8"/><path d="M3 16.5l9 4.8 9-4.8" opacity=".5"/>',
    type: '<path d="M4 7.5V5h11v2.5M9.5 5v14M7 19h5"/><path d="M14 13h7M17.5 13v6"/>',
    window: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 9h18"/><path d="M6.3 6.5h.01M8.8 6.5h.01M11.3 6.5h.01"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M7.5 14h9"/>',
    code: '<path d="M8 7.5 3.5 12 8 16.5M16 7.5l4.5 4.5-4.5 4.5M13.6 4.5l-3.2 15"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    up: '<path d="M6.5 14.5 12 9l5.5 5.5"/>',
    down: '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
    splitRight: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 4v16"/>',
    splitDown: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 12h18"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.7"/><path d="M12 16.8h.01"/>',
    shield: '<path d="M12 3l7.5 3v5.8c0 4.4-3.2 8-7.5 9.2-4.3-1.2-7.5-4.8-7.5-9.2V6z"/><path d="M12 8.2v4.6M12 15.8h.01"/>',
    hourglass: '<path d="M7 3.5h10M7 20.5h10"/><path d="M8 3.5c0 4.6 8 4.4 8 8.5s-8 3.9-8 8.5M16 3.5c0 4.6-8 4.4-8 8.5s8 3.9 8 8.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 15.5l-5-5-9.5 9.5"/>',
    upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4.5V11h-6.5"/>',
    sparkle: '<path d="M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5z"/><path d="M18.5 15.5c.3 1.8.8 2.3 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.2 2.2-.7 2.5-2.5z"/>',
    folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 9.5h5v5h-5zM9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3"/>',
    memory: '<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M7 7v10M11 7v10M15 7v10M6 20v-3M10 20v-3M14 20v-3M18 20v-3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    play: '<path d="M8 5.5v13l10-6.5z"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9.5l3 2.5-3 2.5M12 15h5"/>',
    irc: '<path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-9l-4.5 3.5V17.5H4A1.5 1.5 0 0 1 2.5 16V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M10 8.8l-1 6M14 8.8l-1 6M8 10.6h7.2M7.6 13.2h7.2"/>',
    hash: '<path d="M10 4 8 20M16 4l-2 16M5 9h15M4 15h15"/>',
    send: '<path d="M4.5 12 20 4.5l-4.5 15.5-3.5-6.5z"/><path d="M12 13.5 20 4.5"/>',
    users: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.8" cy="9.5" r="2.5"/><path d="M15.5 14.3c2.6-.4 4.6 1.3 5 4.2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
    starFill: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.7l-5.3 2.9 1.1-6-4.4-4.1 6-.8z" fill="currentColor"/>',
    rec: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4" fill="currentColor"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" fill="currentColor"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4h4"/><path d="M12 7.5V12l3 2"/>',
    layout: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M10 4v16M10 11h11"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    activity: '<path d="M3 12h4l2.5-6 4.5 12 2.5-6H21"/>',
    focus: '<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15"/>',
    bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    flame: '<path d="M12 21c-3.9 0-6.5-2.7-6.5-6.2 0-3.6 2.6-5.6 3.8-8.8.4 2 1.6 3.1 2.6 3.6.2-2.7 1.4-5.2 3.3-6.6-.4 3 1.4 4.9 2.6 6.6 1 1.4 1.7 2.9 1.7 5.1 0 3.6-2.6 6.3-6.5 6.3z"/><path d="M12 21c-1.6 0-2.8-1.2-2.8-2.8 0-1.8 1.4-2.6 2-4.1.8 1.4 3.6 2.2 3.6 4.3 0 1.5-1.2 2.6-2.8 2.6z"/>',
    file: '<path d="M6.5 3.5h7l4 4v12a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z"/><path d="M13.5 3.5v4h4"/>',
    logout: '<path d="M14.5 4.5h3a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-3"/><path d="M9.5 8 5.5 12l4 4M5.5 12h10"/>',
    power: '<path d="M12 3.5v8"/><path d="M7 6.5a7 7 0 1 0 10 0"/>'
  };

  const GRADIENT_ICONS = new Set(['logo', 'claude', 'powershell', 'pwsh', 'cmd', 'git', 'linux', 'python', 'node', 'server', 'star', 'terminal', 'irc', 'cpu']);

  // icon('claude') → SVG. Unknown names render as text (allows emojis in custom profiles).
  window.icon = function (name, cls = '') {
    const p = P[name];
    if (!p) return name ? `<span class="ic ic-text ${cls}">${String(name).replace(/[<>&"]/g, '')}</span>` : '';
    const grad = GRADIENT_ICONS.has(name);
    return `<svg class="ic ic-${name} ${grad ? 'ic-grad' : ''} ${cls}" viewBox="0 0 24 24" fill="none" stroke="${grad ? 'url(#neon-grad)' : 'currentColor'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  };
  window.icon.names = Object.keys(P);

  function init() {
    if (!document.getElementById('neon-icon-defs')) {
      const defs = document.createElement('div');
      defs.id = 'neon-icon-defs';
      defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      defs.innerHTML = '<svg width="0" height="0"><defs><linearGradient id="neon-grad" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--accent2)"/></linearGradient></defs></svg>';
      document.body.prepend(defs);
    }
    document.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = window.icon(el.dataset.icon); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
