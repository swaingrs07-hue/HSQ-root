import { motion } from "framer-motion";
import { Shield, GraduationCap, Sparkles, MapPin, Train, Plane, Waves, Building2, Navigation } from "lucide-react";

interface Property {
  id: string;
  name: string;
  displayName?: string;
  location: string;
  nearbyLocations?: string;
}

const HOTSPOTS = [
  { name: "NMIMS", subtext: "Mithibai College", x: "50%", y: "48%", icon: GraduationCap, type: "university" },
  { name: "Juhu Beach", subtext: "Coastal Lifestyle", x: "18%", y: "28%", icon: Waves, type: "lifestyle" },
  { name: "Metro", subtext: "Andheri Station", x: "22%", y: "65%", icon: Train, type: "transit" },
  { name: "Airport", subtext: "Domestic Terminal", x: "82%", y: "25%", icon: Plane, type: "transit" },
  { name: "Oberoi Mall", subtext: "Shopping Zone", x: "80%", y: "72%", icon: Building2, type: "lifestyle" },
];

const FEATURES = [
  {
    icon: Shield,
    title: "Secure Triangle Zone",
    text: "A safe and premium living area exclusively within Hsquare's strategic triangle of properties.",
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

function getPropertyPositions(count: number): Array<{ x: string; y: string }> {
  if (count === 1) return [{ x: "50%", y: "30%" }];
  if (count === 2) return [{ x: "30%", y: "30%" }, { x: "70%", y: "70%" }];
  if (count === 3) return [{ x: "50%", y: "18%" }, { x: "82%", y: "75%" }, { x: "18%", y: "75%" }];
  if (count === 4) return [{ x: "30%", y: "20%" }, { x: "70%", y: "20%" }, { x: "80%", y: "75%" }, { x: "20%", y: "75%" }];
  if (count === 5) return [{ x: "50%", y: "15%" }, { x: "85%", y: "40%" }, { x: "75%", y: "80%" }, { x: "25%", y: "80%" }, { x: "15%", y: "40%" }];
  const positions: Array<{ x: string; y: string }> = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const x = 50 + 35 * Math.cos(angle);
    const y = 50 + 35 * Math.sin(angle);
    positions.push({ x: `${x}%`, y: `${y}%` });
  }
  return positions;
}

function getSvgPoints(count: number): string {
  const positions = getPropertyPositions(count);
  return positions.map(p => `${parseFloat(p.x)},${parseFloat(p.y)}`).join(" ");
}

export function ConnectivityShowcase({ properties }: { properties: Property[] }) {
  if (!properties || properties.length < 2) return null;

  const positions = getPropertyPositions(properties.length);
  const svgPoints = getSvgPoints(properties.length);
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
            className="relative"
          >
            <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-gradient-to-br from-slate-900/80 via-[#0a0f1a] to-cyan-950/30 p-4 md:p-6 shadow-[0_0_80px_rgba(6,182,212,0.08)]">
              <div className="absolute inset-0 opacity-20 pointer-events-none">
                <div className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-cyan-400 blur-3xl animate-pulse" />
                <div className="absolute bottom-0 right-0 h-52 w-52 rounded-full bg-blue-500 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
              </div>

              <div className="relative aspect-[4/5] md:aspect-square rounded-[20px] border border-white/[0.06] bg-[#060a14]/80 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.06),transparent_50%),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:100%_100%,28px_28px,28px_28px]" />

                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="triangleGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(6,182,212,0.15)" />
                      <stop offset="100%" stopColor="rgba(99,102,241,0.08)" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="1.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <polygon
                    points={svgPoints}
                    fill="url(#triangleGlow)"
                    stroke="rgba(103,232,249,0.7)"
                    strokeWidth="0.5"
                    strokeDasharray="4 2"
                    filter="url(#glow)"
                  >
                    <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />
                  </polygon>

                  {positions.map((pos, i) => {
                    const nextPos = positions[(i + 1) % positions.length];
                    return (
                      <line
                        key={`line-${i}`}
                        x1={parseFloat(pos.x)}
                        y1={parseFloat(pos.y)}
                        x2={parseFloat(nextPos.x)}
                        y2={parseFloat(nextPos.y)}
                        stroke="rgba(103,232,249,0.5)"
                        strokeWidth="0.3"
                      />
                    );
                  })}

                  <circle
                    cx="50"
                    cy="50"
                    r="12"
                    fill="rgba(6,182,212,0.08)"
                    stroke="rgba(103,232,249,0.3)"
                    strokeWidth="0.3"
                  >
                    <animate attributeName="r" values="11;13;11" dur="3s" repeatCount="indefinite" />
                  </circle>
                </svg>

                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
                  style={{ left: "50%", top: "50%" }}
                >
                  <div className="text-[10px] md:text-xs font-semibold text-cyan-300/80 leading-tight">University Zone</div>
                  <div className="text-[9px] md:text-[10px] text-white/30 mt-0.5">Premium Student Living</div>
                </div>

                {properties.map((property, i) => {
                  const pos = positions[i];
                  return (
                    <div
                      key={property.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                      style={{ left: pos.x, top: pos.y }}
                      data-testid={`map-property-${property.id}`}
                    >
                      <div className="relative flex flex-col items-center">
                        <span className="absolute h-12 w-12 rounded-full bg-red-500/20 blur-xl animate-ping" style={{ animationDuration: `${2 + i * 0.5}s` }} />
                        <div className="relative w-6 h-6 md:w-7 md:h-7">
                          <div className="absolute inset-0 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]" />
                          <div className="absolute inset-[3px] rounded-full bg-red-600 border-2 border-white/90" />
                        </div>
                        <div className="mt-2 min-w-[110px] md:min-w-[130px] rounded-xl border border-white/10 bg-[#0a0f1a]/95 backdrop-blur-md px-2.5 py-1.5 text-center shadow-xl">
                          <div className="text-[11px] md:text-xs font-bold text-white leading-tight">{property.displayName || property.name}</div>
                          <div className="text-[9px] md:text-[10px] text-cyan-300/60 mt-0.5">{property.location}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {HOTSPOTS.map((spot) => (
                  <div
                    key={spot.name}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: spot.x, top: spot.y }}
                  >
                    <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-black/50 backdrop-blur-md px-2 py-1">
                      <spot.icon className="w-2.5 h-2.5 text-white/60 shrink-0" />
                      <span className="text-[9px] md:text-[10px] text-white/50 whitespace-nowrap">{spot.name}</span>
                    </div>
                  </div>
                ))}

                <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-white/[0.06] bg-black/40 backdrop-blur-lg p-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] md:text-xs text-white/40">
                    <span className="rounded-full bg-cyan-400/10 text-cyan-300/70 px-2.5 py-1 border border-cyan-400/10">Safe Zone</span>
                    <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Academic Belt</span>
                    <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Airport Access</span>
                    <span className="rounded-full bg-white/[0.04] px-2.5 py-1 border border-white/[0.06]">Lifestyle Hub</span>
                  </div>
                </div>
              </div>
            </div>
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
