import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { Shield, GraduationCap, Sparkles, Navigation } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

const TRIANGLE_KEYS = ["Hsquare Hostel Juhu", "Hsquare Bayview", "Hsquare Caledonia"];
const GOREGAON_KEY = "Hsquare Goregaon";
const VILEPARLE_KEY = "Hsquare Vileparle";

const FALLBACK_CENTER: [number, number] = [19.1050, 72.8500];

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
  if (loc.includes("juhu")) return [19.0760, 72.8365];
  if (loc.includes("vile parle") || loc.includes("vileparle")) return [19.0990, 72.8440];
  if (loc.includes("goregaon")) return [19.1663, 72.8526];
  if (loc.includes("colaba")) return [19.0880, 72.8310];
  if (loc.includes("chembur")) return [19.0620, 72.8980];
  if (loc.includes("andheri")) return [19.1197, 72.8464];
  return null;
}

function PropertyMap({ properties }: { properties: Property[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const propertyCoords = useMemo(() => {
    return properties
      .map(p => ({ property: p, coords: getCoords(p) }))
      .filter((item): item is { property: Property; coords: [number, number] } => item.coords !== null);
  }, [properties]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    let center = FALLBACK_CENTER;
    if (propertyCoords.length > 0) {
      const avgLat = propertyCoords.reduce((s, c) => s + c.coords[0], 0) / propertyCoords.length;
      const avgLng = propertyCoords.reduce((s, c) => s + c.coords[1], 0) / propertyCoords.length;
      center = [avgLat, avgLng];
    }

    const map = L.map(mapRef.current, {
      center,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true,
      dragging: true,
      doubleClickZoom: true,
      touchZoom: true,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    const triangleCoords: L.LatLngExpression[] = [];
    const triangleCenter: [number, number] = [0, 0];
    let triangleCount = 0;

    for (const tk of TRIANGLE_KEYS) {
      const c = PROPERTY_COORDS[tk];
      if (c) {
        triangleCoords.push(c);
        triangleCenter[0] += c[0];
        triangleCenter[1] += c[1];
        triangleCount++;
      }
    }
    if (triangleCount > 0) {
      triangleCenter[0] /= triangleCount;
      triangleCenter[1] /= triangleCount;
    }

    if (triangleCoords.length >= 3) {
      L.polygon(triangleCoords, {
        color: "transparent",
        weight: 0,
        fillColor: "rgba(16,185,129,0.06)",
        fillOpacity: 1,
        className: "triangle-fill-base",
      }).addTo(map);

      L.polygon(triangleCoords, {
        color: "transparent",
        weight: 0,
        fillColor: "rgba(16,185,129,0.10)",
        fillOpacity: 1,
        className: "triangle-fill-pulse",
      }).addTo(map);

      L.polygon(triangleCoords, {
        color: "transparent",
        weight: 0,
        fillColor: "rgba(16,185,129,0.15)",
        fillOpacity: 1,
        className: "triangle-fill-wave",
      }).addTo(map);

      L.polygon(triangleCoords, {
        color: "rgba(103,232,249,0.15)",
        weight: 12,
        fillColor: "transparent",
        fillOpacity: 0,
        className: "triangle-outer-glow",
      }).addTo(map);

      L.polyline([triangleCoords[0], triangleCoords[1]], {
        color: "rgba(103,232,249,0.85)",
        weight: 2.5,
        dashArray: "12, 6",
        className: "triangle-edge-0",
      }).addTo(map);
      L.polyline([triangleCoords[1], triangleCoords[2]], {
        color: "rgba(103,232,249,0.85)",
        weight: 2.5,
        dashArray: "12, 6",
        className: "triangle-edge-1",
      }).addTo(map);
      L.polyline([triangleCoords[2], triangleCoords[0]], {
        color: "rgba(103,232,249,0.85)",
        weight: 2.5,
        dashArray: "12, 6",
        className: "triangle-edge-2",
      }).addTo(map);

      L.polyline([triangleCoords[0], triangleCoords[1]], {
        color: "rgba(52,211,153,0.9)",
        weight: 3,
        dashArray: "4, 30",
        className: "triangle-particle-0",
      }).addTo(map);
      L.polyline([triangleCoords[1], triangleCoords[2]], {
        color: "rgba(52,211,153,0.9)",
        weight: 3,
        dashArray: "4, 30",
        className: "triangle-particle-1",
      }).addTo(map);
      L.polyline([triangleCoords[2], triangleCoords[0]], {
        color: "rgba(52,211,153,0.9)",
        weight: 3,
        dashArray: "4, 30",
        className: "triangle-particle-2",
      }).addTo(map);
    }

    const vileparleCoords = PROPERTY_COORDS[VILEPARLE_KEY];
    if (vileparleCoords && triangleCoords.length > 0) {
      let closestDist = Infinity;
      let closestCoord = triangleCoords[0] as [number, number];
      for (const tc of triangleCoords) {
        const tcArr = tc as [number, number];
        const d = Math.sqrt(Math.pow(tcArr[0] - vileparleCoords[0], 2) + Math.pow(tcArr[1] - vileparleCoords[1], 2));
        if (d < closestDist) { closestDist = d; closestCoord = tcArr; }
      }
      L.polyline([vileparleCoords, closestCoord], {
        color: "rgba(103,232,249,0.5)",
        weight: 2,
        dashArray: "6, 6",
        className: "connector-line-anim",
      }).addTo(map);
    }

    const goregaonCoords = PROPERTY_COORDS[GOREGAON_KEY];
    if (goregaonCoords && triangleCount > 0) {
      const juhuCoords = PROPERTY_COORDS["Hsquare Hostel Juhu"];
      const energyFrom: [number, number] = juhuCoords || triangleCenter;

      L.polyline([energyFrom, goregaonCoords], {
        color: "rgba(103,232,249,0.10)",
        weight: 14,
        className: "energy-line-glow",
      }).addTo(map);

      L.polyline([energyFrom, goregaonCoords], {
        color: "rgba(103,232,249,0.6)",
        weight: 2.5,
        dashArray: "12, 8",
        className: "energy-line-animated",
      }).addTo(map);

      L.polyline([energyFrom, goregaonCoords], {
        color: "rgba(52,211,153,0.8)",
        weight: 3,
        dashArray: "4, 30",
        className: "energy-particle",
      }).addTo(map);
    }

    propertyCoords.forEach(({ property, coords }) => {
      const icon = L.divIcon({
        className: "custom-property-marker",
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="width:28px;height:28px;position:relative;">
              <div class="marker-ring-outer" style="position:absolute;inset:-8px;border-radius:50%;border:1.5px solid rgba(103,232,249,0.3);"></div>
              <div class="marker-ring-inner" style="position:absolute;inset:-4px;border-radius:50%;border:1px solid rgba(52,211,153,0.4);"></div>
              <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);box-shadow:0 0 24px rgba(239,68,68,0.6),0 0 48px rgba(239,68,68,0.2);"></div>
              <div style="position:absolute;inset:4px;border-radius:50%;background:#dc2626;border:2px solid rgba(255,255,255,0.95);"></div>
            </div>
            <div style="margin-top:8px;min-width:130px;border-radius:12px;border:1px solid rgba(103,232,249,0.15);background:rgba(5,10,20,0.95);backdrop-filter:blur(16px);padding:6px 10px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,0.6),0 0 20px rgba(6,182,212,0.08);">
              <div style="font-size:11px;font-weight:700;color:white;line-height:1.3;letter-spacing:0.02em;">${property.displayName || property.name}</div>
              <div style="font-size:9px;color:rgba(103,232,249,0.5);margin-top:2px;text-transform:uppercase;letter-spacing:0.05em;">${property.location}</div>
            </div>
          </div>
        `,
        iconSize: [130, 80],
        iconAnchor: [65, 14],
      });
      L.marker(coords, { icon, interactive: false }).addTo(map);
    });

    HOTSPOTS.forEach(spot => {
      const icon = L.divIcon({
        className: "custom-hotspot-marker",
        html: `
          <div style="display:flex;align-items:center;gap:4px;border-radius:20px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.5);backdrop-filter:blur(8px);padding:3px 8px;">
            <div style="width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,0.6);flex-shrink:0;"></div>
            <span style="font-size:10px;color:rgba(255,255,255,0.5);white-space:nowrap;">${spot.name}</span>
          </div>
        `,
        iconSize: [100, 20],
        iconAnchor: [50, 10],
      });
      L.marker([spot.lat, spot.lng], { icon, interactive: false }).addTo(map);
    });

    if (propertyCoords.length > 0) {
      const bounds = L.latLngBounds(propertyCoords.map(c => c.coords));
      HOTSPOTS.forEach(h => bounds.extend([h.lat, h.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [propertyCoords]);

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] shadow-[0_0_80px_rgba(6,182,212,0.08)]">
      <div ref={mapRef} className="w-full aspect-[4/5] md:aspect-square" style={{ background: "#0a0f1a" }} data-testid="connectivity-map" />
      <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/[0.06] bg-black/60 backdrop-blur-lg p-3 z-[1000]">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] md:text-xs text-white/40">
          <span className="rounded-full bg-cyan-400/10 text-cyan-300/70 px-2.5 py-1 border border-cyan-400/10">Safe Zone</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Academic Belt</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Airport Access</span>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Lifestyle Hub</span>
        </div>
      </div>
      <style>{`
        .custom-property-marker, .custom-hotspot-marker { background: none !important; border: none !important; }

        @keyframes markerRingPulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes markerRingInnerPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 0.1; }
        }
        .marker-ring-outer {
          animation: markerRingPulse 3s ease-in-out infinite;
        }
        .marker-ring-inner {
          animation: markerRingInnerPulse 2.5s ease-in-out infinite 0.5s;
        }
        .leaflet-container { background: #0a0f1a !important; }

        .leaflet-control-zoom {
          border: 1px solid rgba(255,255,255,0.1) !important;
          background: rgba(10,15,26,0.9) !important;
          backdrop-filter: blur(8px);
          border-radius: 8px !important;
          overflow: hidden;
          margin-bottom: 60px !important;
          margin-right: 8px !important;
        }
        .leaflet-control-zoom a {
          background: transparent !important;
          color: rgba(255,255,255,0.7) !important;
          border-bottom: 1px solid rgba(255,255,255,0.06) !important;
          width: 32px !important;
          height: 32px !important;
          line-height: 32px !important;
          font-size: 16px !important;
        }
        .leaflet-control-zoom a:hover {
          background: rgba(103,232,249,0.1) !important;
          color: rgba(103,232,249,0.9) !important;
        }

        path.triangle-outer-glow {
          filter: drop-shadow(0 0 20px rgba(6,182,212,0.3));
          animation: outerGlowPulse 4s ease-in-out infinite;
        }

        @keyframes outerGlowPulse {
          0%, 100% { opacity: 0.3; filter: drop-shadow(0 0 20px rgba(6,182,212,0.2)); }
          50% { opacity: 0.7; filter: drop-shadow(0 0 30px rgba(6,182,212,0.5)); }
        }

        @keyframes triangleFillPulse {
          0%, 100% { fill-opacity: 0.04; }
          50% { fill-opacity: 0.12; }
        }
        @keyframes triangleFillWave {
          0%, 100% { fill-opacity: 0; }
          30% { fill-opacity: 0.18; }
          60% { fill-opacity: 0.05; }
        }

        path.triangle-fill-base {
          fill: rgba(16,185,129,0.05);
        }
        path.triangle-fill-pulse {
          animation: triangleFillPulse 3s ease-in-out infinite;
        }
        path.triangle-fill-wave {
          animation: triangleFillWave 5s ease-in-out infinite;
        }

        @keyframes edgeFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -36; }
        }
        @keyframes particleFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -68; }
        }

        path.triangle-edge-0 {
          animation: edgeFlow 2s linear infinite;
          filter: drop-shadow(0 0 6px rgba(103,232,249,0.5));
        }
        path.triangle-edge-1 {
          animation: edgeFlow 2s linear infinite 0.3s;
          filter: drop-shadow(0 0 6px rgba(103,232,249,0.5));
        }
        path.triangle-edge-2 {
          animation: edgeFlow 2s linear infinite 0.6s;
          filter: drop-shadow(0 0 6px rgba(103,232,249,0.5));
        }

        path.triangle-particle-0 {
          animation: particleFlow 1.8s linear infinite;
          filter: drop-shadow(0 0 8px rgba(52,211,153,0.8));
        }
        path.triangle-particle-1 {
          animation: particleFlow 1.8s linear infinite 0.6s;
          filter: drop-shadow(0 0 8px rgba(52,211,153,0.8));
        }
        path.triangle-particle-2 {
          animation: particleFlow 1.8s linear infinite 1.2s;
          filter: drop-shadow(0 0 8px rgba(52,211,153,0.8));
        }

        @keyframes connectorDash {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -24; }
        }
        path.connector-line-anim {
          animation: connectorDash 2s linear infinite;
        }

        @keyframes energyFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -40; }
        }
        @keyframes energyGlow {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.2; }
        }

        path.energy-line-animated {
          animation: energyFlow 1.5s linear infinite;
          filter: drop-shadow(0 0 6px rgba(103,232,249,0.5));
        }
        path.energy-line-glow {
          animation: energyGlow 3s ease-in-out infinite;
        }
        path.energy-particle {
          animation: particleFlow 2s linear infinite;
          filter: drop-shadow(0 0 8px rgba(52,211,153,0.8));
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
