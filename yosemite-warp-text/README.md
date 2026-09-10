# Yosemite WarpText sample

This is the editable workspace behind the
[Yosemite WarpText demo](https://cueframe.ai/demo/yosemite-warp-text.mp4). It
contains the authored WebGL component and the composition recipe; the linked
MP4 is the rendered result.

The sample demonstrates the same project model used by every CueFrame surface:

- a human can inspect and adjust the tracks, grade, trim, audio, and component;
- an agent can push the component and write the composition through the CLI,
  MCP, or REST API;
- the render is produced from that shared composition, not from a separate
  marketing mock.

## Reproduce it

Use footage you have permission to edit. The published demo uses CueFrame's
archived `Yosemite_Upper_Falls___8K_source.webm`: a 21.828-second, 7680×4320
VP9 source with stereo Opus audio. The earlier link to the National Park
Service's 2021 Yosemite stock-footage master was incorrect; that master is a
different video and is not the source of this render.

Every surface starts from the same portable [`recipe.cueframe`](./recipe.cueframe)
project in this repository.

### CLI

```bash
npx -y cueframe recipe run yosemite-warp-text \
  --media ./yosemite-upper-falls.mp4 \
  --out ./yosemite-warp-text.mp4
```

The command resolves the canonical recipe, installs its authored component,
uploads and binds your source, validates the composition, and renders it. Add
`--no-render` when you only want the editable cloud project.

### Desktop app

Download and open [`recipe.cueframe`](./recipe.cueframe). CueFrame asks you to
locate the missing source footage and opens the complete editable timeline,
including the authored WarpText component.

### MCP

Ask your CueFrame-connected agent to apply `yosemite-warp-text` from
`cueframe-ai/cueframe-recipes` to your source. The agent resolves the same
project artifact and uses CueFrame's media, component, project, validation,
preview, and render tools. It does not reconstruct the edit from prose.

The component uses WebGL2. CueFrame bakes it to an alpha layer before the final
composition render, so the output is deterministic and does not depend on a
browser preview cache.
