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

Use footage you have permission to edit. The published demo uses the National
Park Service's [Yosemite Stock Footage (2021)][nps], which NPS identifies as
public domain.

```bash
cd cueframe-recipes/yosemite-warp-text

# Register the local component with your CueFrame account.
npx -y cueframe push yosemite-warp-title

# Upload your downloaded source and retain the mediaItemId from the JSON output.
npx -y cueframe upload ./yosemite-upper-falls.mp4 --json

# Put that id into composition.json without modifying the tracked template.
cp composition.template.json composition.json
# Replace REPLACE_WITH_MEDIA_ID in composition.json with the returned id.

# Create the shared project, save the recipe, then render it.
npx -y cueframe project create -n "Yosemite WarpText" -a 16:9 --json
npx -y cueframe composition put <projectId> -b @composition.json --force
npx -y cueframe render <projectId> -o yosemite-warp-text.mp4 --json
```

The component uses WebGL2. CueFrame bakes it to an alpha layer before the final
composition render, so the output is deterministic and does not depend on a
browser preview cache.

## App, CLI, and MCP workflow

- **The app can reproduce the recipe for you.** Upload the source, open a new
  project, then ask the Director: `Apply the yosemite-warp-text recipe from
  cueframe-ai/cueframe-recipes using my uploaded Yosemite source.` The Director
  loads the composition and exact component source from GitHub, maps the media
  placeholder, validates the result, and previews the saved project.
- **CLI reproduces it explicitly.** The commands above register the component,
  upload and map the footage, then persist the recipe and render the same
  composition the app opens.
- **MCP gives an external agent the same controls.** Connect the CueFrame MCP
  server, have the agent read this GitHub recipe, then use `create_component`,
  `validate_composition`, `apply_composition`, and `preview_frame` without
  translating the recipe into a different format.

[nps]: https://www.nps.gov/media/video/view.htm?id=A45A7B7C-295C-4718-B5FA-FE30882C291F
