import { useEffect } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { GraduationCap, MapPin, ArrowRight, Building2 } from "lucide-react";
import { COLLEGE_PAGES } from "./college-landing";

const SITE_URL = "https://hsquare.in";

const AREA_GROUPS = [
  {
    area: "Vile Parle & Juhu",
    color: "from-cyan-500 to-blue-500",
    glow: "rgba(6,182,212,0.15)",
    slugs: [
      "hostel-near-nmims",
      "hostel-near-mithibai",
      "hostel-near-mukesh-patel",
      "hostel-near-nm-college",
      "hostel-near-dj-sanghvi",
      "hostel-in-vile-parle",
      "hostel-in-juhu",
    ],
  },
  {
    area: "Goregaon",
    color: "from-emerald-500 to-green-500",
    glow: "rgba(16,185,129,0.15)",
    slugs: ["hostel-near-whistling-woods", "hostel-in-goregaon"],
  },
  {
    area: "Andheri & All Mumbai",
    color: "from-violet-500 to-purple-500",
    glow: "rgba(139,92,246,0.15)",
    slugs: ["hostel-in-andheri", "hostel-in-mumbai"],
  },
];

export default function HostelsIndex() {
  useEffect(() => {
    document.title =
      "Student Hostels in Mumbai | PG near Top Colleges | Hsquare Living";
    const desc = document.querySelector('meta[name="description"]');
    if (desc)
      desc.setAttribute(
        "content",
        "Browse Hsquare's hostel guides for Mumbai students — near NMIMS, Mithibai, NM College, DJ Sanghvi, Whistling Woods, Vile Parle, Juhu, Goregaon & Andheri. Premium PG with meals, WiFi & 24/7 security.",
      );
    const canonical = document.getElementById(
      "canonical-link",
    ) as HTMLLinkElement;
    if (canonical) canonical.href = `${SITE_URL}/hostels`;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle)
      ogTitle.setAttribute(
        "content",
        "Student Hostels in Mumbai | PG near Top Colleges | Hsquare Living",
      );
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc)
      ogDesc.setAttribute(
        "content",
        "Premium student hostels near NMIMS, Mithibai, NM College & more. Hsquare Living — meals, WiFi, 24/7 security included.",
      );
    window.scrollTo(0, 0);
  }, []);

  const allPages = Object.values(COLLEGE_PAGES);

  return (
    <div className="min-h-screen bg-transparent text-white">
      <section className="relative pt-28 pb-20 md:pt-40 md:pb-28 text-center overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, rgba(6,182,212,0.07) 0%, transparent 60%)",
          }}
        />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] mb-8">
              <Building2 className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">
                Mumbai's #1 Student Hostel Network
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black tracking-tight leading-[1.1] mb-6">
              <span className="bg-gradient-to-b from-white via-white to-white/60 bg-clip-text text-transparent">
                Student Hostels in Mumbai
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-10 leading-relaxed">
              Fully managed accommodation near Mumbai's top colleges —
              meals, WiFi, 24/7 security, and the HsquareConnect app.
              Pick your college or area below.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/properties">
                <button
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold shadow-lg shadow-cyan-500/20 hover:opacity-90 transition-opacity"
                  data-testid="btn-explore-properties"
                >
                  Explore All Properties <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <a
                href="/apply"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/15 text-white/70 text-sm font-medium hover:bg-white/[0.04] hover:text-white transition-all"
                data-testid="btn-apply-now"
              >
                Pre-Register Now
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {AREA_GROUPS.map((group, gi) => {
        const groupPages = group.slugs
          .map((s) => COLLEGE_PAGES[s])
          .filter(Boolean);
        return (
          <section key={group.area} className="py-16 relative">
            <div className="container mx-auto px-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: gi * 0.1 }}
                className="flex items-center gap-3 mb-8"
              >
                <div
                  className={`w-1 h-8 rounded-full bg-gradient-to-b ${group.color}`}
                />
                <h2 className="text-2xl font-heading font-bold text-white/90">
                  {group.area}
                </h2>
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {groupPages.map((page, i) => (
                  <motion.div
                    key={page.slug}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07 }}
                    data-testid={`hostel-card-${page.slug}`}
                  >
                    <Link href={`/${page.slug}`}>
                      <div
                        className="group relative p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all duration-300 overflow-hidden h-full"
                        style={{ minHeight: 140 }}
                      >
                        <div
                          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl"
                          style={{
                            background: `radial-gradient(ellipse at 50% 0%, ${group.glow} 0%, transparent 70%)`,
                          }}
                        />
                        <div className="relative z-10">
                          <div className="flex items-start gap-3 mb-3">
                            <div
                              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${group.color} bg-opacity-10 flex items-center justify-center shrink-0`}
                              style={{ opacity: 0.15 }}
                            >
                              <GraduationCap
                                className="w-5 h-5"
                                style={{
                                  color: group.glow.replace(
                                    /rgba\((\d+,\d+,\d+).*\)/,
                                    "rgb($1)",
                                  ),
                                  opacity: 1,
                                }}
                              />
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-white/85 group-hover:text-white transition-colors leading-snug">
                                {page.heroHeading
                                  .replace("Premium ", "")
                                  .replace("Best ", "")}
                              </h3>
                              <p className="text-[11px] text-white/35 flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {page.area}
                              </p>
                            </div>
                          </div>
                          {page.distance && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/40">
                              {page.distance} from campus
                            </span>
                          )}
                          <div className="absolute bottom-4 right-4">
                            <ArrowRight className="w-4 h-4 text-white/15 group-hover:text-white/50 group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      <section className="py-20 relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.04) 0%, transparent 60%)",
          }}
        />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold text-white mb-4">
              Not sure which location?
            </h2>
            <p className="text-white/40 max-w-xl mx-auto mb-8 text-sm md:text-base leading-relaxed">
              Our team will help you find the perfect property near your
              college. Just reach out or browse all available rooms.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/properties">
                <button
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
                  data-testid="btn-browse-all"
                >
                  Browse All Rooms <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <a
                href="/contact"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl border border-white/15 text-white/70 text-sm font-medium hover:bg-white/[0.04] hover:text-white transition-all"
                data-testid="btn-contact-us"
              >
                Contact Our Team
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Student Hostels in Mumbai | Hsquare Living",
            description:
              "Browse Hsquare's hostel guides near top Mumbai colleges — NMIMS, Mithibai, NM College, DJ Sanghvi, Whistling Woods & more.",
            url: `${SITE_URL}/hostels`,
            publisher: {
              "@type": "Organization",
              name: "Hsquareliving Pvt Ltd",
              url: SITE_URL,
            },
            hasPart: allPages.map((p) => ({
              "@type": "WebPage",
              name: p.metaTitle,
              url: `${SITE_URL}/${p.slug}`,
              description: p.metaDescription,
            })),
          }),
        }}
      />
    </div>
  );
}
