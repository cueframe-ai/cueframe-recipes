import React, {useMemo, useLayoutEffect} from 'react';
import * as THREE from 'three';
import {GlassSurface} from './GlassSurface.jsx';
import {texture} from './textures.mjs';
import {glassLayers} from '../core/materials.mjs';
import {highlightLayout, highlightOutline} from '../core/highlight.mjs';
function SelectionHighlight({ control, layers, config }) {
  const settings = control.highlight;
  const box = highlightLayout(
    control.box.width,
    control.box.height,
    control.icons.length,
    settings,
  );
  const geometry = useMemo(
    () =>
      new THREE.ShapeGeometry(
        new THREE.Shape(
          highlightOutline(box, settings.shape).map(
            ([x, y]) => new THREE.Vector2(x, y),
          ),
        ),
      ),
    [box.width, box.height, box.radius, settings.shape],
  );
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      name="navbar-selection"
      geometry={geometry}
      renderOrder={11}
      position={[box.x, box.y, layers.selection]}
    >
      <meshBasicMaterial
        color={config.glass.selectionColor}
        transparent
        opacity={
          config.glass.selectionOpacity *
          control.selectionReveal *
          control.reveal
        }
        depthTest
        depthWrite={false}
      />
    </mesh>
  );
}

function drawIcon(ctx, type, style) {
  ctx.strokeStyle = style.color;
  ctx.fillStyle = style.color;
  ctx.lineWidth = style.strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (type === "compose") {
    ctx.moveTo(47, 17);
    ctx.lineTo(29, 17);
    ctx.quadraticCurveTo(16, 17, 16, 30);
    ctx.lineTo(16, 75);
    ctx.quadraticCurveTo(16, 88, 29, 88);
    ctx.lineTo(74, 88);
    ctx.quadraticCurveTo(87, 88, 87, 75);
    ctx.lineTo(87, 54);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(48, 57);
    ctx.lineTo(89, 16);
    ctx.stroke();
  } else if (type === "search") {
    ctx.arc(43, 42, 25, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(62, 62);
    ctx.lineTo(84, 87);
    ctx.stroke();
  } else if (type === "home") {
    ctx.moveTo(11, 43);
    ctx.quadraticCurveTo(10, 38, 17, 34);
    ctx.lineTo(45, 13);
    ctx.quadraticCurveTo(50, 9, 57, 13);
    ctx.lineTo(84, 31);
    ctx.quadraticCurveTo(89, 34, 89, 40);
    ctx.lineTo(89, 83);
    ctx.quadraticCurveTo(89, 89, 81, 89);
    ctx.lineTo(63, 89);
    ctx.lineTo(63, 60);
    ctx.quadraticCurveTo(63, 55, 57, 55);
    ctx.lineTo(45, 55);
    ctx.quadraticCurveTo(39, 55, 39, 61);
    ctx.lineTo(39, 89);
    ctx.lineTo(18, 89);
    ctx.quadraticCurveTo(11, 89, 11, 82);
    ctx.closePath();
    ctx.stroke();
  } else if (type === "inbox") {
    ctx.moveTo(25, 22);
    ctx.lineTo(75, 22);
    ctx.lineTo(90, 66);
    ctx.lineTo(90, 84);
    ctx.lineTo(10, 84);
    ctx.lineTo(10, 66);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(12, 61);
    ctx.lineTo(33, 61);
    ctx.lineTo(40, 73);
    ctx.lineTo(61, 73);
    ctx.lineTo(68, 61);
    ctx.lineTo(87, 61);
    ctx.stroke();
  } else if (type === "focus") {
    for (const [x, y, a] of [
      [29, 25, Math.PI],
      [73, 25, -Math.PI / 2],
      [73, 73, 0],
      [29, 73, Math.PI / 2],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 13, a, a + Math.PI / 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(51, 49, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "layers") {
    ctx.moveTo(19, 38);
    ctx.lineTo(50, 17);
    ctx.lineTo(81, 38);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(19, 63);
    ctx.lineTo(50, 84);
    ctx.lineTo(81, 63);
    ctx.stroke();
  }
}
function iconMap(type, style) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d");
  ctx.scale(5.12, 5.12);
  drawIcon(ctx, type, style);
  return texture(c);
}
function Icon({ type, size, x, y, parent, show = 1, selected = true, layers, style }) {
  const map = useMemo(
    () => iconMap(type, style),
    [type, style.color, style.strokeWidth],
  );
  useLayoutEffect(() => () => map.dispose(), [map]);
  return (
    <mesh
      name={"icon:" + type}
      renderOrder={12}
      position={[x - parent.width / 2, parent.height / 2 - y, layers.icon]}
    >
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial
        map={map}
        transparent
        opacity={show * (selected ? 1 : style.inactiveOpacity)}
        depthTest
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}
function glassGeometry(w, h, layers) {
  const s = new THREE.Shape(),
    r = h / 2 - layers.bevel,
    c = w / 2 - h / 2;
  s.moveTo(-c, -r);
  s.lineTo(c, -r);
  s.absarc(c, 0, r, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-c, r);
  s.absarc(-c, 0, r, Math.PI / 2, (3 * Math.PI) / 2, false);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: layers.depth,
    bevelEnabled: true,
    bevelSize: layers.bevel,
    bevelThickness: layers.bevel,
    bevelSegments: 6,
    curveSegments: 48,
  });
  g.translate(0, 0, layers.bevel);
  return g;
}
export function GlassControl({
  control,
  frame,
  screen,
  frostedScreen,
  surface,
  config,
}) {
  const glass = config.glass,
    layers = glassLayers(glass);
  const b = control.box,
    w = b.width,
    h = b.height;
  const geometry = useMemo(
    () => glassGeometry(w, h, layers),
    [w, h, glass.depth, glass.bevel],
  );
  const show = control.reveal,
    scale = control.scale;
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group
      name={"glass:" + control.id}
      position={[b.x + w / 2, -b.y - h / 2, control.z]}
    >
      <group
        rotation={control.rotation}
        scale={[
          scale * control.stretch[0],
          scale * control.stretch[1],
          Math.max(0.03, control.thickness),
        ]}
      >
        <mesh
          name={"glass-volume:" + control.id}
          geometry={geometry}
          renderOrder={8}
        >
          <meshBasicMaterial
            attach="material-0"
            transparent
            opacity={0}
            depthWrite={false}
          />
          <meshPhysicalMaterial
            attach="material-1"
            color={glass.color}
            roughness={glass.roughness}
            metalness={0}
            transmission={glass.transmission}
            thickness={glass.opticalThickness}
            ior={glass.ior}
            clearcoat={glass.clearcoat}
            clearcoatRoughness={glass.clearcoatRoughness}
            transparent
            opacity={show * control.frost}
            depthWrite={false}
          />
        </mesh>
        <group position={[0, 0, layers.face]}>
          <GlassSurface
            glass={glass}
            screen={screen}
            frostedScreen={frostedScreen}
            surface={surface}
            control={control}
            frame={frame}
            lift={
              (surface.origin[2] - surface.glassZ) / surface.unit +
              control.z +
              layers.face * Math.max(0.03, control.thickness)
            }
          />
        </group>
        {control.highlight && (
          <SelectionHighlight
            control={control}
            layers={layers}
            config={config}
          />
        )}
        {control.icons.map((icon) => (
          <Icon
            layers={layers}
            style={config.icons}
            key={icon.type}
            type={icon.type}
            size={icon.size}
            x={icon.x}
            y={icon.y}
            parent={b}
            show={icon.reveal * show}
            selected={icon.selected}
          />
        ))}
      </group>
    </group>
  );
}
