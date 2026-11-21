// "The Bug That Made GTA": 60 s short in the flat-characters-in-a-3D-toon-world style (built from the Ice King short).
// Timeline keyed to the Kokoro narration (voiceover/gta-bug/lines.json + words.json, seconds):
//   S1   0.00 city: a police cruiser rams the red car          | "The biggest crime game on Earth only exists because the police were broken."
//   S2   4.02 Dundee: a sandstone street, 1995                 | "In 1995, in Dundee, Scotland, a small studio..."
//   S3   7.60 the office: devs at beige CRTs                    | "...called DMA Design started a new game."
//   S4  10.00 the trophy shelf, a dev proud                      | "The same team that made Lemmings."
//   S5  11.82 a CRT screen: the top-down game, neat chase        | "It was called Race and Chase. A simple driving game about cops and robbers."
//   S6  16.00 the office: slumped devs, the clock, the publisher | "But it was not going well... wanted to cancel it."
//   S7  21.10 close: a dev, lit by his screen, startled          | "Then something weird happened."
//   S8  22.60 city: the police go crazy                          | "The police cars went crazy... smashing into anything to stop you."
//   S9  29.70 a CRT: code, a cartoon bug, mad routes             | "It was a bug. The code that told the police where to drive was broken."
//   S10 33.48 the office: the team crowds round, laughing        | "You see, the team should have fixed it. But when people played it..."
//   S11 40.00 the office: the rule binder goes in the bin        | "So they kept the bug. They threw out the boring rules."
//   S12 42.70 city: the new hero, the bad guy, by his red car    | "And they made you the bad guy."
//   S13 44.30 the whiteboard: a new name                         | "They gave the game a new name. Grand Theft Auto."
//   S14 47.00 golden: a mountain of game boxes, cheering fans    | "It came out in 1997. Today, the series has sold over 470 million games."
//   S15 52.80 city: a cruiser rams you off the road              | "So next time a GTA cop rams you off the road,"
//   S16 55.55 the cop by his cruiser, grinning                   | "don't get mad. He's not broken. He's the reason the game exists."
export const FPS = 30;
export const TOTAL = 1800; // 60 s (narration 59.25 s)
export const D0 = 0;
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;

/** narration word times (s) the action keys on (words.json) */
export const T_BROKEN = 3.33;    // "broken."
export const T_DUNDEE = 5.89;    // "Dundee"
export const T_LEMMINGS = 11.11; // "Lemmings."
export const T_COPS = 14.91;     // "cops and robbers"
export const T_NOTWELL = 16.62;  // "not going well"
export const T_BEHIND = 17.93;   // "behind schedule"
export const T_COMPANY = 19.16;  // "the company paying for it"
export const T_CANCEL = 20.41;   // "cancel it"
export const T_WEIRD = 21.75;    // "weird"
export const T_CRAZY = 23.74;    // "went crazy"
export const T_RAMMED = 25.72;   // "rammed you"
export const T_HUNTED = 26.49;   // "hunted you"
export const T_SMASH = 27.73;    // "smashing into anything"
export const T_BUG = 30.32;      // "bug."
export const T_DRIVE = 32.45;    // "where to drive was broken"
export const T_FIXED = 34.56;    // "fixed it"
export const T_PLAYED = 35.91;   // "played it"
export const T_FUN = 38.3;       // "the most fun part"
export const T_KEPT = 40.43;     // "kept the bug"
export const T_RULES = 42.26;    // "boring rules."
export const T_BADGUY = 43.64;   // "the bad guy"
export const T_NAME = 45.22;     // "a new name"
export const T_GTA = 45.73;      // "Grand Theft Auto"
export const T_1997 = 47.74;     // "1997"
export const T_SOLD = 50.17;     // "sold"
export const T_MILLION = 51.89;  // "470 million games"
export const T_RAMS = 54.38;     // "rams you off the road"
export const T_MAD = 56.06;      // "don't get mad"
export const T_NOTBROKEN = 56.94; // "He's not broken."
export const T_REASON = 58.16;   // "the reason"
export const T_EXISTS = 58.9;    // "exists."

// ---------------- places ----------------
/** the city: an avenue along z (x -7..7, cars drive toward -z), cross streets every 50 m (z = -150..150, 10 m wide),
 *  sidewalks to |x| 11, tall blocks beyond. Dundee: a sandstone street along x round x 300. The office: a room
 *  x -307..-293, z -5..5, 3.2 m high, back wall (windows, whiteboard) at z +5. */
export const OFFICE: V3 = [-300, 0, 0];
export const DESKS = [-305, -301.7, -298.3, -295]; // desk centres (x), at z = 1.4; devs sit behind them at z = 2.25
export const DESK_Z = 1.4, SEAT_Z = 2.25;
export const HERO = 1; // the desk whose screen is the story's screen (x -301.7)
/** monitors sit left of centre on each desk, so a dev's face stays clear of his screen from the front */
export const MON_DX = -0.45;
export const BOARD: V3 = [-302.6, 1.7, 4.9];  // 1.7 x 1.25 m  // whiteboard centre (on the back wall)
export const SHELF: V3 = [-306.9, 1.55, -1.2]; // trophy shelf on the left wall
export const BIN: V3 = [-296.2, 0, -0.6];
export const DUNDEE: V3 = [300, 0, 0];
export const PILE: V3 = [0, 0, 150];           // the golden mountain of boxes, in the far intersection
export const ROBBER_CAR: V3 = [3.2, 0, 62];

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "hook" | "dundee" | "office" | "trophy" | "screen" | "cancel" | "face" | "chaos" | "code" | "laugh" | "binder" | "robber" | "board" | "pile" | "rams" | "cop";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 120, light: "day", crowd: "hook" },
  { id: 2, a: 120, b: 228, light: "day", crowd: "dundee" },
  { id: 3, a: 228, b: 300, light: "day", crowd: "office" },
  { id: 4, a: 300, b: 354, light: "day", crowd: "trophy" },
  { id: 5, a: 354, b: 477, light: "day", crowd: "screen" },
  { id: 6, a: 477, b: 632, light: "day", crowd: "cancel" },
  { id: 7, a: 632, b: 678, light: "day", crowd: "face" },
  { id: 8, a: 678, b: 891, light: "day", crowd: "chaos" },
  { id: 9, a: 891, b: 1004, light: "day", crowd: "code" },
  { id: 10, a: 1004, b: 1200, light: "day", crowd: "laugh" },
  { id: 11, a: 1200, b: 1281, light: "day", crowd: "binder" },
  { id: 12, a: 1281, b: 1329, light: "day", crowd: "robber" },
  { id: 13, a: 1329, b: 1410, light: "day", crowd: "board" },
  { id: 14, a: 1410, b: 1584, light: "day", crowd: "pile" },
  { id: 15, a: 1584, b: 1666, light: "day", crowd: "rams" },
  { id: 16, a: 1666, b: TOTAL, light: "day", crowd: "cop" },
];
/** crossfades (frames) where the time of day changes; everything else is a cut */
export const XFADE: Record<number, number> = {};
export const FLASH_AT = 100; // a white flash on the hook's crash ("broken")
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- cars ----------------
/** a car: kind, centre of its footprint, yaw (0 = nose toward -z), body roll (lean), visible */
export type CarKind = "player" | "police" | "civA" | "civB" | "civC" | "civD" | "civE";
export type Car = { kind: CarKind; x: number; z: number; yaw: number; lean: number; siren?: boolean };
const bump = (t: number, t0: number, dur = 0.5) => (t > t0 && t < t0 + dur ? Math.sin(((t - t0) / dur) * Math.PI) * (1 - (t - t0) / dur) : 0);
/** a car driving toward -z from z0 at speed v from t0, in lane x, with a lane-change curve dx(t) */
const drive = (kind: CarKind, t: number, t0: number, z0: number, v: number, x: number | ((t: number) => number), extra: Partial<Car> = {}): Car => {
  const X = typeof x === "number" ? () => x : x, z = z0 - v * (t - t0);
  const vx = (X(t + 0.05) - X(t - 0.05)) / 0.1;
  return { kind, x: X(t), z, yaw: -Math.atan2(vx, v), lean: -vx * 0.012, ...extra };
};
/** parked cars along the kerbs (static, both sides) */
const PARKED: Car[] = (() => {
  const out: Car[] = [], kinds: CarKind[] = ["civA", "civB", "civC", "civD", "civE"];
  let k = 0;
  for (let z = -190; z <= 190; z += 11) {
    if (Math.abs((((z + 175) % 50) + 50) % 50 - 25) < 9) continue; // keep the cross streets clear
    if (Math.abs(z - ROBBER_CAR[2]) < 8) continue;
    if ((k * 7) % 5 !== 3) out.push({ kind: kinds[k % 5], x: -6.2, z, yaw: Math.PI, lean: 0 });
    if ((k * 3) % 4 !== 1) out.push({ kind: kinds[(k + 2) % 5], x: 6.2, z: z + 4, yaw: 0, lean: 0 });
    k++;
  }
  return out;
})();
export const carsAt = (id: number, t: number): Car[] => {
  const out: Car[] = [];
  if (id === 1) {
    // the red car flies toward the lens; the cruiser swerves in behind and rams it on "broken"
    const t0 = 0, ram = T_BROKEN - 0.1;
    const px = (u: number) => 1.8 + 1.6 * smooth((u - ram) / 0.5);
    out.push(drive("player", t, t0, 32, 13, px, { lean: 0.08 * bump(t, ram, 0.6) }));
    const cx = (u: number) => -1.7 + 1.1 * Math.sin(u * 2.6) + 1.75 * smooth((u - ram + 0.3) / 0.3) - 0.6 * smooth((u - ram) / 0.5);
    out.push(drive("police", t, t0, 39.2, 14.85, cx, { siren: true }));
    out.push(...PARKED);
  }
  if (id === 8 || id === 15) {
    // the chase: the red car, three cruisers that ram, swerve onto the pavement and spin
    const t0 = SHOTS[id - 1].a / FPS, z0 = id === 8 ? 150 : -10;
    const ram = id === 8 ? T_RAMMED - 0.05 : T_RAMS - 0.05;
    const px = (u: number) => 1.5 + 2.4 * smooth((u - ram) / 0.45) - (id === 8 ? 2.2 * smooth((u - ram - 1.4) / 1.2) : -1.6 * smooth((u - ram - 0.4) / 0.6));
    out.push(drive("player", t, t0, z0, 14, px, { lean: 0.1 * bump(t, ram, 0.6) * (id === 8 ? 1 : 1.4) }));
    // cop A: rams from the left
    const ax = (u: number) => -2.4 + 3.2 * smooth((u - ram + 0.5) / 0.5) - 1.2 * smooth((u - ram - 0.3) / 0.8);
    const A = drive("police", t, t0, z0 + 8, 14, ax, { siren: true });
    // closes the 8 m gap to draw level on the ram, then drops back
    A.z = out[0].z + 1.2 + 6.8 * (1 - smooth((t - t0) / (ram - t0))) + 3.5 * smooth((t - ram - 0.3) / 1.4);
    out.push(A);
    if (id === 8) {
      // cop B: weaves wildly, jumps the kerb into the bins on "smashing"
      const bx = (u: number) => 3.6 * Math.sin((u - t0) * 2.1) + (u > T_SMASH - 1 ? 7.2 * smooth((u - T_SMASH + 1) / 1.0) : 0);
      const B = drive("police", t, t0, z0 + 15, 14.6, bx, { siren: true });
      if (t > T_SMASH + 0.05) { B.z = z0 + 15 - 14.6 * (T_SMASH + 0.05 - t0) - 1.5 * smooth((t - T_SMASH) / 0.6); B.yaw = 0.55 + 0.4 * smooth((t - T_SMASH) / 0.6); B.x = Math.min(B.x, 9.0); }
      out.push(B);
      // cop C: spins out behind
      const C = drive("police", t, t0, z0 + 24, 14.2, (u) => -1.0 + 2.5 * Math.sin((u - t0) * 1.4 + 1));
      if (t > T_HUNTED) C.yaw += 3.6 * smooth((t - T_HUNTED) / 1.6);
      C.siren = true;
      out.push(C);
    }
    out.push(...(id === 15 ? PARKED.filter((c) => c.x < 0 || c.z > 0 || c.z < -60) : PARKED));
  }
  if (id === 12) {
    out.push({ kind: "player", x: ROBBER_CAR[0], z: ROBBER_CAR[2], yaw: 0.25, lean: 0 });
    out.push({ kind: "police", x: -1.4, z: ROBBER_CAR[2] + 14, yaw: -0.15, lean: 0, siren: true });
    out.push(...PARKED);
  }
  if (id === 16) {
    // the cruiser pulled up, nose in; the red car crumpled on the kerb behind
    out.push({ kind: "police", x: 2.2, z: -80, yaw: 0.35, lean: 0, siren: true });
    out.push({ kind: "player", x: 7.4, z: -88.5, yaw: 0.9, lean: 0.05 });
    out.push(...PARKED.filter((c) => Math.abs(c.z + 85) > 12));
  }
  if (id === 2) {
    // a few 90s cars parked in Dundee
    for (const [x, z, k, yaw] of [[312, -3.2, "civB", Math.PI / 2], [307, -3.2, "civD", Math.PI / 2], [318, 3.2, "civA", -Math.PI / 2], [296, 3.2, "civE", -Math.PI / 2]] as const)
      out.push({ kind: k as CarKind, x, z, yaw, lean: 0 });
  }
  return out;
};
export const sirenOn = (t: number) => Math.floor(t * 6) % 2 === 0;

// ---------------- the pile of game boxes ----------------
/** how many boxes of the pile are in (grows on "sold" through "million") */
export const pileCount = (t: number) => Math.floor(40 + 2200 * smooth((t - T_1997 + 0.3) / (T_MILLION + 0.6 - T_1997)));

// ---------------- screens + whiteboard ----------------
/** what the hero CRT shows: the neat game, the mad game, code */
export type ScreenMode = { kind: "game" | "mad" | "code"; t: number; bug?: number };
export const screenAt = (id: number, t: number): ScreenMode => {
  if (id === 9) return t < 31.35 ? { kind: "code", t, bug: clamp01((t - T_BUG + 0.5) / 1.6) } : { kind: "mad", t };
  if (id === 7 || id === 10) return { kind: "mad", t };
  if (id === 6) return { kind: "game", t, bug: -1 };
  return { kind: "game", t };
};
/** whiteboard: the old name, crossed out on "new name", the new one written letter by letter on "Grand Theft Auto" */
export const boardAt = (t: number) => ({ cross: clamp01((t - T_NAME + 0.2) / 0.4), write: clamp01((t - T_GTA + 0.1) / 0.9) });

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
/** z of the red car in a chase shot */
const pz = (id: number, f: number) => carsAt(id, f / FPS)[0].z;

const [OX] = OFFICE;
const HX = DESKS[HERO] + MON_DX, DX = DESKS[HERO] + 0.15; // the hero screen / the hero dev
const CAMS: Record<number, Key[]> = {
  // hook: a low tracking shot ahead of the red car, the cruiser weaving behind; it rams on "broken"
  1: [
    { f: 0, s: (f) => { const z = pz(1, f); return { pos: [-4.6, 1.3, z - 10.5], look: [0.9, 1.1, z + 2.5], fov: 46, roll: 0.03 }; } },
    { f: 40, dur: 60, s: (f) => { const z = pz(1, f); return { pos: [-3.6, 1.1, z - 8.0], look: [1.0, 1.0, z + 1.6], fov: 46, roll: -0.03 }; } },
  ],
  // Dundee: down a sandstone street toward the studio, a slow glide
  2: [
    { f: 120, s: (f) => drift({ pos: [281, 1.75, -4.2], look: [300, 3.2, 3.6], fov: 50, roll: 0.02 }, f, 120, 0.045) },
  ],
  // the office, diagonal along the row of desks
  3: [
    { f: 228, s: (f) => dolly([-306.2, 1.65, -2.6], [-299.0, 1.05, 2.6], f, 228, 0.0025, { fov: 50, roll: 0.02 }) },
  ],
  // the trophy shelf, a dev proud beside it
  4: [
    { f: 300, s: (f) => dolly([-303.3, 1.45, -4.3], [-306.4, 1.3, -1.0], f, 300, 0.004, { fov: 46, roll: -0.02 }) },
  ],
  // the hero screen: from behind the monitor's front, push into the glass
  5: [
    { f: 354, s: () => ({ pos: [HX, 1.25, SEAT_Z + 0.95], look: [HX, 1.0, DESK_Z - 0.2], fov: 44, roll: 0.0 }) },
    { f: 354, dur: 110, s: () => ({ pos: [HX, 1.06, DESK_Z + 0.78], look: [HX, 1.03, DESK_Z - 0.2], fov: 38, roll: 0.0 }) },
  ],
  // the office goes grey: slumped devs, then the publisher walks in
  6: [
    { f: 477, s: (f) => dolly([-297.6, 1.4, -1.2], [-302.5, 0.98, 2.25], f, 477, 0.0018, { fov: 50, roll: 0.02 }) },
    { f: 572, dur: 40, s: (f) => dolly([-297.0, 1.5, -2.4], [-299.3, 1.3, 0.1], f, 572, 0.003, { fov: 44, roll: -0.02 }) },
  ],
  // close: the hero dev, lit by his screen
  7: [
    { f: 632, s: (f) => dolly([DX + 0.3, 1.32, -0.9], [DX - 0.05, 1.02, SEAT_Z], f, 632, 0.005, { fov: 34, roll: 0.02 }) },
  ],
  // the chase: ahead of the pack low, then a high angle on "smashing"
  8: [
    { f: 678, s: (f) => { const z = pz(8, f); return { pos: [-3.2, 1.3, z - 12.5], look: [1.0, 1.4, z + 6], fov: 46, roll: -0.03 }; } },
    { f: 780, cut: true, s: (f) => { const z = pz(8, f); return { pos: [-7.5, 9.5, z - 16], look: [2.5, 0.5, z + 9], fov: 50, roll: 0.02 }; } },
    { f: 800, dur: 90, s: (f) => { const z = pz(8, f); return { pos: [-6.0, 7.0, z - 13], look: [3.5, 0.6, z + 10], fov: 50, roll: -0.02 }; } },
  ],
  // the code screen and the bug, then the mad routes
  9: [
    { f: 891, s: (f) => dolly([HX, 1.03, DESK_Z + 0.98], [HX, 1.0, DESK_Z - 0.2], f, 891, 0.0016, { fov: 38 }) },
  ],
  // the team crowds round the hero screen, laughing
  10: [
    { f: 1004, s: (f) => dolly([-301.2, 1.55, -1.6], [-301.6, 1.25, 2.3], f, 1004, 0.0012, { fov: 50, roll: -0.02 }) },
    { f: 1060, dur: 60, s: (f) => dolly([-300.4, 1.45, -1.7], [-301.5, 1.3, 2.4], f, 1060, 0.0016, { fov: 48, roll: 0.02 }) },
  ],
  // the binder into the bin
  11: [
    { f: 1200, s: (f) => dolly([-293.9, 1.5, -3.6], [-296.6, 0.9, 0.3], f, 1200, 0.003, { fov: 48, roll: 0.02 }) },
  ],
  // the bad guy by his red car, a cruiser's lights behind
  12: [
    { f: 1281, s: (f) => dolly([ROBBER_CAR[0] - 1.2, 1.35, ROBBER_CAR[2] - 7.4], [ROBBER_CAR[0] + 0.9, 1.15, ROBBER_CAR[2] + 0.2], f, 1281, 0.005, { fov: 44, roll: -0.03 }) },
  ],
  // the whiteboard
  13: [
    { f: 1329, s: (f) => dolly([BOARD[0] + 0.2, 1.55, 0.0], [BOARD[0], 1.5, BOARD[2]], f, 1329, 0.0025, { fov: 44, roll: 0.01 }) },
  ],
  // golden: the pile of boxes rises; tilt up with it
  14: [
    { f: 1404, s: () => ({ pos: [-3.5, 1.6, 124], look: [0, 3.2, 150], fov: 50, roll: 0.02 }) },
    { f: 1440, dur: 144, s: () => ({ pos: [-4.5, 2.0, 119], look: [0, 8.0, 150], fov: 58, roll: -0.02 }) },
  ],
  // the cruiser rams the red car off the road
  15: [
    { f: 1584, s: (f) => { const z = pz(15, f); return { pos: [-4.0, 1.4, z - 11], look: [1.6, 1.2, z + 5], fov: 46, roll: 0.03 }; } },
  ],
  // the cop by his cruiser, push in to his grin
  16: [
    { f: 1666, s: () => ({ pos: [-2.4, 1.5, -88.0], look: [0.2, 1.3, -82.0], fov: 46, roll: -0.02 }) },
    { f: 1666, dur: 134, s: () => ({ pos: [-1.5, 1.5, -86.4], look: [-0.05, 1.42, -82.6], fov: 36, roll: 0.02 }) },
  ],
};
/** impact kicks: flip sign every frame, decay over 7 frames */
const KICKS = [T_BROKEN, T_CANCEL, T_RAMMED, T_SMASH, T_BUG, T_GTA, T_RAMS, T_EXISTS];
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
  { f: 0, cInf: 8, focus: (f) => [1.8, 1.0, pz(1, f)] },
  { f: 120, cInf: 0 },
  { f: 228, cInf: 8, focus: () => [-301.7, 1.2, SEAT_Z] },
  { f: 300, cInf: 10, focus: () => [-305.4, 1.4, -1.9] },
  { f: 354, cInf: 6, focus: () => [HX, 1.03, DESK_Z - 0.2] },
  { f: 477, cInf: 9, focus: () => [-301.7, 1.2, SEAT_Z] },
  { f: 572, dur: 30, cInf: 10, focus: () => [-299.3, 1.3, 0.2] },
  { f: 632, cInf: 14, focus: () => [DX, 1.25, SEAT_Z] },
  { f: 678, cInf: 6, focus: (f) => [1.5, 1.0, pz(8, f)] },
  { f: 780, cInf: 0 },
  { f: 891, cInf: 6, focus: () => [HX, 1.03, DESK_Z - 0.2] },
  { f: 1004, cInf: 10, focus: () => [-301.6, 1.3, 1.9] },
  { f: 1200, cInf: 10, focus: () => [-296.4, 1.0, 0.0] },
  { f: 1281, cInf: 12, focus: () => [ROBBER_CAR[0] + 1.6, 1.3, ROBBER_CAR[2] - 2.6] },
  { f: 1329, cInf: 7, focus: () => [BOARD[0], 1.6, BOARD[2] - 0.1] },
  { f: 1410, cInf: 0 },
  { f: 1584, cInf: 6, focus: (f) => [1.5, 1.0, pz(15, f)] },
  { f: 1666, cInf: 13, focus: () => [-0.3, 1.45, -82.6] },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [];
void OX;
