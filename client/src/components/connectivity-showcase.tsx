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
  "Hsquare Hostel Juhu": [19.1075, 72.8263],
  "Hsquare Vileparle": [19.0990, 72.8440],
  "Hsquare Bayview": [19.0880, 72.8310],
  "Hsquare Goregaon": [19.1663, 72.8526],
  "Hotel Neelkamal": [19.0620, 72.8980],
  "Hsquare Caledonia": [19.0980, 72.8480],
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
  if (loc.includes("juhu")) return [19.1075, 72.8263];
  if (loc.includes("vile parle") || loc.includes("vileparle")) return [19.0990, 72.8440];
  if (loc.includes("goregaon")) return [19.1663, 72.8526];
  if (loc.includes("colaba")) return [19.0880, 72.8310];
  if (loc.includes("chembur")) return [19.0620, 72.8980];
  if (loc.includes("andheri")) return [19.1197, 72.8464];
  return null;
}

function resolvePropertyKey(property: Property): string | null {
  const name = property.displayName || property.name;
  if (PROPERTY_COORDS[name]) return name;
  for (const key of Object.keys(PROPERTY_COORDS)) {
    if (name.toLowerCase().includes(key.toLowerCase().split(" ").pop()!) ||
        key.toLowerCase().includes(name.toLowerCase().split(" ").pop()!)) {
      return key;
    }
  }
  return null;
}

function PropertyMap({ properties }: { properties: Property[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const propertyCoords = useMemo(() => {
    return properties
      .map(p => ({ property: p, coords: getCoords(p), key: resolvePropertyKey(p) }))
      .filter((item): item is { property: Property; coords: [number, number]; key: string | null } => item.coords !== null);
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
        color: "rgba(103,232,249,0.9)",
        weight: 2.5,
        dashArray: "10, 5",
        fillColor: "rgba(6,182,212,0.12)",
        fillOpacity: 0.12,
        className: "triangle-glow",
      }).addTo(map);

      L.polygon(triangleCoords, {
        color: "rgba(103,232,249,0.3)",
        weight: 8,
        fillColor: "transparent",
        fillOpacity: 0,
        className: "triangle-outer-glow",
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
        color: "rgba(103,232,249,0.6)",
        weight: 2,
        dashArray: "6, 6",
      }).addTo(map);
    }

    const goregaonCoords = PROPERTY_COORDS[GOREGAON_KEY];
    if (goregaonCoords && triangleCount > 0) {
      const juhuCoords = PROPERTY_COORDS["Hsquare Hostel Juhu"];
      const energyFrom: [number, number] = juhuCoords || triangleCenter;

      L.polyline([energyFrom, goregaonCoords], {
        color: "rgba(103,232,249,0.15)",
        weight: 12,
        className: "energy-line-glow",
      }).addTo(map);

      L.polyline([energyFrom, goregaonCoords], {
        color: "rgba(103,232,249,0.7)",
        weight: 2.5,
        dashArray: "12, 8",
        className: "energy-line-animated",
      }).addTo(map);

      L.polyline([energyFrom, goregaonCoords], {
        color: "rgba(103,232,249,0.4)",
        weight: 1.5,
        dashArray: "4, 16",
        className: "energy-line-pulse",
      }).addTo(map);
    }

    propertyCoords.forEach(({ property, coords }) => {
      const icon = L.divIcon({
        className: "custom-property-marker",
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="width:24px;height:24px;position:relative;">
              <div style="position:absolute;inset:0;border-radius:50%;background:#ef4444;box-shadow:0 0 20px rgba(239,68,68,0.6);"></div>
              <div style="position:absolute;inset:3px;border-radius:50%;background:#dc2626;border:2px solid rgba(255,255,255,0.9);"></div>
            </div>
            <div style="margin-top:6px;min-width:120px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(10,15,26,0.95);backdrop-filter:blur(12px);padding:5px 8px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.5);">
              <div style="font-size:11px;font-weight:700;color:white;line-height:1.2;">${property.displayName || property.name}</div>
              <div style="font-size:9px;color:rgba(103,232,249,0.6);margin-top:2px;">${property.location}</div>
            </div>
          </div>
        `,
        iconSize: [120, 70],
        iconAnchor: [60, 12],
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

        .triangle-glow { filter: drop-shadow(0 0 8px rgba(6,182,212,0.4)); }
        .triangle-outer-glow { filter: drop-shadow(0 0 16px rgba(6,182,212,0.2)); }

        @keyframes energyFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -40; }
        }
        @keyframes energyPulse {
          0% { stroke-dashoffset: 0; opacity: 0.4; }
          50% { opacity: 0.8; }
          100% { stroke-dashoffset: -40; opacity: 0.4; }
        }
        @keyframes energyGlow {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.25; }
        }

        path.energy-line-animated {
          animation: energyFlow 1.5s linear infinite;
        }
        path.energy-line-pulse {
          animation: energyPulse 2s ease-in-out infinite;
        }
        path.energy-line-glow {
          animation: energyGlow 3s ease-in-out infinite;
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
