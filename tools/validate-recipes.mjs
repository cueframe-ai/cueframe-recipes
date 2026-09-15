import { access, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const requiredFiles = [
  'README.md',
  'build-project-template.mjs',
  'composition.template.json',
  'recipe.cueframe',
];
const requiredCatalogStrings = [
  'title',
  'category',
  'format',
  'duration',
  'render',
  'poster',
  'description',
  'prompt',
  'recipe',
  'projectTemplate',
];

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key.normalize('NFC'), canonical(value[key])]));
  }
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n').normalize('NFC');
  return Object.is(value, -0) ? 0 : value;
};

const readManifest = async (name) => {
  const value = JSON.parse(await readFile(join(repoRoot, name), 'utf8'));
  if (value.schemaVersion !== 1 || !Array.isArray(value.recipes)) {
    throw new Error(`${name} must use schemaVersion 1 and contain a recipes array.`);
  }
  return value;
};

const manifest = await readManifest('recipes.json');
const draftManifest = await readManifest('draft-recipes.json');
const publishedSlugs = manifest.recipes.map((recipe) => recipe.slug);
const draftSlugs = draftManifest.recipes.map((recipe) => recipe.slug);
const allSlugs = [...publishedSlugs, ...draftSlugs];
const duplicates = allSlugs.filter((slug, index) => allSlugs.indexOf(slug) !== index);
if (duplicates.length) throw new Error(`Recipe slugs may appear only once: ${[...new Set(duplicates)].join(', ')}`);
if (allSlugs.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) {
  throw new Error('Recipe slugs must use lowercase kebab-case.');
}

for (const draft of draftManifest.recipes) {
  if (typeof draft.reason !== 'string' || !draft.reason.trim()) {
    throw new Error(`Draft recipe ${draft.slug} must explain why it is not published.`);
  }
}
for (const recipe of manifest.recipes) {
  for (const field of requiredCatalogStrings) {
    if (typeof recipe[field] !== 'string' || !recipe[field]) {
      throw new Error(`${recipe.slug}.${field} is required by catalog consumers.`);
    }
  }
  if (!Array.isArray(recipe.details) || recipe.details.some((detail) => typeof detail !== 'string')) {
    throw new Error(`${recipe.slug}.details must be a string array.`);
  }
  if (recipe.transcriptExcerpt !== null && typeof recipe.transcriptExcerpt !== 'string') {
    throw new Error(`${recipe.slug}.transcriptExcerpt must be a string or null.`);
  }
}

const candidateDirectories = (await readdir(repoRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'assets' && entry.name !== 'tools')
  .map((entry) => entry.name);
const recipeDirectories = [];
for (const name of candidateDirectories) {
  try {
    await access(join(repoRoot, name, 'composition.template.json'));
    recipeDirectories.push(name);
  } catch {
    // Non-recipe directories do not participate in either catalog.
  }
}
recipeDirectories.sort();

const listed = new Set(allSlugs);
for (const directory of recipeDirectories) {
  if (!listed.has(directory)) throw new Error(`${directory} must be listed in recipes.json or draft-recipes.json.`);
}
for (const slug of allSlugs) {
  if (!recipeDirectories.includes(slug)) throw new Error(`A recipe catalog references missing directory ${slug}.`);
}

for (const recipe of [...manifest.recipes, ...draftManifest.recipes]) {
  const directory = join(repoRoot, recipe.slug);
  for (const file of requiredFiles) {
    try {
      await access(join(directory, file));
    } catch {
      throw new Error(`${recipe.slug} is missing required file ${file}.`);
    }
  }

  if (publishedSlugs.includes(recipe.slug)) {
    const expectedRecipeUrl = `https://github.com/cueframe-ai/cueframe-recipes/tree/main/${recipe.slug}`;
    const expectedProjectUrl = `https://raw.githubusercontent.com/cueframe-ai/cueframe-recipes/main/${recipe.slug}/recipe.cueframe`;
    if (recipe.recipe !== expectedRecipeUrl) throw new Error(`${recipe.slug} has a non-canonical recipe URL.`);
    if (recipe.projectTemplate !== expectedProjectUrl) throw new Error(`${recipe.slug} must publish its canonical recipe.cueframe URL.`);
  }

  const project = JSON.parse(await readFile(join(directory, 'recipe.cueframe'), 'utf8'));
  if (project.version !== 4 || project.recipe?.slug !== recipe.slug) {
    throw new Error(`${recipe.slug}/recipe.cueframe is not a matching CueFrame v4 recipe project.`);
  }
  if (!Array.isArray(project.recipe.mediaSlots) || project.recipe.mediaSlots.length === 0) {
    throw new Error(`${recipe.slug}/recipe.cueframe must declare at least one media slot.`);
  }
  const poolIds = new Set((project.pool ?? []).map((item) => item.id));
  for (const slot of project.recipe.mediaSlots) {
    if (!poolIds.has(slot.projectMediaId)) throw new Error(`${recipe.slug} media slot ${slot.id} is missing from the project pool.`);
  }
  for (const [componentId, record] of Object.entries(project.authoredComponents ?? {})) {
    const source = record.versions?.[record.headVersionId];
    if (!source || source.version !== 2 || source.componentId !== componentId || !source.tsxSource || source.manifest?.version !== 2) {
      throw new Error(`${recipe.slug} authored component ${componentId} is invalid.`);
    }
    const expectedVersionId = createHash('sha256').update(JSON.stringify(canonical(source))).digest('hex');
    if (record.headVersionId !== expectedVersionId) {
      throw new Error(`${recipe.slug} authored component ${componentId} has a stale source version.`);
    }
  }
  console.log(`✓ ${recipe.slug}${draftSlugs.includes(recipe.slug) ? ' (draft)' : ''}`);
}

console.log(`Validated ${manifest.recipes.length} published and ${draftManifest.recipes.length} draft CueFrame recipes.`);
