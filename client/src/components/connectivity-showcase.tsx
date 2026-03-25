import { useEffect, useRef, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Shield, GraduationCap, Sparkles, Navigation } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface Property {
  id: string;
  name: string;
  displayName?: string;
  location: string;
  nearbyLocations?: string;
  mapLatitude?: string | null;
  mapLongitude?: string | null;
}

interface ConnectionGroup {
  id?: string;
  name?: string;
  connectedPropertyIds: string[];
  pattern: string;
  lineColor: string;
  fillColor: string;
  fillOpacity: number;
  lineWidth: number;
  glowEnabled: boolean;
  animationEnabled: boolean;
}

interface MapSettingsData {
  groups?: ConnectionGroup[];
  connectedPropertyIds: string[];
  pattern: string;
  lineColor: string;
  fillColor: string;
  fillOpacity: number;
  lineWidth: number;
  glowEnabled: boolean;
  animationEnabled: boolean;
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


const FALLBACK_CENTER: [number, number] = [72.8700, 19.0900];

const MUMBAI_BOUNDS: [[number, number], [number, number]] = [
  [72.7200, 18.8800],
  [73.0500, 19.2800],
];

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
  { name: "Mumbai University", lat: 19.0225, lng: 72.8558, type: "university" },
  { name: "SIES College", lat: 19.0440, lng: 72.8890, type: "university" },
  { name: "Thakur College", lat: 19.2150, lng: 72.8718, type: "university" },
  { name: "Rizvi College", lat: 19.0660, lng: 72.8400, type: "university" },
  { name: "Sophia College", lat: 19.0455, lng: 72.8145, type: "university" },
  { name: "TISS", lat: 19.0430, lng: 72.8610, type: "university" },
  { name: "ICT Mumbai", lat: 19.0220, lng: 72.8560, type: "university" },
  { name: "VJTI", lat: 19.0230, lng: 72.8555, type: "university" },
  { name: "Juhu Beach", lat: 19.0930, lng: 72.8240, type: "lifestyle" },
  { name: "Marine Drive", lat: 18.9432, lng: 72.8235, type: "lifestyle" },
  { name: "Bandra-Worli Sea Link", lat: 19.0300, lng: 72.8150, type: "lifestyle" },
  { name: "Gateway of India", lat: 18.9220, lng: 72.8347, type: "lifestyle" },
  { name: "Powai Lake", lat: 19.1260, lng: 72.9050, type: "lifestyle" },
  { name: "Hiranandani Gardens", lat: 19.1210, lng: 72.9085, type: "lifestyle" },
  { name: "Versova Beach", lat: 19.1350, lng: 72.8120, type: "lifestyle" },
  { name: "Carter Road", lat: 19.0600, lng: 72.8220, type: "lifestyle" },
  { name: "Andheri Metro", lat: 19.1197, lng: 72.8500, type: "transit" },
  { name: "Mumbai Airport", lat: 19.0896, lng: 72.8680, type: "transit" },
  { name: "Vile Parle Station", lat: 19.0980, lng: 72.8445, type: "transit" },
  { name: "Goregaon Station", lat: 19.1650, lng: 72.8490, type: "transit" },
  { name: "Andheri Station", lat: 19.1190, lng: 72.8468, type: "transit" },
  { name: "Bandra Station", lat: 19.0544, lng: 72.8402, type: "transit" },
  { name: "Dadar Station", lat: 19.0190, lng: 72.8438, type: "transit" },
  { name: "CST (VT) Station", lat: 18.9398, lng: 72.8355, type: "transit" },
  { name: "Borivali Station", lat: 19.2285, lng: 72.8565, type: "transit" },
  { name: "Thane Station", lat: 19.1860, lng: 72.9752, type: "transit" },
  { name: "Malad Station", lat: 19.1870, lng: 72.8483, type: "transit" },
  { name: "Kurla Station", lat: 19.0655, lng: 72.8792, type: "transit" },
  { name: "Churchgate Station", lat: 18.9350, lng: 72.8272, type: "transit" },
  { name: "Lower Parel", lat: 18.9980, lng: 72.8310, type: "transit" },
  { name: "Oberoi Mall", lat: 19.1730, lng: 72.8610, type: "market" },
  { name: "Infinity Mall", lat: 19.1188, lng: 72.8460, type: "market" },
  { name: "Linking Road Market", lat: 19.0740, lng: 72.8435, type: "market" },
  { name: "Lokhandwala Market", lat: 19.1405, lng: 72.8340, type: "market" },
  { name: "Phoenix Mall (Lower Parel)", lat: 18.9948, lng: 72.8283, type: "market" },
  { name: "R City Mall (Ghatkopar)", lat: 19.0910, lng: 72.9166, type: "market" },
  { name: "Inorbit Mall (Malad)", lat: 19.1780, lng: 72.8388, type: "market" },
  { name: "Viviana Mall (Thane)", lat: 19.2095, lng: 72.9710, type: "market" },
  { name: "Colaba Causeway", lat: 18.9230, lng: 72.8320, type: "market" },
  { name: "Crawford Market", lat: 18.9478, lng: 72.8340, type: "market" },
  { name: "BKC", lat: 19.0580, lng: 72.8650, type: "lifestyle" },

  // Navi Mumbai
  { name: "Vashi Station", lat: 19.0770, lng: 72.9985, type: "transit" },
  { name: "Panvel Station", lat: 18.9930, lng: 73.1175, type: "transit" },
  { name: "Nerul Station", lat: 19.0330, lng: 73.0190, type: "transit" },
  { name: "Belapur Station", lat: 19.0220, lng: 73.0380, type: "transit" },
  { name: "Kharghar Station", lat: 19.0450, lng: 73.0680, type: "transit" },
  { name: "Seawoods Grand Central", lat: 19.0220, lng: 73.0175, type: "market" },
  { name: "Inorbit Mall (Vashi)", lat: 19.0680, lng: 73.0010, type: "market" },
  { name: "Raghuleela Mall (Vashi)", lat: 19.0740, lng: 72.9980, type: "market" },
  { name: "Little World Mall (Kharghar)", lat: 19.0420, lng: 73.0700, type: "market" },
  { name: "D Y Patil University", lat: 19.0450, lng: 73.0230, type: "university" },
  { name: "Pillai College (Panvel)", lat: 19.0020, lng: 73.1130, type: "university" },
  { name: "Terna Engineering", lat: 19.0350, lng: 73.0250, type: "university" },
  { name: "CDAC Kharghar", lat: 19.0380, lng: 73.0750, type: "university" },
  { name: "NRI Complex (Seawoods)", lat: 19.0200, lng: 73.0100, type: "lifestyle" },
  { name: "Palm Beach Road", lat: 19.0500, lng: 73.0100, type: "lifestyle" },
  { name: "Navi Mumbai Airport (upcoming)", lat: 18.9900, lng: 73.1300, type: "transit" },
  { name: "Wonders Park (Nerul)", lat: 19.0350, lng: 73.0150, type: "lifestyle" },

  // Extended Thane & Kalyan-Dombivli
  { name: "Kalyan Station", lat: 19.2440, lng: 73.1290, type: "transit" },
  { name: "Dombivli Station", lat: 19.2180, lng: 73.0870, type: "transit" },
  { name: "Badlapur Station", lat: 19.1680, lng: 73.2410, type: "transit" },
  { name: "Metro Junction Mall (Kalyan)", lat: 19.2430, lng: 73.1340, type: "market" },
  { name: "Korum Mall (Thane)", lat: 19.1930, lng: 72.9680, type: "market" },
  { name: "Birla College (Kalyan)", lat: 19.2430, lng: 73.1250, type: "university" },
  { name: "Saket College (Kalyan)", lat: 19.2500, lng: 73.1350, type: "university" },
  { name: "Upvan Lake (Thane)", lat: 19.2100, lng: 72.9600, type: "lifestyle" },
  { name: "Tikuji-ni-Wadi", lat: 19.2500, lng: 72.9880, type: "lifestyle" },

  // Pune (major landmarks)
  { name: "Pune Station", lat: 18.5285, lng: 73.8740, type: "transit" },
  { name: "Pune Airport", lat: 18.5820, lng: 73.9197, type: "transit" },
  { name: "Hinjewadi IT Park", lat: 18.5912, lng: 73.7390, type: "lifestyle" },
  { name: "Shivajinagar", lat: 18.5310, lng: 73.8470, type: "transit" },
  { name: "Fergusson College", lat: 18.5240, lng: 73.8380, type: "university" },
  { name: "Savitribai Phule University", lat: 18.5570, lng: 73.8270, type: "university" },
  { name: "Symbiosis University", lat: 18.5720, lng: 73.7680, type: "university" },
  { name: "COEP Pune", lat: 18.5290, lng: 73.8500, type: "university" },
  { name: "MIT Pune", lat: 18.5180, lng: 73.8070, type: "university" },
  { name: "Phoenix Marketcity (Pune)", lat: 18.5600, lng: 73.9160, type: "market" },
  { name: "Seasons Mall (Pune)", lat: 18.4870, lng: 73.8600, type: "market" },
  { name: "Aga Khan Palace", lat: 18.5530, lng: 73.9020, type: "lifestyle" },
  { name: "Koregaon Park", lat: 18.5370, lng: 73.8930, type: "lifestyle" },

  // Lonavala / between Mumbai-Pune
  { name: "Lonavala Station", lat: 18.7520, lng: 73.4070, type: "transit" },
  { name: "Lonavala", lat: 18.7500, lng: 73.4050, type: "lifestyle" },
  { name: "Karjat Station", lat: 18.9100, lng: 73.3230, type: "transit" },

  // Gujarat side landmarks
  { name: "Surat Station", lat: 21.2060, lng: 72.8410, type: "transit" },
  { name: "Surat Airport", lat: 21.1140, lng: 72.7418, type: "transit" },
  { name: "SVNIT Surat", lat: 21.1635, lng: 72.7835, type: "university" },
  { name: "VT Choksi Mall (Surat)", lat: 21.1950, lng: 72.8300, type: "market" },
  { name: "Ahmedabad Station", lat: 23.0270, lng: 72.6000, type: "transit" },
  { name: "IIM Ahmedabad", lat: 23.0330, lng: 72.5270, type: "university" },
  { name: "Gujarat University", lat: 23.0385, lng: 72.5460, type: "university" },
  { name: "Sabarmati Ashram", lat: 23.0610, lng: 72.5800, type: "lifestyle" },

  // Goa landmarks
  { name: "Goa Airport (Dabolim)", lat: 15.3809, lng: 73.8312, type: "transit" },
  { name: "Madgaon Station", lat: 15.2770, lng: 73.9510, type: "transit" },
  { name: "Goa University", lat: 15.4570, lng: 73.8770, type: "university" },
  { name: "Calangute Beach", lat: 15.5440, lng: 73.7550, type: "lifestyle" },
  { name: "Baga Beach", lat: 15.5560, lng: 73.7510, type: "lifestyle" },

  // Karnataka / Bangalore
  { name: "Bangalore Airport", lat: 13.1989, lng: 77.7068, type: "transit" },
  { name: "Bangalore Station", lat: 12.9785, lng: 77.5714, type: "transit" },
  { name: "IISc Bangalore", lat: 13.0210, lng: 77.5664, type: "university" },
  { name: "Christ University", lat: 12.9347, lng: 77.6065, type: "university" },
  { name: "Whitefield IT Hub", lat: 12.9698, lng: 77.7500, type: "lifestyle" },
  { name: "MG Road Bangalore", lat: 12.9753, lng: 77.6065, type: "lifestyle" },
  { name: "Orion Mall (Bangalore)", lat: 13.0105, lng: 77.5556, type: "market" },

  // Delhi NCR
  { name: "Delhi Airport (IGI)", lat: 28.5562, lng: 77.1000, type: "transit" },
  { name: "New Delhi Station", lat: 28.6427, lng: 77.2200, type: "transit" },
  { name: "DLF Cybercity Gurgaon", lat: 28.4945, lng: 77.0880, type: "lifestyle" },
  { name: "JNU Delhi", lat: 28.5402, lng: 77.1670, type: "university" },
  { name: "Delhi University", lat: 28.6885, lng: 77.2095, type: "university" },
  { name: "IIT Delhi", lat: 28.5459, lng: 77.1926, type: "university" },
  { name: "Select Citywalk (Delhi)", lat: 28.5287, lng: 77.2195, type: "market" },
  { name: "Connaught Place", lat: 28.6315, lng: 77.2167, type: "lifestyle" },

  // Hyderabad
  { name: "Hyderabad Airport", lat: 17.2403, lng: 78.4294, type: "transit" },
  { name: "HITEC City", lat: 17.4484, lng: 78.3908, type: "lifestyle" },
  { name: "University of Hyderabad", lat: 17.4608, lng: 78.3340, type: "university" },
  { name: "Charminar", lat: 17.3616, lng: 78.4747, type: "lifestyle" },

  // Chennai
  { name: "Chennai Airport", lat: 12.9941, lng: 80.1709, type: "transit" },
  { name: "IIT Madras", lat: 12.9916, lng: 80.2336, type: "university" },
  { name: "Anna University", lat: 13.0108, lng: 80.2350, type: "university" },
  { name: "Marina Beach", lat: 13.0500, lng: 80.2824, type: "lifestyle" },

  // Kolkata
  { name: "Kolkata Airport", lat: 22.6547, lng: 88.4467, type: "transit" },
  { name: "Howrah Station", lat: 22.5835, lng: 88.3425, type: "transit" },
  { name: "Jadavpur University", lat: 22.4984, lng: 88.3714, type: "university" },
  { name: "Victoria Memorial", lat: 22.5449, lng: 88.3426, type: "lifestyle" },
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



function PropertyMap({ properties, mapConfig }: { properties: Property[]; mapConfig?: MapSettingsData }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const animFrameRef = useRef<number>(0);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [locating, setLocating] = useState(false);

  const handleLocateMe = () => {
    const map = mapInstanceRef.current;
    if (!map || !navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (userMarkerRef.current) userMarkerRef.current.remove();
        const el = document.createElement("div");
        el.innerHTML = `<div style="position:relative;width:24px;height:24px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.25);animation:pulse-ring 2s ease-out infinite;"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 0 12px rgba(59,130,246,0.6);"></div>
        </div>`;
        userMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([longitude, latitude]).addTo(map);
        map.flyTo({ center: [longitude, latitude], zoom: 13, pitch: 50, duration: 1800 });
        setLocating(false);
      },
      () => { setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

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
      zoom: 11.5,
      pitch: 45,
      bearing: -15,
      antialias: true,
      attributionControl: false,
      dragRotate: true,
      minZoom: 4,
      maxZoom: 17,
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

      const connectionGroups: ConnectionGroup[] = mapConfig?.groups && mapConfig.groups.length > 0
        ? mapConfig.groups
        : mapConfig?.connectedPropertyIds?.length
          ? [{ connectedPropertyIds: mapConfig.connectedPropertyIds, pattern: mapConfig.pattern, lineColor: mapConfig.lineColor, fillColor: mapConfig.fillColor, fillOpacity: mapConfig.fillOpacity, lineWidth: mapConfig.lineWidth, glowEnabled: mapConfig.glowEnabled, animationEnabled: mapConfig.animationEnabled }]
          : [];

      const allGroupAnimations: Array<{ lineCoordinates: [number, number][]; particleSource: string; fillLayer?: string; glowLayer?: string; fillOpacity: number; glowEnabled: boolean; pattern: string }> = [];

      connectionGroups.forEach((group, gi) => {
        const lineColor = group.lineColor || "#34d399";
        const fillColor = group.fillColor || "#34d399";
        const fillOpacity = group.fillOpacity ?? 0.15;
        const lineWidth = group.lineWidth ?? 2.5;
        const glowEnabled = group.glowEnabled ?? true;
        const animationEnabled = group.animationEnabled ?? true;
        const pattern = group.pattern || "triangle";
        const connectedIds = group.connectedPropertyIds || [];

        const connectedCoords: [number, number][] = [];
        if (connectedIds.length >= 2) {
          for (const pid of connectedIds) {
            const match = propertyCoords.find(({ property }) => property.id === pid);
            if (match) connectedCoords.push([match.coords[1], match.coords[0]]);
          }
        }
        if (gi === 0 && connectedCoords.length < 2) {
          const FALLBACK_NAMES = ["Hsquare Hostel Juhu", "Hsquare Bayview", "Hsquare Vileparle"];
          for (const tk of FALLBACK_NAMES) {
            const match = propertyCoords.find(({ property }) => (property.displayName || property.name) === tk);
            if (match) connectedCoords.push([match.coords[1], match.coords[0]]);
          }
        }

        if (connectedCoords.length < 2) return;

        const prefix = `g${gi}`;
        let lineCoordinates: [number, number][];

        if (pattern === "triangle" && connectedCoords.length >= 3) {
          const closed = [...connectedCoords.slice(0, connectedCoords.length), connectedCoords[0]];
          lineCoordinates = closed;
          map.addSource(`${prefix}-tri-fill`, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [closed] } } });
          map.addLayer({ id: `${prefix}-tri-fill-layer`, type: "fill", source: `${prefix}-tri-fill`, paint: { "fill-color": fillColor, "fill-opacity": fillOpacity } });
        } else if (pattern === "network") {
          const lineFeatures: GeoJSON.Feature[] = [];
          for (let i = 0; i < connectedCoords.length; i++) {
            for (let j = i + 1; j < connectedCoords.length; j++) {
              lineFeatures.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [connectedCoords[i], connectedCoords[j]] } });
            }
          }
          map.addSource(`${prefix}-net`, { type: "geojson", data: { type: "FeatureCollection", features: lineFeatures } });
          if (glowEnabled) {
            map.addLayer({ id: `${prefix}-net-glow-wide`, type: "line", source: `${prefix}-net`, paint: { "line-color": lineColor, "line-width": lineWidth * 7, "line-opacity": 0.1, "line-blur": 14 } });
            map.addLayer({ id: `${prefix}-net-glow-mid`, type: "line", source: `${prefix}-net`, paint: { "line-color": lineColor, "line-width": lineWidth * 3, "line-opacity": 0.18, "line-blur": 4 } });
          }
          map.addLayer({ id: `${prefix}-net-solid`, type: "line", source: `${prefix}-net`, paint: { "line-color": lineColor, "line-width": lineWidth, "line-opacity": 0.9 } });
          lineCoordinates = connectedCoords;
        } else {
          const dist = (a: [number, number], b: [number, number]) => Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
          const remaining = [...connectedCoords];
          const chain: [number, number][] = [remaining.shift()!];
          while (remaining.length > 0) {
            const last = chain[chain.length - 1];
            let nIdx = 0, nDist = Infinity;
            for (let i = 0; i < remaining.length; i++) {
              const d = dist(last, remaining[i]);
              if (d < nDist) { nDist = d; nIdx = i; }
            }
            chain.push(remaining.splice(nIdx, 1)[0]);
          }
          lineCoordinates = chain;
        }

        if (pattern !== "network") {
          map.addSource(`${prefix}-line`, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: lineCoordinates } } });
          if (glowEnabled) {
            map.addLayer({ id: `${prefix}-line-glow-wide`, type: "line", source: `${prefix}-line`, paint: { "line-color": lineColor, "line-width": lineWidth * 7, "line-opacity": 0.1, "line-blur": 14 } });
            map.addLayer({ id: `${prefix}-line-glow-mid`, type: "line", source: `${prefix}-line`, paint: { "line-color": lineColor, "line-width": lineWidth * 3, "line-opacity": 0.18, "line-blur": 4 } });
          }
          map.addLayer({ id: `${prefix}-line-solid`, type: "line", source: `${prefix}-line`, paint: { "line-color": lineColor, "line-width": lineWidth, "line-opacity": 0.9 } });
        }

        if (animationEnabled && lineCoordinates.length >= 2) {
          const particleSrc = `${prefix}-particle`;
          map.addSource(particleSrc, { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: lineCoordinates[0] } } });
          if (glowEnabled) {
            map.addLayer({ id: `${prefix}-particle-glow`, type: "circle", source: particleSrc, paint: { "circle-radius": 12, "circle-color": lineColor, "circle-opacity": 0.25, "circle-blur": 1 } });
          }
          map.addLayer({ id: `${prefix}-particle-dot`, type: "circle", source: particleSrc, paint: { "circle-radius": 4, "circle-color": "#67e8f9", "circle-opacity": 0.95 } });

          allGroupAnimations.push({
            lineCoordinates,
            particleSource: particleSrc,
            fillLayer: pattern === "triangle" ? `${prefix}-tri-fill-layer` : undefined,
            glowLayer: glowEnabled ? (pattern === "network" ? `${prefix}-net-glow-wide` : `${prefix}-line-glow-wide`) : undefined,
            fillOpacity,
            glowEnabled,
            pattern,
          });
        }
      });

      if (allGroupAnimations.length > 0) {
        const phases = allGroupAnimations.map(() => ({ particle: 0, fill: 0 }));
        function animateAllGroups() {
          allGroupAnimations.forEach((anim, ai) => {
            phases[ai].particle += 0.003;
            if (phases[ai].particle > 1) phases[ai].particle = 0;
            phases[ai].fill += 0.012;

            const totalSegs = anim.lineCoordinates.length - 1;
            const progress = phases[ai].particle * totalSegs;
            const segIdx = Math.min(Math.floor(progress), totalSegs - 1);
            const segT = progress - segIdx;
            const from = anim.lineCoordinates[segIdx];
            const to = anim.lineCoordinates[segIdx + 1];
            const pLng = from[0] + (to[0] - from[0]) * segT;
            const pLat = from[1] + (to[1] - from[1]) * segT;
            const src = map.getSource(anim.particleSource) as maplibregl.GeoJSONSource;
            if (src) src.setData({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [pLng, pLat] } });

            if (anim.fillLayer && anim.pattern === "triangle") {
              const fOp = (anim.fillOpacity - 0.03) + Math.sin(phases[ai].fill) * 0.06;
              if (map.getLayer(anim.fillLayer)) map.setPaintProperty(anim.fillLayer, "fill-opacity", Math.max(0.04, fOp));
            }
            if (anim.glowLayer && anim.glowEnabled) {
              const glowOp = 0.08 + Math.sin(phases[ai].fill * 0.7) * 0.06;
              if (map.getLayer(anim.glowLayer)) map.setPaintProperty(anim.glowLayer, "line-opacity", glowOp);
            }
          });
          animFrameRef.current = requestAnimationFrame(animateAllGroups);
        }
        animateAllGroups();
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
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 3, 8, 5, 10, 6, 14, 14],
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
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 2, 8, 3, 10, 3, 14, 6],
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
        minzoom: 7,
        layout: {
          "text-field": ["get", "name"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 7, 10, 8, 12, 10, 14, 12],
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-font": ["Open Sans Bold"],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
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
  }, [propertyCoords, mapConfig]);

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
      <div className="absolute top-3 right-3 z-[10] flex items-center gap-2">
        <button
          onClick={handleLocateMe}
          disabled={locating}
          className="rounded-lg bg-black/70 backdrop-blur-lg border border-white/[0.06] px-2.5 py-1.5 text-[10px] text-white/50 font-medium tracking-wider uppercase hover:bg-white/[0.06] hover:text-cyan-300 hover:border-cyan-400/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          title="Show my location"
          data-testid="button-locate-me"
        >
          {locating ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" /></svg>
          ) : (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>
          )}
          My Location
        </button>
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

        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export function ConnectivityShowcase({ properties }: { properties: Property[] }) {
  const { data: mapConfig } = useQuery<MapSettingsData>({
    queryKey: ["/api/map-settings"],
    queryFn: async () => {
      const res = await fetch("/api/map-settings");
      return res.json();
    },
    staleTime: 60000,
  });

  if (!properties || properties.length < 2) return null;

  const groupCount = mapConfig?.groups?.length || 1;
  const shapeLabel = groupCount > 1 ? "Network" : (mapConfig?.pattern === "chain" ? "Chain" : mapConfig?.pattern === "network" ? "Network" : "Triangle");

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
            <PropertyMap properties={properties} mapConfig={mapConfig} />
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
