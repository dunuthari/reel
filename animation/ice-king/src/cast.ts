// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
import * as S from "./story";
import { FPS, D0, SHOTS, smooth, clamp01 } from "./story";
import { LIGHTS } from "./lights";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
export const SU_SWING = 2.3 / 1830; // swing canvas: rope of 1830 units = 2.3 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const vOf = (i: number) => (i * 7 + (i >> 2)) % 4;
/** head-shape seed: 7 shapes, so marching soldiers in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
const SWAPS: Record<number, number[]> = { 1: [S.T_NOJOKE], 6: [S.T_ITDID, S.T_MELT, S.T_LOST], 7: [S.T_LOCKED], 15: [S.T_NOJOKE2] };
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };


// ---------------- The Ice King cast ----------------
const SK = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067"];
const SK_ISLAND = ["#a86e4a", "#8d5a3b", "#c99067", "#6b4430", "#b47c56"];
const INK_ = "#241726";
/** Boston, 1806: wool coats, waistcoats, tall hats and caps, bonnets and long dresses */
const BOSTONIAN = (v: number): Outfit => {
  const coats = ["#3f5f8a", "#7a5a3a", "#8c3b4a", "#2f5f4a", "#5d4a6a", "#a8724a", "#4a4f5a"];
  const base: Outfit = { jacket: coats[v % 7], pants: ["#d9c7a0", "#5b4a3a", "#3b3f52"][v % 3], boots: "#2a2028", skin: SK[v % 4] };
  if (v % 4 === 0) return { ...base, hat: "tophat", moustache: v % 8 ? undefined : "#4a3020" };
  if (v % 4 === 1) return { ...base, hat: "cap", cap: ["#5a4a3a", "#3f4f6a", "#6a3a3a"][v % 3], moustache: "#4a3020" };
  if (v % 4 === 2) return { ...base, hat: "bonnet", dress: ["#c25a7a", "#5a8fc2", "#b5653f", "#6a8f4a"][v % 4], jacket: ["#e9dcc0", "#d9c7a0"][v % 2] };
  return { ...base, hat: "hair", hair: ["#5a3b2a", "#2a201a", "#c9893a", "#4a3020"][v % 4] };
};
/** Martinique islanders: light cotton, bright skirts and head-wraps */
const ISLANDER = (v: number): Outfit => {
  const base: Outfit = { jacket: ["#f4f1ea", "#e9dcc0", "#f2d27a", "#9fd0e6"][v % 4], pants: ["#e9dcc0", "#5b6a8a", "#c9a46a"][v % 3], boots: "#5a3b2a", skin: SK_ISLAND[v % 5] };
  if (v % 3 === 0) return { ...base, hat: "bonnet", dress: ["#e2453c", "#f08a2c", "#3f9a6a", "#c2457a"][v % 4], jacket: "#f4f1ea" };
  if (v % 3 === 1) return { ...base, hat: "hair", hair: "#1d1612" };
  return { ...base, hat: "cap", cap: ["#e2453c", "#f2c94c", "#3f6fb5"][v % 3] };
};
const TUDOR: Outfit = { jacket: "#2f5f4a", pants: "#d9c7a0", boots: "#1d1a20", hat: "tophat", buttons: "#e8c45a", skin: "#ffe2c2" };
const TUDOR_OLD: Outfit = { ...TUDOR, hat: "crown", jacket: "#3a3270", buttons: "#f2c94c", sash: "#c0353a", moustache: "#efe9df", build: "stout" };
const READER_O: Outfit = { jacket: "#8c3b4a", pants: "#3b3f52", boots: "#2a2028", hat: "cap", cap: "#5a4a3a", moustache: "#5a3b2a", build: "stout", skin: "#f5c9a0" };
const WORKER = (v: number): Outfit => ({ jacket: ["#e9dcc0", "#9fb6c9", "#d9a65a", "#c47a5c"][v % 4], pants: ["#5b4a3a", "#3b4a6a"][v % 2], boots: INK_, hat: "cap", cap: ["#5a4a3a", "#7a2f2f", "#3f4f6a"][v % 3], skin: SK[(v + 1) % 4], moustache: v % 2 ? "#4a3020" : undefined });
const BARMAN_O: Outfit = { jacket: "#f4f1ea", pants: "#3b3f52", boots: INK_, hat: "hair", hair: "#1d1612", moustache: "#1d1612", belt: "#5a3b2a", skin: "#8d5a3b", build: "stout" };

/** mouth flap while someone speaks: cycles through open / closed shapes */
const TALK: Expr[] = ["grin", "neutral", "laugh", "whistle", "smile"];
const talk = (t: number, i: number, set: Expr[] = TALK) => set[Math.floor(t * 7 + i * 1.7) % set.length];
const who = (i: number, o: Outfit, okey: string): Who => ({ i, o, okey });
const stand = (cam: CamInfo, out: Stage, w: Who, x: number, z: number, fo: FrontOpts, y = D0, shadow = true) => {
  out.places.push(person(cam, w, x, y, z, { side: false, mirror: false }, fo, {}));
  if (shadow) blob(out, x, y, z);
};
/** someone walking from a to b between t0 and t1 (side view when crossing the frame, front view toward the camera) */
const walker = (cam: CamInfo, out: Stage, w: Who, t: number, a: [number, number], b: [number, number], t0: number, t1: number, expr: Expr, prop: FrontOpts["prop"] = null) => {
  const u = clamp01((t - t0) / (t1 - t0)), x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
  const moving = t > t0 && t < t1, dx = b[0] - a[0], dz = b[1] - a[1], n = Math.hypot(dx, dz) || 1;
  const ph = ((((t - t0) * 1.9) % 1) + 1) % 1, blink = lidAt(t, w.i);
  if (!moving) { stand(cam, out, w, x, z, { mode: "stand", expr, blink, prop }); return; }
  const view = prop ? { side: false, mirror: false, fs: 1 } : viewOf(cam, x, z, dx / n, dz / n);
  out.places.push(person(cam, w, x, D0, z, view, { phase: ph, expr, mode: "stroll", blink, prop }, { phase: ph, expr, mode: "march", blink, stomp: 0.4, stride: view.fs * 0.8 }));
  blob(out, x, D0, z);
};
const burst = (out: Stage, t: number, t0: number, x: number, y: number, z: number, s = 3, col = "#fff3b0") => {
  if (t < t0 || t >= t0 + 0.4) return;
  const u = q((t - t0) / 0.4, 30);
  out.fx.push({ key: `burst${col}${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, col), x, y, z, w: s, h: s });
};

// ---------------- props drawn on cards ----------------
const coin = (p: Pen) => { p.ol = 9; p.ell(64, 64, 52, 52, "#f2c94c"); p.arc(64, 64, 32, 32, 200, 340, 7, "#b8892a"); p.stroke([[64, 40], [64, 88]], 7, "#b8892a"); };
const coins = (p: Pen) => {
  p.ol = 5;
  for (const [x, y] of [[70, 120], [120, 100], [168, 130], [110, 150], [150, 70], [200, 92]] as const) {
    p.ell(x, y, 34, 28, "#f2c94c"); p.arc(x, y, 20, 15, 200, 340, 4, "#b8892a");
  }
};
const sweat = (p: Pen) => { p.ol = 7; p.poly([[64, 10], [92, 70], [88, 96], [64, 112], [40, 96], [36, 70]], "#9fd8f2"); p.ell(56, 78, 8, 12, "#ffffff", 0); };
const paperFlat = (p: Pen) => {
  p.ol = 6; p.poly([[10, 10], [290, 14], [286, 390], [14, 386]], "#f1ead8");
  p.poly([[30, 30], [270, 32], [270, 70], [30, 68]], "#2a2430", 0);
  for (let c = 0; c < 2; c++) for (let i = 0; i < 12; i++) p.stroke([[30 + c * 130, 96 + i * 24], [140 + c * 130 - (i % 3) * 14, 96 + i * 24]], 5, "#6a6258");
};
/** a few drops of sweat flicking off a head */
const sweatDrops = (out: Stage, t: number, i: number, x: number, y: number, z: number) => {
  for (let k = 0; k < 2; k++) {
    const u = ((t * 0.9 + hh(i, k) + k * 0.5) % 1);
    const side = k % 2 ? 1 : -1;
    out.fx.push({ key: "sweat", cw: 128, ch: 128, draw: sweat, x: x + side * (0.22 + 0.25 * u), y: y + 0.15 * Math.sin(u * Math.PI) - 0.35 * u * u, z, w: 0.14, h: 0.14 });
  }
};

// ---------------- shots ----------------
const [RX, , RZ] = S.READER;
const L = LEAD;
/** S1 the reader with the paper; on "No joke" he jolts and a burst pops at the paper */
const reader = (cam: CamInfo, t: number, out: Stage) => {
  const expr: Expr = t < S.T_NOJOKE - L ? (t < 2.2 ? "neutral" : "stern") : t < S.T_NOJOKE + 0.9 ? "shock" : "nervous";
  const jolt = t > S.T_NOJOKE && t < S.T_NOJOKE + 0.25 ? Math.sin(((t - S.T_NOJOKE) / 0.25) * Math.PI) * 0.06 : 0;
  stand(cam, out, who(500, READER_O, "reader"), RX, RZ, { mode: "stand", expr, prop: "paper", blink: lidAt(t, 500, SWAPS[1]) }, D0 + jolt);
  burst(out, t, S.T_NOJOKE, RX + 0.35, 1.55, RZ - 0.25, 1.4);
  walker(cam, out, who(510, BOSTONIAN(1), "b1"), t, [RX - 6, RZ + 4.5], [RX + 6, RZ + 4.5], -1, 8, "whistle");
  walker(cam, out, who(511, BOSTONIAN(2), "b2"), t, [RX + 7, RZ + 6.5], [RX - 5, RZ + 6.5], 0, 9, "smile");
};
/** S2 the wharf: Tudor, proud, by his brig; dockers stroll past */
const wharf = (cam: CamInfo, t: number, out: Stage) => {
  stand(cam, out, who(520, TUDOR, "tudor"), 2.0, -10.0, { mode: "stand", expr: t < 7.0 ? "grin" : "smile", blink: lidAt(t, 520), wave: t > 6.4 && t < 7.6 ? Math.sin((t - 6.4) * 8) : undefined });
  walker(cam, out, who(521, WORKER(0), "w0"), t, [-2.5, -5.5], [1.5, -18], 5.0, 9.5, "whistle");
  walker(cam, out, who(522, WORKER(1), "w1"), t, [2.8, -19], [-1.5, -6.5], 5.2, 9.5, "neutral");
  stand(cam, out, who(523, WORKER(2), "w2"), 1.6, -14.6, { mode: "stand", expr: "stern", prop: ["hammer", 0.5 + 0.5 * Math.sin(t * 7)], blink: lidAt(t, 523) });
};
/** S3 the pond: three sawyers at the ice */
const pond = (cam: CamInfo, t: number, out: Stage) => {
  ([[239.25, 33.1], [241.45, 33.7], [240.5, 35.9]] as const).forEach(([x, z], i) =>
    stand(cam, out, who(530 + i, WORKER(i + 1), `w${i + 1}`), x, z, { mode: "stand", expr: (["stern", "whistle", "neutral"] as Expr[])[i], prop: ["saw", 0.5 + 0.5 * Math.sin(t * 9 + i * 2)], blink: lidAt(t, 530 + i) }, D0 + 0.015));
};
/** S5 the townsfolk laugh over the paper */
const laugh = (cam: CamInfo, t: number, out: Stage) => {
  stand(cam, out, who(500, READER_O, "reader"), RX, RZ, { mode: "stand", expr: t < S.T_SLIP - L ? talk(t, 0, ["grin", "neutral"]) : talk(t, 0, ["laugh", "grin"]), prop: "paper", blink: lidAt(t, 500) });
  ([[-1.25, 0.7], [1.15, 0.55], [-0.55, 1.6], [0.75, 1.75], [2.0, 1.4]] as const).forEach(([dx, dz], i) => {
    const expr: Expr = t < S.T_SLIP - L ? (["smile", "grin", "neutral", "smile_closed", "grin"] as Expr[])[i] : talk(t, i + 1, ["laugh", "laugh", "grin"]);
    const hop = t > S.T_SLIP ? Math.max(0, Math.sin((t - S.T_SLIP) * 9 + i)) * 0.04 : 0;
    stand(cam, out, who(540 + i, BOSTONIAN(i + 3), `b${i + 3}`), RX + dx, RZ + dz, { mode: "stand", expr, blink: lidAt(t, 540 + i), look: dx > 0 ? -1 : 1 }, D0 + hop);
  });
};
/** S6 Martinique: Tudor shows off his ice, the islanders don't know what to do with it, it melts, his money flies */
const melt = (cam: CamInfo, t: number, out: Stage) => {
  const [px, , pz] = S.TROPIC_PIER;
  const tE: Expr = t < S.T_NOBODY - L ? "grin" : t < S.T_MELT - L ? "nervous" : t < S.T_LOST - L ? "shock" : "pained";
  stand(cam, out, who(520, TUDOR, "tudor"), px + 1.75, pz + 0.7, { mode: "stand", expr: tE, blink: lidAt(t, 520, SWAPS[6]), wave: t < S.T_NOBODY && t > 18.6 ? Math.sin((t - 18.6) * 7) : undefined, look: -1 });
  ([[-1.7, 0.9], [-1.2, -1.4], [-2.6, -0.3]] as const).forEach(([dx, dz], i) => {
    const expr: Expr = t < S.T_NOBODY - L ? (["neutral", "smile", "neutral"] as Expr[])[i] : t < S.T_MELT ? (["nervous", "dazed", "nervous"] as Expr[])[i] : (["dazed", "laugh", "neutral"] as Expr[])[i];
    stand(cam, out, who(560 + i, ISLANDER(i), `i${i}`), px + dx, pz + dz, { mode: "stand", expr, blink: lidAt(t, 560 + i), look: 1 });
  });
  // the money flies away on "lost"
  if (t > S.T_LOST - L) for (let k = 0; k < 7; k++) {
    const u = t - S.T_LOST - k * 0.09;
    if (u < 0 || u > 1.6) continue;
    out.fx.push({ key: "coin", cw: 128, ch: 128, draw: coin, x: px + 1.75 + (hh(k, 1) - 0.4) * 2.4 * u, y: 1.2 + 3.2 * u - 1.2 * u * u, z: pz + 0.7 + (hh(k, 2) - 0.5) * u, w: 0.22, h: 0.22, rot: u * 6 + k });
  }
};
/** S7 the cell: Tudor slumped on the bench */
const jail = (cam: CamInfo, t: number, out: Stage) => {
  const [cx, , cz] = S.CELL;
  stand(cam, out, who(520, TUDOR, "tudor"), cx + 0.3, cz + 2.62, { mode: "sit", expr: t < S.T_LOCKED - L ? "pained" : t < S.T_LOCKED + 1 ? "shock" : "dazed", blink: lidAt(t, 520, SWAPS[7]), look: -0.3 }, D0, false);
  burst(out, t, S.T_LOCKED, cx + 1.3, 1.4, cz - 1.95, 1.2, "#e8eef7");
};
/** S8 a hot street: islanders sweat over warm drinks */
const street = (cam: CamInfo, t: number, out: Stage) => {
  ([[-242.6, 9.2], [-240.9, 8.6], [-239.2, 9.6], [-241.9, 11.2], [-238.0, 11.0]] as const).forEach(([x, z], i) => {
    const expr: Expr = (["pained", "dazed", "pained", "nervous", "dazed"] as Expr[])[i];
    stand(cam, out, who(570 + i, ISLANDER(i + 3), `i${i + 3}`), x, z, { mode: "stand", expr, prop: i % 2 ? "cup" : null, wave: i % 2 ? undefined : Math.sin(t * 10 + i), blink: lidAt(t, 570 + i) });
    sweatDrops(out, t, i, x, 1.75, z - 0.05);
  });
};
/** S9 an islander pokes the block of ice and jumps */
const poke = (cam: CamInfo, t: number, out: Stage) => {
  const tp = 36.5;
  const expr: Expr = t < tp - L ? "nervous" : t < tp + 0.8 ? "shock" : "dazed";
  const hop = t > tp && t < tp + 0.3 ? Math.sin(((t - tp) / 0.3) * Math.PI) * 0.1 : 0;
  stand(cam, out, who(580, ISLANDER(1), "i1"), -238.15, 9.55, { mode: "stand", expr, blink: lidAt(t, 580), wave: t < tp ? 0.2 : undefined }, D0 + hop);
  stand(cam, out, who(581, ISLANDER(5), "i5"), -239.5, 9.9, { mode: "stand", expr: t < tp ? "neutral" : "laugh", blink: lidAt(t, 581), prop: "cup" });
  burst(out, t, tp, -238.4, 1.25, 8.8, 0.9, "#cfeefa");
};
/** S10 workers carry blocks into the new icehouse; Tudor watches, proud */
const icehouse = (cam: CamInfo, t: number, out: Stage) => {
  stand(cam, out, who(520, TUDOR, "tudor"), -231.0, 9.4, { mode: "stand", expr: t < S.T_ICEHOUSE - L ? "smile" : "grin", blink: lidAt(t, 520), wave: t > S.T_ICEHOUSE && t < S.T_ICEHOUSE + 1.3 ? Math.sin((t - S.T_ICEHOUSE) * 8) : undefined, look: 1 });
  S.CARRY_T.forEach((t0, k) => {
    const c = S.carryPath(t, k);
    if (c.u >= 1) return;
    const w = who(590 + k, WORKER(k + 2), `w${k + 2}`);
    if (t < t0) { stand(cam, out, w, -231.4 + (k % 2) * 0.5, 7.0 + k * 0.6, { mode: "stand", expr: "neutral", blink: lidAt(t, 590 + k) }); return; }
    out.places.push(person(cam, w, c.x, D0, c.z, { side: false, mirror: false }, { phase: ((t - t0) * 1.9) % 1, expr: "stern", mode: "stroll", blink: lidAt(t, 590 + k) }, {}));
    blob(out, c.x, D0, c.z);
  });
  ([[-236.5, 10.6], [-235.2, 11.4]] as const).forEach(([x, z], i) => stand(cam, out, who(600 + i, ISLANDER(i + 7), `i${i + 7}`), x, z, { mode: "stand", expr: (["smile", "nervous"] as Expr[])[i], blink: lidAt(t, 600 + i), look: 1 }));
};
/** S11 the wharf: two dockers shovel sawdust over the blocks */
const sawdust = (cam: CamInfo, t: number, out: Stage) => {
  ([[2.15, -12.4], [0.2, -13.0]] as const).forEach(([x, z], i) => {
    const k = 0.5 + 0.5 * Math.sin(t * 5 + i * 2.2);
    stand(cam, out, who(610 + i, WORKER(i), `w${i}`), x, z, { mode: "stand", expr: (["whistle", "stern"] as Expr[])[i], prop: ["shovel", k], blink: lidAt(t, 610 + i) });
    const ph = (t * 5 + i * 2.2) % (Math.PI * 2);
    if (ph > 1.2 && ph < 2.2) out.fx.push({ key: `dust${q((ph - 1.2), 10)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q((ph - 1.2), 10), "#d9b47a", 12, 30, 200), x: x + 0.7, y: 1.35, z: z - 0.9, w: 0.9, h: 0.9 });
  });
  burst(out, t, S.T_SAWDUST, 3.9, 1.9, -13.6, 1.4, "#e8c995");
};
/** S12 the bar: Tudor hands over the ice, the customers taste a cold drink and grin */
const bar = (cam: CamInfo, t: number, out: Stage) => {
  const [bx, , bz] = S.BAR;
  stand(cam, out, who(620, BARMAN_O, "barman"), bx - 0.4, bz + 0.95, { mode: "stand", expr: t < S.T_FREE - L ? "nervous" : "grin", prop: t > 46.8 ? "glass" : null, blink: lidAt(t, 620) }, D0, false);
  stand(cam, out, who(520, TUDOR, "tudor"), bx - 2.0, bz - 1.25, { mode: "stand", expr: "grin", blink: lidAt(t, 520), wave: t < S.T_FREE + 0.6 ? Math.sin(t * 6) * 0.5 : undefined, look: 1 });
  ([[bx - 0.55, bz - 1.4], [bx + 1.3, bz - 1.5]] as const).forEach(([x, z], i) => {
    const expr: Expr = t < S.T_HOOKED - L ? (["neutral", "nervous"] as Expr[])[i] : talk(t, i, ["laugh", "grin", "laugh"]);
    stand(cam, out, who(630 + i, ISLANDER(i + 2), `i${i + 2}`), x, z, { mode: "stand", expr, prop: t > 47.4 + i * 0.3 ? "glass" : null, blink: lidAt(t, 630 + i), look: -1 });
    burst(out, t, S.T_HOOKED + i * 0.25, x, 1.95, z - 0.1, 1.0, "#cfeefa");
  });
};
/** S14 golden: the Ice King, crowned, coins at his feet */
const king = (cam: CamInfo, t: number, out: Stage) => {
  stand(cam, out, who(640, TUDOR_OLD, "tudorOld"), 2.2, -11.0, { mode: "stand", expr: t < S.T_KING - L ? "smile_closed" : "grin", prop: "coin", blink: lidAt(t, 640), look: -0.3 });
  out.fx.push({ key: "coins", cw: 256, ch: 200, draw: coins, x: 1.7, y: D0 + 0.02, z: -10.2, w: 0.8, h: 0.62, flat: true, rot: 0.3 });
  burst(out, t, S.T_KING, 2.2, 2.35, -11.05, 1.6, "#ffe08a");
  burst(out, t, S.T_RICH, 1.6, 0.5, -10.4, 1.0, "#ffe08a");
};
/** S15 the reader again, now with an iced drink, grinning */
const end = (cam: CamInfo, t: number, out: Stage) => {
  stand(cam, out, who(500, READER_O, "reader"), RX, RZ, { mode: "stand", expr: t < S.T_NOJOKE2 - L ? "smile" : "grin", prop: "glass", blink: lidAt(t, 500, SWAPS[15]) });
  out.fx.push({ key: "paperFlat", cw: 300, ch: 400, draw: paperFlat, x: RX - 0.95, y: D0 + 0.96, z: RZ + 0.2, w: 0.42, h: 0.56, flat: true, rot: 0.4 });
  walker(cam, out, who(512, BOSTONIAN(5), "b5"), t, [RX + 6, RZ + 5], [RX - 6, RZ + 5], 59.2, 66, "smile");
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.crowd) {
    case "reader": reader(cam, t, out); break;
    case "wharf": wharf(cam, t, out); break;
    case "pond": pond(cam, t, out); break;
    case "laugh": laugh(cam, t, out); break;
    case "melt": melt(cam, t, out); break;
    case "jail": jail(cam, t, out); break;
    case "street": street(cam, t, out); break;
    case "poke": poke(cam, t, out); break;
    case "icehouse": icehouse(cam, t, out); break;
    case "sawdust": sawdust(cam, t, out); break;
    case "bar": bar(cam, t, out); break;
    case "king": king(cam, t, out); break;
    case "end": end(cam, t, out); break;
    default: break;
  }
  return out;
};
export { FPS, smooth, clamp01 };
