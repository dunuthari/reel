// The Ice King's world, one three.js scene with five places far apart (story.ts): Boston's wharf (brick houses, a
// plank pier, the brig, stacks of ice and a sawdust heap), a frozen pond in a snow field, a Caribbean harbour
// (sand, palms, pastel houses, a pier, a stone icehouse and a bar under an awning), a stone jail cell, and open sea.
// Water is one big plane under everything (the bridge short's river shader); the land is raised quads with quay
// walls. The brig and the blocks of ice are posed every frame. Sky, light rig, clouds and the character cards work
// exactly like the Pisa / bridge / pig shorts (same shaders and light presets).
import * as THREE from "three";
import { Batch, boxGeo, V, lam, house, Kit, quad } from "./build";
import { rep, ctex, stoneHD, cobbleHD, grassHD, cloudHD, roofHD, planksHD, beamHD, waterNear, waterFar } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, D0, SHOTS, camAt, ShotDef, V3, shipAt, blocksAt, ICE_STACK, POND, TROPIC_PIER, ICEHOUSE, BAR, CELL, SEA_Z } from "./story";

export const loadKit = async (): Promise<Kit> => ({});

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
/** sun per shot, camera-relative (lights.ts): mostly a 3/4 key from the side; the jail gets a low sun through the
 *  window behind Tudor, the golden voyage a low backlight */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  1: { az: 70, el: 40 }, 2: { az: 100 }, 3: { az: 115, el: 30 }, 4: { az: 60, el: 40 }, 5: { az: 75, el: 40 }, 6: { az: 80, el: 60 },
  7: { az: 30, el: 25 }, 8: { az: 60, el: 62 }, 9: { az: 95, el: 55 }, 10: { az: 70, el: 50 }, 11: { az: 100, el: 40 }, 12: { az: 150, el: 40 },
  13: { az: 25, el: 7 }, 14: { az: 40, el: 9 }, 15: { az: 70, el: 40 },
};

/** horizontal quad facing up at height y covering x0..x1, z0..z1 */
const quadUp = (x0: number, x1: number, z0: number, z1: number, u: number, v: number, y = D0) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
};
const cyl = (r0: number, r1: number, h: number, n = 32, open = false) => new THREE.CylinderGeometry(r1, r0, h, n, 1, open).translate(0, h / 2, 0);
const at = (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z);
const box = (b: Batch, m: THREE.Material, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tile = 0) => b.add(boxGeo(V(x0, y0, z0), V(x1, y1, z1), tile), m);
/** a beam between two points (square section s) */
const beamBetween = (b: Batch, m: THREE.Material, a: THREE.Vector3, c: THREE.Vector3, s: number) => {
  const g = new THREE.BoxGeometry(s, s, a.distanceTo(c));
  g.lookAt(c.clone().sub(a)); g.translate((a.x + c.x) / 2, (a.y + c.y) / 2, (a.z + c.z) / 2);
  b.add(g, m);
};

// ---------------- painted grounds ----------------
const sandTex = () => ctex("sandHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#e9d3a0"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? "rgba(190,150,100,0.18)" : "rgba(255,245,215,0.3)"; const s = 4 + r() * 18; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, s, s * 0.5, r() * 3, 0, 7); g.fill(); }
});
const snowTex = () => ctex("snowHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#f3f6fb"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 260; i++) { g.fillStyle = "rgba(170,190,225,0.16)"; const s = 20 + r() * 70; g.beginPath(); g.ellipse(r() * 1024, r() * 1024, s, s * 0.35, 0, 0, 7); g.fill(); }
});
/** pond ice: pale blue with a grid of saw cuts (the ice-cutters' marked field) and white scratches */
const pondTex = () => ctex("pondHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#bfe0ef"; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 120; i++) { g.strokeStyle = "rgba(255,255,255,0.35)"; g.lineWidth = 2 + r() * 4; g.beginPath(); const x = r() * 1024, y = r() * 1024; g.moveTo(x, y); g.lineTo(x + 40 + r() * 120, y + (r() - 0.5) * 30); g.stroke(); }
  g.strokeStyle = "#6f9fbf"; g.lineWidth = 6;
  for (let x = 0; x <= 1024; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1024); g.stroke(); }
  for (let y = 0; y <= 1024; y += 86) { g.beginPath(); g.moveTo(0, y); g.lineTo(1024, y); g.stroke(); }
});
const brickWall = () => ctex("brickWallHD", 1024, 1024, (g, r) => {
  g.fillStyle = "#a9a39a"; g.fillRect(0, 0, 1024, 1024);
  for (let y = 0; y < 1024; y += 64) for (let x = (y / 64) % 2 ? -64 : 0; x < 1024; x += 128) {
    const c = ["#8a8d93", "#9b9a96", "#7f8288", "#a3a19a"][Math.floor(r() * 4)];
    g.fillStyle = c; g.fillRect(x + 4, y + 4, 120, 56);
  }
});
/** the jail's window: a bright square of sky with three bars */
const windowTex = () => ctex("jailWindow", 256, 256, (g) => {
  g.fillStyle = "#cfe7ff"; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#2a2430"; for (const x of [64, 128, 192]) g.fillRect(x - 9, 0, 18, 256);
  g.fillRect(0, 120, 256, 16);
});
/** the bar's awning: red and cream stripes with a scalloped hem */
const awningTex = () => ctex("awning", 512, 256, (g) => {
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? "#efe3c6" : "#c2453c"; g.fillRect(i * 64, 0, 64, 256); }
});
/** sawdust: warm tan with chips */
const sawdustTex = () => ctex("sawdust", 512, 512, (g, r) => {
  g.fillStyle = "#d9b47a"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1400; i++) { g.fillStyle = ["#c79a5c", "#e8c995", "#b8854a"][Math.floor(r() * 3)]; g.fillRect(r() * 512, r() * 512, 3 + r() * 6, 2 + r() * 3); }
});
const sailTex = () => ctex("sail", 256, 256, (g) => {
  g.fillStyle = "#f4ead2"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(150,120,80,0.35)"; g.lineWidth = 3;
  for (let x = 32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
});

const tree = (b: Batch, x: number, z: number, s: number, M: Record<string, THREE.Material>, seed: number) => {
  b.add(cyl(0.35 * s, 0.25 * s, 3.2 * s, 8), M.bark, at(x, D0, z));
  b.add(new THREE.IcosahedronGeometry(2.2 * s, 2), seed % 2 ? M.leafA : M.leafB, at(x, D0 + 4.6 * s, z));
  b.add(new THREE.IcosahedronGeometry(1.6 * s, 2), seed % 3 ? M.leafB : M.leafA, at(x + 0.9 * s, D0 + 5.8 * s, z - 0.4 * s));
};
/** a snowy fir: stacked cones, dark green with a white cap */
const fir = (b: Batch, x: number, z: number, s: number, M: Record<string, THREE.Material>) => {
  b.add(cyl(0.25 * s, 0.2 * s, 1.2 * s, 8), M.bark, at(x, D0, z));
  for (let i = 0; i < 3; i++) b.add(new THREE.ConeGeometry((2.0 - i * 0.5) * s, 2.4 * s, 12).translate(0, 1.2 * s, 0), M.fir, at(x, D0 + (1.0 + i * 1.3) * s, z));
  b.add(new THREE.ConeGeometry(0.62 * s, 0.9 * s, 12).translate(0, 0.45 * s, 0), M.snow, at(x, D0 + 4.3 * s, z));
};
/** a palm: a leaning, tapering trunk of rings and a crown of drooping fronds */
const palm = (b: Batch, x: number, z: number, s: number, lean: number, M: Record<string, THREE.Material>, seed: number) => {
  const n = 7, H = 6.5 * s; let px = x, py = D0, pz = z;
  const dx = Math.cos(seed * 1.7) * lean, dz = Math.sin(seed * 1.7) * lean;
  for (let i = 0; i < n; i++) {
    const u = (i + 1) / n, nx = x + dx * H * u * u, ny = D0 + H * u, nz = z + dz * H * u * u;
    const a = V(px, py, pz), c = V(nx, ny, nz), g = cyl(0.26 * s * (1 - 0.35 * u), 0.22 * s * (1 - 0.35 * u), a.distanceTo(c) + 0.05, 10);
    g.translate(0, -(a.distanceTo(c) + 0.05) / 2, 0).rotateX(Math.PI / 2).lookAt(c.clone().sub(a));
    g.translate((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2);
    b.add(g, M.palmBark);
    px = nx; py = ny; pz = nz;
  }
  for (let k = 0; k < 8; k++) {
    const yaw = (k / 8) * Math.PI * 2 + seed, L = 3.0 * s;
    const g = new THREE.SphereGeometry(1, 10, 6).scale(L / 2, 0.08 * s, 0.42 * s).translate(L / 2, 0, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationZ(-0.45 - (k % 2) * 0.2)).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
    b.add(g, k % 2 ? M.leafA : M.leafB, at(px, py, pz));
  }
  b.add(new THREE.SphereGeometry(0.32 * s, 10, 8), M.coconut, at(px, py - 0.25 * s, pz));
};

// ---------------- the brig ----------------
/** hull from a top-view outline (pointed bow toward -z) extruded upward, with a deck, rails, two masts, yards and
 *  billowing square sails. Built at the origin; the world poses the group per frame. */
const buildShip = (M: Record<string, THREE.Material>) => {
  const grp = new THREE.Group(), b = new Batch();
  const L = 16, W = 4.6, H = 2.8;
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2 + 0.3, L / 2);
  sh.lineTo(W / 2 - 0.3, L / 2);
  sh.quadraticCurveTo(W / 2 + 0.1, L / 4, W / 2, 0);
  sh.quadraticCurveTo(W / 2 - 0.2, -L / 3, 0, -L / 2 - 1.2);
  sh.quadraticCurveTo(-W / 2 + 0.2, -L / 3, -W / 2, 0);
  sh.quadraticCurveTo(-W / 2 - 0.1, L / 4, -W / 2 + 0.3, L / 2);
  const hull = new THREE.ExtrudeGeometry(sh, { depth: H, bevelEnabled: false, curveSegments: 16 });
  hull.rotateX(Math.PI / 2).translate(0, H - 1.2, 0); // shape y -> world z (bow at -z), extruded downward from the deck
  hull.applyMatrix4(new THREE.Matrix4().makeScale(1, 1, 1));
  b.add(hull, M.hull);
  // ochre stripe along the gunwale + deck planks
  const stripe = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false, curveSegments: 16 }).rotateX(Math.PI / 2).translate(0, H - 1.2 + 0.36, 0);
  stripe.scale(1.015, 1, 1.01);
  b.add(stripe, M.stripe);
  const deck = new THREE.ShapeGeometry(sh, 16).rotateX(Math.PI / 2).translate(0, H - 1.18 + 0.4, 0);
  deck.rotateY(0); b.add(deck, M.deck);
  // a raised quarterdeck cabin at the stern
  box(b, M.hull, -1.6, H - 0.8, L / 2 - 3.4, 1.6, H + 0.4, L / 2 - 0.4);
  box(b, M.stripe, -1.7, H + 0.35, L / 2 - 3.5, 1.7, H + 0.5, L / 2 - 0.3);
  // masts, yards, sails
  for (const [mz, mh] of [[-3.2, 13.5], [3.0, 12.0]] as const) {
    b.add(cyl(0.2, 0.14, mh, 12), M.mast, at(0, H - 0.8, mz));
    for (const [yy, yw] of [[mh * 0.42, 4.2], [mh * 0.72, 3.4], [mh * 0.94, 2.4]] as const) {
      const y0 = H - 0.8 + yy;
      b.add(new THREE.CylinderGeometry(0.09, 0.09, yw * 2, 8).rotateZ(Math.PI / 2), M.mast, at(0, y0, mz));
    }
    for (const [y1, y2, w1, w2] of [[mh * 0.42, mh * 0.12, 4.0, 4.4], [mh * 0.72, mh * 0.45, 3.2, 3.9], [mh * 0.94, mh * 0.75, 2.2, 3.1]] as const) {
      // a sail panel, bellied forward (toward -z) by bending its vertices
      const g = new THREE.PlaneGeometry(1, 1, 10, 6), p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) + 0.5, v = p.getY(i) + 0.5, w = w2 + (w1 - w2) * v;
        const yW = H - 0.8 + y2 + (y1 - y2) * v, xW = (u - 0.5) * 2 * w;
        const belly = -0.9 * Math.sin(u * Math.PI) * Math.sin(Math.max(0.15, v) * Math.PI * 0.9);
        p.setXYZ(i, xW, yW, mz - 0.25 + belly);
      }
      g.computeVertexNormals();
      b.add(g, M.sail);
    }
  }
  // bowsprit and a flag at the main mast
  beamBetween(b, M.mast, V(0, H - 0.6, -L / 2 - 0.6), V(0, H + 1.4, -L / 2 - 5.0), 0.16);
  b.add(new THREE.PlaneGeometry(1.4, 0.8).translate(0.75, 0, 0), M.flag, at(0.05, H - 0.8 + 13.2, -3.2));
  b.build(grp);
  grp.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return grp;
};

const WATER_DECL = `#include <common>
varying vec3 vWP;
uniform vec3 wNearC, wMidC, wFarC, wCrest, wTrough, wGlint;
uniform sampler2D wNearTex, wFarTex;
uniform float wTime;`;
const WATER_COL = `
  vec3 wV = vWP - cameraPosition;
  float wd = length(wV);
  float wDep = asin(clamp(-wV.y / wd, 0.0, 1.0));
  float wf = 1.0 - smoothstep(0.0, 0.42, wDep);
  vec3 wc = mix(mix(wNearC, wMidC, smoothstep(0.0, 0.55, wf)), wFarC, smoothstep(0.55, 1.0, wf));
  vec2 wp = vWP.xz + vec2(0.18 * wTime, 0.11 * wTime);
  vec4 mk = mix(texture2D(wNearTex, wp / 8.0), texture2D(wFarTex, wp / 40.0 + 0.37), smoothstep(25.0, 90.0, wd));
  wc = mix(wc, wTrough, mk.g * 0.6);
  wc = mix(wc, wCrest, mk.r * 0.7);
  wc = mix(wc, wGlint, mk.b * (0.3 + 0.5 * wf));
  diffuseColor.rgb = wc;`;

/** the one place each shot shows (everything else is hidden: fewer draws and shadow casters per frame) */
const ZONE_OF: Record<number, string> = { 1: "boston", 2: "boston", 3: "pond", 4: "sea", 5: "boston", 6: "tropic", 7: "jail", 8: "tropic", 9: "tropic", 10: "tropic", 11: "boston", 12: "tropic", 13: "sea", 14: "boston", 15: "boston" };

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
  private ship: THREE.Group;
  private blocks: THREE.Mesh[] = [];
  private blockGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  private iceMat: THREE.Material;
  private puddle: THREE.Mesh;
  private WU: Record<string, THREE.IUniform>;
  private zones: Record<string, THREE.Group> = {};

  constructor(_kit: Kit) {
    const R = this.root, M: Record<string, THREE.Material> = {};
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
      m.position.set(Math.cos(a) * d, 70 + (i % 4) * 40, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- materials ----
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.stone = lam("castleStone", () => ({ map: stoneHD("castleHD", ["#d6cbb6", "#cbbfa8", "#ddd2bd", "#c2b59c"], "#9c8f7a") }));
    M.cellStone = lam("cellStone", () => ({ map: stoneHD("cellHD", ["#b9b2a8", "#aea69b", "#c3bcb1", "#a39b90"], "#7d756c") }));
    M.planks = lam("planksHD", () => ({ map: planksHD() }));
    M.oak = lam("oakBeam", () => ({ map: beamHD(), color: "#a07050" }));
    M.oakDark = lam("oakDark", () => ({ color: "#6e4a34" }));
    M.bark = lam("bark", () => ({ color: "#8a5a3c" }));
    M.palmBark = lam("palmBark", () => ({ color: "#a47c52" }));
    M.coconut = lam("coconut", () => ({ color: "#6e4a2c" }));
    M.leafA = lam("leafA", () => ({ color: "#62ae4c" }));
    M.leafB = lam("leafB", () => ({ color: "#4f9a43" }));
    M.fir = lam("fir", () => ({ color: "#3f7a4f" }));
    M.snow = lam("snowCap", () => ({ color: "#f5f8fc" }));
    M.slate = lam("keepRoof", () => ({ color: "#6f7686" }));
    M.sand = lam("sandHD", () => ({ map: rep(sandTex(), 1, 1) }));
    M.snowField = lam("snowHD", () => ({ map: snowTex() }));
    M.pond = lam("pondHD", () => ({ map: pondTex() }));
    M.brick = lam("brickWall", () => ({ map: brickWall() }));
    M.window = lam("jailWindow", () => ({ map: windowTex(), emissive: new THREE.Color("#cfe7ff"), emissiveIntensity: 0.9 }));
    M.awning = lam("awning", () => ({ map: awningTex(), side: THREE.DoubleSide }));
    M.sawdust = lam("sawdust", () => ({ map: sawdustTex() }));
    M.iron = lam("iron", () => ({ color: "#3a3640" }));
    M.hull = lam("hull", () => ({ color: "#5a3a2a" }));
    M.stripe = lam("hullStripe", () => ({ color: "#d9a64a" }));
    M.deck = lam("deck", () => ({ map: rep(planksHD(), 1, 1), color: "#d8b88a", side: THREE.DoubleSide }));
    M.mast = lam("mast", () => ({ color: "#7a5236" }));
    M.sail = lam("sail", () => ({ map: sailTex(), side: THREE.DoubleSide }));
    M.flag = lam("flag", () => ({ color: "#2f5f9a", side: THREE.DoubleSide }));
    M.bottle = lam("bottle", () => ({ color: "#3f7a5a" }));
    M.bottle2 = lam("bottle2", () => ({ color: "#8a4a3a" }));
    this.iceMat = lam("ice", () => ({ color: "#cdeef8", emissive: new THREE.Color("#4a7a90"), emissiveIntensity: 0.25 }));
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];
    const hs = [lam("hillSnowA", () => ({ color: "#e8eef7" })), lam("hillSnowB", () => ({ color: "#dfe7f2" }))];

    // ---- water everywhere, 0.7 m under the land ----
    const wNear = waterNear(), wFar = waterFar();
    for (const t of [wNear, wFar]) { t.colorSpace = THREE.NoColorSpace; t.anisotropy = 16; t.needsUpdate = true; }
    this.WU = {
      wNearC: { value: new THREE.Color() }, wMidC: { value: new THREE.Color() }, wFarC: { value: new THREE.Color() },
      wCrest: { value: new THREE.Color() }, wTrough: { value: new THREE.Color() }, wGlint: { value: new THREE.Color() },
      wNearTex: { value: wNear }, wFarTex: { value: wFar }, wTime: { value: 0 },
    };
    const waterM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    waterM.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.WU);
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", WATER_DECL)
        .replace("#include <map_fragment>", WATER_COL)
        .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n  reflectedLight.directDiffuse = diffuseColor.rgb;\n  reflectedLight.indirectDiffuse = vec3(0.0);");
    };
    waterM.customProgramCacheKey = () => "sea1";
    const wm = new THREE.Mesh(quadUp(-1000, 1000, -1000, 1000, 1, 1, -0.7), waterM);
    wm.receiveShadow = true; wm.layers.set(NOINK);
    R.add(wm);

    let b = new Batch();
    const zone = (name: string) => { const g = new THREE.Group(); g.name = name; b.build(g); R.add(g); this.zones[name] = g; b = new Batch(); return g; };
    /** a land slab: top at y = 0, quay wall down into the water */
    const land = (x0: number, x1: number, z0: number, z1: number, m: THREE.Material, tile: number) => {
      b.add(quadUp(x0, x1, z0, z1, (x1 - x0) / tile, (z1 - z0) / tile, D0), m);
      box(b, M.stone, x0, -1.6, z0 - 0.02, x1, D0 - 0.01, z0 + 0.6, 2);
    };

    // ================= BOSTON (x -70..70, z 0..90) =================
    land(-70, 70, 0, 90, M.cobble, 16);
    // the pier: planks on posts, x -5..5, z -26..0
    box(b, M.planks, -5, -0.25, -26, 5, D0, 0.2, 2);
    for (let z = -25; z <= -1; z += 3) for (const x of [-4.7, 4.7]) b.add(cyl(0.22, 0.22, 1.8, 10), M.oakDark, at(x, -1.6, z));
    for (const z of [-24, -17, -10]) b.add(cyl(0.22, 0.26, 0.75, 12), M.oakDark, at(4.4, D0, z)); // bollards
    // crates and barrels on the pier
    for (const [x, z] of [[-3.6, -6.0], [-3.0, -7.1], [-3.8, -12.5]] as const) box(b, M.oak, x - 0.45, D0, z - 0.45, x + 0.45, D0 + 0.9, z + 0.45);
    for (const [x, z] of [[-2.2, -3.8], [-3.6, -18], [-3.0, -19]] as const) b.add(cyl(0.42, 0.42, 0.95, 18), M.oak, at(x, D0, z));
    // the sawdust heap beside the stacks (S11)
    b.add(new THREE.SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.5, 0.8, 1.2), M.sawdust, at(ICE_STACK[0] - 2.4, D0, ICE_STACK[2] - 1.2));
    box(b, M.sawdust, ICE_STACK[0] - 0.47, D0 + 1.66, ICE_STACK[2] - 1.32, ICE_STACK[0] + 1.42, D0 + 1.74, ICE_STACK[2] - 0.68);
    box(b, M.sawdust, ICE_STACK[0] - 0.47, D0 + 1.1, ICE_STACK[2] - 0.02, ICE_STACK[0] + 1.42, D0 + 1.18, ICE_STACK[2] + 0.62);
    // brick warehouses and houses along the waterfront, facing the harbour (-z)
    const STY = [7, 2, 0, 7, 5, 1, 7, 6, 2, 4];
    let hs2 = 0;
    const H = (x: number, z: number, yaw: number, w = 9, d = 8) => { const h = [8.4, 9.8, 7][hs2 % 3]; house(b, x, z, yaw, w, d, h, STY[hs2 % STY.length]); hs2++; };
    for (let x = -60; x <= 60; x += 9.6) H(x, 16, Math.PI);
    for (let x = -55; x <= 55; x += 11) H(x, 30, Math.PI);
    for (let x = -60; x <= 60; x += 12) H(x, 45, Math.PI);
    // a church spire behind the town
    box(b, M.stone, 18, D0, 56, 26, D0 + 16, 64, 3);
    b.add(new THREE.ConeGeometry(4.2, 16, 4).rotateY(Math.PI / 4).translate(0, 8, 0), M.slate, at(22, D0 + 16, 60));
    for (const [x, z] of [[-8, 3], [8, 3.4], [-20, 3.2], [24, 3]] as const) b.add(cyl(0.1, 0.1, 3.4, 8), M.iron, at(x, D0, z)); // lamp posts
    for (const [x, z] of [[-8, 3], [8, 3.4], [-20, 3.2], [24, 3]] as const) box(b, M.iron, x - 0.25, D0 + 3.3, z - 0.25, x + 0.25, D0 + 3.8, z + 0.25);
    // other ships' masts along the harbour
    for (const x of [-26, -40, 30, 44]) { b.add(cyl(0.18, 0.12, 14, 8), M.mast, at(x, -0.7, -10)); box(b, M.hull, x - 2, -0.9, -16, x + 2, 1.2, -4); }

    zone("boston");
    // ================= THE FROZEN POND (x 180..300, z 0..100) =================
    b.add(quadUp(180, 300, -20, 100, 4, 4, D0), M.snowField);
    b.add(new THREE.CircleGeometry(19, 48).rotateX(-Math.PI / 2), M.pond, at(POND[0], D0 + 0.012, POND[2]));
    // the open channel the blocks are floated along: a dark water slot
    box(b, lam("pondWater", () => ({ color: "#2f6f96" })), POND[0] - 0.6, D0 + 0.013, POND[2] - 2, POND[0] + 0.6, D0 + 0.016, POND[2] + 9);
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2, r = 26 + (i % 3) * 5; fir(b, POND[0] + Math.cos(a) * r, POND[2] + Math.sin(a) * r, 1.1 + (i % 4) * 0.15, M); }
    ([[150, 140, 90, 40, 70], [360, 150, 80, 34, 70], [240, 190, 110, 50, 60]] as const).forEach(([x, z, sx, sy, sz], i) =>
      b.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hs[i % 2], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx, sy, sz))));
    // an ice house barn at the pond's edge
    house(b, POND[0] + 14, POND[2] + 22, Math.PI, 10, 8, 6, 2);

    zone("pond");
    // ================= MARTINIQUE (x -300..-180, z 0..100) =================
    land(-300, -180, 0, 100, M.sand, 12);
    box(b, M.planks, -245, -0.25, -24, -235, D0, 0.2, 2);
    for (let z = -23; z <= -1; z += 3) for (const x of [-244.7, -235.3]) b.add(cyl(0.22, 0.22, 1.8, 10), M.oakDark, at(x, -1.6, z));
    for (const z of [-20, -13]) b.add(cyl(0.22, 0.26, 0.75, 12), M.oakDark, at(-235.6, D0, z));
    // pastel houses round the harbour
    const PST = [0, 4, 1, 6, 5, 0, 4, 3];
    let ps = 0;
    const P = (x: number, z: number, yaw: number) => { const h = [7, 8.4][ps % 2]; house(b, x, z, yaw, 9, 8, h, PST[ps % PST.length]); ps++; };
    for (let x = -296; x <= -186; x += 10.5) if (Math.abs(x - ICEHOUSE[0]) > 9 && Math.abs(x - BAR[0]) > 6) P(x, 24, Math.PI);
    for (let x = -292; x <= -190; x += 12) P(x, 40, Math.PI);
    // green hills behind
    ([[-330, 110, 120, 60, 80], [-200, 140, 130, 70, 70], [-260, 170, 160, 90, 60]] as const).forEach(([x, z, sx, sy, sz], i) =>
      b.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm[i % 3], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx, sy, sz))));
    // palms
    let pi = 0;
    for (const [x, z, s] of [[-247.5, 2.5, 1.0], [-232.5, 3.5, 1.1], [-256, 6, 0.95], [-221, 5, 1.05], [-246, 15, 1.0], [-262, 3, 1.1], [-214, 9, 1.0], [-236, 18, 0.9], [-270, 12, 1.1], [-243.5, 6.2, 0.9]] as const) {
      palm(b, x, z, s, 0.18 + (pi % 3) * 0.06, M, pi); pi++;
    }
    // THE ICEHOUSE: thick stone walls, a heavy door, slate roof (S10)
    {
      const [ix, , iz] = ICEHOUSE;
      box(b, M.stone, ix - 4, D0, iz - 3, ix + 4, D0 + 4.6, iz + 3, 2);
      b.add(quad(V(ix - 4.4, D0 + 4.5, iz - 3.4), V(ix + 4.4, D0 + 4.5, iz - 3.4), V(ix + 4.4, D0 + 6.6, iz), V(ix - 4.4, D0 + 6.6, iz), 3, 1), M.slate);
      b.add(quad(V(ix + 4.4, D0 + 4.5, iz + 3.4), V(ix - 4.4, D0 + 4.5, iz + 3.4), V(ix - 4.4, D0 + 6.6, iz), V(ix + 4.4, D0 + 6.6, iz), 3, 1), M.slate);
      box(b, M.stone, ix - 4, D0 + 4.6, iz - 0.05, ix + 4, D0 + 6.55, iz + 0.05); // gable fill (hidden by the roof ends)
      box(b, M.oakDark, ix - 2.2, D0, iz - 3.12, ix - 0.2, D0 + 2.6, iz - 3.0);        // door
      box(b, M.iron, ix - 2.0, D0 + 0.6, iz - 3.18, ix - 0.4, D0 + 0.72, iz - 3.1);
      box(b, M.iron, ix - 2.0, D0 + 1.9, iz - 3.18, ix - 0.4, D0 + 2.02, iz - 3.1);
      // a hand cart of blocks by the door
      box(b, M.oak, -234.0, D0 + 0.5, 6.9, -232.0, D0 + 0.85, 8.6);
      for (const z of [6.85, 8.65]) b.add(new THREE.CylinderGeometry(0.48, 0.48, 0.1, 18).rotateX(Math.PI / 2), M.oakDark, at(-233.0, D0 + 0.48, z));
    }
    // THE BAR: a counter under a striped awning, bottles on a shelf behind (S12)
    {
      const [bx, , bz] = BAR;
      box(b, M.oak, bx - 2.6, D0, bz - 0.4, bx + 2.6, D0 + 1.1, bz + 0.4);
      box(b, M.oakDark, bx - 2.7, D0 + 1.1, bz - 0.5, bx + 2.7, D0 + 1.18, bz + 0.5);
      for (const x of [-2.6, 2.6]) box(b, M.oakDark, bx + x - 0.1, D0, bz + 1.9, bx + x + 0.1, D0 + 3.1, bz + 2.1);
      for (const x of [-2.6, 2.6]) box(b, M.oakDark, bx + x - 0.08, D0, bz - 1.3, bx + x + 0.08, D0 + 2.7, bz - 1.14);
      b.add(quad(V(bx - 2.9, D0 + 2.6, bz - 1.5), V(bx + 2.9, D0 + 2.6, bz - 1.5), V(bx + 2.9, D0 + 3.2, bz + 2.2), V(bx - 2.9, D0 + 3.2, bz + 2.2), 1, 1), M.awning);
      box(b, M.oak, bx - 2.4, D0 + 1.6, bz + 2.0, bx + 2.4, D0 + 1.7, bz + 2.35);  // shelf
      box(b, M.oak, bx - 2.4, D0, bz + 2.15, bx + 2.4, D0 + 2.6, bz + 2.3);         // back board
      for (let i = 0; i < 9; i++) b.add(cyl(0.08, 0.07, 0.34, 10), i % 2 ? M.bottle : M.bottle2, at(bx - 2.1 + i * 0.52, D0 + 1.7, bz + 2.15));
      for (const x of [-1.6, 0, 1.6]) b.add(cyl(0.24, 0.24, 0.7, 14), M.oakDark, at(bx + x, D0, bz - 1.0)); // stools
      // a little table + barrel for S9
      b.add(cyl(0.42, 0.42, 0.9, 18), M.oak, at(-238.55, D0, 8.55));
    }

    zone("tropic");
    // ================= THE JAIL CELL (x 97..103, z 198..206) =================
    {
      const [cx, , cz] = CELL;
      const jb = new Batch();
      box(b, M.cellStone, cx - 9, D0 - 0.05, cz - 10, cx + 9, D0, cz + 8, 2);              // floor
      box(jb, M.cellStone, cx - 3.2, D0, cz + 6.0, cx + 3.2, D0 + 4.2, cz + 6.6, 2);        // back wall
      box(jb, M.cellStone, cx - 3.8, D0, cz - 2.0, cx - 3.2, D0 + 4.2, cz + 6.6, 2);        // side walls
      box(jb, M.cellStone, cx + 3.2, D0, cz - 2.0, cx + 3.8, D0 + 4.2, cz + 6.6, 2);
      box(jb, M.cellStone, cx - 3.8, D0 + 4.2, cz - 8, cx + 3.8, D0 + 4.6, cz + 6.6, 2);    // ceiling
      box(jb, M.brick, cx - 9, D0, cz - 8.5, cx + 9, D0 + 4.6, cz - 8.0, 2);                 // the corridor wall behind the camera
      box(jb, M.brick, cx - 9, D0, cz - 8, cx - 3.8, D0 + 4.6, cz - 2.0, 2);
      box(jb, M.brick, cx + 3.8, D0, cz - 8, cx + 9, D0 + 4.6, cz - 2.0, 2);
      b.add(quad(V(cx + 0.6, D0 + 2.4, cz + 5.98), V(cx - 0.6, D0 + 2.4, cz + 5.98), V(cx - 0.6, D0 + 3.5, cz + 5.98), V(cx + 0.6, D0 + 3.5, cz + 5.98)), M.window);
      // the bench (Tudor sits at x + 0.3, z + 2.6 on it)
      box(b, M.oak, cx - 1.6, D0 + 0.42, cz + 2.2, cx + 2.2, D0 + 0.52, cz + 3.0);
      for (const x of [-1.4, 2.0]) box(b, M.oakDark, cx + x - 0.08, D0, cz + 2.3, cx + x + 0.08, D0 + 0.42, cz + 2.9);
      // the front: iron bars, a crossbar, a barred door
      for (let x = -3.1; x <= 3.1; x += 0.42) b.add(cyl(0.035, 0.035, 4.2, 8), M.iron, at(cx + x, D0, cz - 1.8));
      for (const y of [0.15, 2.2, 4.0]) box(b, M.iron, cx - 3.2, D0 + y, cz - 1.86, cx + 3.2, D0 + y + 0.1, cz - 1.74);
      b.add(new THREE.TorusGeometry(0.22, 0.04, 8, 18), M.iron, at(cx + 1.3, D0 + 1.4, cz - 1.95));
      b.add(cyl(0.3, 0.3, 0.32, 14), M.oakDark, at(cx - 2.2, D0, cz + 4.6)); // bucket
      // a lantern on the corridor wall (emissive glow)
      b.add(new THREE.SphereGeometry(0.16, 12, 8), lam("lanternGlow", () => ({ color: "#ffd27a", emissive: new THREE.Color("#ffb347"), emissiveIntensity: 2.2 })), at(cx - 4.3, D0 + 2.6, cz - 2.2));
      const jail = zone("jail");
      jb.build(jail, false); // the cell's walls cast no shadow (cartoon daylight inside, like the pig's hall roof)
    }

    // ================= OPEN SEA: a few far islands on the horizon =================
    ([[300, -700, 120, 22, 60], [-400, -760, 160, 28, 70], [900, -500, 140, 20, 60]] as const).forEach(([x, z, sx, sy, sz], i) =>
      b.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm[i % 3], new THREE.Matrix4().compose(V(x, -0.8, z), new THREE.Quaternion(), V(sx, sy, sz))));
    let ts = 0;
    for (const [x, z] of [[-30, 8], [30, 8], [-50, 8], [52, 8]] as const) { tree(b, x, z, 0.9 + (ts % 3) * 0.12, M, ts); ts++; }
    zone("sea");

    // ---- dynamic: the brig, blocks of ice, the meltwater puddle ----
    this.ship = buildShip(M);
    R.add(this.ship);
    this.puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), lam("puddle", () => ({ color: "#5aa6cc", emissive: new THREE.Color("#1e4a66"), emissiveIntensity: 0.2 })));
    this.puddle.visible = false; R.add(this.puddle);
    void SEA_Z; void TROPIC_PIER;
  }

  /** pose the brig, the blocks and the puddle for shot id at time t */
  private pose(id: number, t: number) {
    const s = shipAt(id, t);
    this.ship.visible = s.visible;
    this.ship.position.set(s.x, s.y, s.z);
    this.ship.rotation.set(s.pitch, s.yaw, s.roll, "YXZ");
    const bl = blocksAt(id, t);
    while (this.blocks.length < bl.length) {
      const m = new THREE.Mesh(this.blockGeo, this.iceMat);
      m.castShadow = true; m.receiveShadow = true; this.blocks.push(m); this.root.add(m);
    }
    this.blocks.forEach((m, i) => {
      const k = bl[i];
      m.visible = !!k;
      if (!k) return;
      m.position.set(k.x, k.y, k.z); m.rotation.set(0, k.yaw, 0); m.scale.set(k.w, Math.max(0.01, k.h), k.d);
    });
    // the puddle grows as the Martinique block melts
    if (id === 6 && bl[0]) {
      const r = 0.5 + (0.69 - bl[0].h) * 1.3;
      this.puddle.visible = true; this.puddle.position.set(TROPIC_PIER[0], D0 + 0.015, TROPIC_PIER[2]); this.puddle.scale.set(r * 1.2, 1, r);
    } else this.puddle.visible = false;
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
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 14, 110);
    if (s.light === "golden") Rr = Math.max(Rr, 40);
    if (id === 4 || id === 13) Rr = Math.max(Rr, 40); // the brig under sail
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
    // ---- sea colours (on-screen targets, tone-map-inverted), the brig and the ice ----
    const W = this.WU, wc = K.water;
    untone(wc.near, W.wNearC.value); untone(wc.mid, W.wMidC.value); untone(wc.far, W.wFarC.value);
    untone(wc.crest, W.wCrest.value); untone(wc.trough, W.wTrough.value); untone(wc.glint, W.wGlint.value);
    W.wTime.value = t;
    this.pose(id, t);
    const want = ZONE_OF[id];
    for (const [k, g] of Object.entries(this.zones)) g.visible = k === want || (k === "sea" && (want === "boston" || want === "sea"));
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
