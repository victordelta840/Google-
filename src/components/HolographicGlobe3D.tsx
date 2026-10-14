import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export type GlobeState = 'IDLE' | 'SPEAKING' | 'AUTHENTICATING' | 'SUCCESS';

interface HolographicGlobe3DProps {
  state: GlobeState;
  size?: number;
  className?: string;
  audioLevel?: number; // 0 to 1 for real-time voice reactivity
  onSuccessAnimationComplete?: () => void;
}

export const HolographicGlobe3D: React.FC<HolographicGlobe3DProps> = ({
  state,
  size = 360,
  className = '',
  audioLevel = 0,
  onSuccessAnimationComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const globeGroupRef = useRef<THREE.Group | null>(null);
  const shockwaveRef = useRef<THREE.Mesh | null>(null);
  const scanRingUpperRef = useRef<THREE.LineSegments | null>(null);
  const scanRingLowerRef = useRef<THREE.LineSegments | null>(null);
  const acousticWaveRingRef = useRef<THREE.LineSegments | null>(null);
  const animFrameId = useRef<number | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Material references to animate colors and uniforms
  const wireframeMatRef = useRef<THREE.LineBasicMaterial | null>(null);
  const pointsMatRef = useRef<THREE.PointsMaterial | null>(null);
  const innerSphereMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const orbitalRingMatRef = useRef<THREE.LineBasicMaterial | null>(null);
  const scanRingMatRef = useRef<THREE.LineBasicMaterial | null>(null);
  const acousticMatRef = useRef<THREE.LineBasicMaterial | null>(null);

  // Audio level ref so animation frame accesses latest value without recreating scene
  const audioLevelRef = useRef<number>(audioLevel);
  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  // State ref
  const stateRef = useRef<GlobeState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Success animation progression (0 to 1)
  const successProgressRef = useRef<number>(0);
  const isPlayingSuccessRef = useRef<boolean>(false);

  // Four-Phase Visual State Colors (Strict Compliance with Specification Section 3)
  const colors = {
    IDLE: new THREE.Color(0x10b981), // Emerald Green (Waiting/Idle)
    SPEAKING: new THREE.Color(0xa855f7), // Dynamic Violet (Speaking / Hope Greeting)
    AUTHENTICATING: new THREE.Color(0xfacc15), // Golden Yellow (Authenticating / Scan)
    SUCCESS: new THREE.Color(0x00f0ff), // Cyan-Electric Burst (Success / Unlocked)
  };

  const currentColorRef = useRef<THREE.Color>(colors.IDLE.clone());
  const targetColorRef = useRef<THREE.Color>(colors.IDLE.clone());

  // Update target color whenever state changes
  useEffect(() => {
    if (state === 'SUCCESS') {
      isPlayingSuccessRef.current = true;
      successProgressRef.current = 0;
      targetColorRef.current.copy(colors.SUCCESS);
    } else {
      targetColorRef.current.copy(colors[state]);
    }
  }, [state]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const width = container.clientWidth || size;
    const height = container.clientHeight || size;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 245;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0); // Transparent background
      container.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (err) {
      console.warn('[ASTRA-3D] WebGL context initialization failed:', err);
      setWebglError('WebGL context not available on this browser/GPU.');
      return;
    }

    // 2. Build Globe Hierarchy
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);
    globeGroupRef.current = globeGroup;

    const globeRadius = 68;

    // A. Inner dark core with subtle rim glow
    const innerGeom = new THREE.SphereGeometry(globeRadius * 0.95, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x040814,
      transparent: true,
      opacity: 0.9,
      wireframe: false,
    });
    innerSphereMatRef.current = innerMat;
    const innerSphere = new THREE.Mesh(innerGeom, innerMat);
    globeGroup.add(innerSphere);

    // B. Holographic Wireframe Meridians & Parallels (Lat/Long Grid)
    const wireframeGeom = new THREE.WireframeGeometry(
      new THREE.SphereGeometry(globeRadius, 26, 20)
    );
    const wireframeMat = new THREE.LineBasicMaterial({
      color: colors.IDLE,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
    });
    wireframeMatRef.current = wireframeMat;
    const wireframeLines = new THREE.LineSegments(wireframeGeom, wireframeMat);
    globeGroup.add(wireframeLines);

    // C. Glowing Holographic Surface Particle Cloud (Fibonacci Sphere)
    const particleCount = 850;
    const particlePositions = new Float32Array(particleCount * 3);
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < particleCount; i++) {
      const y = 1 - (i / (particleCount - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Slight radial variation for tactile holographic depth
      const r = globeRadius * (1.0 + (Math.random() * 0.05 - 0.025));
      particlePositions[i * 3] = x * r;
      particlePositions[i * 3 + 1] = y * r;
      particlePositions[i * 3 + 2] = z * r;
    }

    const pointsGeom = new THREE.BufferGeometry();
    pointsGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const pointsMat = new THREE.PointsMaterial({
      color: colors.IDLE,
      size: 2.4,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
    });
    pointsMatRef.current = pointsMat;
    const particleCloud = new THREE.Points(pointsGeom, pointsMat);
    globeGroup.add(particleCloud);

    // D. Outer Diagonal Orbital Rings
    const orbitalRingGeom = new THREE.RingGeometry(globeRadius * 1.28, globeRadius * 1.30, 64);
    const orbitalRingWire = new THREE.WireframeGeometry(orbitalRingGeom);
    const orbitalRingMat = new THREE.LineBasicMaterial({
      color: colors.IDLE,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    orbitalRingMatRef.current = orbitalRingMat;
    const orbitalRingMesh = new THREE.LineSegments(orbitalRingWire, orbitalRingMat);
    orbitalRingMesh.rotation.x = Math.PI / 3;
    globeGroup.add(orbitalRingMesh);

    // E. Dynamic Equatorial Acoustic Wave Ring (For SPEAKING Violet mode)
    const acousticGeom = new THREE.RingGeometry(globeRadius * 1.15, globeRadius * 1.17, 64);
    const acousticWire = new THREE.WireframeGeometry(acousticGeom);
    const acousticMat = new THREE.LineBasicMaterial({
      color: colors.SPEAKING,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    acousticMatRef.current = acousticMat;
    const acousticMesh = new THREE.LineSegments(acousticWire, acousticMat);
    acousticMesh.rotation.x = Math.PI / 2;
    globeGroup.add(acousticMesh);
    acousticWaveRingRef.current = acousticMesh;

    // F. Concentric Golden-Yellow Scanning Rings (For AUTHENTICATING mode)
    const scanRingGeom = new THREE.RingGeometry(globeRadius * 1.02, globeRadius * 1.04, 64);
    const scanRingWire = new THREE.WireframeGeometry(scanRingGeom);
    const scanRingMat = new THREE.LineBasicMaterial({
      color: colors.AUTHENTICATING,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    scanRingMatRef.current = scanRingMat;

    const scanRingUpper = new THREE.LineSegments(scanRingWire, scanRingMat);
    scanRingUpper.rotation.x = Math.PI / 2;
    globeGroup.add(scanRingUpper);
    scanRingUpperRef.current = scanRingUpper;

    const scanRingLower = new THREE.LineSegments(scanRingWire, scanRingMat);
    scanRingLower.rotation.x = Math.PI / 2;
    globeGroup.add(scanRingLower);
    scanRingLowerRef.current = scanRingLower;

    // G. Cinematic Success Shockwave Ring
    const shockwaveGeom = new THREE.RingGeometry(globeRadius * 0.9, globeRadius * 1.08, 64);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shockwave = new THREE.Mesh(shockwaveGeom, shockwaveMat);
    shockwave.visible = false;
    scene.add(shockwave);
    shockwaveRef.current = shockwave;

    // 3. Animation Loop
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameId.current = requestAnimationFrame(animate);

      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();
      const currentState = stateRef.current;
      const currentLevel = audioLevelRef.current;

      // Smooth color lerp towards target state color (smooth 4-phase visual transitions)
      currentColorRef.current.lerp(targetColorRef.current, 0.08);

      const r = currentColorRef.current.r;
      const g = currentColorRef.current.g;
      const b = currentColorRef.current.b;

      if (wireframeMatRef.current) wireframeMatRef.current.color.setRGB(r, g, b);
      if (pointsMatRef.current) pointsMatRef.current.color.setRGB(r, g, b);
      if (orbitalRingMatRef.current) orbitalRingMatRef.current.color.setRGB(r, g, b);

      // Rotation Speed based on state and reduced motion
      const baseRotationSpeed = prefersReducedMotion ? 0.05 : 0.36;
      const rotationMultiplier =
        currentState === 'SPEAKING'
          ? 1.5
          : currentState === 'AUTHENTICATING'
          ? 2.3
          : currentState === 'SUCCESS'
          ? 1.2
          : 1.0;

      if (globeGroupRef.current) {
        globeGroupRef.current.rotation.y += baseRotationSpeed * rotationMultiplier * delta;

        // Visual State 1: IDLE (soft emerald breathing glow)
        if (currentState === 'IDLE') {
          const idleScale = 1.0 + Math.sin(elapsedTime * 1.8) * 0.018;
          globeGroupRef.current.scale.set(idleScale, idleScale, idleScale);

          if (acousticWaveRingRef.current) acousticWaveRingRef.current.visible = false;
          if (scanRingUpperRef.current) scanRingUpperRef.current.visible = false;
          if (scanRingLowerRef.current) scanRingLowerRef.current.visible = false;
        }

        // Visual State 2: SPEAKING (dynamic violet voice-reactive cadence)
        else if (currentState === 'SPEAKING') {
          if (acousticWaveRingRef.current) {
            acousticWaveRingRef.current.visible = true;
            // Voice-reactive acoustic ring expansion synchronized with speech
            const reactiveBoost = currentLevel > 0 ? currentLevel * 0.28 : Math.sin(elapsedTime * 8.0) * 0.08 + 0.1;
            const acousticScale = 1.0 + reactiveBoost;
            acousticWaveRingRef.current.scale.set(acousticScale, acousticScale, acousticScale);
            if (acousticMatRef.current) {
              acousticMatRef.current.opacity = 0.5 + Math.min(0.5, (currentLevel || 0.4) * 0.7);
            }
          }

          if (scanRingUpperRef.current) scanRingUpperRef.current.visible = false;
          if (scanRingLowerRef.current) scanRingLowerRef.current.visible = false;

          // Globe breathing scale reacting to voice energy
          const speakScale = 1.0 + (currentLevel > 0 ? currentLevel * 0.07 : Math.sin(elapsedTime * 7.0) * 0.04);
          globeGroupRef.current.scale.set(speakScale, speakScale, speakScale);
        }

        // Visual State 3: AUTHENTICATING (golden-yellow oscillating laser scan rings)
        else if (currentState === 'AUTHENTICATING') {
          if (acousticWaveRingRef.current) acousticWaveRingRef.current.visible = false;

          if (scanRingUpperRef.current && scanRingLowerRef.current) {
            scanRingUpperRef.current.visible = true;
            scanRingLowerRef.current.visible = true;

            // Oscillate scan rings vertically up and down through the globe
            const scanOffset = Math.sin(elapsedTime * 3.4) * (globeRadius * 0.88);
            scanRingUpperRef.current.position.y = scanOffset;
            scanRingLowerRef.current.position.y = -scanOffset;

            // Scale to match sphere cross-section at height y
            const radiusAtUpperY = Math.sqrt(
              Math.max(0.1, globeRadius * globeRadius - scanOffset * scanOffset)
            );
            const scaleRatio = (radiusAtUpperY / globeRadius) * 1.03;
            scanRingUpperRef.current.scale.set(scaleRatio, scaleRatio, scaleRatio);
            scanRingLowerRef.current.scale.set(scaleRatio, scaleRatio, scaleRatio);
          }

          const authPulse = 1.0 + Math.sin(elapsedTime * 4.5) * 0.035;
          globeGroupRef.current.scale.set(authPulse, authPulse, authPulse);
        }

        // Visual State 4: SUCCESS (cyan burst confirmation)
        else if (currentState === 'SUCCESS') {
          if (acousticWaveRingRef.current) acousticWaveRingRef.current.visible = false;
          if (scanRingUpperRef.current) scanRingUpperRef.current.visible = false;
          if (scanRingLowerRef.current) scanRingLowerRef.current.visible = false;
        }
      }

      // Handle Cinematic Success Shockwave Animation
      if (isPlayingSuccessRef.current && shockwaveRef.current) {
        successProgressRef.current += delta * 1.15;
        const p = successProgressRef.current;

        shockwaveRef.current.visible = true;
        const shockScale = 1.0 + p * 3.2;
        shockwaveRef.current.scale.set(shockScale, shockScale, shockScale);

        const shockMat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
        shockMat.opacity = Math.max(0, 1.0 - p);

        if (p >= 1.0) {
          isPlayingSuccessRef.current = false;
          shockwaveRef.current.visible = false;
          targetColorRef.current.copy(colors.IDLE);
          onSuccessAnimationComplete?.();
        }
      }

      renderer.render(scene, camera);
    };

    // Auto-start animation immediately on component mount without requiring button press!
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current) return;
      const newWidth = container.clientWidth || size;
      const newHeight = container.clientHeight || size;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(newWidth, newHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Cleanup on unmount to prevent duplicate loops or memory leaks
    return () => {
      if (animFrameId.current !== null) {
        cancelAnimationFrame(animFrameId.current);
      }
      resizeObserver.disconnect();

      innerGeom.dispose();
      innerMat.dispose();
      wireframeGeom.dispose();
      wireframeMat.dispose();
      pointsGeom.dispose();
      pointsMat.dispose();
      orbitalRingGeom.dispose();
      orbitalRingMat.dispose();
      acousticGeom.dispose();
      acousticMat.dispose();
      scanRingGeom.dispose();
      scanRingMat.dispose();
      shockwaveGeom.dispose();
      shockwaveMat.dispose();

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement && rendererRef.current.domElement.parentNode) {
          rendererRef.current.domElement.parentNode.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [size, onSuccessAnimationComplete]);

  if (webglError) {
    // Graceful fallback if WebGL is unavailable on device
    return (
      <div
        className={`relative flex flex-col items-center justify-center p-6 text-center select-none ${className}`}
        style={{ width: size, height: size }}
      >
        <div
          className={`w-44 h-44 rounded-full border-2 border-dashed flex items-center justify-center animate-spin ${
            state === 'SPEAKING'
              ? 'border-purple-400'
              : state === 'AUTHENTICATING'
              ? 'border-amber-400'
              : state === 'SUCCESS'
              ? 'border-cyan-400'
              : 'border-emerald-400'
          }`}
          style={{ animationDuration: '9s' }}
        >
          <div
            className={`w-28 h-28 rounded-full border flex items-center justify-center ${
              state === 'SPEAKING'
                ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                : state === 'AUTHENTICATING'
                ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            }`}
          >
            <span className="font-hud text-xs tracking-widest">{state}</span>
          </div>
        </div>
        <p className="text-[10px] font-code text-slate-400 mt-3">
          Fallback Hologram (2D Vector Mode)
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label={`3D Holographic Globe (${state})`}
    >
      {/* Dynamic Background radial glow matching the exact state */}
      <div
        className={`absolute inset-4 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
          state === 'SPEAKING'
            ? 'bg-purple-600/30 shadow-[0_0_80px_rgba(168,85,247,0.45)] scale-105'
            : state === 'AUTHENTICATING'
            ? 'bg-amber-500/25 shadow-[0_0_80px_rgba(234,179,8,0.4)] scale-105'
            : state === 'SUCCESS'
            ? 'bg-cyan-400/40 shadow-[0_0_100px_rgba(0,240,255,0.55)] scale-110'
            : 'bg-emerald-500/20 shadow-[0_0_60px_rgba(16,185,129,0.3)]'
        }`}
      />

      {/* Three.js canvas container */}
      <div ref={mountRef} className="w-full h-full relative z-10" />

      {/* Target Reticle Ring Overlays for tactical sci-fi HUD appearance */}
      <div className="absolute inset-2 rounded-full border border-cyan-500/15 pointer-events-none" />
      <div className="absolute inset-8 rounded-full border border-blue-500/10 pointer-events-none" />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[110%] h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
      </div>
    </div>
  );
};
