# Contributing

Each recipe is a portable, editable CueFrame project that proves one recognizable
video job end to end. Keep the source, documentation, and generated project
together so a recipe can be understood without searching the repository.

## 1. Create the recipe package

Add a lowercase, kebab-case directory at the repository root. Recipe paths are
public API: released CueFrame clients resolve slugs directly from these paths.

```text
my-recipe/
├── README.md
├── build-project-template.mjs
├── composition.template.json
└── recipe.cueframe
```

Keep recipe-specific components, brand kits, review rubrics, and other derived
assets in that same directory. Do not commit source masters; contributors and
users must bring media they have permission to edit.

## 2. Document the workflow

The recipe README should explain:

- the use case and who it is for;
- the source attribution and exact reproduction steps;
- how to run the recipe from the desktop app, CLI, and MCP;
- the editable layers and important implementation choices; and
- the finished render and, when appropriate, a review rubric with named
  timestamps and kill criteria.

## 3. Build the portable project

Use `build-project-template.mjs` to generate `recipe.cueframe` deterministically.
The project must use CueFrame project version 4, declare its recipe slug, and
provide at least one media slot whose `projectMediaId` exists in the project
pool.

Run the builder from anywhere; it should resolve its inputs relative to its own
recipe directory:

```bash
node my-recipe/build-project-template.mjs
```

## 4. Add the catalog and gallery entries

Once the recipe has a hosted render and poster, add it to `recipes.json` at its
intended gallery position; consumers use this order for display. Preserve the
canonical top-level repository URLs:

```text
https://github.com/cueframe-ai/cueframe-recipes/tree/main/my-recipe
https://raw.githubusercontent.com/cueframe-ai/cueframe-recipes/main/my-recipe/recipe.cueframe
```

Add a matching entry to the root README with a linked poster, a direct project
download, a short description, and a link to the recipe package.

If the package is ready for review but its hosted render or poster is not, list
its slug and the reason in `draft-recipes.json` instead. A package must appear in
exactly one of the published or draft catalogs.

## 5. Validate the repository

```bash
node tools/validate-recipes.mjs
```

The validator checks lifecycle membership, landing-required metadata, package
completeness, canonical URLs, project/media-slot integrity, and authored-component
source hashes.
