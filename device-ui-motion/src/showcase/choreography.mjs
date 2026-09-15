import {onDisplay} from '../core/device-core.mjs';
import {enter, revealIcon, measuredTrack, cameraTrack} from '../core/motion.mjs';
export function controlState(surface, frame, p) {
  const shot =
    frame < p.timeline.cuts[0]
      ? 0
      : frame < p.timeline.cuts[1]
        ? 1
        : frame < p.timeline.cuts[2]
          ? 2
          : 3;
  const h = surface.height,
    { compose: a, navbar: b, search: c } = p.layout;
  const { compose: ma, navbar: mb, search: mc } = p.motion;
  const sample = (window) => enter(frame, ...window),
    form = (initial, window) => initial + (1 - initial) * sample(window);
  const barWidth = shot === 2 ? b.compactWidth : b.width;
  const controls = [
    {
      id: "compose",
      box: { x: a.x, y: a.y, width: a.width, height: a.height },
      z: a.z,
      scale: measuredTrack(ma.scale, frame)[0],
      stretch: [
        1 + ma.stretch * (1 - sample(ma.settle)),
        1 - ma.stretch * (1 - sample(ma.settle)),
      ],
      thickness: sample(ma.formation),
      frost: sample(ma.frost),
      rotation: [0, 0, 0],
      reveal: sample(ma.reveal),
      icons: [
        { ...a.icon, x: a.width / 2, y: a.height / 2, reveal: revealIcon(frame, ...ma.icon) },
      ],
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
        x: (barWidth * (i + 0.5)) / b.icons.length,
        y: b.height / 2,
        selected: i === b.highlight.index,
        // The selected tab is legible on the selection beat, irrespective of slot.
        reveal: shot === 2 ? 1 : revealIcon(frame, ...(i === b.highlight.index ? mb.selection : mb.icons[i])),
      })),
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
        { ...c.icon, x: c.width / 2, y: c.height / 2, reveal: revealIcon(frame, ...mc.icon) },
      ],
    },
  ];
  const rig = p.camera[["compose", "navbar", "search"][Math.min(shot, 2)]];
  return {
    shot,
    controls,
    visible:
      shot === 0
        ? [controls[0]]
        : shot === 1
          ? [controls[1]]
          : shot === 2
            ? [controls[1], controls[2]]
            : [],
    // Hardware, screen, controls, and their analytic checks all consume this ONE pose.
    rotation: cameraTrack(rig.rotation, frame).map((r, i) => r + p.device.poseDegrees[i] * Math.PI / 180),
    target: cameraTrack(rig.target, frame).map((v, i) =>
      i < 2 ? v + p.camera.framing.offset[i] : v * p.camera.framing.zoom),
    focus: controls[Math.min(shot, 2)],
    logo: sample(p.timeline.logoIn) * (1 - sample(p.timeline.logoOut)),
  };
}
export function validateMountedControls(surface, p) {
  // Validate static footprints plus all scale/settle landmarks. Arbitrary camera poses
  // don't change native display containment because all controls share its axes.
  const frames = new Set([
    0,
    p.timeline.cuts[0],
    p.timeline.cuts[1],
    ...p.motion.compose.scale.map((k) => k[0]),
    ...p.motion.compose.settle,
  ]);
  for (const frame of frames) {
    const state = controlState(surface, frame, p);
    for (const c of state.visible) {
      const b = c.box,
        r = b.height / 2;
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const x =
          (Math.cos(a) < 0 ? r : b.width - r) + Math.cos(a) * r - b.width / 2;
        const y = r + Math.sin(a) * r - b.height / 2;
        if (
          !onDisplay(
            surface,
            b.x + b.width / 2 + x * c.scale * c.stretch[0],
            b.y + b.height / 2 + y * c.scale * c.stretch[1],
          )
        )
          throw Error(c.id + ": control exceeds native display");
      }
      for (const icon of c.icons)
        if (
          icon.x - icon.size / 2 < 0 ||
          icon.x + icon.size / 2 > b.width ||
          icon.y - icon.size / 2 < 0 ||
          icon.y + icon.size / 2 > b.height
        )
          throw Error(c.id + ": icon exceeds control bounds");
    }
    if (state.shot === 2) {
      const [a, b] = state.visible;
      if (a.box.x + a.box.width >= b.box.x)
        throw Error("Navbar overlaps search control");
    }
  }
}

export function sampleState(surface, frame, config) {
  const state = controlState(surface, frame, config);
  state.focusBox = state.shot === 1 ? {
    ...state.focus.box,
    x: state.focus.box.x + config.layout.navbar.highlight.index * state.focus.box.width / config.layout.navbar.icons.length,
    width: state.focus.box.width / config.layout.navbar.icons.length,
  } : state.focus.box;
  state.focusRange = config.focus.ranges[Math.min(state.shot, 2)];
  return state;
}
