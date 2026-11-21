// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import { Pen, bodyFront, bodySide, fxBurst, fxPuff, fxStars, fxShadow, fxContact, Outfit, Expr, FrontOpts, SideOpts } from "./toon";
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
const SWAPS: Record<number, number[]> = { 6: [S.T_CANCEL], 7: [S.T_WEIRD], 16: [S.T_NOTBROKEN, S.T_EXISTS] };
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

/** mouth flap while someone speaks: cycles through open / closed shapes */
export type _T = 0;
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

export type Stage = { places: Place[]; fx: FxPlace[] };
// ---------------- The Bug That Made GTA: cast ----------------
const SK = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067", "#8d5a3b"];
const INK_ = "#241726";
/** the studio, 1995: jumpers, band t-shirts, jeans, trainers, messy hair and beards */
const DEV = (v: number): Outfit => ({
  jacket: ["#3f6fb5", "#2f2f38", "#8c3b4a", "#3f9a6a", "#f08a2c", "#6a5a8a"][v % 6], pants: ["#3b5b9a", "#4a5a7a", "#2f3a55"][v % 3],
  boots: ["#f4f1ea", "#2a2028", "#c9c3b8"][v % 3], hat: "hair", hair: ["#5a3b2a", "#2a201a", "#c9893a", "#8a4a2a", "#1d1612", "#a06a3a"][v % 6],
  moustache: v % 3 === 1 ? ["#5a3b2a", "#2a201a", "#c9893a"][v % 3] : undefined, skin: SK[v % 4],
});
const PUBLISHER: Outfit = { jacket: "#2f3340", pants: "#2f3340", boots: INK_, hat: "hair", hair: "#8a8f9a", buttons: "#c9c3b8", belt: "#1d1a20", build: "stout", skin: "#f5c9a0" };
const COP: Outfit = { jacket: "#26324f", pants: "#1f2740", boots: INK_, hat: "cap", cap: "#1b2236", belt: "#1d1a20", buttons: "#e8c45a", moustache: "#4a3020", build: "stout", skin: "#f5c9a0" };
const ROBBER: Outfit = { jacket: "#2b2b30", pants: "#3b5b9a", boots: "#f4f1ea", hat: "cap", cap: "#3a3a44", skin: "#ecd0b6" };
const FAN = (v: number): Outfit => ({
  jacket: ["#e2453c", "#3f6fb5", "#f2c94c", "#3f9a6a", "#8a4fc0", "#f08a2c", "#2f2f38", "#e9dcc0"][v % 8], pants: ["#3b5b9a", "#2f2f38", "#c9a46a", "#5b6a8a"][v % 4],
  boots: ["#f4f1ea", "#2a2028"][v % 2], hat: (["hair", "cap", "hair", "bonnet"] as const)[v % 4], hair: ["#5a3b2a", "#1d1612", "#c9893a", "#8a4a2a"][v % 4],
  cap: ["#e2453c", "#2f2f38", "#3f6fb5"][v % 3], dress: v % 4 === 3 ? ["#c2457a", "#5a8fc2", "#6a8f4a"][v % 3] : undefined, skin: SK[v % 5],
});
/** Dundee passers-by: anoraks and jumpers */
const SCOT = (v: number): Outfit => ({ ...FAN(v + 3), jacket: ["#5a7a4a", "#8c3b4a", "#3f5f8a", "#c9a46a"][v % 4], hat: v % 2 ? "cap" : "hair", cap: ["#3f4f6a", "#6a3a3a"][v % 2] });

// ---------------- props drawn on cards ----------------
const binder = (p: Pen) => {
  p.ol = 8; p.poly([[30, 20], [226, 20], [226, 300], [30, 300]], "#2f5fb5");
  p.poly([[30, 20], [62, 20], [62, 300], [30, 300]], "#22468a", 0);
  p.poly([[90, 110], [200, 110], [200, 170], [90, 170]], "#f4f1ea");
  p.g.fillStyle = "#1a2440"; p.g.font = "bold 44px sans-serif"; p.g.textAlign = "center"; p.g.textBaseline = "middle"; p.g.fillText("RULES", 145, 142);
  for (const y of [60, 260]) p.ell(46, y, 9, 9, "#c9c3b8");
};
const clock = (t: number) => (p: Pen) => {
  p.ol = 8; p.ell(128, 128, 112, 112, "#f4f1ea");
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; p.stroke([[128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88], [128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100]], 6, INK_); }
  const m = t * 9, h = t * 0.75;
  p.stroke([[128, 128], [128 + Math.sin(h) * 52, 128 - Math.cos(h) * 52]], 12, INK_);
  p.stroke([[128, 128], [128 + Math.sin(m) * 84, 128 - Math.cos(m) * 84]], 7, "#c0352a");
  p.dot(128, 128, 10, INK_);
};
const confetti = (k: number) => (p: Pen) => { p.ol = 0; p.poly([[10, 4], [54, 10], [50, 28], [6, 22]], ["#e2453c", "#f2c94c", "#3f6fb5", "#3f9a6a", "#8a4fc0"][k % 5], 0); };
const puff = (out: Stage, t: number, t0: number, x: number, y: number, z: number, s = 1.6) => {
  if (t < t0 || t >= t0 + 1.2) return;
  const u = q((t - t0) / 1.2, 30);
  out.fx.push({ key: `puff${u}`, cw: 500, ch: 500, draw: (p) => fxPuff(p, u), x, y: y + 0.6 * u, z, w: s * (0.7 + 0.6 * u), h: s * (0.7 + 0.6 * u), soft: true });
};
const stars = (out: Stage, t: number, x: number, y: number, z: number, s = 0.7) => {
  const u = q((t * 0.8) % 1, 30);
  out.fx.push({ key: `stars${u}`, cw: 500, ch: 500, draw: (p) => fxStars(p, u), x, y, z, w: s, h: s });
};
/** crash: a spark burst and a smoke puff at a car's flank */
const crash = (out: Stage, t: number, t0: number, x: number, z: number) => {
  burst(out, t, t0, x, 0.95, z, 2.6, "#ffd27a");
  burst(out, t, t0 + 0.08, x + 0.3, 1.1, z + 0.4, 1.6, "#ffffff");
  puff(out, t, t0 + 0.1, x, 0.7, z + 0.6, 1.8);
};
const carAt = (id: number, t: number, i = 0) => S.carsAt(id, t)[i];
const SEAT = (i: number) => S.DESKS[i] + 0.15;
/** the four devs at their desks; typing hands, blinks; exprs per dev */
const devsSeated = (cam: CamInfo, t: number, out: Stage, exprs: Expr[], skip = -1, swaps: number[] = []) => {
  S.DESKS.forEach((_, i) => {
    if (i === skip) return;
    stand(cam, out, who(700 + i, DEV(i), `dev${i}`), SEAT(i), S.SEAT_Z, { mode: "sit", expr: exprs[i % exprs.length], blink: lidAt(t, 700 + i, swaps), look: -0.3, wave: Math.sin(t * 14 + i) * 0.25 }, D0, false);
  });
};

// ---------------- shots ----------------
const L_ = LEAD;
const hook = (_cam: CamInfo, t: number, out: Stage) => {
  const c = carAt(1, S.T_BROKEN);
  crash(out, t, S.T_BROKEN - 0.08, c.x - 0.95, c.z + 0.6);
};
const dundee = (cam: CamInfo, t: number, out: Stage) => {
  const [dx] = S.DUNDEE;
  walker(cam, out, who(720, SCOT(0), "s0"), t, [dx - 4, 6.4], [dx + 12, 6.4], 4.0, 13, "whistle");
  walker(cam, out, who(721, SCOT(1), "s1"), t, [dx + 14, -6.4], [dx - 2, -6.4], 4.0, 13, "smile");
  walker(cam, out, who(722, SCOT(2), "s2"), t, [dx + 22, 6.6], [dx + 8, 6.6], 4.0, 13, "neutral");
  stand(cam, out, who(723, SCOT(3), "s3"), dx + 8.4, -6.5, { mode: "stand", expr: "smile", blink: lidAt(t, 723), look: 1 }, D0 + 0.15);
};
const office = (cam: CamInfo, t: number, out: Stage) => {
  devsSeated(cam, t, out, ["whistle", "smile", "neutral", "grin"]);
};
const trophy = (cam: CamInfo, t: number, out: Stage) => {
  const [sx, sy, sz] = S.SHELF;
  stand(cam, out, who(701, DEV(1), "dev1"), sx + 1.5, sz - 0.75, { mode: "stand", expr: t < S.T_LEMMINGS - L_ ? "smile" : "grin", blink: lidAt(t, 701), look: -1, wave: t > S.T_LEMMINGS - 0.2 ? Math.sin((t - 10) * 8) : undefined });
  burst(out, t, S.T_LEMMINGS, sx + 0.12, sy + 0.25, sz, 0.9, "#ffe08a");
};
const cancel = (cam: CamInfo, t: number, out: Stage) => {
  const late = t > S.T_CANCEL - L_;
  devsSeated(cam, t, out, late ? ["shock", "shock", "shock", "shock"] : t > S.T_BEHIND - L_ ? ["pained", "dazed", "nervous", "pained"] : ["nervous", "neutral", "dazed", "nervous"], -1, [S.T_CANCEL]);
  // the clock races on "behind schedule"
  const tc = t < S.T_BEHIND - 0.3 ? t * 0.2 : (S.T_BEHIND - 0.3) * 0.2 + (t - S.T_BEHIND + 0.3) * 2.2;
  out.fx.push({ key: `clock${q(tc, 60)}`, cw: 256, ch: 256, draw: clock(tc), x: -303.6, y: 2.5, z: 4.94, w: 0.5, h: 0.5 });
  // the publisher walks in from the door on "the company paying for it" and stops, paper in hand
  const a: [number, number] = [-293.4, 0.2], b: [number, number] = [-298.6, -0.2];
  walker(cam, out, who(730, PUBLISHER, "pub"), t, a, b, S.T_COMPANY - 0.7, S.T_CANCEL - 0.35, "stern", t > S.T_CANCEL - 0.35 ? "paper" : null);
  burst(out, t, S.T_CANCEL, b[0], 1.85, b[1], 1.3, "#ffe08a");
};
const face = (cam: CamInfo, t: number, out: Stage) => {
  const expr: Expr = t < S.T_WEIRD - L_ ? "neutral" : t < S.T_WEIRD + 0.5 ? "shock" : "nervous";
  stand(cam, out, who(701, DEV(1), "dev1"), SEAT(S.HERO), S.SEAT_Z, { mode: "sit", expr, blink: lidAt(t, 701, [S.T_WEIRD]), look: -0.6 }, D0, false);
  stand(cam, out, who(702, DEV(2), "dev2"), SEAT(2), S.SEAT_Z, { mode: "sit", expr: "neutral", blink: lidAt(t, 702), look: -0.3 }, D0, false);
};
const chaos = (cam: CamInfo, t: number, out: Stage) => {
  const c = carAt(8, S.T_RAMMED);
  crash(out, t, S.T_RAMMED - 0.05, c.x - 0.95, c.z + 0.5);
  crash(out, t, S.T_SMASH, 9.2, 89.4);
  for (let k = 0; k < 4; k++) {
    const x = -9.0 - (k % 2) * 0.8, z = 70 + k * 3.2, scared = t > S.T_CRAZY;
    stand(cam, out, who(740 + k, FAN(k + 1), `f${k + 1}`), x, z, { mode: "stand", expr: scared ? (k % 2 ? "shock" : "nervous") : "neutral", blink: lidAt(t, 740 + k), look: 1 }, D0 + 0.15 + (scared ? Math.max(0, Math.sin(t * 11 + k)) * 0.05 : 0));
  }
};
const laugh = (cam: CamInfo, t: number, out: Stage) => {
  const hx = S.DESKS[S.HERO];
  const fun = t > S.T_PLAYED - L_;
  // first the hero alone, about to fix it; then the whole team piles in round his screen
  stand(cam, out, who(701, DEV(1), "dev1"), SEAT(S.HERO), S.SEAT_Z, { mode: "sit", expr: fun ? talk(t, 1, ["laugh", "grin"]) : "stern", blink: lidAt(t, 701), look: -0.3, wave: fun ? undefined : Math.sin(t * 14) * 0.3 }, D0, false);
  ([[-1.0, 2.75], [0.55, 2.85], [1.25, 2.5], [-1.55, 2.3]] as const).forEach(([dx, z], i) => {
    const arrive = S.T_PLAYED - 0.2 + i * 0.25;
    if (t < arrive) return;
    const hop = Math.max(0, Math.sin(t * 9 + i * 1.7)) * 0.05 * (t > S.T_FUN - 0.5 ? 1.6 : 1);
    stand(cam, out, who(710 + i, DEV(i + 2), `dev${i + 2}`), hx + dx, z, { mode: "stand", expr: talk(t, i + 2, ["laugh", "laugh", "grin"]), blink: lidAt(t, 710 + i), look: dx > 0 ? -1 : 1 }, D0 + hop);
  });
  burst(out, t, S.T_FUN, hx - 0.45, 1.6, S.DESK_Z + 0.4, 1.4, "#fff3b0");
};
const binderShot = (cam: CamInfo, t: number, out: Stage) => {
  const [bx, , bz] = S.BIN, dx = bx - 0.9, dz = bz + 0.5;
  stand(cam, out, who(702, DEV(2), "dev2"), dx, dz, { mode: "stand", expr: t < S.T_KEPT - L_ ? "smile" : t < 41.5 ? "grin" : "laugh", blink: lidAt(t, 702), look: 1, wave: t > 41.3 && t < 41.9 ? 1 : undefined });
  devsSeated(cam, t, out, ["grin", "laugh", "grin", "grin"], 2);
  // the binder: held up, thrown on an arc, into the bin
  const t0 = 41.55, u = clamp01((t - t0) / 0.5);
  if (t < t0 + 0.5) {
    const x = dx + 0.35 + (bx - dx - 0.35) * u, y = 1.35 + 0.5 * Math.sin(u * Math.PI) - 0.95 * u, z = dz - 0.15 + (bz - dz + 0.15) * u;
    out.fx.push({ key: "binder", cw: 256, ch: 320, draw: binder, x, y, z, w: 0.34, h: 0.42, rot: -u * 4 });
  }
  burst(out, t, t0 + 0.5, bx, 0.6, bz, 0.9, "#fff3b0");
};
const robber = (cam: CamInfo, t: number, out: Stage) => {
  const [rx, , rz] = S.ROBBER_CAR;
  stand(cam, out, who(750, ROBBER, "robber"), rx + 1.0, rz - 2.2, { mode: "stand", expr: t < S.T_BADGUY - L_ ? "smile_closed" : "grin", blink: lidAt(t, 750), look: 1, wave: t > S.T_BADGUY ? Math.sin((t - S.T_BADGUY) * 9) : undefined });
  burst(out, t, S.T_BADGUY, rx + 1.0, 2.1, rz - 2.3, 1.2, "#ffe08a");
};
const board = (cam: CamInfo, t: number, out: Stage) => {
  stand(cam, out, who(703, DEV(3), "dev3"), S.BOARD[0] + 1.25, S.BOARD[2] - 0.7, { mode: "stand", expr: t < S.T_GTA - L_ ? "neutral" : "grin", blink: lidAt(t, 703), look: -1, wave: t > S.T_NAME - 0.3 && t < 46.8 ? Math.sin(t * 16) * 0.6 + 0.4 : undefined });
  burst(out, t, S.T_GTA + 0.95, S.BOARD[0], 1.55, S.BOARD[2] - 0.1, 1.6, "#ffe08a");
};
const pile = (cam: CamInfo, t: number, out: Stage) => {
  const [px, , pzz] = S.PILE;
  for (let k = 0; k < 14; k++) {
    const x = px - 6.2 + (k % 7) * 1.9 + (k > 6 ? 0.9 : 0), z = pzz - 20 - (k > 6 ? 2.0 : 0) + (k % 3) * 0.4;
    const cheer = t > S.T_SOLD - 0.5;
    const hop = cheer ? Math.max(0, Math.sin(t * 8 + k * 1.3)) * 0.12 : 0;
    stand(cam, out, who(760 + k, FAN(k), `fan${k}`), x, z, { mode: "stand", expr: cheer ? talk(t, k, ["laugh", "grin", "laugh"]) : (["smile", "grin", "whistle"] as Expr[])[k % 3], blink: lidAt(t, 760 + k), look: x < px ? 1 : -1, wave: cheer ? Math.sin(t * 10 + k) : undefined }, D0 + hop);
  }
  burst(out, t, S.T_1997, px, 2.0, pzz - 4, 3.2, "#ffe08a");
  burst(out, t, S.T_MILLION, px, 11, pzz, 6, "#ffe08a");
  if (t > S.T_MILLION - 0.2) for (let k = 0; k < 40; k++) {
    const u = (t - S.T_MILLION + 0.2 + hh(k, 3) * 0.6), x = px - 12 + hh(k, 1) * 24, z = pzz - 8 + hh(k, 2) * 10;
    out.fx.push({ key: `conf${k % 5}`, cw: 64, ch: 32, draw: confetti(k), x: x + Math.sin(u * 3 + k) * 0.8, y: 14 - u * 3.2 - hh(k, 4) * 4, z, w: 0.36, h: 0.18, rot: u * 5 + k });
  }
};
const rams = (_cam: CamInfo, t: number, out: Stage) => {
  const c = carAt(15, S.T_RAMS);
  crash(out, t, S.T_RAMS - 0.05, c.x - 0.95, c.z + 0.5);
};
const cop = (cam: CamInfo, t: number, out: Stage) => {
  const expr: Expr = t < S.T_MAD - L_ ? "stern" : t < S.T_NOTBROKEN - L_ ? "smile_closed" : t < S.T_REASON - L_ ? "grin" : t < S.T_EXISTS - L_ ? "smile" : "laugh";
  stand(cam, out, who(770, COP, "cop"), -0.3, -82.6, { mode: "stand", expr, blink: lidAt(t, 770, SWAPS[16]), look: -0.4, wave: t > S.T_NOTBROKEN && t < S.T_NOTBROKEN + 0.9 ? Math.sin((t - S.T_NOTBROKEN) * 9) : undefined });
  // the red car behind, smoking; stars over its bonnet
  puff(out, t, 55.5 + (Math.floor((t - 55.5) / 1.2) * 1.2), 6.6, 1.0, -87.2, 2.0);
  stars(out, t, 7.0, 1.75, -88.0, 0.9);
  burst(out, t, S.T_EXISTS, -0.3, 2.25, -82.7, 1.4, "#ffe08a");
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.crowd) {
    case "hook": hook(cam, t, out); break;
    case "dundee": dundee(cam, t, out); break;
    case "office": office(cam, t, out); break;
    case "trophy": trophy(cam, t, out); break;
    case "cancel": cancel(cam, t, out); break;
    case "face": face(cam, t, out); break;
    case "chaos": chaos(cam, t, out); break;
    case "laugh": laugh(cam, t, out); break;
    case "binder": binderShot(cam, t, out); break;
    case "robber": robber(cam, t, out); break;
    case "board": board(cam, t, out); break;
    case "pile": pile(cam, t, out); break;
    case "rams": rams(cam, t, out); break;
    case "cop": cop(cam, t, out); break;
    default: break;
  }
  return out;
};
export { FPS, smooth, clamp01 };
