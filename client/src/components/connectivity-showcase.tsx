import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, GraduationCap, Sparkles, Navigation } from "lucide-react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Property {
  id: string;
  name: string;
  displayName?: string;
  location: string;
  nearbyLocations?: string;
}

const PROPERTY_COORDS: Record<string, [number, number]> = {
  "Hsquare Hostel Juhu": [19.1163, 72.8364],
  "Hsquare Vileparle": [19.0990, 72.8440],
  "Hsquare Bayview": [19.0945, 72.8395],
  "Hsquare Goregaon": [19.1663, 72.8526],
  "Hotel Neelkamal": [19.0620, 72.8980],
  "Hsquare Caledonia": [19.1005, 72.8430],
  "Hsquare Utopia": [19.0750, 72.8700],
};

const BUILDING_CONFIGS: Record<string, { floors: number; widthPx: number; heightPx: number; roofStyle: string }> = {
  "Hsquare Hostel Juhu": { floors: 6, widthPx: 18, heightPx: 36, roofStyle: "pointed" },
  "Hsquare Vileparle": { floors: 5, widthPx: 16, heightPx: 30, roofStyle: "flat" },
  "Hsquare Bayview": { floors: 5, widthPx: 17, heightPx: 32, roofStyle: "pointed" },
  "Hsquare Goregaon": { floors: 7, widthPx: 19, heightPx: 40, roofStyle: "antenna" },
  "Hotel Neelkamal": { floors: 4, widthPx: 14, heightPx: 24, roofStyle: "flat" },
  "Hsquare Caledonia": { floors: 5, widthPx: 17, heightPx: 33, roofStyle: "antenna" },
  "Hsquare Utopia": { floors: 5, widthPx: 16, heightPx: 30, roofStyle: "flat" },
};

const TRIANGLE_KEYS = ["Hsquare Hostel Juhu", "Hsquare Bayview", "Hsquare Caledonia"];
const GOREGAON_KEY = "Hsquare Goregaon";
const VILEPARLE_KEY = "Hsquare Vileparle";

const FALLBACK_CENTER: [number, number] = [72.8500, 19.1050];

const HOTSPOT_ICONS: Record<string, string> = {
  university: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
  lifestyle: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`,
  transit: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 17v4M8 21h8M9 7h6M9 11h6"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/></svg>`,
};

const HOTSPOTS: Array<{ name: string; lat: number; lng: number; type: string }> = [
  { name: "NMIMS University", lat: 19.1044, lng: 72.8370, type: "university" },
  { name: "Mithibai College", lat: 19.1030, lng: 72.8390, type: "university" },
  { name: "Juhu Beach", lat: 19.0988, lng: 72.8267, type: "lifestyle" },
  { name: "ISKCON Temple", lat: 19.1124, lng: 72.8290, type: "lifestyle" },
  { name: "Andheri Metro", lat: 19.1197, lng: 72.8464, type: "transit" },
  { name: "Domestic Airport", lat: 19.0896, lng: 72.8656, type: "transit" },
  { name: "Oberoi Mall", lat: 19.1710, lng: 72.8600, type: "lifestyle" },
];

const FEATURES = [
  {
    icon: Shield,
    title: "Secure Triangle Zone",
    text: "A safe and premium living area exclusively within Hsquare's strategic property network.",
    color: "emerald",
  },
  {
    icon: GraduationCap,
    title: "University-Centric Location",
    text: "NMIMS, Mithibai College & more just steps from all properties in the network.",
    color: "cyan",
  },
  {
    icon: Sparkles,
    title: "Premium Lifestyle Around You",
    text: "Proximity to premium malls, beaches, airports, and metro adds a touch of luxury.",
    color: "violet",
  },
];

function getCoords(property: Property): [number, number] | null {
  if (property.mapLatitude && property.mapLongitude) {
    const lat = parseFloat(property.mapLatitude);
    const lng = parseFloat(property.mapLongitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }
  const name = property.displayName || property.name;
  if (PROPERTY_COORDS[name]) return PROPERTY_COORDS[name];
  for (const [key, coords] of Object.entries(PROPERTY_COORDS)) {
    if (name.toLowerCase().includes(key.toLowerCase().split(" ").pop()!) ||
        key.toLowerCase().includes(name.toLowerCase().split(" ").pop()!)) {
      return coords;
    }
  }
  const loc = property.location.toLowerCase();
  if (loc.includes("juhu")) return [19.1163, 72.8364];
  if (loc.includes("vile parle") || loc.includes("vileparle")) return [19.0990, 72.8440];
  if (loc.includes("goregaon")) return [19.1663, 72.8526];
  if (loc.includes("colaba")) return [19.0880, 72.8310];
  if (loc.includes("chembur")) return [19.0620, 72.8980];
  if (loc.includes("andheri")) return [19.1197, 72.8464];
  return null;
}

function createSkyscraperHTML(name: string, location: string, cfg: { floors: number; widthPx: number; heightPx: number; roofStyle: string }) {
  const { floors, widthPx, heightPx, roofStyle } = cfg;
  const floorH = Math.floor(heightPx / floors);
  const sideW = Math.floor(widthPx * 0.35);

  let frontWindows = "";
  for (let f = 0; f < floors; f++) {
    const winY = f * floorH + 1;
    const lit1 = Math.random() > 0.25;
    const lit2 = Math.random() > 0.3;
    const lit3 = Math.random() > 0.25;
    frontWindows += `<div style="position:absolute;top:${winY}px;left:4px;right:4px;height:${floorH - 2}px;display:flex;gap:2px;">
      <div style="flex:1;background:${lit1 ? 'rgba(103,232,249,0.6)' : 'rgba(30,50,80,0.5)'};border-radius:1px;box-shadow:${lit1 ? '0 0 4px rgba(103,232,249,0.4)' : 'none'};animation:skyscraperWindowFlicker 4s ease-in-out infinite ${(Math.random() * 4).toFixed(1)}s;" class="skyscraper-win"></div>
      <div style="flex:1;background:${lit2 ? 'rgba(167,139,250,0.5)' : 'rgba(30,50,80,0.5)'};border-radius:1px;box-shadow:${lit2 ? '0 0 4px rgba(167,139,250,0.3)' : 'none'};animation:skyscraperWindowFlicker 4s ease-in-out infinite ${(Math.random() * 4).toFixed(1)}s;" class="skyscraper-win"></div>
      <div style="flex:1;background:${lit3 ? 'rgba(52,211,153,0.5)' : 'rgba(30,50,80,0.5)'};border-radius:1px;box-shadow:${lit3 ? '0 0 4px rgba(52,211,153,0.3)' : 'none'};animation:skyscraperWindowFlicker 4s ease-in-out infinite ${(Math.random() * 4).toFixed(1)}s;" class="skyscraper-win"></div>
    </div>`;
  }

  let sideWindows = "";
  for (let f = 0; f < floors; f++) {
    const winY = f * floorH + 1;
    const lit = Math.random() > 0.4;
    sideWindows += `<div style="position:absolute;top:${winY}px;left:3px;right:2px;height:${floorH - 2}px;background:${lit ? 'rgba(103,232,249,0.3)' : 'rgba(20,35,60,0.4)'};border-radius:1px;" class="skyscraper-win"></div>`;
  }

  let roofHTML = "";
  if (roofStyle === "pointed") {
    roofHTML = `
      <div style="position:absolute;top:-12px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:${widthPx / 3}px solid transparent;border-right:${widthPx / 3}px solid transparent;border-bottom:12px solid #1a3a6a;filter:drop-shadow(0 -2px 6px rgba(103,232,249,0.4));"></div>
      <div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);width:2px;height:8px;background:rgba(103,232,249,0.9);box-shadow:0 0 6px rgba(103,232,249,0.8);border-radius:1px;"></div>
    `;
  } else if (roofStyle === "antenna") {
    roofHTML = `
      <div style="position:absolute;top:-20px;left:50%;transform:translateX(-50%);width:2px;height:20px;background:linear-gradient(to top,#2a4a7a,rgba(103,232,249,0.8));box-shadow:0 0 8px rgba(103,232,249,0.5);"></div>
      <div style="position:absolute;top:-24px;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:50%;background:rgba(239,68,68,0.9);box-shadow:0 0 10px rgba(239,68,68,0.8);" class="antenna-blink"></div>
    `;
  } else {
    roofHTML = `<div style="position:absolute;top:-3px;left:2px;right:2px;height:3px;background:linear-gradient(90deg,#2a4a7a,rgba(103,232,249,0.5),#2a4a7a);border-radius:1px 1px 0 0;box-shadow:0 -1px 8px rgba(103,232,249,0.3);"></div>`;
  }

  return `
    <div class="skyscraper-marker" style="display:flex;flex-direction:column;align-items:center;">
      <div class="skyscraper-body" style="position:relative;display:flex;filter:drop-shadow(0 4px 20px rgba(6,182,212,0.25)) drop-shadow(0 0 40px rgba(6,182,212,0.1));">
        <div style="position:relative;width:${widthPx}px;height:${heightPx}px;background:linear-gradient(180deg,#0d2240 0%,#152d50 40%,#1a365d 100%);border:1px solid rgba(103,232,249,0.2);border-radius:2px 2px 0 0;overflow:hidden;">
          <div style="position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.08) 0%,transparent 50%,rgba(0,0,0,0.15) 100%);pointer-events:none;"></div>
          <div style="position:absolute;top:0;left:0;width:2px;height:100%;background:linear-gradient(180deg,rgba(103,232,249,0.4),transparent);"></div>
          ${frontWindows}
          ${roofHTML}
        </div>
        <div style="width:${sideW}px;height:${heightPx}px;background:linear-gradient(180deg,#091a33 0%,#0d2240 100%);border-right:1px solid rgba(103,232,249,0.1);border-radius:0 2px 0 0;position:relative;overflow:hidden;transform:skewY(-8deg);transform-origin:top left;margin-top:0;">
          ${sideWindows}
        </div>
      </div>
      <div class="building-ground-glow" style="width:${widthPx + sideW + 16}px;height:6px;background:radial-gradient(ellipse,rgba(103,232,249,0.35) 0%,transparent 70%);margin-top:-1px;"></div>
      <div style="margin-top:4px;min-width:${Math.max(widthPx + sideW + 20, 120)}px;border-radius:10px;border:1px solid rgba(103,232,249,0.2);background:rgba(5,8,18,0.95);backdrop-filter:blur(16px);padding:5px 10px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.7),0 0 20px rgba(6,182,212,0.08);">
        <div style="font-size:10.5px;font-weight:800;color:white;line-height:1.2;letter-spacing:0.03em;">${name}</div>
        <div style="font-size:8px;color:rgba(103,232,249,0.6);margin-top:2px;text-transform:uppercase;letter-spacing:0.06em;">${location}</div>
      </div>
    </div>
  `;
}

function PropertyMap({ properties }: { properties: Property[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const animFrameRef = useRef<number>(0);

  const propertyCoords = useMemo(() => {
    return properties
      .map(p => ({ property: p, coords: getCoords(p) }))
      .filter((item): item is { property: Property; coords: [number, number] } => item.coords !== null);
  }, [properties]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let center: [number, number] = FALLBACK_CENTER;
    if (propertyCoords.length > 0) {
      const avgLng = propertyCoords.reduce((s, c) => s + c.coords[1], 0) / propertyCoords.length;
      const avgLat = propertyCoords.reduce((s, c) => s + c.coords[0], 0) / propertyCoords.length;
      center = [avgLng, avgLat];
    }

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: "carto-dark-layer",
            type: "raster",
            source: "carto-dark",
            minzoom: 0,
            maxzoom: 19,
          },
        ],
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
      },
      center,
      zoom: 12.5,
      pitch: 45,
      bearing: -12,
      antialias: true,
      attributionControl: false,
      dragRotate: false,
      minZoom: 11,
      maxZoom: 15,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");

    map.on("load", () => {
      const triangleCoordPairs: [number, number][] = [];
      for (const tk of TRIANGLE_KEYS) {
        const c = PROPERTY_COORDS[tk];
        if (c) triangleCoordPairs.push([c[1], c[0]]);
      }

      if (triangleCoordPairs.length >= 3) {
        const closed = [...triangleCoordPairs, triangleCoordPairs[0]];

        map.addSource("triangle-fill", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closed] } },
        });
        map.addLayer({
          id: "triangle-fill-layer",
          type: "fill",
          source: "triangle-fill",
          paint: { "fill-color": "#10b981", "fill-opacity": 0.06 },
        });

        map.addSource("triangle-edges", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: closed } },
        });

        map.addLayer({
          id: "triangle-glow-wide",
          type: "line",
          source: "triangle-edges",
          paint: { "line-color": "#67e8f9", "line-width": 18, "line-opacity": 0.08, "line-blur": 12 },
        });
        map.addLayer({
          id: "triangle-glow-mid",
          type: "line",
          source: "triangle-edges",
          paint: { "line-color": "#67e8f9", "line-width": 8, "line-opacity": 0.15, "line-blur": 4 },
        });
        map.addLayer({
          id: "triangle-edge-solid",
          type: "line",
          source: "triangle-edges",
          paint: { "line-color": "#67e8f9", "line-width": 2.5, "line-opacity": 0.9 },
        });

        for (let i = 0; i < 3; i++) {
          const from = triangleCoordPairs[i];
          const to = triangleCoordPairs[(i + 1) % 3];
          map.addSource(`triangle-particle-${i}`, {
            type: "geojson",
            data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: from } },
          });
          map.addLayer({
            id: `triangle-particle-glow-${i}`,
            type: "circle",
            source: `triangle-particle-${i}`,
            paint: { "circle-radius": 12, "circle-color": "#34d399", "circle-opacity": 0.2, "circle-blur": 1 },
          });
          map.addLayer({
            id: `triangle-particle-${i}`,
            type: "circle",
            source: `triangle-particle-${i}`,
            paint: { "circle-radius": 4, "circle-color": "#67e8f9", "circle-opacity": 0.9 },
          });
        }

        let particlePhase = 0;
        let fillPhase = 0;
        function animateAll() {
          particlePhase += 0.004;
          if (particlePhase > 1) particlePhase = 0;
          fillPhase += 0.012;

          for (let i = 0; i < 3; i++) {
            const from = triangleCoordPairs[i];
            const to = triangleCoordPairs[(i + 1) % 3];
            const t = (particlePhase + i * 0.33) % 1;
            const lng = from[0] + (to[0] - from[0]) * t;
            const lat = from[1] + (to[1] - from[1]) * t;
            const src = map.getSource(`triangle-particle-${i}`) as maplibregl.GeoJSONSource;
            if (src) {
              src.setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lng, lat] } });
            }
          }

          const fillOp = 0.04 + Math.sin(fillPhase) * 0.04;
          if (map.getLayer("triangle-fill-layer")) {
            map.setPaintProperty("triangle-fill-layer", "fill-opacity", Math.max(0.02, fillOp));
          }
          const glowOp = 0.08 + Math.sin(fillPhase * 0.7) * 0.07;
          if (map.getLayer("triangle-glow-wide")) {
            map.setPaintProperty("triangle-glow-wide", "line-opacity", glowOp);
          }

          animFrameRef.current = requestAnimationFrame(animateAll);
        }
        animateAll();
      }

      const vileparleCoords = PROPERTY_COORDS[VILEPARLE_KEY];
      if (vileparleCoords && triangleCoordPairs.length > 0) {
        let closestDist = Infinity;
        let closestIdx = 0;
        for (let i = 0; i < triangleCoordPairs.length; i++) {
          const tc = triangleCoordPairs[i];
          const d = Math.sqrt(Math.pow(tc[0] - vileparleCoords[1], 2) + Math.pow(tc[1] - vileparleCoords[0], 2));
          if (d < closestDist) { closestDist = d; closestIdx = i; }
        }
        map.addSource("vileparle-line", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[vileparleCoords[1], vileparleCoords[0]], triangleCoordPairs[closestIdx]] } },
        });
        map.addLayer({ id: "vileparle-glow", type: "line", source: "vileparle-line", paint: { "line-color": "#67e8f9", "line-width": 10, "line-opacity": 0.06, "line-blur": 6 } });
        map.addLayer({ id: "vileparle-connector", type: "line", source: "vileparle-line", paint: { "line-color": "#67e8f9", "line-width": 1.5, "line-opacity": 0.6, "line-dasharray": [4, 3] } });
      }

      const goregaonCoords = PROPERTY_COORDS[GOREGAON_KEY];
      const juhuCoords = PROPERTY_COORDS["Hsquare Hostel Juhu"];
      if (goregaonCoords && juhuCoords) {
        map.addSource("goregaon-line", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[juhuCoords[1], juhuCoords[0]], [goregaonCoords[1], goregaonCoords[0]]] } },
        });
        map.addLayer({ id: "goregaon-glow", type: "line", source: "goregaon-line", paint: { "line-color": "#67e8f9", "line-width": 10, "line-opacity": 0.06, "line-blur": 6 } });
        map.addLayer({ id: "goregaon-connector", type: "line", source: "goregaon-line", paint: { "line-color": "#67e8f9", "line-width": 1.5, "line-opacity": 0.6, "line-dasharray": [4, 3] } });
      }

      propertyCoords.forEach(({ property, coords }) => {
        const name = property.displayName || property.name;
        const config = BUILDING_CONFIGS[name] || { floors: 6, widthPx: 38, heightPx: 70, roofStyle: "flat" };
        const el = document.createElement("div");
        el.className = "map-building-marker";
        el.innerHTML = createSkyscraperHTML(name, property.location, config);
        new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([coords[1], coords[0]])
          .addTo(map);
      });

      HOTSPOTS.forEach(spot => {
        const iconSvg = HOTSPOT_ICONS[spot.type] || HOTSPOT_ICONS.lifestyle;
        const el = document.createElement("div");
        el.className = "map-hotspot-marker";
        el.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div class="hotspot-pin" style="width:18px;height:18px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);border:1.5px solid rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px rgba(239,68,68,0.5),0 1px 4px rgba(0,0,0,0.4);">
              ${iconSvg}
            </div>
            <div style="margin-top:2px;border-radius:6px;background:rgba(5,8,18,0.9);backdrop-filter:blur(8px);padding:1px 5px;border:1px solid rgba(255,255,255,0.08);box-shadow:0 1px 4px rgba(0,0,0,0.5);">
              <div style="font-size:7px;font-weight:700;color:rgba(255,255,255,0.7);white-space:nowrap;letter-spacing:0.02em;">${spot.name}</div>
            </div>
          </div>
        `;
        new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([spot.lng, spot.lat])
          .addTo(map);
      });

      if (propertyCoords.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        propertyCoords.forEach(c => bounds.extend([c.coords[1], c.coords[0]]));
        HOTSPOTS.forEach(h => bounds.extend([h.lng, h.lat]));
        map.fitBounds(bounds, { padding: 60, pitch: 45, bearing: -12 });
      }

    });

    mapInstanceRef.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [propertyCoords]);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] shadow-[0_0_80px_rgba(6,182,212,0.08)]">
      <div ref={mapRef} className="w-full aspect-[4/5] md:aspect-square" style={{ background: "#050a14" }} data-testid="connectivity-map" />
      <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/[0.06] bg-black/70 backdrop-blur-xl p-3 z-[10]">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] md:text-xs text-white/40">
          <span className="rounded-full bg-emerald-400/10 text-emerald-300/70 px-2.5 py-1 border border-emerald-400/10 flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Secure Triangle Zone
          </span>
          <span className="rounded-full bg-cyan-400/10 text-cyan-300/60 px-2.5 py-1 border border-cyan-400/10">Academic Belt</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Airport Access</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Lifestyle Hub</span>
        </div>
      </div>
      <div className="absolute top-3 right-3 z-[10]">
        <div className="rounded-lg bg-black/70 backdrop-blur-lg border border-white/[0.06] px-2.5 py-1.5 text-[9px] text-white/30 font-medium tracking-wider uppercase">
          3D View
        </div>
      </div>
      <style>{`
        .maplibregl-canvas { outline: none; }
        .maplibregl-ctrl-group {
          background: rgba(5,10,20,0.92) !important;
          border: 1px solid rgba(103,232,249,0.1) !important;
          border-radius: 8px !important;
          overflow: hidden;
          backdrop-filter: blur(12px);
          margin-bottom: 60px !important;
        }
        .maplibregl-ctrl-group button {
          background: transparent !important;
          border-bottom: 1px solid rgba(255,255,255,0.04) !important;
          width: 32px !important;
          height: 32px !important;
        }
        .maplibregl-ctrl-group button:hover { background: rgba(103,232,249,0.08) !important; }
        .maplibregl-ctrl-group button span { filter: invert(1) brightness(0.6); }
        .maplibregl-ctrl-attrib { display: none !important; }

        .map-building-marker, .map-hotspot-marker { cursor: default; }

        @keyframes skyscraperWindowFlicker {
          0%, 90%, 100% { opacity: 1; }
          92% { opacity: 0.3; }
          95% { opacity: 0.8; }
          97% { opacity: 0.2; }
        }
        .skyscraper-win {}

        @keyframes antennaBlink {
          0%, 70%, 100% { opacity: 1; box-shadow: 0 0 10px rgba(239,68,68,0.8); }
          75% { opacity: 0.2; box-shadow: 0 0 4px rgba(239,68,68,0.3); }
        }
        .antenna-blink { animation: antennaBlink 2s ease-in-out infinite; }

        @keyframes groundGlowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .building-ground-glow { animation: groundGlowPulse 3s ease-in-out infinite; }

        @keyframes hotspotPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(239,68,68,0.5), 0 2px 8px rgba(0,0,0,0.4); }
          50% { box-shadow: 0 0 20px rgba(239,68,68,0.7), 0 2px 12px rgba(0,0,0,0.5); }
        }
        .hotspot-pin { animation: hotspotPulse 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

export function ConnectivityShowcase({ properties }: { properties: Property[] }) {
  if (!properties || properties.length < 2) return null;

  const shapeLabel = properties.length === 3 ? "Triangle" : properties.length === 4 ? "Quadrilateral" : "Network";

  return (
    <section className="w-full bg-[#050505] text-white py-16 md:py-24 relative overflow-hidden" data-testid="connectivity-showcase">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(6,182,212,0.04) 0%, transparent 60%)" }} />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight leading-tight mb-4">
            Stay inside Hsquare's{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">{shapeLabel} of Connectivity</span>
          </h2>
          <p className="text-white/40 text-base md:text-lg max-w-3xl mx-auto">
            {properties.length} strategically placed properties around Mumbai's key academic and lifestyle belt.
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.1fr] gap-10 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <PropertyMap properties={properties} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-sm text-cyan-300 font-medium">
              <Navigation className="w-3.5 h-3.5" />
              Strategic Property Network
            </div>

            <p className="text-white/40 text-base md:text-lg leading-relaxed max-w-xl">
              Our properties are not randomly placed. They form a smart location network across Mumbai — surrounding major universities, lifestyle zones, and transport corridors. That means safer access, faster commutes, and a better daily living experience.
            </p>

            <div className="grid gap-4">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors"
                  data-testid={`feature-card-${i}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      feature.color === "emerald" ? "bg-emerald-500/10 text-emerald-400" :
                      feature.color === "cyan" ? "bg-cyan-500/10 text-cyan-400" :
                      "bg-violet-500/10 text-violet-400"
                    }`}>
                      <feature.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-white text-sm md:text-base mb-1">{feature.title}</h3>
                      <p className="text-white/30 text-sm leading-relaxed">{feature.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {["NMIMS", "Mithibai College", "Juhu Beach", "Airport", "Andheri Metro", "Oberoi Mall", "ISKCON Temple", "Hospitals"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-xs text-white/30"
                >
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
