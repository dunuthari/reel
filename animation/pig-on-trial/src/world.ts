// Falaise, Normandy, 1386: a cobbled market square ringed by half-timbered houses, a covered market hall (the
// courtroom: open sides, judge's desk on a dais, a wooden dock, spectator benches), a timber scaffold, a well, the
// hangman's table, and the castle keep on its hill above the roofs. Sky, light rig, clouds and the character cards
// work exactly like the Pisa / bridge shorts (same shaders and light presets).
import * as THREE from "three";
import { Batch, boxGeo, V, lam, house, Kit, quad, tri } from "./build";
import { rep, ctex, stoneHD, cobbleHD, grassHD, cloudHD, roofHD, planksHD, beamHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { FPS, D0, SHOTS, camAt, ShotDef, V3, DOCK, TABLE, GALLOWS } from "./story";

export const loadKit = async (): Promise<Kit> => ({});

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
/** sun per shot, camera-relative (lights.ts): hall shots get a lower sun from the side so it reaches under the roof;
 *  S11 is a straight backlight behind the scaffold */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {
  1: { az: 70, el: 30 }, 2: { az: 110 }, 3: { az: 115 }, 4: { az: 65, el: 30 }, 5: { az: 75, el: 30 }, 6: { az: 70, el: 30 },
  7: { az: 120 }, 8: { az: 80, el: 30 }, 9: { az: 120 }, 10: { az: 35 }, 11: { az: 2, el: 6 }, 12: { az: 40, el: 9 }, 13: { az: 70, el: 30 },
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

/** cream plaster between dark oak beams (Norman half-timbering) for the hall's back wall */
const timberWall = () => ctex("timberWall", 1024, 512, (g) => {
  g.fillStyle = "#efe2c4"; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "rgba(120,90,60,0.08)"; for (let i = 0; i < 300; i++) g.fillRect((i * 97) % 1024, (i * 53) % 512, 18, 6);
  g.strokeStyle = "#5a3b2a"; g.lineCap = "square";
  g.lineWidth = 26; g.strokeRect(13, 13, 998, 486);
  g.lineWidth = 22;
  for (let x = 0; x <= 1024; x += 128) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
  g.beginPath(); g.moveTo(0, 256); g.lineTo(1024, 256); g.stroke();
  g.lineWidth = 16;
  for (let x = 0; x < 1024; x += 256) { g.beginPath(); g.moveTo(x, 256); g.lineTo(x + 128, 0); g.moveTo(x + 256, 256); g.lineTo(x + 128, 0); g.stroke(); }
  g.strokeStyle = "rgba(40,30,40,0.6)"; g.lineWidth = 3;
  for (let x = 0; x <= 1024; x += 128) { g.beginPath(); g.moveTo(x + 11, 0); g.lineTo(x + 11, 512); g.stroke(); }
});
/** the Duke of Normandy's banner: red with two gold leopards (simplified to bold gold shapes), gold fringe */
const bannerTex = () => ctex("banner", 256, 384, (g) => {
  g.fillStyle = "#b8282e"; g.fillRect(0, 0, 256, 384);
  g.strokeStyle = "#e8b84a"; g.lineWidth = 14; g.strokeRect(10, 10, 236, 344);
  g.fillStyle = "#f0c24e";
  for (const y of [110, 250]) {
    g.beginPath(); g.ellipse(120, y, 62, 26, 0, 0, Math.PI * 2); g.fill();          // body
    g.beginPath(); g.arc(186, y - 18, 24, 0, Math.PI * 2); g.fill();               // head
    for (const x of [78, 104, 140, 166]) g.fillRect(x, y + 10, 10, 34);           // legs
    g.beginPath(); g.moveTo(60, y - 6); g.quadraticCurveTo(26, y - 52, 52, y - 64); g.lineWidth = 9; g.strokeStyle = "#f0c24e"; g.stroke(); // tail
  }
  g.fillStyle = "#e8b84a"; for (let x = 6; x < 256; x += 20) { g.beginPath(); g.moveTo(x, 354); g.lineTo(x + 10, 384); g.lineTo(x + 20, 354); g.fill(); }
});
const tree = (b: Batch, x: number, z: number, s: number, M: Record<string, THREE.Material>, seed: number) => {
  b.add(cyl(0.35 * s, 0.25 * s, 3.2 * s, 8), M.bark, at(x, D0, z));
  b.add(new THREE.IcosahedronGeometry(2.2 * s, 2), seed % 2 ? M.leafA : M.leafB, at(x, D0 + 4.6 * s, z));
  b.add(new THREE.IcosahedronGeometry(1.6 * s, 2), seed % 3 ? M.leafB : M.leafA, at(x + 0.9 * s, D0 + 5.8 * s, z - 0.4 * s));
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
      m.position.set(Math.cos(a) * d, 110 + (i % 4) * 40, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- materials ----
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.stone = lam("castleStone", () => ({ map: stoneHD("castleHD", ["#d6cbb6", "#cbbfa8", "#ddd2bd", "#c2b59c"], "#9c8f7a") }));
    M.planks = lam("planksHD", () => ({ map: planksHD() }));
    M.oak = lam("oakBeam", () => ({ map: beamHD(), color: "#a07050" }));
    M.oakDark = lam("oakDark", () => ({ color: "#6e4a34" }));
    M.timber = lam("timberWall", () => ({ map: timberWall() }));
    M.roof = lam("hallRoof", () => ({ map: rep(roofHD("#8f97a8", true), 4, 3), side: THREE.DoubleSide }));
    M.banner = lam("banner", () => ({ map: bannerTex(), side: THREE.DoubleSide }));
    M.bark = lam("bark", () => ({ color: "#8a5a3c" }));
    M.leafA = lam("leafA", () => ({ color: "#62ae4c" }));
    M.leafB = lam("leafB", () => ({ color: "#4f9a43" }));
    M.slate = lam("keepRoof", () => ({ color: "#6f7686" }));
    const hm = [lam("hillA", () => ({ color: "#78b257" })), lam("hillB", () => ({ color: "#6aa24e" })), lam("hillC", () => ({ color: "#8bbf63" }))];

    // ---- ground: grass everywhere, cobbles in the square and the lanes ----
    const b = new Batch();
    b.add(quadUp(-900, 900, -900, 900, 450, 450, D0 - 0.08), M.grass); // 8 cm under the cobbles: no depth fight in the 16-bit depth buffer
    b.add(quadUp(-32, 32, -36, 30, 16, 16.5, D0 + 0.012), M.cobble);
    b.add(quadUp(-4, 4, -140, -36, 2, 26, D0 + 0.011), M.cobble);
    b.add(quadUp(32, 140, -8, 0, 27, 2, D0 + 0.011), M.cobble);
    b.add(quadUp(-140, -32, -14, -6, 27, 2, D0 + 0.011), M.cobble);

    // ---- the market hall = courtroom (x -10..10, z 10..28), open sides, roof does not cast (cartoon daylight inside) ----
    const roof = new Batch();
    b.add(quadUp(-10, 10, 10, 28, 5, 4.5, D0 + 0.05), M.planks);
    for (const x of [-10, -3.4, 3.4, 10]) for (const z of [10, 16, 22, 28]) {
      if (Math.abs(x) < 4 && z !== 28 && z !== 10) continue;
      box(b, M.oak, x - 0.2, D0, z - 0.2, x + 0.2, D0 + 5.2, z + 0.2);
    }
    for (const x of [-10, 10]) box(b, M.oak, x - 0.25, D0 + 5.0, 9.6, x + 0.25, D0 + 5.45, 28.4);              // wall plates
    for (const z of [10, 16, 22, 28]) {                                                                      // tie beams + king posts
      box(b, M.oak, -10.4, D0 + 5.0, z - 0.2, 10.4, D0 + 5.4, z + 0.2);
      box(b, M.oak, -0.15, D0 + 5.4, z - 0.15, 0.15, D0 + 9.3, z + 0.15);
      beamBetween(b, M.oak, V(-6, D0 + 5.4, z), V(0, D0 + 8.0, z), 0.22);
      beamBetween(b, M.oak, V(6, D0 + 5.4, z), V(0, D0 + 8.0, z), 0.22);
    }
    roof.add(quad(V(-11, D0 + 5.0, 9.2), V(0, D0 + 9.6, 9.2), V(0, D0 + 9.6, 28.8), V(-11, D0 + 5.0, 28.8), 3, 4), M.roof);
    roof.add(quad(V(0, D0 + 9.6, 9.2), V(11, D0 + 5.0, 9.2), V(11, D0 + 5.0, 28.8), V(0, D0 + 9.6, 28.8), 3, 4), M.roof);
    roof.add(tri(V(-11, D0 + 5.0, 28.6), V(11, D0 + 5.0, 28.6), V(0, D0 + 9.6, 28.6)), M.timber);
    roof.build(R, false);
    // back wall: half-timbered, with the ducal banner behind the judge
    b.add(quad(V(10, D0, 28.25), V(-10, D0, 28.25), V(-10, D0 + 5.1, 28.25), V(10, D0 + 5.1, 28.25), 2, 1), M.timber);
    b.add(quad(V(0.9, D0 + 2.0, 28.15), V(-0.9, D0 + 2.0, 28.15), V(-0.9, D0 + 4.7, 28.15), V(0.9, D0 + 4.7, 28.15)), M.banner);
    // the dais and the judge's desk
    box(b, M.planks, -4.5, D0, 22, 4.5, D0 + 0.8, 28.2, 2);
    box(b, M.oakDark, -2.6, D0 + 0.8, 22.0, 2.6, D0 + 1.5, 22.75);
    box(b, M.oak, -2.8, D0 + 1.5, 21.85, 2.8, D0 + 1.6, 22.95);
    for (const x of [-2.2, -0.75, 0.75, 2.2]) box(b, M.oak, x - 0.06, D0 + 0.9, 21.94, x + 0.06, D0 + 1.42, 22.0); // panel ribs
    box(b, M.planks, -1.6, D0 + 0.8, 23.0, 1.6, D0 + 1.05, 24.4); // the judge's step
    box(b, M.planks, -1.2, D0, 21.2, 1.2, D0 + 0.4, 22.0); // step
    // the dock: three rails round the sow (open toward the cameras)
    const [dx, , dz] = DOCK;
    for (const [px, pz] of [[-0.95, -0.7], [0.95, -0.7], [-0.95, 0.75], [0.95, 0.75]]) box(b, M.oak, dx + px - 0.07, D0, dz + pz - 0.07, dx + px + 0.07, D0 + 1.15, dz + pz + 0.07);
    for (const y of [0.55, 1.05]) {
      box(b, M.oak, dx - 0.95, D0 + y, dz + 0.7, dx + 0.95, D0 + y + 0.1, dz + 0.8);
      for (const s of [-1, 1]) box(b, M.oak, dx + s * 0.95 - 0.05, D0 + y, dz - 0.7, dx + s * 0.95 + 0.05, D0 + y + 0.1, dz + 0.75);
    }
    // spectator benches along both sides
    for (const s of [-1, 1]) for (const x of [6.3, 8.0]) {
      box(b, M.oak, s * x - 0.22, D0 + 0.42, 11.5, s * x + 0.22, D0 + 0.5, 21.5);
      for (const z of [12, 16.5, 21]) box(b, M.oakDark, s * x - 0.15, D0, z - 0.05, s * x + 0.15, D0 + 0.42, z + 0.05);
    }

    // ---- the scaffold (an empty timber platform with two posts and a crossbeam) ----
    const [gx, , gz] = GALLOWS;
    box(b, M.planks, gx - 1.8, D0, gz - 1.8, gx + 1.8, D0 + 1.6, gz + 1.8, 1.2);
    for (let i = 0; i < 5; i++) box(b, M.oak, gx - 1.8 - 0.4 * (i + 1), D0, gz - 0.6, gx - 1.8 - 0.4 * i, D0 + 1.6 - 0.32 * (i + 1), gz + 0.6); // steps
    for (const s of [-1, 1]) box(b, M.oakDark, gx + s * 1.25 - 0.16, D0 + 1.6, gz - 0.16, gx + s * 1.25 + 0.16, D0 + 5.4, gz + 0.16);
    box(b, M.oakDark, gx - 1.6, D0 + 5.1, gz - 0.18, gx + 1.6, D0 + 5.45, gz + 0.18);
    for (const s of [-1, 1]) beamBetween(b, M.oakDark, V(gx + s * 1.25, D0 + 4.3, gz), V(gx + s * 0.55, D0 + 5.12, gz), 0.12);

    // ---- the well ----
    b.add(cyl(1.1, 1.1, 0.95, 28), M.stone, at(-14, D0, -2));
    for (const s of [-1, 1]) box(b, M.oak, -14 + s * 0.95 - 0.08, D0 + 0.9, -2.08, -14 + s * 0.95 + 0.08, D0 + 2.5, -1.92);
    box(b, M.oak, -15.1, D0 + 2.4, -2.1, -12.9, D0 + 2.55, -1.9);
    b.add(new THREE.ConeGeometry(1.6, 0.9, 4).rotateY(Math.PI / 4).translate(0, 0.45, 0), M.slate, at(-14, D0 + 2.5, -2));

    // ---- the hangman's table ----
    const [tx, , tz] = TABLE;
    box(b, M.oak, tx - 0.85, D0 + 0.76, tz - 0.48, tx + 0.85, D0 + 0.84, tz + 0.48);
    for (const [px, pz] of [[-0.75, -0.38], [0.75, -0.38], [-0.75, 0.38], [0.75, 0.38]]) box(b, M.oakDark, tx + px - 0.05, D0, tz + pz - 0.05, tx + px + 0.05, D0 + 0.76, tz + pz + 0.05);
    // barrels by the hall
    for (const [x, z] of [[11.6, 9.2], [12.4, 8.6], [-11.8, 9.0]] as const) b.add(cyl(0.42, 0.42, 0.95, 18), M.oak, at(x, D0, z));

    // ---- houses round the square: half-timbered fronts every other house ----
    const STY = [3, 0, 3, 1, 3, 4, 3, 6, 3, 2];
    let hs = 0;
    const H = (x: number, z: number, yaw: number, w = 9, d = 8) => { const h = [7, 8.4, 9.8][hs % 3]; house(b, x, z, yaw, w, d, h, STY[hs % STY.length]); hs++; };
    for (let x = -28; x <= 28; x += 9.5) if (Math.abs(x) > 5) H(x, -41, 0);                 // south side, facing north
    for (let z = -32; z <= 26; z += 9.5) if (Math.abs(z + 10) > 4.5) { H(-37, z, Math.PI / 2); H(37, z, -Math.PI / 2); } // west / east
    for (let x = -28; x <= 28; x += 9.5) if (Math.abs(x) > 12) H(x, 34, Math.PI);           // north, beside the hall
    for (let x = -10; x <= 10; x += 9.5) H(x, 37, Math.PI);                                   // north, behind the hall
    // the rest of the town for the aerial: rows of houses out to the walls
    for (let r = 0; r < 4; r++) for (let x = -90; x <= 90; x += 11) {
      if (Math.abs(x) < 42) { H(x, 52 + r * 15, Math.PI); H(x, -56 - r * 15, 0); }
      else { H(x, -40 + r * 22, x < 0 ? Math.PI / 2 : -Math.PI / 2); }
    }
    // church on the east side of town
    box(b, M.stone, 52, D0, 8, 70, D0 + 12, 22, 3);
    b.add(quad(V(52, D0 + 12, 8), V(70, D0 + 12, 8), V(70, D0 + 18, 15), V(52, D0 + 18, 15), 6, 2), M.slate);
    b.add(quad(V(70, D0 + 12, 22), V(52, D0 + 12, 22), V(52, D0 + 18, 15), V(70, D0 + 18, 15), 6, 2), M.slate);
    box(b, M.stone, 46, D0, 11, 52, D0 + 24, 19, 3);
    b.add(new THREE.ConeGeometry(4.8, 14, 4).rotateY(Math.PI / 4).translate(0, 7, 0), M.slate, at(49, D0 + 24, 15));

    // ---- the castle on its hill (north-west), a square keep and a round tower ----
    b.add(new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI / 2), hm[0], new THREE.Matrix4().compose(V(-40, D0 - 4, 170), new THREE.Quaternion(), V(95, 34, 70)));
    const ky = D0 + 26;
    box(b, M.stone, -52, ky, 156, -30, ky + 30, 176, 3);
    for (let x = -52; x < -30; x += 2.2) for (const z of [156, 175]) box(b, M.stone, x, ky + 30, z, x + 1.2, ky + 31.6, z + 1);
    for (let z = 157; z < 175; z += 2.2) for (const x of [-52, -31]) box(b, M.stone, x, ky + 30, z, x + 1, ky + 31.6, z + 1.2);
    b.add(cyl(6.5, 6.5, 38, 36), M.stone, at(-20, ky - 4, 166));
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; box(b, M.stone, -20 + Math.cos(a) * 6 - 0.6, ky + 34, 166 + Math.sin(a) * 6 - 0.6, -20 + Math.cos(a) * 6 + 0.6, ky + 35.6, 166 + Math.sin(a) * 6 + 0.6); }
    box(b, M.stone, -80, ky - 6, 140, 10, ky + 8, 143, 3); // curtain wall
    for (let x = -80; x < 10; x += 3) box(b, M.stone, x, ky + 8, 140, x + 1.6, ky + 9.4, 143);
    for (const x of [-80, -55, 10]) b.add(cyl(4, 4, 18, 24), M.stone, at(x, ky - 6, 141.5));
    // hills and trees out of town
    ([[-360, 300, 200, 60, 130], [160, 420, 260, 70, 150], [460, 180, 180, 50, 140], [-480, -60, 200, 46, 150], [520, -120, 170, 44, 130], [60, -420, 240, 50, 120]] as const)
      .forEach(([x, z, sx, sy, sz], i) => b.add(new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hm[(i + 1) % 3], new THREE.Matrix4().compose(V(x, D0 - 2, z), new THREE.Quaternion(), V(sx, sy, sz))));
    let ts = 0;
    for (const [x, z] of [[-24, 22], [24, 22], [-26, -30], [26, -30], [-30, 6], [30, -4]] as const) { tree(b, x, z, 0.95 + (ts % 3) * 0.12, M, ts); ts++; }
    for (let x = -140; x <= 140; x += 12) { tree(b, x + (ts % 4), 125 + (ts % 3) * 4, 1.2, M, ts); ts++; }
    b.build(R);
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
    if (id === 2) Rr = 160; // aerial: the whole town in the shadow map
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
