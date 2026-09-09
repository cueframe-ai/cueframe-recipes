# CueFrame recipes

Real, editable video projects that show what CueFrame is best at. Each recipe
starts with real source material, includes the composition or component source,
and explains the editorial decisions behind the finished render.

## Start with a finished use case

| Use case | What you learn | Recipe |
| --- | --- | --- |
| Custom motion graphics | Author a reusable component, layer it over real footage, preserve source ambience, and render the shared composition | [Yosemite WarpText](./yosemite-warp-text) |
| Subject-aware typography | Place editable type behind a real speaker while keeping captions, grade, and audio independent | [Yosemite Peregrines](./yosemite-peregrines) |

## Recipes we are building next

- Product demo from a real screen recording, with click-driven punch-ins.
- Talking-head clip with active-speaker reframing and word-timed captions.
- Podcast-to-social cutdown in 9:16.
- Branded launch video with a real product capture.
- One master edit derived into 16:9, 1:1, 4:5, and 9:16.

These are use-case recipes, not flattened templates. Replace the source media,
change the editable composition, and use the same project from the desktop app,
MCP, REST API, or CLI.

## Run a recipe

In the CueFrame app, upload the recipe's source, open a project, and ask the
Director to apply the recipe by its directory name. It fetches the canonical
composition and component source from this repository, maps project-specific
IDs, validates the result, and checks the saved structure before previewing.

Or install the CueFrame CLI, open a recipe directory, and follow its README:

```bash
npx -y cueframe --help
```

Every recipe documents its source attribution. Source masters are excluded;
bring media you have permission to edit.

## Contributing

A useful recipe proves one recognizable job end to end. Include:

- the use case and who it is for;
- a composition template with replaceable media IDs;
- source attribution and reproduction steps;
- a review rubric with named timestamps and kill criteria; and
- a link to the finished render.

Recipes are licensed under [AGPL-3.0-only](./LICENSE).
