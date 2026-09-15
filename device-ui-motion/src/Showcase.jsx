import React, {useMemo} from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import DeviceScene from './render/DeviceScene.jsx';
import {enter} from './core/motion.mjs';
import {resolveParams, sourceFrame} from './showcase/params.mjs';
import {sampleState, validateMountedControls} from './showcase/choreography.mjs';
import {screenMap} from './showcase/product-screen.mjs';
function Logo({ opacity, config }) {
  const { width } = useVideoConfig();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: width * 0.019,
        color: config.color,
        opacity,
        fontFamily: config.fontFamily,
        fontSize: width * 0.054,
        fontWeight: 500,
        letterSpacing: -width * 0.0025,
      }}
    >
      {config.showMark && (
        <svg width={width * 0.059} height={width * 0.059} viewBox="0 0 40 40">
          <rect x="5" y="5" width="30" height="30" rx="8" fill="none" stroke={config.color} strokeWidth="3" />
        </svg>
      )}
      <span>{config.text}</span>
    </div>
  );
}

export default function DeviceUIMotion({ params, assets, render }) {
  const config = useMemo(() => resolveParams(params), [params]);
  const { width, height } = useVideoConfig(),
    frame = sourceFrame(config, render);
  const pictureHeight = width / config.picture.aspect,
    top = (height - pictureHeight) / 2;
  const end = frame >= config.timeline.cuts[2];
  return (
    <AbsoluteFill style={{ background: config.picture.background }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top,
          width,
          height: pictureHeight,
          overflow: "hidden",
          opacity: enter(frame, ...config.timeline.fadeIn),
        }}
      >
        <ThreeCanvas
          width={width}
          height={pictureHeight}
          flat
          shadows
          camera={{ fov: config.camera.fov, near: 0.01, far: 200 }}
          gl={{ antialias: true, alpha: false }}
        >
          {end ? (
            <color attach="background" args={[config.picture.background]} />
          ) : (
            <DeviceScene
              sampleState={sampleState}
              validateState={validateMountedControls}
              makeScreen={screenMap}
              assets={assets}
              frame={frame}
              config={config}
              diagnostic={config.diagnostic}
            />
          )}
        </ThreeCanvas>
        {end && (
          <Logo
            config={config.endCard}
            opacity={
              enter(frame, ...config.timeline.logoIn) *
              (1 - enter(frame, ...config.timeline.logoOut))
            }
          />
        )}
      </div>
    </AbsoluteFill>
  );
}
