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


const FALLBACK_CENTER: [number, number] = [72.8500, 19.1050];

const HOTSPOT_COLORS: Record<string, string> = {
  university: "#a78bfa",
  lifestyle: "#f472b6",
  transit: "#fbbf24",
  market: "#34d399",
};

const HOTSPOTS: Array<{ name: string; lat: number; lng: number; type: string }> = [
  { name: "NMIMS University", lat: 19.1044, lng: 72.8355, type: "university" },
  { name: "Mithibai College", lat: 19.1010, lng: 72.8415, type: "university" },
  { name: "Mukesh Patel School", lat: 19.1060, lng: 72.8370, type: "university" },
  { name: "DJ Sanghvi College", lat: 19.1070, lng: 72.8365, type: "university" },
  { name: "HR College", lat: 19.1020, lng: 72.8400, type: "university" },
  { name: "Wilson College", lat: 19.0720, lng: 72.8250, type: "university" },
  { name: "IIT Bombay", lat: 19.1334, lng: 72.9133, type: "university" },
  { name: "Jai Hind College", lat: 19.0695, lng: 72.8295, type: "university" },
  { name: "St. Xavier's College", lat: 19.0760, lng: 72.8290, type: "university" },
  { name: "KC College", lat: 19.0690, lng: 72.8300, type: "university" },
  { name: "Juhu Beach", lat: 19.0930, lng: 72.8240, type: "lifestyle" },
  { name: "Andheri Metro", lat: 19.1197, lng: 72.8500, type: "transit" },
  { name: "Mumbai Airport", lat: 19.0896, lng: 72.8680, type: "transit" },
  { name: "Oberoi Mall", lat: 19.1730, lng: 72.8610, type: "market" },
  { name: "Infinity Mall", lat: 19.1188, lng: 72.8460, type: "market" },
  { name: "Linking Road Market", lat: 19.0740, lng: 72.8435, type: "market" },
  { name: "Lokhandwala Market", lat: 19.1405, lng: 72.8340, type: "market" },
  { name: "Vile Parle Station", lat: 19.0980, lng: 72.8445, type: "transit" },
  { name: "Goregaon Station", lat: 19.1650, lng: 72.8490, type: "transit" },
  { name: "Andheri Station", lat: 19.1190, lng: 72.8468, type: "transit" },
  { name: "Bandra Station", lat: 19.0544, lng: 72.8402, type: "transit" },
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
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center,
      zoom: 12.5,
      pitch: 50,
      bearing: -15,
      antialias: true,
      attributionControl: false,
      dragRotate: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), "bottom-right");

    map.on("load", () => {
      const style = map.getStyle();
      if (style && style.layers) {
        for (const layer of style.layers) {
          if (layer.id.includes("road") || layer.id.includes("highway") || layer.id.includes("tunnel") || layer.id.includes("bridge") || layer.id.includes("path")) {
            if (layer.type === "line") {
              try {
                map.setPaintProperty(layer.id, "line-color", "#f59e0b");
                map.setPaintProperty(layer.id, "line-opacity", 0.5);
              } catch (_) {}
            }
          }
          if (layer.id.includes("building")) {
            if (layer.type === "fill") {
              try {
                map.setPaintProperty(layer.id, "fill-color", "#0d1a30");
                map.setPaintProperty(layer.id, "fill-opacity", 0.85);
              } catch (_) {}
            }
          }
          if (layer.id.includes("water") && layer.type === "fill") {
            try {
              map.setPaintProperty(layer.id, "fill-color", "#060d1a");
            } catch (_) {}
          }
          if (layer.type === "background") {
            try {
              map.setPaintProperty(layer.id, "background-color", "#050510");
            } catch (_) {}
          }
        }
      }

      const src = map.getSource("carto") as maplibregl.VectorTileSource | undefined;
      const srcName = src ? "carto" : "openmaptiles";

      const buildingSrcLayer = style?.layers?.find(l => l.id.includes("building") && (l as any)["source-layer"])
        ? ((style.layers.find(l => l.id.includes("building") && (l as any)["source-layer"]) as any)["source-layer"])
        : "building";
      const roadSrcLayer = style?.layers?.find(l => l.id.includes("road") && (l as any)["source-layer"])
        ? ((style.layers.find(l => l.id.includes("road") && (l as any)["source-layer"]) as any)["source-layer"])
        : "transportation";
      const actualSource = style?.layers?.find(l => (l as any).source)
        ? ((style.layers.find(l => (l as any).source) as any).source)
        : srcName;

      try {
        map.addLayer({
          id: "road-neon-glow",
          type: "line",
          source: actualSource,
          "source-layer": roadSrcLayer,
          paint: {
            "line-color": "#d97706",
            "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 14, 10, 16, 18],
            "line-opacity": 0.06,
            "line-blur": 8,
          },
        });
      } catch (_) {}

      try {
        map.addLayer({
          id: "building-3d-extrusion",
          type: "fill-extrusion",
          source: actualSource,
          "source-layer": buildingSrcLayer,
          minzoom: 13,
          paint: {
            "fill-extrusion-color": "#0a1525",
            "fill-extrusion-height": ["*", ["coalesce", ["get", "render_height"], 10], 1],
            "fill-extrusion-base": 0,
            "fill-extrusion-opacity": 0.8,
          },
        });
      } catch (_) {}

      

      try {
        map.addLayer({
          id: "building-edge-glow",
          type: "line",
          source: actualSource,
          "source-layer": buildingSrcLayer,
          minzoom: 14,
          paint: {
            "line-color": "#22d3ee",
            "line-width": 0.5,
            "line-opacity": 0.2,
          },
        });
      } catch (_) {}

      const TRIANGLE_NAMES = ["Hsquare Hostel Juhu", "Hsquare Bayview", "Hsquare Vileparle"];
      const triangleCoords: [number, number][] = [];
      for (const tk of TRIANGLE_NAMES) {
        const match = propertyCoords.find(({ property }) => {
          const name = property.displayName || property.name;
          return name === tk;
        });
        if (match) {
          triangleCoords.push([match.coords[1], match.coords[0]]);
        }
      }

      if (triangleCoords.length >= 3) {
        const closed = [...triangleCoords, triangleCoords[0]];

        map.addSource("triangle-fill", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closed] } } });
        map.addLayer({ id: "triangle-fill-layer", type: "fill", source: "triangle-fill", paint: { "fill-color": "#34d399", "fill-opacity": 0.15 } });

        map.addSource("property-network", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: closed } } });
        map.addLayer({ id: "network-glow-wide", type: "line", source: "property-network", paint: { "line-color": "#34d399", "line-width": 20, "line-opacity": 0.1, "line-blur": 14 } });
        map.addLayer({ id: "network-glow-mid", type: "line", source: "property-network", paint: { "line-color": "#34d399", "line-width": 8, "line-opacity": 0.18, "line-blur": 4 } });
        map.addLayer({ id: "network-edge-solid", type: "line", source: "property-network", paint: { "line-color": "#34d399", "line-width": 2.5, "line-opacity": 0.9 } });

        map.addSource("net-particle", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: triangleCoords[0] } } });
        map.addLayer({ id: "net-particle-glow", type: "circle", source: "net-particle", paint: { "circle-radius": 12, "circle-color": "#34d399", "circle-opacity": 0.25, "circle-blur": 1 } });
        map.addLayer({ id: "net-particle-dot", type: "circle", source: "net-particle", paint: { "circle-radius": 4, "circle-color": "#67e8f9", "circle-opacity": 0.95 } });

        let particlePhase = 0;
        let fillPhase = 0;
        function animateAll() {
          particlePhase += 0.003;
          if (particlePhase > 1) particlePhase = 0;
          fillPhase += 0.012;

          const progress = particlePhase * 3;
          const segIdx = Math.min(Math.floor(progress), 2);
          const segT = progress - segIdx;
          const from = closed[segIdx];
          const to = closed[segIdx + 1];
          const pLng = from[0] + (to[0] - from[0]) * segT;
          const pLat = from[1] + (to[1] - from[1]) * segT;
          const src = map.getSource("net-particle") as maplibregl.GeoJSONSource;
          if (src) src.setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [pLng, pLat] } });

          const fillOp = 0.12 + Math.sin(fillPhase) * 0.06;
          if (map.getLayer("triangle-fill-layer")) map.setPaintProperty("triangle-fill-layer", "fill-opacity", Math.max(0.06, fillOp));
          const glowOp = 0.08 + Math.sin(fillPhase * 0.7) * 0.06;
          if (map.getLayer("network-glow-wide")) map.setPaintProperty("network-glow-wide", "line-opacity", glowOp);
          animFrameRef.current = requestAnimationFrame(animateAll);
        }
        animateAll();
      }

      const markerFeatures: GeoJSON.Feature[] = [];

      propertyCoords.forEach(({ property, coords }) => {
        const name = property.displayName || property.name;
        markerFeatures.push({
          type: "Feature",
          properties: { name, location: property.location },
          geometry: { type: "Point", coordinates: [coords[1], coords[0]] },
        });
      });

      map.addSource("property-markers", { type: "geojson", data: { type: "FeatureCollection", features: markerFeatures } });

      map.addLayer({
        id: "building-glow-wide",
        type: "circle",
        source: "property-markers",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 25, 13, 70, 15, 120, 17, 200],
          "circle-color": "#f59e0b",
          "circle-opacity": 0.08,
          "circle-blur": 1,
        },
      });

      map.addLayer({
        id: "building-glow-outer",
        type: "circle",
        source: "property-markers",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 16, 13, 45, 15, 80, 17, 140],
          "circle-color": "#fbbf24",
          "circle-opacity": 0.12,
          "circle-blur": 0.9,
        },
      });

      map.addLayer({
        id: "building-glow-mid",
        type: "circle",
        source: "property-markers",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 10, 13, 28, 15, 50, 17, 90],
          "circle-color": "#fcd34d",
          "circle-opacity": 0.2,
          "circle-blur": 0.7,
        },
      });

      map.addLayer({
        id: "building-glow-inner",
        type: "circle",
        source: "property-markers",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 13, 14, 15, 30, 17, 50],
          "circle-color": "#fde68a",
          "circle-opacity": 0.35,
          "circle-blur": 0.4,
        },
      });

      map.addLayer({
        id: "property-dots",
        type: "circle",
        source: "property-markers",
        maxzoom: 13.5,
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 5, 13, 10],
          "circle-color": "#fbbf24",
          "circle-opacity": 0.95,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      map.addLayer({
        id: "property-labels",
        type: "symbol",
        source: "property-markers",
        minzoom: 10,
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 12, 13, 14, 15, 16, 18],
          "text-offset": [0, -2.5],
          "text-anchor": "bottom",
          "text-font": ["Open Sans Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(5,5,16,0.95)",
          "text-halo-width": 2.5,
        },
      });

      map.addLayer({
        id: "property-sublabels",
        type: "symbol",
        source: "property-markers",
        minzoom: 12.5,
        layout: {
          "text-field": ["get", "location"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 7, 16, 10],
          "text-offset": [0, -1.6],
          "text-anchor": "bottom",
          "text-font": ["Open Sans Regular"],
          "text-transform": "uppercase",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "rgba(103,232,249,0.6)",
          "text-halo-color": "rgba(5,8,18,0.8)",
          "text-halo-width": 1.5,
        },
      });

      const hotspotFeatures: GeoJSON.Feature[] = HOTSPOTS.map(spot => ({
        type: "Feature",
        properties: { name: spot.name, type: spot.type, color: HOTSPOT_COLORS[spot.type] || "#f472b6" },
        geometry: { type: "Point", coordinates: [spot.lng, spot.lat] },
      }));

      map.addSource("hotspots", { type: "geojson", data: { type: "FeatureCollection", features: hotspotFeatures } });

      map.addLayer({
        id: "hotspot-glow",
        type: "circle",
        source: "hotspots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 6, 14, 14],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.15,
          "circle-blur": 1,
        },
      });

      map.addLayer({
        id: "hotspot-dots",
        type: "circle",
        source: "hotspots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.9,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 1,
        },
      });

      map.addLayer({
        id: "hotspot-labels",
        type: "symbol",
        source: "hotspots",
        minzoom: 10,
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 8, 12, 10, 14, 12],
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-font": ["Open Sans Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "rgba(5,5,16,0.95)",
          "text-halo-width": 2,
        },
      });

      const activePopup = { current: null as maplibregl.Popup | null };

      map.on("click", "building-extrusion", (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const name = f.properties?.name || "";
        const location = f.properties?.location || "";
        if (activePopup.current) activePopup.current.remove();
        activePopup.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true, className: "hsquare-popup", maxWidth: "220px", offset: [0, -10] })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding:8px 4px;text-align:center;"><div style="font-size:13px;font-weight:800;color:white;margin-bottom:2px;">${name}</div><div style="font-size:10px;color:rgba(103,232,249,0.7);text-transform:uppercase;letter-spacing:0.05em;">${location}</div></div>`)
          .addTo(map);
      });

      map.on("click", "property-dots", (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const name = f.properties?.name || "";
        const location = f.properties?.location || "";
        if (activePopup.current) activePopup.current.remove();
        activePopup.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true, className: "hsquare-popup", maxWidth: "220px" })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="padding:8px 4px;text-align:center;"><div style="font-size:13px;font-weight:800;color:white;margin-bottom:2px;">${name}</div><div style="font-size:10px;color:rgba(103,232,249,0.7);text-transform:uppercase;letter-spacing:0.05em;">${location}</div></div>`)
          .addTo(map);
      });

      map.on("mouseenter", "building-extrusion", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "building-extrusion", () => { map.getCanvas().style.cursor = ""; });
      map.on("mouseenter", "property-dots", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "property-dots", () => { map.getCanvas().style.cursor = ""; });

      if (propertyCoords.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        propertyCoords.forEach(c => bounds.extend([c.coords[1], c.coords[0]]));
        HOTSPOTS.forEach(h => bounds.extend([h.lng, h.lat]));
        map.fitBounds(bounds, { padding: 60, pitch: 50, bearing: -15 });
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
      <div ref={mapRef} className="w-full aspect-[4/5] md:aspect-[4/3]" style={{ background: "#050a14" }} data-testid="connectivity-map" />
      <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/[0.06] bg-black/70 backdrop-blur-xl p-3 z-[10]">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] md:text-xs text-white/40">
          <span className="rounded-full bg-amber-400/10 text-amber-300/70 px-2.5 py-1 border border-amber-400/10 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]" />
            Hsquare Properties
          </span>
          <span className="rounded-full bg-violet-400/10 text-violet-300/70 px-2.5 py-1 border border-violet-400/10 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            Universities
          </span>
          <span className="rounded-full bg-emerald-400/10 text-emerald-300/70 px-2.5 py-1 border border-emerald-400/10 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Markets
          </span>
          <span className="rounded-full bg-yellow-400/10 text-yellow-300/70 px-2.5 py-1 border border-yellow-400/10 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            Transit
          </span>
          <span className="rounded-full bg-pink-400/10 text-pink-300/70 px-2.5 py-1 border border-pink-400/10 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-pink-400" />
            Lifestyle
          </span>
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

        .maplibregl-popup-content {
          background: rgba(5,10,20,0.95) !important;
          border: 1px solid rgba(103,232,249,0.2) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(6,182,212,0.1) !important;
          backdrop-filter: blur(16px);
          padding: 4px !important;
        }
        .maplibregl-popup-tip { border-top-color: rgba(5,10,20,0.95) !important; }
        .maplibregl-popup-close-button { color: rgba(255,255,255,0.5); font-size: 16px; padding: 2px 6px; }
        .maplibregl-popup-close-button:hover { color: white; background: transparent; }
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

        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.8fr_1fr] gap-8 items-start">
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
            className="space-y-5"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/5 text-sm text-cyan-300 font-medium">
              <Navigation className="w-3.5 h-3.5" />
              Strategic Property Network
            </div>

            <p className="text-white/40 text-base leading-relaxed">
              Our properties are not randomly placed. They form a smart location network across Mumbai — surrounding major universities, lifestyle zones, and transport corridors. That means safer access, faster commutes, and a better daily living experience.
            </p>

            <div className="grid gap-3">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 * i }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] transition-colors"
                  data-testid={`feature-card-${i}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      feature.color === "emerald" ? "bg-emerald-500/10 text-emerald-400" :
                      feature.color === "cyan" ? "bg-cyan-500/10 text-cyan-400" :
                      "bg-violet-500/10 text-violet-400"
                    }`}>
                      <feature.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold text-white text-sm mb-0.5">{feature.title}</h3>
                      <p className="text-white/30 text-xs leading-relaxed">{feature.text}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {["NMIMS", "Mithibai College", "Juhu Beach", "Airport", "Andheri Metro", "Oberoi Mall"].map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] text-white/30"
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
