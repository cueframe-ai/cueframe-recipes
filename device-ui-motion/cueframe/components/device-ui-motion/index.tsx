// src/Showcase.jsx
import React4, { useMemo as useMemo4 } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";

// src/render/DeviceScene.jsx
import React3, { useMemo as useMemo3, useLayoutEffect as useLayoutEffect3 } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import * as THREE4 from "three";
import { FrameDepthOfField } from "@cueframe/animate";

// src/core/device-core.mjs
var add = (a, b) => a.map((v, i) => v + b[i]);
var sub = (a, b) => a.map((v, i) => v - b[i]);
var mul = (a, n) => a.map((v) => v * n);
var dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
var cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
var length = (a) => Math.sqrt(dot(a, a));
function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}
function finiteVector(v, size, label) {
  requireValue(
    Array.isArray(v) && v.length === size && v.every(Number.isFinite),
    label + " must contain " + size + " finite numbers"
  );
  return v;
}
function meshBounds(mesh) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach((v, i) => {
    min[i % 3] = Math.min(min[i % 3], v);
    max[i % 3] = Math.max(max[i % 3], v);
  });
  return { min, max, size: sub(max, min), center: mul(add(min, max), 0.5) };
}
function parseModel(raw) {
  let text = raw.trim();
  if (text.startsWith("<")) {
    const match = text.match(
      /<metadata\s+id="mesh-data">([\s\S]*?)<\/metadata>/
    );
    requireValue(
      match,
      "Only JSON or the legacy SVG mesh-data envelope is supported; convert GLB/USD with a format-aware importer"
    );
    text = match[1];
  }
  let model;
  try {
    model = JSON.parse(text);
  } catch {
    throw new Error(
      "Invalid mesh JSON; GLB/USD/OBJ are not supported directly"
    );
  }
  validateModel(model);
  return model;
}
function validateModel(model) {
  requireValue(
    model && Array.isArray(model.meshes) && model.meshes.length > 0,
    "model.meshes must be nonempty"
  );
  requireValue(
    typeof model.units === "string" && model.units.length > 0,
    "Declare model.units"
  );
  const names = /* @__PURE__ */ new Set();
  for (const mesh of model.meshes) {
    requireValue(
      typeof mesh.name === "string" && mesh.name && !names.has(mesh.name),
      "Mesh names must be nonempty and unique"
    );
    names.add(mesh.name);
    requireValue(
      Array.isArray(mesh.positions) && mesh.positions.length >= 9 && mesh.positions.length % 3 === 0 && mesh.positions.every(Number.isFinite),
      mesh.name + ": invalid positions"
    );
    requireValue(
      Array.isArray(mesh.indices) && mesh.indices.length >= 3 && mesh.indices.length % 3 === 0 && mesh.indices.every(
        (i) => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3
      ),
      mesh.name + ": invalid triangle indices"
    );
    for (const [key, stride] of [
      ["uv", 2],
      ["normals", 3]
    ]) {
      if (mesh[key] !== void 0)
        requireValue(
          Array.isArray(mesh[key]) && mesh[key].length === mesh.positions.length / 3 * stride && mesh[key].every(Number.isFinite),
          mesh.name + ": invalid " + key
        );
    }
    requireValue(
      mesh.matrix === void 0 && mesh.transform === void 0 && mesh.children === void 0,
      "Unbaked transforms/hierarchy: flatten with a format-aware importer first"
    );
  }
}
function normalizeModel(model, adapter) {
  validateModel(model);
  requireValue(
    adapter && (model.coordinateSpace === "baked" || adapter.confirmBaked === true),
    "Confirm all mesh positions share a baked model coordinate space"
  );
  const right = finiteVector(adapter.right, 3, "adapter.right");
  const up = finiteVector(adapter.up, 3, "adapter.up");
  const normal = finiteVector(adapter.normal, 3, "adapter.normal");
  requireValue(
    [right, up, normal].every((v) => Math.abs(length(v) - 1) < 1e-6) && Math.abs(dot(right, up)) < 1e-6 && length(sub(cross(right, up), normal)) < 1e-6,
    "Adapter basis must be orthonormal and right-handed"
  );
  requireValue(
    model.meshes.some((m) => m.name === adapter.displayMesh),
    "Named display mesh not found"
  );
  const project = (p) => [dot(p, right), dot(p, up), dot(p, normal)];
  const meshes = model.meshes.map((mesh) => {
    const positions = [], normals = mesh.normals ? [] : void 0;
    for (let i = 0; i < mesh.positions.length; i += 3)
      positions.push(...project(mesh.positions.slice(i, i + 3)));
    if (normals)
      for (let i = 0; i < mesh.normals.length; i += 3)
        normals.push(
          ...mul(
            project(mesh.normals.slice(i, i + 3)),
            adapter.flipWinding ? -1 : 1
          )
        );
    const indices = [...mesh.indices];
    if (adapter.flipWinding)
      for (let i = 0; i < indices.length; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    return { ...mesh, positions, indices, ...normals ? { normals } : {} };
  });
  return { ...model, coordinateSpace: "baked", meshes };
}
function displaySurface(model, displayMesh, pixelWidth = 1200, clearancePixels = 2) {
  requireValue(
    Number.isFinite(pixelWidth) && pixelWidth > 0,
    "pixelWidth must be positive"
  );
  requireValue(
    Number.isFinite(clearancePixels) && clearancePixels > 0,
    "clearancePixels must be positive"
  );
  const mesh = model.meshes.find((m) => m.name === displayMesh);
  requireValue(mesh, "Display mesh missing");
  const bounds = meshBounds(mesh), [w, h, d] = bounds.size;
  requireValue(
    w > 0 && h > 0 && d <= Math.max(w, h) * 1e-6,
    "Display must be planar in the adapter basis; curved screens need a custom surface adapter"
  );
  let area = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = mesh.indices.slice(i, i + 3).map((n) => mesh.positions.slice(n * 3, n * 3 + 3));
    area += cross(sub(p[1], p[0]), sub(p[2], p[0]))[2] / 2;
  }
  requireValue(
    area > w * h * 1e-8,
    "Display triangle winding faces away from +normal or has zero area; inspect conversion before using flipWinding"
  );
  const unit = w / pixelWidth;
  return {
    mesh,
    bounds,
    unit,
    width: pixelWidth,
    height: h / unit,
    glassZ: bounds.max[2],
    z: bounds.max[2] + clearancePixels * unit,
    origin: [
      bounds.center[0],
      bounds.center[1],
      bounds.max[2] + clearancePixels * unit
    ]
  };
}
function onDisplay(surface, x, y) {
  const p = [
    surface.origin[0] + (x - surface.width / 2) * surface.unit,
    surface.origin[1] + (surface.height / 2 - y) * surface.unit
  ];
  const mesh = surface.mesh;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const v = mesh.indices.slice(i, i + 3).map((k) => mesh.positions.slice(k * 3, k * 3 + 2));
    const area = (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) - (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]);
    if (Math.abs(area) < 1e-12) continue;
    const signs = v.map((a, j) => {
      const b = v[(j + 1) % 3];
      return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    });
    if (signs.every((s) => s >= -1e-9) || signs.every((s) => s <= 1e-9))
      return true;
  }
  return false;
}
function centerIn(box, width, height, z = 0) {
  return [
    box.x + box.width / 2 - width / 2,
    height / 2 - box.y - box.height / 2,
    z
  ];
}
function rotate(v, [x, y, z]) {
  let [a, b, c] = v;
  [a, b] = [
    a * Math.cos(z) - b * Math.sin(z),
    a * Math.sin(z) + b * Math.cos(z)
  ];
  [a, c] = [
    a * Math.cos(y) + c * Math.sin(y),
    -a * Math.sin(y) + c * Math.cos(y)
  ];
  [b, c] = [
    b * Math.cos(x) - c * Math.sin(x),
    b * Math.sin(x) + c * Math.cos(x)
  ];
  return [a, b, c];
}

// src/core/motion.mjs
var ease = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
var enter = (f, a, b) => ease((f - a) / (b - a));
function iconEase(progress) {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const t = (lo + hi) / 2, s = 1 - t;
    const x = 3 * s * s * t * 0.23 + 3 * s * t * t * 0.32 + t * t * t;
    if (x < progress) lo = t;
    else hi = t;
  }
  return 1 - (1 - (lo + hi) / 2) ** 3;
}
var revealIcon = (frame, start, end) => iconEase((frame - start) / (end - start));
function cameraTrack(keys, frame) {
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
    return (2 * t3 - 3 * t2 + 1) * v + (t3 - 2 * t2 + t) * h * tangent(i - 1, axis) + (-2 * t3 + 3 * t2) * b[axis] + (t3 - t2) * h * tangent(i, axis);
  });
}
function measuredTrack(keys, frame) {
  if (frame <= keys[0][0]) return keys[0].slice(1);
  for (let i = 1; i < keys.length; i++)
    if (frame <= keys[i][0]) {
      const a = keys[i - 1], b = keys[i], u = (frame - a[0]) / (b[0] - a[0]);
      return b.slice(1).map((v, j) => a[j + 1] + (v - a[j + 1]) * u);
    }
  return keys[keys.length - 1].slice(1);
}
function controlWorld(surface, box, z, rotation) {
  return rotate(
    add(
      surface.origin,
      mul(centerIn(box, surface.width, surface.height, z), surface.unit)
    ),
    rotation
  );
}
function screenUv(surface, x, y) {
  return [
    (x - surface.bounds.min[0]) / surface.bounds.size[0],
    (y - surface.bounds.min[1]) / surface.bounds.size[1]
  ];
}
function cameraFit(surface, state, config) {
  if (state.diagnostic)
    return [
      0,
      0,
      surface.bounds.size[1] / (2 * Math.tan(config.camera.fov / 2 * Math.PI / 180) * 0.82)
    ];
  const box = state.focus.box, z = config.camera.anchorDepth;
  const center = controlWorld(surface, box, z, state.rotation);
  const r = box.height / 2;
  const corners = Array.from({ length: 64 }, (_, i) => {
    const a = i / 64 * Math.PI * 2;
    const x = box.x + (Math.cos(a) < 0 ? r : box.width - r) + Math.cos(a) * r, y = box.y + r + Math.sin(a) * r;
    return rotate(
      add(
        surface.origin,
        mul([x - surface.width / 2, surface.height / 2 - y, z], surface.unit)
      ),
      state.rotation
    );
  });
  const k = Math.tan(config.camera.fov / 2 * Math.PI / 180), aspect = config.picture.aspect;
  let distance = box.width * surface.unit / (2 * k * aspect * state.target[2]), camera = [center[0], center[1], center[2] + distance];
  for (let iteration = 0; iteration < 15; iteration++) {
    const pixels = corners.map((p) => [
      0.5 + (p[0] - camera[0]) / (2 * (camera[2] - p[2]) * k * aspect),
      0.5 - (p[1] - camera[1]) / (2 * (camera[2] - p[2]) * k)
    ]);
    const min = [0, 1].map((i) => Math.min(...pixels.map((p) => p[i]))), max = [0, 1].map((i) => Math.max(...pixels.map((p) => p[i])));
    const measured = [
      (min[0] + max[0]) / 2,
      (min[1] + max[1]) / 2,
      max[0] - min[0]
    ];
    camera[0] += (measured[0] - state.target[0]) * 2 * distance * k * aspect;
    camera[1] -= (measured[1] - state.target[1]) * 2 * distance * k;
    distance *= measured[2] / state.target[2];
    camera[2] = center[2] + distance;
  }
  return camera;
}

// src/core/materials.mjs
function glassLayers(glass) {
  const top = glass.depth + 2 * glass.bevel;
  return {
    back: 0,
    depth: glass.depth,
    bevel: glass.bevel,
    face: top + glass.faceGap,
    selection: top + glass.faceGap + glass.selectionGap,
    icon: top + glass.faceGap + glass.selectionGap + glass.iconGap
  };
}

// src/render/textures.mjs
import * as THREE from "three";
function round(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function texture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  return t;
}

// src/render/GlassControls.jsx
import React2, { useMemo as useMemo2, useLayoutEffect as useLayoutEffect2 } from "react";
import * as THREE3 from "three";

// src/render/GlassSurface.jsx
import React, { useMemo, useLayoutEffect } from "react";
import * as THREE2 from "three";
var vertexShader = `
varying vec2 vLocal;
varying vec3 vViewPosition;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vNormal;
void main(){
 vLocal=position.xy;
 vec4 p=modelViewMatrix*vec4(position,1.0);
 vViewPosition=p.xyz;
 vRight=normalize(mat3(modelViewMatrix)*vec3(1.,0.,0.));
 vUp=normalize(mat3(modelViewMatrix)*vec3(0.,1.,0.));
 vNormal=normalize(normalMatrix*vec3(0.,0.,1.));
 gl_Position=projectionMatrix*p;
}`;
var fragmentShader = `
uniform sampler2D uScreen;
uniform sampler2D uFrostedScreen;
uniform vec2 uSize;
uniform vec2 uScreenSize;
uniform vec2 uCenter;
uniform vec2 uScale;
uniform float uFrost;
uniform float uReveal;
uniform float uFrame;
uniform float uLift;
uniform float uRimStrength;
uniform float uFormedRimStrength;
uniform float uBevelWidth;
uniform float uBackdropStrength;
varying vec2 vLocal;
varying vec3 vViewPosition;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vNormal;
float sdf(vec2 p){
 float r=uSize.y*.5;
 vec2 q=abs(p)-(uSize*.5-vec2(r));
 return length(max(q,0.))+min(max(q.x,q.y),0.)-r;
}
void main(){
 float d=sdf(vLocal);
 float aa=max(fwidth(d),.35);
 float mask=1.-smoothstep(-aa,aa,d);
 if(mask<.01)discard;
 vec3 eye=normalize(-vViewPosition);
 // Project the viewing ray down to the native display. Sampling straight down
 // duplicates text at oblique angles because the glass face is above the UI.
 float viewZ=max(.05,dot(eye,normalize(vNormal)));
 vec2 rayOffset=vec2(-dot(eye,normalize(vRight)),dot(eye,normalize(vUp)))*uLift/viewZ;
 vec2 px=uCenter+vec2(vLocal.x,-vLocal.y)*uScale+rayOffset;
 vec2 uv=vec2(px.x/uScreenSize.x,1.-px.y/uScreenSize.y);
 // Pre-filter the app in its own pixel grid; sparse large-radius taps produced
 // repeated text ghosts. Only this masked face samples the Gaussian texture.
 vec3 under=mix(texture2D(uScreen,uv).rgb,texture2D(uFrostedScreen,uv).rgb,uFrost);
 vec2 grad=normalize(vec2(sdf(vLocal+vec2(.5,0.))-sdf(vLocal-vec2(.5,0.)),sdf(vLocal+vec2(0.,.5))-sdf(vLocal-vec2(0.,.5)))+vec2(.00001));
 float bevel=1.-smoothstep(0.,uBevelWidth,-d);
 vec3 normal=normalize(vNormal*.72+(vRight*grad.x+vUp*grad.y)*bevel);
 // A broad studio light, expressed in view space; highlights respond to pose.
 vec3 light=normalize(vec3(-.65+.14*sin(uFrame*.003),.85,1.2));
 vec3 halfVector=normalize(light+eye);
 float broad=pow(max(dot(normal,halfVector),0.),20.);
 float fine=pow(max(dot(normal,halfVector),0.),85.);
 float fresnel=pow(1.-max(dot(normal,eye),0.),3.);
 float rim=exp(-pow((d+1.5)/1.2,2.));
 float lowerLip=exp(-pow((d+5.5)/2.2,2.));
 float gradient=.006+.005*(vLocal.y/uSize.y+.5);
 vec3 body=under*uBackdropStrength+vec3(gradient);
 body+=vec3(.028,.030,.034)*broad*uFrost;
 body+=vec3(.10,.105,.115)*(fine*.6+fresnel*.25)*bevel;
 body+=vec3(mix(uRimStrength,uFormedRimStrength,uFrost))*rim*(.22+.78*max(dot(normal,light),0.));
 body+=vec3(.018)*lowerLip*fresnel;
 float rimAlpha=clamp(rim*.8+bevel*.12,0.,1.);
 float alpha=mask*uReveal*max(uFrost,rimAlpha);
 gl_FragColor=vec4(body,alpha);
 #include <colorspace_fragment>
}`;
function GlassSurface({
  screen,
  frostedScreen,
  surface,
  control,
  frame,
  lift,
  glass
}) {
  const b = control.box;
  const material = useMemo(
    () => new THREE2.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      uniforms: {
        uScreen: { value: screen },
        uFrostedScreen: { value: frostedScreen },
        uSize: { value: new THREE2.Vector2(b.width, b.height) },
        uScreenSize: {
          value: new THREE2.Vector2(surface.width, surface.height)
        },
        uCenter: {
          value: new THREE2.Vector2(b.x + b.width / 2, b.y + b.height / 2)
        },
        uScale: { value: new THREE2.Vector2(1, 1) },
        uFrost: { value: 1 },
        uReveal: { value: 1 },
        uFrame: { value: 0 },
        uLift: { value: 0 },
        uRimStrength: { value: 0 },
        uFormedRimStrength: { value: 0 },
        uBevelWidth: { value: 0 },
        uBackdropStrength: { value: 0 }
      }
    }),
    [screen, frostedScreen, surface, b.width, b.height, b.x, b.y]
  );
  material.uniforms.uFrost.value = control.frost * glass.frost;
  material.uniforms.uRimStrength.value = glass.rimStrength;
  material.uniforms.uFormedRimStrength.value = glass.formedRimStrength;
  material.uniforms.uBevelWidth.value = glass.bevelWidth;
  material.uniforms.uBackdropStrength.value = glass.backdropStrength;
  material.uniforms.uReveal.value = control.reveal;
  material.uniforms.uFrame.value = frame;
  material.uniforms.uLift.value = lift;
  material.uniforms.uScale.value.set(
    control.scale * control.stretch[0],
    control.scale * control.stretch[1]
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  return <mesh
    name={"frosted-face:" + control.id}
    renderOrder={10}
    material={material}
  >
      <planeGeometry args={[b.width, b.height]} />
    </mesh>;
}

// src/core/highlight.mjs
function highlightLayout(width, height, count, config) {
  if (!Number.isInteger(config.index) || config.index < 0 || config.index >= count)
    throw Error("Navbar highlight index must identify an existing icon");
  const cell = width / count;
  const w = cell - 2 * config.insetX, h = height - 2 * config.insetY;
  if (w <= 0 || h <= 0) throw Error("Navbar highlight insets leave no area");
  return {
    width: w,
    height: h,
    x: -width / 2 + cell * (config.index + 0.5),
    y: 0,
    radius: config.shape === "capsule" ? Math.min(w, h) / 2 : Math.min(config.cornerRadius, w / 2, h / 2)
  };
}
function highlightOutline(box, shape) {
  const { width: w, height: h, radius: r } = box;
  if (shape === "ellipse")
    return Array.from({ length: 64 }, (_, i) => [
      Math.cos(i * Math.PI / 32) * w / 2,
      Math.sin(i * Math.PI / 32) * h / 2
    ]);
  return [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, Math.PI * 1.5]
  ].flatMap(
    ([x, y, start]) => Array.from({ length: 17 }, (_, i) => [
      x + r * Math.cos(start + i * Math.PI / 32),
      y + r * Math.sin(start + i * Math.PI / 32)
    ])
  );
}
function validateHighlight(width, height, count, config) {
  const box = highlightLayout(width, height, count, config);
  const capCenter = (width - height) / 2, radius = height / 2;
  for (const [px, py] of highlightOutline(box, config.shape)) {
    const x = px + box.x, nearest = Math.max(-capCenter, Math.min(capCenter, x));
    if (Math.hypot(x - nearest, py) > radius + 1e-6)
      throw Error(
        "Navbar highlight extends beyond the glass face; increase insets or corner radius"
      );
  }
  return box;
}

// src/render/GlassControls.jsx
function SelectionHighlight({ control, layers, config }) {
  const settings = control.highlight;
  const box = highlightLayout(
    control.box.width,
    control.box.height,
    control.icons.length,
    settings
  );
  const geometry = useMemo2(
    () => new THREE3.ShapeGeometry(
      new THREE3.Shape(
        highlightOutline(box, settings.shape).map(
          ([x, y]) => new THREE3.Vector2(x, y)
        )
      )
    ),
    [box.width, box.height, box.radius, settings.shape]
  );
  useLayoutEffect2(() => () => geometry.dispose(), [geometry]);
  return <mesh
    name="navbar-selection"
    geometry={geometry}
    renderOrder={11}
    position={[box.x, box.y, layers.selection]}
  >
      <meshBasicMaterial
    color={config.glass.selectionColor}
    transparent
    opacity={config.glass.selectionOpacity * control.selectionReveal * control.reveal}
    depthTest
    depthWrite={false}
  />
    </mesh>;
}
function drawIcon(ctx, type, style) {
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
  ctx.lineWidth = style.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (type === "compose") {
    ctx.moveTo(47, 17);
    ctx.lineTo(29, 17);
    ctx.quadraticCurveTo(16, 17, 16, 30);
    ctx.lineTo(16, 75);
    ctx.quadraticCurveTo(16, 88, 29, 88);
    ctx.lineTo(74, 88);
    ctx.quadraticCurveTo(87, 88, 87, 75);
    ctx.lineTo(87, 54);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(48, 57);
    ctx.lineTo(89, 16);
    ctx.stroke();
  } else if (type === "search") {
    ctx.arc(43, 42, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(62, 62);
    ctx.lineTo(84, 87);
    ctx.stroke();
  } else if (type === "home") {
    ctx.moveTo(11, 43);
    ctx.quadraticCurveTo(10, 38, 17, 34);
    ctx.lineTo(45, 13);
    ctx.quadraticCurveTo(50, 9, 57, 13);
    ctx.lineTo(84, 31);
    ctx.quadraticCurveTo(89, 34, 89, 40);
    ctx.lineTo(89, 83);
    ctx.quadraticCurveTo(89, 89, 81, 89);
    ctx.lineTo(63, 89);
    ctx.lineTo(63, 60);
    ctx.quadraticCurveTo(63, 55, 57, 55);
    ctx.lineTo(45, 55);
    ctx.quadraticCurveTo(39, 55, 39, 61);
    ctx.lineTo(39, 89);
    ctx.lineTo(18, 89);
    ctx.quadraticCurveTo(11, 89, 11, 82);
    ctx.closePath();
    ctx.stroke();
  } else if (type === "inbox") {
    ctx.moveTo(25, 22);
    ctx.lineTo(75, 22);
    ctx.lineTo(90, 66);
    ctx.lineTo(90, 84);
    ctx.lineTo(10, 84);
    ctx.lineTo(10, 66);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 61);
    ctx.lineTo(33, 61);
    ctx.lineTo(40, 73);
    ctx.lineTo(61, 73);
    ctx.lineTo(68, 61);
    ctx.lineTo(87, 61);
    ctx.stroke();
  } else if (type === "focus") {
    for (const [x, y, a] of [
      [29, 25, Math.PI],
      [73, 25, -Math.PI / 2],
      [73, 73, 0],
      [29, 73, Math.PI / 2]
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 13, a, a + Math.PI / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(51, 49, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "layers") {
    ctx.moveTo(19, 38);
    ctx.lineTo(50, 17);
    ctx.lineTo(81, 38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(19, 63);
    ctx.lineTo(50, 84);
    ctx.lineTo(81, 63);
    ctx.stroke();
  }
}
function iconMap(type, style) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.scale(5.12, 5.12);
  drawIcon(ctx, type, style);
  return texture(c);
}
function Icon({ type, size, x, y, parent, show = 1, selected = true, layers, style }) {
  const map = useMemo2(
    () => iconMap(type, style),
    [type, style.color, style.strokeWidth]
  );
  useLayoutEffect2(() => () => map.dispose(), [map]);
  return <mesh
    name={"icon:" + type}
    renderOrder={12}
    position={[x - parent.width / 2, parent.height / 2 - y, layers.icon]}
  >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
    map={map}
    transparent
    opacity={show * (selected ? 1 : style.inactiveOpacity)}
    depthTest
    depthWrite={false}
    toneMapped={false}
  />
    </mesh>;
}
function glassGeometry(w, h, layers) {
  const s = new THREE3.Shape(), r = h / 2 - layers.bevel, c = w / 2 - h / 2;
  s.moveTo(-c, -r);
  s.lineTo(c, -r);
  s.absarc(c, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-c, r);
  s.absarc(-c, 0, r, Math.PI / 2, 3 * Math.PI / 2, false);
  const g = new THREE3.ExtrudeGeometry(s, {
    depth: layers.depth,
    bevelEnabled: true,
    bevelSize: layers.bevel,
    bevelThickness: layers.bevel,
    bevelSegments: 6,
    curveSegments: 48
  });
  g.translate(0, 0, layers.bevel);
  return g;
}
function GlassControl({
  control,
  frame,
  screen,
  frostedScreen,
  surface,
  config
}) {
  const glass = config.glass, layers = glassLayers(glass);
  const b = control.box, w = b.width, h = b.height;
  const geometry = useMemo2(
    () => glassGeometry(w, h, layers),
    [w, h, glass.depth, glass.bevel]
  );
  const show = control.reveal, scale = control.scale;
  useLayoutEffect2(() => () => geometry.dispose(), [geometry]);
  return <group
    name={"glass:" + control.id}
    position={[b.x + w / 2, -b.y - h / 2, control.z]}
  >
      <group
    rotation={control.rotation}
    scale={[
      scale * control.stretch[0],
      scale * control.stretch[1],
      Math.max(0.03, control.thickness)
    ]}
  >
        <mesh
    name={"glass-volume:" + control.id}
    geometry={geometry}
    renderOrder={8}
  >
          <meshBasicMaterial
    attach="material-0"
    transparent
    opacity={0}
    depthWrite={false}
  />
          <meshPhysicalMaterial
    attach="material-1"
    color={glass.color}
    roughness={glass.roughness}
    metalness={0}
    transmission={glass.transmission}
    thickness={glass.opticalThickness}
    ior={glass.ior}
    clearcoat={glass.clearcoat}
    clearcoatRoughness={glass.clearcoatRoughness}
    transparent
    opacity={show * control.frost}
    depthWrite={false}
  />
        </mesh>
        <group position={[0, 0, layers.face]}>
          <GlassSurface
    glass={glass}
    screen={screen}
    frostedScreen={frostedScreen}
    surface={surface}
    control={control}
    frame={frame}
    lift={(surface.origin[2] - surface.glassZ) / surface.unit + control.z + layers.face * Math.max(0.03, control.thickness)}
  />
        </group>
        {control.highlight && <SelectionHighlight
    control={control}
    layers={layers}
    config={config}
  />}
        {control.icons.map((icon) => <Icon
    layers={layers}
    style={config.icons}
    key={icon.type}
    type={icon.type}
    size={icon.size}
    x={icon.x}
    y={icon.y}
    parent={b}
    show={icon.reveal * show}
    selected={icon.selected}
  />)}
      </group>
    </group>;
}

// src/render/DeviceScene.jsx
function CameraRig({ surface, state, config }) {
  const { camera } = useThree();
  const pos = cameraFit(surface, state, config);
  useLayoutEffect3(() => {
    camera.position.set(...pos);
    camera.lookAt(pos[0], pos[1], pos[2] - 1);
    camera.updateMatrixWorld();
  }, [camera, ...pos]);
  return null;
}
function DeviceScene({ assets, frame, config, sampleState: sampleState2, validateState, makeScreen, diagnostic = false }) {
  const raw = useLoader(THREE4.FileLoader, assets.model.handle);
  const model = useMemo3(
    () => normalizeModel(parseModel(raw), config.device),
    [
      raw,
      config.device.displayMesh,
      ...config.device.right,
      ...config.device.up,
      ...config.device.normal,
      config.device.flipWinding,
      config.device.confirmBaked
    ]
  );
  const surface = useMemo3(
    () => displaySurface(
      model,
      config.device.displayMesh,
      config.device.pixelWidth,
      config.device.clearance
    ),
    [model, config.device.pixelWidth, config.device.clearance]
  );
  const state = sampleState2(surface, frame, config);
  useMemo3(() => validateState(surface, config), [surface, config, validateState]);
  if (diagnostic) {
    state.rotation = frame % 2 === 0 ? [0, 0, 0] : [-0.45, -0.4, -0.12];
    state.visible = state.controls.map((c) => ({
      ...c,
      scale: 1,
      stretch: [1, 1],
      thickness: 1,
      frost: 1,
      rotation: [0, 0, 0],
      reveal: 1,
      icons: c.icons.map((i) => ({ ...i, reveal: 1 }))
    }));
    state.diagnostic = true;
  }
  return config.screen.source === "asset" ? <AssetScreenScene
    surface={surface}
    model={model}
    state={state}
    config={config}
    frame={frame}
    diagnostic={diagnostic}
    assets={assets}
  /> : <SimulatedScreenScene
    makeScreen={makeScreen}
    surface={surface}
    model={model}
    state={state}
    config={config}
    frame={frame}
    diagnostic={diagnostic}
  />;
}
function SimulatedScreenScene(props) {
  const screen = useMemo3(
    () => props.makeScreen(props.surface, props.config.screen),
    [props.surface, props.config.screen, props.makeScreen]
  );
  useLayoutEffect3(() => () => screen.dispose(), [screen]);
  return <SceneContents {...props} screen={screen} />;
}
function AssetScreenScene(props) {
  if (!props.assets.screen?.handle)
    throw Error("screen.source=asset requires the screen asset binding");
  const loaded = useLoader(THREE4.TextureLoader, props.assets.screen.handle);
  const screen = useMemo3(() => {
    const t = loaded.clone();
    t.colorSpace = THREE4.SRGBColorSpace;
    t.anisotropy = 16;
    t.needsUpdate = true;
    return t;
  }, [loaded]);
  useLayoutEffect3(() => () => screen.dispose(), [screen]);
  if (Math.abs(
    screen.image.width / screen.image.height - props.surface.width / props.surface.height
  ) > 0.01)
    throw Error(
      "Screen asset aspect must match native display; provide a portrait screen capture without device hardware"
    );
  return <SceneContents {...props} screen={screen} />;
}
function SceneContents({
  surface,
  model,
  state,
  config,
  frame,
  diagnostic,
  screen
}) {
  const layers = glassLayers(config.glass);
  const frostedScreen = useMemo3(() => {
    const c = document.createElement("canvas");
    c.width = screen.image.width;
    c.height = screen.image.height;
    const ctx = c.getContext("2d");
    ctx.filter = "blur(" + config.glass.frostBlur + "px)";
    ctx.drawImage(screen.image, 0, 0);
    return texture(c);
  }, [screen, config.glass.frostBlur]);
  useLayoutEffect3(
    () => () => {
      frostedScreen.dispose();
    },
    [screen, frostedScreen]
  );
  const focusBox = state.focusBox ?? state.focus.box;
  const cameraPosition = cameraFit(surface, state, config), target = controlWorld(
    surface,
    focusBox,
    state.focus.z + layers.icon,
    state.rotation
  );
  const distance = length(sub(cameraPosition, target));
  const parts = useMemo3(
    () => model.meshes.map((m) => {
      const g = new THREE4.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE4.Float32BufferAttribute(m.positions, 3)
      );
      g.setIndex(m.indices);
      if (m.name === config.device.displayMesh) {
        const uv = [];
        for (let i = 0; i < m.positions.length; i += 3)
          uv.push(...screenUv(surface, m.positions[i], m.positions[i + 1]));
        g.setAttribute("uv", new THREE4.Float32BufferAttribute(uv, 2));
      }
      g.computeVertexNormals();
      return { m, g };
    }),
    [model, surface]
  );
  useLayoutEffect3(() => () => parts.forEach(({ g }) => g.dispose()), [parts]);
  return <>
      <CameraRig surface={surface} state={state} config={config} />
      {!diagnostic && config.focus.enabled && <FrameDepthOfField
    focusDistance={distance}
    focusRange={state.focusRange}
    bokehScale={config.focus.bokeh}
    resolutionScale={config.focus.resolutionScale}
  />}
      <ambientLight intensity={config.lighting.ambient} />
      <directionalLight {...config.lighting.key} />
      <directionalLight {...config.lighting.fill} />
      <group name="native-device-root" rotation={state.rotation}>
        {parts.map(({ m, g }) => <mesh key={m.name} name={m.name} geometry={g}>
            {m.name === config.device.displayMesh ? <meshBasicMaterial map={screen} toneMapped={false} /> : <meshPhysicalMaterial
    color={m.material === "screen" ? config.hardware.screenColor : config.hardware.color}
    metalness={m.material === "frame" ? config.hardware.frameMetalness : config.hardware.metalness}
    roughness={config.hardware.roughness}
    clearcoat={config.hardware.clearcoat}
    side={THREE4.DoubleSide}
  />}
          </mesh>)}
        <group
    name="screen-coordinate-system"
    position={surface.origin}
    scale={surface.unit}
  >
          <group position={[-surface.width / 2, surface.height / 2, 0]}>
            {state.visible.map((control) => <GlassControl
    config={config}
    key={control.id}
    control={control}
    screen={screen}
    frostedScreen={frostedScreen}
    surface={surface}
    frame={frame}
  />)}
          </group>
        </group>
      </group>
    </>;
}

// src/showcase/schema.json
var schema_default = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: "integer",
      enum: [
        2
      ]
    },
    shot: {
      type: "string",
      enum: [
        "film",
        "compose",
        "navbar",
        "search",
        "end"
      ]
    },
    startFrame: {
      type: "number",
      minimum: 0,
      maximum: 1e5
    },
    diagnostic: {
      type: "boolean"
    },
    timeline: {
      type: "object",
      additionalProperties: false,
      properties: {
        fps: {
          type: "number",
          minimum: 1,
          maximum: 120
        },
        cuts: {
          type: "array",
          items: {
            type: "number",
            minimum: 1,
            maximum: 1e5
          },
          minItems: 4,
          maxItems: 4
        },
        fadeIn: {
          type: "array",
          items: {
            type: "number",
            minimum: 0,
            maximum: 1e5
          },
          minItems: 2,
          maxItems: 2
        },
        logoIn: {
          type: "array",
          items: {
            type: "number",
            minimum: 0,
            maximum: 1e5
          },
          minItems: 2,
          maxItems: 2
        },
        logoOut: {
          type: "array",
          items: {
            type: "number",
            minimum: 0,
            maximum: 1e5
          },
          minItems: 2,
          maxItems: 2
        },
        speed: {
          type: "number",
          minimum: 0.25,
          maximum: 4
        }
      }
    },
    picture: {
      type: "object",
      additionalProperties: false,
      properties: {
        aspect: {
          type: "number",
          minimum: 0.5,
          maximum: 4
        },
        background: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        }
      }
    },
    device: {
      type: "object",
      additionalProperties: false,
      properties: {
        displayMesh: {
          type: "string",
          minLength: 1
        },
        right: {
          type: "array",
          items: {
            type: "number",
            minimum: -1,
            maximum: 1
          },
          minItems: 3,
          maxItems: 3
        },
        up: {
          type: "array",
          items: {
            type: "number",
            minimum: -1,
            maximum: 1
          },
          minItems: 3,
          maxItems: 3
        },
        normal: {
          type: "array",
          items: {
            type: "number",
            minimum: -1,
            maximum: 1
          },
          minItems: 3,
          maxItems: 3
        },
        confirmBaked: {
          type: "boolean"
        },
        flipWinding: {
          type: "boolean"
        },
        pixelWidth: {
          type: "number",
          minimum: 100,
          maximum: 4096
        },
        clearance: {
          type: "number",
          minimum: 0.1,
          maximum: 20
        },
        poseDegrees: {
          type: "array",
          items: {
            type: "number",
            minimum: -60,
            maximum: 60
          },
          minItems: 3,
          maxItems: 3
        }
      }
    },
    glass: {
      type: "object",
      additionalProperties: false,
      properties: {
        depth: {
          type: "number",
          minimum: 0.1,
          maximum: 80
        },
        bevel: {
          type: "number",
          minimum: 0,
          maximum: 20
        },
        faceGap: {
          type: "number",
          minimum: 0.01,
          maximum: 10
        },
        selectionGap: {
          type: "number",
          minimum: 0.01,
          maximum: 10
        },
        iconGap: {
          type: "number",
          minimum: 0.01,
          maximum: 20
        },
        color: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        roughness: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        transmission: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        opticalThickness: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        ior: {
          type: "number",
          minimum: 1,
          maximum: 2.33
        },
        clearcoat: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        clearcoatRoughness: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        frostBlur: {
          type: "number",
          minimum: 0,
          maximum: 64
        },
        frost: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        rimStrength: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        formedRimStrength: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        bevelWidth: {
          type: "number",
          minimum: 0.1,
          maximum: 40
        },
        backdropStrength: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        selectionColor: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        selectionOpacity: {
          type: "number",
          minimum: 0,
          maximum: 1
        }
      }
    },
    layout: {
      type: "object",
      additionalProperties: false,
      properties: {
        compose: {
          type: "object",
          additionalProperties: false,
          properties: {
            x: {
              type: "number",
              minimum: 0,
              maximum: 4096
            },
            y: {
              type: "number",
              minimum: 0,
              maximum: 8192
            },
            width: {
              type: "number",
              minimum: 1,
              maximum: 4096
            },
            height: {
              type: "number",
              minimum: 1,
              maximum: 4096
            },
            z: {
              type: "number",
              minimum: 0.1,
              maximum: 40
            },
            icon: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "compose",
                    "home",
                    "inbox",
                    "focus",
                    "layers",
                    "search"
                  ]
                },
                size: {
                  type: "number",
                  minimum: 1,
                  maximum: 180
                }
              }
            }
          }
        },
        navbar: {
          type: "object",
          additionalProperties: false,
          properties: {
            x: {
              type: "number",
              minimum: 0,
              maximum: 4096
            },
            bottom: {
              type: "number",
              minimum: 1,
              maximum: 8192
            },
            width: {
              type: "number",
              minimum: 1,
              maximum: 4096
            },
            compactWidth: {
              type: "number",
              minimum: 1,
              maximum: 4096
            },
            height: {
              type: "number",
              minimum: 1,
              maximum: 4096
            },
            z: {
              type: "number",
              minimum: 0.1,
              maximum: 40
            },
            icons: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "compose",
                      "home",
                      "inbox",
                      "focus",
                      "layers",
                      "search"
                    ]
                  },
                  size: {
                    type: "number",
                    minimum: 1,
                    maximum: 180
                  }
                }
              },
              minItems: 1
            },
            highlight: {
              type: "object",
              additionalProperties: false,
              properties: {
                shape: {
                  type: "string",
                  enum: [
                    "ellipse",
                    "capsule",
                    "roundedRect"
                  ]
                },
                index: {
                  type: "integer",
                  minimum: 0
                },
                insetX: {
                  type: "number",
                  minimum: 0,
                  maximum: 100
                },
                insetY: {
                  type: "number",
                  minimum: 0,
                  maximum: 100
                },
                cornerRadius: {
                  type: "number",
                  minimum: 0,
                  maximum: 100
                }
              }
            }
          }
        },
        search: {
          type: "object",
          additionalProperties: false,
          properties: {
            x: {
              type: "number",
              minimum: 0,
              maximum: 4096
            },
            bottom: {
              type: "number",
              minimum: 1,
              maximum: 8192
            },
            width: {
              type: "number",
              minimum: 1,
              maximum: 4096
            },
            height: {
              type: "number",
              minimum: 1,
              maximum: 4096
            },
            z: {
              type: "number",
              minimum: 0.1,
              maximum: 40
            },
            icon: {
              type: "object",
              additionalProperties: false,
              properties: {
                type: {
                  type: "string",
                  enum: [
                    "compose",
                    "home",
                    "inbox",
                    "focus",
                    "layers",
                    "search"
                  ]
                },
                size: {
                  type: "number",
                  minimum: 1,
                  maximum: 180
                }
              }
            }
          }
        }
      }
    },
    motion: {
      type: "object",
      additionalProperties: false,
      properties: {
        compose: {
          type: "object",
          additionalProperties: false,
          properties: {
            scale: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "number",
                  minimum: -1e4,
                  maximum: 1e4
                },
                minItems: 2,
                maxItems: 2
              },
              minItems: 1
            },
            stretch: {
              type: "number",
              minimum: 0,
              maximum: 0.2
            },
            settle: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            },
            formation: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            },
            frost: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            },
            reveal: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            },
            icon: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            }
          }
        },
        navbar: {
          type: "object",
          additionalProperties: false,
          properties: {
            formation: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            },
            frost: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            },
            initialFormation: {
              type: "number",
              minimum: 0,
              maximum: 1
            },
            selection: {
              type: "array",
              items: { type: "number", minimum: 0, maximum: 1e5 },
              minItems: 2,
              maxItems: 2
            },
            initialFrost: {
              type: "number",
              minimum: 0,
              maximum: 1
            },
            icons: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "number",
                  minimum: 0,
                  maximum: 1e5
                },
                minItems: 2,
                maxItems: 2
              },
              minItems: 1
            }
          }
        },
        search: {
          type: "object",
          additionalProperties: false,
          properties: {
            formation: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            },
            frost: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            },
            initialFormation: {
              type: "number",
              minimum: 0,
              maximum: 1
            },
            initialFrost: {
              type: "number",
              minimum: 0,
              maximum: 1
            },
            icon: {
              type: "array",
              items: {
                type: "number",
                minimum: 0,
                maximum: 1e5
              },
              minItems: 2,
              maxItems: 2
            }
          }
        }
      }
    },
    camera: {
      type: "object",
      additionalProperties: false,
      properties: {
        fov: {
          type: "number",
          minimum: 1,
          maximum: 90
        },
        anchorDepth: {
          type: "number",
          minimum: 0.1,
          maximum: 120
        },
        compose: {
          type: "object",
          additionalProperties: false,
          properties: {
            rotation: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "number",
                  minimum: -1e4,
                  maximum: 1e4
                },
                minItems: 4,
                maxItems: 4
              },
              minItems: 1
            },
            target: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "number",
                  minimum: -1e4,
                  maximum: 1e4
                },
                minItems: 4,
                maxItems: 4
              },
              minItems: 1
            }
          }
        },
        navbar: {
          type: "object",
          additionalProperties: false,
          properties: {
            rotation: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "number",
                  minimum: -1e4,
                  maximum: 1e4
                },
                minItems: 4,
                maxItems: 4
              },
              minItems: 1
            },
            target: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "number",
                  minimum: -1e4,
                  maximum: 1e4
                },
                minItems: 4,
                maxItems: 4
              },
              minItems: 1
            }
          }
        },
        search: {
          type: "object",
          additionalProperties: false,
          properties: {
            rotation: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "number",
                  minimum: -1e4,
                  maximum: 1e4
                },
                minItems: 4,
                maxItems: 4
              },
              minItems: 1
            },
            target: {
              type: "array",
              items: {
                type: "array",
                items: {
                  type: "number",
                  minimum: -1e4,
                  maximum: 1e4
                },
                minItems: 4,
                maxItems: 4
              },
              minItems: 1
            }
          }
        },
        framing: {
          type: "object",
          additionalProperties: false,
          properties: {
            offset: {
              type: "array",
              items: {
                type: "number",
                minimum: -0.4,
                maximum: 0.4
              },
              minItems: 2,
              maxItems: 2
            },
            zoom: {
              type: "number",
              minimum: 0.25,
              maximum: 2
            }
          }
        }
      }
    },
    screen: {
      type: "object",
      additionalProperties: false,
      properties: {
        source: {
          type: "string",
          enum: [
            "simulated",
            "asset"
          ]
        },
        background: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        fontFamily: {
          type: "string",
          minLength: 1
        },
        fontSize: {
          type: "number",
          minimum: 8,
          maximum: 160
        },
        textColor: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        selectedTextColor: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        selectedRow: {
          type: "number",
          minimum: -1,
          maximum: 100
        },
        rows: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: {
                type: "string",
                minLength: 1
              },
              color: {
                type: "string",
                minLength: 1,
                pattern: "^#[0-9a-fA-F]{6}$"
              }
            }
          },
          minItems: 1
        },
        rowsBottom: {
          type: "number",
          minimum: 1,
          maximum: 8192
        },
        rowGap: {
          type: "number",
          minimum: 1,
          maximum: 1e3
        },
        iconX: {
          type: "number",
          minimum: 0,
          maximum: 4096
        },
        textX: {
          type: "number",
          minimum: 0,
          maximum: 4096
        },
        iconRadius: {
          type: "number",
          minimum: 1,
          maximum: 100
        },
        statusBar: {
          type: "boolean"
        }
      }
    },
    icons: {
      type: "object",
      additionalProperties: false,
      properties: {
        inactiveOpacity: { type: "number", minimum: 0, maximum: 1 },
        color: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        strokeWidth: {
          type: "number",
          minimum: 1,
          maximum: 20
        }
      }
    },
    focus: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: {
          type: "boolean"
        },
        ranges: {
          type: "array",
          items: {
            type: "number",
            minimum: 0.01,
            maximum: 100
          },
          minItems: 3,
          maxItems: 3
        },
        bokeh: {
          type: "number",
          minimum: 0,
          maximum: 5
        },
        resolutionScale: {
          type: "number",
          minimum: 0.1,
          maximum: 1
        }
      }
    },
    lighting: {
      type: "object",
      additionalProperties: false,
      properties: {
        ambient: {
          type: "number",
          minimum: 0,
          maximum: 5
        },
        key: {
          type: "object",
          additionalProperties: false,
          properties: {
            position: {
              type: "array",
              items: {
                type: "number",
                minimum: -1e4,
                maximum: 1e4
              },
              minItems: 3,
              maxItems: 3
            },
            intensity: {
              type: "number",
              minimum: 0,
              maximum: 10
            },
            color: {
              type: "string",
              minLength: 1,
              pattern: "^#[0-9a-fA-F]{6}$"
            }
          }
        },
        fill: {
          type: "object",
          additionalProperties: false,
          properties: {
            position: {
              type: "array",
              items: {
                type: "number",
                minimum: -1e4,
                maximum: 1e4
              },
              minItems: 3,
              maxItems: 3
            },
            intensity: {
              type: "number",
              minimum: 0,
              maximum: 10
            },
            color: {
              type: "string",
              minLength: 1,
              pattern: "^#[0-9a-fA-F]{6}$"
            }
          }
        }
      }
    },
    hardware: {
      type: "object",
      additionalProperties: false,
      properties: {
        color: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        screenColor: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        frameMetalness: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        metalness: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        roughness: {
          type: "number",
          minimum: 0,
          maximum: 1
        },
        clearcoat: {
          type: "number",
          minimum: 0,
          maximum: 1
        }
      }
    },
    endCard: {
      type: "object",
      additionalProperties: false,
      properties: {
        text: {
          type: "string",
          minLength: 1
        },
        color: {
          type: "string",
          minLength: 1,
          pattern: "^#[0-9a-fA-F]{6}$"
        },
        fontFamily: {
          type: "string",
          minLength: 1
        },
        showMark: {
          type: "boolean"
        }
      }
    }
  }
};

// src/showcase/profile.json
var profile_default = {
  schemaVersion: 2,
  shot: "film",
  startFrame: 0,
  diagnostic: false,
  timeline: {
    fps: 60,
    cuts: [
      220,
      536,
      698,
      910
    ],
    fadeIn: [
      0,
      30
    ],
    logoIn: [
      699,
      720
    ],
    logoOut: [
      865,
      909
    ],
    speed: 1
  },
  picture: {
    aspect: 2,
    background: "#000000"
  },
  device: {
    displayMesh: "display",
    right: [
      1,
      0,
      0
    ],
    up: [
      0,
      1,
      0
    ],
    normal: [
      0,
      0,
      1
    ],
    confirmBaked: true,
    flipWinding: false,
    pixelWidth: 1200,
    clearance: 2,
    poseDegrees: [
      0,
      0,
      0
    ]
  },
  glass: {
    depth: 8,
    bevel: 2,
    faceGap: 0.3,
    selectionGap: 0.7,
    iconGap: 2,
    color: "#aeb2ba",
    roughness: 0.34,
    transmission: 0.96,
    opticalThickness: 0.07,
    ior: 1.35,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
    frostBlur: 16,
    frost: 1,
    rimStrength: 0.28,
    formedRimStrength: 0.04,
    bevelWidth: 11,
    backdropStrength: 0.52,
    selectionColor: "#444448",
    selectionOpacity: 0.32
  },
  layout: {
    compose: {
      x: 930,
      y: 210,
      width: 180,
      height: 180,
      z: 6,
      icon: {
        type: "compose",
        size: 80
      }
    },
    navbar: {
      x: 80,
      bottom: 330,
      width: 1040,
      compactWidth: 770,
      height: 180,
      z: 6,
      icons: [
        {
          type: "home",
          size: 90
        },
        {
          type: "inbox",
          size: 90
        },
        {
          type: "focus",
          size: 90
        },
        {
          type: "layers",
          size: 90
        }
      ],
      highlight: {
        shape: "capsule",
        index: 0,
        insetX: 6,
        insetY: 11,
        cornerRadius: 32
      }
    },
    search: {
      x: 930,
      bottom: 330,
      width: 180,
      height: 180,
      z: 6,
      icon: {
        type: "search",
        size: 78
      }
    }
  },
  motion: {
    compose: {
      scale: [
        [
          50,
          0
        ],
        [
          54,
          0.18
        ],
        [
          58,
          0.42
        ],
        [
          62,
          0.61
        ],
        [
          66,
          0.77
        ],
        [
          70,
          0.92
        ],
        [
          75,
          1.07
        ],
        [
          85,
          1.02
        ],
        [
          110,
          1
        ]
      ],
      stretch: 0.07,
      settle: [
        63,
        95
      ],
      formation: [
        54,
        86
      ],
      frost: [
        64,
        92
      ],
      reveal: [
        50,
        58
      ],
      icon: [
        96,
        132
      ]
    },
    navbar: {
      formation: [
        220,
        274
      ],
      frost: [
        220,
        275
      ],
      initialFormation: 0.7,
      initialFrost: 0.45,
      selection: [274, 310],
      icons: [
        [
          274,
          310
        ],
        [
          355,
          399
        ],
        [
          411,
          450
        ],
        [
          463,
          500
        ]
      ]
    },
    search: {
      formation: [
        536,
        580
      ],
      frost: [
        536,
        587
      ],
      initialFormation: 0.55,
      initialFrost: 0.3,
      icon: [
        580,
        620
      ]
    }
  },
  camera: {
    fov: 12,
    anchorDepth: 11,
    compose: {
      rotation: [
        [
          0,
          -0.928,
          -0.312,
          0.152
        ],
        [
          60,
          -0.932302,
          -0.268773,
          0.157455
        ],
        [
          90,
          -0.934702,
          -0.247036,
          0.160414
        ],
        [
          120,
          -0.936682,
          -0.22455,
          0.161737
        ],
        [
          150,
          -0.939321,
          -0.201198,
          0.163632
        ],
        [
          219,
          -0.943623,
          -0.1445,
          0.167182
        ]
      ],
      target: [
        [
          0,
          0.495,
          0.515,
          0.195
        ],
        [
          220,
          0.495,
          0.515,
          0.225
        ]
      ]
    },
    navbar: {
      rotation: [
        [
          220,
          -0.93,
          -0.45,
          -0.22
        ],
        [
          536,
          -0.93,
          -0.45,
          -0.29
        ]
      ],
      target: [
        [
          220,
          0.52,
          0.407,
          0.734
        ],
        [
          300,
          0.523,
          0.46,
          0.756
        ],
        [
          390,
          0.534,
          0.453,
          0.761
        ],
        [
          535,
          0.532,
          0.432,
          0.781
        ]
      ]
    },
    search: {
      rotation: [
        [
          536,
          -0.25,
          -0.88,
          -0.33
        ],
        [
          698,
          -0.25,
          -0.88,
          -0.315
        ]
      ],
      target: [
        [
          536,
          0.62,
          0.415,
          0.156
        ]
      ]
    },
    framing: {
      offset: [
        0,
        0
      ],
      zoom: 1
    }
  },
  screen: {
    source: "simulated",
    background: "#09090b",
    fontFamily: "Inter, Arial, sans-serif",
    fontSize: 49,
    textColor: "#8d8d92",
    selectedTextColor: "#b6b6b8",
    selectedRow: 5,
    rows: [
      {
        label: "Projects",
        color: "#575365"
      },
      {
        label: "Teams",
        color: "#45454c"
      },
      {
        label: "Website",
        color: "#468756"
      },
      {
        label: "iOS",
        color: "#5268c8"
      },
      {
        label: "Android",
        color: "#a14355"
      },
      {
        label: "Product",
        color: "#6d58bd"
      },
      {
        label: "Design",
        color: "#7661ba"
      }
    ],
    rowsBottom: 1080,
    rowGap: 142,
    iconX: 145,
    textX: 215,
    iconRadius: 28,
    statusBar: true
  },
  icons: {
    color: "#f5f5f5",
    inactiveOpacity: 0.58,
    strokeWidth: 8
  },
  focus: {
    enabled: true,
    ranges: [
      2,
      3,
      1.8
    ],
    bokeh: 0.8,
    resolutionScale: 1
  },
  lighting: {
    ambient: 0.13,
    key: {
      position: [
        -8,
        12,
        12
      ],
      intensity: 0.9,
      color: "#d8d9e3"
    },
    fill: {
      position: [
        8,
        -8,
        5
      ],
      intensity: 0.5,
      color: "#bcc2cf"
    }
  },
  hardware: {
    color: "#19191b",
    screenColor: "#09090b",
    frameMetalness: 0.3,
    metalness: 0.06,
    roughness: 0.68,
    clearcoat: 0.06
  },
  endCard: {
    text: "Your product",
    color: "#f5f5f5",
    fontFamily: "Inter",
    showMark: false
  }
};

// src/showcase/params.mjs
function withDefaults(schema, value) {
  const out = { ...schema };
  if (schema.type === "object") out.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => [key, withDefaults(child, value?.[key])]));
  else if (value !== void 0) out.default = value;
  return out;
}
var propSchema = withDefaults(schema_default, profile_default);
function decode(schema, input, path = "params") {
  const value = input === void 0 ? schema.default : input;
  const fail = (message) => {
    throw new Error(path + ": " + message);
  };
  if (schema.type === "object") {
    if (value !== void 0 && (!value || typeof value !== "object" || Array.isArray(value)))
      fail("expected an object");
    for (const key of Object.keys(value || {}))
      if (!Object.hasOwn(schema.properties, key))
        fail("unknown property " + key);
    return Object.fromEntries(
      Object.entries(schema.properties).map(([key, def]) => [
        key,
        decode(def, value?.[key], path + "." + key)
      ])
    );
  }
  if (schema.type === "array") {
    if (!Array.isArray(value) || value.length < (schema.minItems || 0) || value.length > (schema.maxItems ?? Infinity))
      fail("invalid array length");
    return value.map(
      (item, i) => decode(schema.items, item, path + "[" + i + "]")
    );
  }
  if (typeof value !== (schema.type === "integer" ? "number" : schema.type))
    fail("expected " + schema.type);
  if (typeof value === "number" && (!Number.isFinite(value) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity) || schema.type === "integer" && !Number.isInteger(value)))
    fail("number outside allowed range");
  if (typeof value === "string" && (value.length < (schema.minLength || 0) || schema.pattern && !new RegExp(schema.pattern).test(value)))
    fail("invalid string");
  if (schema.enum && !schema.enum.includes(value)) fail("unsupported value");
  return value;
}
var increasing = (values, label) => {
  if (values.some((v, i) => i > 0 && v <= values[i - 1]))
    throw Error(label + ": frames must strictly increase");
};
function resolveParams(params = {}) {
  const p = decode(propSchema, params);
  increasing([0, ...p.timeline.cuts], "timeline.cuts");
  for (const k of ["fadeIn", "logoIn", "logoOut"])
    increasing(p.timeline[k], "timeline." + k);
  for (const k of ["compose", "navbar", "search"]) {
    for (const [name, value] of Object.entries(p.motion[k]))
      if (Array.isArray(value)) {
        if (name === "scale")
          increasing(
            value.map((row) => row[0]),
            "motion." + k + ".scale"
          );
        else if (name === "icons")
          value.forEach((row) => increasing(row, "motion.navbar.icons"));
        else increasing(value, "motion." + k + "." + name);
      }
    for (const name of ["rotation", "target"])
      increasing(
        p.camera[k][name].map((row) => row[0]),
        "camera." + k + "." + name
      );
    if (p.camera[k].target.some((row) => row[3] <= 0))
      throw Error("camera target projected width must be positive");
    const box = p.layout[k];
    if (box.width < box.height || p.glass.bevel >= box.height / 2)
      throw Error(
        "Glass controls require width >= height and bevel < height/2"
      );
  }
  if (p.layout.navbar.compactWidth < p.layout.navbar.height)
    throw Error("compact navbar width must be >= height");
  if (p.layout.navbar.icons.length !== p.motion.navbar.icons.length)
    throw Error("Every navbar icon needs a reveal window");
  if (p.motion.compose.scale.some((row) => row[1] < 0))
    throw Error("Scale must be nonnegative");
  const nav = p.layout.navbar;
  for (const width of [nav.width, nav.compactWidth])
    validateHighlight(width, nav.height, nav.icons.length, nav.highlight);
  return p;
}
function sourceFrame(p, render) {
  const offset = {
    film: 0,
    compose: 0,
    navbar: p.timeline.cuts[0],
    search: p.timeline.cuts[1],
    end: p.timeline.cuts[2]
  }[p.shot];
  return offset + p.startFrame + render.frame * p.timeline.fps * p.timeline.speed / render.fps;
}

// src/showcase/choreography.mjs
function controlState(surface, frame, p) {
  const shot = frame < p.timeline.cuts[0] ? 0 : frame < p.timeline.cuts[1] ? 1 : frame < p.timeline.cuts[2] ? 2 : 3;
  const h = surface.height, { compose: a, navbar: b, search: c } = p.layout;
  const { compose: ma, navbar: mb, search: mc } = p.motion;
  const sample = (window) => enter(frame, ...window), form = (initial, window) => initial + (1 - initial) * sample(window);
  const barWidth = shot === 2 ? b.compactWidth : b.width;
  const controls = [
    {
      id: "compose",
      box: { x: a.x, y: a.y, width: a.width, height: a.height },
      z: a.z,
      scale: measuredTrack(ma.scale, frame)[0],
      stretch: [
        1 + ma.stretch * (1 - sample(ma.settle)),
        1 - ma.stretch * (1 - sample(ma.settle))
      ],
      thickness: sample(ma.formation),
      frost: sample(ma.frost),
      rotation: [0, 0, 0],
      reveal: sample(ma.reveal),
      icons: [
        { ...a.icon, x: a.width / 2, y: a.height / 2, reveal: revealIcon(frame, ...ma.icon) }
      ]
    },
    {
      id: "toolbar",
      highlight: b.highlight,
      box: { x: b.x, y: h - b.bottom, width: barWidth, height: b.height },
      z: b.z,
      scale: 1,
      stretch: [1, 1],
      thickness: shot === 1 ? form(mb.initialFormation, mb.formation) : 1,
      frost: shot === 1 ? form(mb.initialFrost, mb.frost) : 1,
      rotation: [0, 0, 0],
      reveal: 1,
      selectionReveal: shot === 2 ? 1 : revealIcon(frame, ...mb.selection),
      icons: b.icons.map((icon, i) => ({
        ...icon,
        x: barWidth * (i + 0.5) / b.icons.length,
        y: b.height / 2,
        selected: i === b.highlight.index,
        // The selected tab is legible on the selection beat, irrespective of slot.
        reveal: shot === 2 ? 1 : revealIcon(frame, ...i === b.highlight.index ? mb.selection : mb.icons[i])
      }))
    },
    {
      id: "search",
      box: { x: c.x, y: h - c.bottom, width: c.width, height: c.height },
      z: c.z,
      scale: 1,
      stretch: [1, 1],
      thickness: form(mc.initialFormation, mc.formation),
      frost: form(mc.initialFrost, mc.frost),
      rotation: [0, 0, 0],
      reveal: 1,
      icons: [
        { ...c.icon, x: c.width / 2, y: c.height / 2, reveal: revealIcon(frame, ...mc.icon) }
      ]
    }
  ];
  const rig = p.camera[["compose", "navbar", "search"][Math.min(shot, 2)]];
  return {
    shot,
    controls,
    visible: shot === 0 ? [controls[0]] : shot === 1 ? [controls[1]] : shot === 2 ? [controls[1], controls[2]] : [],
    // Hardware, screen, controls, and their analytic checks all consume this ONE pose.
    rotation: cameraTrack(rig.rotation, frame).map((r, i) => r + p.device.poseDegrees[i] * Math.PI / 180),
    target: cameraTrack(rig.target, frame).map((v, i) => i < 2 ? v + p.camera.framing.offset[i] : v * p.camera.framing.zoom),
    focus: controls[Math.min(shot, 2)],
    logo: sample(p.timeline.logoIn) * (1 - sample(p.timeline.logoOut))
  };
}
function validateMountedControls(surface, p) {
  const frames = /* @__PURE__ */ new Set([
    0,
    p.timeline.cuts[0],
    p.timeline.cuts[1],
    ...p.motion.compose.scale.map((k) => k[0]),
    ...p.motion.compose.settle
  ]);
  for (const frame of frames) {
    const state = controlState(surface, frame, p);
    for (const c of state.visible) {
      const b = c.box, r = b.height / 2;
      for (let i = 0; i < 64; i++) {
        const a = i / 64 * Math.PI * 2;
        const x = (Math.cos(a) < 0 ? r : b.width - r) + Math.cos(a) * r - b.width / 2;
        const y = r + Math.sin(a) * r - b.height / 2;
        if (!onDisplay(
          surface,
          b.x + b.width / 2 + x * c.scale * c.stretch[0],
          b.y + b.height / 2 + y * c.scale * c.stretch[1]
        ))
          throw Error(c.id + ": control exceeds native display");
      }
      for (const icon of c.icons)
        if (icon.x - icon.size / 2 < 0 || icon.x + icon.size / 2 > b.width || icon.y - icon.size / 2 < 0 || icon.y + icon.size / 2 > b.height)
          throw Error(c.id + ": icon exceeds control bounds");
    }
    if (state.shot === 2) {
      const [a, b] = state.visible;
      if (a.box.x + a.box.width >= b.box.x)
        throw Error("Navbar overlaps search control");
    }
  }
}
function sampleState(surface, frame, config) {
  const state = controlState(surface, frame, config);
  state.focusBox = state.shot === 1 ? {
    ...state.focus.box,
    x: state.focus.box.x + config.layout.navbar.highlight.index * state.focus.box.width / config.layout.navbar.icons.length,
    width: state.focus.box.width / config.layout.navbar.icons.length
  } : state.focus.box;
  state.focusRange = config.focus.ranges[Math.min(state.shot, 2)];
  return state;
}

// src/showcase/product-screen.mjs
function screenMap(surface, ui) {
  const c = document.createElement("canvas");
  c.width = surface.width;
  c.height = Math.ceil(surface.height);
  const ctx = c.getContext("2d");
  ctx.fillStyle = ui.background;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.save();
  ctx.textBaseline = "middle";
  ui.rows.forEach(({ label, color }, i) => {
    const y = surface.height - ui.rowsBottom + i * ui.rowGap;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(ui.iconX, y, ui.iconRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i === ui.selectedRow ? ui.selectedTextColor : ui.textColor;
    ctx.font = (i === ui.selectedRow ? "600" : "500") + " " + ui.fontSize + "px " + ui.fontFamily;
    ctx.fillText(label, ui.textX, y);
  });
  ctx.restore();
  if (!ui.statusBar) return texture(c);
  ctx.save();
  ctx.fillStyle = "#c8c8ca";
  for (let i = 0; i < 4; i++) {
    round(ctx, 827 + i * 18, 114 - i * 8, 13, 14 + i * 8, 4);
    ctx.fill();
  }
  ctx.strokeStyle = "#c8c8ca";
  ctx.lineWidth = 7;
  for (const r of [10, 20, 30]) {
    ctx.beginPath();
    ctx.arc(940, 125, r, Math.PI * 1.2, Math.PI * 1.8);
    ctx.stroke();
  }
  round(ctx, 1e3, 84, 81, 36, 9);
  ctx.fill();
  round(ctx, 1085, 94, 5, 15, 2);
  ctx.fill();
  ctx.restore();
  return texture(c);
}

// src/Showcase.jsx
function Logo({ opacity, config }) {
  const { width } = useVideoConfig();
  return <div
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: width * 0.019,
      color: config.color,
      opacity,
      fontFamily: config.fontFamily,
      fontSize: width * 0.054,
      fontWeight: 500,
      letterSpacing: -width * 25e-4
    }}
  >
      {config.showMark && <svg width={width * 0.059} height={width * 0.059} viewBox="0 0 40 40">
          <rect x="5" y="5" width="30" height="30" rx="8" fill="none" stroke={config.color} strokeWidth="3" />
        </svg>}
      <span>{config.text}</span>
    </div>;
}
function DeviceUIMotion({ params, assets, render }) {
  const config = useMemo4(() => resolveParams(params), [params]);
  const { width, height } = useVideoConfig(), frame = sourceFrame(config, render);
  const pictureHeight = width / config.picture.aspect, top = (height - pictureHeight) / 2;
  const end = frame >= config.timeline.cuts[2];
  return <AbsoluteFill style={{ background: config.picture.background }}>
      <div
    style={{
      position: "absolute",
      left: 0,
      top,
      width,
      height: pictureHeight,
      overflow: "hidden",
      opacity: enter(frame, ...config.timeline.fadeIn)
    }}
  >
        <ThreeCanvas
    width={width}
    height={pictureHeight}
    flat
    shadows
    camera={{ fov: config.camera.fov, near: 0.01, far: 200 }}
    gl={{ antialias: true, alpha: false }}
  >
          {end ? <color attach="background" args={[config.picture.background]} /> : <DeviceScene
    sampleState={sampleState}
    validateState={validateMountedControls}
    makeScreen={screenMap}
    assets={assets}
    frame={frame}
    config={config}
    diagnostic={config.diagnostic}
  />}
        </ThreeCanvas>
        {end && <Logo
    config={config.endCard}
    opacity={enter(frame, ...config.timeline.logoIn) * (1 - enter(frame, ...config.timeline.logoOut))}
  />}
      </div>
    </AbsoluteFill>;
}
export {
  DeviceUIMotion as default
};
