// Shared by the renderer and validator. No DOM, network, Three.js, or Node APIs.
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, n) => a.map((v) => v * n);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a) => Math.sqrt(dot(a, a));
export function requireValue(ok, message) {
  if (!ok) throw new Error(message);
}
export function finiteVector(v, size, label) {
  requireValue(
    Array.isArray(v) && v.length === size && v.every(Number.isFinite),
    label + " must contain " + size + " finite numbers",
  );
  return v;
}
export function meshBounds(mesh) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  mesh.positions.forEach((v, i) => {
    min[i % 3] = Math.min(min[i % 3], v);
    max[i % 3] = Math.max(max[i % 3], v);
  });
  return { min, max, size: sub(max, min), center: mul(add(min, max), 0.5) };
}
export function parseModel(raw) {
  let text = raw.trim();
  if (text.startsWith("<")) {
    const match = text.match(
      /<metadata\s+id="mesh-data">([\s\S]*?)<\/metadata>/,
    );
    requireValue(
      match,
      "Only JSON or the legacy SVG mesh-data envelope is supported; convert GLB/USD with a format-aware importer",
    );
    text = match[1];
  }
  let model;
  try {
    model = JSON.parse(text);
  } catch {
    throw new Error(
      "Invalid mesh JSON; GLB/USD/OBJ are not supported directly",
    );
  }
  validateModel(model);
  return model;
}
export function validateModel(model) {
  requireValue(
    model && Array.isArray(model.meshes) && model.meshes.length > 0,
    "model.meshes must be nonempty",
  );
  requireValue(
    typeof model.units === "string" && model.units.length > 0,
    "Declare model.units",
  );
  const names = new Set();
  for (const mesh of model.meshes) {
    requireValue(
      typeof mesh.name === "string" && mesh.name && !names.has(mesh.name),
      "Mesh names must be nonempty and unique",
    );
    names.add(mesh.name);
    requireValue(
      Array.isArray(mesh.positions) &&
        mesh.positions.length >= 9 &&
        mesh.positions.length % 3 === 0 &&
        mesh.positions.every(Number.isFinite),
      mesh.name + ": invalid positions",
    );
    requireValue(
      Array.isArray(mesh.indices) &&
        mesh.indices.length >= 3 &&
        mesh.indices.length % 3 === 0 &&
        mesh.indices.every(
          (i) => Number.isInteger(i) && i >= 0 && i < mesh.positions.length / 3,
        ),
      mesh.name + ": invalid triangle indices",
    );
    for (const [key, stride] of [
      ["uv", 2],
      ["normals", 3],
    ]) {
      if (mesh[key] !== undefined)
        requireValue(
          Array.isArray(mesh[key]) &&
            mesh[key].length === (mesh.positions.length / 3) * stride &&
            mesh[key].every(Number.isFinite),
          mesh.name + ": invalid " + key,
        );
    }
    requireValue(
      mesh.matrix === undefined &&
        mesh.transform === undefined &&
        mesh.children === undefined,
      "Unbaked transforms/hierarchy: flatten with a format-aware importer first",
    );
  }
}
export function normalizeModel(model, adapter) {
  validateModel(model);
  requireValue(
    adapter &&
      (model.coordinateSpace === "baked" || adapter.confirmBaked === true),
    "Confirm all mesh positions share a baked model coordinate space",
  );
  const right = finiteVector(adapter.right, 3, "adapter.right");
  const up = finiteVector(adapter.up, 3, "adapter.up");
  const normal = finiteVector(adapter.normal, 3, "adapter.normal");
  requireValue(
    [right, up, normal].every((v) => Math.abs(length(v) - 1) < 1e-6) &&
      Math.abs(dot(right, up)) < 1e-6 &&
      length(sub(cross(right, up), normal)) < 1e-6,
    "Adapter basis must be orthonormal and right-handed",
  );
  requireValue(
    model.meshes.some((m) => m.name === adapter.displayMesh),
    "Named display mesh not found",
  );
  const project = (p) => [dot(p, right), dot(p, up), dot(p, normal)];
  const meshes = model.meshes.map((mesh) => {
    const positions = [],
      normals = mesh.normals ? [] : undefined;
    for (let i = 0; i < mesh.positions.length; i += 3)
      positions.push(...project(mesh.positions.slice(i, i + 3)));
    if (normals)
      for (let i = 0; i < mesh.normals.length; i += 3)
        normals.push(
          ...mul(
            project(mesh.normals.slice(i, i + 3)),
            adapter.flipWinding ? -1 : 1,
          ),
        );
    const indices = [...mesh.indices];
    if (adapter.flipWinding)
      for (let i = 0; i < indices.length; i += 3)
        [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    return { ...mesh, positions, indices, ...(normals ? { normals } : {}) };
  });
  return { ...model, coordinateSpace: "baked", meshes };
}
export function displaySurface(
  model,
  displayMesh,
  pixelWidth = 1200,
  clearancePixels = 2,
) {
  requireValue(
    Number.isFinite(pixelWidth) && pixelWidth > 0,
    "pixelWidth must be positive",
  );
  requireValue(
    Number.isFinite(clearancePixels) && clearancePixels > 0,
    "clearancePixels must be positive",
  );
  const mesh = model.meshes.find((m) => m.name === displayMesh);
  requireValue(mesh, "Display mesh missing");
  const bounds = meshBounds(mesh),
    [w, h, d] = bounds.size;
  requireValue(
    w > 0 && h > 0 && d <= Math.max(w, h) * 1e-6,
    "Display must be planar in the adapter basis; curved screens need a custom surface adapter",
  );
  let area = 0;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const p = mesh.indices
      .slice(i, i + 3)
      .map((n) => mesh.positions.slice(n * 3, n * 3 + 3));
    area += cross(sub(p[1], p[0]), sub(p[2], p[0]))[2] / 2;
  }
  requireValue(
    area > w * h * 1e-8,
    "Display triangle winding faces away from +normal or has zero area; inspect conversion before using flipWinding",
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
      bounds.max[2] + clearancePixels * unit,
    ],
  };
}
export function onDisplay(surface, x, y) {
  const p = [
    surface.origin[0] + (x - surface.width / 2) * surface.unit,
    surface.origin[1] + (surface.height / 2 - y) * surface.unit,
  ];
  const mesh = surface.mesh;
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const v = mesh.indices
      .slice(i, i + 3)
      .map((k) => mesh.positions.slice(k * 3, k * 3 + 2));
    const area =
      (v[1][0] - v[0][0]) * (v[2][1] - v[0][1]) -
      (v[1][1] - v[0][1]) * (v[2][0] - v[0][0]);
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
export function centerIn(box, width, height, z = 0) {
  return [
    box.x + box.width / 2 - width / 2,
    height / 2 - box.y - box.height / 2,
    z,
  ];
}
export function makeLayout(surface, config) {
  requireValue(
    Array.isArray(config.rows) && config.rows.length > 0,
    "Provide at least one row with title and body",
  );
  const style = {
    inset: 48,
    top: 360,
    rowHeight: 220,
    gap: 28,
    padding: 28,
    titleHeight: 56,
    bodyHeight: 72,
    radius: 36,
    depth: 1,
    contentZ: 1,
    outlineZ: 1.1,
    ...config.layout,
  };
  for (const [key, value] of Object.entries(style))
    requireValue(Number.isFinite(value) && value >= 0, "Invalid layout." + key);
  requireValue(
    style.contentZ > style.depth / 2 && style.outlineZ > style.depth / 2,
    "Content and outline must be above panel face",
  );
  const width = surface.width - 2 * style.inset;
  requireValue(
    width > 0 &&
      style.rowHeight > 0 &&
      style.radius <= Math.min(width, style.rowHeight) / 2,
    "Invalid row dimensions/radius",
  );
  const rows = config.rows.map((content, i) => {
    requireValue(
      typeof content.title === "string" && typeof content.body === "string",
      "Each row needs string title/body",
    );
    const box = {
      x: style.inset,
      y: style.top + i * (style.rowHeight + style.gap),
      width,
      height: style.rowHeight,
    };
    const children = [
      {
        id: "title",
        text: content.title,
        x: style.padding,
        y: style.padding,
        width: width - 2 * style.padding,
        height: style.titleHeight,
      },
      {
        id: "body",
        text: content.body,
        x: style.padding,
        y: style.padding + style.titleHeight + 12,
        width: width - 2 * style.padding,
        height: style.bodyHeight,
      },
    ];
    for (const c of children)
      requireValue(
        c.width > 0 &&
          c.height > 0 &&
          c.x >= 0 &&
          c.y >= 0 &&
          c.x + c.width <= width &&
          c.y + c.height <= box.height,
        "Text box does not fit row " + i,
      );
    requireValue(
      box.y + box.height <= surface.height,
      "Rows exceed display height; reduce row count/size or implement a viewport",
    );
    return { id: String(i), box, children };
  });
  const header = {
    x: style.inset,
    y: config.headerTop ?? 230,
    width,
    height: 64,
  };
  requireValue(
    Number.isFinite(header.y) &&
      header.y >= 0 &&
      header.y + header.height <= style.top,
    "Header overlaps rows or exceeds screen",
  );
  return { style, rows, header };
}
export function sampleKeys(keys, frame, size, fallback) {
  if (keys === undefined) return fallback;
  requireValue(
    Array.isArray(keys) && keys.length > 0,
    "Keyframes must be nonempty",
  );
  keys.forEach((k, i) => {
    finiteVector(k.value, size, "key.value");
    requireValue(
      Number.isFinite(k.frame) && (i === 0 || k.frame > keys[i - 1].frame),
      "Keyframe times must strictly increase",
    );
  });
  if (frame <= keys[0].frame) return keys[0].value;
  if (frame >= keys[keys.length - 1].frame) return keys[keys.length - 1].value;
  let i = 0;
  while (frame > keys[i + 1].frame) i++;
  const a = keys[i],
    b = keys[i + 1],
    u = (frame - a.frame) / (b.frame - a.frame),
    t = u * u * (3 - 2 * u);
  return a.value.map((v, j) => v + (b.value[j] - v) * t);
}
export function layerMotion(config, index, frame) {
  const motion = (config.motion || {})[index];
  if (frame < 0 || !motion)
    return { position: [0, 0, 0], rotation: [0, 0, 0], roll: 0 };
  return {
    position: sampleKeys(motion.position, frame, 3, [0, 0, 0]),
    rotation: sampleKeys(motion.pitchYaw, frame, 2, [0, 0]).concat(0),
    roll: sampleKeys(motion.roll, frame, 1, [0])[0],
  };
}
// Same order as Three Euler XYZ, followed by a separate parent Z roll.
export function rotate(v, [x, y, z]) {
  let [a, b, c] = v;
  [a, b] = [
    a * Math.cos(z) - b * Math.sin(z),
    a * Math.sin(z) + b * Math.cos(z),
  ];
  [a, c] = [
    a * Math.cos(y) + c * Math.sin(y),
    -a * Math.sin(y) + c * Math.cos(y),
  ];
  [b, c] = [
    b * Math.cos(x) - c * Math.sin(x),
    b * Math.sin(x) + c * Math.cos(x),
  ];
  return [a, b, c];
}
export function rowFrame(row, layout, surface, config, index, frame) {
  const motion = layerMotion(config, index, frame),
    anchor = centerIn(row.box, surface.width, surface.height);
  const transform = (v) =>
    rotate(rotate(v, motion.rotation), [0, 0, motion.roll]);
  const center = add(anchor, motion.position);
  const bottom = -layout.style.depth / 2,
    top = Math.max(
      layout.style.depth / 2,
      layout.style.contentZ,
      layout.style.outlineZ,
    );
  const half = [row.box.width / 2, row.box.height / 2, (top - bottom) / 2];
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map(transform);
  const envelopeCenter = add(center, transform([0, 0, (top + bottom) / 2]));
  const corners = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1])
        corners.push(
          add(
            envelopeCenter,
            transform([x * half[0], y * half[1], z * half[2]]),
          ),
        );
  return {
    anchor,
    motion,
    transform,
    center,
    envelopeCenter,
    half,
    axes,
    corners,
    children: row.children.map((c) => ({
      id: c.id,
      position: add(
        center,
        transform(
          centerIn(c, row.box.width, row.box.height, layout.style.contentZ),
        ),
      ),
    })),
  };
}
export function boxesOverlap(a, b) {
  const candidates = [
    ...a.axes,
    ...b.axes,
    ...a.axes.flatMap((x) => b.axes.map((y) => cross(x, y))),
  ];
  for (let axis of candidates) {
    const n = length(axis);
    if (n < 1e-9) continue;
    axis = mul(axis, 1 / n);
    const radius = (c) =>
      c.axes.reduce((s, v, i) => s + c.half[i] * Math.abs(dot(v, axis)), 0);
    if (
      Math.abs(dot(sub(a.envelopeCenter, b.envelopeCenter), axis)) >
      radius(a) + radius(b) + 1e-8
    )
      return false;
  }
  return true;
}
export function prepareScene(model, config) {
  const normalized = normalizeModel(model, config.adapter);
  const surface = displaySurface(
    normalized,
    config.adapter.displayMesh,
    config.pixelWidth ?? 1200,
    config.clearancePixels ?? 2,
  );
  const layout = makeLayout(surface, config);
  return { model: normalized, surface, layout };
}
