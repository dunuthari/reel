// Four-legged cast for "The Pig on Trial": the sow, a goat and a cow, drawn flat in the same style as toon.ts
// (soft painted crescent away from the light, plum outline, deadpan dot eyes). Side view facing screen-right,
// design space 600 x 1000 with the soles at y = 975 (same card as the people), mirrored by the card when needed.
import { Pen, INK, mul } from "./toon";

type P2 = [number, number];
export type Beast = "pig" | "goat" | "cow";
export type BeastFace = "neutral" | "nervous" | "shock" | "sad" | "content";
export type BeastOpts = { phase?: number; walk?: boolean; face?: BeastFace; blink?: number; light?: number; headDip?: number };

const SH: [number, number, number] = [0.8, 0.74, 0.82];
const WHITE = "#ffffff";

const ellPts = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 56): P2[] => {
  const out: P2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = rx * Math.cos(a), y = ry * Math.sin(a);
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
};
/** filled, crescent-shaded, plum-outlined ellipse */
const blobE = (p: Pen, cx: number, cy: number, rx: number, ry: number, col: string, light: number, ow: number, rot = 0) => {
  const pts = ellPts(cx, cy, rx, ry, rot);
  p.shadedFill(pts, col, mul(col, SH), light, Math.max(rx, ry), 0.4);
  p.poly(pts, null, ow);
  return pts;
};

type Spec = {
  col: string; dark: string; hoof: string;
  body: [number, number, number, number]; head: [number, number, number, number]; // cx, cy, rx, ry
  legTop: number; legW: number; legs: [number, number][]; // x of back-far, back-near, front-far, front-near; top offset
};
const SPEC: Record<Beast, Spec> = {
  pig: { col: "#f4a7b4", dark: "#e3889a", hoof: "#7a4a52", body: [290, 805, 205, 118], head: [482, 752, 92, 86], legTop: 850, legW: 40,
    legs: [[160, 0], [200, 0], [380, 0], [420, 0]] },
  goat: { col: "#ece8df", dark: "#d4cdbf", hoof: "#5a4a40", body: [285, 725, 170, 92], head: [478, 598, 58, 70], legTop: 770, legW: 24,
    legs: [[175, 0], [205, 0], [355, 0], [385, 0]] },
  cow: { col: "#f6f1e6", dark: "#e7a6a4", hoof: "#4a3a34", body: [280, 700, 205, 128], head: [492, 628, 68, 80], legTop: 760, legW: 34,
    legs: [[150, 0], [190, 0], [360, 0], [400, 0]] },
};

/** one animal on its card. walk: legs swing on `phase` (0..1 per stride); face: eye + mouth acting */
export const drawBeast = (p: Pen, kind: Beast, o: BeastOpts) => {
  const { phase = 0, walk = false, face = "neutral", blink = 0, light = (-120 * Math.PI) / 180, headDip = 0 } = o;
  const S = SPEC[kind], ow = 10, two = Math.PI * 2, sole = 972;
  const bob = walk ? 6 * Math.cos(2 * two * phase) : 0;
  const [bx, by0, brx, bry] = S.body, by = by0 + bob;
  // ---- legs: far pair darker and behind, near pair in front of the body ----
  const leg = (x: number, ph: number, far: boolean) => {
    const sw = walk ? Math.sin(two * (phase + ph)) : 0, lift = walk ? Math.max(0, Math.cos(two * (phase + ph))) * 22 : 0;
    const top: P2 = [x, S.legTop + bob], foot: P2 = [x + sw * 34, sole - lift];
    const c = far ? mul(S.col, [0.78, 0.74, 0.8]) : S.col;
    p.line([top, foot], c, S.legW);
    p.line([[foot[0] - S.legW * 0.42, foot[1] - 4], [foot[0] + S.legW * 0.42, foot[1] - 4]], far ? mul(S.hoof, [0.8, 0.8, 0.8]) : S.hoof, 14);
  };
  leg(S.legs[0][0], 0.5, true); leg(S.legs[2][0], 0.0, true);
  // tail
  if (kind === "pig") {
    const t: P2[] = [];
    for (let i = 0; i <= 26; i++) { const a = i * 0.42, r = 26 - i * 0.6; t.push([bx - brx + 8 - 18 - r * Math.cos(a) * 0.9, by - 30 - r * Math.sin(a)]); }
    p.line(t, S.col, 9);
  } else if (kind === "goat") {
    p.poly([[bx - brx + 14, by - 50], [bx - brx - 26, by - 92], [bx - brx - 8, by - 40]], S.col, 8);
  } else {
    p.line([[bx - brx + 8, by - 60], [bx - brx - 18, by + 30], [bx - brx - 22, by + 90]], S.col, 9);
    p.ell(bx - brx - 22, by + 104, 14, 22, "#5a3b2a", 6);
  }
  // body
  const body = blobE(p, bx, by, brx, bry, S.col, light, ow);
  if (kind === "cow") p.clip(body, () => {
    for (const [x, y, rx, ry, r] of [[220, 650, 60, 44, 0.3], [330, 740, 52, 40, -0.4], [150, 750, 40, 50, 0.1], [390, 640, 30, 26, 0]] as const)
      p.poly(ellPts(x, y + bob, rx, ry, r), "#5a3b2a", 0);
  });
  if (kind === "pig") p.arc(bx - 40, by + 30, 120, 60, 30, 150, 5, mul(S.col, [0.85, 0.78, 0.84])); // belly line
  leg(S.legs[1][0], 0.0, false); leg(S.legs[3][0], 0.5, false);
  // ---- head ----
  const [hx, hy0, hrx, hry] = S.head, hy = hy0 + bob + headDip;
  if (kind === "goat" || kind === "cow") { // neck
    p.poly([[bx + brx * 0.55, by - bry * 0.7], [hx - hrx * 0.5, hy - hry * 0.2], [hx - hrx * 0.1, hy + hry * 0.7], [bx + brx * 0.8, by + bry * 0.1]], S.col, 0);
    p.stroke([[bx + brx * 0.55, by - bry * 0.72], [hx - hrx * 0.55, hy - hry * 0.25]], ow);
    p.stroke([[bx + brx * 0.82, by + bry * 0.05], [hx - hrx * 0.1, hy + hry * 0.72]], ow);
  }
  // far ear
  if (kind === "pig") p.poly([[hx - 44, hy - 58], [hx + 10, hy - 96], [hx + 2, hy - 48]], mul(S.col, [0.8, 0.74, 0.8]), 8);
  if (kind === "goat") { // horns curl back
    for (const dx of [-10, 6]) { const h: P2[] = []; for (let i = 0; i <= 14; i++) { const a = Math.PI * 0.95 + i * 0.13; h.push([hx + dx - 30 + 60 * Math.cos(a) * 0.9 + 42, hy - 70 + 52 * Math.sin(a) * 0.9 + 28]); } p.line(h, dx < 0 ? "#bfae90" : "#cdbd9f", 12); }
  }
  if (kind === "cow") for (const dx of [-26, 18]) p.line([[hx + dx, hy - hry + 12], [hx + dx - 14, hy - hry - 30]], "#efe2c4", 12);
  const head = blobE(p, hx, hy, hrx, hry, S.col, light, ow, kind === "goat" ? 0.35 : 0);
  // snout / muzzle
  if (kind === "pig") {
    blobE(p, hx + 78, hy + 18, 30, 38, S.dark, light, 8);
    p.ell(hx + 72, hy + 8, 5, 9, "#8a4052", 0); p.ell(hx + 88, hy + 10, 5, 9, "#8a4052", 0);
  } else if (kind === "goat") {
    p.clip(head, () => p.poly(ellPts(hx + 38, hy + 42, 34, 26, 0.35), "#d9cfc0", 0));
    p.poly([[hx + 4, hy + 62], [hx + 30, hy + 64], [hx + 12, hy + 118]], "#d4cab8", 7); // beard
  } else {
    blobE(p, hx + 18, hy + hry * 0.62, hrx * 0.82, hry * 0.36, "#f2b8b6", light, 8);
    p.dot(hx + 2, hy + hry * 0.6, 6, "#7a3a40"); p.dot(hx + 36, hy + hry * 0.6, 6, "#7a3a40");
  }
  // near ear
  if (kind === "pig") p.poly([[hx - 6, hy - 66], [hx + 66, hy - 84], [hx + 44, hy - 36]], S.col, 8); // floppy ear, tipped forward
  else if (kind === "goat") p.poly([[hx - 30, hy - 26], [hx - 78, hy - 6], [hx - 34, hy - 6]], S.col, 7);
  else p.poly([[hx - 50, hy - 40], [hx - 98, hy - 30], [hx - 54, hy - 18]], S.col, 7);
  // ---- face ----
  const ex = kind === "pig" ? hx + 22 : kind === "goat" ? hx + 18 : hx + 26, ey = kind === "pig" ? hy - 18 : kind === "goat" ? hy - 22 : hy - 26;
  const shut = blink >= 1, half = blink > 0 && blink < 1;
  if (face === "shock" && !shut) {
    p.ell(ex, ey, 19, 19, WHITE, 5); p.dot(ex + 4, ey + 2, 7);
    p.arc(ex, ey - 32, 16, 6, 200, 340, 6);
  } else if (shut || face === "content") {
    p.arc(ex, ey + 2, 11, 7, face === "content" ? 200 : 20, face === "content" ? 340 : 160, 6);
  } else {
    if (kind === "goat") { p.ell(ex, ey, 12, 10, "#f2d27a", 4); p.poly([[ex - 8, ey - 2], [ex + 8, ey - 2], [ex + 8, ey + 2], [ex - 8, ey + 2]], INK, 0); }
    else p.ell(ex, ey + (half ? 3 : 0), 8, half ? 4 : 11, INK, 0);
    if (half) p.stroke([[ex - 11, ey - 2], [ex + 11, ey - 2]], 5);
    // brow: worried / sad slant up toward the middle of the face, nervous adds a sweat drop
    if (face === "sad" || face === "nervous") p.stroke([[ex - 16, ey - 30], [ex + 14, ey - 38]], 6);
    if (face === "nervous") p.ell(hx - hrx * 0.7, hy - hry * 0.9, 7, 12, "#9fd4ff", 4);
  }
  // mouth
  const mx = kind === "pig" ? hx + 52 : kind === "goat" ? hx + 40 : hx + 22, my = kind === "pig" ? hy + 64 : kind === "goat" ? hy + 58 : hy + hry * 0.92;
  if (face === "shock") p.ell(mx, my + 4, 9, 12, "#5a1e28", 5);
  else if (face === "sad") p.arc(mx, my + 10, 12, 7, 200, 340, 5);
  else if (face === "content") p.arc(mx, my - 4, 12, 7, 20, 160, 5);
  else p.stroke([[mx - 10, my], [mx + 8, my - 2]], 5);
};
