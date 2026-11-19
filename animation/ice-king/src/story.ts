// "The Ice King": 63 s short in the flat-characters-in-a-3D-toon-world style (built from the Pig on Trial short).
// Timeline keyed to the Kokoro narration (voiceover/ice-king/lines.json, sentence starts in seconds):
//   S1   0.00 Boston wharf: a man reads the paper, "NO JOKE"     | "In 1806, a Boston newspaper printed a story... No joke."
//   S2   5.50 the wharf: young Tudor, his brig, ice going aboard  | "A young man named Frederic Tudor had filled a ship with ice."
//   S3   8.64 a frozen pond: men saw blocks of ice               | "Real ice, cut from frozen ponds."
//   S4  10.74 aerial: the brig sails south over open sea         | "And he was sending it to Martinique, a hot island..."
//   S5  14.26 the wharf: townsfolk laugh at the paper            | "The paper hoped it would not turn out to be a slippery speculation."
//   S6  17.55 Martinique pier: the block melts, nobody wants it  | "It did. The ice arrived... It melted away. Tudor lost..."
//   S7  25.75 a jail cell: Tudor on the bench behind bars        | "He tried again, and lost again. By 1813, he had been locked in jail..."
//   S8  30.76 a hot street: islanders sweat over warm drinks     | "You see, the problem was never the ice. People in hot places..."
//   S9  35.56 an islander pokes a block of ice, puzzled          | "You can't miss something you've never tasted."
//   S10 37.74 the new icehouse: workers carry blocks inside      | "So Tudor stopped selling ice, and started selling cold. He built icehouses..."
//   S11 42.56 the wharf: blocks packed in sawdust               | "He packed his ice in sawdust, free trash from lumber mills."
//   S12 45.73 a harbour bar: free ice, cold drinks, grins        | "And he gave bartenders ice for free, until their customers got hooked..."
//   S13 50.41 golden: the ship on the long voyage to India      | "In 1833, he sent 180 tons of ice on a four-month trip to India..."
//   S14 56.90 golden: Tudor, old and rich, crowned Ice King      | "He died rich. People called him the Ice King."
//   S15 59.56 the wharf: the paper reader, now with a cold drink | "So that newspaper was right all along. It really was no joke."
export const FPS = 30;
export const TOTAL = 1890; // 63 s (narration 62.61 s)
export const D0 = 0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

/** narration word times (s) the action keys on (sentence starts from lines.json, words placed by character share) */
export const T_NOJOKE = 4.45;   // "No joke."
export const T_SLIP = 15.9;     // "slippery"
export const T_ITDID = 17.55;   // "It did."
export const T_ARRIVE = 18.3;   // "The ice arrived"
export const T_NOBODY = 20.4;   // "nobody knew what to do with it"
export const T_MELT = 22.42;    // "It melted away."
export const T_LOST = 23.9;     // "lost about four thousand dollars"
export const T_LOCKED = 28.8;   // "locked in jail"
export const T_YOUSEE = 30.76;  // "You see"
export const T_COLD = 33.9;     // "a cold drink"
export const T_ICEHOUSE = 40.71; // "He built icehouses"
export const T_SAWDUST = 43.75; // "sawdust"
export const T_FREE = 47.6;     // "for free"
export const T_HOOKED = 48.8;   // "got hooked on cold drinks"
export const T_INDIA = 54.6;    // "India"
export const T_MADEIT = 55.27;  // "About a hundred tons made it."
export const T_RICH = 57.3;     // "He died rich."
export const T_KING = 58.55;    // "the Ice King"
export const T_NOJOKE2 = 61.85; // "no joke."

// ---------------- places ----------------
/** Boston wharf (land z >= 0, pier x -5..5 z -26..0), the frozen pond (snow field round x 240), Martinique (sand round
 *  x -240, pier x -245..-235), the jail cell (x 97..103, z 198..204), open sea (z -300) */
export const READER: V3 = [-1.5, 0, 6.0];
export const SHIP_BOSTON: V3 = [10.0, 0, -15.0];
export const ICE_STACK: V3 = [3.4, 0, -14.0];
export const POND: V3 = [240, 0, 40];
export const TROPIC_PIER: V3 = [-240, 0, -8];
export const SHIP_TROPIC: V3 = [-231, 0, -14];
export const ICEHOUSE: V3 = [-226, 0, 16];
export const BAR: V3 = [-252, 0, 12];
export const CELL: V3 = [100, 0, 200];
export const SEA_Z = -300;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "reader" | "wharf" | "pond" | "voyage" | "laugh" | "melt" | "jail" | "street" | "poke" | "icehouse" | "sawdust" | "bar" | "india" | "king" | "end";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 165, light: "day", crowd: "reader" },
  { id: 2, a: 165, b: 259, light: "day", crowd: "wharf" },
  { id: 3, a: 259, b: 322, light: "day", crowd: "pond" },
  { id: 4, a: 322, b: 428, light: "day", crowd: "voyage" },
  { id: 5, a: 428, b: 526, light: "day", crowd: "laugh" },
  { id: 6, a: 526, b: 773, light: "day", crowd: "melt" },
  { id: 7, a: 773, b: 923, light: "day", crowd: "jail" },
  { id: 8, a: 923, b: 1067, light: "day", crowd: "street" },
  { id: 9, a: 1067, b: 1132, light: "day", crowd: "poke" },
  { id: 10, a: 1132, b: 1277, light: "day", crowd: "icehouse" },
  { id: 11, a: 1277, b: 1372, light: "day", crowd: "sawdust" },
  { id: 12, a: 1372, b: 1512, light: "day", crowd: "bar" },
  { id: 13, a: 1512, b: 1707, light: "golden", crowd: "india" },
  { id: 14, a: 1707, b: 1787, light: "golden", crowd: "king" },
  { id: 15, a: 1787, b: TOTAL, light: "day", crowd: "end" },
];
/** crossfades (frames) where the time of day changes; everything else is a cut on a moving camera */
export const XFADE: Record<number, number> = { 13: 12, 15: 10 };
export const FLASH_AT = -1000; // no white flash
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- the ship ----------------
/** the brig: position, heading (yaw, 0 = bow toward -z) and a little roll/pitch from the swell */
export type ShipPose = { x: number; y: number; z: number; yaw: number; roll: number; pitch: number; visible: boolean };
export const SAIL_SPEED = 4.2; // m/s on the sea shots
export const shipAt = (id: number, t: number): ShipPose => {
  const bob = (k: number) => ({ y: -0.05 + 0.06 * Math.sin(t * 1.3 + k), roll: 0.018 * Math.sin(t * 1.1 + k), pitch: 0.01 * Math.sin(t * 0.9 + 2 + k) });
  if (id === 4 || id === 13) {
    const t0 = SHOTS[id - 1].a / FPS, x = -30 + (t - t0) * SAIL_SPEED, b = bob(1);
    return { x, y: b.y - 0.1, z: SEA_Z, yaw: -Math.PI / 2, roll: b.roll * 2.2, pitch: b.pitch * 2.5, visible: true };
  }
  if (id === 6) return { x: SHIP_TROPIC[0], z: SHIP_TROPIC[2], ...bob(2), yaw: 0, visible: true };
  if ([1, 2, 5, 11, 14, 15].includes(id)) return { x: SHIP_BOSTON[0], z: SHIP_BOSTON[2], ...bob(0), yaw: 0, visible: true };
  return { x: 0, y: -50, z: 0, yaw: 0, roll: 0, pitch: 0, visible: false };
};

// ---------------- dynamic ice blocks ----------------
/** a block of ice: centre of its base, size [w, h, d] in metres, yaw */
export type Block = { x: number; y: number; z: number; w: number; h: number; d: number; yaw: number };
const B = (x: number, y: number, z: number, s = 1, yaw = 0, melt = 1): Block => ({ x, y, z, w: 0.9 * s, h: 0.55 * s * melt, d: 0.6 * s, yaw });
/** S10: workers carry blocks from the cart into the icehouse door */
export const CARRY_T = [37.9, 38.8, 39.7, 40.6];
export const carryPath = (t: number, k: number): { x: number; z: number; u: number; walking: boolean } => {
  const t0 = CARRY_T[k], u = clamp01((t - t0) / 3.4);
  const a: [number, number] = [-232.5, 8.2], b: [number, number] = [ICEHOUSE[0] - 1.2, ICEHOUSE[2] - 3.4];
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, u, walking: t > t0 && u < 1 };
};
export const blocksAt = (id: number, t: number): Block[] => {
  const out: Block[] = [];
  if ([1, 2, 5, 11, 14, 15].includes(id)) {
    // stacks on the pier beside the brig
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) out.push(B(ICE_STACK[0] + j * 0.95, i * 0.56, ICE_STACK[2] - 1.0, 1, 0));
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) out.push(B(ICE_STACK[0] + j * 0.95, i * 0.56, ICE_STACK[2] + 0.3, 1, 0));
    out.push(B(ICE_STACK[0] + 0.6, 0, ICE_STACK[2] + 1.7, 1, 0.3));
  }
  if (id === 3) {
    // blocks already cut, lying on the pond ice
    for (const [x, z, yaw] of [[238.3, 35.0, 0.1], [238.9, 36.2, -0.2], [242.4, 35.6, 0.15], [242.0, 36.9, -0.1], [237.6, 33.9, 0.4]] as const) out.push(B(x, 0.02, z, 1, yaw));
  }
  if (id === 6) {
    // THE block on the Martinique pier: shrinks on "melted away"
    const m = 1 - 0.85 * smooth((t - T_MELT + 0.4) / 1.6);
    const s = 1.25 * (0.55 + 0.45 * m);
    out.push(B(TROPIC_PIER[0], 0.02, TROPIC_PIER[2], s, 0.25, m));
  }
  if (id === 9) out.push(B(-238.55, 0.92, 8.55, 0.45, 0.3));
  if (id === 10) {
    for (let k = 0; k < CARRY_T.length; k++) {
      const c = carryPath(t, k);
      if (c.u >= 1) continue;
      if (t < CARRY_T[k]) { out.push(B(-232.9, 0.85, 7.4 + (k % 2) * 0.62, 0.62, 0)); continue; }
      out.push(B(c.x + 0.35, 0.86 + 0.02 * Math.sin(t * 12), c.z - 0.25, 0.62, 0.6));
    }
    out.push(B(-233.4, 0.85, 7.4, 0.62, 0), B(-233.4, 0.85, 8.0, 0.62, 0));
  }
  if (id === 12) out.push(B(BAR[0] + 1.4, 1.12, BAR[2] - 0.05, 0.42, 0.2), B(BAR[0] + 1.85, 1.12, BAR[2] + 0.05, 0.42, -0.2));
  return out;
};

// ---------------- camera ----------------
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** smootherstep: zero velocity and acceleration at both ends, so every glide starts and lands softly */
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
/** every hold creeps in: a slow lens zoom (the camera stays put, so the foreground cast never leaves the frame) */
const dolly = (pos: V3, look: V3, f: number, f0: number, rate = 0.0025, rest: Partial<Cam> = {}): Shot => {
  const k = Math.exp(-rate * Math.max(0, f - f0)), fov = rest.fov ?? 40;
  return { pos, look, ...rest, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k) };
};
/** a slow sideways drift on top of a hold (metres per frame along x, z) */
const drift = (s: Shot, f: number, f0: number, dx: number, dz = 0): Shot => {
  const n = Math.max(0, f - f0);
  return { ...s, pos: [s.pos[0] + dx * n, s.pos[1], s.pos[2] + dz * n], look: [s.look[0] + dx * n * 0.6, s.look[1], s.look[2] + dz * n * 0.6] };
};
const shipX = (id: number, f: number) => shipAt(id, f / FPS).x;

const [RX, , RZ] = READER;
const CAMS: Record<number, Key[]> = {
  // hook: tight on the reader's paper, then on "No joke" a quick pull back to his face over the top of it
  1: [
    { f: 0, s: (f) => dolly([RX + 1.1, 1.3, RZ - 3.4], [RX + 0.05, 1.15, RZ], f, 0, 0.0016, { fov: 31, roll: 0.02 }) },
    { f: 118, dur: 22, s: (f) => dolly([RX + 1.5, 1.5, RZ - 4.4], [RX, 1.3, RZ], f, 118, 0.002, { fov: 36, roll: -0.025 }) },
  ],
  // the wharf: Tudor in front of his brig, blocks of ice going aboard; slow truck right along the pier
  2: [
    { f: 165, s: (f) => drift({ pos: [-2.4, 1.55, -5.2], look: [4.2, 1.9, -14.6], fov: 46, roll: 0.02 }, f, 165, 0.01, -0.005) },
  ],
  // the pond: low over the ice, the sawyers at work
  3: [
    { f: 259, s: (f) => dolly([239.0, 2.4, 25.6], [240.4, 0.7, 34.6], f, 259, 0.003, { fov: 48, roll: -0.02 }) },
  ],
  // aerial: the brig under sail across open water, camera keeping pace
  4: [
    { f: 322, s: (f) => { const x = shipX(4, f); return { pos: [x - 26, 15, SEA_Z - 30], look: [x + 3, 2, SEA_Z], fov: 44, roll: 0.03 }; } },
    { f: 322, dur: 106, s: (f) => { const x = shipX(4, f); return { pos: [x - 14, 7.5, SEA_Z - 24], look: [x + 2, 3, SEA_Z], fov: 42, roll: -0.01 }; } },
  ],
  // the townsfolk crowd round the paper and laugh
  5: [
    { f: 428, s: (f) => dolly([RX + 0.6, 1.45, RZ - 4.8], [RX - 0.2, 1.25, RZ + 0.3], f, 428, 0.0024, { fov: 44, roll: 0.02 }) },
  ],
  // Martinique pier: wide on arrival, push in on the melting block, then onto Tudor as the money flies
  6: [
    { f: 526, s: (f) => dolly([-235.6, 1.9, -16.8], [-239.4, 1.0, -7.8], f, 526, 0.0012, { fov: 48, roll: 0.02 }) },
    { f: 640, dur: 40, s: (f) => dolly([-238.4, 1.25, -12.4], [-240.0, 0.75, -8.0], f, 640, 0.0018, { fov: 38, roll: -0.02 }) },
    { f: 712, dur: 30, s: (f) => dolly([-237.0, 1.4, -11.4], [-238.4, 1.35, -7.3], f, 712, 0.003, { fov: 36, roll: 0.02 }) },
  ],
  // the cell: through the bars, a slow push in on Tudor on his bench
  7: [
    { f: 773, s: () => ({ pos: [100.9, 1.5, 194.4], look: [100.3, 1.0, 202.6], fov: 44, roll: 0.02 }) },
    { f: 773, dur: 150, s: () => ({ pos: [100.4, 1.25, 196.6], look: [100.3, 0.95, 202.6], fov: 36, roll: -0.01 }) },
  ],
  // a hot street: islanders fanning themselves over warm cups; slow drift
  8: [
    { f: 923, s: (f) => drift({ pos: [-242.6, 1.4, 4.4], look: [-240.4, 1.25, 9.8], fov: 46, roll: 0.02 }, f, 923, 0.012) },
  ],
  // close: an islander pokes the strange cold block
  9: [
    { f: 1067, s: (f) => dolly([-237.5, 1.35, 6.4], [-238.4, 1.15, 8.9], f, 1067, 0.004, { fov: 38, roll: -0.02 }) },
  ],
  // the new stone icehouse; workers carry blocks inside while Tudor watches, proud
  10: [
    { f: 1132, s: () => ({ pos: [-236.6, 1.8, 1.8], look: [-229.0, 1.9, 13.5], fov: 48, roll: 0.02 }) },
    { f: 1132, dur: 145, s: () => ({ pos: [-235.0, 1.6, 2.6], look: [-228.6, 1.8, 13.5], fov: 44, roll: -0.01 }) },
  ],
  // the wharf: sawdust shovelled over the blocks
  11: [
    { f: 1277, s: (f) => dolly([0.6, 1.6, -9.6], [3.6, 0.8, -14.6], f, 1277, 0.0028, { fov: 44, roll: 0.02 }) },
  ],
  // the bar: Tudor hands over the ice, the customers try a cold drink and grin
  12: [
    { f: 1372, s: (f) => drift({ pos: [-250.2, 1.6, 5.0], look: [-252.6, 1.3, 11.6], fov: 50, roll: -0.02 }, f, 1372, -0.006) },
  ],
  // golden: the long voyage, a low tracking shot beside the hull, then rising to see the endless sea
  13: [
    { f: 1506, s: (f) => { const x = shipX(13, f); return { pos: [x - 16, 3.2, SEA_Z - 30], look: [x + 1, 5.0, SEA_Z], fov: 46, roll: 0.02 }; } },
    { f: 1590, dur: 117, s: (f) => { const x = shipX(13, f); return { pos: [x - 26, 10, SEA_Z - 36], look: [x + 6, 4, SEA_Z], fov: 46, roll: -0.02 }; } },
  ],
  // golden: old Tudor, rich, crowned, in front of his ice
  14: [
    { f: 1707, s: (f) => dolly([1.0, 1.35, -7.4], [2.2, 1.6, -11.6], f, 1707, 0.003, { fov: 40, roll: 0.02 }) },
  ],
  // the reader again, a glass of iced drink in hand; a slow push in to his grin
  15: [
    { f: 1782, s: () => ({ pos: [RX + 1.6, 1.5, RZ - 4.4], look: [RX - 0.1, 1.3, RZ], fov: 42, roll: 0.02 }) },
    { f: 1782, dur: 108, s: () => ({ pos: [RX + 0.8, 1.38, RZ - 2.8], look: [RX - 0.05, 1.28, RZ], fov: 34, roll: -0.01 }) },
  ],
};
/** impact kicks: flip sign every frame, decay over 7 frames */
const KICKS = [T_NOJOKE, T_ITDID, T_LOCKED, T_KING];
export const kickAt = (t: number) => {
  for (const k of KICKS) { const n = Math.round((t - k) * FPS); if (n >= 0 && n < 7) return (n % 2 ? -1 : 1) * (1 - n / 7); }
  return 0;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a * 2.5;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.006 };
};

// ---------------- lens blur per beat (cInf px at 1080; 0 = sharp) ----------------
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 13, focus: () => [RX, 1.2, RZ - 0.3] },
  { f: 165, cInf: 8, focus: () => [2.4, 1.4, -10.4] },
  { f: 259, cInf: 10, focus: () => [240.2, 0.8, 33.0] },
  { f: 322, cInf: 0 },
  { f: 428, cInf: 11, focus: () => [RX, 1.3, RZ] },
  { f: 526, cInf: 8, focus: () => [-240.0, 0.9, -7.8] },
  { f: 640, dur: 30, cInf: 12, focus: () => [-240.0, 0.7, -8.0] },
  { f: 712, dur: 20, cInf: 12, focus: () => [-238.2, 1.4, -7.2] },
  { f: 773, cInf: 11, focus: () => [100.3, 1.0, 202.6] },
  { f: 923, cInf: 9, focus: () => [-240.4, 1.2, 9.0] },
  { f: 1067, cInf: 14, focus: () => [-238.4, 1.1, 8.8] },
  { f: 1132, cInf: 6, focus: () => [-230.6, 1.4, 9.4] },
  { f: 1277, cInf: 10, focus: () => [3.6, 0.9, -13.6] },
  { f: 1372, cInf: 10, focus: () => [-252.0, 1.4, 11.0] },
  { f: 1512, cInf: 0 },
  { f: 1707, cInf: 10, focus: () => [2.2, 1.5, -11.0] },
  { f: 1787, cInf: 11, focus: () => [RX, 1.3, RZ] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
