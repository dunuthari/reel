// "The Bug That Made GTA": one three.js scene with three places far apart (story.ts): a modern toon city (an avenue,
// cross streets, pavements, tall blocks, lamp posts, trees, parked cars), a sandstone street in 1995 Dundee, and the
// studio's office (desks, beige CRTs, whiteboard, trophy shelf). Cars are built in code and posed every frame; the
// cruisers' light bars flash. The hero CRT and the whiteboard are live canvases redrawn each frame. The golden pile
// of game boxes is one instanced mesh that fills from the bottom up. Sky, light rig, clouds and the character cards
// work exactly like the Pisa / bridge / pig / ice shorts.
import * as THREE from "three";
import { Batch, boxGeo, V, lam, house, Kit, quad } from "./build";
import { ctex, cloudHD, rng } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, D0, SHOTS, camAt, ShotDef, V3, carsAt, Car, CarKind, sirenOn, pileCount, PILE, screenAt, ScreenMode, boardAt,
  OFFICE, DESKS, DESK_Z, SEAT_Z, HERO, MON_DX, BOARD, SHELF, BIN, DUNDEE, T_SMASH, clamp01 } from "./story";

export const loadKit = async (): Promise<Kit> => ({});

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
/** sun per shot, camera-relative (lights.ts) */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  1: { az: 110, el: 42 }, 2: { az: 60, el: 35 }, 3: { az: 150, el: 40 }, 4: { az: 120, el: 40 }, 5: { az: 140, el: 45 }, 6: { az: 150, el: 40 },
  7: { az: 130, el: 40 }, 8: { az: 100, el: 45 }, 9: { az: 140, el: 45 }, 10: { az: 150, el: 40 }, 11: { az: 120, el: 40 }, 12: { az: 75, el: 40 },
  13: { az: 140, el: 40 }, 14: { az: 150, el: 40 }, 15: { az: 105, el: 45 }, 16: { az: 80, el: 38 },
};
/** the one place each shot shows (everything else is hidden) */
const ZONE_OF: Record<number, string> = { 1: "city", 2: "dundee", 3: "office", 4: "office", 5: "office", 6: "office", 7: "office", 8: "city", 9: "office",
  10: "office", 11: "office", 12: "city", 13: "office", 14: "city", 15: "city", 16: "city" };

/** horizontal quad facing up at height y covering x0..x1, z0..z1 */
const quadUp = (x0: number, x1: number, z0: number, z1: number, u: number, v: number, y = D0) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};
const cyl = (r0: number, r1: number, h: number, n = 24, open = false) => new THREE.CylinderGeometry(r1, r0, h, n, 1, open).translate(0, h / 2, 0);
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const box = (b: Batch, m: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tile = 0) => b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile), m);

// ---------------- painted surfaces ----------------
const asphaltTex = () => ctex("asphaltHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#6f7078"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 4000; i++) { g.fillStyle = r() < 0.5 ? "rgba(40,40,50,0.18)" : "rgba(200,200,210,0.14)"; g.fillRect(r() * 1024, r() * 1024, 2 + r() * 4, 2 + r() * 4); }
  for (let i = 0; i < 14; i++) { g.strokeStyle = "rgba(40,40,48,0.35)"; g.lineWidth = 3; g.beginPath(); let x = r() * 1024, y = r() * 1024; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 120; y += (r() - 0.5) * 120; g.lineTo(x, y); } g.stroke(); }
});
const paveTex = () => ctex("paveHD", 512, 512, (g, r) => {
  g.fillStyle = "#c9c3b8"; g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) for (let x = 0; x < 512; x += 128) { g.fillStyle = ["#cdc7bc", "#c2bcb0", "#d3cdc2"][Math.floor(r() * 3)]; g.fillRect(x + 3, y + 3, 122, 122); }
  g.fillStyle = "rgba(90,85,80,0.5)"; for (let k = 0; k <= 512; k += 128) { g.fillRect(k - 2, 0, 4, 512); g.fillRect(0, k - 2, 512, 4); }
});
/** a city facade tile: 7 m x 7 m = 2 bays x 2 floors */
type Fac = { wall: string; glass: string; frame: string; band?: string };
const FACADES: Fac[] = [
  { wall: "#b5523e", glass: "#5d84b8", frame: "#efe6d6" },               // red brick
  { wall: "#d8c7a4", glass: "#4f86c0", frame: "#7a6a58", band: "#bfae8a" }, // beige office
  { wall: "#5e8f8c", glass: "#bfe3f0", frame: "#2f4a4a" },               // teal glass block
  { wall: "#c98a4f", glass: "#4b6fa8", frame: "#f2e6cf", band: "#a86c38" }, // ochre
  { wall: "#8a8fa6", glass: "#a9d4ef", frame: "#40445a" },               // slate grey
  { wall: "#e5d6b5", glass: "#3f6fa6", frame: "#b0423a" },               // cream with red frames
];
const facadeTex = (i: number) => ctex("cityFac" + i, 512, 512, (g, r) => {
  const F = FACADES[i];
  g.fillStyle = F.wall; g.fillRect(0, 0, 512, 512);
  for (let k = 0; k < 500; k++) { g.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)"; g.fillRect(r() * 512, r() * 512, 4 + r() * 10, 3 + r() * 6); }
  for (let fy = 0; fy < 2; fy++) {
    if (F.band) { g.fillStyle = F.band; g.fillRect(0, fy * 256 + 226, 512, 30); }
    for (let bx = 0; bx < 2; bx++) {
      const x0 = bx * 256 + 46, y0 = fy * 256 + 46, w = 164, h = 150;
      g.fillStyle = "rgba(30,25,35,0.55)"; g.fillRect(x0 - 10, y0 - 10, w + 20, h + 20);
      g.fillStyle = F.frame; g.fillRect(x0 - 8, y0 - 8, w + 16, h + 16);
      g.fillStyle = F.glass; g.fillRect(x0, y0, w, h);
      g.fillStyle = "rgba(255,255,255,0.32)"; g.beginPath(); g.moveTo(x0, y0 + h * 0.65); g.lineTo(x0 + w * 0.5, y0); g.lineTo(x0 + w * 0.68, y0); g.lineTo(x0, y0 + h); g.fill();
      g.fillStyle = F.frame; g.fillRect(x0 + w / 2 - 5, y0, 10, h); g.fillRect(x0, y0 + h * 0.42, w, 8);
    }
  }
});
const roofTopTex = () => ctex("cityRoof", 256, 256, (g, r) => {
  g.fillStyle = "#8d8a86"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 300; i++) { g.fillStyle = "rgba(0,0,0,0.08)"; g.fillRect(r() * 256, r() * 256, 6, 6); }
});
/** office: blue-grey carpet tiles, cream plaster, the windows (a bright sky with clouds), ceiling tiles */
const carpetTex = () => ctex("carpet", 512, 512, (g, r) => {
  g.fillStyle = "#6f7a8f"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6000; i++) { g.fillStyle = ["rgba(40,50,70,0.25)", "rgba(160,170,190,0.2)", "rgba(110,80,90,0.15)"][Math.floor(r() * 3)]; g.fillRect(r() * 512, r() * 512, 3, 3); }
  g.fillStyle = "rgba(40,45,60,0.35)"; for (let k = 0; k <= 512; k += 256) { g.fillRect(k - 2, 0, 4, 512); g.fillRect(0, k - 2, 512, 4); }
});
const plasterTex = () => ctex("plaster", 512, 512, (g, r) => {
  g.fillStyle = "#e8dcc2"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) { g.fillStyle = r() < 0.5 ? "rgba(150,120,90,0.06)" : "rgba(255,255,255,0.08)"; const s = 10 + r() * 40; g.fillRect(r() * 512, r() * 512, s, s * 0.6); }
});
const officeWindowTex = () => ctex("officeWindow", 512, 512, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, "#7fb0e6"); gr.addColorStop(1, "#cfe2f5");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#f6f8fb"; for (const [x, y, s] of [[120, 140, 60], [190, 120, 70], [260, 150, 50], [380, 260, 55], [430, 245, 45]] as const) { g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  g.fillStyle = "#8c9aa8"; g.fillRect(0, 400, 512, 112); // roofs across the street
  g.fillStyle = "#6f7d8c"; for (let x = 0; x < 512; x += 90) g.fillRect(x + 10, 360 + (x % 3) * 12, 60, 60);
  g.fillStyle = "#f4efe4"; g.fillRect(0, 0, 512, 22); g.fillRect(0, 490, 512, 22); g.fillRect(0, 0, 22, 512); g.fillRect(490, 0, 22, 512);
  g.fillRect(245, 0, 22, 512); g.fillRect(0, 245, 512, 18);
});
const ceilingTex = () => ctex("ceiling", 256, 256, (g) => {
  g.fillStyle = "#ecebe6"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#c9c6bd"; for (let k = 0; k <= 256; k += 128) { g.fillRect(k - 3, 0, 6, 256); g.fillRect(0, k - 3, 256, 6); }
});
/** posters: a racing car, a space shooter, a spaceship  (generic, bright) */
const posterTex = (i: number) => ctex("poster" + i, 256, 360, (g, r) => {
  const bg = ["#2f3f8f", "#c2453c", "#1f6f5a", "#f0a030"][i % 4];
  g.fillStyle = "#f4f1ea"; g.fillRect(0, 0, 256, 360); g.fillStyle = bg; g.fillRect(12, 12, 232, 336);
  g.fillStyle = "#ffd84a"; g.fillRect(30, 30, 196, 40);
  g.fillStyle = "#f4f1ea";
  if (i % 3 === 0) { g.beginPath(); g.ellipse(128, 220, 80, 30, 0, 0, 7); g.fill(); g.fillStyle = "#e2453c"; g.fillRect(70, 190, 116, 30); }
  else if (i % 3 === 1) { g.beginPath(); g.moveTo(128, 120); g.lineTo(190, 300); g.lineTo(66, 300); g.fill(); for (let k = 0; k < 30; k++) g.fillRect(r() * 230 + 12, r() * 330 + 12, 3, 3); }
  else { g.beginPath(); g.arc(128, 220, 70, 0, 7); g.fill(); g.fillStyle = bg; g.beginPath(); g.arc(150, 200, 60, 0, 7); g.fill(); }
});
/** a game box cover: a coloured spine and a bright square of art */
const PILE_COLS = ["#e2453c", "#2f6fd0", "#f2c94c", "#3f9a6a", "#8a4fc0", "#f08a2c", "#1f1f2a", "#e8e2d4"];
const caseTex = () => ctex("gameCase", 128, 128, (g) => {
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, 128, 128);
  g.fillStyle = "#d8d8d8"; g.fillRect(0, 0, 128, 22);
  g.fillStyle = "#ffffff"; g.fillRect(14, 34, 100, 80);
  g.fillStyle = "#b9b9b9"; g.fillRect(24, 44, 80, 30);
});

// ---------------- city furniture ----------------
const tree = (b: Batch, x: number, z: number, s: number, M: Record<string, THREE.Material>, seed: number) => {
  b.add(cyl(0.18 * s, 0.13 * s, 2.6 * s, 8), M.bark, at(x, D0 + 0.15, z));
  b.add(new THREE.IcosahedronGeometry(1.5 * s, 2), seed % 2 ? M.leafA : M.leafB, at(x, D0 + 3.4 * s, z));
  b.add(new THREE.IcosahedronGeometry(1.05 * s, 2), seed % 3 ? M.leafB : M.leafA, at(x + 0.6 * s, D0 + 4.2 * s, z - 0.3 * s));
};
const lampPost = (b: Batch, x: number, z: number, side: number, M: Record<string, THREE.Material>) => {
  b.add(cyl(0.09, 0.07, 6.4, 10), M.iron, at(x, D0 + 0.15, z));
  box(b, M.iron, Math.min(x, x - side * 1.6), D0 + 6.3, z - 0.06, Math.max(x, x - side * 1.6), D0 + 6.42, z + 0.06);
  box(b, M.lampHead, x - side * 1.6 - 0.32, D0 + 6.12, z - 0.18, x - side * 1.6 + 0.32, D0 + 6.34, z + 0.18);
};
const bin = (b: Batch, x: number, z: number, M: Record<string, THREE.Material>) => { b.add(cyl(0.3, 0.3, 0.95, 16), M.binGreen, at(x, D0 + 0.15, z)); b.add(cyl(0.33, 0.33, 0.08, 16), M.iron, at(x, D0 + 1.1, z)); };
const hydrant = (b: Batch, x: number, z: number, M: Record<string, THREE.Material>) => {
  b.add(cyl(0.14, 0.12, 0.62, 12), M.red, at(x, D0 + 0.15, z)); b.add(new THREE.SphereGeometry(0.13, 12, 8), M.red, at(x, D0 + 0.77, z));
  b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8).rotateZ(Math.PI / 2), M.red, at(x, D0 + 0.55, z));
};
const trafficLight = (b: Batch, x: number, z: number, M: Record<string, THREE.Material>) => {
  b.add(cyl(0.08, 0.08, 4.2, 10), M.iron, at(x, D0 + 0.15, z));
  box(b, M.ironDark, x - 0.22, D0 + 3.4, z - 0.2, x + 0.22, D0 + 4.5, z + 0.2);
  for (const [y, m] of [[4.25, M.tlRed], [3.95, M.tlAmber], [3.65, M.tlGreen]] as const) b.add(new THREE.SphereGeometry(0.11, 10, 8), m, at(x, D0 + y, z - 0.21));
};

// ---------------- cars ----------------
/** a car built in code, nose toward -z: body, glasshouse, roof, wheels, bumpers, lamps; cruisers get a black lower
 *  half and a light bar (red / blue, flashed per frame by swapping emissive intensities) */
const CAR_COL: Record<CarKind, string> = { player: "#d8322e", police: "#f4f4f0", civA: "#3f6fb5", civB: "#f2c94c", civC: "#3f9a6a", civD: "#8a8f9e", civE: "#e9dcc0" };
const buildCar = (kind: CarKind, M: Record<string, THREE.Material>, siren: { red: THREE.Material; blue: THREE.Material }) => {
  const g = new THREE.Group(), b = new Batch();
  const body = lam("carBody" + kind, () => ({ color: CAR_COL[kind] }));
  const W = 0.92, L = 2.25;
  box(b, body, -W, 0.3, -L, W, 0.86, L);
  // a sloped bonnet and boot lip
  b.add(quad(V(-W, 0.86, -L), V(W, 0.86, -L), V(W, 0.95, -0.75), V(-W, 0.95, -0.75)), body);
  box(b, body, -W, 0.86, -0.75, W, 0.95, 1.6);
  box(b, M.glass, -0.8, 0.95, -0.55, 0.8, 1.34, 1.25);
  box(b, kind === "police" ? M.black : body, -0.84, 1.34, -0.4, 0.84, 1.42, 1.15);
  for (const x of [-0.82, 0.82]) box(b, kind === "police" ? M.black : body, x - 0.03, 0.95, -0.45, x + 0.03, 1.36, -0.38);
  if (kind === "police") { box(b, M.black, -W - 0.01, 0.3, -L - 0.01, W + 0.01, 0.62, L + 0.01); box(b, M.black, -W - 0.012, 0.62, -0.8, W + 0.012, 0.86, 0.9); }
  box(b, M.bumper, -W - 0.02, 0.26, -L - 0.08, W + 0.02, 0.46, -L + 0.1);
  box(b, M.bumper, -W - 0.02, 0.26, L - 0.1, W + 0.02, 0.46, L + 0.08);
  for (const x of [-0.62, 0.62]) { box(b, M.headlight, x - 0.2, 0.58, -L - 0.03, x + 0.2, 0.74, -L + 0.02); box(b, M.taillight, x - 0.2, 0.6, L - 0.02, x + 0.2, 0.74, L + 0.03); }
  for (const [x, z] of [[-0.86, -1.42], [0.86, -1.42], [-0.86, 1.42], [0.86, 1.42]] as const) {
    b.add(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 18).rotateZ(Math.PI / 2), M.tyre, at(x, 0.34, z));
    b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.25, 12).rotateZ(Math.PI / 2), M.hub, at(x, 0.34, z));
  }
  b.build(g);
  if (kind === "police") {
    const bar = new Batch();
    box(bar, M.black, -0.62, 1.42, 0.18, 0.62, 1.47, 0.42);
    bar.build(g);
    const r = new THREE.Mesh(boxGeo(V(-0.6, 1.47, 0.2), V(-0.04, 1.62, 0.4)), siren.red), u = new THREE.Mesh(boxGeo(V(0.04, 1.47, 0.2), V(0.6, 1.62, 0.4)), siren.blue);
    g.add(r, u);
  }
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
};

// ---------------- screens ----------------
/** the top-down game: a block of streets seen from above, the cop car chasing the red car round it (neat) or the
 *  cops gone mad, zig-zagging and ramming (mad) */
const drawGame = (g: CanvasRenderingContext2D, W: number, H: number, s: ScreenMode) => {
  g.fillStyle = "#3f8f3a"; g.fillRect(0, 0, W, H);
  const road = "#4a4a52";
  g.fillStyle = road;
  for (const y of [60, 230, 380]) g.fillRect(0, y - 26, W, 52);
  for (const x of [70, 256, 440]) g.fillRect(x - 26, 0, 52, H);
  g.fillStyle = "#c9c3b8";
  for (const [x0, y0, x1, y1] of [[96, 86, 230, 204], [282, 86, 414, 204], [96, 256, 230, 354], [282, 256, 414, 354]] as const) {
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
    const cols = ["#b5523e", "#d8c7a4", "#5e8f8c", "#c98a4f"];
    g.fillStyle = cols[(x0 + y0) % 4]; g.fillRect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20);
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x0 + 18, y0 + 18, (x1 - x0) / 2 - 22, (y1 - y0) / 2 - 22);
    g.fillStyle = "#c9c3b8";
  }
  g.strokeStyle = "#f2d24a"; g.lineWidth = 3; g.setLineDash([14, 12]);
  for (const y of [60, 230, 380]) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (const x of [70, 256, 440]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  g.setLineDash([]);
  // the loop round the left block: corners (70,60) (256,60) (256,230) (70,230)
  const loop = (u: number): [number, number, number] => {
    const P: [number, number][] = [[70, 60], [256, 60], [256, 230], [70, 230]];
    const k = ((u % 4) + 4) % 4, i = Math.floor(k), f = k - i, a = P[i], b = P[(i + 1) % 4];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  const car = (x: number, y: number, ang: number, col: string, cop: boolean) => {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.fillStyle = "#16141a"; g.fillRect(-22, -13, 44, 26);
    g.fillStyle = col; g.fillRect(-20, -11, 40, 22);
    g.fillStyle = "#1f2b44"; g.fillRect(-4, -9, 12, 18);
    if (cop) { const on = Math.floor(s.t * 6) % 2; g.fillStyle = on ? "#ff3030" : "#3060ff"; g.fillRect(-1, -9, 6, 9); g.fillStyle = on ? "#3060ff" : "#ff3030"; g.fillRect(-1, 0, 6, 9); }
    g.restore();
  };
  if (s.kind === "game") {
    const u = s.t * 0.55;
    const [rx, ry, ra] = loop(u + 0.45), [cx, cy, ca] = loop(u);
    car(rx, ry, ra, "#d8322e", false); car(cx, cy, ca, "#f4f4f0", true);
  } else {
    // mad: the red car on the middle road, three cops swerving at it, one spinning, sparks
    const t = s.t, rx = ((t * 120) % (W + 80)) - 40, ry = 230;
    car(rx, ry, 0, "#d8322e", false);
    for (let k = 0; k < 3; k++) {
      const cx = rx - 60 - k * 55 + 18 * Math.sin(t * 7 + k), cy = ry + 46 * Math.sin(t * 5.3 + k * 2.1), spin = k === 2 ? t * 9 : 0.6 * Math.sin(t * 6 + k);
      car(cx, cy, spin, "#f4f4f0", true);
    }
    if (Math.floor(t * 5) % 2) { g.fillStyle = "#ffe08a"; for (let k = 0; k < 8; k++) { const a = k * 0.8 + t; g.fillRect(rx - 26 + Math.cos(a) * 20, ry + Math.sin(a) * 20, 6, 6); } }
  }
};
/** a cartoon beetle, drawn at (x, y) heading right, legs scuttling */
const drawBug = (g: CanvasRenderingContext2D, x: number, y: number, t: number, s = 1) => {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = "#1a1a1a"; g.lineWidth = 5; g.lineCap = "round";
  for (let k = -1; k <= 1; k++) for (const side of [-1, 1]) {
    const w = Math.sin(t * 30 + k * 2 + side) * 6;
    g.beginPath(); g.moveTo(k * 16, side * 16); g.lineTo(k * 16 + 10 + w, side * 36); g.lineTo(k * 16 + 4 + w, side * 46); g.stroke();
  }
  g.fillStyle = "#c0352a"; g.strokeStyle = "#1a1a1a"; g.lineWidth = 5;
  g.beginPath(); g.ellipse(0, 0, 36, 26, 0, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-34, 0); g.lineTo(34, 0); g.stroke();
  g.fillStyle = "#1a1a1a"; for (const [dx, dy] of [[-14, -12], [12, 12], [-10, 12], [16, -12]]) { g.beginPath(); g.arc(dx, dy, 5, 0, 7); g.fill(); }
  g.beginPath(); g.arc(40, 0, 15, 0, 7); g.fill();
  g.fillStyle = "#ffffff"; for (const dy of [-6, 6]) { g.beginPath(); g.arc(46, dy, 5, 0, 7); g.fill(); }
  g.strokeStyle = "#1a1a1a"; g.lineWidth = 3;
  for (const side of [-1, 1]) { g.beginPath(); g.moveTo(50, side * 8); g.quadraticCurveTo(66, side * 20, 70, side * 30); g.stroke(); }
  g.restore();
};
const CODE = ["// POLICE AI", "", "route = FindRoute();", "if (route == OK)", "   Follow(route);", "else", "   Ram(player); //???", "", "speed = MAX;"];
const drawCode = (g: CanvasRenderingContext2D, W: number, H: number, s: ScreenMode) => {
  g.fillStyle = "#0e1a12"; g.fillRect(0, 0, W, H);
  g.font = "bold 27px monospace"; g.textBaseline = "top";
  CODE.forEach((l, i) => {
    const bad = i === 6 && s.t > 30.6;
    if (bad) { g.fillStyle = "#6a1414"; g.fillRect(64, 26 + i * 36, W - 128, 36); }
    g.fillStyle = bad ? "#ff9a8a" : i === 0 ? "#8fa89a" : "#7dff9a";
    g.fillText(l, 82, 32 + i * 36);
  });
  if (Math.floor(s.t * 2.5) % 2) { g.fillStyle = "#7dff9a"; g.fillRect(82, 32 + 9 * 36, 15, 5); }
  if (s.bug !== undefined && s.bug > 0) drawBug(g, 20 + (W - 40) * 0.62 * s.bug, 250 + 8 * Math.sin(s.t * 8), s.t, 0.95);
};
/** the whiteboard: the old name crossed out, the new one written in */
const drawBoard = (g: CanvasRenderingContext2D, W: number, H: number, t: number) => {
  const { cross, write } = boardAt(t);
  g.fillStyle = "#f8f8f4"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(120,140,170,0.12)"; g.fillRect(40, 30, 300, 20); g.fillRect(620, 690, 300, 26);
  const hand = "bold 118px 'Comic Sans MS', 'Chalkboard SE', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = hand; g.fillStyle = "#2f4fb0";
  g.fillText("RACE 'N'", W / 2, 110); g.fillText("CHASE", W / 2, 235);
  if (cross > 0) {
    g.strokeStyle = "#d02a24"; g.lineWidth = 20; g.lineCap = "round";
    const k1 = Math.min(1, cross * 2), k2 = clamp01(cross * 2 - 1);
    g.beginPath(); g.moveTo(150, 60); g.lineTo(150 + (W - 300) * k1, 60 + 230 * k1); g.stroke();
    if (k2 > 0) { g.beginPath(); g.moveTo(W - 150, 60); g.lineTo(W - 150 - (W - 300) * k2, 60 + 230 * k2); g.stroke(); }
  }
  if (write > 0) {
    const lines = ["GRAND THEFT", "AUTO"], total = lines.join("").length, n = Math.ceil(total * write);
    g.font = "bold 132px 'Comic Sans MS', 'Chalkboard SE', sans-serif"; g.fillStyle = "#d02a24"; g.textAlign = "left";
    let used = 0;
    lines.forEach((ln, i) => {
      const w = g.measureText(ln).width, k = Math.max(0, Math.min(ln.length, n - used));
      g.fillText(ln.slice(0, k), W / 2 - w / 2, 420 + i * 150); used += ln.length;
    });
    if (write >= 1) { const w = g.measureText("GRAND THEFT").width; g.strokeStyle = "#d02a24"; g.lineWidth = 12; g.beginPath(); g.moveTo(W / 2 - w / 2, 660); g.quadraticCurveTo(W / 2, 690, W / 2 + w / 2, 650); g.stroke(); }
  }
};

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  private zones: Record<string, THREE.Group> = {};
  private M: Record<string, THREE.Material> = {};
  private siren: { red: THREE.MeshLambertMaterial; blue: THREE.MeshLambertMaterial };
  private cars: Record<string, THREE.Group[]> = {};
  private screenCv: HTMLCanvasElement; private screenTex: THREE.CanvasTexture; private screenKey = "";
  private boardCv: HTMLCanvasElement; private boardTex: THREE.CanvasTexture; private boardKey = "";
  private pile: THREE.InstancedMesh;
  private debris: THREE.Mesh[] = [];

  constructor(_kit: Kit) {
    const R = this.root, M = this.M;
    // ---- sky + light (same as the Pisa short) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunDisc.frustumCulled = false; this.sunDisc.layers.set(NOINK); R.add(this.sunDisc);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 140 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 90 + (i % 4) * 40, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- materials ----
    M.asphalt = lam("asphalt", () => ({ map: asphaltTex() }));
    M.pave = lam("pave", () => ({ map: paveTex() }));
    M.kerb = lam("kerb", () => ({ color: "#b9b3a8" }));
    M.markW = lam("markW", () => ({ color: "#f4f2ea" }));
    M.markY = lam("markY", () => ({ color: "#f2c94c" }));
    M.roofTop = lam("cityRoofTop", () => ({ map: roofTopTex() }));
    M.bark = lam("bark", () => ({ color: "#8a5a3c" }));
    M.leafA = lam("leafA", () => ({ color: "#62ae4c" }));
    M.leafB = lam("leafB", () => ({ color: "#4f9a43" }));
    M.iron = lam("iron", () => ({ color: "#3a3f4a" }));
    M.ironDark = lam("ironDark", () => ({ color: "#26282e" }));
    M.lampHead = lam("lampHead", () => ({ color: "#f4efe0", emissive: new THREE.Color("#fff2c0"), emissiveIntensity: 0.4 }));
    M.binGreen = lam("binGreen", () => ({ color: "#2f6a43" }));
    M.red = lam("hydrantRed", () => ({ color: "#d8322e" }));
    M.tlRed = lam("tlRed", () => ({ color: "#ff4a3a", emissive: new THREE.Color("#ff3a2a"), emissiveIntensity: 1.6 }));
    M.tlAmber = lam("tlAmber", () => ({ color: "#5a4a20" }));
    M.tlGreen = lam("tlGreen", () => ({ color: "#204a2a" }));
    M.glass = lam("carGlass", () => ({ color: "#2b3f5e" }));
    M.black = lam("carBlack", () => ({ color: "#1d1d24" }));
    M.bumper = lam("bumper", () => ({ color: "#3a3a42" }));
    M.headlight = lam("headlight", () => ({ color: "#fff8e0", emissive: new THREE.Color("#fff4c8"), emissiveIntensity: 0.8 }));
    M.taillight = lam("taillight", () => ({ color: "#c0201a", emissive: new THREE.Color("#ff2a1a"), emissiveIntensity: 0.6 }));
    M.tyre = lam("tyre", () => ({ color: "#1f1f24" }));
    M.hub = lam("hub", () => ({ color: "#b9bcc4" }));
    M.carpet = lam("carpet", () => ({ map: carpetTex() }));
    M.plaster = lam("plaster", () => ({ map: plasterTex() }));
    M.skirting = lam("skirting", () => ({ color: "#7a5a44" }));
    M.ceiling = lam("ceiling", () => ({ map: ceilingTex() }));
    M.fluoro = lam("fluoro", () => ({ color: "#ffffff", emissive: new THREE.Color("#f4f8ff"), emissiveIntensity: 1.1 }));
    M.window = new THREE.MeshBasicMaterial({ map: officeWindowTex() });
    M.desk = lam("desk", () => ({ color: "#d9b98a" }));
    M.deskLeg = lam("deskLeg", () => ({ color: "#5a5a62" }));
    M.beige = lam("crtBeige", () => ({ color: "#e3d9c0" }));
    M.beigeDark = lam("crtBeigeDark", () => ({ color: "#bfb294" }));
    M.screenOff = new THREE.MeshBasicMaterial({ color: "#1a2a22" });
    M.keys = lam("keys", () => ({ color: "#d4ccb6" }));
    M.chair = lam("chair", () => ({ color: "#2f3f6a" }));
    M.mug = lam("mug", () => ({ color: "#c2453c" }));
    M.paper = lam("paperStack", () => ({ color: "#f4f1ea" }));
    M.cabinet = lam("cabinet", () => ({ color: "#9aa0a8" }));
    M.door = lam("officeDoor", () => ({ color: "#8a5a3c" }));
    M.boardFrame = lam("boardFrame", () => ({ color: "#b9bcc4" }));
    M.shelf = lam("shelf", () => ({ color: "#a07050" }));
    M.gold = lam("trophyGold", () => ({ color: "#f2c94c", emissive: new THREE.Color("#8a6a10"), emissiveIntensity: 0.35 }));
    M.sandstone = lam("dundeeStone", () => ({ color: "#c9a27a" }));
    M.phoneBox = lam("phoneBox", () => ({ color: "#c8251f" }));
    M.phoneGlass = lam("phoneGlass", () => ({ color: "#e8eef0", emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0.2 }));
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];
    this.siren = {
      red: new THREE.MeshLambertMaterial({ color: "#ff3a30", emissive: new THREE.Color("#ff2a20"), emissiveIntensity: 2.5 }),
      blue: new THREE.MeshLambertMaterial({ color: "#3a6aff", emissive: new THREE.Color("#2a5aff"), emissiveIntensity: 2.5 }),
    };

    let b = new Batch();
    const zone = (name: string, cast = true) => { const g = new THREE.Group(); g.name = name; b.build(g, cast); R.add(g); this.zones[name] = g; b = new Batch(); return g; };

    // ================= THE CITY (x -200..200, z -200..200) =================
    b.add(quadUp(-260, 260, -260, 260, 520 / 8, 520 / 8, D0), M.asphalt);
    // lane markings along the avenue: double yellow centre, white dashes; zebra crossings at the cross streets
    for (const x of [-0.16, 0.16]) b.add(quadUp(x - 0.06, x + 0.06, -200, 200, 1, 1, D0 + 0.01), M.markY);
    for (let z = -200; z < 200; z += 6) for (const x of [-3.2, 3.2]) b.add(quadUp(x - 0.07, x + 0.07, z, z + 3, 1, 1, D0 + 0.01), M.markW);
    for (let c = -150; c <= 150; c += 50) for (const sz of [-7.5, 7.5]) for (let x = -6.6; x <= 6.6; x += 1.1) b.add(quadUp(x - 0.3, x + 0.3, c + sz - 1.2, c + sz + 1.2, 1, 1, D0 + 0.012), M.markW);
    // pavements (raised 0.15) along both sides of the avenue, broken at the cross streets
    for (let c = -200; c < 200; c += 50) {
      const z0 = c + 5, z1 = c + 45;
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? -11 : 7, x1 = s < 0 ? -7 : 11;
        b.add(quadUp(x0, x1, z0, z1, (x1 - x0) / 2, (z1 - z0) / 2, D0 + 0.15), M.pave);
        box(b, M.kerb, s < 0 ? -7.15 : 7, D0, z0, s < 0 ? -7 : 7.15, D0 + 0.15, z1);
        // the blocks: buildings 10-18 m wide along z, 14-46 m tall, 20 m deep
        const r = rng(Math.abs(c * 7 + (s + 3) * 131) + 11);
        for (let z = z0 + 1; z < z1 - 3; ) {
          const w = Math.min(z1 - 1 - z, 9 + Math.floor(r() * 3) * 3.5), h = 14 + Math.floor(r() * 9) * 3.5 + (Math.abs(c) > 120 ? 7 : 0);
          const fi = Math.floor(r() * FACADES.length), fm = lam("cityFac" + fi, () => ({ map: facadeTex(fi) }));
          const bx0 = s < 0 ? -31.5 : 11.5, bx1 = s < 0 ? -11.5 : 31.5;
          box(b, fm, bx0, D0, z, bx1, D0 + h, z + w, 7);
          box(b, M.roofTop, bx0 - 0.3, D0 + h, z - 0.3, bx1 + 0.3, D0 + h + 0.6, z + w + 0.3, 4);
          if (r() < 0.4) box(b, M.roofTop, (bx0 + bx1) / 2 - 2, D0 + h + 0.6, z + 1, (bx0 + bx1) / 2 + 2, D0 + h + 3, z + 4, 4); // a rooftop plant room
          // a shop front band on the ground floor
          const shop = lam("shop" + (fi % 3), () => ({ color: ["#2f5f6a", "#8c3b4a", "#3f4f6a"][fi % 3] }));
          box(b, shop, s < 0 ? -11.62 : 11.4, D0 + 3.0, z + 0.4, s < 0 ? -11.4 : 11.62, D0 + 3.8, z + w - 0.4);
          z += w + 0.2;
        }
        // furniture on the pavement
        for (let z = z0 + 4; z < z1 - 2; z += 12) tree(b, s * 9.6, z, 1.0 + ((z * 13) % 3) * 0.1, M, Math.abs(z));
        for (let z = z0 + 10; z < z1; z += 25) lampPost(b, s * 7.6, z, s, M);
        bin(b, s * 8.0, z0 + 7, M);
        hydrant(b, s * 7.7, z0 + 20, M);
        trafficLight(b, s * 7.6, z0 + 0.8, M);
      }
    }
    // a far skyline ring so the avenue never ends in sky
    { const r = rng(77);
      for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2, d = 230 + r() * 40, w = 18 + r() * 20, h = 30 + r() * 60, fi = i % FACADES.length;
        const fm = lam("cityFac" + fi, () => ({ map: facadeTex(fi) }));
        b.add(boxGeo(V(-w / 2, 0, -w / 2), V(w / 2, h, w / 2), 7), fm, new THREE.Matrix4().makeRotationY(-a).setPosition(Math.cos(a) * d, D0, Math.sin(a) * d)); } }
    // the bins and boxes cop B smashes into on "smashing" are dynamic (debris)
    zone("city");

    // ================= DUNDEE, 1995 (x 240..360) =================
    {
      const [dx] = DUNDEE;
      b.add(quadUp(dx - 80, dx + 80, -60, 60, 20, 15, D0 + 0.002), M.asphalt);
      for (const s of [-1, 1]) {
        b.add(quadUp(dx - 70, dx + 70, s < 0 ? -8 : 5, s < 0 ? -5 : 8, 35, 1.5, D0 + 0.15), M.pave);
        box(b, M.kerb, dx - 70, D0, s < 0 ? -5.15 : 5, dx + 70, D0 + 0.15, s < 0 ? -5 : 5.15);
      }
      const STY = [6, 0, 7, 4, 6, 1];
      let k = 0;
      for (let x = dx - 60; x <= dx + 60; x += 10.2) {
        for (const s of [-1, 1]) { house(b, x, s * 12.2, s < 0 ? 0 : Math.PI, 10, 8, [9.8, 11.2, 8.4][k % 3], STY[k % STY.length]); k++; }
      }
      // the Law: a green hill at the end of the street
      b.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm[0], new THREE.Matrix4().compose(V(dx + 150, D0 - 2, 10), new THREE.Quaternion(), V(60, 38, 70)));
      b.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm[1], new THREE.Matrix4().compose(V(dx + 170, D0 - 2, -60), new THREE.Quaternion(), V(70, 26, 50)));
      // a red phone box, a post box, lamp posts
      box(b, M.phoneBox, dx + 9.0, D0 + 0.15, 6.0, dx + 10.0, D0 + 2.6, 7.0);
      box(b, M.phoneGlass, dx + 8.98, D0 + 0.9, 6.15, dx + 10.02, D0 + 2.2, 6.85);
      box(b, M.phoneBox, dx + 8.9, D0 + 2.6, 5.9, dx + 10.1, D0 + 2.8, 7.1);
      b.add(cyl(0.25, 0.25, 1.3, 16), M.phoneBox, at(dx - 6.0, D0 + 0.15, 6.4));
      for (let x = dx - 50; x <= dx + 50; x += 20) for (const s of [-1, 1]) lampPost(b, x, s * 5.6, s < 0 ? 1 : -1, M);
      for (let x = dx - 40; x <= dx + 40; x += 16) tree(b, x + 4, 6.8, 0.9, M, x);
    }
    zone("dundee");

    // ================= THE OFFICE (x -307..-293, z -5..5) =================
    {
      const [ox] = OFFICE, ob = new Batch();
      const X0 = ox - 7, X1 = ox + 7, Z0 = -5, Z1 = 5, HT = 3.2;
      b.add(quadUp(X0 - 2, X1 + 2, Z0 - 2, Z1 + 2, 8, 6, D0), M.carpet);
      // walls (cast no shadow: the sun lights the room like a cartoon set) + skirting
      box(ob, M.plaster, X0 - 0.3, D0, Z1, X1 + 0.3, D0 + HT, Z1 + 0.3, 3);          // back wall
      box(ob, M.plaster, X0 - 0.3, D0, Z0 - 0.3, X0, D0 + HT, Z1 + 0.3, 3);          // left wall
      box(ob, M.plaster, X1, D0, Z0 - 0.3, X1 + 0.3, D0 + HT, Z1 + 0.3, 3);          // right wall
      box(ob, M.plaster, X0 - 0.3, D0, Z0 - 0.6, X1 + 0.3, D0 + HT, Z0 - 0.3, 3);    // front wall (behind the camera)
      ob.add(boxGeo(V(X0 - 0.3, D0 + HT, Z0 - 0.6), V(X1 + 0.3, D0 + HT + 0.1, Z1 + 0.3), 1.2, true), M.ceiling);
      for (const [x0, z0, x1, z1] of [[X0, Z1 - 0.06, X1, Z1], [X0, Z0, X0 + 0.06, Z1], [X1 - 0.06, Z0, X1, Z1]] as const) box(b, M.skirting, x0, D0, z0, x1, D0 + 0.12, z1);
      // ceiling lights
      for (const x of [ox - 4, ox, ox + 4]) for (const z of [-2.2, 1.8]) box(b, M.fluoro, x - 0.6, D0 + HT - 0.04, z - 0.3, x + 0.6, D0 + HT - 0.01, z + 0.3);
      // windows in the back wall either side of the whiteboard, and one on the right wall
      for (const x of [ox - 5.4, ox + 0.9, ox + 4.3]) b.add(quad(V(x - 1.1, D0 + 1.0, Z1 - 0.01), V(x + 1.1, D0 + 1.0, Z1 - 0.01), V(x + 1.1, D0 + 2.6, Z1 - 0.01), V(x - 1.1, D0 + 2.6, Z1 - 0.01)).rotateY(Math.PI).translate(2 * x, 0, 2 * Z1 - 0.02), M.window);
      // the whiteboard (live canvas, added below) in its frame
      box(b, M.boardFrame, BOARD[0] - 0.9, BOARD[1] - 0.68, Z1 - 0.06, BOARD[0] + 0.9, BOARD[1] + 0.68, Z1 - 0.01);
      box(b, M.boardFrame, BOARD[0] - 0.8, BOARD[1] - 0.76, Z1 - 0.2, BOARD[0] + 0.8, BOARD[1] - 0.7, Z1 - 0.02);
      // posters on the walls
      for (const [x, z, ry, i] of [[X0 + 0.02, 2.6, Math.PI / 2, 0], [X0 + 0.02, -3.2, Math.PI / 2, 1], [X1 - 0.02, 2.2, -Math.PI / 2, 2], [ox + 2.6, Z1 - 0.02, Math.PI, 3]] as const) {
        const pm = lam("posterM" + i, () => ({ map: posterTex(i) }));
        b.add(new THREE.PlaneGeometry(0.8, 1.12).rotateY(ry), pm, at(x, D0 + 1.75, z));
      }
      // the door on the right wall (the publisher comes in here)
      box(b, M.door, X1 - 0.08, D0, -0.3, X1 - 0.01, D0 + 2.1, 0.75);
      // desks, CRTs, keyboards, chairs, mugs, paper
      DESKS.forEach((dx2, i) => {
        box(b, M.desk, dx2 - 1.25, D0 + 0.72, DESK_Z - 0.42, dx2 + 1.25, D0 + 0.77, DESK_Z + 0.42);
        for (const lx of [-1.18, 1.18]) box(b, M.deskLeg, dx2 + lx - 0.04, D0, DESK_Z - 0.38, dx2 + lx + 0.04, D0 + 0.72, DESK_Z + 0.38);
        box(b, M.deskLeg, dx2 - 1.2, D0 + 0.2, DESK_Z - 0.4, dx2 + 1.2, D0 + 0.72, DESK_Z - 0.36); // modesty panel facing the room
        const mx = dx2 + MON_DX;
        // CRT: a beige box with a deep tapered back toward -z (the room), the glass faces +z (the dev)
        box(b, M.beige, mx - 0.24, D0 + 0.77, DESK_Z - 0.05, mx + 0.24, D0 + 1.21, DESK_Z + 0.2);
        box(b, M.beigeDark, mx - 0.17, D0 + 0.83, DESK_Z - 0.4, mx + 0.17, D0 + 1.15, DESK_Z - 0.05);
        box(b, M.beigeDark, mx - 0.12, D0 + 0.77, DESK_Z - 0.02, mx + 0.12, D0 + 0.8, DESK_Z + 0.12);
        if (i !== HERO) b.add(new THREE.PlaneGeometry(0.4, 0.3), M.screenOff, at(mx, D0 + 1.0, DESK_Z + 0.205));
        box(b, M.keys, dx2 - 0.2, D0 + 0.77, DESK_Z + 0.22, dx2 + 0.3, D0 + 0.8, DESK_Z + 0.38); // keyboard
        b.add(cyl(0.05, 0.05, 0.1, 12), M.mug, at(dx2 + 0.85, D0 + 0.77, DESK_Z + 0.1));
        box(b, M.paper, dx2 + 0.5, D0 + 0.77, DESK_Z - 0.3, dx2 + 0.85, D0 + 0.77 + 0.04 + (i % 3) * 0.05, DESK_Z - 0.05);
        // a beige PC tower under the desk
        box(b, M.beige, dx2 + 0.75, D0, DESK_Z - 0.2, dx2 + 0.97, D0 + 0.45, DESK_Z + 0.3);
        // chair behind the dev
        box(b, M.chair, dx2 - 0.05, D0 + 0.45, SEAT_Z + 0.05, dx2 + 0.45, D0 + 0.52, SEAT_Z + 0.55);
        box(b, M.chair, dx2 - 0.05, D0 + 0.52, SEAT_Z + 0.5, dx2 + 0.45, D0 + 1.05, SEAT_Z + 0.58);
        b.add(cyl(0.03, 0.03, 0.45, 8), M.deskLeg, at(dx2 + 0.2, D0, SEAT_Z + 0.3));
      });
      // the trophy shelf on the left wall: two shelves, a gold cup, game boxes
      const [sx, sy, sz] = SHELF;
      for (const y of [sy - 0.45, sy]) box(b, M.shelf, sx - 0.1, D0 + y - 0.04, sz - 0.8, sx + 0.25, D0 + y, sz + 0.8);
      b.add(cyl(0.07, 0.09, 0.08, 16), M.gold, at(sx + 0.12, D0 + sy, sz));
      b.add(cyl(0.025, 0.025, 0.14, 8), M.gold, at(sx + 0.12, D0 + sy + 0.08, sz));
      b.add(new THREE.CylinderGeometry(0.15, 0.06, 0.24, 18).translate(0, 0.12, 0), M.gold, at(sx + 0.12, D0 + sy + 0.21, sz));
      for (const [dz, c] of [[-0.6, "#2f6fd0"], [-0.5, "#e2453c"], [-0.4, "#3f9a6a"], [0.42, "#f2c94c"], [0.52, "#8a4fc0"]] as const)
        box(b, lam("shelfBox" + c, () => ({ color: c })), sx, D0 + sy - 0.45, sz + dz - 0.04, sx + 0.22, D0 + sy - 0.45 + 0.3, sz + dz + 0.04);
      // filing cabinet + the waste bin
      box(b, M.cabinet, X1 - 0.6, D0, 2.6, X1 - 0.05, D0 + 1.3, 3.4);
      b.add(new THREE.CylinderGeometry(0.2, 0.16, 0.42, 16, 1, true).translate(0, 0.21, 0), lam("binGrey", () => ({ color: "#6a6f7a", side: THREE.DoubleSide })), at(BIN[0], D0, BIN[2]));
      b.add(new THREE.CircleGeometry(0.16, 16).rotateX(-Math.PI / 2), lam("binGrey", () => ({ color: "#6a6f7a", side: THREE.DoubleSide })), at(BIN[0], D0 + 0.01, BIN[2]));
      const off = zone("office");
      ob.build(off, false);
    }

    // ---- dynamic: cars, screen, whiteboard, the golden pile, debris ----
    this.screenCv = document.createElement("canvas"); this.screenCv.width = 512; this.screenCv.height = 384;
    this.screenTex = new THREE.CanvasTexture(this.screenCv); this.screenTex.colorSpace = THREE.SRGBColorSpace; this.screenTex.anisotropy = 8;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshBasicMaterial({ map: this.screenTex, color: new THREE.Color(1.05, 1.05, 1.05) }));
    scr.position.set(DESKS[HERO] + MON_DX, D0 + 1.0, DESK_Z + 0.206);
    this.zones.office.add(scr);
    this.boardCv = document.createElement("canvas"); this.boardCv.width = 1024; this.boardCv.height = 752;
    this.boardTex = new THREE.CanvasTexture(this.boardCv); this.boardTex.colorSpace = THREE.SRGBColorSpace; this.boardTex.anisotropy = 8;
    const brd = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.25), lam("boardLive", () => ({ map: this.boardTex })));
    brd.rotation.y = Math.PI; brd.position.set(BOARD[0], D0 + BOARD[1], BOARD[2] - 0.065); brd.receiveShadow = true;
    this.zones.office.add(brd);

    // the pile: game cases on rings that shrink with height, bottom ring first
    const N = 2300, geo = new THREE.BoxGeometry(0.72, 0.14, 0.98);
    const pileMat = lam("pileCase", () => ({ map: caseTex() }));
    this.pile = new THREE.InstancedMesh(geo, pileMat, N);
    { const r = rng(5), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
      let i = 0, y = 0;
      while (i < N) {
        const Hm = 13, rad = Math.max(0.3, 8.2 * (1 - y / Hm) + 0.2);
        const n = Math.max(1, Math.round((2 * Math.PI * rad) / 0.78));
        for (let k = 0; k < n && i < N; k++, i++) {
          const a = (k / n) * Math.PI * 2 + y * 3.1 + r() * 0.2, rr = rad - r() * 0.5;
          e.set((r() - 0.5) * 0.5, -a + (r() - 0.5) * 0.8, (r() - 0.5) * 0.5 - 0.35);
          q.setFromEuler(e); m.compose(V(PILE[0] + Math.cos(a) * rr, D0 + y + 0.07, PILE[2] + Math.sin(a) * rr), q, V(1, 1, 1));
          this.pile.setMatrixAt(i, m);
          this.pile.setColorAt(i, c.set(PILE_COLS[Math.floor(r() * PILE_COLS.length)]));
        }
        y += 0.17;
      }
    }
    this.pile.castShadow = true; this.pile.receiveShadow = true; this.pile.count = 0; this.pile.frustumCulled = false;
    this.zones.city.add(this.pile);
    // the bins cop B smashes: three bins and two boxes at the kerb
    const binM = M.binGreen, boxM = lam("cardboard", () => ({ color: "#c9965a" }));
    for (let k = 0; k < 5; k++) {
      const g = k < 3 ? cyl(0.3, 0.3, 0.95, 16).translate(0, -0.475, 0) : new THREE.BoxGeometry(0.7, 0.6, 0.7);
      const m = new THREE.Mesh(g, k < 3 ? binM : boxM);
      m.castShadow = true; m.receiveShadow = true; this.debris.push(m); this.zones.city.add(m);
    }
  }

  /** a pool of cars per kind */
  private car(kind: CarKind, i: number) {
    const l = (this.cars[kind] ??= []);
    while (l.length <= i) { const g = buildCar(kind, this.M, this.siren); this.root.add(g); l.push(g); }
    return l[i];
  }
  private poseCars(id: number, t: number) {
    const used: Record<string, number> = {};
    for (const c of carsAt(id, t) as Car[]) {
      const i = used[c.kind] ?? 0; used[c.kind] = i + 1;
      const g = this.car(c.kind, i);
      g.visible = true; g.position.set(c.x, D0, c.z); g.rotation.set(0, c.yaw, c.lean, "YXZ");
    }
    for (const [k, l] of Object.entries(this.cars)) l.forEach((g, i) => { if (i >= (used[k] ?? 0)) g.visible = false; });
    const on = sirenOn(t);
    this.siren.red.emissiveIntensity = on ? 3.0 : 0.15; this.siren.blue.emissiveIntensity = on ? 0.15 : 3.0;
  }
  private poseDebris(id: number, t: number) {
    const show = id === 8 || id === 1 || id === 12 || id === 15 || id === 16;
    const base: [number, number][] = [[9.2, 88.6], [9.4, 89.5], [9.0, 90.4], [9.8, 87.6], [9.9, 91.2]];
    this.debris.forEach((m, k) => {
      m.visible = show;
      if (!show) return;
      const [x, z] = base[k], u = id === 8 ? clamp01((t - T_SMASH) / 1.1) : id < 8 ? 0 : 1;
      const h0 = k < 3 ? 1.1 : 0.45, dir = [-1.2, 0.6, -0.3, 1.0, -0.8][k];
      m.position.set(x + dir * 3.5 * u - 0.8 * u, h0 + 0.15 + (4.5 + k * 0.6) * u * (1 - u) * 1.6, z - (3 + k) * u);
      m.rotation.set(u * (3 + k), u * k, u * (4 - k) * (k % 2 ? 1 : -1));
      if (id > 8) { m.position.y = k < 3 ? 0.45 : 0.45; m.rotation.set(Math.PI / 2, k, 0); }
    });
  }
  private drawScreens(id: number, t: number) {
    const s = screenAt(id, t), key = `${s.kind}|${Math.round(t * 30)}`;
    if (key !== this.screenKey) {
      const g = this.screenCv.getContext("2d")!;
      if (s.kind === "code") drawCode(g, 512, 384, s); else drawGame(g, 512, 384, s);
      // scanlines + a soft vignette, like an old CRT
      g.fillStyle = "rgba(0,0,0,0.12)"; for (let y = 0; y < 384; y += 4) g.fillRect(0, y, 512, 2);
      const vg = g.createRadialGradient(256, 192, 120, 256, 192, 330); vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.45)");
      g.fillStyle = vg; g.fillRect(0, 0, 512, 384);
      this.screenTex.needsUpdate = true; this.screenKey = key;
    }
    const b = boardAt(t), bk = `${b.cross.toFixed(2)}|${b.write.toFixed(2)}`;
    if (bk !== this.boardKey) { drawBoard(this.boardCv.getContext("2d")!, 1024, 752, t); this.boardTex.needsUpdate = true; this.boardKey = bk; }
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 14, 110);
    if (s.light === "golden") Rr = Math.max(Rr, 40);
    if (ZONE_OF[id] === "city") Rr = Math.max(Rr, 45);
    this.sun.position.copy(focus).addScaledVector(sunDir, 260); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 560; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar * 1.4;
    scene.fog = this.fog; scene.background = null;
    this.sunDisc.visible = s.light === "golden";
    if (this.sunDisc.visible) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i];
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    const want = ZONE_OF[id];
    for (const [k, g] of Object.entries(this.zones)) g.visible = k === want;
    this.poseCars(id, t);
    this.poseDebris(id, t);
    if (want === "office") this.drawScreens(id, t);
    this.pile.count = id === 14 ? Math.min(2300, pileCount(t)) : 0;
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      if (a.mat.emissiveMap) a.mat.emissive.set(tint);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e3 of fused) e3.bind();
    return focus;
  }
}
export type { V3 };
