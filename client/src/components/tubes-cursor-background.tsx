import { useEffect, useRef } from "react";
import * as THREE from "three";

interface TubesCursorBackgroundProps {
  className?: string;
  colors?: number[];
  enabled?: boolean;
  reduceMotion?: boolean;
}

// Vivid neon palette inspired by reference — magenta, violet, cyan, hot pink, indigo.
const DEFAULT_COLORS = [0xff00aa, 0x9d00ff, 0x00e5ff, 0xff3d8b, 0x6366f1, 0xff7ad9];
const NUM_TUBES = 7;

const TUBE_SEGMENTS = 48;
const TUBE_RADIAL = 8;
const TUBE_RADIUS = 0.05;

function buildTubeBufferGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const vertCount = (TUBE_SEGMENTS + 1) * (TUBE_RADIAL + 1);
  const positions = new Float32Array(vertCount * 3);
  const normals = new Float32Array(vertCount * 3);
  const indices: number[] = [];
  for (let i = 0; i < TUBE_SEGMENTS; i++) {
    for (let j = 0; j < TUBE_RADIAL; j++) {
      const a = i * (TUBE_RADIAL + 1) + j;
      const b = (i + 1) * (TUBE_RADIAL + 1) + j;
      const c = (i + 1) * (TUBE_RADIAL + 1) + (j + 1);
      const d = i * (TUBE_RADIAL + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 50);
  return geo;
}

const _tmpV1 = new THREE.Vector3();
const _tmpV2 = new THREE.Vector3();
const _tmpV3 = new THREE.Vector3();
const _tmpAxis = new THREE.Vector3();

function updateTubeGeometryFromCurve(geo: THREE.BufferGeometry, curve: THREE.CatmullRomCurve3) {
  const positions = geo.attributes.position as THREE.BufferAttribute;
  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const posArr = positions.array as Float32Array;
  const normArr = normals.array as Float32Array;

  let refNormal = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= TUBE_SEGMENTS; i++) {
    const t = i / TUBE_SEGMENTS;
    const point = curve.getPointAt(Math.min(t, 1), _tmpV1);
    const tangent = curve.getTangentAt(Math.min(t, 1), _tmpV2).normalize();

    if (i === 0 && Math.abs(tangent.dot(refNormal)) > 0.9) {
      refNormal = new THREE.Vector3(1, 0, 0);
    }
    const normal = _tmpV3.copy(refNormal).addScaledVector(tangent, -refNormal.dot(tangent)).normalize();
    refNormal = normal.clone();
    const binormal = _tmpAxis.crossVectors(tangent, normal).normalize();

    for (let j = 0; j <= TUBE_RADIAL; j++) {
      const v = (j / TUBE_RADIAL) * Math.PI * 2;
      const cos = Math.cos(v);
      const sin = Math.sin(v);
      const nx = cos * normal.x + sin * binormal.x;
      const ny = cos * normal.y + sin * binormal.y;
      const nz = cos * normal.z + sin * binormal.z;

      const idx = (i * (TUBE_RADIAL + 1) + j) * 3;
      posArr[idx] = point.x + nx * TUBE_RADIUS;
      posArr[idx + 1] = point.y + ny * TUBE_RADIUS;
      posArr[idx + 2] = point.z + nz * TUBE_RADIUS;
      normArr[idx] = nx;
      normArr[idx + 1] = ny;
      normArr[idx + 2] = nz;
    }
  }
  positions.needsUpdate = true;
  normals.needsUpdate = true;
}

export default function TubesCursorBackground({
  className,
  colors = DEFAULT_COLORS,
  enabled = true,
  reduceMotion = false,
}: TubesCursorBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled || reduceMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      return;
    }
    if (!renderer) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x05060a, 6, 24);

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    const cursorTarget = new THREE.Vector3(0, 0, 0);
    const easedTarget = new THREE.Vector3(0, 0, 0);

    // rAF-throttled pointer state — store latest screen pos, only project once per frame
    let pendingPointer: { x: number; y: number } | null = null;

    interface TubeData {
      mesh: THREE.Mesh;
      geometry: THREE.BufferGeometry;
      material: THREE.MeshBasicMaterial;
      offset: THREE.Vector3;
      phase: number;
      speed: number;
      colorIndex: number;
      baseColor: THREE.Color;
      altColor: THREE.Color;
      curve: THREE.CatmullRomCurve3;
      curvePts: THREE.Vector3[];
    }

    const tubes: TubeData[] = [];

    function buildTube(idx: number): TubeData {
      const baseHex = colors[idx % colors.length];
      const altHex = colors[(idx + 1) % colors.length];
      const geometry = buildTubeBufferGeometry();
      const material = new THREE.MeshBasicMaterial({
        color: baseHex,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);

      const N = 8;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < N; k++) pts.push(new THREE.Vector3());
      const curve = new THREE.CatmullRomCurve3(pts);
      curve.curveType = "catmullrom";
      curve.tension = 0.5;

      return {
        mesh,
        geometry,
        material,
        offset: new THREE.Vector3(
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 4,
          (Math.random() - 0.5) * 4,
        ),
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
        colorIndex: idx,
        baseColor: new THREE.Color(baseHex),
        altColor: new THREE.Color(altHex),
        curve,
        curvePts: pts,
      };
    }

    for (let i = 0; i < NUM_TUBES; i++) tubes.push(buildTube(i));

    // Bright bloom-like sprite at the cursor origin (additive layered) for the
    // "neon flare" core look from the reference.
    const flareGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const flareMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flare = new THREE.Mesh(flareGeo, flareMat);
    scene.add(flare);

    const flareGlowGeo = new THREE.SphereGeometry(0.6, 24, 24);
    const flareGlowMat = new THREE.MeshBasicMaterial({
      color: 0xff66cc,
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flareGlow = new THREE.Mesh(flareGlowGeo, flareGlowMat);
    scene.add(flareGlow);

    function updateTube(t: TubeData, time: number) {
      // All tubes ORIGINATE at the cursor and trail outward to a floating offset
      // direction unique to each tube — fireworks/comet-tail look from reference.
      const start = t.curvePts[0];
      start.copy(easedTarget);

      // Direction this tube trails (gently rotating around cursor)
      const dirX = Math.cos(time * t.speed * 0.4 + t.phase);
      const dirY = Math.sin(time * t.speed * 0.4 + t.phase);
      const dirZ = Math.sin(time * 0.3 + t.phase) * 0.4;
      const reach = 4.5 + Math.sin(time * 0.6 + t.phase) * 1.2;

      const endX = easedTarget.x + dirX * reach + t.offset.x * 0.25;
      const endY = easedTarget.y + dirY * reach + t.offset.y * 0.25;
      const endZ = easedTarget.z + dirZ * reach + t.offset.z * 0.25;

      const N = t.curvePts.length;
      for (let i = 1; i < N; i++) {
        const k = i / (N - 1);
        const p = t.curvePts[i];
        p.set(
          easedTarget.x + (endX - easedTarget.x) * k,
          easedTarget.y + (endY - easedTarget.y) * k,
          easedTarget.z + (endZ - easedTarget.z) * k,
        );
        // Wave amount grows with k so the tail flares out, while origin stays tight to cursor
        const wave = k * (1 - k) * 1.6;
        p.x += Math.sin(time * 1.4 + t.phase + k * 5) * wave;
        p.y += Math.cos(time * 1.2 + t.phase + k * 4) * wave;
        p.z += Math.sin(time * 0.9 + t.phase + k * 3) * wave * 0.6;
      }
      t.curve.updateArcLengths();
      updateTubeGeometryFromCurve(t.geometry, t.curve);
    }

    function resize() {
      if (!renderer) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();

    function projectPointerToWorld(x: number, y: number) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nx = (x / w) * 2 - 1;
      const ny = -((y / h) * 2 - 1);
      const vector = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
      const dir = vector.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      cursorTarget.copy(camera.position).add(dir.multiplyScalar(distance));
    }

    function onMouseMove(e: MouseEvent) {
      pendingPointer = { x: e.clientX, y: e.clientY };
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 0) return;
      pendingPointer = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }

    let running = true;
    let rafId = 0;
    function onVisibility() {
      const wasRunning = running;
      running = document.visibilityState !== "hidden";
      if (running && !wasRunning) {
        rafId = requestAnimationFrame(loop);
      }
    }

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);

    const startTime = performance.now();
    let lastFrame = 0;
    const minFrameMs = 1000 / 45;

    const _drift = new THREE.Color();

    function loop() {
      if (!running || !renderer) return;
      const now = performance.now();
      if (now - lastFrame < minFrameMs) {
        rafId = requestAnimationFrame(loop);
        return;
      }
      lastFrame = now;
      const t = (now - startTime) / 1000;

      // rAF-throttled pointer projection: at most once per render frame
      if (pendingPointer) {
        projectPointerToWorld(pendingPointer.x, pendingPointer.y);
        pendingPointer = null;
      }

      easedTarget.lerp(cursorTarget, 0.06);

      for (let i = 0; i < tubes.length; i++) {
        updateTube(tubes[i], t + i * 0.7);
        // Gentle drift between tube's base brand color and the next brand color in palette.
        // Stays inside the brand family — never goes through full hue spectrum.
        // ~30s full cycle (2π/30 ≈ 0.21)
        const mix = 0.5 + 0.5 * Math.sin(t * 0.21 + tubes[i].phase);
        _drift.copy(tubes[i].baseColor).lerp(tubes[i].altColor, mix * 0.4);
        tubes[i].material.color.copy(_drift);
      }

      // Pulse the flare core at the cursor
      const pulse = 1 + Math.sin(t * 4) * 0.15;
      flare.position.copy(easedTarget);
      flare.scale.setScalar(pulse);
      flareGlow.position.copy(easedTarget);
      flareGlow.scale.setScalar(1 + Math.sin(t * 2.5) * 0.1);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      tubes.forEach((t) => {
        t.geometry.dispose();
        t.material.dispose();
        scene.remove(t.mesh);
      });
      flareGeo.dispose();
      flareMat.dispose();
      flareGlowGeo.dispose();
      flareGlowMat.dispose();
      scene.remove(flare);
      scene.remove(flareGlow);
      renderer?.dispose();
    };
  }, [enabled, reduceMotion, colors]);

  if (!enabled || reduceMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
      data-testid="canvas-tubes-background"
      aria-hidden="true"
    />
  );
}
