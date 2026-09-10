# Yosemite Peregrines subject-aware title sample

This editable sample turns one continuous Yosemite ranger clip into a cinematic
talking-head beat. `PHENOMENAL` spans most of the frame as the ranger says the
word, while CueFrame's subject matte keeps his face and shoulders cleanly in
front. The original spoken audio remains intact.

[Watch the finished CueFrame render](https://cueframe.ai/demo/yosemite-peregrines-phenomenal.mp4).

It exercises the same shared project from both sides:

- a person can adjust the trim, captions, grade, and title regions in the app;
- an agent can inspect and patch those same tracks through MCP, the API, or CLI;
- previews, quality scoring, and export all resolve from that one composition.

## Reproduce it

The source video is not copied into this repository. Obtain the official
National Park Service source through a method its publisher permits. The recipe
uses source time `83.616-93.359` seconds.

Use the CueFrame surface you already work in. Every path starts from the same
[`recipe.cueframe`](./recipe.cueframe) project template in this repository.

### CLI

```bash
npx -y cueframe recipe run yosemite-peregrines \
  --media ./yosemite-peregrines.mp4 \
  --out ./yosemite-peregrines-render.mp4
```

This downloads the canonical project template from `cueframe-recipes`, uploads
the source, creates the editable cloud project, validates it, and renders the
MP4. Add `--no-render` when you only want the editable project.

### Desktop app

Download and open [`recipe.cueframe`](./recipe.cueframe). CueFrame asks you to
locate the missing source footage, then opens the same editable composition,
captions, title, and brand settings shown in the finished render.

The project file includes CueFrame's prepared packed matte for this exact trim,
so the source video is the only additional file you need to choose. The small
derived matte contains transparency data, not a second copy of the footage.

### MCP

Give your CueFrame-connected agent the recipe slug and source, then ask:

> Apply `yosemite-peregrines` from `cueframe-ai/cueframe-recipes` to my source.
> Keep the project editable and render it after previewing the subject-aware
> title.

The agent resolves the same `recipe.cueframe` artifact and uses the normal media,
project, validation, preview, and render tools. It does not reconstruct the
composition from prose.

The title is a `heroText` overlay on the `behind-subject` depth plane. One video
clip carries the complete `83.616-93.359` source window; the renderer binds the
`84.816-87.566` matte window to that clip without cutting the take. Picture,
speech, grade, and reframe therefore keep one continuous decode timeline across
the title entrance and exit. There is no title plate, duplicated cutout,
pre-rendered title, media-keyed clip id, or split-clip workaround.

The project brand kit supplies the official CueFrame mark and caption profile.
The title binds its ink and Instrument Serif face through `$brand:` tokens, so
logo, title, and captions all follow the project kit at render time.

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
