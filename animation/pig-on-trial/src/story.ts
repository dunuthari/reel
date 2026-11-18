// "The Pig on Trial": 60 s short in the flat-characters-in-a-3D-toon-world style.
// Timeline keyed to the Kokoro narration (voiceover/pig-on-trial/lines.json, sentence starts in seconds):
//   S1  0.00 hook: the sow in the dock, the judge looms        | "In 1386, a pig in France was put on trial for murder. And it lost."
//   S2  5.25 aerial: Falaise and its castle                     | "Picture the town of Falaise, in Normandy."
//   S3  7.61 the square: the sow, shocked townsfolk             | "A sow had attacked a little child. The child was badly hurt, and later died."
//   S4 12.06 the hall: a guard leads the sow to the dock        | "So the court did what courts did back then. It put the animal on trial..."
//   S5 17.52 the judge reads the sentence                       | "The sentence was brutal. The sow was to be mangled and maimed..."
//   S6 21.60 the sow, shocked                                   | "...then hanged."
//   S7 23.36 the square: crowds gather at the scaffold          | "The town came to watch. Crowds gathered in the square."
//   S8 26.55 the hall: a queue of animal defendants             | "Here's the strange part. Animals really were treated as legal creatures..."
//   S9 32.19 tracking shot: pig, goat and cow walk on four legs | "Judges thought a crime needed a punishment, even when the criminal walked on four legs."
//   S10 37.29 golden: the townsfolk, quiet                      | "You see, the trial was never really about the pig..."
//   S11 44.42 golden: the empty scaffold against the sunset     | "Hanging the animal gave the town a sense that the wrong had been put right."
//   S12 48.48 golden: the hangman's table, receipt and glove    | "The hangman got paid, too. His receipt still survives..."
//   S13 54.43 the hall: everyone talks, the sow says nothing    | "So the pig lost. It was the only one in that courtroom who never got to say a word."
export const FPS = 30;
export const TOTAL = 1800; // 60 s (narration 59.24 s)
export const D0 = 0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

/** narration word times (s) the action keys on (sentence starts from lines.json, words placed by character share) */
export const T_LOST = 4.5;      // "lost"
export const T_ATTACK = 8.1;    // "attacked"
export const T_HURT = 9.9;      // "badly hurt"
export const T_CHARGE = 7.62;  // the sow starts her charge
export const T_BITE = 8.55;    // first bite
export const T_WALK0 = 12.3, T_WALK1 = 15.9; // the guard walks the sow to the dock
export const T_BRUTAL = 18.3;   // "brutal"
export const T_HANGED = 22.55;  // "hanged"
export const T_CROWD = 24.81;   // "Crowds gathered"
export const T_FOUR = 36.2;     // "four legs"
export const T_YOUSEE = 37.29;  // "You see"
export const T_RECEIPT = 50.2;  // "receipt"
export const T_GLOVE = 52.9;    // "glove"
export const T_LOST2 = 54.6;    // "So the pig lost"

// ---------------- places ----------------
/** the sow's spot in the dock, the judge behind his desk on the dais, the hangman's table */
export const DOCK: V3 = [0, 0.06, 16.6];
export const JUDGE: V3 = [0, 1.05, 23.6]; // stands on a step behind the desk (desk top 1.6 m)
export const TABLE: V3 = [13.5, 0, 6.0];
export const GALLOWS: V3 = [14, 0, -14];

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "hook" | "aerial" | "street" | "enter" | "judge" | "pigShock" | "gather" | "queue" | "walk" | "quiet" | "scaffold" | "hangman" | "talk";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 153, light: "day", crowd: "hook" },
  { id: 2, a: 153, b: 226, light: "day", crowd: "aerial" },
  { id: 3, a: 226, b: 357, light: "day", crowd: "street" },
  { id: 4, a: 357, b: 520, light: "day", crowd: "enter" },
  { id: 5, a: 520, b: 648, light: "day", crowd: "judge" },
  { id: 6, a: 648, b: 696, light: "day", crowd: "pigShock" },
  { id: 7, a: 696, b: 792, light: "day", crowd: "gather" },
  { id: 8, a: 792, b: 963, light: "day", crowd: "queue" },
  { id: 9, a: 963, b: 1113, light: "day", crowd: "walk" },
  { id: 10, a: 1113, b: 1329, light: "golden", crowd: "quiet" },
  { id: 11, a: 1329, b: 1449, light: "golden", crowd: "scaffold" },
  { id: 12, a: 1449, b: 1629, light: "golden", crowd: "hangman" },
  { id: 13, a: 1629, b: TOTAL, light: "day", crowd: "talk" },
];
/** crossfades (frames) where the time of day changes; everything else is a cut on a moving camera */
export const XFADE: Record<number, number> = { 10: 12, 13: 10 };
export const FLASH_AT = -1000; // no white flash
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- the walking animals (S4 and S9) ----------------
/** the sow led from the side of the hall to the dock (S4) */
export const sowWalk = (t: number): { x: number; z: number; walking: boolean; phase: number } => {
  const u = smooth((t - T_WALK0) / (T_WALK1 - T_WALK0));
  const x = -6.2 + (DOCK[0] + 6.2) * u, z = 13.0 + (DOCK[2] - 13.0) * u;
  const walking = t > T_WALK0 && t < T_WALK1 - 0.1;
  return { x, z, walking, phase: walking ? ((t - T_WALK0) * 1.6) % 1 : 0 };
};
/** S9: the three animals walk along x across the square at 1.1 m/s */
export const WALK_T0 = 963 / FPS;
export const walkX = (t: number) => -11 + (t - WALK_T0) * 1.1;
export const WALK_Z = -6;

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

const CAMS: Record<number, Key[]> = {
  // hook: tight on the sow in the dock, then pull back and up to find the judge looming over her
  1: [
    { f: 0, s: (f) => dolly([2.1, 0.9, 12.6], [-0.15, 0.68, 16.5], f, 0, 0.0018, { fov: 27, roll: 0.02 }) },
    { f: 52, dur: 80, s: (f) => dolly([2.4, 1.45, 11.6], [0.35, 1.55, 19.8], f, 52, 0.0012, { fov: 44, roll: -0.03 }) },
  ],
  // aerial over the rooftops toward the castle on its hill
  2: [
    { f: 153, s: (f) => drift({ pos: [74, 54, -96], look: [-8, 14, 70], fov: 42, roll: 0.03 }, f, 153, -0.22, 0.2) },
  ],
  // the square: the sow among the townsfolk; on "attacked" they jump back, then a slow push in on the mother
  3: [
    { f: 226, s: (f) => dolly([-5.45, 1.0, -13.0], [-5.45, 0.72, -6.0], f, 226, 0.0015, { fov: 40, roll: -0.02 }) },
    { f: 241, dur: 14, s: (f) => dolly([-3.9, 0.62, -10.6], [-3.9, 0.42, -6.0], f, 241, 0.002, { fov: 34, roll: 0.025 }) },
    { f: 292, dur: 54, s: (f) => dolly([-3.75, 1.05, -11.8], [-3.75, 0.62, -6.0], f, 292, 0.0022, { fov: 38, roll: -0.015 }) },
  ],
  // crane from the square into the hall while the guard walks the sow to the dock
  4: [
    { f: 357, s: () => ({ pos: [7.0, 4.6, 0.5], look: [-1.5, 1.6, 16.5], fov: 46, roll: 0.03 }) },
    { f: 357, dur: 163, s: () => ({ pos: [2.0, 2.0, 8.2], look: [-0.9, 1.15, 17.0], fov: 42, roll: -0.01 }) },
  ],
  // the judge reads the sentence from his scroll; slow drift and zoom
  5: [
    { f: 520, s: (f) => { const u = glide((f - 520) / 128); return dolly([1.1 - 0.8 * u, 2.25, 18.6], [0, 2.25, JUDGE[2]], f, 520, 0.0018, { fov: 36, roll: 0.02 - 0.03 * u }); } },
  ],
  // the sow's face on "hanged": quick push in, impact kick
  6: [
    { f: 648, s: (f) => dolly([0.9, 0.66, 14.4], [-0.35, 0.58, 16.45], f, 648, 0.004, { fov: 34, roll: -0.03 }) },
  ],
  // the square: townsfolk gather in front of the scaffold, the camera cranes up over them
  7: [
    { f: 696, s: () => ({ pos: [-4.0, 1.6, -30.5], look: [11, 2.4, -14], fov: 46, roll: 0.02 }) },
    { f: 696, dur: 100, s: () => ({ pos: [-5.5, 3.8, -31.5], look: [11, 2.9, -14], fov: 44, roll: 0 }) },
  ],
  // a queue of animal defendants beside the dock: a slow truck along the line
  8: [
    { f: 792, s: () => ({ pos: [-1.8, 1.45, 8.0], look: [-3.2, 0.95, 15.2], fov: 46, roll: 0.02 }) },
    { f: 792, dur: 171, s: () => ({ pos: [-5.8, 1.55, 8.4], look: [-5.0, 1.05, 15.2], fov: 44, roll: -0.02 }) },
  ],
  // tracking shot alongside the walking animals (the camera travels with them)
  9: [
    { f: 963, s: (f) => { const x = walkX(f / FPS) - 1.75; return { pos: [x - 0.3, 1.05, WALK_Z - 10.4], look: [x, 0.8, WALK_Z], fov: 52, roll: 0.01 }; } },
    { f: 1040, dur: 73, s: (f) => { const x = walkX(f / FPS) - 1.75; return { pos: [x - 1.6, 1.35, WALK_Z - 10.8], look: [x, 0.85, WALK_Z], fov: 52, roll: -0.02 }; } },
  ],
  // golden: the townsfolk standing quietly; a long slow push in
  10: [
    { f: 1107, s: () => ({ pos: [1.8, 1.6, -19.5], look: [-1.0, 1.45, -8.5], fov: 42, roll: 0.02 }) },
    { f: 1107, dur: 222, s: () => ({ pos: [0.5, 1.5, -15.4], look: [-1.0, 1.45, -8.5], fov: 37, roll: -0.01 }) },
  ],
  // golden: the empty scaffold backlit by the low sun, the crowd drifting home
  11: [
    { f: 1329, s: (f) => drift({ pos: [2.0, 1.1, -33], look: [14, 3.4, -14], fov: 40, roll: 0.02 }, f, 1329, 0.022) },
  ],
  // golden: the hangman counts his pay, then down onto the table: the receipt and the new glove
  12: [
    { f: 1449, s: (f) => dolly([12.4, 1.55, 2.6], [13.5, 1.3, 6.5], f, 1449, 0.0018, { fov: 40, roll: 0.02 }) },
    { f: 1528, dur: 66, s: (f) => dolly([13.62, 2.5, 4.85], [13.6, 0.86, 6.0], f, 1528, 0.0014, { fov: 50, roll: -0.01 }) },
  ],
  // the hall: everyone talks, the sow says nothing; a long push in to her face
  13: [
    { f: 1624, s: () => ({ pos: [2.8, 1.3, 10.6], look: [0, 0.95, 16.6], fov: 46, roll: 0.02 }) },
    { f: 1624, dur: 176, s: () => ({ pos: [1.0, 0.78, 13.6], look: [-0.3, 0.62, 16.5], fov: 27, roll: -0.01 }) },
  ],
};
/** impact kicks: flip sign every frame, decay over 7 frames */
const KICKS = [T_LOST, T_ATTACK, T_BITE, T_HANGED];
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
  { f: 0, cInf: 13, focus: () => [-0.2, 0.6, 16.5] },
  { f: 52, dur: 50, cInf: 8, focus: () => [0, 2.5, 23.6] },
  { f: 153, cInf: 0 },
  { f: 226, cInf: 10, focus: () => [-5.2, 0.6, -6.0] },
  { f: 241, dur: 14, cInf: 13, focus: () => [-4.3, 0.4, -6.0] },
  { f: 292, dur: 40, cInf: 11, focus: () => [-3.9, 0.6, -5.9] },
  { f: 357, cInf: 6, focus: (f) => { const s = sowWalk(f / FPS); return [s.x, 0.7, s.z]; } },
  { f: 520, cInf: 12, focus: () => [0, 2.5, 23.6] },
  { f: 648, cInf: 14, focus: () => [-0.35, 0.58, 16.45] },
  { f: 696, cInf: 0 },
  { f: 792, cInf: 8, focus: () => [-4.0, 0.8, 15.2] },
  { f: 963, cInf: 7, focus: (f) => [walkX(f / FPS) - 1.75, 0.7, WALK_Z] },
  { f: 1113, cInf: 7, focus: () => [-1.0, 1.5, -9.0] },
  { f: 1329, cInf: 0 },
  { f: 1449, cInf: 9, focus: () => [13.5, 1.5, 6.9] },
  { f: 1528, dur: 50, cInf: 12, focus: () => [13.62, 0.86, 6.0] },
  { f: 1629, cInf: 10, focus: () => [-0.3, 0.6, 16.5] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
