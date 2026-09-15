// Native display-pixel outline, shared by rendering and bounds tests.
export function highlightLayout(width, height, count, config) {
  if (
    !Number.isInteger(config.index) ||
    config.index < 0 ||
    config.index >= count
  )
    throw Error("Navbar highlight index must identify an existing icon");
  const cell = width / count;
  const w = cell - 2 * config.insetX,
    h = height - 2 * config.insetY;
  if (w <= 0 || h <= 0) throw Error("Navbar highlight insets leave no area");
  return {
    width: w,
    height: h,
    x: -width / 2 + cell * (config.index + 0.5),
    y: 0,
    radius:
      config.shape === "capsule"
        ? Math.min(w, h) / 2
        : Math.min(config.cornerRadius, w / 2, h / 2),
  };
}

export function highlightOutline(box, shape) {
  const { width: w, height: h, radius: r } = box;
  if (shape === "ellipse")
    return Array.from({ length: 64 }, (_, i) => [
      (Math.cos((i * Math.PI) / 32) * w) / 2,
      (Math.sin((i * Math.PI) / 32) * h) / 2,
    ]);
  // Independent circular corners joined by straight edges, never an ellipse scaled into a pill.
  return [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, Math.PI * 1.5],
  ].flatMap(([x, y, start]) =>
    Array.from({ length: 17 }, (_, i) => [
      x + r * Math.cos(start + (i * Math.PI) / 32),
      y + r * Math.sin(start + (i * Math.PI) / 32),
    ]),
  );
}

export function validateHighlight(width, height, count, config) {
  const box = highlightLayout(width, height, count, config);
  const capCenter = (width - height) / 2,
    radius = height / 2;
  for (const [px, py] of highlightOutline(box, config.shape)) {
    const x = px + box.x,
      nearest = Math.max(-capCenter, Math.min(capCenter, x));
    if (Math.hypot(x - nearest, py) > radius + 1e-6)
      throw Error(
        "Navbar highlight extends beyond the glass face; increase insets or corner radius",
      );
  }
  return box;
}
