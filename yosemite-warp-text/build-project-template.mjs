import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const componentId = 'yosemite-warp-title';
const mediaId = 'recipe-media-yosemite-warp-text';

const composition = JSON.parse(await readFile(join(root, 'composition.template.json'), 'utf8'));
const tsxSource = await readFile(join(root, 'cueframe/components', componentId, 'index.tsx'), 'utf8');
const manifest = {
  version: 2,
  assets: {},
  graphics: {
    api: 'webgl2',
    required: true,
    accelerationPreference: 'software-allowed',
  },
  alphaPolicy: 'requires-transparency',
};
const componentSource = { version: 2, componentId, tsxSource, manifest };

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key.normalize('NFC'), canonical(value[key])]));
  }
  if (typeof value === 'string') return value.replace(/\r\n?/g, '\n').normalize('NFC');
  return Object.is(value, -0) ? 0 : value;
};
const sourceVersionId = createHash('sha256').update(JSON.stringify(canonical(componentSource))).digest('hex');

let slots = 0;
const bind = (value) => {
  if (value === 'REPLACE_WITH_MEDIA_ID') {
    slots += 1;
    return mediaId;
  }
  if (Array.isArray(value)) return value.map(bind);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, bind(child)]));
  }
  return value;
};

const boundComposition = bind(composition);
if (slots !== 1) throw new Error(`Expected one media slot, found ${slots}`);

for (const track of boundComposition.tracks) {
  for (const clip of track.contents) {
    if (clip.source?.kind === 'component' && clip.source.componentId === componentId) {
      clip.source.props = {
        ...clip.source.props,
        componentRef: { version: 1, sourceVersionId },
      };
      clip.source.assets = {};
    }
  }
}

const project = {
  version: 4,
  id: 'recipe-yosemite-warp-text',
  name: 'Carved by water',
  createdAt: 0,
  modifiedAt: 0,
  composition: boundComposition,
  pool: [{
    id: mediaId,
    name: 'Yosemite Upper Falls source.mp4',
    kind: 'video',
    filePath: null,
    cloud: null,
  }],
  authoredComponents: {
    [componentId]: {
      headVersionId: sourceVersionId,
      versions: { [sourceVersionId]: componentSource },
    },
  },
  recipe: {
    schemaVersion: 1,
    slug: 'yosemite-warp-text',
    mediaSlots: [{
      id: 'source',
      projectMediaId: mediaId,
      label: 'Yosemite Upper Falls source',
      kind: 'video',
    }],
    components: [{
      componentId,
      name: 'Yosemite Warp Title',
      category: 'text',
      sourceVersionId,
    }],
    cloudBrandKit: {
      kitId: 'cueframe-recipes-carved-by-water',
      name: 'Carved by water',
      description: 'Warm editorial color and oversized amber typography.',
      colors: {
        primary: '#eba61f',
        secondary: '#f7f1e6',
        accent: '#eba61f',
        background: '#0a0a0a',
        text: '#f7f1e6',
      },
      headingFont: { fontFamily: 'Bricolage Grotesque', fontWeight: 650 },
      bodyFont: { fontFamily: 'Inter', fontWeight: 500 },
    },
  },
};

await writeFile(join(root, 'recipe.cueframe'), `${JSON.stringify(project, null, 2)}\n`);
