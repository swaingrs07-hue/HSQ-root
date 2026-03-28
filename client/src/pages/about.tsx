import { useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import heroLobby from "@/assets/hero-lobby.jpg";
import heroRoom from "@/assets/hero-room.jpg";
import heroTerrace from "@/assets/hero-terrace.jpg";
import heroDining from "@/assets/hero-dining.jpg";
import {
  ArrowRight, Heart, Users, Sparkles, Target, Eye, Shield,
  Building2, Star, Palette, UserCheck
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ParticleBackground } from "@/components/particle-background";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
};

const staggerChildren = {
  initial: {},
  whileInView: { transition: { staggerChildren: 0.12 } },
  viewport: { once: true },
};

const VALUES = [
  {
    icon: Sparkles,
    title: "Curated Experiences",
    description: "Each property is hand-selected for style, comfort, and a genuine sense of place.",
    gradient: "from-amber-500 to-orange-600",
    glow: "rgba(245,158,11,0.15)",
  },
  {
    icon: UserCheck,
    title: "People First",
    description: "We believe hospitality begins with talent. Our people-first culture empowers teams to delight guests at every step.",
    gradient: "from-violet-500 to-purple-600",
    glow: "rgba(139,92,246,0.15)",
  },
  {
    icon: Palette,
    title: "Adaptive Design",
    description: "Spaces that cater to leisure, business, and long-stay travellers with equal grace.",
    gradient: "from-cyan-400 to-blue-500",
    glow: "rgba(0,200,255,0.15)",
  },
];

const PILLARS = [
  {
    icon: Target,
    label: "Our Mission",
    text: "To design elevated stays that honour local culture and modern comforts while offering guests a warm, personalised experience.",
    color: "amber",
  },
  {
    icon: Eye,
    label: "Our Vision",
    text: "To be India's most trusted hospitality partner — delivering lifestyle-driven hotels and hostels that feel like home across every city.",
    color: "violet",
  },
  {
    icon: Shield,
    label: "Our Promise",
    text: "Consistent quality, thoughtful amenities, and an unwavering commitment to guest satisfaction — wherever the journey leads.",
    color: "emerald",
  },
];

const GALLERY = [
  { src: heroLobby, alt: "Premium lobby space" },
  { src: heroRoom, alt: "Luxury room interior" },
  { src: heroTerrace, alt: "Panoramic terrace views" },
  { src: heroDining, alt: "Fine dining experience" },
];

export default function About() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.2]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <section ref={heroRef} className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden" data-testid="about-hero">
        <motion.div className="absolute inset-0" style={{ scale: heroScale }}>
          <img
            src={heroLobby}
            alt="HSquare Living premium lobby"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/70 via-[#050505]/50 to-[#050505]" />
        </motion.div>

        <ParticleBackground preset="hero" className="absolute inset-0 z-[1]" />

        <motion.div
          className="relative z-10 text-center px-6 max-w-4xl mx-auto"
          style={{ opacity: heroOpacity }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm mb-8"
          >
            <Building2 className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-[0.25em] text-white/60 font-medium">About HSquare Living</span>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-7xl font-heading font-black leading-[1.05] mb-6"
            initial={{ opacity: 0, y: 40, filter: "blur(12px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/60">
              Crafting Exceptional Stays
            </span>
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400">
              for Modern Travellers
            </span>
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            More than a team — a closely-knit family of handpicked individuals with exceptional expertise and a shared passion for excellence.
          </motion.p>

          <motion.div
            className="mt-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
            <Link href="/properties">
              <Button
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-8 py-6 text-base rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] transition-all duration-300"
                data-testid="button-explore-properties"
              >
                Explore Our Properties
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050505] to-transparent z-[2]" />
      </section>

      <section className="relative py-24 md:py-32 px-6" data-testid="about-story">
        <ParticleBackground preset="sparse" className="absolute inset-0 z-0" />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <motion.div {...fadeUp}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.06] mb-6">
                <Star className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] uppercase tracking-[0.2em] text-amber-400/80 font-semibold">Our Story</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-heading font-black mb-6 leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">Founded with a</span>
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Vision to Elevate</span>
              </h2>
              <p className="text-white/40 text-base md:text-lg leading-relaxed mb-6">
                HSquare Living blends boutique design with warm, personalised service. Every space we curate is thoughtfully crafted to help guests feel inspired, connected, and completely at ease.
              </p>
              <p className="text-white/40 text-base md:text-lg leading-relaxed">
                From premium hotel escapes to vibrant hostel communities, we build destinations that make every stay memorable. Our team is committed to innovation, detail, and a relentless pursuit of excellence across every touchpoint.
              </p>
            </motion.div>

            <motion.div
              className="relative"
              {...fadeUp}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="grid grid-cols-2 gap-4">
                {GALLERY.map((img, i) => (
                  <motion.div
                    key={i}
                    className={`relative rounded-2xl overflow-hidden ${i === 0 ? "row-span-2" : ""}`}
                    whileHover={{ scale: 1.03 }}
                    transition={{ duration: 0.4 }}
                  >
                    <img
                      src={img.src}
                      alt={img.alt}
                      className={`w-full object-cover ${i === 0 ? "h-full min-h-[300px]" : "h-48"}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  </motion.div>
                ))}
              </div>
              <div
                className="absolute -inset-4 rounded-3xl pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.06) 0%, transparent 70%)",
                }}
              />
            </motion.div>
          </div>
        </div>
      </section>

      <div className="relative h-px max-w-4xl mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
      </div>

      <section className="relative py-24 md:py-32 px-6" data-testid="about-values">
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div className="text-center mb-16" {...fadeUp}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.06] mb-6">
              <Heart className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-violet-400/80 font-semibold">What Sets Us Apart</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-black">
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">Built on </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">Values</span>
            </h2>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-6"
            {...staggerChildren}
          >
            {VALUES.map((value, i) => (
              <motion.div
                key={i}
                className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-8 hover:border-white/[0.12] transition-all duration-500"
                {...fadeUp}
                whileHover={{ y: -6 }}
              >
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{
                    background: `radial-gradient(ellipse at 50% 0%, ${value.glow} 0%, transparent 70%)`,
                  }}
                />
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${value.gradient} flex items-center justify-center mb-6 shadow-lg`}>
                  <value.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-heading font-bold text-white mb-3" data-testid={`text-value-title-${i}`}>
                  {value.title}
                </h3>
                <p className="text-white/40 text-sm leading-relaxed">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <div className="relative h-px max-w-4xl mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/30 to-transparent" />
      </div>

      <section className="relative py-24 md:py-32 px-6" data-testid="about-pillars">
        <ParticleBackground preset="sparse" className="absolute inset-0 z-0" />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div className="text-center mb-16" {...fadeUp}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] mb-6">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-400/80 font-semibold">Our Foundation</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-black">
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">Mission, Vision </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">& Promise</span>
            </h2>
          </motion.div>

          <div className="space-y-6">
            {PILLARS.map((pillar, i) => {
              const borderColor = pillar.color === "amber" ? "border-amber-500/20 hover:border-amber-500/40" :
                pillar.color === "violet" ? "border-violet-500/20 hover:border-violet-500/40" :
                "border-emerald-500/20 hover:border-emerald-500/40";
              const iconBg = pillar.color === "amber" ? "bg-amber-500/10 text-amber-400" :
                pillar.color === "violet" ? "bg-violet-500/10 text-violet-400" :
                "bg-emerald-500/10 text-emerald-400";
              const labelColor = pillar.color === "amber" ? "text-amber-400" :
                pillar.color === "violet" ? "text-violet-400" :
                "text-emerald-400";
              const glowGrad = pillar.color === "amber" ? "rgba(245,158,11,0.06)" :
                pillar.color === "violet" ? "rgba(139,92,246,0.06)" :
                "rgba(16,185,129,0.06)";

              return (
                <motion.div
                  key={i}
                  className={`group relative rounded-2xl border ${borderColor} bg-white/[0.02] backdrop-blur-sm p-8 md:p-10 transition-all duration-500`}
                  {...fadeUp}
                  transition={{ duration: 0.8, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{
                      background: `radial-gradient(ellipse at 0% 50%, ${glowGrad} 0%, transparent 60%)`,
                    }}
                  />
                  <div className="flex items-start gap-6">
                    <div className={`w-14 h-14 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
                      <pillar.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className={`text-lg font-heading font-bold ${labelColor} mb-2 uppercase tracking-wide`} data-testid={`text-pillar-${i}`}>
                        {pillar.label}
                      </h3>
                      <p className="text-white/50 text-base md:text-lg leading-relaxed">
                        {pillar.text}
                      </p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div {...fadeUp}>
            <h2 className="text-2xl md:text-3xl font-heading font-bold mb-8 text-center">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Hostels Near </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Top Mumbai Colleges</span>
            </h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { href: "/hostel-near-nmims", label: "Hostel Near NMIMS", desc: "5 min from campus" },
              { href: "/hostel-near-mithibai", label: "Hostel Near Mithibai", desc: "Vile Parle West" },
              { href: "/hostel-near-mukesh-patel", label: "Hostel Near Mukesh Patel", desc: "MPSTME campus" },
              { href: "/hostel-near-nm-college", label: "Hostel Near NM College", desc: "Commerce hub" },
              { href: "/hostel-near-dj-sanghvi", label: "Hostel Near DJ Sanghvi", desc: "Engineering students" },
              { href: "/hostel-near-whistling-woods", label: "Hostel Near Whistling Woods", desc: "Film students" },
            ].map((link) => (
              <Link key={link.href} href={link.href}>
                <div className="group p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-amber-500/20 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer" data-testid={`link-${link.href.slice(1)}`}>
                  <p className="text-sm font-semibold text-white/80 group-hover:text-amber-400 transition-colors">{link.label}</p>
                  <p className="text-xs text-white/30 mt-1">{link.desc}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-6 text-sm">
            <Link href="/hostel-in-vile-parle" className="text-white/40 hover:text-amber-400 transition-colors" data-testid="link-hostel-in-vile-parle">Hostel in Vile Parle</Link>
            <span className="text-white/10">|</span>
            <Link href="/hostel-in-goregaon" className="text-white/40 hover:text-amber-400 transition-colors" data-testid="link-hostel-in-goregaon">Hostel in Goregaon</Link>
            <span className="text-white/10">|</span>
            <Link href="/faq" className="text-white/40 hover:text-amber-400 transition-colors" data-testid="link-faq">FAQs</Link>
            <span className="text-white/10">|</span>
            <Link href="/contact" className="text-white/40 hover:text-amber-400 transition-colors" data-testid="link-contact">Contact Us</Link>
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-24 md:py-32 px-6" data-testid="about-cta">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl md:text-5xl font-heading font-black mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70">Ready to Experience </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Premium Living?</span>
            </h2>
            <p className="text-white/40 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
              Discover luxury and comfort with our carefully curated selection of premium properties across India.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/properties">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-8 py-6 text-base rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] transition-all duration-300"
                  data-testid="button-cta-properties"
                >
                  Browse Properties
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white px-8 py-6 text-base rounded-xl transition-all duration-300"
                  data-testid="button-cta-home"
                >
                  Back to Home
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
