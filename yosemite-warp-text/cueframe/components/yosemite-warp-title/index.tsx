import React, { useLayoutEffect, useRef } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

const vertex = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// React Bits WarpText fragment shader, kept intact apart from uOpacity so the
// component can enter and leave on the composition timeline deterministically.
const fragment = `#version 300 es
precision highp float;

uniform sampler2D uTextTexture;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uTime;
uniform float uWarpStrength;
uniform float uWarpScale;
uniform float uSpeed;
uniform float uPointerInfluence;
uniform float uPointerStrength;
uniform float uRefraction;
uniform float uRipple;
uniform float uMotion;
uniform float uOpacity;

in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

vec4 sampleText(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
  return texture(uTextTexture, uv);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float time = uTime * uSpeed;
  float scale = max(uWarpScale, 0.001);

  vec2 drift = vec2(time * 0.055, -time * 0.045);
  float n1 = fbm(uv * scale * 3.1 + drift);
  float n2 = fbm((uv + 19.17) * scale * 3.4 - drift.yx);
  vec2 ambient = (vec2(n1, n2) - 0.5) * uWarpStrength * 0.045 * uMotion;

  vec2 pointerDelta = uv - uPointer;
  vec2 aspectDelta = vec2(pointerDelta.x * aspect, pointerDelta.y);
  float dist = length(aspectDelta);
  float radius = max(uPointerInfluence, 0.001);
  float t = clamp(dist / radius, 0.0, 1.0);
  float lens = smoothstep(radius, 0.0, dist) * uPointerActive;
  float bulge = t * (1.0 - t) * (1.0 - t) * 6.75 * uPointerActive;
  vec2 dir = dist > 0.0001 ? vec2(aspectDelta.x / aspect, aspectDelta.y) / dist : vec2(0.0);

  float rippleWave = sin(dist * 28.0 - time * 4.2) * 0.5 + 0.5;
  float rippleRing = (rippleWave - 0.5) * uRipple;
  vec2 pointerWarp = -dir * bulge * uPointerStrength * 0.045;
  pointerWarp += dir * rippleRing * bulge * uPointerStrength * 0.016;

  vec2 displaced = uv + ambient + pointerWarp;
  vec2 splitDir = ambient + pointerWarp;
  float splitLen = length(splitDir);
  splitDir = splitLen > 0.00001 ? splitDir / splitLen : vec2(0.7071, 0.7071);
  vec2 split = splitDir * uRefraction * 0.16 * (0.35 + lens * 1.65);

  vec4 base = sampleText(displaced);
  float r = sampleText(displaced + split).r;
  float g = base.g;
  float b = sampleText(displaced - split).b;
  float a = max(max(sampleText(displaced + split).a, base.a), sampleText(displaced - split).a);
  vec3 color = vec3(r, g, b) + lens * base.a * 0.055;
  fragColor = vec4(color, a * uOpacity);
}`;

type Runtime = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniform: (name: string) => WebGLUniformLocation | null;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

function CueFrameLogo({ opacity }: { opacity: number }) {
  return (
    <div style={{ position: 'absolute', left: 112, bottom: 76, display: 'flex', alignItems: 'center', gap: 22, opacity }}>
      <svg width="70" height="70" viewBox="0 0 256 256" aria-hidden="true">
        <defs><clipPath id="cueframe-logo-clip"><circle cx="128" cy="128" r="118" /></clipPath></defs>
        <circle cx="128" cy="128" r="118" fill="#eba61f" />
        <g clipPath="url(#cueframe-logo-clip)" stroke="#0a0a0a" fill="none">
          <path d="M88 128Q160 40 300-40" strokeWidth="5" />
          <path d="M88 128Q170 60 310 20" strokeWidth="4.5" />
          <path d="M88 128Q180 80 316 70" strokeWidth="4.5" />
          <path d="M88 128Q186 110 320 110" strokeWidth="4.5" />
          <path d="M88 128Q186 146 320 146" strokeWidth="4.5" />
          <path d="M88 128Q180 176 316 186" strokeWidth="4.5" />
          <path d="M88 128Q170 196 310 236" strokeWidth="4.5" />
          <path d="M88 128Q160 216 300 296" strokeWidth="5" />
        </g>
        <circle cx="88" cy="128" r="20" fill="#0a0a0a" />
        <circle cx="88" cy="128" r="8" fill="#7ec8e3" />
      </svg>
      <span style={{ color: '#f7f1e6', fontFamily: 'Bricolage Grotesque, Inter, sans-serif', fontSize: 29, fontWeight: 650, letterSpacing: 1.2 }}>
        CUEFRAME
      </span>
    </div>
  );
}

function WarpCanvas({ text, color }: { text: string; color: string }) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<Runtime | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error('CueFrame component renderer does not provide WebGL2');

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not allocate WarpText shader');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`WarpText shader compile failed: ${gl.getShaderInfoLog(shader) ?? 'unknown error'}`);
      }
      return shader;
    };

    const program = gl.createProgram();
    if (!program) throw new Error('Could not allocate WarpText program');
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`WarpText program link failed: ${gl.getProgramInfoLog(program) ?? 'unknown error'}`);
    }
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 0, 0, 3, -1, 2, 0, -1, 3, 0, 2]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    const uv = gl.getAttribLocation(program, 'uv');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);

    const textCanvas = document.createElement('canvas');
    textCanvas.width = width;
    textCanvas.height = height;
    const context = textCanvas.getContext('2d');
    if (!context) throw new Error('Could not allocate WarpText raster canvas');
    context.clearRect(0, 0, width, height);
    context.fillStyle = color;
    context.textAlign = 'right';
    context.textBaseline = 'alphabetic';
    context.font = '800 148px "Bricolage Grotesque", Inter, sans-serif';
    const lines = text.split('\n');
    lines.forEach((line, index) => {
      const y = 420 + index * 146;
      context.fillText(line, width - 130, y);
    });

    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform1i(uniform('uTextTexture'), 0);
    gl.uniform2f(uniform('uResolution'), width, height);
    // Keep the ambient texture restrained, then make the localized pointer
    // deformation do the visual work. Strong refraction reads as RGB glitching
    // once exported; the reference effect is primarily a spatial bend.
    gl.uniform1f(uniform('uWarpStrength'), 0.035);
    gl.uniform1f(uniform('uWarpScale'), 1.7);
    gl.uniform1f(uniform('uSpeed'), 0.55);
    gl.uniform1f(uniform('uPointerInfluence'), 0.24);
    gl.uniform1f(uniform('uPointerStrength'), 1.18);
    gl.uniform1f(uniform('uRefraction'), 0.004);
    gl.uniform1f(uniform('uRipple'), 0.72);
    gl.uniform1f(uniform('uMotion'), 1);
    gl.clearColor(0, 0, 0, 0);
    gl.viewport(0, 0, width, height);
    runtimeRef.current = { gl, program, uniform };

    return () => {
      runtimeRef.current = null;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [color, height, text, width]);

  useLayoutEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const { gl, program, uniform } = runtime;
    gl.useProgram(program);

    const progressThroughClip = frame / Math.max(1, durationInFrames - 1);
    const opacity = interpolate(
      progressThroughClip,
      [0.12, 0.22, 0.86, 1],
      [0, 1, 1, 0],
      {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      },
    );
    // A deliberate pointer gesture across the title. The visual is produced by
    // WarpText's localized bulge/ripple/refraction, not by a sweep overlay.
    const progress = smooth((progressThroughClip - 0.20) / 0.48);
    const active = smooth((progressThroughClip - 0.18) / 0.04) *
      (1 - smooth((progressThroughClip - 0.69) / 0.06));
    const pointerX = 0.40 + progress * 0.62;
    const pointerY = 0.535;

    gl.uniform2f(uniform('uPointer'), pointerX, pointerY);
    gl.uniform1f(uniform('uPointerActive'), 0.18 + clamp(active) * 0.82);
    gl.uniform1f(uniform('uTime'), progressThroughClip * 8);
    gl.uniform1f(uniform('uOpacity'), opacity);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [durationInFrames, frame]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', inset: 0, width, height }} />;
}

export default function YosemiteWarpTitle({
  durationInFrames,
  params,
}: {
  durationInFrames: number;
  params: Record<string, unknown>;
}) {
  const frame = useCurrentFrame();
  const text = typeof params.text === 'string' ? params.text : 'CARVED BY\nWATER';
  const color = typeof params.color === 'string' ? params.color : '#eba61f';
  const progressThroughClip = frame / Math.max(1, durationInFrames - 1);
  const detailOpacity = interpolate(progressThroughClip, [0.24, 0.34, 0.86, 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent', fontFamily: 'Bricolage Grotesque, Inter, sans-serif' }}>
      <WarpCanvas text={text} color={color} />
      <div style={{ position: 'absolute', left: 1118, top: 650, width: 672, opacity: detailOpacity }}>
        <div style={{ height: 3, background: color }} />
        <div style={{ marginTop: 28, color: '#f7f1e6', fontSize: 29, fontWeight: 600, letterSpacing: 2 }}>ONE CANVAS · HUMAN + AGENT</div>
        <div style={{ marginTop: 14, color: '#e8d6bf', fontSize: 22, letterSpacing: 1.7 }}>BUILT IN CUEFRAME</div>
      </div>
      <div style={{ position: 'absolute', left: 112, top: 84, color, fontSize: 21, fontWeight: 600, letterSpacing: 5, opacity: detailOpacity }}>
        YOSEMITE // UPPER FALLS
      </div>
      <div style={{ position: 'absolute', right: 112, top: 84, display: 'flex', alignItems: 'center', gap: 22, color, opacity: detailOpacity }}>
        <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: 3 }}>01 / 06</span>
        <span style={{ width: 22, height: 22, borderRadius: 999, background: color }} />
      </div>
      <CueFrameLogo opacity={detailOpacity} />
    </AbsoluteFill>
  );
}
