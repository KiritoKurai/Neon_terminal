// Icon proposals (SVG 256×256). render-icons.js converts them to PNG/ICO.
module.exports = {
  A: {
    name: 'Espurna Claude',
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a1d17"/><stop offset="1" stop-color="#120d0b"/></linearGradient>
    <linearGradient id="ac" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb38a"/><stop offset="1" stop-color="#d9603b"/></linearGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect x="12" y="12" width="232" height="232" rx="56" fill="url(#bg)"/>
  <rect x="13.5" y="13.5" width="229" height="229" rx="54.5" fill="none" stroke="#d97757" stroke-opacity=".45" stroke-width="3"/>
  <g stroke="url(#ac)" stroke-width="20" stroke-linecap="round">
    <g filter="url(#gl)" opacity=".8"><path d="M128 52v42M128 162v42M52 128h42M162 128h42M74 74l30 30M152 152l30 30M74 182l30-30M152 104l30-30"/></g>
    <path d="M128 52v42M128 162v42M52 128h42M162 128h42M74 74l30 30M152 152l30 30M74 182l30-30M152 104l30-30"/>
  </g>
</svg>`
  },
  B: {
    name: 'Hexàgon neó',
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="ac" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00f0ff"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>
    <radialGradient id="bg" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#1c1236"/><stop offset="1" stop-color="#07040f"/></radialGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <path d="M128 10 230 69v118l-102 59L26 187V69z" fill="url(#bg)"/>
  <g fill="none" stroke="url(#ac)" stroke-linecap="round" stroke-linejoin="round">
    <path d="M128 22 220 75v106l-92 53-92-53V75z" stroke-width="8" filter="url(#gl)" opacity=".9"/>
    <path d="M128 22 220 75v106l-92 53-92-53V75z" stroke-width="7"/>
    <g stroke-width="18" filter="url(#gl)"><path d="M84 98l34 30-34 30M134 160h40"/></g>
    <g stroke-width="15"><path d="M84 98l34 30-34 30M134 160h40"/></g>
  </g>
</svg>`
  },
  C: {
    name: 'Holo Windows 11',
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b2ff7"/><stop offset=".55" stop-color="#2f6bff"/><stop offset="1" stop-color="#00d4ff"/></linearGradient>
    <linearGradient id="hi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#14004a" flood-opacity=".45"/></filter>
  </defs>
  <rect x="16" y="16" width="224" height="224" rx="58" fill="url(#bg)"/>
  <rect x="16" y="16" width="224" height="224" rx="58" fill="url(#hi)"/>
  <g fill="none" stroke="#fff" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" filter="url(#sh)">
    <path d="M70 88l46 40-46 40M134 172h54"/>
  </g>
</svg>`
  },
  D: {
    name: 'Finestra de vidre',
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e2433"/><stop offset="1" stop-color="#0b0e16"/></linearGradient>
    <linearGradient id="ac" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5ef2c2"/><stop offset="1" stop-color="#3fa9ff"/></linearGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect x="14" y="26" width="228" height="204" rx="34" fill="url(#bg)" stroke="#3b4660" stroke-width="3"/>
  <path d="M14 78h228" stroke="#3b4660" stroke-width="3"/>
  <circle cx="50" cy="52" r="9" fill="#ff5f57"/><circle cx="78" cy="52" r="9" fill="#febc2e"/><circle cx="106" cy="52" r="9" fill="#28c840"/>
  <g fill="none" stroke="url(#ac)" stroke-linecap="round" stroke-linejoin="round">
    <path d="M58 118l32 28-32 28M108 180h56" stroke-width="18" filter="url(#gl)" opacity=".8"/>
    <path d="M58 118l32 28-32 28M108 180h56" stroke-width="15"/>
  </g>
  <rect x="176" y="168" width="8" height="24" rx="3" fill="#5ef2c2"/>
</svg>`
  },
  E: {
    name: 'N minimalista',
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <linearGradient id="ac" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff2bd6"/><stop offset="1" stop-color="#ffb347"/></linearGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <rect x="12" y="12" width="232" height="232" rx="60" fill="#0d0a14"/>
  <g fill="none" stroke="url(#ac)" stroke-linecap="round" stroke-linejoin="round">
    <path d="M78 184V72l100 112V72" stroke-width="26" filter="url(#gl)" opacity=".85"/>
    <path d="M78 184V72l100 112V72" stroke-width="20"/>
    <path d="M78 184V72l100 112V72" stroke="#fff" stroke-opacity=".55" stroke-width="5"/>
  </g>
</svg>`
  },
  F: {
    name: 'Orbe xat',
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="orb" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#3a2a5e"/><stop offset=".7" stop-color="#140c26"/><stop offset="1" stop-color="#0a0614"/></radialGradient>
    <linearGradient id="ac" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7af7ff"/><stop offset="1" stop-color="#b88cff"/></linearGradient>
    <filter id="gl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <path d="M128 20c60 0 108 44 108 100s-48 100-108 100c-14 0-27-2-39-6l-49 22 12-42C29 176 20 149 20 120 20 64 68 20 128 20z" fill="url(#orb)"/>
  <path d="M128 20c60 0 108 44 108 100s-48 100-108 100c-14 0-27-2-39-6l-49 22 12-42C29 176 20 149 20 120 20 64 68 20 128 20z" fill="none" stroke="url(#ac)" stroke-width="6"/>
  <g fill="none" stroke="url(#ac)" stroke-linecap="round" stroke-linejoin="round">
    <path d="M78 90l32 30-32 30M126 152h46" stroke-width="18" filter="url(#gl)"/>
    <path d="M78 90l32 30-32 30M126 152h46" stroke-width="14"/>
  </g>
</svg>`
  }
};
