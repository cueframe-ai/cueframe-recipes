import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
// The embedded asset uses the current three-plane packed co-view contract:
// scene, foreground, and matte laid out side by side in H.264.
const matteBakeVersion = 'birefnet-portrait-coview-h264-v14-rvm-2026.08.27';
const composition = JSON.parse(await readFile(join(root, 'composition.template.json'), 'utf8'));
const cloudBrandKit = JSON.parse(await readFile(join(root, 'brand-kit.json'), 'utf8'));
const packedMatte = Buffer.from(
  (await readFile(join(root, 'packed-matte.mp4.base64'), 'utf8')).replace(/\s+/g, ''),
  'base64',
);
const packedMatteSha256 = createHash('sha256').update(packedMatte).digest('hex');
if (packedMatteSha256 !== '42fa0d95b11c7a45f618f942f35fe04717e6fed0f92f021ab55f72abe67d33fa') {
  throw new Error(`Prepared matte integrity mismatch: ${packedMatteSha256}`);
}
const mediaId = 'recipe-media-yosemite-peregrines';

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

const project = {
  version: 4,
  id: 'recipe-yosemite-peregrines',
  name: 'Yosemite Peregrines',
  createdAt: 0,
  modifiedAt: 0,
  composition: boundComposition,
  pool: [{
    id: mediaId,
    name: 'Peregrine Falcons in Yosemite source.mp4',
    kind: 'video',
    filePath: null,
    cloud: null,
    mattes: {
      // SHA-256 of the canonical 83.616-93.359 person-matte intent.
      '4aa54bdd6d0d': {
        preparedAssetId: 'peregrines-packed-matte',
        bakeVersion: matteBakeVersion,
        presenceFraction: 0.9,
      },
    },
  }],
  authoredComponents: {},
  preparedAssets: {
    'peregrines-packed-matte': {
      encoding: 'base64',
      mimeType: 'video/mp4',
      sha256: packedMatteSha256,
      data: packedMatte.toString('base64'),
    },
  },
  brandKit: {
    id: cloudBrandKit.kitId,
    name: cloudBrandKit.name,
    description: cloudBrandKit.description,
    tagline: cloudBrandKit.tagline,
    colors: cloudBrandKit.colors,
    extraColors: [],
    headingFont: cloudBrandKit.headingFont,
    bodyFont: cloudBrandKit.bodyFont,
    syncCaptions: true,
    captionProfile: cloudBrandKit.captionProfile,
    customFonts: [],
    voiceGuidelines: cloudBrandKit.voiceGuidelines ?? '',
    createdAt: 0,
    modifiedAt: 0,
  },
  recipe: {
    schemaVersion: 1,
    slug: 'yosemite-peregrines',
    mediaSlots: [{
      id: 'source',
      projectMediaId: mediaId,
      label: 'Full 1920x1080 Peregrine Falcons in Yosemite source',
      kind: 'video',
    }],
    cloudBrandKit,
  },
};

await writeFile(join(root, 'recipe.cueframe'), `${JSON.stringify(project, null, 2)}\n`);
