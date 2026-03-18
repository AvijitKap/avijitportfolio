/* ============================================================
   app.js  —  Avijit Kapoor Portfolio v3
   5-Layer BG · Meteors · Ripples · Dot-Grid · Day/Night · Cursor · Tilt · Radar
   ============================================================ */

/* ── 1. THEME TOGGLE ── */
(function () {
  const html   = document.documentElement;
  const btn    = document.getElementById('theme-toggle');
  const LS_KEY = 'ak-theme';
  const saved  = localStorage.getItem(LS_KEY);
  if (saved) html.setAttribute('data-theme', saved);
  btn.addEventListener('click', () => {
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem(LS_KEY, next);
    initParticles();
    if (typeof drawRadar === 'function') drawRadar();
  });
})();


/* ── 2. SCROLL PROGRESS ── */
(function () {
  const bar = document.getElementById('scroll-progress');
  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100;
    bar.style.width = Math.min(pct, 100) + '%';
  }, { passive: true });
})();


/* ══════════════════════════════════════════════════════════════
   3. INTERACTIVE MULTI-LAYER BACKGROUND CANVAS
   Layers: Aurora Blobs → Dot Grid → Particles → Meteors → Ripples
   ══════════════════════════════════════════════════════════════ */
const canvas = document.getElementById('bg-canvas');
const ctx    = canvas.getContext('2d');
let W, H, bgTime = 0;
let mouse = { x: null, y: null, r: 160 };

function isDark() {
  return document.documentElement.getAttribute('data-theme') !== 'light';
}

/* ─── Resize ─── */
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  initDotGrid();
}

/* ─────────────────────────────────
   LAYER 1 ─ AURORA BLOBS
   Slow-breathing radial gradients that drift around the screen
   ───────────────────────────────── */
const AURORAS = [
  { cx: 0.15, cy: 0.20, rx: 0.45, ry: 0.35, col: '108,99,255',  phase: 0.0 },
  { cx: 0.78, cy: 0.65, rx: 0.42, ry: 0.30, col: '0,212,255',   phase: 2.1 },
  { cx: 0.50, cy: 0.88, rx: 0.40, ry: 0.26, col: '255,107,157', phase: 4.3 },
  { cx: 0.88, cy: 0.18, rx: 0.32, ry: 0.30, col: '167,139,250', phase: 1.2 },
];

function drawAuroras() {
  const baseOp = isDark() ? 0.13 : 0.05;
  AURORAS.forEach(a => {
    a.phase += 0.0025;
    const ox  = Math.sin(a.phase * 1.3) * 0.06 * W;
    const oy  = Math.cos(a.phase * 0.9) * 0.06 * H;
    const cx  = a.cx * W + ox;
    const cy  = a.cy * H + oy;
    const rx  = a.rx * W * (1 + Math.sin(a.phase * 0.7) * 0.12);
    const ry  = a.ry * H * (1 + Math.cos(a.phase * 0.5) * 0.12);
    const mr  = Math.max(rx, ry);
    const g   = ctx.createRadialGradient(cx, cy, 0, cx, cy, mr);
    g.addColorStop(0,    `rgba(${a.col},${baseOp * 1.8})`);
    g.addColorStop(0.42, `rgba(${a.col},${baseOp * 0.65})`);
    g.addColorStop(1,    `rgba(${a.col},0)`);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx / mr, ry / mr);
    ctx.beginPath();
    ctx.arc(0, 0, mr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  });
}

/* ─────────────────────────────────
   LAYER 2 ─ WARPING DOT GRID
   A grid of dots that bulge away from the cursor + drift on sine waves
   ───────────────────────────────── */
const GRID_SPACING = 50;
let gridDots = [];

function initDotGrid() {
  gridDots = [];
  const cols = Math.ceil(W / GRID_SPACING) + 2;
  const rows = Math.ceil(H / GRID_SPACING) + 2;
  for (let r = 0; r <= rows; r++)
    for (let c = 0; c <= cols; c++)
      gridDots.push({ bx: c * GRID_SPACING, by: r * GRID_SPACING });
}

function drawDotGrid() {
  const baseOp = isDark() ? 0.16 : 0.09;
  const warpR  = 150;
  gridDots.forEach(d => {
    let dx = Math.sin(bgTime * 0.0008 + d.bx * 0.014) * 3;
    let dy = Math.cos(bgTime * 0.0006 + d.by * 0.014) * 3;
    if (mouse.x !== null) {
      const mx   = d.bx - mouse.x;
      const my   = d.by - mouse.y;
      const dist = Math.hypot(mx, my);
      if (dist < warpR && dist > 0) {
        const force = (1 - dist / warpR) * 22;
        dx += (mx / dist) * force;
        dy += (my / dist) * force;
      }
    }
    const x     = d.bx + dx;
    const y     = d.by + dy;
    const disp  = Math.hypot(dx, dy);
    const size  = 1.2 + disp / 60;
    const alpha = baseOp + disp / 22 * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, Math.min(size, 3.8), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(108,99,255,${Math.min(alpha, 0.55)})`;
    ctx.fill();
  });
}

/* ─────────────────────────────────
   LAYER 3 ─ GLOWING PARTICLES + CONNECTIONS
   Classic particle network but with larger glow halos
   ───────────────────────────────── */
const DARK_COLS  = ['#6c63ff', '#00d4ff', '#ff6b9d', '#a78bfa', '#38bdf8'];
const LIGHT_COLS = ['#6c63ff', '#00aacc', '#cc3377', '#7c55ee', '#2280cc'];
function getColors() { return isDark() ? DARK_COLS : LIGHT_COLS; }
function getOp()     { return isDark() ? 0.55 : 0.22; }

let particles = [];

class Particle {
  constructor() { this.init(); }
  init() {
    this.x = this.bx = Math.random() * W;
    this.y = this.by = Math.random() * H;
    this.size  = Math.random() * 2.2 + 0.8;
    this.vx    = (Math.random() - 0.5) * 0.38;
    this.vy    = (Math.random() - 0.5) * 0.38;
    this.col   = getColors()[Math.floor(Math.random() * 5)];
    this.alpha = Math.random() * 0.50 + 0.10;
    this.phase = Math.random() * Math.PI * 2;
    this.spd   = 0.016 + Math.random() * 0.020;
  }
}

function initParticles() {
  const n = Math.min(Math.floor(W * H / 8000), 130);
  particles = Array.from({ length: n }, () => new Particle());
}

function drawParticles() {
  const maxDist = 145;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.phase += p.spd;

    if (mouse.x !== null) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y;
      const d  = Math.hypot(dx, dy);
      if (d < mouse.r && d > 0) {
        const f = (mouse.r - d) / mouse.r;
        p.x += dx / d * f * 4;
        p.y += dy / d * f * 4;
      }
    }

    p.x += (p.bx - p.x) * 0.022 + p.vx;
    p.y += (p.by - p.y) * 0.022 + p.vy;
    p.bx += p.vx; if (p.bx < 0) p.bx = W; if (p.bx > W) p.bx = 0;
    p.by += p.vy; if (p.by < 0) p.by = H; if (p.by > H) p.by = 0;

    for (let j = i + 1; j < particles.length; j++) {
      const q = particles[j];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < maxDist) {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = `rgba(108,99,255,${(1 - d / maxDist) * 0.20 * getOp() / 0.55})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    const a = p.alpha + Math.sin(p.phase) * 0.12;
    const r = p.size  + Math.sin(p.phase) * 0.5;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 7);
    g.addColorStop(0, p.col);
    g.addColorStop(1, 'transparent');
    ctx.globalAlpha = a * getOp();
    ctx.beginPath(); ctx.arc(p.x, p.y, r * 7, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.arc(p.x, p.y, r,     0, Math.PI * 2); ctx.fillStyle = p.col; ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ─────────────────────────────────
   LAYER 4 ─ SHOOTING METEORS
   Dark-mode only; spawn on interval, fade out as they travel
   ───────────────────────────────── */
let meteors = [];

function spawnMeteor() {
  if (!isDark()) return;
  const speed  = 9 + Math.random() * 10;
  const angle  = Math.PI / 4 + (Math.random() - 0.5) * 0.5;
  const pals   = ['108,99,255', '0,212,255', '167,139,250', '255,107,157'];
  meteors.push({
    x:    Math.random() * W,
    y:    -15,
    vx:   Math.cos(angle) * speed,
    vy:   Math.sin(angle) * speed,
    len:  90 + Math.random() * 130,
    life: 1,
    col:  pals[Math.floor(Math.random() * pals.length)],
  });
}

function drawMeteors() {
  if (!isDark()) { meteors = []; return; }
  meteors = meteors.filter(m => m.life > 0.01);
  meteors.forEach(m => {
    m.x += m.vx; m.y += m.vy; m.life -= 0.018;
    const speed = Math.hypot(m.vx, m.vy);
    const tx    = m.x - m.vx / speed * m.len;
    const ty    = m.y - m.vy / speed * m.len;
    const tail  = ctx.createLinearGradient(m.x, m.y, tx, ty);
    tail.addColorStop(0, `rgba(${m.col},${m.life * 0.9})`);
    tail.addColorStop(1, `rgba(${m.col},0)`);
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty);
    ctx.strokeStyle = tail; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(m.x, m.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${m.life})`; ctx.fill();
  });
}

setInterval(() => { if (Math.random() < 0.7) spawnMeteor(); }, 1300);

/* ─────────────────────────────────
   LAYER 5 ─ CLICK RIPPLE WAVES
   Click anywhere on the canvas to spawn 3 concentric expanding rings
   ───────────────────────────────── */
let ripples = [];

canvas.addEventListener('click', e => {
  const cols = ['108,99,255', '0,212,255', '255,107,157'];
  cols.forEach((col, i) => {
    ripples.push({ x: e.clientX, y: e.clientY, r: 0, alpha: 0.65 - i * 0.12, col, delay: i * 8 });
  });
});

function drawRipples() {
  ripples = ripples.filter(r => r.alpha > 0.008);
  ripples.forEach(r => {
    if (r.delay-- > 0) return;
    r.r     += 4.5;
    r.alpha *= 0.91;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${r.col},${r.alpha})`;
    ctx.lineWidth   = 2; ctx.stroke();
  });
}

/* ─────────────────────────────────
   MASTER DRAW LOOP
   ───────────────────────────────── */
function drawLoop() {
  bgTime++;
  ctx.clearRect(0, 0, W, H);
  drawAuroras();
  drawDotGrid();
  drawParticles();
  drawMeteors();
  drawRipples();
  requestAnimationFrame(drawLoop);
}

window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mouseleave', () => { mouse.x = mouse.y = null; });
window.addEventListener('resize', () => { resize(); initParticles(); });
resize(); initParticles(); drawLoop();


/* ── 4. CUSTOM CURSOR + TRAIL ── */
(function () {
  const outer = document.getElementById('cursor-outer');
  const inner = document.getElementById('cursor-inner');
  let mx = 0, my = 0, ox = 0, oy = 0;

  const TRAIL_COUNT = 8;
  const positions   = [];
  const trail       = [];
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;width:${8 - i * 0.7}px;height:${8 - i * 0.7}px;border-radius:50%;pointer-events:none;z-index:99990;transform:translate(-50%,-50%);background:var(--accent);opacity:0;mix-blend-mode:difference;transition:opacity .3s;`;
    document.body.appendChild(d);
    trail.push(d);
  }

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    inner.style.left = mx + 'px'; inner.style.top = my + 'px';
    positions.unshift({ x: mx, y: my });
    if (positions.length > TRAIL_COUNT * 3) positions.pop();
    trail.forEach((t, i) => {
      const p = positions[Math.min(i * 2 + 3, positions.length - 1)] || { x: mx, y: my };
      t.style.left    = p.x + 'px';
      t.style.top     = p.y + 'px';
      t.style.opacity = ((TRAIL_COUNT - i) / TRAIL_COUNT * 0.35).toString();
    });
  });

  function followCursor() {
    ox += (mx - ox) * 0.12; oy += (my - oy) * 0.12;
    outer.style.left = ox + 'px'; outer.style.top = oy + 'px';
    requestAnimationFrame(followCursor);
  }
  followCursor();

  document.querySelectorAll('a, button, .project-card, .cert-card, .info-card, .skill-tab, .soft-skill-bubble').forEach(el => {
    el.addEventListener('mouseenter', () => { outer.style.width='60px'; outer.style.height='60px'; outer.style.borderColor='var(--accent2)'; outer.style.opacity='.6'; });
    el.addEventListener('mouseleave', () => { outer.style.width='36px'; outer.style.height='36px'; outer.style.borderColor='var(--accent)'; outer.style.opacity='1'; });
  });
  document.addEventListener('mouseleave', () => { outer.style.opacity='0'; inner.style.opacity='0'; trail.forEach(t=>t.style.opacity='0'); });
  document.addEventListener('mouseenter', () => { outer.style.opacity='1'; inner.style.opacity='1'; });
})();


/* ── 5. TYPED TEXT ── */
(function () {
  const phrases = [
    'CS & Engineering Student',
    'Python Developer 🐍',
    'Data Science Enthusiast',
    'AI / ML Explorer 🤖',
    'Oracle OCI Certified ☁️',
    'Full-Stack Problem Solver 💡',
  ];
  let pi = 0, ci = 0, del = false;
  const el = document.getElementById('typed');
  function tick() {
    const cur = phrases[pi];
    if (!del) {
      el.textContent = cur.slice(0, ++ci);
      if (ci === cur.length) { del = true; return setTimeout(tick, 1900); }
      setTimeout(tick, 62);
    } else {
      el.textContent = cur.slice(0, --ci);
      if (ci === 0) { del = false; pi = (pi + 1) % phrases.length; return setTimeout(tick, 300); }
      setTimeout(tick, 33);
    }
  }
  setTimeout(tick, 1000);
})();


/* ── 6. NAVBAR SCROLL + ACTIVE LINK ── */
(function () {
  const nav      = document.getElementById('navbar');
  const links    = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
    let cur = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 130) cur = s.id; });
    links.forEach(l => l.classList.toggle('active', l.dataset.section === cur));
  }, { passive: true });
})();


/* ── 7. HAMBURGER MENU ── */
const hamburger  = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');
let menuOpen = false;
hamburger.addEventListener('click', () => {
  menuOpen = !menuOpen;
  hamburger.classList.toggle('open', menuOpen);
  mobileMenu.classList.toggle('open', menuOpen);
});
function closeMobile() { menuOpen = false; hamburger.classList.remove('open'); mobileMenu.classList.remove('open'); }


/* ── 8. SKILL TABS ── */
(function () {
  const tabs   = document.querySelectorAll('.skill-tab');
  const panels = document.querySelectorAll('.skill-panel');
  if (!tabs.length) return;
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t  => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.querySelector(`.skill-panel[data-panel="${tab.dataset.tab}"]`);
      if (panel) {
        panel.classList.add('active');
        panel.querySelectorAll('.skill-fill').forEach(f => { f.classList.remove('animated'); void f.offsetWidth; f.classList.add('animated'); });
      }
    });
  });
})();


/* ── 9. SCROLL REVEAL ── */
(function () {
  const sel = '.section-title,.about-grid,.skill-tabs,.skills-grid,.projects-grid,.timeline-item,.certs-grid,.edu-item,.contact-grid,.radar-section';
  const io  = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll(sel).forEach(el => { el.classList.add('reveal'); io.observe(el); });
  ['.about-stats', '.about-info-cards', '.hero-social', '.hero-facts'].forEach(s => {
    const el = document.querySelector(s);
    if (el) { el.classList.add('stagger'); io.observe(el); }
  });
})();


/* ── 10. SKILL / CGPA BAR ANIMATION ── */
(function () {
  const fills = document.querySelectorAll('.skill-fill, .cgpa-fill');
  const io    = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('animated'); io.unobserve(e.target); } });
  }, { threshold: 0.3 });
  fills.forEach(f => io.observe(f));
})();


/* ── 11. COUNTER ANIMATION ── */
(function () {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, end = parseFloat(el.dataset.target), isFloat = el.dataset.float === 'true';
      let cur = 0;
      const dur = 1400, step = 16, inc = end / (dur / step);
      const t = setInterval(() => { cur = Math.min(cur + inc, end); el.textContent = isFloat ? cur.toFixed(2) : Math.floor(cur); if (cur >= end) clearInterval(t); }, step);
      io.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.stat-number[data-target]').forEach(el => io.observe(el));
})();


/* ── 12. 3D TILT CARDS ── */
document.querySelectorAll('.tilt-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    card.style.transform = `perspective(800px) rotateY(${x*10}deg) rotateX(${-y*10}deg) translateY(-6px)`;
    card.style.boxShadow = `${-x*20}px ${-y*20}px 40px rgba(108,99,255,.2)`;
    const glow = card.querySelector('.project-glow');
    if (glow) { glow.style.background = `radial-gradient(circle at ${(x+.5)*100}% ${(y+.5)*100}%,rgba(108,99,255,.18),transparent 60%)`; glow.style.opacity = '1'; }
  });
  card.addEventListener('mouseleave', () => { card.style.transform=''; card.style.boxShadow=''; const g=card.querySelector('.project-glow'); if(g)g.style.opacity='0'; });
});


/* ── 13. MAGNETIC ELEMENTS ── */
document.querySelectorAll('.magnetic').forEach(el => {
  el.addEventListener('mousemove', e => {
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - r.left - r.width  / 2) * 0.35;
    const dy = (e.clientY - r.top  - r.height / 2) * 0.35;
    el.style.transform = `translate(${dx}px,${dy}px)`;
  });
  el.addEventListener('mouseleave', () => { el.style.transform = ''; });
});


/* ── 14. PROJECT MODALS ── */
const modalData = {
  consumer: {
    icon: '📊', title: 'Consumer Complaints Data Analysis', year: '2024',
    tags: ['Python','Pandas','NumPy','Matplotlib','Seaborn','EDA'],
    overview: 'Performed comprehensive EDA on 2024 consumer complaint records to uncover patterns in complaint frequency, resolution times, and company responsiveness.',
    highlights: [
      'Analysed 50,000+ records using Pandas for data wrangling and cleaning',
      'Created 15+ visualizations with Matplotlib & Seaborn to identify trends',
      'Identified top 10 complaint categories and average resolution time per company',
      'Generated actionable insights on company performance benchmarks',
    ],
    outcome: 'Full analytical report with statistical findings, trend charts, and business recommendations.',
    github: 'https://github.com/AvijitKap',
  },
  crossfile: {
    icon: '🔗', title: 'Cross File Sharing Web App', year: '2025',
    tags: ['Python','Flask','AES Encryption','QR Code','HTML/CSS/JS','SQLite'],
    overview: 'A secure, browser-based file sharing system enabling cross-device transfers with password-protected AES encryption and instant QR code generation.',
    highlights: [
      'Built full-stack app with Flask backend and responsive frontend',
      'Implemented AES password-based encryption for secure file storage & retrieval',
      'Auto-generated QR codes map to download URLs for mobile-friendly sharing',
      'SQLite for persisting file metadata and session-based access tokens',
    ],
    outcome: 'A polished, deployable tool demonstrating security, web development, and UX design skills.',
    github: 'https://github.com/AvijitKap',
  },
  pet: {
    icon: '🐾', title: 'Pet Health Tracker System', year: '2025',
    tags: ['Python','Flask','SQLite','HTML/CSS','JavaScript','CRUD'],
    overview: 'Web application for pet owners to log and track health records including vaccinations, vet visits, diet logs, and symptom tracking.',
    highlights: [
      'Designed a fully functional CRUD Flask app with a user-friendly UI',
      'SQLite database for organised, persistent health record storage',
      'Automated reminder system for upcoming vaccinations and vet appointments',
      'Health trend dashboard showing weight, diet, and symptom history',
    ],
    outcome: 'A complete, deployable pet management system demonstrating full-stack development competency.',
    github: 'https://github.com/AvijitKap',
  },
};

function openModal(key) {
  const d = modalData[key]; if (!d) return;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-icon">${d.icon}</div>
    <h3>${d.title}</h3>
    <div style="font-size:.75rem;color:var(--accent);font-family:'Fira Code',monospace;margin-bottom:.75rem">${d.year}</div>
    <div class="mod-tags">${d.tags.map(t=>`<span>${t}</span>`).join('')}</div>
    <div class="mod-section"><h4>Project Overview</h4><p>${d.overview}</p></div>
    <div class="mod-section"><h4>Key Highlights</h4><ul>${d.highlights.map(h=>`<li>${h}</li>`).join('')}</ul></div>
    <div class="mod-section"><h4>Outcome</h4><p>${d.outcome}</p></div>
    <a href="${d.github}" target="_blank" class="modal-link">View on GitHub →</a>
  `;
  document.getElementById('modal-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() { document.getElementById('modal-backdrop').classList.remove('open'); document.body.style.overflow = ''; }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });


/* ── 15. CONTACT FORM + CONFETTI ── */
function handleForm(e) {
  e.preventDefault();
  const btn = document.getElementById('submit-btn'), success = document.getElementById('form-success'), orig = btn.innerHTML;
  btn.innerHTML = '<span>Sending…</span> ⏳'; btn.disabled = true;
  setTimeout(() => {
    success.style.display = 'block'; btn.innerHTML = orig; btn.disabled = false;
    e.target.reset(); launchConfetti();
    setTimeout(() => { success.style.display = 'none'; }, 6000);
  }, 1400);
}

function launchConfetti() {
  const colors = ['#6c63ff','#00d4ff','#ff6b9d','#22c55e','#f59e0b'];
  for (let i = 0; i < 70; i++) {
    const c = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size  = Math.random() * 8 + 4;
    c.style.cssText = `position:fixed;pointer-events:none;z-index:99999;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random()>.5?'50%':'2px'};left:${Math.random()*100}vw;top:-10px;`;
    document.body.appendChild(c);
    c.animate([
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${(Math.random()-.5)*300}px,${window.innerHeight+60}px) rotate(${Math.random()*720-360}deg)`, opacity: 0 },
    ], { duration: Math.random() * 2000 + 1500, easing: 'cubic-bezier(.25,.46,.45,.94)' }).onfinish = () => c.remove();
  }
}


/* ── 16. SMOOTH SCROLL ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const t = document.querySelector(a.getAttribute('href'));
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
  });
});


/* ── 17. SVG RING GRADIENT ── */
(function () {
  const svg = document.querySelector('.ring-svg'); if (!svg) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
  grad.setAttribute('id', 'ringGrad'); grad.setAttribute('x1','0%'); grad.setAttribute('y1','0%'); grad.setAttribute('x2','100%'); grad.setAttribute('y2','0%');
  [['0%','#6c63ff'],['50%','#ff6b9d'],['100%','#00d4ff']].forEach(([o,c]) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    s.setAttribute('offset', o); s.setAttribute('stop-color', c); grad.appendChild(s);
  });
  defs.appendChild(grad); svg.prepend(defs);
})();


/* ── 18. SKILL RADAR CHART ── */
function drawRadar() {
  const c = document.getElementById('radar-canvas'); if (!c) return;
  const rc   = c.getContext('2d');
  const dark = isDark();
  const W2 = c.width, H2 = c.height, cx = W2/2, cy = H2/2, r = 130;
  const labels = ['Python','AI/ML','Data Viz','Web Dev','SQL','Tools'];
  const values = [0.90, 0.82, 0.85, 0.72, 0.78, 0.85];
  const n      = labels.length;
  const textCol = dark ? 'rgba(136,146,176,.9)' : 'rgba(71,85,105,.9)';
  const gridCol = dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.07)';

  rc.clearRect(0, 0, W2, H2);

  // Grid rings
  for (let ring = 1; ring <= 5; ring++) {
    rc.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i*(2*Math.PI/n) - Math.PI/2;
      const x = cx + r*(ring/5)*Math.cos(a), y = cy + r*(ring/5)*Math.sin(a);
      i === 0 ? rc.moveTo(x,y) : rc.lineTo(x,y);
    }
    rc.closePath(); rc.strokeStyle = gridCol; rc.lineWidth = 1; rc.stroke();
  }
  // Axes
  for (let i = 0; i < n; i++) {
    const a = i*(2*Math.PI/n) - Math.PI/2;
    rc.beginPath(); rc.moveTo(cx,cy); rc.lineTo(cx+r*Math.cos(a), cy+r*Math.sin(a));
    rc.strokeStyle = gridCol; rc.lineWidth = 1; rc.stroke();
  }
  // Data polygon
  rc.beginPath();
  for (let i = 0; i < n; i++) {
    const a = i*(2*Math.PI/n) - Math.PI/2;
    const x = cx + r*values[i]*Math.cos(a), y = cy + r*values[i]*Math.sin(a);
    i === 0 ? rc.moveTo(x,y) : rc.lineTo(x,y);
  }
  rc.closePath();
  const rg = rc.createRadialGradient(cx,cy,0,cx,cy,r);
  rg.addColorStop(0,'rgba(108,99,255,.35)'); rg.addColorStop(1,'rgba(0,212,255,.12)');
  rc.fillStyle = rg; rc.fill();
  rc.strokeStyle = 'rgba(108,99,255,.8)'; rc.lineWidth = 2.5; rc.stroke();
  // Dots + labels
  for (let i = 0; i < n; i++) {
    const a  = i*(2*Math.PI/n) - Math.PI/2;
    const x  = cx + r*values[i]*Math.cos(a), y = cy + r*values[i]*Math.sin(a);
    rc.beginPath(); rc.arc(x,y,5,0,Math.PI*2); rc.fillStyle='#6c63ff'; rc.fill();
    rc.beginPath(); rc.arc(x,y,3,0,Math.PI*2); rc.fillStyle='#fff'; rc.fill();
    const lx = cx + (r+28)*Math.cos(a), ly = cy + (r+28)*Math.sin(a);
    rc.fillStyle = textCol; rc.font = 'bold 12px Space Grotesk, Inter, sans-serif'; rc.textAlign='center'; rc.textBaseline='middle';
    rc.fillText(labels[i], lx, ly);
    rc.font = '10px Fira Code, monospace'; rc.fillStyle = 'rgba(108,99,255,.85)';
    rc.fillText(Math.round(values[i]*100)+'%', lx, ly+14);
  }
}

// Draw radar when visible
(function () {
  const rs = document.querySelector('.radar-section'); if (!rs) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { drawRadar(); io.unobserve(e.target); } });
  }, { threshold: 0.3 });
  io.observe(rs);
})();
