import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const json=path=>JSON.parse(readFileSync(join(root,path),'utf8'));

test('rendering and geometry modules do not import the showcase',()=>{
  for(const dir of ['src/core','src/render']) for(const file of readdirSync(join(root,dir))){
    const source=readFileSync(join(root,dir,file),'utf8');
    assert.doesNotMatch(source,/(?:from|import\s*\()\s*["'][^"']*(?:showcase|profile|choreography)/);
  }
  const source=readFileSync(join(root,'src/render/DeviceScene.jsx'),'utf8');
  assert.match(source,/sampleState\(surface, frame, config\)/);
  assert.doesNotMatch(source,/state\.shot|timeline\.cuts|motion\.navbar/);
});

test('recipe pins source, preserves schema and binds exactly one required model slot',()=>{
  const project=json('recipe.cueframe'), record=project.authoredComponents['device-ui-motion'];
  const clip=project.composition.tracks[0].contents[0];
  assert.equal(project.version,4);
  assert.equal(clip.source.props.componentRef.sourceVersionId,record.headVersionId);
  assert.equal(clip.source.assets.model,project.recipe.mediaSlots[0].projectMediaId);
  assert.equal(project.pool[0].kind,'image');
  assert.deepEqual(project.recipe.components[0].propSchema,json('cueframe/components/device-ui-motion/schema.json'));
  assert.equal(record.versions[record.headVersionId].tsxSource,readFileSync(join(root,'cueframe/components/device-ui-motion/index.tsx'),'utf8'));
  assert.equal(JSON.stringify(json('composition.template.json')).split('REPLACE_WITH_MEDIA_ID').length-1,1);
});

test('component files returned by the existing recipe loader are self-contained',()=>{
  const source=readFileSync(join(root,'cueframe/components/device-ui-motion/index.tsx'),'utf8');
  const config=readFileSync(join(root,'cueframe/components/device-ui-motion/config.ts'),'utf8');
  assert.doesNotMatch(source,/from\s*["']\./);
  assert.doesNotMatch(source,/\/Users\/|\.context\//);
  assert.doesNotMatch(config,/from\s*["']\.\/schema/);
});

test('generated outputs are fresh and admitted by the CLI',()=>{
  execFileSync(process.execPath,[join(root,'build-project-template.mjs'),'--check'],{cwd:dirname(root),stdio:'pipe'});
});

test('authoring depends only on esbuild and the CLI, not a kernel checkout',()=>{
  assert.deepEqual(json('package.json').devDependencies,{esbuild:'0.25.12'});
  const builder=readFileSync(join(root,'build-project-template.mjs'),'utf8');
  assert.doesNotMatch(builder,/@cueframe\/kernel|@babel\/parser|CUEFRAME_PUBLIC_DIR|sourceVersionId\(/);
  assert.match(builder,/'recipe','pack'/);
});
