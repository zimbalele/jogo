'use strict';
/* =========================================================
   Cecília e o caminho da Vovó Querida
   Jogo infantil (3-6 anos) em Canvas 2D, sem imagens externas.
   ========================================================= */
(() => {
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const $ = (id) => document.getElementById(id);

// ---------- Mundo ----------
const VH = 720;                 // altura virtual fixa
let VW = 1280, scale = 1;       // largura virtual depende da tela
let TOP = 0;                    // corte do céu em telas baixas (zoom)
const GY = 612;                 // linha do chão (pés)
const HOUSE_X = 13000;          // porta da casa da vovó
const LEVEL_END = HOUSE_X + 420;
const TOTAL = 100;
const SPEED = 270, JUMP = -960, GRAV = 2400;
const WOLF_AT = [1700, 4100, 6500, 8900, 11200]; // onde o lobo aparece
const SIGNS = [330, 4500, 8000, 11700];
const TAU = Math.PI * 2;

const BIOMES = [
  { n: 'city',   x0: -1e9, x1: 2600 },
  { n: 'park',   x0: 2600, x1: 5400 },
  { n: 'field',  x0: 5400, x1: 7900 },
  { n: 'forest', x0: 7900, x1: 10900 },
  { n: 'meadow', x0: 10900, x1: 1e9 },
];
const PAL = {
  city:   { top: '#7EC8F5', bot: '#D6F0FF', far: '#A9BED6', grass: '#7BC96F', path: '#D9D4CC', soil: '#8E8A84' },
  park:   { top: '#6EC3F2', bot: '#E3F6FF', far: '#9ED38E', grass: '#6CC25A', path: '#E2C08D', soil: '#8B5E3C' },
  field:  { top: '#79C7F7', bot: '#FFF3D6', far: '#B7D98A', grass: '#8CCB4E', path: '#E8C98E', soil: '#9A6A3E' },
  forest: { top: '#5FA8D9', bot: '#CFEBD9', far: '#5E9C78', grass: '#4E9A47', path: '#C9A574', soil: '#6E4B32' },
  meadow: { top: '#86CFFF', bot: '#FFE6F0', far: '#A8DC9A', grass: '#78CF6A', path: '#EBCB97', soil: '#8B5E3C' },
};
// pré-converte cores para RGB
const RGB = {};
for (const b in PAL) { RGB[b] = {}; for (const k in PAL[b]) RGB[b][k] = hex(PAL[b][k]); }
function hex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb(a) { return `rgb(${a[0] | 0},${a[1] | 0},${a[2] | 0})`; }
function lerpA(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function biomeIdx(x) { for (let i = 0; i < BIOMES.length; i++) if (x < BIOMES[i].x1) return i; return BIOMES.length - 1; }
function pal(x, key) {
  const i = biomeIdx(x), b = BIOMES[i], c = RGB[b.n][key], B = 350;
  if (i < BIOMES.length - 1 && b.x1 - x < B) return rgb(lerpA(c, RGB[BIOMES[i + 1].n][key], (B - (b.x1 - x)) / (2 * B)));
  if (i > 0 && x - b.x0 < B) return rgb(lerpA(c, RGB[BIOMES[i - 1].n][key], 0.5 - (x - b.x0) / (2 * B)));
  return rgb(c);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- Primitivas de desenho ----------
function C(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.fill(); }
function E(x, y, rx, ry, c, rot = 0) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); ctx.fill(); }
function RR(x, y, w, h, r, c) {
  r = Math.min(r, w / 2, h / 2); ctx.fillStyle = c; ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
}
function L(x1, y1, x2, y2, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
// ângulo 0 = para baixo; positivo = para a frente (+x)
function limb(x, y, len, ang, w, c) { const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len; L(x, y, ex, ey, w, c); return [ex, ey]; }
function poly(p, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]); ctx.closePath(); ctx.fill(); }
function shadow(x, w, a = 0.18) { E(x, GY + 2, w, 7, `rgba(0,0,0,${a})`); }
function arcS(x, y, r, a0, a1, w, c) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); }
function eye(x, y, r, iris, closed, look = 1) {
  if (closed) { arcS(x, y - r * 0.2, r * 0.8, 0.15 * Math.PI, 0.85 * Math.PI, 2.2, '#2b1a10'); return; }
  E(x, y, r * 0.85, r, '#fff');
  C(x + look * r * 0.18, y + r * 0.1, r * 0.66, iris);
  C(x + look * r * 0.22, y + r * 0.15, r * 0.34, '#160c06');
  C(x + look * r * 0.02, y - r * 0.22, r * 0.24, '#fff');
}
function heart(x, y, s, c) {
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); ctx.fill();
}
function star(x, y, r, c, rot = 0) {
  ctx.fillStyle = c; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

// ---------- Personagens ----------
const RED = '#E63946', RED_D = '#B5202E';

// Cecília: 3 aninhos, cabelo cacheado, morena clara, capuz vermelho
function drawCecilia(x, y, face, o) {
  const C_SKIN = '#E0AE88', C_SKIN_D = '#C98F68', HAIR = '#3A2214', HAIR_HI = '#5C3824';
  const DENIM = '#4F7FD6', DENIM_D = '#3A63AE', IRIS = '#6B3E1F';
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  if (o.hurt > 0 && Math.floor(G.t * 14) % 2) ctx.globalAlpha = 0.45;
  const sit = o.pose === 'sit', air = o.air && !sit, mv = o.moving && !sit && !air;
  const t = o.walk || 0, sw = mv ? Math.sin(t) * 0.6 : 0;
  ctx.translate(0, mv ? -Math.abs(Math.cos(t)) * 3 : 0);

  // capa (atrás)
  const fl = Math.sin(G.t * 7) * (mv || o.fast ? 5 : 1.5) + (o.fast ? 10 : 0);
  ctx.fillStyle = RED_D; ctx.beginPath(); ctx.moveTo(6, -76);
  ctx.quadraticCurveTo(-12, -60, -30 - fl, -26 + (o.fast ? -10 : 0)); ctx.lineTo(-6, -30); ctx.closePath(); ctx.fill();

  // pernas
  const shoe = (ex, ey) => { RR(ex - 6, ey - 2, 17, 9, 4, '#fff'); RR(ex - 6, ey + 5, 17, 3, 1.5, '#FF7AA2'); };
  if (sit) {
    L(-4, -36, 14, -38, 10, C_SKIN_D); L(14, -38, 16, -18, 9, C_SKIN_D); shoe(16, -16);
    L(2, -36, 20, -36, 10, C_SKIN); L(20, -36, 22, -16, 9, C_SKIN); shoe(22, -14);
  } else {
    const a1 = air ? 0.5 : -sw, a2 = air ? -0.3 : sw;
    let e = limb(-4, -36, 26, a1, 10, C_SKIN_D); shoe(e[0], e[1]);
    e = limb(4, -36, 26, a2, 10, C_SKIN); shoe(e[0], e[1]);
  }
  // braço de trás
  limb(-3, -64, 22, -0.35 - sw * 0.5 + (air ? -1.2 : 0), 8, C_SKIN_D);
  // jardineira jeans + camiseta
  RR(-11, -74, 22, 14, 6, '#FFF6E8');
  poly([-12, -64, 12, -64, 19, -32, -19, -32], DENIM);
  RR(-19, -36, 38, 5, 2, DENIM_D);
  L(-7, -70, -7, -60, 3, DENIM_D); L(7, -70, 7, -60, 3, DENIM_D);
  heart(3, -50, 5, '#FF7AA2');
  // cabeça
  const hx = 3, hy = -94;
  C(hx - 6, hy - 1, 33, RED);                // capuz
  // cachinhos
  const curls = [[-24, -2], [-22, -14], [-14, -24], [-2, -28], [11, -27], [21, -20], [-25, 10], [-20, 20], [-12, 22]];
  for (const [cx, cy] of curls) C(hx + cx, hy + cy, 9.5, HAIR);
  for (const [cx, cy] of curls) arcS(hx + cx - 1, hy + cy - 1, 5, 3.6, 5.4, 2, HAIR_HI);
  E(hx + 5, hy + 5, 21.5, 22, C_SKIN);       // rosto
  // franjinha cacheada
  for (const [cx, cy, r] of [[-8, -14, 8], [1, -18, 8], [10, -17, 7.5], [18, -12, 6.5], [-14, -6, 7]]) C(hx + cx, hy + cy, r, HAIR);
  arcS(hx + 1, hy - 19, 4, 3.4, 5.6, 2, HAIR_HI);
  // aba do capuz
  arcS(hx - 5, hy - 1, 32, 0.55 * Math.PI, 1.9 * Math.PI, 8, RED);
  // olhos
  const blink = (G.t % 3.7) < 0.12 || o.happy;
  eye(hx - 3, hy + 3, 6.2, IRIS, blink); eye(hx + 13, hy + 3, 6.2, IRIS, blink);
  if (!blink) { L(hx - 8, hy - 3, hx - 10, hy - 6, 1.6, '#2b1a10'); L(hx + 18, hy - 3, hx + 20, hy - 6, 1.6, '#2b1a10'); }
  C(hx - 8, hy + 13, 4.5, 'rgba(255,110,130,.45)'); C(hx + 20, hy + 12, 4, 'rgba(255,110,130,.45)');
  C(hx + 18, hy + 9, 1.8, C_SKIN_D);
  if (o.scared) E(hx + 7, hy + 16, 3.5, 4.5, '#8a3a2a');
  else arcS(hx + 6, hy + 12, 5.5, 0.15 * Math.PI, 0.85 * Math.PI, 2.4, '#8a3a2a');
  // laço do capuz
  poly([hx, hy + 26, hx - 8, hy + 21, hx - 8, hy + 31], RED); poly([hx, hy + 26, hx + 8, hy + 21, hx + 8, hy + 31], RED); C(hx, hy + 26, 3, RED_D);
  // braço da frente com cestinha
  const fa = sit ? 0.9 : 0.25 + sw * 0.4 + (air ? -0.8 : 0);
  const hand = limb(3, -64, 22, fa, 8, C_SKIN);
  basket(hand[0] + 2, hand[1] + 2, o.count);
  C(hand[0], hand[1], 4.5, C_SKIN);
  ctx.restore();
}
function basket(x, y, count) {
  arcS(x, y, 12, Math.PI, 0, 3, '#8B5A2B');
  const n = count > 0 ? Math.min(5, 1 + Math.floor(count / 25)) : 0;
  for (let i = 0; i < n; i++) { C(x - 9 + i * 4.5, y - 1 - (i % 2) * 3, 4.5, RED); C(x - 9 + i * 4.5, y - 5 - (i % 2) * 3, 1.6, '#2FA84F'); }
  poly([x - 15, y, x + 15, y, x + 11, y + 15, x - 11, y + 15], '#C68642');
  L(x - 13, y + 5, x + 13, y + 5, 1.5, '#9C6230'); L(x - 12, y + 10, x + 12, y + 10, 1.5, '#9C6230');
  for (let i = -8; i <= 8; i += 8) L(x + i, y, x + i * 0.8, y + 15, 1.5, '#9C6230');
}

// Dindo: adulto de ~1,70 m, ~73 kg
function drawDindo(x, y, face, o) {
  const SK = '#F2C9A8', SK_D = '#DDAA88', HAIR = '#E8C35A', HAIR_HI = '#F7DD8E', SHIRT = '#FFFFFF', SHIRT_D = '#E4E6EE', JEANS = '#3B5FA0', JEANS_D = '#2E4A7A';
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  const t = o.anim || 0, run = o.run, sw = run ? Math.sin(t) * 0.85 : 0;
  ctx.translate(0, run ? -Math.abs(Math.cos(t)) * 6 : 0);
  const leg = (a, col) => {
    const bend = run ? 0.4 + Math.max(0, -Math.sin(t) * (a > 0 ? -1 : 1)) * 0.5 : 0;
    const k = limb(0, -95, 48, a, 17, col); const f = limb(k[0], k[1], 46, a - bend, 15, col);
    RR(f[0] - 9, f[1] - 4, 26, 11, 5, '#F4F4F4'); RR(f[0] - 9, f[1] + 4, 26, 4, 2, '#E63946');
  };
  leg(-sw, JEANS_D); leg(sw, JEANS);
  // inclinação do tronco
  const lean = o.carry ? 0.22 : run ? 0.1 : 0;
  ctx.translate(0, -95); ctx.rotate(lean); ctx.translate(0, 95);
  const arm = (a1, a2, col, sk) => {
    const e = limb(0, -164, 36, a1, 13, sk); limb(0, -164, 17, a1, 16, col);
    const h = limb(e[0], e[1], 33, a2, 11, sk); C(h[0], h[1], 7, sk); return h;
  };
  // braço de trás
  if (o.carry) arm(-0.9, -1.7, SHIRT_D, SK_D); else arm(-sw * 0.9, -sw * 0.9 + (run ? 1.1 : 0.15), SHIRT_D, SK_D);
  // tronco
  RR(-21, -176, 42, 86, 15, SHIRT); ctx.strokeStyle = '#C9CDD8'; ctx.lineWidth = 2; ctx.stroke();   // camiseta branca
  L(-6, -170, 6, -166, 3, '#C9CDD8');
  RR(-21, -102, 42, 12, 5, JEANS); RR(-4, -100, 8, 6, 2, '#C9A227');
  // cabeça (loiro, olhos azuis, sem barba)
  RR(-3, -186, 14, 14, 4, SK);
  C(6, -200, 23, SK);
  ctx.fillStyle = HAIR; ctx.beginPath(); ctx.arc(5, -203, 24, Math.PI * 0.95, Math.PI * 2.02); ctx.fill();
  C(-12, -204, 13, HAIR); C(-6, -198, 6, SK_D);
  for (const [hx2, hy2] of [[0, -224], [12, -225], [22, -220]]) C(hx2, hy2, 6, HAIR);
  arcS(4, -212, 12, 3.6, 4.9, 3, HAIR_HI);
  eye(13, -202, 4.6, '#3D8BD9', false); eye(24, -202, 4.6, '#3D8BD9', false);
  L(9, -211, 16, -212, 2.5, '#C9A040'); L(21, -212, 28, -210, 2.5, '#C9A040');
  E(29, -194, 4, 5, SK_D);
  if (o.yell) { E(21, -184, 6, 5.5, '#7a2a20'); E(21, -182, 4, 2, '#e57373'); }
  else arcS(20, -189, 7, 0.15 * Math.PI, 0.85 * Math.PI, 2.6, '#7a2a20');
  // braço da frente
  if (o.stick) {
    const a1 = 2.5 + Math.sin(G.t * 9) * 0.25;
    const h = arm(a1, a1 + 0.3, SHIRT, SK);
    const sa = 2.7 + Math.sin(G.t * 14) * 0.45;
    L(h[0] - Math.sin(sa) * 18, h[1] - Math.cos(sa) * 18, h[0] + Math.sin(sa) * 105, h[1] + Math.cos(sa) * 105, 9, '#8B5A2B');
    L(h[0] + Math.sin(sa) * 30, h[1] + Math.cos(sa) * 30, h[0] + Math.sin(sa) * 95, h[1] + Math.cos(sa) * 95, 2.5, '#A8743F');
    C(h[0], h[1], 7, SK);
  } else if (o.carry) arm(-0.5, -1.5, SHIRT, SK);
  else if (o.wave) arm(2.6 + Math.sin(G.t * 10) * 0.3, 2.9 + Math.sin(G.t * 10) * 0.4, SHIRT, SK);
  else arm(sw * 0.9, sw * 0.9 + (run ? 1.1 : 0.15), SHIRT, SK);
  ctx.restore();
}

// Ana: irmã mais velha, de patins
function drawAna(x, y, face, o, part) {
  const SK = '#DDAA85', SK_D = '#C48E66', HAIR = '#141418', HAIR_HI = '#3A3A48', SHIRT = '#8E5BD6', SHIRT_D = '#7346B8', LEGS = '#2B2D42', HELM = '#FF6FA8';
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  const t = o.anim || 0, sk = o.skate ? Math.sin(t) * 0.4 : 0;
  const lean = o.skate ? 0.16 : 0;
  if (part !== 'arm') {
    const skate = (ex, ey) => {
      RR(ex - 10, ey - 6, 26, 14, 5, '#fff'); RR(ex - 10, ey + 2, 26, 4, 2, '#8E5BD6');
      for (const wx of [-6, 1, 8, 15]) C(ex + wx, ey + 11, 3.6, '#FFD60A');
    };
    const leg = (a, col) => { const k = limb(0, -82, 38, a, 13, col); const f = limb(k[0], k[1], 34, a * 0.6, 12, col); skate(f[0], f[1] - 6); };
    leg(-sk - 0.1, '#1E2030'); leg(sk + 0.1, LEGS);
    ctx.translate(0, -82); ctx.rotate(lean); ctx.translate(0, 82);
    // rabo de cavalo bem ondulado, preto, ao vento
    for (let i = 0; i < 8; i++) {
      const k = i / 7, px = -14 - k * (40 + (o.skate ? 12 : 0)), py = -170 + k * 40 + Math.sin(G.t * 10 - i * 0.9) * 3;
      const wob = Math.sin(i * 1.7) * 5;
      C(px, py + wob, 11 - k * 5, HAIR);
      arcS(px - 1, py + wob - 2, 6 - k * 3, 3.4, 5.2, 2, HAIR_HI);
    }
    // braço de trás
    const b = limb(0, -136, 30, o.carry ? 0.9 : -0.6 - sk, 10, SK_D); limb(b[0], b[1], 26, o.carry ? 1.7 : -0.2, 9, SK_D);
    // tronco + saia
    RR(-17, -142, 34, 60, 12, SHIRT);
    poly([-18, -92, 18, -92, 24, -72, -24, -72], '#FF8FB8');
    star(0, -118, 8, '#FFD60A');
    // cabeça
    RR(-3, -152, 12, 12, 4, SK);
    C(5, -166, 20, SK);
    for (const [wx2, wy2, r2] of [[-10, -168, 10], [-12, -156, 8], [-6, -150, 7]]) C(wx2, wy2, r2, HAIR);
    ctx.fillStyle = HELM; ctx.beginPath(); ctx.arc(4, -170, 23, Math.PI * 1.02, Math.PI * 2.02); ctx.fill();
    RR(-19, -172, 46, 6, 3, '#E0558E'); L(2, -168, 5, -150, 2, '#E0558E');
    E(-2, -183, 7, 3, 'rgba(255,255,255,.6)');
    C(10, -167, 4.5, HAIR); C(17, -168, 4, HAIR); C(24, -166, 3.5, HAIR);   // franja ondulada
    eye(11, -162, 4.6, '#5A3418', false); eye(21, -162, 4.6, '#5A3418', false);
    C(8, -153, 3.5, 'rgba(255,110,130,.4)'); C(25, -154, 3, 'rgba(255,110,130,.4)');
    arcS(18, -152, 5, 0.1 * Math.PI, 0.9 * Math.PI, 2.2, '#8a3a2a');
  } else {
    ctx.translate(0, -82); ctx.rotate(lean); ctx.translate(0, 82);
  }
  if (part !== 'body') {
    const a1 = o.carry ? 0.75 : o.wave ? 2.6 + Math.sin(G.t * 10) * 0.3 : 0.5 + sk;
    const a2 = o.carry ? 1.95 : o.wave ? 2.9 : 0.9 + sk;
    const e = limb(4, -136, 30, a1, 11, SK); limb(4, -136, 13, a1, 14, SHIRT_D);
    const h = limb(e[0], e[1], 27, a2, 10, SK); C(h[0], h[1], 6, SK);
  }
  ctx.restore();
}

// Layla: cachorra preta com tracinhos dourados na boca
function drawLayla(x, y, face, o) {
  const BK = '#1E1E24', BK2 = '#33333E', GOLD = '#D9A441';
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  const t = o.anim || 0, run = o.run, sw = run ? Math.sin(t) * 0.75 : 0;
  ctx.translate(0, run ? -Math.abs(Math.cos(t)) * 6 : 0);
  // rabo abanando
  ctx.save(); ctx.translate(-34, -60); ctx.rotate(-0.9 + Math.sin(G.t * 18) * 0.4); RR(-4, -30, 8, 32, 4, BK); ctx.restore();
  // patas de trás (longe)
  const paw = (e, c) => E(e[0] + 4, e[1], 7, 4, c);
  paw(limb(-24, -44, 40, -sw, 10, BK2), BK2); paw(limb(22, -44, 40, sw, 10, BK2), BK2);
  // corpo
  E(0, -54, 38, 19, BK); E(4, -46, 26, 9, BK2);
  // patas da frente (perto)
  paw(limb(-20, -44, 40, sw, 11, BK), BK); paw(limb(26, -44, 40, -sw, 11, BK), BK);
  // coleira
  RR(26, -76, 11, 18, 4, RED); C(33, -58, 3.5, '#FFD60A');
  // cabeça
  C(42, -80, 18, BK);
  E(31, -82, 7, 15, BK2, 0.5);                       // orelha caída
  E(58, -73, 15, 9.5, BK);                           // focinho
  C(44, -91, 2.6, GOLD);                             // sobrancelha dourada
  // tracinhos dourados na boca
  L(48, -68, 61, -66, 2.4, GOLD); L(50, -64, 59, -63, 2.2, GOLD); L(62, -70, 66, -68, 2, GOLD);
  C(71, -76, 5, '#000'); C(70, -78, 1.6, '#666');   // nariz
  C(47, -83, 5, '#F5E6C8'); C(48, -83, 3.6, '#3A2A1A'); C(49, -84.5, 1.4, '#fff');
  if (o.bark && Math.sin(G.t * 22) > 0) { E(60, -63, 9, 5, '#7A2A2A'); E(60, -61, 5, 2.5, '#FF8FA3'); }
  ctx.restore();
}

// Lobo Mau (cartunesco, nada assustador)
function drawWolf(W) {
  const FUR = '#7D8597', FUR_D = '#5C6374', BELLY = '#D5D9E2';
  const st = W.state, run = st === 'flee' || st === 'enter' || st === 'leave' || (st === 'block' && W.moving);
  const t = W.walk, sw = run ? Math.sin(t) * (st === 'flee' ? 0.9 : 0.5) : 0;
  shadow(W.x, 40);
  ctx.save(); ctx.translate(W.x, W.y); ctx.scale(W.face, 1);
  if (st === 'dizzy') { ctx.translate(0, -60); ctx.rotate(Math.sin(G.t * 6) * 0.12); ctx.translate(0, 60); }
  ctx.translate(0, run ? -Math.abs(Math.cos(t)) * 5 : 0);
  // rabo
  ctx.save(); ctx.translate(-26, -78); ctx.rotate(-0.9 + Math.sin(G.t * (st === 'block' ? 6 : 12)) * 0.3);
  E(0, -26, 13, 30, FUR_D); E(0, -46, 8, 10, BELLY); ctx.restore();
  // pernas
  const leg = (a, col) => { const k = limb(0, -70, 34, a, 15, col); const f = limb(k[0], k[1], 34, a - 0.35, 13, col); E(f[0] + 7, f[1] + 2, 14, 7, col); };
  leg(-sw, FUR_D); leg(sw, FUR);
  // braço de trás
  const reach = st === 'grab', flail = st === 'flee';
  limb(-4, -128, 46, reach ? 1.9 : flail ? 2.6 + Math.sin(G.t * 20) * 0.4 : 0.6 - sw * 0.5, 12, FUR_D);
  // corpo
  E(0, -104, 30, 42, FUR); E(8, -100, 18, 30, BELLY);
  poly([-28, -84, 28, -84, 30, -62, -30, -62], '#6A4C93');      // bermuda
  // cabeça
  const hx = 14, hy = -160;
  poly([hx - 16, hy - 14, hx - 22, hy - 48, hx - 2, hy - 22], FUR_D);
  poly([hx + 2, hy - 20, hx + 4, hy - 52, hx + 18, hy - 18], FUR);
  poly([hx + 5, hy - 22, hx + 6, hy - 42, hx + 13, hy - 21], '#E8A0A8');
  C(hx, hy, 27, FUR);
  E(hx + 30, hy + 8, 26, 13, FUR); E(hx + 30, hy + 14, 22, 7, BELLY);
  C(hx + 56, hy + 3, 7.5, '#222'); C(hx + 54, hy + 1, 2.2, '#777');
  // olhos
  if (st === 'dizzy') {
    for (const ex of [hx + 2, hx + 17]) { ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); for (let a = 0; a < 12; a += 0.4) { const r = a * 0.6; ctx.lineTo(ex + Math.cos(a + G.t * 8) * r, hy - 6 + Math.sin(a + G.t * 8) * r); } ctx.stroke(); }
  } else if (st === 'flee' || st === 'grab') {
    E(hx + 2, hy - 7, 7, 9, '#fff'); E(hx + 18, hy - 7, 7, 9, '#fff'); C(hx + 4, hy - 6, 3.2, '#222'); C(hx + 20, hy - 6, 3.2, '#222');
  } else {
    E(hx + 2, hy - 6, 6.5, 7, '#FFF6C8'); E(hx + 18, hy - 6, 6.5, 7, '#FFF6C8');
    C(hx + 5, hy - 5, 3, '#222'); C(hx + 21, hy - 5, 3, '#222');
    // sobrancelhas de "malandro"
    L(hx - 5, hy - 17, hx + 8, hy - 12, 3.5, FUR_D); L(hx + 12, hy - 12, hx + 25, hy - 17, 3.5, FUR_D);
  }
  // boca
  if (st === 'flee' || st === 'grab') { E(hx + 30, hy + 20, 9, 7, '#5a1f2a'); E(hx + 30, hy + 23, 6, 3, '#E57373'); }
  else if (st === 'dizzy') arcS(hx + 30, hy + 24, 7, 1.15 * Math.PI, 1.85 * Math.PI, 2.5, '#333');
  else { arcS(hx + 28, hy + 12, 14, 0.1 * Math.PI, 0.7 * Math.PI, 2.5, '#333'); poly([hx + 32, hy + 24, hx + 37, hy + 24, hx + 34.5, hy + 30], '#fff'); }
  if (st === 'flee') { E(hx - 14, hy - 20, 3, 5, '#7EC8F5'); E(hx - 20, hy - 6, 2.5, 4, '#7EC8F5'); }
  // braço da frente
  const fa = reach ? 1.7 : flail ? 2.4 + Math.sin(G.t * 20 + 1) * 0.5 : st === 'block' ? 1.1 + Math.sin(G.t * 5) * 0.15 : 0.4 + sw * 0.5;
  const h = limb(4, -128, 46, fa, 12, FUR); C(h[0], h[1], 8, FUR);
  ctx.restore();
  // estrelinhas de tontura
  if (st === 'dizzy') for (let i = 0; i < 3; i++) { const a = G.t * 4 + i * TAU / 3; star(W.x + Math.cos(a) * 34 + W.face * 12, W.y - 205 + Math.sin(a) * 9, 9, '#FFD60A', G.t * 3); }
}

// Vovó Marisa, a Vovó Querida
function drawVovo(x, y, face, o) {
  const SK = '#F0C8A8', SK_D = '#D9A989', HAIR = '#E4E4EE', HAIR_D = '#C4C4D2', DRESS = '#B07CC6';
  shadow(x, 30);
  ctx.save(); ctx.translate(x, y); ctx.scale(face, 1);
  L(-8, -36, -8, -6, 10, SK_D); L(8, -36, 8, -6, 10, SK);
  RR(-16, -8, 18, 9, 4, '#6A3D9A'); RR(0, -8, 18, 9, 4, '#6A3D9A');
  limb(-2, -112, 46, -0.3, 11, SK_D);
  poly([-20, -122, 20, -122, 32, -30, -32, -30], DRESS);
  poly([-8, -104, 18, -104, 24, -36, -12, -36], '#FFFDF6');
  heart(6, -72, 8, '#FF7AA2');
  C(4, -142, 22, SK);
  for (const [cx, cy, r] of [[-14, -150, 10], [-6, -160, 10], [6, -163, 10], [17, -156, 9], [-18, -138, 8]]) C(cx, cy, r, HAIR);
  C(-20, -166, 12, HAIR); arcS(-20, -166, 7, 0, 4, 2, HAIR_D);           // coque
  arcS(8, -158, 5, 3.4, 5.8, 2, HAIR_D);
  // óculos
  ctx.strokeStyle = '#7B4B94'; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(9, -142, 6.5, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(23, -142, 6.5, 0, TAU); ctx.stroke(); L(15.5, -142, 16.5, -142, 2, '#7B4B94');
  eye(9, -142, 3.6, '#5a3a20', o.happy); eye(23, -142, 3.6, '#5a3a20', o.happy);
  C(6, -131, 4, 'rgba(255,110,130,.4)'); C(26, -131, 3.5, 'rgba(255,110,130,.4)');
  E(27, -136, 3, 4, SK_D);
  arcS(17, -130, 6, 0.15 * Math.PI, 0.85 * Math.PI, 2.4, '#8a3a2a');
  const wa = o.wave ? 2.6 + Math.sin(G.t * 8) * 0.35 : 0.4;
  const e = limb(4, -112, 26, wa, 11, SK); const h = limb(e[0], e[1], 24, wa + (o.wave ? 0.3 : 0.5), 10, SK); C(h[0], h[1], 6, SK);
  limb(4, -112, 12, wa, 14, DRESS);
  ctx.restore();
}

// Morango
function drawBerry(x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  C(0, 0, 21, 'rgba(255,255,255,.28)');
  ctx.fillStyle = RED; ctx.beginPath(); ctx.moveTo(0, 16);
  ctx.bezierCurveTo(-17, 8, -16, -11, -8, -11); ctx.bezierCurveTo(-3, -12, 3, -12, 8, -11);
  ctx.bezierCurveTo(16, -11, 17, 8, 0, 16); ctx.fill();
  E(-6, -3, 3, 5.5, 'rgba(255,255,255,.45)', -0.4);
  for (const [sx, sy] of [[-6, 4], [0, -3], [6, 3], [0, 9], [-8, -5], [8, -5], [3, 4]]) E(sx, sy, 1.2, 1.8, '#FFE08A');
  for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; E(Math.cos(a) * 7, -12 + Math.sin(a) * 3 + 2, 6, 3, '#2FA84F', a); }
  L(0, -13, 2, -19, 2.5, '#2A8A44');
  ctx.restore();
}

// ---------- Cenário ----------
const DECOR = { far: [], mid: [], near: [] };
const TYPES = {
  far:  { city: ['bld'], park: ['hill'], field: ['hill', 'hill', 'mill'], forest: ['pine', 'pine', 'hill'], meadow: ['hill'] },
  mid:  { city: ['shop', 'shop', 'shop', 'tree'], park: ['tree', 'tree', 'tree2'], field: ['tree', 'hay', 'hay', 'tree2'], forest: ['pine', 'pine', 'tree2'], meadow: ['blossom', 'tree', 'blossom'] },
  near: { city: ['lamp', 'bench', 'planter', 'hydrant', 'pot', 'lamp'], park: ['bush', 'flowers', 'bench', 'bush', 'flowers'], field: ['fence', 'sunflower', 'flowers', 'rock', 'fence'], forest: ['mushroom', 'log', 'fern', 'mushroom', 'fern', 'stump'], meadow: ['flowers', 'bush', 'flowers', 'butterfly'] },
};
const P_LAYER = { far: 0.22, mid: 0.5, near: 1 };
function genDecor() {
  const r = mulberry32(7);
  const gaps = { far: [150, 260], mid: [170, 300], near: [110, 240] };
  for (const layer of ['far', 'mid', 'near']) {
    const p = P_LAYER[layer]; let lx = -300; const end = LEVEL_END * p + 2200;
    while (lx < end) {
      const wx = (lx - 640) / p + 640;
      const b = BIOMES[biomeIdx(wx)].n, k = r();
      const near = layer === 'near';
      if (!(near && (wx > HOUSE_X - 330 || SIGNS.some(s => Math.abs(s - wx) < 90))))
        DECOR[layer].push({ lx, b, type: TYPES[layer][b][Math.floor(k * TYPES[layer][b].length)], s: 0.8 + r() * 0.45, v: r(), c: Math.floor(r() * 7) });
      lx += gaps[layer][0] + r() * (gaps[layer][1] - gaps[layer][0]);
    }
  }
}
const HOUSE_COLORS = ['#F4A261', '#E9C46A', '#90BE6D', '#F28482', '#84A59D', '#A2D2FF', '#CDB4DB'];
const FLOWER_COLORS = ['#FF6FA8', '#FFD60A', '#FFFFFF', '#B07CC6', '#FF8C42', '#7EC8F5', '#E63946'];

function roundTree(h, c1, c2, blossom) {
  RR(-8, -h, 16, h, 5, '#8B5A2B');
  C(0, -h - 30, 46, c1); C(-34, -h - 6, 34, c1); C(34, -h - 8, 34, c1); C(10, -h - 44, 30, c2); C(-18, -h - 26, 22, c2);
  if (blossom) for (let i = 0; i < 9; i++) C(Math.cos(i * 2.3) * 40, -h - 20 + Math.sin(i * 1.7) * 30, 5, '#FFFFFF');
}
function pine(h, c1, c2) {
  RR(-7, -26, 14, 26, 3, '#6B4429');
  for (let i = 0; i < 3; i++) { const w = 62 - i * 14, y = -20 - i * (h / 4); poly([-w, y, 0, y - h / 2.2, w, y], i % 2 ? c2 : c1); }
}
function flowerAt(x, h, c) { L(x, 0, x, -h, 2.5, '#3E8E41'); for (let i = 0; i < 5; i++) C(x + Math.cos(i * TAU / 5) * 5, -h + Math.sin(i * TAU / 5) * 5, 4.5, c); C(x, -h, 3.5, '#FFD60A'); }

function drawDecor(d, layer) {
  const v = d.v, col = HOUSE_COLORS[d.c];
  if (layer === 'far') {
    const c = PAL[d.b].far;
    switch (d.type) {
      case 'bld': {
        const w = 80 + v * 80, h = 170 + (d.c / 7) * 170; RR(-w / 2, -h, w, h, 6, c);
        for (let y = -h + 18; y < -20; y += 28) for (let x = -w / 2 + 12; x < w / 2 - 16; x += 22) RR(x, y, 12, 14, 2, 'rgba(255,255,255,.35)');
        break;
      }
      case 'hill': E(0, 20, 230, 140 + v * 50, c); break;
      case 'mill': E(0, 20, 200, 120, c); RR(-12, -190, 24, 90, 4, '#E8E4D8'); poly([-16, -190, 0, -214, 16, -190], '#C0392B');
        ctx.save(); ctx.translate(0, -195); ctx.rotate(G.t * 0.8); for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 2); RR(-4, 0, 8, 60, 3, '#FFFDF6'); } ctx.restore(); break;
      case 'pine': pine(220 + v * 120, c, c); break;
    }
  } else if (layer === 'mid') {
    switch (d.type) {
      case 'shop': {
        const w = 130 + v * 60, h = 150 + (d.c / 7) * 120;
        RR(-w / 2, -h, w, h, 8, col); RR(-w / 2 - 6, -h - 10, w + 12, 14, 4, 'rgba(0,0,0,.15)');
        for (let y = -h + 20; y < -70; y += 40) for (let x = -w / 2 + 16; x < w / 2 - 30; x += 40) { RR(x, y, 26, 26, 4, '#E8F6FF'); L(x + 13, y, x + 13, y + 26, 2, col); }
        RR(-16, -58, 32, 58, 6, '#6D4C41');
        for (let i = 0; i < 6; i++) poly([-w / 2 + i * w / 6, -72, -w / 2 + (i + 1) * w / 6, -72, -w / 2 + (i + 0.5) * w / 6, -60], i % 2 ? '#fff' : '#E63946');
        RR(-w / 2, -76, w, 6, 2, i2c(d.c));
        break;
      }
      case 'tree': roundTree(80, d.b === 'forest' ? '#3F8F4F' : '#5DB85A', d.b === 'forest' ? '#4FA060' : '#76CC6A'); break;
      case 'tree2': roundTree(60, '#4CA64A', '#6CC25A'); C(-20, -110, 6, RED); C(14, -96, 6, RED); C(26, -126, 6, RED); break;
      case 'blossom': roundTree(70, '#F7A1C4', '#FBC4DA', true); break;
      case 'hay': E(0, -34, 52, 38, '#E9C46A'); for (let i = -30; i <= 30; i += 15) arcS(i, -10, 30, 3.6, 4.6, 2, '#D4A84B'); break;
      case 'pine': pine(200 + v * 90, '#2D6A4F', '#40916C'); break;
    }
  } else {
    switch (d.type) {
      case 'lamp': L(0, 0, 0, -170, 7, '#3D405B'); L(0, -170, 18, -178, 6, '#3D405B'); C(22, -174, 22, 'rgba(255,232,163,.35)'); C(22, -174, 11, '#FFE8A3'); break;
      case 'bench': RR(-46, -36, 92, 9, 4, '#C17F45'); RR(-46, -62, 92, 9, 4, '#C17F45'); L(-38, -27, -38, 0, 5, '#3D405B'); L(38, -27, 38, 0, 5, '#3D405B'); L(-38, -62, -38, -36, 4, '#3D405B'); L(38, -62, 38, -36, 4, '#3D405B'); break;
      case 'planter': RR(-30, -36, 60, 36, 6, '#B08968'); roundTree(30, '#5DB85A', '#76CC6A'); break;
      case 'hydrant': RR(-12, -46, 24, 46, 6, RED); RR(-17, -40, 34, 8, 4, RED_D); C(0, -48, 12, RED); break;
      case 'pot': RR(-20, -30, 40, 30, 6, '#E07A5F'); for (let i = -1; i <= 1; i++) flowerAt(i * 10, 46 + Math.abs(i) * -8, FLOWER_COLORS[(d.c + i + 7) % 7]); RR(-20, -30, 40, 30, 6, '#E07A5F'); break;
      case 'bush': C(-30, -22, 28, '#4CA64A'); C(30, -22, 28, '#4CA64A'); C(0, -38, 34, '#5DB85A'); for (let i = 0; i < 5; i++) C(-34 + i * 17, -30 - (i % 2) * 18, 4, FLOWER_COLORS[(d.c + i) % 7]); break;
      case 'flowers': for (let i = 0; i < 6; i++) flowerAt(-50 + i * 20, 28 + hash(d.lx + i) * 26, FLOWER_COLORS[(d.c + i) % 7]); break;
      case 'fence': for (let x = -80; x <= 80; x += 40) RR(x - 5, -60, 10, 60, 3, '#C8A26B'); RR(-86, -48, 172, 8, 3, '#D9B67E'); RR(-86, -26, 172, 8, 3, '#D9B67E'); break;
      case 'sunflower': for (const [x, h] of [[-20, 120], [16, 140]]) { L(x, 0, x, -h, 5, '#3E8E41'); E(x + 10, -h * 0.5, 14, 6, '#3E8E41', -0.4); for (let i = 0; i < 12; i++) E(x + Math.cos(i * TAU / 12) * 16, -h + Math.sin(i * TAU / 12) * 16, 9, 4.5, '#FFD60A', i * TAU / 12); C(x, -h, 11, '#7B4B2A'); } break;
      case 'rock': E(0, -16, 38, 22, '#A8A8B0'); E(-8, -24, 16, 8, '#C4C4CC'); break;
      case 'mushroom': for (const [x, s] of [[-14, 1], [18, 0.7]]) { RR(x - 7 * s, -32 * s, 14 * s, 32 * s, 5, '#FFF6E8'); ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x, -30 * s, 24 * s, Math.PI, 0); ctx.fill(); C(x - 9 * s, -40 * s, 4 * s, '#fff'); C(x + 8 * s, -44 * s, 3.5 * s, '#fff'); C(x, -34 * s, 3 * s, '#fff'); } break;
      case 'log': RR(-70, -36, 140, 36, 18, '#8B5A2B'); E(66, -18, 14, 18, '#C68642'); arcS(66, -18, 8, 0, TAU, 2, '#8B5A2B'); E(-20, -36, 16, 5, '#5DB85A'); break;
      case 'fern': for (let i = -3; i <= 3; i++) { ctx.save(); ctx.rotate(i * 0.32); E(0, -40, 9, 40, i % 2 ? '#3E8E41' : '#4CA64A'); ctx.restore(); } break;
      case 'stump': RR(-28, -40, 56, 40, 6, '#8B5A2B'); E(0, -40, 28, 9, '#C68642'); arcS(0, -40, 14, 0, TAU, 2, '#A0652E'); break;
      case 'butterfly': {
        for (let i = 0; i < 3; i++) flowerAt(-30 + i * 30, 30 + i * 6, FLOWER_COLORS[(d.c + i) % 7]);
        const bx = Math.sin(G.t * 1.3 + d.lx) * 40, by = -90 + Math.cos(G.t * 1.9 + d.lx) * 25, f = Math.abs(Math.sin(G.t * 14));
        E(bx - 6 * f, by, 8 * f + 1, 10, '#FF8FB8'); E(bx + 6 * f, by, 8 * f + 1, 10, '#FFB3D1'); L(bx, by - 6, bx, by + 6, 3, '#4A2A18');
        break;
      }
    }
  }
}
function i2c(i) { return ['#E63946', '#2A9D8F', '#8E5BD6', '#F4A261', '#457B9D', '#FF6FA8', '#2FA84F'][i]; }

function drawSign(x) {
  RR(x - 5, GY - 120, 10, 100, 3, '#8B5A2B');
  RR(x - 64, GY - 136, 128, 40, 8, '#C68642'); RR(x - 60, GY - 132, 120, 32, 6, '#F1D19A');
  poly([x + 64, GY - 136, x + 82, GY - 116, x + 64, GY - 96], '#C68642');
  heart(x - 44, GY - 117, 7, RED);
  ctx.fillStyle = '#6B3A12'; ctx.font = '800 17px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Vovó ➜', x + 6, GY - 115);
}

function drawHouse() {
  const hx = HOUSE_X - 120, base = GY - 18;
  // fumaça da chaminé
  for (let i = 0; i < 4; i++) { const p = (G.t * 0.35 + i / 4) % 1; C(hx + 268 + Math.sin(p * 6 + i) * 10, base - 300 - p * 120, 12 + p * 18, `rgba(255,255,255,${0.7 - p * 0.7})`); }
  RR(hx + 250, base - 300, 38, 90, 4, '#B5543C');
  poly([hx - 34, base - 214, hx + 180, base - 340, hx + 394, base - 214], '#C0392B');
  for (let i = 1; i < 4; i++) L(hx - 34 + i * 30, base - 214 - i * 17.5, hx + 394 - i * 30, base - 214 - i * 17.5, 3, '#A93226');
  RR(hx, base - 216, 360, 216, 8, '#FFF1D6');
  RR(hx, base - 22, 360, 22, 4, '#E8D3B0');
  // porta
  const dx = HOUSE_X + 30;
  RR(dx - 38, base - 140, 76, 140, 30, '#8E5A3C'); RR(dx - 30, base - 130, 60, 130, 24, '#A86B48'); C(dx + 18, base - 66, 5, '#FFD60A');
  heart(dx, base - 104, 10, '#FF7AA2');
  // janelas
  for (const wx of [hx + 30, hx + 270]) {
    RR(wx, base - 170, 64, 60, 6, '#8E5A3C'); RR(wx + 5, base - 165, 54, 50, 4, '#BDE6FF');
    L(wx + 32, base - 165, wx + 32, base - 115, 4, '#8E5A3C'); L(wx + 5, base - 140, wx + 59, base - 140, 4, '#8E5A3C');
    RR(wx - 4, base - 112, 72, 14, 4, '#7B4B2A');
    for (let i = 0; i < 5; i++) C(wx + 6 + i * 13, base - 114, 7, FLOWER_COLORS[i]);
  }
  // placa
  RR(dx - 98, base - 262, 196, 40, 12, '#FFD6E0'); ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = RED_D; ctx.font = '800 22px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('♥ Vovó Querida ♥', dx, base - 241);
  // cerquinha e flores
  for (let x = hx + 380; x < hx + 520; x += 26) RR(x, base - 46, 10, 46, 4, '#FFFDF6');
  RR(hx + 376, base - 36, 150, 8, 3, '#FFFDF6');
  for (let i = 0; i < 8; i++) { ctx.save(); ctx.translate(hx - 120 + i * 14, base + 4); flowerAt(0, 26 + (i % 3) * 8, FLOWER_COLORS[i % 7]); ctx.restore(); }
}

function drawGround() {
  const cam = G.cam, step = 24;
  for (let sx = -((cam % step + step) % step); sx < VW + step; sx += step) {
    const wx = cam + sx;
    ctx.fillStyle = pal(wx, 'grass'); ctx.fillRect(sx, GY - 30, step + 1, 18);
    ctx.fillStyle = pal(wx, 'path'); ctx.fillRect(sx, GY - 14, step + 1, 56);
    ctx.fillStyle = pal(wx, 'soil'); ctx.fillRect(sx, GY + 42, step + 1, VH - GY - 42);
    // folhinhas de grama
    ctx.fillStyle = pal(wx, 'grass');
    for (let i = 0; i < 3; i++) { const bx = sx + i * 8, h = 6 + hash(Math.floor(wx / 8) + i) * 10; ctx.beginPath(); ctx.moveTo(bx, GY - 29); ctx.lineTo(bx + 4, GY - 29 - h); ctx.lineTo(bx + 8, GY - 29); ctx.fill(); }
  }
  ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, GY - 14, VW, 4); ctx.fillRect(0, GY + 42, VW, 5);
  // pedrinhas / juntas da calçada
  const i0 = Math.floor(cam / 80), i1 = Math.floor((cam + VW) / 80) + 1;
  for (let i = i0; i <= i1; i++) {
    const wx = i * 80, sx = wx - cam;
    if (wx < BIOMES[0].x1) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(sx, GY - 10, 2, 50); }
    else { E(sx + hash(i) * 60, GY + 2 + hash(i + 9) * 34, 5 + hash(i + 3) * 4, 3, 'rgba(0,0,0,.1)'); }
    E(sx + hash(i + 5) * 70, GY + 60 + hash(i + 7) * 40, 8, 4, 'rgba(0,0,0,.1)');
  }
}

function drawSky() {
  const mid = G.cam + VW / 2;
  const g = ctx.createLinearGradient(0, 0, 0, GY);
  g.addColorStop(0, pal(mid, 'top')); g.addColorStop(1, pal(mid, 'bot'));
  ctx.fillStyle = g; ctx.fillRect(0, TOP, VW, VH);
  // sol
  const sx = VW * 0.62, sy = TOP + 110;
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(G.t * 0.2);
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); RR(-4, 52, 8, 22, 4, 'rgba(255,214,10,.55)'); }
  ctx.restore(); C(sx, sy, 48, '#FFE08A'); C(sx, sy, 40, '#FFD60A');
  // nuvens
  for (let i = 0; i < 7; i++) {
    const span = VW + 500, cx = ((i * 420 - G.cam * 0.08 + G.t * 10) % span + span) % span - 250, cy = TOP + 60 + hash(i) * 140, s = 0.7 + hash(i + 4) * 0.6;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    C(-40, 8, 28, '#fff'); C(0, -6, 38, '#fff'); C(42, 8, 28, '#fff'); RR(-66, 6, 132, 30, 15, '#fff');
    ctx.restore();
  }
}

// ---------- Áudio ----------
let AC = null, master = null, musicGain = null, soundOn = true, musicTimer = null, battleMusic = false;
function initAudio() {
  if (AC) { AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = soundOn ? 0.7 : 0; master.connect(AC.destination);
    musicGain = AC.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
    startMusic();
  } catch (e) { AC = null; }
}
function tone(f, dur, type = 'sine', vol = 0.3, when = 0, slide = 0, dest) {
  if (!AC) return;
  const t0 = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest || master); o.start(t0); o.stop(t0 + dur + 0.05);
}
const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
function sfx(n) {
  switch (n) {
    case 'collect': tone(988, 0.08, 'square', 0.08); tone(1480, 0.14, 'square', 0.08, 0.07); break;
    case 'jump': tone(380, 0.2, 'triangle', 0.25, 0, 2); break;
    case 'power': [72, 76, 79, 84].forEach((m, i) => tone(mf(m), 0.14, 'triangle', 0.25, i * 0.08)); break;
    case 'bonk': tone(220, 0.3, 'sawtooth', 0.12, 0, 0.5); break;
    case 'wolf': tone(160, 0.6, 'sawtooth', 0.08, 0, 0.75); tone(240, 0.5, 'triangle', 0.1, 0.05, 0.6); break;
    case 'scared': tone(700, 0.45, 'square', 0.06, 0, 0.35); break;
    case 'boing': tone(260, 0.4, 'sine', 0.3, 0, 2.6); break;
    case 'whoosh': tone(500, 0.35, 'triangle', 0.12, 0, 2.2); break;
    case 'bark': tone(620, 0.09, 'square', 0.12, 0, 0.55); tone(480, 0.12, 'sawtooth', 0.08, 0.02, 0.6); break;
    case 'growl': tone(90, 0.9, 'sawtooth', 0.1, 0, 0.8); tone(70, 0.9, 'square', 0.05, 0.05, 0.9); break;
    case 'battle': [55, 58, 62, 67].forEach((m, i) => tone(mf(m), 0.16, 'square', 0.12, i * 0.07)); tone(mf(43), 0.6, 'sawtooth', 0.1, 0.3); break;
    case 'win': [72, 76, 79, 84, 79, 84, 88].forEach((m, i) => tone(mf(m), 0.22, 'triangle', 0.25, i * 0.13)); break;
  }
}
function startMusic() {
  const mel = [76, 79, 81, 79, 76, 72, 74, 76, 79, 76, 74, 72, 74, 0, 0, 0, 76, 79, 81, 84, 83, 81, 79, 76, 77, 76, 74, 76, 72, 0, 0, 0];
  const bass = [48, 45, 41, 43];
  const bMel = [69, 72, 76, 72, 69, 72, 76, 79, 77, 74, 77, 81, 76, 72, 71, 68];
  const step = 60 / 132 / 2; let i = 0, bi = 0, next = AC.currentTime + 0.1;
  musicTimer = setInterval(() => {
    if (!AC) return;
    while (next < AC.currentTime + 0.25) {
      const when = next - AC.currentTime;
      if (battleMusic) {
        // levada de batalha estilo RPG
        tone(mf(bMel[bi % 16]), step * 0.9, 'square', 0.09, when, 0, musicGain);
        if (bi % 2 === 0) tone(mf(bi % 8 < 4 ? 45 : 41), step * 1.8, 'triangle', 0.32, when, 0, musicGain);
        bi++; next += step * 0.8;
      } else {
        const m = mel[i % mel.length];
        if (m) tone(mf(m), step * 1.6, 'triangle', 0.18, when, 0, musicGain);
        if (i % 4 === 0) tone(mf(bass[Math.floor(i / 8) % 4]), step * 3, 'sine', 0.3, when, 0, musicGain);
        i++; next += step;
      }
    }
  }, 90);
}
function setSound(on) {
  soundOn = on; $('btnSound').textContent = on ? '🔊' : '🔈';
  if (master) master.gain.value = on ? 0.7 : 0;
  if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
  try { localStorage.setItem('cecilia-sound', on ? '1' : '0'); } catch (e) { }
}
// Voz (fala em português quando o aparelho suporta)
let voice = null;
function pickVoice() { try { const vs = speechSynthesis.getVoices(); voice = vs.find(v => /pt[-_]BR/i.test(v.lang)) || vs.find(v => /^pt/i.test(v.lang)) || null; } catch (e) { } }
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function say(text, pitch = 1.3, rate = 1) {
  if (!soundOn || !('speechSynthesis' in window)) return;
  try { const u = new SpeechSynthesisUtterance(text); u.lang = 'pt-BR'; if (voice) u.voice = voice; u.rate = rate; u.pitch = pitch; speechSynthesis.speak(u); } catch (e) { }
}
const PITCH = { cecilia: 1.9, dindo: 0.75, ana: 1.75, wolf: 0.05, vovo: 1.15 };
const sayWolf = (t) => say(t, PITCH.wolf, 0.78);   // voz bem grave e lenta

// ---------- Estado do jogo ----------
let G = null;
const VOVO = { x: HOUSE_X + 50, y: GY, bh: 190 };
function genBerries() {
  const b = [], r = mulberry32(42);
  for (let g = 0; g < 20; g++) {
    const x0 = 720 + g * 610, type = g % 4;
    for (let i = 0; i < 5; i++) {
      let y = GY - 30;
      if (type === 1) y -= Math.sin(i / 4 * Math.PI) * 140;
      else if (type === 2) y -= i * 32;
      else if (type === 3) y -= (i % 2) * 95;
      b.push({ x: x0 + i * 58, y, got: false, ph: r() * TAU });
    }
  }
  return b;
}
function newGame() {
  G = {
    t: 0, cam: 0, count: 0, berries: genBerries(), drops: [], parts: [], bubbles: [], helpers: [],
    wolf: null, wolfIdx: 0, scene: null, finished: false, menu: false, milestone: 0,
    P: { x: 480, y: GY, vx: 0, vy: 0, face: 1, ground: true, walk: 0, hurt: 0, knock: 0, mode: 'free', carried: false, moving: false, bh: 140 },
  };
  updateHud(true);
}

// ---------- Entrada ----------
const keys = {};
let joyX = 0, jumpQueued = false, running = false, paused = false;
addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (!running) { if (e.code === 'Enter' || e.code === 'Space') startGame(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (G.menu && !paused) {
    const n = { Digit1: 0, Numpad1: 0, Digit2: 1, Numpad2: 1, Digit3: 2, Numpad3: 2, Digit4: 3, Numpad4: 3 }[e.code];
    if (n !== undefined) choose(POWERS[n]);
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') selectOpt(menuSel - 1);
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') selectOpt(menuSel + 1);
    else if (e.code === 'Enter' || e.code === 'Space') choose(POWERS[menuSel]);
    return;
  }
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) jumpQueued = true;
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; joyX = 0; });
function axis() {
  let a = joyX;
  if (keys.ArrowLeft || keys.KeyA) a -= 1;
  if (keys.ArrowRight || keys.KeyD) a += 1;
  return clamp(a, -1, 1);
}
// joystick virtual
(() => {
  const joy = $('joy'), knob = $('knob'); let id = null, upFired = false;
  const move = (e) => {
    const r = joy.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const d = Math.hypot(dx, dy), max = R * 0.62;
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const nx = dx / max; joyX = Math.abs(nx) < 0.22 ? 0 : nx;
    if (dy / max < -0.7) { if (!upFired) { jumpQueued = true; upFired = true; } } else if (dy / max > -0.4) upFired = false;
  };
  joy.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; joy.setPointerCapture(id); move(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; joyX = 0; upFired = false; knob.style.transform = ''; };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
})();
$('jump').addEventListener('pointerdown', (e) => { e.preventDefault(); jumpQueued = true; });
document.querySelectorAll('.b-opt').forEach((b) => b.addEventListener('click', () => choose(b.dataset.power)));

// ---------- Menu de batalha (estilo RPG): o jogo congela e a criança escolhe ----------
const POWERS = ['stick', 'horse', 'ana', 'dog'];
let menuSel = 0;
function selectOpt(i) {
  menuSel = (i + POWERS.length) % POWERS.length;
  document.querySelectorAll('.b-opt').forEach((b, k) => b.classList.toggle('sel', k === menuSel));
}
function openMenu() {
  G.menu = true; battleMusic = true; joyX = 0;
  for (const k in keys) keys[k] = false;
  sfx('battle'); selectOpt(0);
  const el = $('battle'); el.classList.remove('hidden');
  const f = el.querySelector('.b-flash'); f.style.animation = 'none'; void f.offsetWidth; f.style.animation = '';
  $('controls').classList.add('hidden');
  say('Quem vai ajudar a Cecília?', PITCH.cecilia);
}
function choose(kind) {
  if (!G || !G.menu || paused) return;
  G.menu = false; battleMusic = false;
  $('battle').classList.add('hidden'); $('controls').classList.remove('hidden');
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  usePower(kind);
}

// ---------- Poderes e cenas ----------
function wolfThreat(W) { return W && (W.state === 'enter' || W.state === 'block' || W.state === 'grab'); }
function powerReady() { return running && !paused && G && !G.menu && !G.scene && !G.finished && wolfThreat(G.wolf); }
function usePower(kind) {
  if (!powerReady()) return;
  const P = G.P, W = G.wolf;
  if (W.state === 'grab') W.state = 'block';
  P.mode = 'scene'; P.knock = 0; P.vx = 0; P.face = 1;
  const hk = kind === 'ana' ? 'ana' : kind === 'dog' ? 'layla' : 'dindo';
  const h = { kind: hk, x: G.cam - 140, y: GY, face: 1, anim: 0, state: 'scene', bh: { ana: 205, layla: 125, dindo: 245 }[hk], barkT: 0 };
  G.helpers.push(h);
  G.scene = { type: kind, phase: 'come', t: 0, h };
  G.bubbles = [];
  sfx('power'); burst(P.x, P.y - 70, 'spark', 14);
  if (kind === 'stick') { bubble(h, 'Sai pra lá, Lobo! Vou te dar um pau!', 3); say('Sai pra lá, Lobo! Vou te dar um pau!', PITCH.dindo); }
  if (kind === 'dog') { bubble(h, 'Au! Au! Au!', 2.5); }
  if (kind === 'horse') { bubble(h, 'Sobe no cavalinho, Cecília!'); say('Sobe no cavalinho, Cecília!', PITCH.dindo); }
  if (kind === 'ana') { bubble(h, 'Segura firme, maninha!'); say('Segura firme, maninha!', PITCH.ana); }
}
function carrySeat(h) {
  // posição (pés) da Cecília quando está no colo/costas
  return h.kind === 'ana' ? { x: h.x + 36, y: h.y - 46 } : { x: h.x - 32, y: h.y - 98 };
}
function updateScene(dt) {
  const S = G.scene, P = G.P, W = G.wolf; S.t += dt;
  if (S.type === 'end') return updateEnd(dt);
  const h = S.h;
  if (S.type === 'stick' || S.type === 'dog') {
    const dog = S.type === 'dog';
    h.x += (dog ? 820 : 720) * dt; h.anim += dt * (dog ? 20 : 15);
    if (dog && (h.barkT -= dt) <= 0) { h.barkT = 0.32; sfx('bark'); }
    if (W && W.state !== 'flee' && h.x > W.x - 200) {
      W.state = 'flee'; W.t = 0; W.face = 1; bubble(W, 'Socorro! Socorro!'); sfx('scared'); sayWolf('Socorro!');
    }
    if (!G.wolf) { h.state = 'exit'; endScene(); }
    return;
  }
  // cavalinho (Dindo) ou Ana de patins
  const isAna = h.kind === 'ana', spd = isAna ? 820 : 640;
  if (S.phase === 'come') {
    const tx = isAna ? P.x - 36 : P.x + 32;
    h.x = Math.min(tx, h.x + 760 * dt); h.anim += dt * 15;
    if (h.x >= tx) { S.phase = 'pick'; S.t = 0; S.fx = P.x; S.fy = P.y; P.carried = true; sfx('jump'); }
  } else if (S.phase === 'pick') {
    const k = Math.min(1, S.t / 0.45), s = carrySeat(h);
    P.x = S.fx + (s.x - S.fx) * k; P.y = S.fy + (s.y - S.fy) * k - Math.sin(k * Math.PI) * 60;
    if (k >= 1) {
      S.phase = 'ride'; S.t = 0; sfx('whoosh');
      if (!isAna) { bubble(P, 'Vamos, cavalo! Anda, cavalo!', 2.6); say('Vamos, cavalo! Anda, cavalo!', PITCH.cecilia); }
    }
  } else if (S.phase === 'ride') {
    h.x += spd * dt; h.anim += dt * (isAna ? 9 : 15);
    // pulo por cima do lobo
    const dx = W ? h.x - W.x : 999;
    h.y = Math.abs(dx) < 190 ? GY - Math.cos(dx / 190 * Math.PI / 2) * 165 : GY;
    if (W && W.state !== 'dizzy' && W.state !== 'leave' && dx > -150) {
      W.state = 'dizzy'; W.t = 0; sfx('boing'); bubble(W, 'Ué?! Cadê a cestinha?');
    }
    const s = carrySeat(h); P.x = s.x; P.y = s.y;
    if (isAna && Math.random() < 0.5) G.parts.push({ type: 'spark', x: h.x - 20, y: GY - 6, vx: -60, vy: -40 - Math.random() * 60, life: 0.5, max: 0.5, s: 6, c: '#FFD60A' });
    if (!W || dx > 430) { S.phase = 'drop'; S.t = 0; S.fx = P.x; S.fy = P.y; h.y = GY; }
  } else if (S.phase === 'drop') {
    h.anim += dt * 4;
    const k = Math.min(1, S.t / 0.4), tx = isAna ? h.x + 70 : h.x + 50;
    P.x = S.fx + (tx - S.fx) * k; P.y = S.fy + (GY - S.fy) * k - Math.sin(k * Math.PI) * 50;
    if (k >= 1) {
      P.carried = false; P.y = GY; h.state = 'exit'; h.t = 0;
      const bye = isAna ? 'Passamos por ele, maninha!' : 'Tchau, Cecília!';
      bubble(h, bye, 2.6); say(bye, isAna ? PITCH.ana : PITCH.dindo);
      endScene();
    }
  }
}
function endScene() { G.scene = null; G.P.mode = 'free'; G.P.carried = false; }

function finish() {
  G.finished = true; G.P.mode = 'scene'; G.P.vx = 0;
  G.scene = { type: 'end', t: 0 };
}
function updateEnd(dt) {
  const S = G.scene, P = G.P, tx = HOUSE_X - 40;
  if (P.y < GY) { P.vy += GRAV * dt; P.y = Math.min(GY, P.y + P.vy * dt); }
  if (P.x < tx) { P.x = Math.min(tx, P.x + 210 * dt); P.walk += dt * 9; P.moving = true; P.face = 1; } else P.moving = false;
  if (!S.greet && S.t > 0.4) { S.greet = true; bubble(VOVO, 'Cecília! Minha netinha querida!', 3.5); say('Cecília! Minha netinha querida!', PITCH.vovo); }
  if (!S.party && S.t > 2.0) {
    S.party = true; sfx('win');
    burst(P.x + 40, P.y - 100, 'heart', 16);
    for (let i = 0; i < 90; i++) G.parts.push({ type: 'confetti', x: G.cam + Math.random() * VW, y: -20 - Math.random() * 300, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, life: 5, max: 5, s: 8, rot: Math.random() * 6, c: FLOWER_COLORS[i % 7] });
  }
  if (!S.shown && S.t > 3.4) { S.shown = true; showEnd(); }
}

// ---------- Lobo ----------
function spawnWolf() {
  const P = G.P;
  G.wolf = { x: G.cam + VW + 140, y: GY, tx: Math.min(P.x + 430, G.cam + VW - 170), face: -1, state: 'enter', t: 0, walk: 0, moving: true, bh: 245 };
  G.wolfIdx++;
  sfx('wolf');
  bubble(P, 'Ih! O Lobo Mau!', 2.2); say('Ih! O Lobo Mau!', PITCH.cecilia);
}
function updateWolf(dt) {
  const W = G.wolf, P = G.P;
  if (!W) {
    if (!G.scene && !G.finished && G.wolfIdx < WOLF_AT.length && P.x > WOLF_AT[G.wolfIdx]) spawnWolf();
    return;
  }
  W.t += dt; W.moving = false;
  switch (W.state) {
    case 'enter':
      W.x -= 380 * dt; W.walk += dt * 11; W.moving = true;
      if (W.x <= W.tx) {
        W.state = 'block'; W.t = 0;
        bubble(W, 'Me dá os morangos!', 2.6); sfx('growl'); sayWolf('Me dá os morangos!');
      }
      break;
    case 'block': {
      const d = W.x - P.x;
      if (d > 200 && P.mode === 'free') { W.x -= 55 * dt; W.walk += dt * 5; W.moving = true; }
      if (!G.scene && W.t > 1.4) openMenu();
      break;
    }
    case 'grab': if (W.t > 0.8) { W.state = 'block'; W.t = 0; } break;
    case 'flee': W.face = 1; W.x += 980 * dt; W.walk += dt * 18; W.moving = true; if (W.x > G.cam + VW + 260) G.wolf = null; break;
    case 'dizzy': if (W.t > 1.6) { W.state = 'leave'; W.t = 0; W.face = -1; } break;
    case 'leave': W.x -= 340 * dt; W.walk += dt * 11; W.moving = true; if (W.x < G.cam - 260) G.wolf = null; break;
  }
}
// ---------- Jogador ----------
function updatePlayer(dt) {
  const P = G.P;
  if (P.mode === 'free') {
    const a = P.knock > 0 ? 0 : axis();
    if (P.knock > 0) P.knock -= dt; else P.vx = a * SPEED;
    if (a) P.face = a > 0 ? 1 : -1;
    if (jumpQueued && P.ground && P.knock <= 0) { P.vy = JUMP; P.ground = false; sfx('jump'); }
    P.x += P.vx * dt; P.vy += GRAV * dt; P.y += P.vy * dt;
    if (P.y >= GY) {
      if (!P.ground) burst(P.x, GY, 'dust', 5);
      P.y = GY; P.vy = 0; P.ground = true;
      if (P.knock <= 0 && !a) P.vx = 0;
    }
    P.x = clamp(P.x, 330, HOUSE_X - 40);
    const W = G.wolf;
    if (wolfThreat(W)) P.x = Math.min(P.x, W.x - 120);
    P.moving = Math.abs(P.vx) > 1 && P.ground;
    if (P.moving) P.walk += dt * Math.abs(P.vx) / 26;
    if (!G.finished && P.x >= HOUSE_X - 260) finish();
  } else if (!P.carried && G.scene && G.scene.type !== 'end') {
    // em cena (ex.: Dindo espantando o lobo) — só a gravidade
    P.moving = false;
    if (P.y < GY) { P.vy += GRAV * dt; P.y = Math.min(GY, P.y + P.vy * dt); } else { P.y = GY; P.vy = 0; P.ground = true; }
  }
  jumpQueued = false;
  if (P.hurt > 0) P.hurt -= dt;
  // colher morangos
  for (const b of G.berries) {
    if (b.got) continue;
    const hit = P.carried ? Math.abs(b.x - P.x) < 60 : Math.abs(b.x - P.x) < 42 && b.y > P.y - 128 && b.y < P.y + 14;
    if (hit) collect(b);
  }
}
function collect(b) {
  b.got = true; G.count++; sfx('collect');
  burst(b.x, b.y, 'spark', 6);
  G.parts.push({ type: 'text', x: b.x, y: b.y - 20, vx: 0, vy: -70, life: 0.8, max: 0.8, txt: '+1' });
  updateHud(); const sc = $('score'); sc.classList.remove('pop'); void sc.offsetWidth; sc.classList.add('pop');
  const m = [25, 50, 75, 100].find(v => G.count >= v && G.milestone < v);
  if (m) { G.milestone = m; const txt = m === 100 ? 'Todos os cem morangos! Uhul!' : `Oba! ${m} morangos!`; bubble(G.P, m === 100 ? 'Todos os 100! Uhul!' : `Oba! ${m} morangos!`, 2); say(txt, PITCH.cecilia); }
}

// ---------- Efeitos ----------
function burst(x, y, type, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = 80 + Math.random() * 180;
    G.parts.push({ type, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (type === 'heart' ? 120 : 40), life: 0.7 + Math.random() * 0.5, max: 1.2, s: type === 'dust' ? 8 : 7, c: type === 'spark' ? (i % 2 ? '#FFD60A' : '#fff') : '#FF7AA2', rot: Math.random() * 6 });
  }
}
function bubble(tg, text, dur = 2.2) {
  G.bubbles = G.bubbles.filter(b => b.tg !== tg);
  G.bubbles.push({ tg, text, t: 0, dur });
}
function updateFx(dt) {
  for (const p of G.parts) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.type === 'confetti') { p.rot += dt * 6; p.vx += Math.sin(G.t * 3 + p.y * 0.01) * 4; }
    else if (p.type === 'dust') { p.vy -= 200 * dt; p.vx *= 0.9; }
    else if (p.type !== 'text') p.vy += 300 * dt;
  }
  G.parts = G.parts.filter(p => p.life > 0);
  for (const b of G.bubbles) b.t += dt;
  G.bubbles = G.bubbles.filter(b => b.t < b.dur);
  for (const d of G.drops) {
    d.vy += GRAV * 0.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.rot += dt * 10;
    if (d.y >= GY - 30 && d.vy > 0) { d.done = true; G.berries.push({ x: Math.max(80, d.x), y: GY - 30, got: false, ph: Math.random() * TAU }); }
  }
  G.drops = G.drops.filter(d => !d.done);
  for (const h of G.helpers) if (h.state === 'exit') { h.t += dt; h.x += (h.t < 0.6 ? 0 : 700) * dt; h.anim += dt * 15; }
  G.helpers = G.helpers.filter(h => !(h.state === 'exit' && h.x > G.cam + VW + 300));
}

// ---------- Loop ----------
function update(dt) {
  if (G.menu) return;          // tudo congelado enquanto a criança escolhe
  G.t += dt;
  if (G.scene) updateScene(dt);
  updatePlayer(dt);
  updateWolf(dt);
  updateFx(dt);
  const P = G.P;
  const target = G.finished ? HOUSE_X - VW * 0.5 + 40 : P.x - VW * 0.36;
  G.cam += (target - G.cam) * Math.min(1, dt * 5);
  G.cam = clamp(G.cam, 0, Math.max(0, LEVEL_END - VW));
  $('pcec').style.left = (clamp(P.x / (HOUSE_X - 40), 0, 1) * 100) + '%';
}
function updateHud(force) { $('count').textContent = G.count; }

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, -TOP * scale);
  drawSky();
  for (const layer of ['far', 'mid']) {
    const p = P_LAYER[layer];
    for (const d of DECOR[layer]) {
      const sx = d.lx - G.cam * p; if (sx < -320 || sx > VW + 320) continue;
      ctx.save(); ctx.translate(sx, layer === 'far' ? GY - 20 : GY - 26); ctx.scale(d.s, d.s);
      if (layer === 'far') ctx.globalAlpha = 0.85;
      drawDecor(d, layer); ctx.restore();
    }
  }
  drawGround();
  ctx.save(); ctx.translate(-G.cam, 0);
  // decoração próxima, placas, casa
  for (const d of DECOR.near) {
    if (d.lx < G.cam - 200 || d.lx > G.cam + VW + 200) continue;
    ctx.save(); ctx.translate(d.lx, GY - 22); ctx.scale(d.s, d.s); drawDecor(d, 'near'); ctx.restore();
  }
  for (const s of SIGNS) if (Math.abs(s - G.cam - VW / 2) < VW) drawSign(s);
  if (HOUSE_X - G.cam < VW + 600) { drawHouse(); drawVovo(VOVO.x, VOVO.y, -1, { wave: G.P.x > HOUSE_X - 700, happy: G.finished && G.scene && G.scene.t > 1.5 }); }
  // morangos
  for (const b of G.berries) if (!b.got && b.x > G.cam - 40 && b.x < G.cam + VW + 40) drawBerry(b.x, b.y + Math.sin(G.t * 3 + b.ph) * 4);
  for (const d of G.drops) { ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.rot); drawBerry(0, 0, 0.9); ctx.restore(); }
  // personagens
  if (G.wolf) drawWolf(G.wolf);
  const P = G.P;
  const cecOpts = { walk: P.walk, moving: P.moving, air: !P.ground && !P.carried, count: G.count, hurt: P.hurt, pose: P.carried ? 'sit' : 'stand', fast: P.carried && G.scene && G.scene.phase === 'ride', happy: G.finished && G.scene && G.scene.t > 1.5, scared: wolfThreat(G.wolf) && G.wolf.x - P.x < 260 && !G.scene };
  if (!P.carried) { shadow(P.x, 24, 0.18 * clamp(1 - (GY - P.y) / 300, 0.3, 1)); drawCecilia(P.x, P.y, P.face, cecOpts); }
  for (const h of G.helpers) {
    const S = G.scene && G.scene.h === h ? G.scene : null;
    const carrying = P.carried && S;
    const run = h.state === 'exit' ? h.t > 0.6 : !(S && (S.phase === 'pick' || S.phase === 'drop'));
    shadow(h.x, h.kind === 'ana' ? 32 : 36, 0.18 * clamp(1 - (GY - h.y) / 300, 0.3, 1));
    if (h.kind === 'layla') {
      drawLayla(h.x, h.y, 1, { anim: h.anim, run: true, bark: h.state === 'scene' });
    } else if (h.kind === 'dindo') {
      drawDindo(h.x, h.y, 1, { anim: h.anim, run, stick: S && S.type === 'stick', carry: carrying, yell: S && S.type === 'stick', wave: h.state === 'exit' && h.t < 0.6 });
      if (carrying) drawCecilia(P.x, P.y, 1, cecOpts);
    } else {
      const o = { anim: h.anim, skate: run, carry: carrying, wave: h.state === 'exit' && h.t < 0.6 };
      drawAna(h.x, h.y, 1, o, 'body');
      if (carrying) drawCecilia(P.x, P.y, 1, cecOpts);
      drawAna(h.x, h.y, 1, o, 'arm');
    }
  }
  // partículas
  for (const p of G.parts) {
    const a = clamp(p.life / p.max * 1.5, 0, 1); ctx.globalAlpha = a;
    if (p.type === 'spark') star(p.x, p.y, p.s, p.c, p.rot);
    else if (p.type === 'dust') C(p.x, p.y, p.s * (1.5 - a), 'rgba(160,140,120,.6)');
    else if (p.type === 'heart') heart(p.x, p.y, 10, p.c);
    else if (p.type === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    else if (p.type === 'text') { ctx.font = '800 28px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.strokeText(p.txt, p.x, p.y); ctx.fillStyle = RED; ctx.fillText(p.txt, p.x, p.y); }
    ctx.globalAlpha = 1;
  }
  for (const b of G.bubbles) drawBubble(b);
  ctx.restore();
}
function drawBubble(b) {
  const tg = b.tg, a = Math.min(1, b.t * 6, (b.dur - b.t) * 4);
  ctx.globalAlpha = clamp(a, 0, 1);
  ctx.font = '800 24px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(b.text).width + 34, h = 46;
  const ty = tg.y - (tg.bh || 150) - (tg === G.P && G.P.carried ? 10 : 0);
  let x = clamp(tg.x, G.cam + w / 2 + 10, G.cam + VW - w / 2 - 10);
  const y = Math.max(TOP + h + 80, ty) - (1 - Math.min(1, b.t * 6)) * 10;
  RR(x - w / 2, y - h, w, h, 20, '#fff');
  ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 3; ctx.stroke();
  poly([clamp(tg.x, x - w / 2 + 20, x + w / 2 - 20) - 9, y - 2, clamp(tg.x, x - w / 2 + 20, x + w / 2 - 20) + 9, y - 2, clamp(tg.x, x - w / 2 + 14, x + w / 2 - 14), y + 14], '#fff');
  ctx.fillStyle = tg === G.wolf ? '#4A4E69' : '#333'; ctx.fillText(b.text, x, y - h / 2 + 1);
  ctx.globalAlpha = 1;
}

let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, Math.max(0, (ts - last) / 1000)); last = ts;
  if (running && !paused) update(dt);
  else if (!running) { G.t += dt; G.P.walk += 0; }
  render();
}

// ---------- Telas / UI ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), w = innerWidth, h = innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  TOP = h < 520 ? 130 : 0;
  scale = cv.height / (VH - TOP); VW = cv.width / scale;
}
addEventListener('resize', resize);
const isTouch = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
function applyInputMode() {
  document.body.classList.toggle('no-touch', !isTouch());
}
addEventListener('touchstart', () => { if (document.body.classList.contains('no-touch')) applyInputMode(); }, { passive: true });

function startGame() {
  initAudio();
  if (isTouch()) {
    const el = document.documentElement;
    try {
      const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
      if (p && p.then) p.then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => { })).catch(() => { });
    } catch (e) { }
  }
  newGame();
  running = true; paused = false; battleMusic = false;
  $('battle').classList.add('hidden');
  $('start').classList.add('hidden'); $('end').classList.add('hidden'); $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden'); $('controls').classList.remove('hidden');
  bubble(G.P, 'Vamos pra casa da Vovó!', 2.6);
  say('Vamos colher morangos para a Vovó Querida!', PITCH.cecilia);
}
function togglePause(force) {
  if (!running) return;
  paused = typeof force === 'boolean' ? force : !paused;
  $('pause').classList.toggle('hidden', !paused);
  if (AC) paused ? AC.suspend() : AC.resume();
}
function showEnd() {
  running = false;
  $('controls').classList.add('hidden');
  $('endCount').textContent = G.count;
  $('endMsg').textContent = G.count >= TOTAL ? 'Incrível! Você pegou TODOS os morangos! ⭐⭐⭐'
    : G.count >= 60 ? 'Muito bem! A vovó vai fazer um bolo de morango! ⭐⭐'
    : 'A vovó amou! Vamos tentar pegar mais morangos? ⭐';
  $('end').classList.remove('hidden');
  say(`Parabéns! Você colheu ${G.count} morangos!`, PITCH.vovo);
}
$('btnPlay').addEventListener('click', startGame);
$('btnAgain').addEventListener('click', startGame);
$('btnRestart').addEventListener('click', () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); startGame(); });
$('btnResume').addEventListener('click', () => togglePause(false));
$('btnPause').addEventListener('click', () => togglePause());
$('btnSound').addEventListener('click', () => { initAudio(); setSound(!soundOn); });
document.addEventListener('visibilitychange', () => { if (document.hidden && running) togglePause(true); });

// Início
try { if (localStorage.getItem('cecilia-sound') === '0') setSound(false); } catch (e) { }
genDecor(); resize(); applyInputMode(); newGame();
G.P.x = 480; G.cam = 0;
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
// gancho para testes automatizados
window.__cecilia = { get G() { return G; }, usePower, startGame };
})();
