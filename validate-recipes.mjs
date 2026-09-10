import { access, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key.normalize('NFC'), canonical(value[key])]));
  }
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n').normalize('NFC');
  return Object.is(value, -0) ? 0 : value;
};
const manifest = JSON.parse(await readFile(join(root, 'recipes.json'), 'utf8'));
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.recipes)) {
  throw new Error('recipes.json must use schemaVersion 1 and contain a recipes array.');
}

const candidateDirectories = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'assets')
  .map((entry) => entry.name);
const recipeDirectories = [];
for (const name of candidateDirectories) {
  try {
    await access(join(root, name, 'composition.template.json'));
    recipeDirectories.push(name);
  } catch {
    // Non-recipe directories do not participate in the public catalog.
  }
}
const listed = new Set(manifest.recipes.map((recipe) => recipe.slug));
const duplicates = manifest.recipes.filter((recipe, index) => manifest.recipes.findIndex((item) => item.slug === recipe.slug) !== index);
if (duplicates.length) throw new Error(`Duplicate recipe slugs: ${duplicates.map((recipe) => recipe.slug).join(', ')}`);

for (const directory of recipeDirectories) {
  if (!listed.has(directory)) throw new Error(`${directory} is a recipe directory missing from recipes.json.`);
}

for (const recipe of manifest.recipes) {
  const directory = join(root, recipe.slug);
  const expectedRecipeUrl = `https://github.com/cueframe-ai/cueframe-recipes/tree/main/${recipe.slug}`;
  const expectedProjectUrl = `https://raw.githubusercontent.com/cueframe-ai/cueframe-recipes/main/${recipe.slug}/recipe.cueframe`;
  if (recipe.recipe !== expectedRecipeUrl) throw new Error(`${recipe.slug} has a non-canonical recipe URL.`);
  if (recipe.projectTemplate !== expectedProjectUrl) throw new Error(`${recipe.slug} must publish its canonical recipe.cueframe URL.`);

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
  console.log(`✓ ${recipe.slug}`);
}

console.log(`Validated ${manifest.recipes.length} canonical CueFrame recipes.`);
