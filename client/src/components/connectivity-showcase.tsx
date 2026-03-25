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

const BUILDING_CONFIGS: Record<string, { floors: number; color: string; accent: string }> = {
  "Hsquare Hostel Juhu": { floors: 8, color: "#1a365d", accent: "#67e8f9" },
  "Hsquare Vileparle": { floors: 6, color: "#1e3a5f", accent: "#67e8f9" },
  "Hsquare Bayview": { floors: 7, color: "#1a365d", accent: "#34d399" },
  "Hsquare Goregaon": { floors: 10, color: "#1e3a5f", accent: "#67e8f9" },
  "Hotel Neelkamal": { floors: 5, color: "#2d1b4e", accent: "#a78bfa" },
  "Hsquare Caledonia": { floors: 6, color: "#1a365d", accent: "#34d399" },
  "Hsquare Utopia": { floors: 7, color: "#1e3a5f", accent: "#67e8f9" },
};

const TRIANGLE_KEYS = ["Hsquare Hostel Juhu", "Hsquare Bayview", "Hsquare Caledonia"];
const GOREGAON_KEY = "Hsquare Goregaon";
const VILEPARLE_KEY = "Hsquare Vileparle";

const FALLBACK_CENTER: [number, number] = [72.8500, 19.1050];

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

function create3DBuildingHTML(name: string, location: string, config: { floors: number; color: string; accent: string }) {
  const { floors, color, accent } = config;
  const buildingH = Math.min(floors * 8, 80);
  const buildingW = 36;

  let windowRows = "";
  for (let f = 0; f < Math.min(floors, 8); f++) {
    const y = f * (buildingH / Math.min(floors, 8)) + 2;
    windowRows += `
      <div style="position:absolute;left:3px;right:3px;top:${y}px;height:${Math.max(buildingH / Math.min(floors, 8) - 3, 4)}px;display:flex;gap:2px;justify-content:center;align-items:center;">
        <div class="building-window" style="width:4px;height:${Math.max(buildingH / Math.min(floors, 8) - 5, 3)}px;background:rgba(103,232,249,${0.3 + Math.random() * 0.5});border-radius:1px;"></div>
        <div class="building-window" style="width:4px;height:${Math.max(buildingH / Math.min(floors, 8) - 5, 3)}px;background:rgba(103,232,249,${0.3 + Math.random() * 0.5});border-radius:1px;"></div>
        <div class="building-window" style="width:4px;height:${Math.max(buildingH / Math.min(floors, 8) - 5, 3)}px;background:rgba(103,232,249,${0.3 + Math.random() * 0.5});border-radius:1px;"></div>
        <div class="building-window" style="width:4px;height:${Math.max(buildingH / Math.min(floors, 8) - 5, 3)}px;background:rgba(52,211,153,${0.2 + Math.random() * 0.4});border-radius:1px;"></div>
      </div>
    `;
  }

  return `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 0 12px ${accent}40);">
      <div class="building-3d" style="position:relative;width:${buildingW}px;height:${buildingH}px;transform:perspective(200px) rotateX(2deg);">
        <div style="position:absolute;inset:0;background:linear-gradient(180deg,${color},${color}dd);border:1px solid ${accent}40;border-radius:2px 2px 0 0;box-shadow:inset -8px 0 12px rgba(0,0,0,0.4),inset 2px 0 8px ${accent}15;">
          ${windowRows}
        </div>
        <div style="position:absolute;top:-4px;left:2px;right:2px;height:4px;background:${accent};border-radius:1px 1px 0 0;box-shadow:0 -2px 8px ${accent}60;"></div>
        <div style="position:absolute;top:-8px;left:30%;right:30%;height:5px;background:${accent}80;border-radius:2px 2px 0 0;"></div>
        <div class="building-glow" style="position:absolute;bottom:0;left:-4px;right:-4px;height:8px;background:linear-gradient(to top,${accent}30,transparent);border-radius:0 0 4px 4px;"></div>
      </div>
      <div style="margin-top:6px;min-width:120px;border-radius:10px;border:1px solid ${accent}30;background:rgba(5,8,18,0.95);backdrop-filter:blur(16px);padding:5px 10px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.7),0 0 15px ${accent}15;">
        <div style="font-size:10px;font-weight:800;color:white;line-height:1.2;letter-spacing:0.03em;">${name}</div>
        <div style="font-size:8px;color:${accent};margin-top:2px;text-transform:uppercase;letter-spacing:0.06em;opacity:0.7;">${location}</div>
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
      pitch: 50,
      bearing: -15,
      antialias: true,
      attributionControl: false,
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
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [closed] },
          },
        });

        map.addLayer({
          id: "triangle-fill-layer",
          type: "fill",
          source: "triangle-fill",
          paint: {
            "fill-color": "#10b981",
            "fill-opacity": 0.08,
          },
        });

        map.addSource("triangle-edges", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: closed },
          },
        });

        map.addLayer({
          id: "triangle-glow",
          type: "line",
          source: "triangle-edges",
          paint: {
            "line-color": "#67e8f9",
            "line-width": 10,
            "line-opacity": 0.12,
            "line-blur": 8,
          },
        });

        map.addLayer({
          id: "triangle-edge-line",
          type: "line",
          source: "triangle-edges",
          paint: {
            "line-color": "#67e8f9",
            "line-width": 2.5,
            "line-opacity": 0.85,
            "line-dasharray": [3, 1.5],
          },
        });
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
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [[vileparleCoords[1], vileparleCoords[0]], triangleCoordPairs[closestIdx]],
            },
          },
        });
        map.addLayer({
          id: "vileparle-connector",
          type: "line",
          source: "vileparle-line",
          paint: { "line-color": "#67e8f9", "line-width": 2, "line-opacity": 0.5, "line-dasharray": [2, 2] },
        });
      }

      const goregaonCoords = PROPERTY_COORDS[GOREGAON_KEY];
      const juhuCoords = PROPERTY_COORDS["Hsquare Hostel Juhu"];
      if (goregaonCoords && juhuCoords) {
        map.addSource("goregaon-line", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: [[juhuCoords[1], juhuCoords[0]], [goregaonCoords[1], goregaonCoords[0]]],
            },
          },
        });
        map.addLayer({
          id: "goregaon-glow",
          type: "line",
          source: "goregaon-line",
          paint: { "line-color": "#67e8f9", "line-width": 12, "line-opacity": 0.08, "line-blur": 6 },
        });
        map.addLayer({
          id: "goregaon-connector",
          type: "line",
          source: "goregaon-line",
          paint: { "line-color": "#67e8f9", "line-width": 2.5, "line-opacity": 0.6, "line-dasharray": [3, 2] },
        });
      }

      propertyCoords.forEach(({ property, coords }) => {
        const name = property.displayName || property.name;
        const config = BUILDING_CONFIGS[name] || { floors: 5, color: "#1a365d", accent: "#67e8f9" };

        const el = document.createElement("div");
        el.className = "map-building-marker";
        el.innerHTML = create3DBuildingHTML(name, property.location, config);

        new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([coords[1], coords[0]])
          .addTo(map);
      });

      HOTSPOTS.forEach(spot => {
        const el = document.createElement("div");
        el.className = "map-hotspot-marker";
        el.innerHTML = `
          <div style="display:flex;align-items:center;gap:4px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.6);backdrop-filter:blur(8px);padding:3px 8px;">
            <div style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,0.5);flex-shrink:0;"></div>
            <span style="font-size:9px;color:rgba(255,255,255,0.45);white-space:nowrap;letter-spacing:0.03em;">${spot.name}</span>
          </div>
        `;
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([spot.lng, spot.lat])
          .addTo(map);
      });

      if (propertyCoords.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        propertyCoords.forEach(c => bounds.extend([c.coords[1], c.coords[0]]));
        HOTSPOTS.forEach(h => bounds.extend([h.lng, h.lat]));
        map.fitBounds(bounds, { padding: 60, pitch: 50, bearing: -15 });
      }

      let fillPhase = 0;
      function animateTriangle() {
        fillPhase += 0.015;
        const opacity = 0.05 + Math.sin(fillPhase) * 0.05;
        if (map.getLayer("triangle-fill-layer")) {
          map.setPaintProperty("triangle-fill-layer", "fill-opacity", Math.max(0.02, opacity));
        }
        if (map.getLayer("triangle-glow")) {
          const glowOp = 0.08 + Math.sin(fillPhase * 0.7) * 0.06;
          map.setPaintProperty("triangle-glow", "line-opacity", glowOp);
        }
        animFrameRef.current = requestAnimationFrame(animateTriangle);
      }
      animateTriangle();
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
      <div ref={mapRef} className="w-full aspect-[4/5] md:aspect-square" style={{ background: "#0a0f1a" }} data-testid="connectivity-map" />
      <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/[0.06] bg-black/60 backdrop-blur-lg p-3 z-[10]">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] md:text-xs text-white/40">
          <span className="rounded-full bg-emerald-400/10 text-emerald-300/70 px-2.5 py-1 border border-emerald-400/10">Safe Zone</span>
          <span className="rounded-full bg-cyan-400/10 text-cyan-300/60 px-2.5 py-1 border border-cyan-400/10">Academic Belt</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Airport Access</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Lifestyle Hub</span>
        </div>
      </div>
      <div className="absolute top-3 right-3 z-[10] flex flex-col gap-1 items-end">
        <div className="rounded-lg bg-black/70 backdrop-blur-lg border border-white/[0.06] px-2.5 py-1.5 text-[9px] text-white/30 font-medium tracking-wider uppercase">
          3D View
        </div>
      </div>
      <style>{`
        .maplibregl-canvas { outline: none; }
        .maplibregl-ctrl-group {
          background: rgba(10,15,26,0.9) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 8px !important;
          overflow: hidden;
          backdrop-filter: blur(8px);
        }
        .maplibregl-ctrl-group button {
          background: transparent !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          width: 32px !important;
          height: 32px !important;
        }
        .maplibregl-ctrl-group button:hover {
          background: rgba(103,232,249,0.1) !important;
        }
        .maplibregl-ctrl-group button span {
          filter: invert(1) brightness(0.7);
        }
        .maplibregl-ctrl-attrib { display: none !important; }

        .map-building-marker, .map-hotspot-marker {
          cursor: default;
        }

        @keyframes windowFlicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes buildingGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }

        .building-window {
          animation: windowFlicker 3s ease-in-out infinite;
          animation-delay: calc(var(--delay, 0) * 1s);
        }
        .building-3d .building-window:nth-child(1) { --delay: 0; }
        .building-3d .building-window:nth-child(2) { --delay: 0.8; }
        .building-3d .building-window:nth-child(3) { --delay: 1.6; }
        .building-3d .building-window:nth-child(4) { --delay: 2.4; }

        .building-glow {
          animation: buildingGlow 4s ease-in-out infinite;
        }

        .building-3d {
          animation: buildingFloat 6s ease-in-out infinite;
        }
        @keyframes buildingFloat {
          0%, 100% { transform: perspective(200px) rotateX(2deg) translateY(0); }
          50% { transform: perspective(200px) rotateX(2deg) translateY(-2px); }
        }
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
