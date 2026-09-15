import React, { useMemo, useLayoutEffect } from "react";
import * as THREE from "three";

// Screen-registered frosted glass. The UI texture is sampled BEFORE the icons,
// so frosting can never blur the glyphs. No DOM filters, clocks or mouse state.
const vertexShader = `
varying vec2 vLocal;
varying vec3 vViewPosition;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vNormal;
void main(){
 vLocal=position.xy;
 vec4 p=modelViewMatrix*vec4(position,1.0);
 vViewPosition=p.xyz;
 vRight=normalize(mat3(modelViewMatrix)*vec3(1.,0.,0.));
 vUp=normalize(mat3(modelViewMatrix)*vec3(0.,1.,0.));
 vNormal=normalize(normalMatrix*vec3(0.,0.,1.));
 gl_Position=projectionMatrix*p;
}`;
const fragmentShader = `
uniform sampler2D uScreen;
uniform sampler2D uFrostedScreen;
uniform vec2 uSize;
uniform vec2 uScreenSize;
uniform vec2 uCenter;
uniform vec2 uScale;
uniform float uFrost;
uniform float uReveal;
uniform float uFrame;
uniform float uLift;
uniform float uRimStrength;
uniform float uFormedRimStrength;
uniform float uBevelWidth;
uniform float uBackdropStrength;
varying vec2 vLocal;
varying vec3 vViewPosition;
varying vec3 vRight;
varying vec3 vUp;
varying vec3 vNormal;
float sdf(vec2 p){
 float r=uSize.y*.5;
 vec2 q=abs(p)-(uSize*.5-vec2(r));
 return length(max(q,0.))+min(max(q.x,q.y),0.)-r;
}
void main(){
 float d=sdf(vLocal);
 float aa=max(fwidth(d),.35);
 float mask=1.-smoothstep(-aa,aa,d);
 if(mask<.01)discard;
 vec3 eye=normalize(-vViewPosition);
 // Project the viewing ray down to the native display. Sampling straight down
 // duplicates text at oblique angles because the glass face is above the UI.
 float viewZ=max(.05,dot(eye,normalize(vNormal)));
 vec2 rayOffset=vec2(-dot(eye,normalize(vRight)),dot(eye,normalize(vUp)))*uLift/viewZ;
 vec2 px=uCenter+vec2(vLocal.x,-vLocal.y)*uScale+rayOffset;
 vec2 uv=vec2(px.x/uScreenSize.x,1.-px.y/uScreenSize.y);
 // Pre-filter the app in its own pixel grid; sparse large-radius taps produced
 // repeated text ghosts. Only this masked face samples the Gaussian texture.
 vec3 under=mix(texture2D(uScreen,uv).rgb,texture2D(uFrostedScreen,uv).rgb,uFrost);
 vec2 grad=normalize(vec2(sdf(vLocal+vec2(.5,0.))-sdf(vLocal-vec2(.5,0.)),sdf(vLocal+vec2(0.,.5))-sdf(vLocal-vec2(0.,.5)))+vec2(.00001));
 float bevel=1.-smoothstep(0.,uBevelWidth,-d);
 vec3 normal=normalize(vNormal*.72+(vRight*grad.x+vUp*grad.y)*bevel);
 // A broad studio light, expressed in view space; highlights respond to pose.
 vec3 light=normalize(vec3(-.65+.14*sin(uFrame*.003),.85,1.2));
 vec3 halfVector=normalize(light+eye);
 float broad=pow(max(dot(normal,halfVector),0.),20.);
 float fine=pow(max(dot(normal,halfVector),0.),85.);
 float fresnel=pow(1.-max(dot(normal,eye),0.),3.);
 float rim=exp(-pow((d+1.5)/1.2,2.));
 float lowerLip=exp(-pow((d+5.5)/2.2,2.));
 float gradient=.006+.005*(vLocal.y/uSize.y+.5);
 vec3 body=under*uBackdropStrength+vec3(gradient);
 body+=vec3(.028,.030,.034)*broad*uFrost;
 body+=vec3(.10,.105,.115)*(fine*.6+fresnel*.25)*bevel;
 body+=vec3(mix(uRimStrength,uFormedRimStrength,uFrost))*rim*(.22+.78*max(dot(normal,light),0.));
 body+=vec3(.018)*lowerLip*fresnel;
 float rimAlpha=clamp(rim*.8+bevel*.12,0.,1.);
 float alpha=mask*uReveal*max(uFrost,rimAlpha);
 gl_FragColor=vec4(body,alpha);
 #include <colorspace_fragment>
}`;

export function GlassSurface({
  screen,
  frostedScreen,
  surface,
  control,
  frame,
  lift,
  glass,
}) {
  const b = control.box;
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        uniforms: {
          uScreen: { value: screen },
          uFrostedScreen: { value: frostedScreen },
          uSize: { value: new THREE.Vector2(b.width, b.height) },
          uScreenSize: {
            value: new THREE.Vector2(surface.width, surface.height),
          },
          uCenter: {
            value: new THREE.Vector2(b.x + b.width / 2, b.y + b.height / 2),
          },
          uScale: { value: new THREE.Vector2(1, 1) },
          uFrost: { value: 1 },
          uReveal: { value: 1 },
          uFrame: { value: 0 },
          uLift: { value: 0 },
          uRimStrength: { value: 0 },
          uFormedRimStrength: { value: 0 },
          uBevelWidth: { value: 0 },
          uBackdropStrength: { value: 0 },
        },
      }),
    [screen, frostedScreen, surface, b.width, b.height, b.x, b.y],
  );
  material.uniforms.uFrost.value = control.frost * glass.frost;
  material.uniforms.uRimStrength.value = glass.rimStrength;
  material.uniforms.uFormedRimStrength.value = glass.formedRimStrength;
  material.uniforms.uBevelWidth.value = glass.bevelWidth;
  material.uniforms.uBackdropStrength.value = glass.backdropStrength;
  material.uniforms.uReveal.value = control.reveal;
  material.uniforms.uFrame.value = frame;
  material.uniforms.uLift.value = lift;
  material.uniforms.uScale.value.set(
    control.scale * control.stretch[0],
    control.scale * control.stretch[1],
  );
  useLayoutEffect(() => () => material.dispose(), [material]);
  return (
    <mesh
      name={"frosted-face:" + control.id}
      renderOrder={10}
      material={material}
    >
      <planeGeometry args={[b.width, b.height]} />
    </mesh>
  );
}
