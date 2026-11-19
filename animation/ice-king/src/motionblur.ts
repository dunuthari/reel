// Camera motion blur by depth reprojection (one gather pass, no extra scene renders).
// For every pixel: rebuild its view-space position from the depth buffer, project it with the camera as it was a
// quarter frame earlier and a quarter frame later (the camera is a pure function of story time, camAt), and average
// SAMPLES taps of the image along that screen-space path. That is a 180-degree shutter: exactly the smear a film
// camera records while the frame's shutter is open. Rotations, dollies and zooms all blur correctly, the sky
// included (its depth sits on the far plane). Cut frames get no blur because both cameras come from the same shot.
// The path length is clamped (MAX_PX at 1080x1920, scaled with the output height) so impact kicks stay readable.
import { Effect, EffectAttribute, BlendFunction } from "postprocessing";
import { Matrix4, PerspectiveCamera, Uniform } from "three";

const frag = /* glsl */ `
uniform mat4 uInvProj;      // current clip -> current view
uniform mat4 uToPrev;       // current view -> clip of the camera 1/4 frame earlier
uniform mat4 uToNext;       // current view -> clip of the camera 1/4 frame later
uniform float uStrength;    // 0 = off, 1 = 180-degree shutter
uniform float uMaxPx;       // longest smear in px at 1080x1920

vec2 projectUV(mat4 m, vec4 v) { vec4 c = m * v; return c.xy / max(c.w, 1e-4) * 0.5 + 0.5; }

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  if (uStrength < 0.01) { outputColor = inputColor; return; }
  vec4 ndc = vec4(uv * 2.0 - 1.0, min(depth, 0.99999) * 2.0 - 1.0, 1.0);
  vec4 v = uInvProj * ndc; v /= v.w;
  vec2 a = projectUV(uToPrev, v), b = projectUV(uToNext, v);
  vec2 path = (b - a) * uStrength;                       // screen motion while the shutter is open (uv units)
  float s = resolution.y / 1920.0;
  float lenPx = length(path * resolution);
  float maxPx = uMaxPx * s;
  if (lenPx > maxPx) path *= maxPx / lenPx;
  if (lenPx < 0.6) { outputColor = inputColor; return; }
  vec3 acc = vec3(0.0);
  for (int i = 0; i < SAMPLES; i++) {
    float k = (float(i) + 0.5) / float(SAMPLES) - 0.5;    // centred on this frame's instant
    acc += texture2D(inputBuffer, uv + path * k).rgb;
  }
  outputColor = vec4(acc / float(SAMPLES), inputColor.a);
}`;

export class MotionBlurEffect extends Effect {
  private prev = new PerspectiveCamera();
  private next = new PerspectiveCamera();
  private m = new Matrix4();
  constructor({ samples = 16, maxPx = 70, strength = 1 } = {}) {
    super("MotionBlurEffect", frag, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
      defines: new Map([["SAMPLES", String(samples)]]),
      uniforms: new Map<string, Uniform>([
        ["uInvProj", new Uniform(new Matrix4())], ["uToPrev", new Uniform(new Matrix4())], ["uToNext", new Uniform(new Matrix4())],
        ["uStrength", new Uniform(strength)], ["uMaxPx", new Uniform(maxPx)],
      ]),
    });
  }
  set strength(v: number) { this.uniforms.get("uStrength")!.value = v; }
  /** pose a helper camera like world.update() poses the real one */
  private pose(c: PerspectiveCamera, cur: PerspectiveCamera, s: { pos: number[]; look: number[]; fov: number; roll: number }) {
    c.aspect = cur.aspect; c.near = cur.near; c.far = cur.far; c.fov = s.fov;
    c.position.set(s.pos[0], s.pos[1], s.pos[2]); c.up.set(0, 1, 0); c.lookAt(s.look[0], s.look[1], s.look[2]); c.rotateZ(s.roll);
    c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  }
  /** call once per frame after the real camera is posed; prev/next are the camera a quarter frame before / after */
  track(cur: PerspectiveCamera, prev: { pos: number[]; look: number[]; fov: number; roll: number }, next: { pos: number[]; look: number[]; fov: number; roll: number }) {
    this.pose(this.prev, cur, prev); this.pose(this.next, cur, next);
    (this.uniforms.get("uInvProj")!.value as Matrix4).copy(cur.projectionMatrixInverse);
    (this.uniforms.get("uToPrev")!.value as Matrix4).multiplyMatrices(this.prev.projectionMatrix, this.m.copy(this.prev.matrixWorld).invert()).multiply(cur.matrixWorld);
    (this.uniforms.get("uToNext")!.value as Matrix4).multiplyMatrices(this.next.projectionMatrix, this.m.copy(this.next.matrixWorld).invert()).multiply(cur.matrixWorld);
  }
}
