import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveParams, sourceFrame, shotDurationFrames, glassLayers} from '../src/showcase/params.mjs';
import {controlState, validateMountedControls} from '../src/showcase/choreography.mjs';
import {controlWorld, cameraFit, cameraTrack, iconEase, revealIcon} from '../src/core/motion.mjs';
import {normalizeModel, displaySurface, rotate, sub, length, mul, dot} from '../src/core/device-core.mjs';
import {highlightLayout, highlightOutline} from '../src/core/highlight.mjs';

function fixture(rotated = false) {
  const points = [[-6,-13,0],[6,-13,0],[6,13,0],[-6,13,0]];
  const model = {units:'centimeters', coordinateSpace:'baked', meshes:[{
    name:'display', positions: points.flatMap(([x,y,z]) => rotated ? [-y,x,z] : [x,y,z]),
    indices:[0,1,2,0,2,3],
  }]};
  const p = resolveParams(rotated ? {device:{right:[0,1,0],up:[-1,0,0]}} : {});
  return {p, surface:displaySurface(normalizeModel(model,p.device),'display')};
}
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);

test('preset is separate, unbranded, and partial inputs do not mutate it', () => {
  const original = resolveParams();
  const patch = {glass:{depth:12, frost:0},layout:{navbar:{highlight:{index:1}}}};
  const before = JSON.stringify(patch);
  const p = resolveParams(patch);
  assert.equal(p.glass.frost,0);
  assert.equal(p.glass.depth,12);
  assert.equal(p.layout.navbar.highlight.shape,'capsule');
  assert.equal(JSON.stringify(patch),before);
  assert.deepEqual(resolveParams(),original);
  assert.equal(original.device.displayMesh,'display');
  assert.equal(original.endCard.text,'Your product');
  assert.equal(original.endCard.showMark,false);
});

test('pose controls rotate every mounted layer through the same root', () => {
  const {p,surface} = fixture();
  const changed = resolveParams({device:{poseDegrees:[12,-8,10]}});
  validateMountedControls(surface,changed);
  for(let frame=0;frame<698;frame++) {
    const a=controlState(surface,frame,p), b=controlState(surface,frame,changed);
    assert.deepEqual(a.controls,b.controls); // no independent UI orientation change
    a.rotation.forEach((r,i)=>near(b.rotation[i]-r,[12,-8,10][i]*Math.PI/180));
    const c=b.focus, layers=glassLayers(changed.glass);
    const face=controlWorld(surface,c.box,c.z+layers.face,b.rotation);
    const icon=controlWorld(surface,c.box,c.z+layers.icon,b.rotation);
    const normal=rotate([0,0,1],b.rotation);
    const gap=sub(icon,face);
    near(length(gap),(layers.icon-layers.face)*surface.unit);
    near(dot(gap,normal),length(gap));
    assert.ok(cameraFit(surface,b,changed).every(Number.isFinite));
  }
});

test('a second baked model orientation produces the identical screen mount', () => {
  const a=fixture(), b=fixture(true);
  assert.deepEqual(a.surface,b.surface);
  validateMountedControls(b.surface,b.p);
});

test('selected capsule moves to the next icon without changing its shape', () => {
  const {navbar:n}=resolveParams().layout;
  for(const width of [n.width,n.compactWidth]) {
    const a=highlightLayout(width,n.height,n.icons.length,n.highlight);
    const b=highlightLayout(width,n.height,n.icons.length,{...n.highlight,index:1});
    near(b.x-a.x,width/n.icons.length);
    const outline=highlightOutline(b,'capsule');
    near(b.radius,b.height/2);
    near(outline[16][1],outline[17][1]);
    assert.ok(Math.abs(outline[16][0]-outline[17][0])>0);
  }
});

test('camera framing edits do not mutate device pose or layout', () => {
  const {p,surface}=fixture();
  const q=resolveParams({camera:{framing:{offset:[0.1,-0.1],zoom:0.8}}});
  const a=controlState(surface,390,p), b=controlState(surface,390,q);
  assert.deepEqual(a.rotation,b.rotation);
  assert.deepEqual(a.controls,b.controls);
  near(b.target[0],a.target[0]+0.1);
  near(b.target[1],a.target[1]-0.1);
  near(b.target[2],a.target[2]*0.8);
  assert.notDeepEqual(cameraFit(surface,a,p),cameraFit(surface,b,q));
});

test('one speed control retimes camera, cuts and controls independent of output FPS', () => {
  const {surface}=fixture();
  const normal=resolveParams({shot:'navbar'}), slow=resolveParams({shot:'navbar',timeline:{speed:0.5}});
  assert.equal(shotDurationFrames(slow),shotDurationFrames(normal)*2);
  for(const fps of [24,30,60]) {
    const a=sourceFrame(normal,{frame:fps,fps});
    const b=sourceFrame(slow,{frame:fps*2,fps});
    assert.equal(a,b);
    assert.deepEqual(controlState(surface,a,normal),controlState(surface,b,slow));
  }
  const window=resolveParams({shot:'navbar',startFrame:130});
  assert.equal(sourceFrame(window,{frame:0,fps:60}),350);
  assert.equal(sourceFrame(window,{frame:89,fps:60}),439);
});

test('repeated and out-of-order seeking is deterministic', () => {
  const {p,surface}=fixture();
  const expected=controlState(surface,390,p);
  for(const frame of [500,1,390,240,390]) controlState(surface,frame,p);
  assert.deepEqual(controlState(surface,390,p),expected);
});

test('icon entrance uses the strong ease-out curve, with exact endpoints and no overshoot', () => {
  assert.equal(iconEase(-1),0);
  assert.equal(iconEase(0),0);
  assert.equal(iconEase(1),1);
  assert.equal(iconEase(2),1);
  // At Bezier parameter t=.5, x=.33125 and y=.875.
  near(iconEase(0.33125),0.875);
  let previous = 0;
  for(let i=0;i<=1000;i++) {
    const value=iconEase(i/1000);
    assert.ok(value>=previous && value<=1);
    previous=value;
  }
  assert.ok(revealIcon(365,355,399)>0.7);
});

test('selection and its icon share one beat independent of selected slot', () => {
  const {surface}=fixture();
  for(const frame of [220,274,280,300,310,350,399,535,536,697]) {
    let expected;
    for(let index=0;index<4;index++) {
      const p=resolveParams({layout:{navbar:{highlight:{index}}}});
      const toolbar=controlState(surface,frame,p).controls[1];
      assert.equal(toolbar.icons.filter(icon=>icon.selected).length,1);
      assert.equal(toolbar.icons[index].selected,true);
      assert.equal(toolbar.selectionReveal,toolbar.icons[index].reveal);
      if(expected!==undefined) assert.equal(toolbar.selectionReveal,expected);
      expected=toolbar.selectionReveal;
    }
  }
});

test('camera curves hit every landmark, preserve segment bounds and have continuous velocity', () => {
  const p=resolveParams();
  const tracks=Object.values(p.camera).filter(rig=>rig?.rotation).flatMap(rig=>[rig.rotation,rig.target]);
  tracks.push([[0,1],[7,-2],[81,8],[82,8],[200,3]],[[0,2]]);
  for(const keys of tracks) {
    for(const key of keys) {
      const at=cameraTrack(keys,key[0]);
      at.forEach((v,i)=>near(v,key[i+1]));
      const dt=0.00001;
      const left=cameraTrack(keys,key[0]-dt), right=cameraTrack(keys,key[0]+dt);
      at.forEach((v,i)=>assert.ok(Math.abs((v-left[i])/dt-(right[i]-v)/dt)<0.001));
    }
    for(let i=1;i<keys.length;i++) {
      const a=keys[i-1],b=keys[i];
      for(let j=0;j<=100;j++) cameraTrack(keys,a[0]+(b[0]-a[0])*j/100).forEach((v,k)=>{
        assert.ok(v>=Math.min(a[k+1],b[k+1])-1e-10 && v<=Math.max(a[k+1],b[k+1])+1e-10);
      });
    }
  }
});

test('camera polish preserves right-facing yaw and finite fitting throughout the navbar shot', () => {
  const {surface}=fixture();
  const p=resolveParams({camera:{navbar:{rotation:[[220,-0.93,0.45,0.22],[536,-0.93,0.45,0.29]]}}});
  for(let frame=220;frame<536;frame++) {
    const state=controlState(surface,frame,p);
    assert.ok(rotate([0,0,1],state.rotation)[0]>0);
    assert.ok(cameraFit(surface,state,p).every(Number.isFinite));
  }
});

test('invalid parameters and overflowing layouts fail explicitly', () => {
  for(const params of [
    {device:{poseDegrees:[1,2]}}, {device:{poseDegrees:[NaN,0,0]}},
    {timeline:{speed:0}}, {camera:{framing:{zoom:-1}}},
    {layout:{navbar:{highlight:{index:4}}}}, {glass:{dept:12}},
    {timeline:{cuts:[220,200,698,910]}},
  ]) assert.throws(()=>resolveParams(params));
  assert.throws(()=>shotDurationFrames(resolveParams({shot:'navbar',startFrame:400})),/inside/);
  const {surface}=fixture();
  assert.throws(()=>validateMountedControls(surface,resolveParams({layout:{search:{x:2000}}})),/display|overlap/);
});

test('screen registration stays on the viewing ray with tilted thicker glass', () => {
  const {surface}=fixture();
  const p=resolveParams({device:{poseDegrees:[12,-8,10]},glass:{depth:24}});
  const layers=glassLayers(p.glass);
  for(let frame=220;frame<536;frame++) {
    const state=controlState(surface,frame,p), c=state.focus;
    const z=c.z+layers.face*Math.max(0.03,c.thickness);
    const face=controlWorld(surface,c.box,z,state.rotation), camera=cameraFit(surface,state,p);
    const eye=mul(sub(camera,face),1/length(sub(camera,face)));
    const right=rotate([1,0,0],state.rotation),up=rotate([0,1,0],state.rotation),normal=rotate([0,0,1],state.rotation);
    const viewZ=dot(eye,normal);
    assert.ok(viewZ>0.05);
    const lift=(surface.origin[2]-surface.glassZ)/surface.unit+z;
    const x=c.box.x+c.box.width/2-dot(eye,right)*lift/viewZ;
    const y=c.box.y+c.box.height/2+dot(eye,up)*lift/viewZ;
    const sample=controlWorld(surface,{x,y,width:0,height:0},(surface.glassZ-surface.origin[2])/surface.unit,state.rotation);
    near(length(sub(sub(face,mul(eye,lift*surface.unit/viewZ)),sample)),0);
  }
});

test('editable source contains neither task-local imports nor embedded product branding', () => {
  for(const file of ['../src/Showcase.jsx','../src/render/DeviceScene.jsx','../src/render/GlassSurface.jsx','../src/showcase/params.mjs','../src/showcase/choreography.mjs','../src/showcase/profile.json']) {
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/\.context|\/Users\//);
  }
});
