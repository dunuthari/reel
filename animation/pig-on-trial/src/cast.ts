// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so soldiers marching in step share canvases (7 head shapes x 4
// outfits). Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, KID, fxNote, fxBurst, fxSplash, fxStars, fxCreak, fxRing, fxBlob, fxShadow, fxContact, fxPlank, fxDrum,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import {
  FPS, D0, SHOTS, smooth, clamp01, T_LOST, T_ATTACK, T_HURT, T_HANGED, T_GLOVE, T_RECEIPT, T_LOST2, T_WALK0, T_WALK1,
  T_BRUTAL, DOCK, JUDGE, TABLE, GALLOWS, sowWalk, walkX, WALK_Z, WALK_T0,
} from "./story";
import { drawBeast, Beast, BeastFace } from "./beasts";
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
const SWAPS: Record<number, number[]> = { 1: [T_LOST], 3: [T_ATTACK, T_HURT], 6: [T_HANGED] };
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


// ---------------- Pig on Trial cast ----------------
const SKINS_ = ["#ffe2c2", "#f5c9a0", "#ecd0b6", "#c99067"];
const INK_ = "#241726";
/** Norman townsfolk, 1386: muted wool tunics, hoods (chaperons), bonnets and long dresses */
const PEASANT = (v: number): Outfit => {
  const coats = ["#7a5a3a", "#5d7a3a", "#8c3b4a", "#3f5f8a", "#a8724a", "#6b4f7a", "#2f5f6a"];
  const hoods = ["#6b3b3b", "#4f6a3a", "#3f4f7a", "#8a6a3a", "#7a4a6a"];
  const base: Outfit = { jacket: coats[v % 7], pants: "#5b4a3a", boots: "#4a3426", skin: SKINS_[v % 4] };
  if (v % 3 === 0) return { ...base, hat: "hood", cap: hoods[v % 5], moustache: v % 2 ? "#4a3020" : undefined };
  if (v % 3 === 1) return { ...base, hat: "hair", hair: ["#5a3b2a", "#2a201a", "#c9893a", "#4a3020"][v % 4] };
  return { ...base, hat: "bonnet", dress: ["#c25a7a", "#5a8fc2", "#b5653f", "#6a8f4a"][v % 4], jacket: ["#e9dcc0", "#d9c7a0"][v % 2] };
};
const JUDGE_O: Outfit = { jacket: "#a3313a", pants: "#3b2a2a", boots: "#2a2028", hat: "coif", cap: "#1f1b24", moustache: "#efe9df", build: "stout", dress: "#8e2a30", skin: "#f5c9a0" };
const GUARD_O: Outfit = { jacket: "#3f5f8a", pants: "#3d4440", boots: INK_, hat: "cap", cap: "#9aa3ad", belt: "#d9c7a0", sword: true, skin: "#ecd0b6", moustache: "#4a3426" };
const HANGMAN_O: Outfit = { jacket: "#3a2f3a", pants: "#2a2430", boots: "#1d1a20", hat: "hood", cap: "#7a1f24", build: "stout", skin: "#ecd0b6" };
const MOTHER_O: Outfit = { jacket: "#e9dcc0", pants: "#3b3f52", boots: "#4a3426", hat: "bonnet", dress: "#5a8fc2", skin: "#ffe2c2" };

/** mouth flap while someone speaks: cycles through open / closed shapes */
const TALK: Expr[] = ["grin", "neutral", "laugh", "whistle", "smile"];
const talk = (t: number, i: number, set: Expr[] = TALK) => set[Math.floor(t * 7 + i * 1.7) % set.length];

/** an animal card: side view facing its walking direction (dir), lit from the scene's sun, with a contact shadow */
const beast = (cam: CamInfo, out: Stage, kind: Beast, i: number, x: number, z: number, dir: [number, number] | null,
  o: { walk?: boolean; phase?: number; face?: BeastFace; blink?: number; headDip?: number }, scale = 1, y = D0) => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 0.6, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = dir ? dir[0] * cam.right.x + dir[1] * cam.right.z < 0 : i % 2 === 1;
  const light = light2D(cam, mirror);
  const opts = { ...o, phase: q(o.phase ?? 0, 16), light };
  out.places.push({ key: `B|${kind}|${fkey(opts)}`, x, y, z, scale, mirror, draw: (p) => drawBeast(p, kind, opts), size: [w, h, k] });
  blob(out, x, y, z, scale * (kind === "goat" ? 1.4 : 1.9));
};
const who = (i: number, o: Outfit, okey: string): Who => ({ i, o, okey });
const stand = (cam: CamInfo, out: Stage, w: Who, x: number, z: number, fo: FrontOpts, y = D0, shadow = true) => {
  out.places.push(person(cam, w, x, y, z, { side: false, mirror: false }, fo, {}));
  if (shadow) blob(out, x, y, z);
};
/** someone walking from a to b between t0 and t1 (side view when crossing the frame, front view toward the camera) */
const walker = (cam: CamInfo, out: Stage, w: Who, t: number, a: [number, number], b: [number, number], t0: number, t1: number, expr: Expr) => {
  const u = smooth((t - t0) / (t1 - t0)), x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
  const moving = t > t0 && t < t1 - 0.05, dx = b[0] - a[0], dz = b[1] - a[1], n = Math.hypot(dx, dz) || 1;
  const ph = ((((t - t0) * 1.9) % 1) + 1) % 1, blink = lidAt(t, w.i);
  if (!moving) { stand(cam, out, w, x, z, { mode: "stand", expr, blink }); return; }
  const view = viewOf(cam, x, z, dx / n, dz / n);
  out.places.push(person(cam, w, x, D0, z, view, { phase: ph, expr, mode: "stroll", blink }, { phase: ph, expr, mode: "march", blink, stomp: 0.4, stride: view.fs * 0.8 }));
  blob(out, x, D0, z);
};

/** the spectators on the four benches of the hall */
const BENCH: [number, number][] = [];
for (const s of [-1, 1]) for (const x of [6.3, 8.0]) for (const z of [12.6, 14.4, 16.2, 18.0, 19.8]) BENCH.push([s * x, z]);
const spectators = (cam: CamInfo, t: number, out: Stage, mode: "murmur" | "shock" | "talk" | "quiet") => {
  BENCH.forEach(([x, z], i) => {
    if (i % 5 === 3 && Math.abs(x) > 7) return; // a few gaps on the back benches
    const w = who(700 + i, PEASANT(i + 2), `p${(i + 2) % 21}`);
    let expr: Expr = "neutral";
    if (mode === "murmur") expr = i % 3 === 0 ? talk(t, i, ["whistle", "neutral", "smile"]) : i % 3 === 1 ? "stern" : "neutral";
    if (mode === "talk") expr = talk(t, i);
    if (mode === "shock") expr = i % 2 ? "shock" : "nervous";
    stand(cam, out, w, x, z + 0.05, { mode: "sit", expr, blink: lidAt(t, 700 + i), facing: x > 0 ? -1 : 1 }, D0, false);
  });
};
const judge = (cam: CamInfo, t: number, out: Stage, expr: Expr, prop: FrontOpts["prop"] = null) =>
  stand(cam, out, who(900, JUDGE_O, "judge"), JUDGE[0], JUDGE[2], { mode: "stand", expr, prop, blink: lidAt(t, 900) }, JUDGE[1], false);
const guard = (cam: CamInfo, t: number, out: Stage, x: number, z: number, expr: Expr = "stern") =>
  stand(cam, out, who(901, GUARD_O, "guard"), x, z, { mode: "stand", expr, blink: lidAt(t, 901) });
const sowInDock = (cam: CamInfo, t: number, out: Stage, face: BeastFace, swaps: number[] = []) =>
  beast(cam, out, "pig", 0, DOCK[0], DOCK[2], null, { face, blink: lidAt(t, 1, swaps) }, 1, DOCK[1]);
const burst = (out: Stage, t: number, t0: number, x: number, y: number, z: number, s = 3, col = "#fff3b0") => {
  if (t < t0 || t >= t0 + 0.4) return;
  const u = q((t - t0) / 0.4, 30);
  out.fx.push({ key: `burst${col}${u}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, u, col), x, y, z, w: s, h: s });
};

// ---------------- props drawn on cards ----------------
const parchment = (p: Pen) => {
  const g = p.g, W = 300, H = 400;
  const edge: [number, number][] = [];
  for (let i = 0; i <= 20; i++) edge.push([12 + (i / 20) * (W - 24), 14 + Math.sin(i * 1.7) * 4]);
  for (let i = 0; i <= 20; i++) edge.push([W - 14 + Math.sin(i * 2.1) * 4, 14 + (i / 20) * (H - 28)]);
  for (let i = 20; i >= 0; i--) edge.push([12 + (i / 20) * (W - 24), H - 14 + Math.sin(i * 1.3) * 4]);
  for (let i = 20; i >= 0; i--) edge.push([14 + Math.sin(i * 1.9) * 4, 14 + (i / 20) * (H - 28)]);
  p.ol = 6; p.poly(edge, "#f0dcae");
  g.fillStyle = "rgba(160,110,60,0.12)"; g.fillRect(20, 20, W - 40, 40);
  for (let i = 0; i < 9; i++) {
    const y = 70 + i * 30, len = i === 8 ? 120 : 200 + ((i * 37) % 50);
    const s: [number, number][] = [];
    for (let x = 40; x < 40 + len; x += 8) s.push([x, y + Math.sin(x * 0.35 + i) * 3]);
    p.stroke(s, 4, "#5a3b2a");
  }
  const sig: [number, number][] = []; for (let k = 0; k < 30; k++) sig.push([150 + k * 4, 352 + Math.sin(k * 0.9) * 10]);
  p.stroke(sig, 4, "#3a2a40");
  p.ell(78, 352, 24, 24, "#b8282e", 4);
};
const glove = (p: Pen) => {
  p.ol = 7;
  const col = "#8a5a3c";
  for (const [x, y, a] of [[78, 70, -0.28], [112, 52, -0.1], [146, 54, 0.08], [178, 72, 0.25]] as const)
    p.poly([[x - 14, y + 70], [x - 14 + Math.sin(a) * 60, y], [x + 14 + Math.sin(a) * 60, y], [x + 14, y + 70]].map(([px, py]) => [px, py] as [number, number]), col);
  p.ell(128, 160, 72, 66, col);
  p.poly([[70, 150], [26, 118], [40, 100], [86, 128]], col); // thumb
  p.poly([[70, 206], [186, 206], [190, 240], [66, 240]], "#6e4a34"); // cuff
  p.stroke([[96, 140], [100, 190]], 4, "#5e3a26"); p.stroke([[150, 138], [146, 190]], 4, "#5e3a26");
};
const coins = (p: Pen) => {
  p.ol = 5;
  for (const [x, y] of [[70, 120], [120, 100], [168, 130], [110, 150], [150, 70], [200, 92]] as const) {
    p.ell(x, y, 34, 28, "#f2c94c"); p.arc(x, y, 20, 15, 200, 340, 4, "#b8892a");
  }
};

// ---------------- shots ----------------
/** S1 hook: the sow in the dock, the judge behind; on "lost" a burst at his desk */
const hook = (cam: CamInfo, t: number, out: Stage) => {
  sowInDock(cam, t, out, t >= T_LOST - LEAD ? "sad" : "nervous", [T_LOST]);
  judge(cam, t, out, t >= T_LOST - LEAD ? "stern" : talk(t, 0, ["stern", "pained"]), "scroll");
  guard(cam, t, out, -1.8, 15.9);
  spectators(cam, t, out, t >= T_LOST ? "shock" : "murmur");
  burst(out, t, T_LOST, 0, 2.5, 22.3, 3.4);
};
/** S3 the square: the sow, townsfolk around; on "attacked" they jump back in shock, the mother is left grieving */
const STREET: [number, number][] = [[-8.4, -3.0], [-2.6, -7.2], [-9.4, -6.6], [-1.8, -3.4], [-6.8, -2.0], [-4.2, -8.8]];
const street = (cam: CamInfo, t: number, out: Stage) => {
  const sx = -6, sz = -6, after = t >= T_ATTACK - LEAD;
  beast(cam, out, "pig", 0, sx, sz, [1, 0], { face: after ? "neutral" : "content", blink: lidAt(t, 1) });
  STREET.forEach(([x, z], i) => {
    const back = smooth((t - T_ATTACK) / 0.35) * 0.45, dx = x - sx, dz = z - sz, n = Math.hypot(dx, dz) || 1;
    const hop = t > T_ATTACK && t < T_ATTACK + 0.3 ? Math.sin(((t - T_ATTACK) / 0.3) * Math.PI) * 0.12 : 0;
    const expr: Expr = !after ? (["smile", "neutral", "grin", "neutral", "smile_closed", "neutral"] as Expr[])[i] : t < T_ATTACK + 1.4 ? "shock" : "nervous";
    stand(cam, out, who(600 + i, PEASANT(i), `p${i}`), x + (dx / n) * back, z + (dz / n) * back, { mode: "stand", expr, blink: lidAt(t, 600 + i, SWAPS[3]) }, D0 + hop);
  });
  const mExpr: Expr = !after ? "smile" : t < T_HURT - LEAD ? "shock" : "pained";
  stand(cam, out, who(620, MOTHER_O, "mother"), -3.7, -4.5, { mode: "stand", expr: mExpr, blink: lidAt(t, 620, SWAPS[3]), facing: -1 });
  burst(out, t, T_ATTACK, sx + 0.2, 1.0, sz, 2.6);
};
/** S4 the hall: a guard walks the sow to the dock, the judge waits, the benches murmur */
const enter = (cam: CamInfo, t: number, out: Stage) => {
  const s = sowWalk(t);
  beast(cam, out, "pig", 0, s.x, s.z, [1, 0.6], { walk: s.walking, phase: s.phase, face: "nervous", blink: lidAt(t, 1) }, 1, DOCK[1]);
  const gx = s.x + 1.0, gz = s.z - 0.75, moving = t > T_WALK0 && t < T_WALK1 - 0.1, ph = (((t - T_WALK0) * 1.9) % 1 + 1) % 1;
  const gw = who(901, GUARD_O, "guard");
  if (moving) {
    const view = viewOf(cam, gx, gz, 0.86, 0.5);
    out.places.push(person(cam, gw, gx, D0, gz, view, { phase: ph, expr: "stern", mode: "march" }, { phase: ph, expr: "stern", mode: "march", stomp: 0.6, stride: view.fs }));
    blob(out, gx, D0, gz);
  } else guard(cam, t, out, gx, gz);
  judge(cam, t, out, "stern");
  spectators(cam, t, out, "murmur");
};
/** S5 the judge reads the sentence */
const reading = (cam: CamInfo, t: number, out: Stage) => {
  const expr: Expr = t < T_BRUTAL - LEAD ? talk(t, 0, ["neutral", "pained"]) : talk(t, 0, ["stern", "pained", "stern"]);
  judge(cam, t, out, expr, "scroll");
  spectators(cam, t, out, "quiet");
};
/** S6 the sow hears "hanged" */
const pigShock = (cam: CamInfo, t: number, out: Stage) => {
  sowInDock(cam, t, out, t >= T_HANGED - LEAD ? "shock" : "nervous", SWAPS[6]);
  guard(cam, t, out, -1.8, 15.9);
};
/** S7 the town gathers at the scaffold */
const gather = (cam: CamInfo, t: number, out: Stage) => {
  const t0 = SHOTS[6].a / FPS;
  for (let i = 0; i < 16; i++) {
    const row = i % 4, col = Math.floor(i / 4);
    const b: [number, number] = [GALLOWS[0] - 6.5 + row * 1.5 + (hh(i, 3) - 0.5) * 0.6, GALLOWS[2] - 7.5 + col * 1.6 + (hh(i, 5) - 0.5) * 0.6];
    const a: [number, number] = [b[0] - 7 - hh(i, 7) * 3, b[1] - 1.5 - hh(i, 8) * 2];
    const d0 = t0 + hh(i, 9) * 0.9;
    walker(cam, out, who(640 + i, PEASANT(i + 5), `p${(i + 5) % 21}`), t, a, b, d0, d0 + 2.2, (["neutral", "stern", "nervous", "whistle"] as Expr[])[i % 4]);
  }
};
/** S8 animal defendants wait their turn by the dock */
const queue = (cam: CamInfo, t: number, out: Stage) => {
  beast(cam, out, "pig", 0, -2.3, 15.2, [1, 0], { face: "nervous", blink: lidAt(t, 1) });
  beast(cam, out, "goat", 1, -3.9, 15.3, [1, 0], { face: "neutral", blink: lidAt(t, 2) });
  beast(cam, out, "cow", 2, -6.0, 15.2, [1, 0], { face: "content", blink: lidAt(t, 3) }, 1.35);
  judge(cam, t, out, talk(t, 0, ["stern", "pained"]), "scroll");
  guard(cam, t, out, -0.9, 14.4, "neutral");
  spectators(cam, t, out, "murmur");
};
/** S9 the three walk across the square on four legs; townsfolk watch from behind */
const walk = (cam: CamInfo, t: number, out: Stage) => {
  const x = walkX(t), ph = (t - WALK_T0) * 1.4;
  beast(cam, out, "pig", 0, x, WALK_Z, [1, 0], { walk: true, phase: ph % 1, face: "neutral", blink: lidAt(t, 1) });
  beast(cam, out, "goat", 1, x - 1.6, WALK_Z + 0.25, [1, 0], { walk: true, phase: (ph + 0.3) % 1, face: "neutral", blink: lidAt(t, 2) });
  beast(cam, out, "cow", 2, x - 3.5, WALK_Z - 0.1, [1, 0], { walk: true, phase: (ph + 0.6) % 1, face: "content", blink: lidAt(t, 3) }, 1.35);
  for (let i = 0; i < 9; i++) {
    const vx = -14 + i * 2.6 + (hh(i, 2) - 0.5), vz = 1.5 + (i % 3) * 1.1;
    stand(cam, out, who(660 + i, PEASANT(i + 9), `p${(i + 9) % 21}`), vx, vz, { mode: "stand", expr: (["laugh", "grin", "shock", "neutral"] as Expr[])[i % 4], blink: lidAt(t, 660 + i) });
  }
};
/** S10 golden: the townsfolk stand quietly; the mother in the middle */
const QUIET: [number, number][] = [[-2.6, -8.4], [0.6, -8.0], [-3.8, -10.2], [1.8, -10.4], [-2.0, -6.6], [0.2, -6.2], [-4.6, -7.4], [2.8, -7.6]];
const quiet = (cam: CamInfo, t: number, out: Stage) => {
  stand(cam, out, who(620, MOTHER_O, "mother"), -1.0, -9.2, { mode: "stand", expr: "pained", blink: lidAt(t, 620), look: -0.5 });
  QUIET.forEach(([x, z], i) => stand(cam, out, who(680 + i, PEASANT(i + 1), `p${(i + 1) % 21}`), x, z,
    { mode: "stand", expr: (["neutral", "nervous", "neutral", "stern"] as Expr[])[i % 4], blink: lidAt(t, 680 + i), look: (i % 3) - 1 }));
};
/** S11 golden: the crowd drifts home past the empty scaffold */
const scaffold = (cam: CamInfo, t: number, out: Stage) => {
  const t0 = SHOTS[10].a / FPS;
  for (let i = 0; i < 11; i++) {
    const a: [number, number] = [GALLOWS[0] - 3 + (i % 4) * 1.4 + hh(i, 1), GALLOWS[2] - 4 - Math.floor(i / 4) * 1.5];
    const b: [number, number] = [a[0] - 9, a[1] - 2.5];
    walker(cam, out, who(700 + i, PEASANT(i + 4), `p${(i + 4) % 21}`), t, a, b, t0 - 1 + hh(i, 4) * 1.5, t0 + 7, "neutral");
  }
};
/** S12 golden: the hangman with his coin; on the table his receipt, coins, and (on "glove") the new glove */
const hangman = (cam: CamInfo, t: number, out: Stage) => {
  const [tx, , tz] = TABLE;
  stand(cam, out, who(902, HANGMAN_O, "hangman"), tx + 0.15, tz + 0.95, { mode: "stand", expr: t < T_RECEIPT ? "grin" : "smile_closed", prop: "coin", blink: lidAt(t, 902) });
  out.fx.push({ key: "parchment", cw: 300, ch: 400, draw: parchment, x: tx - 0.22, y: D0 + 0.851, z: tz - 0.06, w: 0.42, h: 0.56, flat: true, rot: 0.12 });
  out.fx.push({ key: "coins", cw: 256, ch: 200, draw: coins, x: tx - 0.66, y: D0 + 0.852, z: tz + 0.12, w: 0.3, h: 0.24, flat: true, rot: -0.2 });
  if (t >= T_GLOVE - LEAD) {
    const pop = 1 + 0.25 * Math.sin(clamp01((t - T_GLOVE) / 0.25) * Math.PI);
    out.fx.push({ key: "glove", cw: 256, ch: 256, draw: glove, x: tx + 0.42, y: D0 + 0.853, z: tz + 0.02, w: 0.34 * pop, h: 0.34 * pop, flat: true, rot: -0.5 });
  }
  burst(out, t, T_GLOVE, tx + 0.42, D0 + 1.05, tz + 0.02, 0.9);
};
/** S13 everyone in the hall talks over each other; the sow in the dock says nothing */
const talking = (cam: CamInfo, t: number, out: Stage) => {
  sowInDock(cam, t, out, t >= T_LOST2 && t < T_LOST2 + 1.2 ? "sad" : "neutral");
  judge(cam, t, out, talk(t, 3, ["laugh", "stern", "grin", "pained"]));
  guard(cam, t, out, -1.8, 15.9, talk(t, 5));
  spectators(cam, t, out, "talk");
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  switch (s.crowd) {
    case "hook": hook(cam, t, out); break;
    case "street": street(cam, t, out); break;
    case "enter": enter(cam, t, out); break;
    case "judge": reading(cam, t, out); break;
    case "pigShock": pigShock(cam, t, out); break;
    case "gather": gather(cam, t, out); break;
    case "queue": queue(cam, t, out); break;
    case "walk": walk(cam, t, out); break;
    case "quiet": quiet(cam, t, out); break;
    case "scaffold": scaffold(cam, t, out); break;
    case "hangman": hangman(cam, t, out); break;
    case "talk": talking(cam, t, out); break;
    default: break;
  }
  return out;
};
export { FPS, smooth, clamp01 };
