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

These are use-case recipes, not flattened templates. Each recipe publishes a
portable `recipe.cueframe` project with named media slots. Replace the source
media, change the editable composition, and use that same project from the
desktop app, MCP, REST API, or CLI.

## Run a recipe

Open a recipe's `recipe.cueframe` file in the desktop app and locate its source
media when prompted, or run it by slug from the CLI:

```bash
npx -y cueframe recipe run yosemite-peregrines --media ./source.mp4
```

An MCP-connected agent resolves the same slug from this repository and applies
the same project artifact. Recipe definitions do not live in the app, CLI, MCP
server, or landing site.

Every recipe documents its source attribution. Source masters are excluded;
bring media you have permission to edit.

Validate the catalog, portable projects, canonical URLs, and media slots with:

```bash
node validate-recipes.mjs
```

## Contributing

A useful recipe proves one recognizable job end to end. Include:

- the use case and who it is for;
- a composition template with replaceable media IDs;
- source attribution and reproduction steps;
- a review rubric with named timestamps and kill criteria; and
- a link to the finished render.

Recipes are licensed under [AGPL-3.0-only](./LICENSE).
