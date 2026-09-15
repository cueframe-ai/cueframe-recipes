import React, {useMemo, useLayoutEffect} from 'react';
import {useLoader, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {FrameDepthOfField} from '@cueframe/animate';
import {parseModel, normalizeModel, displaySurface, length, sub} from '../core/device-core.mjs';
import {controlWorld, screenUv, cameraFit} from '../core/motion.mjs';
import {glassLayers} from '../core/materials.mjs';
import {texture} from './textures.mjs';
import {GlassControl} from './GlassControls.jsx';
function CameraRig({ surface, state, config }) {
  const { camera } = useThree();
  const pos = cameraFit(surface, state, config);
  useLayoutEffect(() => {
    camera.position.set(...pos);
    camera.lookAt(pos[0], pos[1], pos[2] - 1);
    camera.updateMatrixWorld();
  }, [camera, ...pos]);
  return null;
}
export default function DeviceScene({ assets, frame, config, sampleState, validateState, makeScreen, diagnostic = false }) {
  const raw = useLoader(THREE.FileLoader, assets.model.handle);
  const model = useMemo(
    () => normalizeModel(parseModel(raw), config.device),
    [
      raw,
      config.device.displayMesh,
      ...config.device.right,
      ...config.device.up,
      ...config.device.normal,
      config.device.flipWinding,
      config.device.confirmBaked,
    ],
  );
  const surface = useMemo(
    () =>
      displaySurface(
        model,
        config.device.displayMesh,
        config.device.pixelWidth,
        config.device.clearance,
      ),
    [model, config.device.pixelWidth, config.device.clearance],
  );
  const state = sampleState(surface, frame, config);
  useMemo(() => validateState(surface, config), [surface, config, validateState]);
  if (diagnostic) {
    state.rotation = frame % 2 === 0 ? [0, 0, 0] : [-0.45, -0.4, -0.12];
    state.visible = state.controls.map((c) => ({
      ...c,
      scale: 1,
      stretch: [1, 1],
      thickness: 1,
      frost: 1,
      rotation: [0, 0, 0],
      reveal: 1,
      icons: c.icons.map((i) => ({ ...i, reveal: 1 })),
    }));
    state.diagnostic = true;
  }
  return config.screen.source === "asset" ? (
    <AssetScreenScene
      surface={surface}
      model={model}
      state={state}
      config={config}
      frame={frame}
      diagnostic={diagnostic}
      assets={assets}
    />
  ) : (
    <SimulatedScreenScene
      makeScreen={makeScreen}
      surface={surface}
      model={model}
      state={state}
      config={config}
      frame={frame}
      diagnostic={diagnostic}
    />
  );
}
function SimulatedScreenScene(props) {
  const screen = useMemo(
    () => props.makeScreen(props.surface, props.config.screen),
    [props.surface, props.config.screen, props.makeScreen],
  );
  useLayoutEffect(() => () => screen.dispose(), [screen]);
  return <SceneContents {...props} screen={screen} />;
}
function AssetScreenScene(props) {
  if (!props.assets.screen?.handle)
    throw Error("screen.source=asset requires the screen asset binding");
  const loaded = useLoader(THREE.TextureLoader, props.assets.screen.handle);
  const screen = useMemo(() => {
    const t = loaded.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16;
    t.needsUpdate = true;
    return t;
  }, [loaded]);
  useLayoutEffect(() => () => screen.dispose(), [screen]);
  if (
    Math.abs(
      screen.image.width / screen.image.height -
        props.surface.width / props.surface.height,
    ) > 0.01
  )
    throw Error(
      "Screen asset aspect must match native display; provide a portrait screen capture without device hardware",
    );
  return <SceneContents {...props} screen={screen} />;
}
function SceneContents({
  surface,
  model,
  state,
  config,
  frame,
  diagnostic,
  screen,
}) {
  const layers = glassLayers(config.glass);
  const frostedScreen = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = screen.image.width;
    c.height = screen.image.height;
    const ctx = c.getContext("2d");
    ctx.filter = "blur(" + config.glass.frostBlur + "px)";
    ctx.drawImage(screen.image, 0, 0);
    return texture(c);
  }, [screen, config.glass.frostBlur]);
  useLayoutEffect(
    () => () => {
      frostedScreen.dispose();
    },
    [screen, frostedScreen],
  );
  const focusBox = state.focusBox ?? state.focus.box;
  const cameraPosition = cameraFit(surface, state, config),
    target = controlWorld(
      surface,
      focusBox,
      state.focus.z + layers.icon,
      state.rotation,
    );
  const distance = length(sub(cameraPosition, target));
  const parts = useMemo(
    () =>
      model.meshes.map((m) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(m.positions, 3),
        );
        g.setIndex(m.indices);
        if (m.name === config.device.displayMesh) {
          const uv = [];
          for (let i = 0; i < m.positions.length; i += 3)
            uv.push(...screenUv(surface, m.positions[i], m.positions[i + 1]));
          g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        }
        g.computeVertexNormals();
        return { m, g };
      }),
    [model, surface],
  );
  useLayoutEffect(() => () => parts.forEach(({ g }) => g.dispose()), [parts]);
  return (
    <>
      <CameraRig surface={surface} state={state} config={config} />
      {!diagnostic && config.focus.enabled && (
        <FrameDepthOfField
          focusDistance={distance}
          focusRange={state.focusRange}
          bokehScale={config.focus.bokeh}
          resolutionScale={config.focus.resolutionScale}
        />
      )}
      <ambientLight intensity={config.lighting.ambient} />
      <directionalLight {...config.lighting.key} />
      <directionalLight {...config.lighting.fill} />
      <group name="native-device-root" rotation={state.rotation}>
        {parts.map(({ m, g }) => (
          <mesh key={m.name} name={m.name} geometry={g}>
            {m.name === config.device.displayMesh ? (
              <meshBasicMaterial map={screen} toneMapped={false} />
            ) : (
              <meshPhysicalMaterial
                color={
                  m.material === "screen"
                    ? config.hardware.screenColor
                    : config.hardware.color
                }
                metalness={
                  m.material === "frame"
                    ? config.hardware.frameMetalness
                    : config.hardware.metalness
                }
                roughness={config.hardware.roughness}
                clearcoat={config.hardware.clearcoat}
                side={THREE.DoubleSide}
              />
            )}
          </mesh>
        ))}
        <group
          name="screen-coordinate-system"
          position={surface.origin}
          scale={surface.unit}
        >
          <group position={[-surface.width / 2, surface.height / 2, 0]}>
            {state.visible.map((control) => (
              <GlassControl
                config={config}
                key={control.id}
                control={control}
                screen={screen}
                frostedScreen={frostedScreen}
                surface={surface}
                frame={frame}
              />
            ))}
          </group>
        </group>
      </group>
    </>
  );
}
