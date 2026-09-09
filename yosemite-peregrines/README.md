# Yosemite Peregrines subject-aware title sample

This editable sample turns one continuous Yosemite ranger clip into a cinematic
talking-head beat. `PHENOMENAL` expands across the portrait as the ranger says
the word, and CueFrame's subject matte lets his silhouette pass through its
middle without hiding the word's identifying edges. The original spoken audio
remains intact.

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
# Replace REPLACE_WITH_MEDIA_ID in composition.json.

npx -y cueframe project create -n "Yosemite Peregrines" -a 16:9 \
  --brand-kit <brandKitId> --json
npx -y cueframe composition put <projectId> -b @composition.json --force

# Validate the authored body before export.
npx -y cueframe composition validate -b @composition.json
npx -y cueframe render <projectId> -o yosemite-peregrines.mp4 --json
```

The title is one wide layer rather than two short words parked against the
speaker. Its first and last letters remain in open space while the silhouette
bites into the middle. There is no border, title plate, duplicated cutout, or
pre-rendered title baked into the source.

The tracked recipe binds title color and type to `$brand:` tokens. The project
brand kit also supplies the official CueFrame mark and caption profile, so the
logo, titles, and captions are themed at render time rather than copied into
the composition as unrelated literals.

## Quality bar

[`rubric.md`](./rubric.md) records the sampled beats and kill criteria used for
the published render. Treat it as an editable review contract, not marketing
copy: preview the named frames, watch the motion window with audio, and do not
accept a final render below the stated threshold.

## Source and reuse

Source: National Park Service, Yosemite National Park,
[“Peregrine Falcons in Yosemite”][source]. Preserve the source credit and verify
the publisher's current reuse guidance for your intended distribution. This
repository distributes only the CueFrame recipe and its own rendered demo, not
the source master.

[source]: https://www.nps.gov/media/video/view.htm?id=53135a56-4998-4d6e-b26d-24fe0acca1c3
