export function glassLayers(glass) {
  const top = glass.depth + 2 * glass.bevel;
  return {
    back: 0,
    depth: glass.depth,
    bevel: glass.bevel,
    face: top + glass.faceGap,
    selection: top + glass.faceGap + glass.selectionGap,
    icon: top + glass.faceGap + glass.selectionGap + glass.iconGap,
  };
}
