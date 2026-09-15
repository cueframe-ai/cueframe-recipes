import definition from "./schema.json" with {type: "json"};
import defaults from "./profile.json" with {type: "json"};
import { validateHighlight } from "../core/highlight.mjs";

function withDefaults(schema, value) {
  const out = {...schema};
  if (schema.type === "object") out.properties = Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => [key, withDefaults(child, value?.[key])]));
  else if (value !== undefined) out.default = value;
  return out;
}
export const propSchema = withDefaults(definition, defaults);

// Identical schema is sent to CueFrame and validated locally at the component boundary.
function decode(schema, input, path = "params") {
  const value = input === undefined ? schema.default : input;
  const fail = (message) => {
    throw new Error(path + ": " + message);
  };
  if (schema.type === "object") {
    if (
      value !== undefined &&
      (!value || typeof value !== "object" || Array.isArray(value))
    )
      fail("expected an object");
    for (const key of Object.keys(value || {}))
      if (!Object.hasOwn(schema.properties, key))
        fail("unknown property " + key);
    return Object.fromEntries(
      Object.entries(schema.properties).map(([key, def]) => [
        key,
        decode(def, value?.[key], path + "." + key),
      ]),
    );
  }
  if (schema.type === "array") {
    if (
      !Array.isArray(value) ||
      value.length < (schema.minItems || 0) ||
      value.length > (schema.maxItems ?? Infinity)
    )
      fail("invalid array length");
    return value.map((item, i) =>
      decode(schema.items, item, path + "[" + i + "]"),
    );
  }
  if (typeof value !== (schema.type === "integer" ? "number" : schema.type))
    fail("expected " + schema.type);
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      value < (schema.minimum ?? -Infinity) ||
      value > (schema.maximum ?? Infinity) ||
      (schema.type === "integer" && !Number.isInteger(value)))
  )
    fail("number outside allowed range");
  if (
    typeof value === "string" &&
    (value.length < (schema.minLength || 0) ||
      (schema.pattern && !new RegExp(schema.pattern).test(value)))
  )
    fail("invalid string");
  if (schema.enum && !schema.enum.includes(value)) fail("unsupported value");
  return value;
}
const increasing = (values, label) => {
  if (values.some((v, i) => i > 0 && v <= values[i - 1]))
    throw Error(label + ": frames must strictly increase");
};
export function resolveParams(params = {}) {
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
            "motion." + k + ".scale",
          );
        else if (name === "icons")
          value.forEach((row) => increasing(row, "motion.navbar.icons"));
        else increasing(value, "motion." + k + "." + name);
      }
    for (const name of ["rotation", "target"])
      increasing(
        p.camera[k][name].map((row) => row[0]),
        "camera." + k + "." + name,
      );
    if (p.camera[k].target.some((row) => row[3] <= 0))
      throw Error("camera target projected width must be positive");
    const box = p.layout[k];
    if (box.width < box.height || p.glass.bevel >= box.height / 2)
      throw Error(
        "Glass controls require width >= height and bevel < height/2",
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

export {glassLayers} from '../core/materials.mjs';
export function sourceFrame(p, render) {
  const offset = {
    film: 0,
    compose: 0,
    navbar: p.timeline.cuts[0],
    search: p.timeline.cuts[1],
    end: p.timeline.cuts[2],
  }[p.shot];
  return offset + p.startFrame + (render.frame * p.timeline.fps * p.timeline.speed) / render.fps;
}

/** Duration for this shot/window at the delivery FPS; speed retimes all tracks together. */
export function shotDurationFrames(p, fps = p.timeline.fps) {
  if (!Number.isFinite(fps) || fps <= 0) throw Error("fps must be positive");
  const cuts = [0, ...p.timeline.cuts];
  const i = {compose: 0, navbar: 1, search: 2, end: 3}[p.shot];
  const length = p.shot === "film" ? cuts[4] : cuts[i + 1] - cuts[i];
  if (p.startFrame >= length) throw Error("startFrame must be inside the selected shot");
  return Math.ceil((length - p.startFrame) * fps / (p.timeline.fps * p.timeline.speed));
}
