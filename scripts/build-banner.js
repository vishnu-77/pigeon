// Generates docs/assets/pigeon-dotmatrix.svg — a self-contained, zero-dependency
// animated dot-matrix banner styled like an airport split-flap departure board:
// gold round dots on a dark grooved panel with the unlit dot grid showing behind text.
//
// One 15s master clock drives three phases; dots disperse & assemble (fly in from
// scattered positions, hold, scatter out). All motion is CSS @keyframes driven by
// per-dot CSS variables, so it animates when embedded as <img> on GitHub and the loop
// is seamless. Output is byte-stable (seeded PRNG, no Date.now()/Math.random()).
//
// Run: npm run build:banner

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// --- seeded PRNG (mulberry32) -> deterministic scatter offsets ----------
let seed = 0x9e3779b9;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function between(min, max) {
  return min + rand() * (max - min);
}

// --- 5x7 dot font (departure-board style) -------------------------------
const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "11110", "10001", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11100", "10010", "10001", "10001", "10001", "10010", "11100"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ">": ["00000", "00100", "00010", "11111", "00010", "00100", "00000"]
};

const GLYPH_W = 5;
const GLYPH_H = 7;

// --- geometry -----------------------------------------------------------
const W = 960;
const H = 380;
const LOOP = "15s";
const GRID = 20; // unlit-grid pitch; lit dots snap to this
const DOT_R = 6; // lit dot radius
const OFF_R = 2.4; // unlit dot radius

const lit = []; // { cx, cy, fill, phase, bucket }

function textWidth(text, pitch) {
  return text.length * (GLYPH_W + 1) * pitch - pitch;
}
function centeredX(text, pitch) {
  return round((W - textWidth(text, pitch)) / 2);
}
function round(n) {
  return Math.round(n * 10) / 10;
}

let bucketCounter = 0;
// Lay a string out as lit dots snapped to a pitch. phase = animation group.
// Dot radius scales with pitch so small text stays crisp instead of blobbing.
function renderText(text, { x, y, pitch, fill, phase, r = round(pitch * 0.4) }) {
  let cursor = x;
  for (const char of text.toUpperCase()) {
    const glyph = FONT[char] ?? FONT[" "];
    for (let row = 0; row < GLYPH_H; row += 1) {
      for (let col = 0; col < GLYPH_W; col += 1) {
        if (glyph[row][col] === "1") {
          lit.push({
            cx: round(cursor + col * pitch),
            cy: round(y + row * pitch),
            r,
            fill,
            phase,
            bucket: bucketCounter++ % 3
          });
        }
      }
    }
    cursor += (GLYPH_W + 1) * pitch;
  }
}

// --- colors -------------------------------------------------------------
const GOLD = "#ffc233";
const GREEN = "#43dd82";
const YELLOW = "#ffcf4a";
const RED = "#ff6a6a";
const MAGENTA = "#e08bff";
const OFF = "#232c39";

// --- Phase A: wordmark + tagline ---------------------------------------
const wordPitch = 20;
renderText("PIGEON", { x: centeredX("PIGEON", wordPitch), y: 92, pitch: wordPitch, r: 7.5, fill: GOLD, phase: "A" });
renderText("GOVERNED COMMUNICATION", { x: centeredX("GOVERNED COMMUNICATION", 6.4), y: 268, pitch: 6.4, r: 2.6, fill: GOLD, phase: "A" });

// --- Phase B: flow ------------------------------------------------------
const trackPitch = 5.4;
const trackText = "SENDER > BROKER > RECEIVER";
const trackY = 62;
renderText(trackText, { x: centeredX(trackText, trackPitch), y: trackY, pitch: trackPitch, r: 2.2, fill: GOLD, phase: "B" });
const msgY = round(trackY + 3 * trackPitch);
const msgStartX = round(centeredX(trackText, trackPitch) - 22);
const msgEndX = round(W - msgStartX);

// gates as two tidy rows of three (generous spacing, no overlap)
const gatePitch = 4.2;
const gateRows = [
  ["IDENTITY", "INTENT", "SCHEMA"],
  ["REGION", "SENSITIVITY", "IDEMPOTENCY"]
];
const colCenters = [176, 480, 784];
gateRows.forEach((rowGates, r) => {
  const y = 178 + r * 74;
  rowGates.forEach((gate, ci) => {
    const x = round(colCenters[ci] - textWidth(gate, gatePitch) / 2);
    renderText(gate, { x, y, pitch: gatePitch, r: 1.8, fill: GOLD, phase: "B" });
  });
});

// --- Phase C: outcome story --------------------------------------------
const chips = [
  ["ACCEPTED", GREEN],
  ["DUPLICATE", YELLOW],
  ["DENIED", RED],
  ["QUARANTINED", MAGENTA],
  ["DELIVERED", GREEN]
];
chips.forEach(([label, color], i) => {
  renderText(label, { x: centeredX(label, 12), y: 152, pitch: 12, r: 5, fill: color, phase: `C${i}` });
});

// --- assign scatter offsets --------------------------------------------
for (const d of lit) {
  const a = between(0, Math.PI * 2);
  const dist = between(20, 60);
  d.dx = round(Math.cos(a) * dist);
  d.dy = round(Math.sin(a) * dist);
  const a2 = between(0, Math.PI * 2);
  const dist2 = between(20, 60);
  d.ex = round(Math.cos(a2) * dist2);
  d.ey = round(Math.sin(a2) * dist2);
}

// --- keyframes ----------------------------------------------------------
// A dot for phase P is hidden+scattered outside its window, assembles at the
// start (staggered by bucket), holds, then disperses at the end. Percentages are
// clamped to strictly ascending order so narrow windows can't produce malformed
// keyframes (which would leak dots outside their phase).
function phaseKeyframes(name, start, end, bucketOffset) {
  const g = (p) => round(p);
  let s = start + bucketOffset; // assemble start
  let a = s + 2.2; // assembled
  let o = end - 1; // dispersed
  let h = o - 2.2; // hold until
  if (a > h) {
    // window too narrow for a distinct hold: collapse assemble/hold to its midpoint
    a = h = round((s + o) / 2);
  }
  // guarantee s < a <= h < o
  s = Math.min(s, a - 0.1);
  return (
    `@keyframes ${name}{` +
    `0%,${g(s)}%{opacity:0;transform:translate(var(--dx),var(--dy))}` +
    `${g(a)}%{opacity:1;transform:translate(0,0)}` +
    `${g(h)}%{opacity:1;transform:translate(0,0)}` +
    `${g(o)}%{opacity:0;transform:translate(var(--ex),var(--ey))}` +
    `100%{opacity:0;transform:translate(var(--ex),var(--ey))}}`
  );
}

const phaseWindows = {
  A: [0, 32],
  B: [33, 65],
  C0: [66, 73],
  C1: [73, 80],
  C2: [80, 87],
  C3: [87, 94],
  C4: [94, 100]
};

const keyframes = [];
const classAnims = [];
for (const [phase, [start, end]] of Object.entries(phaseWindows)) {
  for (let b = 0; b < 3; b += 1) {
    const name = `kf${phase}_${b}`;
    keyframes.push(phaseKeyframes(name, start, end, b * 1.4));
    classAnims.push(`.p${phase}_${b}{animation:${name} ${LOOP} infinite}`);
  }
}

// travelling message dot (phase B window)
keyframes.push(
  `@keyframes kfMsg{0%,34%{opacity:0;transform:translateX(0)}36%{opacity:1;transform:translateX(0)}` +
    `62%{opacity:1;transform:translateX(${round(msgEndX - msgStartX)}px)}64%{opacity:0;transform:translateX(${round(msgEndX - msgStartX)}px)}100%{opacity:0}}`
);

// --- CSS ----------------------------------------------------------------
const css =
  `.off{fill:${OFF}}` +
  `.lit{filter:drop-shadow(0 0 2px currentColor);opacity:0}` +
  `.pMsg{opacity:0;animation:kfMsg ${LOOP} infinite}` +
  classAnims.join("") +
  keyframes.join("") +
  `@media (prefers-reduced-motion:reduce){.lit,.pMsg{animation:none}` +
  `[class*="pA_"]{opacity:1;transform:none}}`;

// --- emit dots ----------------------------------------------------------
const offDots = [];
for (let gy = 30; gy <= H - 30; gy += GRID) {
  for (let gx = 30; gx <= W - 30; gx += GRID) {
    offDots.push(`<circle cx="${gx}" cy="${gy}" r="${OFF_R}" class="off"/>`);
  }
}

const litDots = lit
  .map((d) => {
    const cls = `lit p${d.phase}_${d.bucket}`;
    return `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${d.fill}" color="${d.fill}" class="${cls}" style="--dx:${d.dx}px;--dy:${d.dy}px;--ex:${d.ex}px;--ey:${d.ey}px"/>`;
  })
  .join("");

const msgDot = `<g class="pMsg"><circle cx="${msgStartX}" cy="${msgY}" r="5.5" fill="${GOLD}" color="${GOLD}" style="filter:drop-shadow(0 0 4px ${GOLD})"/></g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pigeon — governed communication">
  <title>Pigeon — governed communication</title>
  <defs>
    <linearGradient id="board" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d1119"/>
      <stop offset="1" stop-color="#070a10"/>
    </linearGradient>
    <pattern id="grooves" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="none"/>
      <line x1="0" y1="5.5" x2="6" y2="5.5" stroke="#000000" stroke-width="1" stroke-opacity="0.18"/>
    </pattern>
    <style>${css}</style>
  </defs>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="22" fill="url(#board)"/>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="22" fill="url(#grooves)"/>
  <rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="22" fill="none" stroke="#232e3f" stroke-width="1.5"/>
  <g>${offDots.join("")}</g>
  <g>${litDots}</g>
  ${msgDot}
</svg>
`;

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "assets");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "pigeon-dotmatrix.svg");
writeFileSync(outFile, svg);
console.log(`Wrote ${outFile} (${lit.length} lit + ${offDots.length} unlit dots, ${(svg.length / 1024).toFixed(1)} KiB)`);
