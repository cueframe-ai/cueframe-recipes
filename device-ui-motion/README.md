# Device UI Motion

A 15.17-second editable glass-UI showcase: compose button, navbar selection, search,
and end card. This is a **recipe with an owned component**, not a built-in primitive.
Supply a baked phone mesh and adapt the unbranded product UI to your product.

## Package boundaries

```text
src/core/       model normalization, screen coordinates, interpolation, glass layers
src/render/     device scene, glass controls/shader, textures; no showcase imports
src/showcase/   product UI, compose/navbar/search choreography, profile and schema
src/Showcase.jsx                 recipe-specific sequence and end card
cueframe/components/device-ui-motion/  generated portable source + config + schema
composition.template.json       composition with one required model media slot
recipe.cueframe                 v4 project with pinned editable component source
```

The renderer receives sampled state and a screen painter from the showcase. It does
not own the compose/navbar/search sequence or its timing. These local modules are
not a new core library API; generalize them only when another recipe needs them.

## Inputs and provenance

Bring an SVG containing baked mesh JSON in `<metadata id="mesh-data">`. The payload
declares `units`, `coordinateSpace: "baked"`, and meshes with `name`, `positions`,
and triangle `indices`. The `display` mesh must be planar. Configure matching
`device.right`, `up`, `normal`, `displayMesh`, and native display dimensions in the
profile. Raw GLB/USD files and screenshots of hardware are not model substitutes.

The optional `screen` asset is a native portrait app screenshot without hardware.
Set `screen.source: "asset"` and bind it explicitly; otherwise the recipe draws the
editable unbranded product UI from `screen.rows`. A missing required asset fails;
there is no automatic placeholder fallback. No third-party model, reference
footage, soundtrack, or product branding is distributed with this recipe.

The motion is based on the earlier device-UI reference exercise. The exact external
references are not dependencies and their footage is not redistributed. The icon
entrance uses cubic-bezier(0.23, 1, 0.32, 1); the camera tracks are frame-driven,
bounded cubic interpolation. The runtime owns depth of field and postprocessing.

## Use from desktop, CLI, or MCP

- Desktop: open `recipe.cueframe`, relink the required model slot, then preview.
  The project includes the component's immutable source version, not a baked video.
- CLI: after checkout, run `cueframe recipe run ./device-ui-motion/recipe.cueframe
  --media ./device.svg --no-render --json`. After publication the slug `device-ui-motion` resolves
  the same top-level path. Use the project artifact, not directory mode: directory
  mode does not install authored components. Recipe runs render by default; keep
  `--no-render` while iterating and omit it only for final delivery.
- MCP: load the recipe, register the model in the target project, install the
  generated `index.tsx` with the manifest from `cueframe.json` and `schema.json` as
  `propSchema`, and bind the returned media ID to `source.assets.model` in the
  composition template. Validate before applying. For an existing owned component,
  update the same ID; preview before saving the revised composition.

Do not put `modelSrc` or `screenSrc` into component params: assets use the contract-v2
`assets` bag. Do not look for this recipe in the built-in primitive catalog.

## Edit and reproduce

Using the checked-in `recipe.cueframe` does not require rebuilding this package.
The development dependencies and new packaging command below are needed only
when regenerating its source/project artifacts.

Change `src/showcase/profile.json` for the sequence, camera tracks, product rows,
glass look, end-card copy and defaults. Change `src/showcase/choreography.mjs` for
new behavior. Runtime params override the profile: `device.poseDegrees`,
`camera.framing`, `layout.navbar.highlight.index`, `glass` and `timeline.speed`.
Partial objects merge; arrays replace. Update the composition duration when retiming.

The recipe installs only `esbuild`. A CueFrame CLI with `recipe pack` must also
be available on PATH. Packaging is local and requires no login or private npm
credentials: the CLI validates imports/manifests and composition, computes the
canonical source versions, and writes the pinned project. It does not execute
the component or render a video.

**Release prerequisite:** `recipe pack` is being introduced alongside this
recipe. Until that CLI release is published, use the built CLI executable via
`CUEFRAME_CLI=/absolute/path/to/dist/cueframe.js`. This selects an executable;
the recipe does not import a CueFrame checkout or resolve its dependencies.

From the repository root:

```sh
cd device-ui-motion
npm install
cd ..
node device-ui-motion/build-project-template.mjs
node device-ui-motion/build-project-template.mjs --check
node --test device-ui-motion/tests/*.test.mjs
node tools/validate-recipes.mjs
```

The builder bundles owned source and leaves package imports external; the CLI
enforces the runtime import policy. `--check` verifies all generated outputs
without writing them. Commit the resulting `recipe.cueframe` and generated
component files so consumers never need authoring dependencies to use the recipe.

The rendering runtime must expose `FrameDepthOfField`; an older deployed
runtime lacking that helper cannot render this recipe. Do not patch or privately
bundle postprocessing to get around that requirement.

Browser and pixel-parity coverage lives with CueFrame's private component runtime,
where the staged browser and rendering harness are available. It is intentionally
not a dependency or test command of this public recipe package.

Inspect a scoped navbar preview using `shot: "navbar"` before rendering the full
15.17-second film. Camera, screen, glass and icons must share the same device transform.
See [rubric.md](./rubric.md) for the visual gate. A hosted demonstration video/poster
has **not** been published for this unbranded package. It belongs in the repository's
`draft-recipes.json` lifecycle list, not the public `recipes.json` catalog. Published landing
entries require a real render and poster; no placeholder URL should be invented.
