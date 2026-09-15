import { add, mul, rotate, centerIn } from "./device-core.mjs";
export const ease = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
export const enter = (f, a, b) => ease((f - a) / (b - a));
// Strong ease-out entrance curve: cubic-bezier(0.23, 1, 0.32, 1).
// Solve x(t), rather than treating the Bezier parameter as elapsed time.
export function iconEase(progress) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const t = (lo + hi) / 2, s = 1 - t;
    const x = 3 * s * s * t * 0.23 + 3 * s * t * t * 0.32 + t * t * t;
    if (x < progress) lo = t; else hi = t;
  }
  return 1 - (1 - (lo + hi) / 2) ** 3;
}
export const revealIcon = (frame, start, end) => iconEase((frame - start) / (end - start));

// Shape-preserving cubic Hermite interpolation for camera tracks only.
// Shared tangents keep velocity continuous at landmarks; monotone segments
// cannot overshoot framing bounds. End tangents are zero to join held poses.
export function cameraTrack(keys, frame) {
  if (frame <= keys[0][0]) return keys[0].slice(1);
  if (frame >= keys[keys.length - 1][0]) return keys[keys.length - 1].slice(1);
  const i = keys.findIndex((key) => key[0] >= frame);
  const a = keys[i - 1], b = keys[i], h = b[0] - a[0], t = (frame - a[0]) / h;
  const tangent = (k, axis) => {
    if (k === 0 || k === keys.length - 1) return 0;
    const prev = keys[k - 1], here = keys[k], next = keys[k + 1];
    const h0 = here[0] - prev[0], h1 = next[0] - here[0];
    const d0 = (here[axis] - prev[axis]) / h0, d1 = (next[axis] - here[axis]) / h1;
    if (d0 * d1 <= 0) return 0;
    const w0 = 2 * h1 + h0, w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / d0 + w1 / d1);
  };
  return a.slice(1).map((v, j) => {
    const axis = j + 1, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * v + (t3 - 2 * t2 + t) * h * tangent(i - 1, axis)
      + (-2 * t3 + 3 * t2) * b[axis] + (t3 - t2) * h * tangent(i, axis);
  });
}
export function measuredTrack(keys, frame) {
  if (frame <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++)
    if (frame <= keys[i][0]) {
      const a = keys[i - 1],
        b = keys[i],
        u = (frame - a[0]) / (b[0] - a[0]);
      return b.slice(1).map((v, j) => a[j + 1] + (v - a[j + 1]) * u);
    }
  return keys[keys.length - 1].slice(1);
}
export function controlWorld(surface, box, z, rotation) {
  return rotate(
    add(
      surface.origin,
      mul(centerIn(box, surface.width, surface.height, z), surface.unit),
    ),
    rotation,
  );
}
// One portrait mapping for both the native screen texture and every 3D control.
// Canvas origin is top-left; Three's UV origin is bottom-left (CanvasTexture flipY=true).
export function screenUv(surface, x, y) {
  return [
    (x - surface.bounds.min[0]) / surface.bounds.size[0],
    (y - surface.bounds.min[1]) / surface.bounds.size[1],
  ];
}
export function cameraFit(surface, state, config) {
  if (state.diagnostic)
    return [
      0,
      0,
      surface.bounds.size[1] /
        (2 * Math.tan(((config.camera.fov / 2) * Math.PI) / 180) * 0.82),
    ];
  // Frame the resting anchor, not the animated lift; otherwise the camera cancels the entrance.
  const box = state.focus.box,
    z = config.camera.anchorDepth;
  const center = controlWorld(surface, box, z, state.rotation);
  const r = box.height / 2;
  const corners = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    const x = box.x + (Math.cos(a) < 0 ? r : box.width - r) + Math.cos(a) * r,
      y = box.y + r + Math.sin(a) * r;
    return rotate(
      add(
        surface.origin,
        mul([x - surface.width / 2, surface.height / 2 - y, z], surface.unit),
      ),
      state.rotation,
    );
  });
  const k = Math.tan(((config.camera.fov / 2) * Math.PI) / 180),
    aspect = config.picture.aspect;
  let distance =
      (box.width * surface.unit) / (2 * k * aspect * state.target[2]),
    camera = [center[0], center[1], center[2] + distance];
  for (let iteration = 0; iteration < 15; iteration++) {
    const pixels = corners.map((p) => [
      0.5 + (p[0] - camera[0]) / (2 * (camera[2] - p[2]) * k * aspect),
      0.5 - (p[1] - camera[1]) / (2 * (camera[2] - p[2]) * k),
    ]);
    const min = [0, 1].map((i) => Math.min(...pixels.map((p) => p[i]))),
      max = [0, 1].map((i) => Math.max(...pixels.map((p) => p[i])));
    const measured = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      max[0] - min[0],
    ];
    camera[0] += (measured[0] - state.target[0]) * 2 * distance * k * aspect;
    camera[1] -= (measured[1] - state.target[1]) * 2 * distance * k;
    distance *= measured[2] / state.target[2];
    camera[2] = center[2] + distance;
  }
  return camera;
}
