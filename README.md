# CueFrame recipes

Real, editable video projects that show what CueFrame is best at. Each recipe
starts with real source material, includes its composition and component source,
and explains the editorial decisions behind the finished render.

Each recipe package has a stable top-level path, previews link to the finished
renders, and repository maintenance scripts live in [`tools/`](./tools). The
machine-readable catalog is [`recipes.json`](./recipes.json).

Packages awaiting a hosted preview are tracked separately in
[`draft-recipes.json`](./draft-recipes.json) so landing-page consumers only see
complete gallery entries.

## Published recipes

### Yosemite Peregrines ([project download](https://raw.githubusercontent.com/cueframe-ai/cueframe-recipes/main/yosemite-peregrines/recipe.cueframe))

[![A ranger in Yosemite with the word Phenomenal behind him](https://cueframe.ai/showcase/yosemite-peregrines-phenomenal-poster.jpg)](https://cueframe.ai/demo/yosemite-peregrines-phenomenal.mp4)

A subject-aware talking-head edit with an editorial title, word-timed captions,
brand styling, and the original spoken audio. [Open the recipe](./yosemite-peregrines).

### Yosemite WarpText ([project download](https://raw.githubusercontent.com/cueframe-ai/cueframe-recipes/main/yosemite-warp-text/recipe.cueframe))

[![Yosemite Falls behind oversized amber typography](https://cueframe.ai/showcase/yosemite-poster.jpg)](https://cueframe.ai/demo/yosemite-warp-text.mp4)

A landscape film with a reusable WebGL title component, cinematic color, and
ambient sound. [Open the recipe](./yosemite-warp-text).

## Draft recipes

Draft packages are reviewable and downloadable, but are deliberately excluded
from the public gallery catalog until their hosted render and poster exist.

### Device UI Motion ([project download](https://raw.githubusercontent.com/cueframe-ai/cueframe-recipes/main/device-ui-motion/recipe.cueframe))

An editable 3D glass-control showcase with a supplied phone mesh, product UI,
and frame-driven camera choreography. [Open the recipe](./device-ui-motion).
Bring your own model; a hosted video/poster has not been published yet.

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the recipe package layout and
submission checklist. Validate the catalog, portable projects, canonical URLs,
and media slots with:

```bash
node tools/validate-recipes.mjs
```

Recipes are licensed under [AGPL-3.0-only](./LICENSE).
