// Generates assets/pigeon-banner.svg — a self-contained, standalone animated SVG
// banner styled like a restrained airport split-flap / LED departure board.
//
// No JavaScript, no external fonts/images/stylesheets, no runtime dependencies: all
// lettering is drawn as round dots from a 5x7 dot-matrix font, animated by internal
// CSS @keyframes on a single seamless 15s loop (disperse -> assemble -> hold ->
// disperse). Scatter offsets come from a fixed deterministic lookup table encoded as
// shared CSS classes, so the output is byte-stable and free of per-dot inline styles.
//
// Run: npm run build:banner

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// --- 5x7 dot font -------------------------------------------------------
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
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ">": ["00000", "00100", "00010", "11111", "00010", "00100", "00000"]
};

const GLYPH_W = 5;
const GLYPH_H = 7;

// --- canvas + board -----------------------------------------------------
const W = 960;
const H = 380;
const LOOP = "15s";
const BOARD = { x: 24, y: 20, w: 912, h: 340, r: 22 };
const GRID = 20; // unlit-grid pitch (lit dots snap to this)
const OFF_R = 2.2;

// --- colors -------------------------------------------------------------
const GOLD = "#ffc233";
const GREEN = "#43dd82";
const YELLOW = "#ffcf4a";
const RED = "#ff6a6a";
const MAGENTA = "#e08bff";
const OFF = "#232c39";

// --- deterministic scatter lookup tables (max displacement <= 24px) -----
const OFFSETS_IN = [
  [-14, -8], [10, -12], [-8, 14], [16, 6], [-12, 10], [6, -16], [14, -10], [-16, 4],
  [-6, -14], [12, 12], [-18, -2], [8, 16], [-10, -12], [18, -4], [-4, 18], [4, -18]
];
const OFFSETS_OUT = [
  [12, 10], [-16, 6], [8, -14], [-10, -12], [16, -6], [-6, 16], [-14, 8], [14, 12],
  [10, -16], [-12, -10], [18, 4], [-8, 14], [12, -12], [-18, 2], [6, 18], [-4, -18]
];

// --- dot collection -----------------------------------------------------
const lit = []; // { cx, cy, r, fill, phase, bucket, off }
let idx = 0;

function textWidth(text, pitch) {
  return text.length * (GLYPH_W + 1) * pitch - pitch;
}
function centeredX(text, pitch) {
  return round((W - textWidth(text, pitch)) / 2);
}
function round(n) {
  return Math.round(n * 10) / 10;
}

// Lay a string out as lit dots snapped to a pitch. Radius scales with pitch so
// small text stays crisp instead of blobbing.
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
            bucket: idx % 3,
            off: idx % OFFSETS_IN.length
          });
          idx += 1;
        }
      }
    }
    cursor += (GLYPH_W + 1) * pitch;
  }
}

// --- Beat 1: wordmark + subtitle ---------------------------------------
const wordPitch = 18;
renderText("PIGEON", { x: centeredX("PIGEON", wordPitch), y: 96, r: 6.6, pitch: wordPitch, fill: GOLD, phase: "W" });
renderText("GOVERNED COMMUNICATION", { x: centeredX("GOVERNED COMMUNICATION", 6.2), y: 250, r: 2.5, pitch: 6.2, fill: GOLD, phase: "W" });

// --- Beat 2: flow ------------------------------------------------------
const trackPitch = 5.4;
const trackText = "SENDER > BROKER > RECEIVER";
const trackY = 66;
renderText(trackText, { x: centeredX(trackText, trackPitch), y: trackY, r: 2.2, pitch: trackPitch, fill: GOLD, phase: "F" });
const msgY = round(trackY + 3 * trackPitch);
// x positions to pause the travelling dot at (SENDER / BROKER / RECEIVER centres).
// A char at string index i has its centre column at cursor + 2*pitch.
const trackStartX = centeredX(trackText, trackPitch);
const charCenterX = (i) => round(trackStartX + i * (GLYPH_W + 1) * trackPitch + 2 * trackPitch);
const senderX = charCenterX(2.5); // middle of "SENDER" (chars 0..5)
const brokerX = charCenterX(11.5); // middle of "BROKER" (chars 9..14)
const receiverX = charCenterX(21.5); // middle of "RECEIVER" (chars 18..25)
const msgFrom = senderX;

// six policy gates, two tidy rows of three
const gatePitch = 4.2;
const gateRows = [
  ["IDENTITY", "INTENT", "SCHEMA"],
  ["REGION", "SENSITIVITY", "IDEMPOTENCY"]
];
const colCenters = [180, 480, 780];
const gatePhase = [];
gateRows.forEach((rowGates, r) => {
  const y = 178 + r * 74;
  rowGates.forEach((gate, ci) => {
    const phase = `G${gatePhase.length}`;
    gatePhase.push(phase);
    const x = round(colCenters[ci] - textWidth(gate, gatePitch) / 2);
    renderText(gate, { x, y, r: 1.8, pitch: gatePitch, fill: GOLD, phase });
  });
});

// --- Beat 3: outcomes --------------------------------------------------
const chips = [
  ["ACCEPTED", GREEN],
  ["DUPLICATE", YELLOW],
  ["DENIED", RED],
  ["QUARANTINED", MAGENTA],
  ["DELIVERED", GREEN]
];
chips.forEach(([label, color], i) => {
  renderText(label, { x: centeredX(label, 11), y: 150, r: 4.4, pitch: 11, fill: color, phase: `C${i}` });
});

// --- keyframes (strictly ascending; clamp narrow windows) --------------
function pctKeyframes(name, start, end, bucketOffset) {
  const g = (p) => round(p);
  let s = start + bucketOffset;
  let a = s + 1.4; // assemble
  let o = end - 0.6; // dispersed
  let h = o - 1.4; // hold until
  if (a > h) {
    a = h = round((s + o) / 2);
  }
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

// gates accumulate: assemble in sequence, then hold (dimmed) until the beat ends,
// then disperse together.
function gateKeyframes(name, onStart) {
  const g = (p) => round(p);
  const s = onStart;
  const a = s + 2;
  const dimAt = a + 1.5; // drop to reduced intensity once the next gate takes over
  const holdEnd = 58;
  const off = 63;
  return (
    `@keyframes ${name}{` +
    `0%,${g(s)}%{opacity:0;transform:translate(var(--dx),var(--dy))}` +
    `${g(a)}%{opacity:1;transform:translate(0,0)}` +
    `${g(dimAt)}%{opacity:0.7;transform:translate(0,0)}` +
    `${g(holdEnd)}%{opacity:0.7;transform:translate(0,0)}` +
    `${g(off)}%{opacity:0;transform:translate(var(--ex),var(--ey))}` +
    `100%{opacity:0;transform:translate(var(--ex),var(--ey))}}`
  );
}

const phaseWindows = {
  W: [0, 28],
  F: [30, 63],
  C0: [66, 73.5],
  C1: [73.5, 79.5],
  C2: [79.5, 85.5],
  C3: [85.5, 91.5],
  C4: [91.5, 100]
};

const keyframes = [];
const classAnims = [];
for (const [phase, [start, end]] of Object.entries(phaseWindows)) {
  // Outcome phases (C*) have narrow ~6% windows; keep all buckets in sync so the
  // word holds crisply. Wide phases (W/F) stagger buckets for a wave-in feel.
  const narrow = phase.startsWith("C");
  for (let b = 0; b < 3; b += 1) {
    const name = `kf${phase}_${b}`;
    keyframes.push(pctKeyframes(name, start, end, narrow ? 0 : b * 1.3));
    classAnims.push(`.p${phase}_${b}{animation:${name} ${LOOP} infinite}`);
  }
}
// gates: sequential onset 40..57.5 across six gates
gatePhase.forEach((phase, i) => {
  const onStart = 40 + i * 3;
  for (let b = 0; b < 3; b += 1) {
    const name = `kf${phase}_${b}`;
    keyframes.push(gateKeyframes(name, onStart + b * 0.6));
    classAnims.push(`.p${phase}_${b}{animation:${name} ${LOOP} infinite}`);
  }
});

// travelling message dot: hidden until the flow assembles, then steps
// SENDER -> BROKER -> RECEIVER with a brief pause at each, then fades.
const dxB = round(brokerX - msgFrom);
const dxR = round(receiverX - msgFrom);
keyframes.push(
  `@keyframes kfMsg{0%,33%{opacity:0;transform:translateX(0)}` +
    `35%{opacity:1;transform:translateX(0)}` +
    `41%{opacity:1;transform:translateX(0)}` +
    `46%{opacity:1;transform:translateX(${dxB}px)}` +
    `50%{opacity:1;transform:translateX(${dxB}px)}` +
    `56%{opacity:1;transform:translateX(${dxR}px)}` +
    `60%{opacity:1;transform:translateX(${dxR}px)}` +
    `62%{opacity:0;transform:translateX(${dxR}px)}100%{opacity:0}}`
);

// --- offset classes (shared; no per-dot inline styles) -----------------
const offClasses = OFFSETS_IN.map((io, i) => {
  const oo = OFFSETS_OUT[i];
  return `.o${i}{--dx:${io[0]}px;--dy:${io[1]}px;--ex:${oo[0]}px;--ey:${oo[1]}px}`;
}).join("");

// --- CSS ----------------------------------------------------------------
const css =
  `.off{fill:${OFF}}` +
  `.lit{filter:drop-shadow(0 0 1.8px currentColor);opacity:0}` +
  `.msg{opacity:0;filter:drop-shadow(0 0 3px ${GOLD});animation:kfMsg ${LOOP} infinite}` +
  offClasses +
  classAnims.join("") +
  keyframes.join("") +
  `@media (prefers-reduced-motion:reduce){` +
  `.lit,.msg{animation:none!important}` +
  `[class*="pW_"]{opacity:1!important;transform:none!important}}`;

// --- emit dots ----------------------------------------------------------
const offDots = [];
for (let gy = BOARD.y + 14; gy <= BOARD.y + BOARD.h - 14; gy += GRID) {
  for (let gx = BOARD.x + 14; gx <= BOARD.x + BOARD.w - 14; gx += GRID) {
    offDots.push(`<circle cx="${gx}" cy="${gy}" r="${OFF_R}"/>`);
  }
}

const litByBeat = { W: [], F: [], C: [] };
for (const d of lit) {
  const group = d.phase.startsWith("C") ? "C" : d.phase === "W" ? "W" : "F";
  litByBeat[group].push(
    `<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${d.fill}" color="${d.fill}" class="lit p${d.phase}_${d.bucket} o${d.off}"/>`
  );
}

const msgDot = `<circle cx="${msgFrom}" cy="${msgY}" r="5.5" fill="${GOLD}" color="${GOLD}" class="msg"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img">
<title>Pigeon governed communication animated dot-matrix banner</title>
<desc>A dot-matrix departure board: the PIGEON wordmark assembles, a message travels from sender through the policy broker to receiver as identity, intent, schema, region, sensitivity and idempotency checks illuminate, then the outcomes accepted, duplicate, denied, quarantined and delivered are shown.</desc>
<defs>
<linearGradient id="board" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1119"/><stop offset="1" stop-color="#070a10"/></linearGradient>
<clipPath id="clip"><rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.w}" height="${BOARD.h}" rx="${BOARD.r}"/></clipPath>
<pattern id="grooves" width="6" height="6" patternUnits="userSpaceOnUse"><line x1="0" y1="5.5" x2="6" y2="5.5" stroke="#000000" stroke-width="1" stroke-opacity="0.16"/></pattern>
<style>${css}</style>
</defs>
<g id="panel">
<rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.w}" height="${BOARD.h}" rx="${BOARD.r}" fill="url(#board)"/>
<rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.w}" height="${BOARD.h}" rx="${BOARD.r}" fill="url(#grooves)" clip-path="url(#clip)"/>
<rect x="${BOARD.x + 1.5}" y="${BOARD.y + 1.5}" width="${BOARD.w - 3}" height="${BOARD.h - 3}" rx="${BOARD.r - 1.5}" fill="none" stroke="rgba(255,255,255,0.025)" stroke-width="1"/>
<rect x="${BOARD.x}" y="${BOARD.y}" width="${BOARD.w}" height="${BOARD.h}" rx="${BOARD.r}" fill="none" stroke="#27303d" stroke-width="1.5"/>
<g class="off" clip-path="url(#clip)">${offDots.join("")}</g>
</g>
<g id="beat-wordmark">${litByBeat.W.join("")}</g>
<g id="beat-flow">${litByBeat.F.join("")}${msgDot}</g>
<g id="beat-outcomes">${litByBeat.C.join("")}</g>
</svg>
`;

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "pigeon-banner.svg");
writeFileSync(outFile, svg);
console.log(`Wrote ${outFile} (${lit.length} lit + ${offDots.length} unlit dots, ${(svg.length / 1024).toFixed(1)} KiB)`);
