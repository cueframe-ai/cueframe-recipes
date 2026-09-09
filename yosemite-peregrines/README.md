# Yosemite Peregrines subject-aware title sample

This editable sample turns one continuous Yosemite ranger clip into a cinematic
talking-head beat. `PHENOMENAL` spans most of the frame as the ranger says the
word, while CueFrame's subject matte keeps his face and shoulders cleanly in
front. The original spoken audio remains intact.

[Watch the finished CueFrame render](https://cueframe.ai/demo/yosemite-peregrines.mp4).

It exercises the same shared project from both sides:

- a person can adjust the trim, captions, grade, and title regions in the app;
- an agent can inspect and patch those same tracks through MCP, the API, or CLI;
- previews, quality scoring, and export all resolve from that one composition.

## Reproduce it

The source video is not copied into this repository. Obtain the official
National Park Service source through a method its publisher permits, then upload
the full-resolution file. The recipe uses source time `83.616-93.359` seconds.

```bash
cd cueframe-recipes/yosemite-peregrines

# Upload the full 1920x1080 source and retain mediaItemId from the JSON output.
npx -y cueframe upload ./yosemite-peregrines.mp4 --json

# Create the sample brand kit through the typed API surface and retain its id.
npx -y cueframe api POST /v1/brand-kits -b @brand-kit.json --json

# Keep the tracked recipe clean while inserting your returned media id.
cp composition.template.json composition.json
# Replace the single REPLACE_WITH_MEDIA_ID value in composition.json.

npx -y cueframe project create -n "Yosemite Peregrines" -a 16:9 \
  --brand-kit <brandKitId> --json

# Validate the authored body before export.
npx -y cueframe composition validate -b @composition.json
npx -y cueframe composition put <projectId> -b @composition.json --force
npx -y cueframe render <projectId> -o yosemite-peregrines.mp4 --json
```

The title is a `heroText` overlay on the `behind-subject` depth plane. One video
clip carries the complete `83.616-93.359` source window; the renderer binds the
`84.816-87.566` matte window to that clip without cutting the take. Picture,
speech, grade, and reframe therefore keep one continuous decode timeline across
the title entrance and exit. There is no title plate, duplicated cutout,
pre-rendered title, media-keyed clip id, or split-clip workaround.

The project brand kit supplies the official CueFrame mark and caption profile.
The title binds its ink and Instrument Serif face through `$brand:` tokens, so
logo, title, and captions all follow the project kit at render time.

## App, CLI, and MCP workflow

- **The app can reproduce the recipe for you.** Upload the source, open a new
  project, then ask the Director: `Apply the yosemite-peregrines recipe from
  cueframe-ai/cueframe-recipes using my uploaded Yosemite source.` The Director
  loads the canonical GitHub composition, maps the media placeholder, validates
  it, and compares the saved project to the recipe before previewing it.
- **CLI creates the exact base.** Upload the source, replace the media-id
  placeholder, validate the JSON, and put it on the new project with the
  commands above.
- **MCP prepares and verifies depth.** Ask an MCP-connected agent to prepare a
  `matte` for source window `84.816-87.566`, poll `get_media_facts` until the
  exact result is `ready`, then use `preview_frame` on the persisted composition.
  The agent can patch the same clips with `apply_composition`, score the result,
  and call `create_render` only after review.

## Quality bar

[`rubric.md`](./rubric.md) records the sampled beats and kill criteria for the
refreshed render. Treat it as an editable review contract, not marketing copy:
preview the named frames, watch the motion window with audio, and do not publish
a final render below the stated threshold.

## Source and reuse

Source: National Park Service, Yosemite National Park,
[“Peregrine Falcons in Yosemite”][source]. Preserve the source credit and verify
the publisher's current reuse guidance for your intended distribution. This
repository distributes only the CueFrame recipe and links to the finished demo;
it does not distribute the source master.

[source]: https://www.nps.gov/media/video/view.htm?id=53135a56-4998-4d6e-b26d-24fe0acca1c3
