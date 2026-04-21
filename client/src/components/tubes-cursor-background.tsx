import { useEffect, useRef } from "react";
import * as THREE from "three";

interface TubesCursorBackgroundProps {
  className?: string;
  colors?: number[];
  lightColors?: number[];
  enabled?: boolean;
  reduceMotion?: boolean;
}

// Brand-aligned warm amber + cool indigo + magenta family. No full-rainbow drift.
const DEFAULT_COLORS = [0xf59e0b, 0x6366f1, 0xec4899, 0xfb923c, 0x8b5cf6];
const DEFAULT_LIGHT_COLORS = [0xf59e0b, 0x6366f1, 0xec4899, 0xfb923c];
const NUM_TUBES = 8;
const NUM_LIGHTS = 4;

const TUBE_SEGMENTS = 48;
const TUBE_RADIAL = 8;
const TUBE_RADIUS = 0.07;

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
  lightColors = DEFAULT_LIGHT_COLORS,
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
      material: THREE.MeshPhongMaterial;
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
      const material = new THREE.MeshPhongMaterial({
        color: baseHex,
        emissive: baseHex,
        emissiveIntensity: 0.7,
        shininess: 80,
        transparent: true,
        opacity: 0.92,
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

    const ambient = new THREE.AmbientLight(0x111122, 0.6);
    scene.add(ambient);

    const lights: THREE.PointLight[] = [];
    for (let i = 0; i < NUM_LIGHTS; i++) {
      const l = new THREE.PointLight(lightColors[i % lightColors.length], 1.6, 18, 1.5);
      l.position.set(
        Math.cos((i / NUM_LIGHTS) * Math.PI * 2) * 4,
        Math.sin((i / NUM_LIGHTS) * Math.PI * 2) * 3,
        2,
      );
      scene.add(l);
      lights.push(l);
    }

    function updateTube(t: TubeData, time: number) {
      const start = t.curvePts[0];
      start.set(
        t.offset.x + Math.sin(time * t.speed + t.phase) * 1.2,
        t.offset.y + Math.cos(time * t.speed * 0.8 + t.phase) * 1.0,
        t.offset.z + Math.sin(time * 0.5 + t.phase) * 0.6,
      );
      const N = t.curvePts.length;
      for (let i = 1; i < N; i++) {
        const k = i / (N - 1);
        const p = t.curvePts[i];
        p.lerpVectors(start, easedTarget, k);
        p.x += Math.sin(time * 1.2 + t.phase + k * 6) * 0.35 * (1 - k);
        p.y += Math.cos(time * 1.0 + t.phase + k * 5) * 0.35 * (1 - k);
        p.z += Math.sin(time * 0.8 + t.phase + k * 4) * 0.25 * (1 - k);
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
        tubes[i].material.emissive.copy(_drift).multiplyScalar(0.7);
      }

      for (let i = 0; i < lights.length; i++) {
        const angle = (i / lights.length) * Math.PI * 2 + t * 0.3;
        lights[i].position.set(
          Math.cos(angle) * 5,
          Math.sin(angle) * 3.5,
          Math.sin(t * 0.5 + i) * 2 + 2,
        );
      }

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
      lights.forEach((l) => scene.remove(l));
      renderer?.dispose();
    };
  }, [enabled, reduceMotion, colors, lightColors]);

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
