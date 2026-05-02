import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  MapPin, Phone, Mail, Clock, Send, Building2,
  MessageSquare, ArrowRight, Instagram, Facebook, Linkedin
} from "lucide-react";
import { motion } from "framer-motion";
import { ParticleBackground } from "@/components/particle-background";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
};

const LOCATIONS = [
  {
    area: "Goregaon",
    address: "Hsquare Living, Goregaon West, Mumbai – 400062",
    nearby: "Near Whistling Woods International",
  },
  {
    area: "Juhu / Vile Parle",
    address: "Hsquare Living, Vile Parle West, Mumbai – 400056",
    nearby: "Near NMIMS, Mukesh Patel, DJ Sanghvi, Mithibai, NM College",
  },
  {
    area: "Andheri",
    address: "Hsquare Living, Andheri West, Mumbai – 400053",
    nearby: "Near DN Nagar Metro, Lokhandwala",
  },
];

export default function Contact() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [contactInfo, setContactInfo] = useState({ phone: "+91 6372294625", email: "support@hsquareliving.com" });

  useEffect(() => {
    fetch("/api/footer-settings")
      .then(r => r.json())
      .then(data => {
        if (data.phone) setContactInfo(prev => ({ ...prev, phone: data.phone }));
        if (data.email) setContactInfo(prev => ({ ...prev, email: data.email }));
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        toast({ title: "Message sent!", description: "We'll get back to you within 24 hours." });
        setFormData({ name: "", email: "", phone: "", message: "" });
      } else {
        toast({ title: "Something went wrong", description: "Please try again or contact us directly.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Please check your connection.", variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-transparent text-white overflow-x-hidden">
      <section className="relative py-32 md:py-40 flex items-center justify-center overflow-hidden" data-testid="contact-hero">
        <ParticleBackground preset="hero" className="absolute inset-0 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />

        <motion.div
          className="relative z-10 text-center px-6 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm mb-8">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-[0.25em] text-white/60 font-medium">Get In Touch</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-black leading-[1.05] mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/60">
              Let's Start a{" "}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400">
              Conversation
            </span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
            Have questions about our properties, booking process, or student accommodation? We're here to help.
          </p>
        </motion.div>
      </section>

      {/* All content below the hero sits on an opaque dark base so the
          global iridescent tubes layer (fixed z:0 in layout.tsx) does not
          bleed through form fields, labels, or info cards. The hero above
          intentionally keeps its translucent backdrop for atmosphere. */}
      <div className="relative bg-[#070707]">
      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <motion.div
              {...fadeUp}
              className="rounded-3xl p-6 sm:p-8 md:p-10 bg-white/[0.025] border border-white/[0.08] backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
            >
              <h2 className="text-2xl md:text-3xl font-heading font-bold mb-3">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Send us a Message</span>
              </h2>
              <p className="text-white/50 mb-8">Fill in the form and our team will respond within 24 hours.</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Full Name *</label>
                    <input
                      data-testid="input-contact-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/60 focus:bg-black/60 transition-all"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-2">Email *</label>
                    <input
                      data-testid="input-contact-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/60 focus:bg-black/60 transition-all"
                      placeholder="your@email.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Phone</label>
                  <input
                    data-testid="input-contact-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/60 focus:bg-black/60 transition-all"
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/60 mb-2">Message *</label>
                  <textarea
                    data-testid="input-contact-message"
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/60 focus:bg-black/60 transition-all resize-none"
                    placeholder="How can we help you?"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  data-testid="button-contact-submit"
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-8 py-6 text-base rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] transition-all duration-300 w-full sm:w-auto"
                >
                  {sending ? "Sending..." : "Send Message"}
                  <Send className="ml-2 w-5 h-5" />
                </Button>
              </form>
            </motion.div>

            <motion.div {...fadeUp} className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-heading font-bold mb-4">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Contact Information</span>
              </h2>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50 mb-1">Email</p>
                    <a href={`mailto:${contactInfo.email}`} className="text-white hover:text-amber-400 transition-colors" data-testid="link-contact-email">
                      {contactInfo.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50 mb-1">Phone</p>
                    <a href={`tel:${contactInfo.phone.replace(/\s/g, '')}`} className="text-white hover:text-amber-400 transition-colors" data-testid="link-contact-phone">
                      {contactInfo.phone}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/20 flex items-center justify-center shrink-0">
                    <Clock className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50 mb-1">Office Hours</p>
                    <p className="text-white">Monday – Saturday</p>
                    <p className="text-white/60 text-sm">10:00 AM – 6:00 PM IST</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-sm text-white/50 mb-3">Follow us</p>
                <div className="flex gap-3">
                  <a href="https://instagram.com/hsquareliving" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-amber-500/20 border border-white/10 flex items-center justify-center transition-all" data-testid="link-social-instagram-contact">
                    <Instagram className="w-4 h-4 text-white/70 hover:text-amber-400" />
                  </a>
                  <a href="https://facebook.com/hsquareliving" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-amber-500/20 border border-white/10 flex items-center justify-center transition-all" data-testid="link-social-facebook-contact">
                    <Facebook className="w-4 h-4 text-white/70 hover:text-amber-400" />
                  </a>
                  <a href="https://linkedin.com/company/hsquareliving" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-amber-500/20 border border-white/10 flex items-center justify-center transition-all" data-testid="link-social-linkedin-contact">
                    <Linkedin className="w-4 h-4 text-white/70 hover:text-amber-400" />
                  </a>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div className="text-center mb-14" {...fadeUp}>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Our Locations</span>
            </h2>
            <p className="text-white/40 max-w-xl mx-auto">Premium student accommodation across Mumbai's best neighborhoods</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {LOCATIONS.map((loc, i) => (
              <motion.div
                key={loc.area}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: i * 0.12 }}
                className="group p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-amber-500/20 backdrop-blur-sm transition-all duration-300"
                data-testid={`card-location-${loc.area.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center mb-4">
                  <MapPin className="w-6 h-6 text-amber-400" />
                </div>
                <h3 className="text-xl font-heading font-bold text-white mb-2">{loc.area}</h3>
                <p className="text-white/40 text-sm mb-3">{loc.address}</p>
                <p className="text-amber-400/70 text-xs mb-3">{loc.nearby}</p>
                <a href={`tel:${contactInfo.phone.replace(/\s/g, "")}`} className="text-sm text-white/50 hover:text-amber-400 transition-colors">
                  {contactInfo.phone}
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div {...fadeUp}>
            <h2 className="text-xl md:text-2xl font-heading font-bold mb-6 text-center text-white/70">
              Quick Links
            </h2>
          </motion.div>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {[
              { href: "/properties", label: "Browse Properties" },
              { href: "/about", label: "About Us" },
              { href: "/faq", label: "FAQs" },
              { href: "/apply", label: "Apply Now" },
              { href: "/hostel-near-nmims", label: "Hostel Near NMIMS" },
              { href: "/hostel-near-mithibai", label: "Hostel Near Mithibai" },
              { href: "/hostel-near-mukesh-patel", label: "Hostel Near Mukesh Patel" },
              { href: "/hostel-near-nm-college", label: "Hostel Near NM College" },
              { href: "/hostel-in-vile-parle", label: "Hostel in Vile Parle" },
              { href: "/hostel-in-goregaon", label: "Hostel in Goregaon" },
            ].map((link) => (
              <Link key={link.href} href={link.href}>
                <span className="inline-block px-4 py-2 rounded-full border border-white/[0.06] bg-white/[0.02] text-white/40 hover:text-amber-400 hover:border-amber-500/20 transition-all duration-300 cursor-pointer" data-testid={`link-quick-${link.href.slice(1)}`}>
                  {link.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Ready to Find Your </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Perfect Stay?</span>
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
              Browse our properties across Mumbai and book your ideal student accommodation today.
            </p>
            <Link href="/properties">
              <Button
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-8 py-6 text-base rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] transition-all duration-300"
                data-testid="button-explore-cta"
              >
                Explore Properties
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
      </div>
    </div>
  );
}
