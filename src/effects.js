// Animated backgrounds (canvas). createFX(canvas, { fps, maxDpr }) → { set(cfg), destroy() }
// The main window uses window.NeonFX; the settings panel creates thumbnails with createFX.
(function () {
  // gallery order (names are translated with i18n: fx.<id>)
  const IDS = ['none', 'grid', 'sunset', 'city', 'particles', 'neural', 'matrix', 'stars', 'cosmos', 'galaxy', 'meteors', 'aurora', 'waves', 'ripples',
    'hex', 'circuit', 'topo', 'rain', 'snow', 'sakura', 'embers', 'fireflies', 'bokeh', 'lavalamp', 'plasma', 'tunnel', 'orbits', 'radar', 'dna',
    'equalizer', 'lightning', 'glitch', 'scan'];

  function rgb(hex) {
    const h = String(hex || '#888888').replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16) || 0;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function rgba(hex, a) { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`; }
  function mix(h1, h2, f) { const a = rgb(h1), b = rgb(h2); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * f).toString(16).padStart(2, '0')).join(''); }
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;

  function createFX(canvas, opts = {}) {
    const ctx = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1, raf = 0, t = 0, last = 0, alive = true, frame = 0;
    let cfg = { effect: 'none', color: '#00f0ff', color2: '#ff2bd6', intensity: 0.6, speed: 1 };
    let S = {};
    const fps = opts.fps || 60;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      init();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const sc = () => clamp(Math.min(W, H) / 500, 0.45, 1.4);
    const K = () => cfg.intensity;
    const offscreen = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

    // reusable background stars
    function makeStars(n, yMax = 1) { return Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random() * yMax, r: rnd(0.3, 1.4), ph: rnd(0, TAU), s: rnd(0.5, 2) })); }
    function drawStars(stars, alpha = 1) {
      for (const s of stars) {
        const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.03 * s.s + s.ph))) * alpha * K();
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.beginPath(); ctx.arc(s.x * W, s.y * H, s.r, 0, TAU); ctx.fill();
      }
    }

    // perspective grid (synthwave grid and retro sunset)
    function perspectiveGrid(horizon, alpha = 1) {
      const k = K() * alpha, off = (t * 0.7) % 1;
      ctx.lineWidth = 1;
      for (let i = 0; i < 28; i++) {
        const z = (i + off) / 28;
        const y = horizon + Math.pow(z, 2.4) * (H - horizon) * 1.05;
        if (y > H + 2) continue;
        const a = (0.06 + z * 0.5) * k;
        ctx.strokeStyle = rgba(cfg.color, a * 0.35); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.strokeStyle = rgba(cfg.color, a); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      const cx = W / 2, n = 22;
      for (let i = -n; i <= n; i++) {
        const xb = cx + i * (W / n) * 1.6;
        const g = ctx.createLinearGradient(0, horizon, 0, H);
        g.addColorStop(0, rgba(cfg.color, 0)); g.addColorStop(1, rgba(cfg.color, 0.45 * k));
        ctx.strokeStyle = g;
        ctx.beginPath(); ctx.moveTo(cx + i * 6 * sc(), horizon); ctx.lineTo(xb, H); ctx.stroke();
      }
      // glowing horizon line
      const hg = ctx.createLinearGradient(0, 0, W, 0);
      hg.addColorStop(0, rgba(cfg.color2, 0)); hg.addColorStop(0.5, rgba(cfg.color2, 0.9 * k)); hg.addColorStop(1, rgba(cfg.color2, 0));
      ctx.fillStyle = hg; ctx.fillRect(0, horizon - 1, W, 2);
    }

    // ------------------------------------------------------------ effects
    const FX = {
      grid: {
        init() { S.stars = makeStars(Math.round(70 * sc()), 0.48); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const horizon = H * 0.5;
          drawStars(S.stars, 0.8);
          const g = ctx.createLinearGradient(0, horizon - H * 0.3, 0, horizon);
          g.addColorStop(0, rgba(cfg.color2, 0)); g.addColorStop(1, rgba(cfg.color2, 0.22 * K()));
          ctx.fillStyle = g; ctx.fillRect(0, horizon - H * 0.3, W, H * 0.3);
          perspectiveGrid(horizon);
        }
      },

      sunset: {
        init() {
          S.stars = makeStars(Math.round(60 * sc()), 0.42);
          // two mountain layers (fixed profile)
          S.m = [0, 1].map(layer => { const pts = []; let y = 0.5; for (let i = 0; i <= 24; i++) { y = clamp(y + rnd(-0.35, 0.35), 0.1, 1); pts.push(y); } return pts; });
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), horizon = H * 0.58, R = Math.min(W, H) * 0.24, cx = W / 2;
          // sky
          const sky = ctx.createLinearGradient(0, 0, 0, horizon);
          sky.addColorStop(0, rgba(cfg.color, 0)); sky.addColorStop(0.65, rgba(cfg.color2, 0.10 * k)); sky.addColorStop(1, rgba(cfg.color2, 0.32 * k));
          ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
          drawStars(S.stars, 0.7);
          // sun halo
          const halo = ctx.createRadialGradient(cx, horizon - R * 0.35, R * 0.4, cx, horizon - R * 0.35, R * 2.4);
          halo.addColorStop(0, rgba(cfg.color2, 0.35 * k)); halo.addColorStop(1, rgba(cfg.color2, 0));
          ctx.fillStyle = halo; ctx.fillRect(0, 0, W, horizon);
          // sun with descending stripes
          const sun = offscreen(R * 2 * dpr, R * 2 * dpr), sx = sun.getContext('2d');
          sx.scale(dpr, dpr);
          const sg = sx.createLinearGradient(0, 0, 0, R * 2);
          sg.addColorStop(0, mix(cfg.color2, '#fff7b0', 0.55)); sg.addColorStop(0.55, cfg.color2); sg.addColorStop(1, cfg.color);
          sx.fillStyle = sg; sx.beginPath(); sx.arc(R, R, R, 0, TAU); sx.fill();
          sx.globalCompositeOperation = 'destination-out';
          const off = (t * 0.25) % 16;
          for (let y = R * 0.9 + off - 16; y < R * 2; y += 16) { const h = clamp((y - R * 0.9) / (R * 1.1), 0, 1) * 9 + 1; sx.fillRect(0, y, R * 2, h); }
          ctx.globalAlpha = 0.95 * k + 0.05;
          ctx.drawImage(sun, cx - R, horizon - R * 1.35, R * 2, R * 2);
          ctx.globalAlpha = 1;
          // mountains (two layers with a neon edge)
          S.m.forEach((pts, layer) => {
            const base = horizon + 2, amp = (layer ? 0.09 : 0.15) * H, shift = (t * (layer ? 0.05 : 0.02)) % (W / 24);
            ctx.beginPath(); ctx.moveTo(-W / 24, base);
            pts.forEach((p, i) => ctx.lineTo(i * W / 23 - shift, base - p * amp));
            ctx.lineTo(W + W / 24, base); ctx.closePath();
            ctx.fillStyle = layer ? 'rgba(6,4,14,0.92)' : 'rgba(12,6,24,0.75)'; ctx.fill();
            ctx.strokeStyle = rgba(layer ? cfg.color : cfg.color2, (layer ? 0.75 : 0.45) * k); ctx.lineWidth = 1.2; ctx.stroke();
          });
          // ground with the sun's reflection
          const fl = ctx.createLinearGradient(0, horizon, 0, H);
          fl.addColorStop(0, rgba(cfg.color2, 0.2 * k)); fl.addColorStop(0.35, 'rgba(0,0,0,0)');
          ctx.fillStyle = fl; ctx.fillRect(0, horizon, W, H - horizon);
          perspectiveGrid(horizon + 2, 0.9);
        }
      },

      city: {
        init() {
          // three building layers painted once
          S.layers = [0.55, 0.75, 1].map((depth, li) => {
            const w = W * 2, c = offscreen(w * dpr, H * dpr), x = c.getContext('2d');
            x.scale(dpr, dpr);
            let px = 0;
            const lights = [];
            while (px < w) {
              const bw = rnd(28, 80) * depth * sc(), bh = rnd(0.18, 0.55) * H * depth + (li === 2 ? 30 : 0);
              const top = H - bh;
              x.fillStyle = li === 2 ? '#05030a' : li === 1 ? '#0b0718' : '#120c24';
              x.fillRect(px, top, bw - 2, bh);
              if (Math.random() < 0.3) { x.fillRect(px + bw * 0.4, top - 18 * depth, 2, 18 * depth); lights.push({ x: px + bw * 0.4 + 1, y: top - 18 * depth, ph: rnd(0, TAU) }); }
              for (let wy = top + 8; wy < H - 6; wy += 9 * depth + 4) for (let wx = px + 5; wx < px + bw - 7; wx += 7 * depth + 3) {
                if (Math.random() < 0.28) { x.fillStyle = Math.random() < 0.7 ? rgba(cfg.color2, 0.55 + li * 0.15) : rgba(cfg.color, 0.6); x.fillRect(wx, wy, 3 * depth + 1, 3 * depth + 1); }
              }
              if (li === 2 && Math.random() < 0.18) { x.fillStyle = rgba(Math.random() < .5 ? cfg.color : cfg.color2, 0.85); x.fillRect(px + 4, top + 10, bw - 12, 3); }
              px += bw;
            }
            return { c, depth, lights, w };
          });
          S.cars = Array.from({ length: 7 }, () => ({ x: rnd(0, W), y: rnd(0.15, 0.55) * H, v: rnd(0.6, 2) * (Math.random() < .5 ? 1 : -1), c: Math.random() < .5 }));
          S.stars = makeStars(Math.round(50 * sc()), 0.5);
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          const sky = ctx.createLinearGradient(0, 0, 0, H);
          sky.addColorStop(0, rgba(cfg.color, 0)); sky.addColorStop(1, rgba(cfg.color2, 0.25 * k));
          ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
          drawStars(S.stars, 0.6);
          S.layers.forEach((L, i) => {
            const off = (t * 0.15 * L.depth * (i + 1) * 0.5) % L.w;
            ctx.globalAlpha = 0.55 + 0.45 * k;
            ctx.drawImage(L.c, -off, 0, L.w, H); ctx.drawImage(L.c, L.w - off, 0, L.w, H);
            ctx.globalAlpha = 1;
            for (const lt of L.lights) { const lx = ((lt.x - off) % L.w + L.w) % L.w; if (Math.sin(t * 0.08 + lt.ph) > 0.2) { ctx.fillStyle = rgba('#ff3355', 0.9 * k); ctx.beginPath(); ctx.arc(lx, lt.y, 1.8, 0, TAU); ctx.fill(); } }
            // fog between layers
            const fog = ctx.createLinearGradient(0, H * 0.55, 0, H);
            fog.addColorStop(0, rgba(cfg.color2, 0)); fog.addColorStop(1, rgba(cfg.color2, 0.06 * k));
            ctx.fillStyle = fog; ctx.fillRect(0, H * 0.55, W, H * 0.45);
          });
          for (const c of S.cars) {
            c.x += c.v * cfg.speed; if (c.x > W + 40) c.x = -40; if (c.x < -40) c.x = W + 40;
            const g = ctx.createLinearGradient(c.x - 30 * Math.sign(c.v), 0, c.x, 0);
            g.addColorStop(0, rgba(c.c ? cfg.color : cfg.color2, 0)); g.addColorStop(1, rgba(c.c ? cfg.color : cfg.color2, 0.9 * k));
            ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x - 30 * Math.sign(c.v), c.y); ctx.lineTo(c.x, c.y); ctx.stroke();
          }
        }
      },

      particles: {
        init() {
          const n = Math.round((W * H) / 14000 * (0.4 + K()));
          S.p = Array.from({ length: Math.max(10, n) }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: rnd(-.35, .35), vy: rnd(-.35, .35) }));
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const ps = S.p, k = K(), R = 120 * sc(), sp = cfg.speed;
          for (const p of ps) { p.x += p.vx * sp; p.y += p.vy * sp; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
          for (let i = 0; i < ps.length; i++) {
            for (let j = i + 1; j < ps.length; j++) {
              const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y, d = dx * dx + dy * dy;
              if (d < R * R) { ctx.strokeStyle = rgba(cfg.color, (1 - Math.sqrt(d) / R) * 0.4 * k); ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke(); }
            }
            const c = i % 5 ? cfg.color : cfg.color2;
            ctx.fillStyle = rgba(c, 0.25 * k); ctx.beginPath(); ctx.arc(ps[i].x, ps[i].y, 4, 0, TAU); ctx.fill();
            ctx.fillStyle = rgba(c, 0.9 * k); ctx.beginPath(); ctx.arc(ps[i].x, ps[i].y, 1.6, 0, TAU); ctx.fill();
          }
        }
      },

      neural: {
        init() {
          // randomly scattered neurons (with a minimum distance so they don't pile up) that float slowly
          const count = clamp(Math.round(W * H / 11000 * (0.6 + K() * 0.6)), 18, 110);
          const minD = Math.sqrt(W * H / count) * 0.55, nodes = [];
          for (let tries = 0; nodes.length < count && tries < count * 40; tries++) {
            const x = rnd(10, W - 10), y = rnd(10, H - 10);
            if (nodes.every(n => Math.hypot(n.x - x, n.y - y) > minD)) nodes.push({ x, y, hx: x, hy: y, ph: rnd(0, TAU), sp: rnd(0.4, 1.2), r: rnd(2, 3.6), act: 0, nb: [] });
          }
          // each neuron connects to 2-4 of its nearest neighbours (two-way links)
          const edges = [], has = new Set();
          for (const a of nodes) {
            const near = nodes.filter(b => b !== a).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y));
            const n = 2 + Math.floor(Math.random() * 3);
            for (const b of near.slice(0, n)) {
              const key = nodes.indexOf(a) < nodes.indexOf(b) ? nodes.indexOf(a) + '-' + nodes.indexOf(b) : nodes.indexOf(b) + '-' + nodes.indexOf(a);
              if (has.has(key)) continue;
              has.add(key);
              const e = { a, b, act: 0 };
              edges.push(e); a.nb.push({ n: b, e }); b.nb.push({ n: a, e });
            }
          }
          S.nodes = nodes; S.edges = edges; S.pulses = []; S.reach = minD * 3.2;
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), T = t * 0.004;
          // gentle movement around its home position
          for (const n of S.nodes) {
            n.x = n.hx + Math.sin(T * n.sp + n.ph) * 14 * sc() + Math.sin(T * 0.37 + n.ph * 2) * 8;
            n.y = n.hy + Math.cos(T * n.sp * 0.8 + n.ph) * 12 * sc() + Math.cos(T * 0.29 + n.ph * 3) * 7;
          }
          // links: fainter the longer they are; they light up when a signal passes
          ctx.lineWidth = 1;
          for (const e of S.edges) {
            e.act *= 0.95;
            const len = Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y), fade = clamp(1 - len / S.reach, 0.15, 1);
            ctx.strokeStyle = rgba(e.act > 0.05 ? cfg.color2 : cfg.color, (0.07 + 0.12 * fade + e.act * 0.55) * k);
            ctx.beginPath(); ctx.moveTo(e.a.x, e.a.y); ctx.lineTo(e.b.x, e.b.y); ctx.stroke();
          }
          // spontaneous signals at any neuron
          if (Math.random() < 0.06 * cfg.speed) {
            const src = S.nodes[Math.floor(Math.random() * S.nodes.length)];
            src.act = 1;
            for (const { n, e } of src.nb) if (Math.random() < 0.6) S.pulses.push({ from: src, to: n, e, p: 0, life: 4 + Math.floor(Math.random() * 6) });
          }
          S.pulses = S.pulses.filter(pu => {
            pu.p += (0.012 + Math.random() * 0.01) * cfg.speed;
            if (pu.p >= 1) {
              const n = pu.to;
              pu.e.act = 1;
              // continues to 1-2 random neighbours (never back), until it fades out
              if (pu.life > 0 && n.act < 0.5) {
                n.act = 1;
                const opts = n.nb.filter(x => x.n !== pu.from).sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.3 ? 2 : 1);
                for (const { n: nx, e } of opts) S.pulses.push({ from: n, to: nx, e, p: 0, life: pu.life - 1 });
              }
              return false;
            }
            const x = pu.from.x + (pu.to.x - pu.from.x) * pu.p, y = pu.from.y + (pu.to.y - pu.from.y) * pu.p;
            const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
            g.addColorStop(0, rgba(cfg.color2, 0.95 * k)); g.addColorStop(1, rgba(cfg.color2, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
            return true;
          });
          if (S.pulses.length > 200) S.pulses.splice(0, S.pulses.length - 200);
          for (const n of S.nodes) {
            n.act *= 0.95;
            if (n.act > 0.05) { ctx.fillStyle = rgba(cfg.color2, n.act * 0.22 * k); ctx.beginPath(); ctx.arc(n.x, n.y, 5 + n.act * 11, 0, TAU); ctx.fill(); }
            ctx.fillStyle = rgba(n.act > 0.3 ? cfg.color2 : cfg.color, (0.3 + n.act * 0.7) * k);
            ctx.beginPath(); ctx.arc(n.x, n.y, n.r + n.act * 2, 0, TAU); ctx.fill();
          }
        }
      },

      matrix: {
        init() {
          S.size = Math.round(clamp(W / 40, 9, 16));
          S.cols = Array.from({ length: Math.ceil(W / S.size) }, () => ({ y: Math.random() * -H / S.size, v: rnd(0.5, 1.2) }));
          S.chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホ0123456789ABCDEF<>/{}$#';
          S.acc = 0;
        },
        draw() {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,0.09)'; ctx.fillRect(0, 0, W, H);
          ctx.globalCompositeOperation = 'source-over';
          S.acc += cfg.speed;
          if (S.acc < 2.5) return;
          S.acc = 0;
          const s = S.size;
          ctx.font = `${s - 2}px Consolas, monospace`;
          S.cols.forEach((c, i) => {
            c.y += c.v;
            const ch = S.chars[Math.floor(Math.random() * S.chars.length)];
            ctx.fillStyle = rgba(cfg.color, 0.5 * K() + 0.1);
            ctx.fillText(ch, i * s, (Math.floor(c.y) - 1) * s);
            ctx.fillStyle = `rgba(235,255,240,${0.6 * K() + 0.3})`;
            ctx.fillText(S.chars[Math.floor(Math.random() * S.chars.length)], i * s, Math.floor(c.y) * s);
            if (c.y * s > H && Math.random() > 0.97) { c.y = 0; c.v = rnd(0.5, 1.2); }
          });
        }
      },

      stars: {
        init() { S.s = Array.from({ length: Math.round(240 * (0.3 + K())) }, () => ({ x: (Math.random() - .5) * W, y: (Math.random() - .5) * H, z: Math.random() * W })); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const cx = W / 2, cy = H / 2, sp = (1 + K() * 3) * cfg.speed;
          for (const s of S.s) {
            const pz = s.z; s.z -= sp;
            if (s.z <= 1) { s.z = W; s.x = (Math.random() - .5) * W; s.y = (Math.random() - .5) * H; continue; }
            const x = cx + s.x / s.z * W * 0.5, y = cy + s.y / s.z * H * 0.5, px = cx + s.x / pz * W * 0.5, py = cy + s.y / pz * H * 0.5;
            const a = 1 - s.z / W;
            ctx.strokeStyle = rgba(s.z % 7 < 1 ? cfg.color2 : cfg.color, a * 0.9); ctx.lineWidth = Math.max(0.5, a * 2.4);
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
          }
        }
      },

      cosmos: {
        init() {
          S.layers = [0.2, 0.5, 1].map(d => ({ d, s: Array.from({ length: Math.round(90 * sc() / d * 0.4) }, () => ({ x: Math.random() * W, y: Math.random() * H, r: rnd(0.3, 1.3) * d + 0.2, ph: rnd(0, TAU) })) }));
          S.neb = Array.from({ length: 4 }, (_, i) => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(0.3, 0.6) * Math.max(W, H), c: i % 2, v: rnd(0.05, 0.15) }));
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          ctx.globalCompositeOperation = 'lighter';
          for (const n of S.neb) {
            n.x += n.v * cfg.speed; if (n.x - n.r > W) n.x = -n.r;
            const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
            g.addColorStop(0, rgba(n.c ? cfg.color2 : cfg.color, 0.12 * k)); g.addColorStop(1, rgba(cfg.color, 0));
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
          }
          ctx.globalCompositeOperation = 'source-over';
          for (const L of S.layers) for (const s of L.s) {
            s.x -= L.d * 0.25 * cfg.speed; if (s.x < 0) s.x = W;
            const a = (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.04 + s.ph))) * L.d * k;
            ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
          }
        }
      },

      galaxy: {
        init() {
          const n = Math.round(900 * clamp(sc(), 0.4, 1.2));
          S.p = Array.from({ length: n }, (_, i) => { const arm = i % 2, r = Math.pow(Math.random(), 0.6); return { r, a: arm * Math.PI + r * 5 + rnd(-0.45, 0.45) * (1 - r * 0.6), s: rnd(0.4, 1.6), c: Math.random() < r * 0.8 }; });
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46, rot = t * 0.0015;
          const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.35);
          core.addColorStop(0, rgba(mix(cfg.color2, '#ffffff', 0.5), 0.5 * k)); core.addColorStop(1, rgba(cfg.color2, 0));
          ctx.fillStyle = core; ctx.fillRect(0, 0, W, H);
          for (const p of S.p) {
            const a = p.a + rot / (0.3 + p.r);
            const x = cx + Math.cos(a) * p.r * R, y = cy + Math.sin(a) * p.r * R * 0.62;
            ctx.fillStyle = rgba(p.c ? cfg.color : cfg.color2, (0.9 - p.r * 0.5) * k);
            ctx.fillRect(x, y, p.s, p.s);
          }
        }
      },

      meteors: {
        init() { S.stars = makeStars(Math.round(110 * sc())); S.m = []; },
        draw() {
          ctx.clearRect(0, 0, W, H);
          drawStars(S.stars, 0.8);
          if (Math.random() < 0.025 * cfg.speed * (0.5 + K())) S.m.push({ x: rnd(W * 0.2, W * 1.1), y: rnd(-H * 0.2, H * 0.4), v: rnd(7, 13), l: rnd(80, 200) * sc(), life: 1, c: Math.random() < .5 });
          S.m = S.m.filter(m => {
            m.x -= m.v * cfg.speed; m.y += m.v * 0.55 * cfg.speed; m.life -= 0.012 * cfg.speed;
            const tx = m.x + m.l, ty = m.y - m.l * 0.55;
            const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
            g.addColorStop(0, rgba('#ffffff', m.life)); g.addColorStop(0.15, rgba(m.c ? cfg.color : cfg.color2, 0.8 * m.life)); g.addColorStop(1, rgba(cfg.color, 0));
            ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
            return m.life > 0 && m.x > -m.l && m.y < H + m.l;
          });
        }
      },

      aurora: {
        init() { S.stars = makeStars(Math.round(80 * sc()), 0.7); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          drawStars(S.stars, 0.6);
          ctx.globalCompositeOperation = 'lighter';
          for (let band = 0; band < 3; band++) {
            const base = H * (0.25 + band * 0.12), len = H * (0.32 - band * 0.05);
            const col = band === 1 ? cfg.color2 : cfg.color;
            for (let x = 0; x < W; x += 4) {
              const y = base + Math.sin(x * 0.004 + t * 0.006 + band * 2) * 40 * sc() + Math.sin(x * 0.011 - t * 0.009 + band) * 18 * sc();
              const a = (0.5 + 0.5 * Math.sin(x * 0.02 + t * 0.03 + band * 3)) * 0.13 * k;
              const g = ctx.createLinearGradient(0, y - len, 0, y);
              g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.85, rgba(col, a)); g.addColorStop(1, rgba(mix(col, '#ffffff', 0.4), a * 1.6));
              ctx.fillStyle = g; ctx.fillRect(x, y - len, 4, len);
            }
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      },

      waves: {
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), s = sc();
          for (let l = 0; l < 5; l++) {
            const yBase = H * (0.5 + l * 0.09), amp = (26 - l * 3) * s, col = l % 2 ? cfg.color2 : cfg.color;
            ctx.beginPath(); ctx.moveTo(0, H);
            let first = true, topY = H;
            for (let x = 0; x <= W + 8; x += 8) {
              const y = yBase + Math.sin(x * 0.007 / s + t * 0.012 * (1 + l * 0.3) + l) * amp + Math.sin(x * 0.017 / s - t * 0.016) * amp * 0.4;
              topY = Math.min(topY, y);
              if (first) { ctx.lineTo(0, y); first = false; } else ctx.lineTo(x, y);
            }
            ctx.lineTo(W, H); ctx.closePath();
            const g = ctx.createLinearGradient(0, topY, 0, H);
            g.addColorStop(0, rgba(col, (0.10 + l * 0.03) * k)); g.addColorStop(1, rgba(col, 0.01));
            ctx.fillStyle = g; ctx.fill();
            ctx.strokeStyle = rgba(col, (0.35 + l * 0.08) * k); ctx.lineWidth = 1.4;
            ctx.beginPath();
            for (let x = 0; x <= W + 8; x += 8) {
              const y = yBase + Math.sin(x * 0.007 / s + t * 0.012 * (1 + l * 0.3) + l) * amp + Math.sin(x * 0.017 / s - t * 0.016) * amp * 0.4;
              x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
            }
            ctx.stroke();
          }
        }
      },

      ripples: {
        init() { S.r = []; },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          if (Math.random() < 0.06 * cfg.speed) S.r.push({ x: rnd(0, W), y: rnd(0, H), r: 0, max: rnd(60, 160) * sc(), c: Math.random() < .5 });
          S.r = S.r.filter(o => {
            o.r += 0.9 * cfg.speed;
            const life = 1 - o.r / o.max;
            for (let i = 0; i < 3; i++) {
              const rr = o.r - i * 12; if (rr <= 0) continue;
              ctx.strokeStyle = rgba(o.c ? cfg.color : cfg.color2, life * (0.6 - i * 0.18) * k); ctx.lineWidth = 1.5 - i * 0.4;
              ctx.beginPath(); ctx.ellipse(o.x, o.y, rr, rr * 0.45, 0, 0, TAU); ctx.stroke();
            }
            return life > 0;
          });
        }
      },

      hex: {
        init() {
          const r = S.r = clamp(W / 38, 9, 24), w = Math.sqrt(3) * r, h = 1.5 * r;
          S.c = [];
          for (let row = -1; row * h < H + r; row++) for (let col = -1; col * w < W + w; col++) S.c.push([col * w + (row % 2 ? w / 2 : 0), row * h]);
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), r = S.r - 1.5;
          const fx = W * (0.5 + 0.35 * Math.sin(t * 0.004)), fy = H * (0.5 + 0.35 * Math.cos(t * 0.0053));
          ctx.lineWidth = 1;
          for (const [x, y] of S.c) {
            const d = Math.hypot(x - fx, y - fy);
            const a = Math.pow(0.5 + 0.5 * Math.sin(d * 0.025 / sc() - t * 0.05), 4);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) { const an = Math.PI / 3 * i + Math.PI / 6; ctx[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(an), y + r * Math.sin(an)); }
            ctx.closePath();
            ctx.strokeStyle = rgba(cfg.color, (0.05 + a * 0.45) * k); ctx.stroke();
            if (a > 0.75) { ctx.fillStyle = rgba(cfg.color2, (a - 0.75) * 0.5 * k); ctx.fill(); }
          }
        }
      },

      circuit: {
        init() {
          const g = Math.round(Math.max(10, 22 * sc()));
          const n = Math.max(6, Math.round(W * H / 9000));
          const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
          S.tr = [];
          for (let i = 0; i < n; i++) {
            let x = Math.round(Math.random() * W / g) * g, y = Math.round(Math.random() * H / g) * g, d = Math.floor(Math.random() * 8);
            const pts = [[x, y]];
            for (let s = 0, segs = 3 + Math.floor(Math.random() * 6); s < segs; s++) { const len = (1 + Math.floor(Math.random() * 4)) * g; x += dirs[d][0] * len; y += dirs[d][1] * len; pts.push([x, y]); d = (d + (Math.random() < .5 ? 1 : 7)) % 8; }
            const lens = []; let total = 0;
            for (let s = 1; s < pts.length; s++) { const l = Math.hypot(pts[s][0] - pts[s - 1][0], pts[s][1] - pts[s - 1][1]); lens.push(l); total += l; }
            S.tr.push({ pts, lens, total, p: Math.random(), v: rnd(0.6, 1.6) });
          }
          S.off = offscreen(canvas.width, canvas.height);
          const o = S.off.getContext('2d');
          o.setTransform(dpr, 0, 0, dpr, 0, 0); o.lineWidth = 1.2; o.lineJoin = 'round';
          for (const tr of S.tr) {
            o.strokeStyle = rgba(cfg.color, 0.16 * K()); o.beginPath(); tr.pts.forEach(([x, y], i) => o[i ? 'lineTo' : 'moveTo'](x, y)); o.stroke();
            o.fillStyle = rgba(cfg.color, 0.35 * K());
            for (const [x, y] of [tr.pts[0], tr.pts[tr.pts.length - 1]]) { o.beginPath(); o.arc(x, y, 2.4, 0, TAU); o.fill(); }
          }
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(S.off, 0, 0, W, H);
          for (const tr of S.tr) {
            tr.p = (tr.p + tr.v * cfg.speed / tr.total) % 1.3;
            if (tr.p > 1) continue;
            let dist = tr.p * tr.total, i = 0;
            while (i < tr.lens.length - 1 && dist > tr.lens[i]) { dist -= tr.lens[i]; i++; }
            const f = tr.lens[i] ? dist / tr.lens[i] : 0;
            const x = tr.pts[i][0] + (tr.pts[i + 1][0] - tr.pts[i][0]) * f, y = tr.pts[i][1] + (tr.pts[i + 1][1] - tr.pts[i][1]) * f;
            const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
            g.addColorStop(0, rgba(cfg.color2, 0.9 * K())); g.addColorStop(1, rgba(cfg.color2, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
          }
        }
      },

      topo: {
        init() { S.cell = Math.max(10, Math.round(14 * sc())); S.n = 0; },
        draw() {
          if ((S.n++ % 2)) return;
          ctx.clearRect(0, 0, W, H);
          const c = S.cell, cols = Math.ceil(W / c) + 1, rows = Math.ceil(H / c) + 1, T = t * 0.006, k = K();
          const f = new Float32Array(cols * rows);
          for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
            const x = i * c, y = j * c;
            f[j * cols + i] = Math.sin(x * 0.011 + T) + Math.sin(y * 0.013 - T * 0.8) + Math.sin((x + y) * 0.008 + T * 0.6) + Math.sin(Math.hypot(x - W * 0.6, y - H * 0.4) * 0.012 - T * 1.2);
          }
          const levels = [-2, -1.2, -0.4, 0.4, 1.2, 2];
          levels.forEach((L, li) => {
            ctx.strokeStyle = rgba(li % 2 ? cfg.color2 : cfg.color, (0.18 + li * 0.05) * k); ctx.lineWidth = 1;
            ctx.beginPath();
            for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
              const a = f[j * cols + i], b = f[j * cols + i + 1], cc = f[(j + 1) * cols + i + 1], d = f[(j + 1) * cols + i];
              const idx = (a > L) | (b > L) << 1 | (cc > L) << 2 | (d > L) << 3;
              if (idx === 0 || idx === 15) continue;
              const x = i * c, y = j * c, lerp = (p, q) => (L - p) / (q - p);
              const T_ = [x + c * lerp(a, b), y], R_ = [x + c, y + c * lerp(b, cc)], B_ = [x + c * lerp(d, cc), y + c], L_ = [x, y + c * lerp(a, d)];
              const seg = { 1: [L_, T_], 2: [T_, R_], 3: [L_, R_], 4: [R_, B_], 5: [L_, T_, R_, B_], 6: [T_, B_], 7: [L_, B_], 8: [L_, B_], 9: [T_, B_], 10: [T_, R_, L_, B_], 11: [R_, B_], 12: [L_, R_], 13: [T_, R_], 14: [L_, T_] }[idx];
              for (let s = 0; s < seg.length; s += 2) { ctx.moveTo(seg[s][0], seg[s][1]); ctx.lineTo(seg[s + 1][0], seg[s + 1][1]); }
            }
            ctx.stroke();
          });
        }
      },

      rain: {
        init() { S.d = Array.from({ length: Math.max(24, Math.round(W * H / 5000 * (0.4 + K()))) }, () => this.drop(true)); S.sp = []; },
        drop(any) { const z = rnd(0.3, 1); return { x: rnd(-50, W + 50), y: any ? rnd(-H, H) : rnd(-200, -20), l: rnd(14, 40) * z * sc(), v: rnd(6, 11) * z, z, c: Math.random() < .2 }; },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          for (const d of S.d) {
            d.y += d.v * cfg.speed; d.x -= d.v * 0.12 * cfg.speed;
            if (d.y > H) { if (d.z > 0.7) S.sp.push({ x: d.x, y: H - rnd(2, 20), r: 0, c: d.c }); Object.assign(d, this.drop(false)); }
            const g = ctx.createLinearGradient(d.x, d.y - d.l, d.x, d.y);
            g.addColorStop(0, rgba(d.c ? cfg.color2 : cfg.color, 0)); g.addColorStop(1, rgba(d.c ? cfg.color2 : cfg.color, 0.75 * k * d.z));
            ctx.strokeStyle = g; ctx.lineWidth = d.z * 1.4;
            ctx.beginPath(); ctx.moveTo(d.x + d.l * 0.12, d.y - d.l); ctx.lineTo(d.x, d.y); ctx.stroke();
          }
          S.sp = S.sp.filter(s => { s.r += 0.6; const a = 1 - s.r / 10; ctx.strokeStyle = rgba(s.c ? cfg.color2 : cfg.color, a * 0.6 * k); ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r, s.r * 0.3, 0, 0, TAU); ctx.stroke(); return a > 0; });
        }
      },

      snow: {
        init() { S.f = Array.from({ length: Math.max(40, Math.round(W * H / 4500 * (0.4 + K()))) }, () => { const z = rnd(0.2, 1); return { x: rnd(0, W), y: rnd(0, H), z, r: 0.6 + z * 2.6, v: 0.25 + z * 0.9, ph: rnd(0, TAU), c: Math.random() < .2 }; }); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          for (const f of S.f) {
            f.y += f.v * cfg.speed; f.x += Math.sin(t * 0.01 + f.ph) * 0.4 * f.z;
            if (f.y > H + 4) { f.y = -4; f.x = rnd(0, W); }
            if (f.z > 0.75) { const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 3); g.addColorStop(0, rgba(f.c ? cfg.color : '#ffffff', 0.35 * k)); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 3, 0, TAU); ctx.fill(); }
            ctx.fillStyle = f.c ? rgba(cfg.color, (0.4 + f.z * 0.5) * k) : `rgba(255,255,255,${(0.3 + f.z * 0.6) * k})`;
            ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill();
          }
        }
      },

      sakura: {
        init() { S.p = Array.from({ length: Math.max(22, Math.round(W * H / 14000 * (0.5 + K()))) }, () => this.petal(true)); },
        petal(any) { const z = rnd(0.4, 1); return { x: rnd(-40, W + 40), y: any ? rnd(-H, H) : rnd(-60, -10), z, s: rnd(5, 9) * z * sc() + 2, rot: rnd(0, TAU), vr: rnd(-0.03, 0.03), flip: rnd(0, TAU), v: rnd(0.4, 1) * z, sw: rnd(0.5, 1.5), ph: rnd(0, TAU), c: Math.random() }; },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          for (const p of S.p) {
            p.y += p.v * cfg.speed; p.x += (Math.sin(t * 0.012 * p.sw + p.ph) * 0.8 + 0.4) * p.z * cfg.speed; p.rot += p.vr * cfg.speed; p.flip += 0.04 * cfg.speed;
            if (p.y > H + 20 || p.x > W + 40) Object.assign(p, this.petal(false));
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.cos(p.flip)) * 0.8 + 0.2);
            const col = p.c < 0.6 ? mix(cfg.color, '#ffffff', 0.35) : p.c < 0.85 ? cfg.color : cfg.color2;
            const g = ctx.createLinearGradient(0, -p.s, 0, p.s);
            g.addColorStop(0, rgba(mix(col, '#ffffff', 0.5), (0.5 + p.z * 0.4) * k)); g.addColorStop(1, rgba(col, (0.4 + p.z * 0.4) * k));
            ctx.fillStyle = g;
            // petal with a notch at the tip
            const s = p.s;
            ctx.beginPath(); ctx.moveTo(0, s);
            ctx.bezierCurveTo(s * 0.9, s * 0.4, s * 0.7, -s * 0.8, s * 0.18, -s);
            ctx.lineTo(0, -s * 0.72); ctx.lineTo(-s * 0.18, -s);
            ctx.bezierCurveTo(-s * 0.7, -s * 0.8, -s * 0.9, s * 0.4, 0, s);
            ctx.fill();
            ctx.restore();
          }
        }
      },

      embers: {
        init() { S.e = Array.from({ length: Math.max(30, Math.round(W * H / 9000 * (0.5 + K()))) }, () => this.ember(true)); },
        ember(any) { return { x: rnd(0, W), y: any ? rnd(0, H) : H + rnd(5, 40), v: rnd(0.4, 1.4), r: rnd(0.8, 2.6), life: rnd(0.6, 1), ph: rnd(0, TAU), c: Math.random() < .35 }; },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          const base = ctx.createLinearGradient(0, H * 0.6, 0, H);
          base.addColorStop(0, rgba(cfg.color, 0)); base.addColorStop(1, rgba(cfg.color, 0.22 * k));
          ctx.fillStyle = base; ctx.fillRect(0, H * 0.6, W, H * 0.4);
          ctx.globalCompositeOperation = 'lighter';
          for (const e of S.e) {
            e.y -= e.v * cfg.speed; e.x += Math.sin(t * 0.02 + e.ph) * 0.5; e.life -= 0.0025 * cfg.speed;
            if (e.y < -10 || e.life <= 0) Object.assign(e, this.ember(false));
            const fl = (0.6 + 0.4 * Math.sin(t * 0.2 + e.ph)) * e.life * k;
            const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 4);
            g.addColorStop(0, rgba(e.c ? cfg.color2 : mix(cfg.color, '#ffd27a', 0.4), fl)); g.addColorStop(1, rgba(cfg.color, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 4, 0, TAU); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      },

      fireflies: {
        init() { S.f = Array.from({ length: Math.round(18 + 40 * K()) }, () => ({ x: rnd(0, W), y: rnd(0, H), a: rnd(0, TAU), ph: rnd(0, TAU), c: Math.random() < .4 })); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          ctx.globalCompositeOperation = 'lighter';
          for (const f of S.f) {
            f.a += rnd(-0.12, 0.12);
            f.x += Math.cos(f.a) * 0.5 * cfg.speed; f.y += Math.sin(f.a) * 0.5 * cfg.speed;
            if (f.x < 0) f.x = W; if (f.x > W) f.x = 0; if (f.y < 0) f.y = H; if (f.y > H) f.y = 0;
            const al = Math.pow(0.5 + 0.5 * Math.sin(t * 0.04 + f.ph), 2) * K(), r = 9 * sc() + 3;
            const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
            g.addColorStop(0, rgba(f.c ? cfg.color2 : cfg.color, al)); g.addColorStop(1, rgba(cfg.color, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, TAU); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      },

      bokeh: {
        init() { S.o = Array.from({ length: Math.round(10 + 25 * K()) }, () => this.orb(true)); },
        orb(any) { const r = rnd(12, 70) * sc(); return { x: rnd(0, W), y: any ? rnd(0, H) : H + r, r, v: rnd(0.15, 0.6), c: Math.random() < .5, ph: rnd(0, 7) }; },
        draw() {
          ctx.clearRect(0, 0, W, H);
          ctx.globalCompositeOperation = 'lighter';
          for (const o of S.o) {
            o.y -= o.v * cfg.speed; o.x += Math.sin(t * 0.01 + o.ph) * 0.3;
            if (o.y < -o.r) Object.assign(o, this.orb(false));
            const a = (0.12 + 0.08 * Math.sin(t * 0.02 + o.ph)) * K();
            const g = ctx.createRadialGradient(o.x, o.y, o.r * 0.2, o.x, o.y, o.r);
            g.addColorStop(0, rgba(o.c ? cfg.color : cfg.color2, a)); g.addColorStop(0.8, rgba(o.c ? cfg.color : cfg.color2, a * 0.6)); g.addColorStop(1, rgba(cfg.color, 0));
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, TAU); ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
        }
      },

      lavalamp: {
        init() {
          S.w = Math.max(24, Math.ceil(W / 6)); S.h = Math.max(18, Math.ceil(H / 6));
          S.off = offscreen(S.w, S.h); S.octx = S.off.getContext('2d'); S.img = S.octx.createImageData(S.w, S.h);
          S.b = Array.from({ length: 7 }, () => ({ x: rnd(0, S.w), y: rnd(0, S.h), vx: rnd(-0.15, 0.15), vy: rnd(-0.25, 0.25), r: rnd(0.08, 0.16) * Math.min(S.w, S.h) * 1.6 }));
          S.c1 = rgb(cfg.color); S.c2 = rgb(cfg.color2);
        },
        draw() {
          const { w, h, img, b, c1, c2 } = S, d = img.data, k = K();
          for (const o of b) { o.x += o.vx * cfg.speed; o.y += o.vy * cfg.speed; if (o.x < 0 || o.x > w) o.vx *= -1; if (o.y < 0 || o.y > h) o.vy *= -1; }
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            let v = 0;
            for (const o of b) { const dx = x - o.x, dy = y - o.y; v += o.r * o.r / (dx * dx + dy * dy + 1); }
            const i = (y * w + x) * 4;
            if (v > 1) { const f = clamp((v - 1) / 2, 0, 1); d[i] = c1[0] + (c2[0] - c1[0]) * f; d[i + 1] = c1[1] + (c2[1] - c1[1]) * f; d[i + 2] = c1[2] + (c2[2] - c1[2]) * f; d[i + 3] = clamp(60 + (v - 1) * 60, 0, 150) * k; }
            else d[i + 3] = v > 0.75 ? (v - 0.75) * 4 * 40 * k : 0;
          }
          S.octx.putImageData(img, 0, 0);
          ctx.clearRect(0, 0, W, H);
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(S.off, 0, 0, W, H);
        }
      },

      plasma: {
        init() {
          S.w = Math.max(16, Math.ceil(W / 7)); S.h = Math.max(12, Math.ceil(H / 7));
          S.off = offscreen(S.w, S.h); S.octx = S.off.getContext('2d'); S.img = S.octx.createImageData(S.w, S.h);
          S.c1 = rgb(cfg.color); S.c2 = rgb(cfg.color2); S.n = 0;
        },
        draw() {
          if ((S.n++ % 2)) return;
          const { w, h, img, c1, c2 } = S, d = img.data, T = t * 0.02, k = K();
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const dx = x - w / 2, dy = y - h / 2;
            let v = Math.sin(x * 0.09 + T) + Math.sin(y * 0.07 + T * 0.7) + Math.sin((x + y) * 0.05 + T * 1.3) + Math.sin(Math.sqrt(dx * dx + dy * dy) * 0.11 - T);
            v = (v + 4) / 8;
            const i = (y * w + x) * 4;
            d[i] = c1[0] + (c2[0] - c1[0]) * v; d[i + 1] = c1[1] + (c2[1] - c1[1]) * v; d[i + 2] = c1[2] + (c2[2] - c1[2]) * v;
            d[i + 3] = Math.pow(Math.abs(Math.sin(v * Math.PI * 2)), 3) * 110 * k;
          }
          S.octx.putImageData(img, 0, 0);
          ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = true; ctx.drawImage(S.off, 0, 0, W, H);
        }
      },

      tunnel: {
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), cx = W / 2 + Math.sin(t * 0.004) * W * 0.06, cy = H / 2 + Math.cos(t * 0.005) * H * 0.06;
          const maxR = Math.hypot(W, H) * 0.6, N = 22, sides = 6;
          ctx.lineWidth = 1.4;
          for (let i = 0; i < N; i++) {
            const z = ((i / N) + t * 0.0025) % 1, r = Math.pow(z, 2.4) * maxR, rot = t * 0.003 + z * 2.5;
            ctx.strokeStyle = rgba(i % 2 ? cfg.color : cfg.color2, z * 0.7 * k);
            ctx.beginPath();
            for (let s = 0; s <= sides; s++) { const a = rot + s * TAU / sides; ctx[s ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); }
            ctx.stroke();
          }
        }
      },

      orbits: {
        init() { S.p = Array.from({ length: 6 }, (_, i) => ({ r: (0.12 + i * 0.075), a: rnd(0, TAU), v: 0.012 / (1 + i * 0.6), s: rnd(2, 5), c: i % 2, moon: Math.random() < .4 })); S.stars = makeStars(Math.round(70 * sc())); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.95, tilt = 0.45;
          drawStars(S.stars, 0.5);
          const sun = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.09);
          sun.addColorStop(0, rgba('#ffffff', 0.9 * k)); sun.addColorStop(0.3, rgba(cfg.color2, 0.8 * k)); sun.addColorStop(1, rgba(cfg.color2, 0));
          ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(cx, cy, R * 0.09, 0, TAU); ctx.fill();
          for (const p of S.p) {
            p.a += p.v * cfg.speed;
            ctx.strokeStyle = rgba(cfg.color, 0.14 * k); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.ellipse(cx, cy, p.r * R, p.r * R * tilt, 0, 0, TAU); ctx.stroke();
            const x = cx + Math.cos(p.a) * p.r * R, y = cy + Math.sin(p.a) * p.r * R * tilt;
            const col = p.c ? cfg.color : cfg.color2;
            ctx.fillStyle = rgba(col, 0.25 * k); ctx.beginPath(); ctx.arc(x, y, p.s * 2.2, 0, TAU); ctx.fill();
            ctx.fillStyle = rgba(col, 0.95 * k); ctx.beginPath(); ctx.arc(x, y, p.s, 0, TAU); ctx.fill();
            if (p.moon) { const ma = t * 0.05; ctx.fillStyle = `rgba(255,255,255,${0.7 * k})`; ctx.beginPath(); ctx.arc(x + Math.cos(ma) * p.s * 3, y + Math.sin(ma) * p.s * 1.4, 1.2, 0, TAU); ctx.fill(); }
          }
        }
      },

      radar: {
        init() { S.b = Array.from({ length: 9 }, () => ({ a: rnd(0, TAU), r: rnd(0.15, 0.95), life: 0 })); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46;
          ctx.strokeStyle = rgba(cfg.color, 0.2 * k); ctx.lineWidth = 1;
          for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, TAU); ctx.stroke(); }
          ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
          const sweep = (t * 0.02) % TAU;
          for (let j = 0; j < 40; j++) { ctx.fillStyle = rgba(cfg.color, (1 - j / 40) * 0.25 * k); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, sweep - (j + 1) * 0.02, sweep - j * 0.02); ctx.closePath(); ctx.fill(); }
          for (const b of S.b) {
            if ((sweep - b.a + TAU * 2) % TAU < 0.05) b.life = 1;
            b.life *= 0.985;
            if (b.life < 0.02) { if (Math.random() < 0.002) { b.a = rnd(0, TAU); b.r = rnd(0.15, 0.95); } continue; }
            const x = cx + Math.cos(b.a) * b.r * R, y = cy + Math.sin(b.a) * b.r * R;
            ctx.fillStyle = rgba(cfg.color2, b.life * k); ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
            ctx.strokeStyle = rgba(cfg.color2, b.life * 0.5 * k); ctx.beginPath(); ctx.arc(x, y, 3 + (1 - b.life) * 14, 0, TAU); ctx.stroke();
          }
        }
      },

      dna: {
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), cy = H * 0.5, A = H * 0.16, step = Math.max(10, 18 * sc()), T = t * 0.02;
          for (let x = -step; x < W + step; x += step) {
            const ph = x * 0.022 / sc() + T, y1 = cy + Math.sin(ph) * A, y2 = cy + Math.sin(ph + Math.PI) * A, z1 = (Math.cos(ph) + 1) / 2, z2 = 1 - z1;
            const g = ctx.createLinearGradient(x, y1, x, y2); g.addColorStop(0, rgba(cfg.color, 0.25 * k)); g.addColorStop(1, rgba(cfg.color2, 0.25 * k));
            ctx.strokeStyle = g; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke();
            ctx.fillStyle = rgba(cfg.color, (0.25 + z1 * 0.7) * k); ctx.beginPath(); ctx.arc(x, y1, 1.5 + z1 * 3, 0, TAU); ctx.fill();
            ctx.fillStyle = rgba(cfg.color2, (0.25 + z2 * 0.7) * k); ctx.beginPath(); ctx.arc(x, y2, 1.5 + z2 * 3, 0, TAU); ctx.fill();
          }
        }
      },

      equalizer: {
        init() { S.n = Math.max(16, Math.round(W / 22)); S.v = new Float32Array(S.n); S.pk = new Float32Array(S.n); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), n = S.n, bw = W / n, base = H * 0.78;
          for (let i = 0; i < n; i++) {
            const target = (0.5 + 0.5 * Math.sin(t * 0.05 + i * 0.5)) * (0.5 + 0.5 * Math.sin(t * 0.021 - i * 0.23)) * (0.6 + 0.4 * Math.sin(t * 0.13 + i * 1.7));
            S.v[i] += (target - S.v[i]) * 0.2 * cfg.speed;
            S.pk[i] = Math.max(S.pk[i] - 0.006 * cfg.speed, S.v[i]);
            const h = S.v[i] * H * 0.5, x = i * bw + bw * 0.15, w = bw * 0.7;
            const g = ctx.createLinearGradient(0, base - h, 0, base);
            g.addColorStop(0, rgba(cfg.color2, 0.85 * k)); g.addColorStop(1, rgba(cfg.color, 0.6 * k));
            ctx.fillStyle = g;
            for (let y = base - h; y < base; y += 6) ctx.fillRect(x, y, w, 4);
            ctx.fillStyle = rgba('#ffffff', 0.8 * k); ctx.fillRect(x, base - S.pk[i] * H * 0.5 - 6, w, 2);
            ctx.fillStyle = rgba(cfg.color, 0.12 * k); ctx.fillRect(x, base + 4, w, h * 0.35);
          }
        }
      },

      lightning: {
        init() { S.bolts = []; S.flash = 0; S.stars = makeStars(Math.round(40 * sc()), 0.5); },
        bolt(x, y, ang, len, depth, out) {
          let cx = x, cy = y;
          const steps = Math.round(len / 14);
          for (let i = 0; i < steps; i++) {
            const nx = cx + Math.cos(ang) * 14 + rnd(-8, 8), ny = cy + Math.sin(ang) * 14;
            out.push([cx, cy, nx, ny, depth]);
            if (depth < 3 && Math.random() < 0.12) this.bolt(nx, ny, ang + rnd(-0.8, 0.8), len * 0.4, depth + 1, out);
            cx = nx; cy = ny;
          }
          return out;
        },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          drawStars(S.stars, 0.4);
          if (Math.random() < 0.008 * cfg.speed * (0.5 + k)) { S.bolts.push({ segs: this.bolt(rnd(W * 0.1, W * 0.9), 0, Math.PI / 2 + rnd(-0.3, 0.3), H * rnd(0.6, 1), 0, []), life: 1 }); S.flash = 1; }
          if (S.flash > 0) { ctx.fillStyle = rgba(cfg.color, S.flash * 0.12 * k); ctx.fillRect(0, 0, W, H); S.flash -= 0.08; }
          S.bolts = S.bolts.filter(b => {
            b.life -= 0.05;
            for (const [x1, y1, x2, y2, d] of b.segs) {
              ctx.strokeStyle = rgba(cfg.color, b.life * 0.35 * k); ctx.lineWidth = 6 - d * 1.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
              ctx.strokeStyle = rgba('#ffffff', b.life * k); ctx.lineWidth = Math.max(0.5, 2 - d * 0.5); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            }
            return b.life > 0;
          });
        }
      },

      glitch: {
        init() { S.blocks = []; },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K();
          ctx.fillStyle = rgba(cfg.color, 0.035 * k);
          for (let y = (t * 2) % 4; y < H; y += 4) ctx.fillRect(0, y, W, 1);
          if (Math.random() < 0.12 * cfg.speed) for (let i = 0; i < rnd(1, 5); i++) S.blocks.push({ x: rnd(0, W), y: rnd(0, H), w: rnd(30, 260) * sc(), h: rnd(2, 18), life: rnd(4, 14), c: Math.random() < .5 });
          S.blocks = S.blocks.filter(b => {
            ctx.fillStyle = rgba(b.c ? cfg.color : cfg.color2, 0.22 * k); ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.fillStyle = rgba(b.c ? cfg.color2 : cfg.color, 0.15 * k); ctx.fillRect(b.x + 6, b.y + 2, b.w, b.h);
            return --b.life > 0;
          });
          if (Math.random() < 0.02) { const y = rnd(0, H); ctx.fillStyle = rgba('#ffffff', 0.1 * k); ctx.fillRect(0, y, W, rnd(1, 3)); }
        }
      },

      scan: {
        init() { S.data = Array.from({ length: 8 }, () => ''); },
        draw() {
          ctx.clearRect(0, 0, W, H);
          const k = K(), s = sc();
          ctx.strokeStyle = rgba(cfg.color, 0.05 * k); ctx.lineWidth = 1;
          const gs = Math.max(18, 34 * s);
          for (let x = 0; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
          for (let y = 0; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
          // HUD brackets in the corners
          const m = 14, L = 26 * s;
          ctx.strokeStyle = rgba(cfg.color, 0.6 * k); ctx.lineWidth = 2;
          for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { ctx.beginPath(); ctx.moveTo(x, y + dy * L); ctx.lineTo(x, y); ctx.lineTo(x + dx * L, y); ctx.stroke(); }
          // sweeping beam
          const y = (t * 1.4) % (H + 240) - 120;
          const g = ctx.createLinearGradient(0, y - 110, 0, y + 4);
          g.addColorStop(0, rgba(cfg.color, 0)); g.addColorStop(0.9, rgba(cfg.color, 0.14 * k)); g.addColorStop(1, rgba(cfg.color2, 0.85 * k));
          ctx.fillStyle = g; ctx.fillRect(0, y - 110, W, 114);
          // flickering data
          if (frame % 12 === 0) S.data = S.data.map(() => Math.random().toString(16).slice(2, 10).toUpperCase() + ' ' + (Math.random() * 999).toFixed(2));
          ctx.font = `${Math.round(10 * s + 2)}px Consolas, monospace`; ctx.fillStyle = rgba(cfg.color, 0.35 * k);
          S.data.forEach((d, i) => ctx.fillText(d, W - 150 * s - m, m + 40 * s + i * 14 * s));
          // target circle
          const tx = W * (0.3 + 0.1 * Math.sin(t * 0.01)), ty = H * (0.55 + 0.1 * Math.cos(t * 0.013)), r = 26 * s;
          ctx.strokeStyle = rgba(cfg.color2, 0.55 * k); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(tx, ty, r, t * 0.03, t * 0.03 + Math.PI * 1.5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(tx - r - 8, ty); ctx.lineTo(tx - r + 4, ty); ctx.moveTo(tx + r - 4, ty); ctx.lineTo(tx + r + 8, ty); ctx.stroke();
        }
      }
    };

    function init() {
      S = {};
      ctx.clearRect(0, 0, W, H);
      const fx = FX[cfg.effect];
      if (fx && fx.init && W && H) fx.init.call(fx);
    }

    function loop(now) {
      if (!alive) return;
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / fps - 2) return;
      last = now;
      if (document.hidden || !W || !H) return;
      const fx = FX[cfg.effect];
      if (!fx) return;
      t += cfg.speed; frame++;
      fx.draw.call(fx);
    }

    return {
      set(next) {
        const reinit = ['effect', 'intensity', 'color', 'color2'].some(k => next[k] !== undefined && next[k] !== cfg[k]);
        cfg = { ...cfg, ...next };
        if (!cfg.color) cfg.color = '#00f0ff';
        if (!raf) { resize(); raf = requestAnimationFrame(loop); }
        else if (reinit) init();
      },
      destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); }
    };
  }

  window.createFX = createFX;
  window.FX_IDS = IDS;
  window.NeonFX = createFX(document.getElementById('fx'));
  window.NeonFX.effects = IDS;
})();
