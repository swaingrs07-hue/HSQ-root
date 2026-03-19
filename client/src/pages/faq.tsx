import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  HelpCircle, ChevronDown, ArrowRight, Search,
  Building2, CreditCard, Shield, Users, Home, Utensils
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ParticleBackground } from "@/components/particle-background";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
};

interface FAQItem {
  q: string;
  a: string;
}

interface FAQCategory {
  icon: typeof HelpCircle;
  label: string;
  color: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQCategory[] = [
  {
    icon: Home,
    label: "Accommodation",
    color: "amber",
    items: [
      {
        q: "What types of rooms are available?",
        a: "We offer a range of room options including single occupancy, twin sharing, triple sharing, and quad sharing rooms. All rooms are fully furnished with beds, wardrobes, study desks, and attached/shared bathrooms depending on the property.",
      },
      {
        q: "Are the hostels co-ed or gender-specific?",
        a: "We offer both boys and girls hostels at different locations across Mumbai. Each property has clear gender-specific floors or buildings to ensure safety and comfort.",
      },
      {
        q: "What amenities are included?",
        a: "All our properties include free high-speed WiFi, 24/7 security with CCTV, daily housekeeping, laundry service, study lounges, common areas, and fully furnished rooms. Specific amenities may vary by property.",
      },
      {
        q: "Can I visit the property before booking?",
        a: "Absolutely! We encourage in-person visits. You can also take a virtual property tour on our website to explore rooms, common areas, and facilities before visiting.",
      },
      {
        q: "Is there a minimum stay duration?",
        a: "Our typical bookings run for an academic year (approximately 11 months). However, we also accommodate shorter stays depending on availability. Please contact us for specific duration requirements.",
      },
    ],
  },
  {
    icon: CreditCard,
    label: "Payments & Pricing",
    color: "violet",
    items: [
      {
        q: "What are the payment options?",
        a: "We accept payments via UPI, credit/debit cards, net banking, and bank transfers through our secure Razorpay payment gateway. You can pay online directly from your dashboard.",
      },
      {
        q: "Is there a security deposit?",
        a: "Yes, a refundable security deposit is required at the time of booking. The amount varies by property and room type. It is fully refundable upon checkout, subject to room condition.",
      },
      {
        q: "Can I pay in instalments?",
        a: "Yes, we offer flexible instalment plans. You can choose monthly, quarterly, or semester-wise payment options based on the housing plan you select during booking.",
      },
      {
        q: "What is the cancellation and refund policy?",
        a: "Cancellation policies vary by plan type. Generally, cancellations made 30+ days before check-in receive a full refund minus processing fees. Within 30 days, partial refunds may apply. Please check your booking agreement for specific terms.",
      },
    ],
  },
  {
    icon: Shield,
    label: "Safety & Security",
    color: "emerald",
    items: [
      {
        q: "What security measures are in place?",
        a: "All properties feature 24/7 CCTV surveillance, biometric/card access entry, security guards, visitor management systems, and emergency protocols. Your safety is our highest priority.",
      },
      {
        q: "Is there a curfew?",
        a: "While we encourage safe hours, we understand students have varied schedules. Entry and exit are tracked through our security system. Specific guidelines are communicated during onboarding.",
      },
      {
        q: "What happens in case of a medical emergency?",
        a: "Our staff is trained in basic first aid. We maintain a first-aid kit at every property and have tie-ups with nearby hospitals. Emergency contacts are shared during check-in.",
      },
    ],
  },
  {
    icon: Utensils,
    label: "Food & Services",
    color: "cyan",
    items: [
      {
        q: "Are meals included in the rent?",
        a: "Yes, most of our housing plans include meals (breakfast, lunch, evening snacks, and dinner). The meal schedule and menu vary by property. You can check the included services in your plan details.",
      },
      {
        q: "Can I opt for a plan without meals?",
        a: "Some properties offer room-only plans without meals. Check the available housing plans for your chosen property to see all options.",
      },
      {
        q: "Is laundry service available?",
        a: "Yes, laundry services are available at all properties. Depending on your plan, a certain number of laundry washes per month may be included. Additional washes can be purchased through our wallet system.",
      },
    ],
  },
  {
    icon: Users,
    label: "Booking Process",
    color: "blue",
    items: [
      {
        q: "How do I book a room?",
        a: "You can book online through our website: browse properties, select your preferred room and plan, complete registration with your ID documents, sign the digital agreement, and make payment. Our team is available to assist throughout.",
      },
      {
        q: "What documents are required for booking?",
        a: "You'll need a valid government ID (Aadhaar/PAN/Passport), recent passport-sized photographs, college admission letter or ID card, and parent/guardian contact details.",
      },
      {
        q: "Can I change my room after booking?",
        a: "Room changes are subject to availability. You can request a room change through our support team. Upgrade options may have price differences that will be communicated upfront.",
      },
      {
        q: "What is the check-in process?",
        a: "On your check-in date, visit the property with your original ID documents. Our staff will verify your booking, complete a brief orientation, hand over your access credentials, and guide you to your room.",
      },
    ],
  },
];

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all"
          data-testid={`faq-item-${i}`}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/[0.03] transition-colors"
            data-testid={`button-faq-toggle-${i}`}
          >
            <span className="text-sm md:text-base text-white/80 font-medium pr-4">{item.q}</span>
            <ChevronDown className={`w-5 h-5 text-white/30 shrink-0 transition-transform duration-300 ${open === i ? "rotate-180 text-amber-400" : ""}`} />
          </button>
          <AnimatePresence>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="px-5 pb-4 text-sm text-white/40 leading-relaxed border-t border-white/[0.04] pt-3">
                  {item.a}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = searchQuery.trim()
    ? FAQ_DATA.flatMap((cat) =>
        cat.items.filter(
          (item) =>
            item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : null;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <section className="relative py-32 md:py-40 flex items-center justify-center overflow-hidden" data-testid="faq-hero">
        <ParticleBackground preset="hero" className="absolute inset-0 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent" />

        <motion.div
          className="relative z-10 text-center px-6 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm mb-8">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-[0.25em] text-white/60 font-medium">Help Center</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-black leading-[1.05] mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/60">
              Frequently Asked{" "}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400">
              Questions
            </span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed mb-10">
            Everything you need to know about Hsquare Living. Can't find your answer? Reach out to our team.
          </p>

          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              data-testid="input-faq-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions..."
              className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 focus:bg-white/[0.07] transition-all"
            />
          </div>
        </motion.div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          {filteredItems ? (
            <motion.div {...fadeUp}>
              <p className="text-white/40 text-sm mb-6">{filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""} found</p>
              {filteredItems.length > 0 ? (
                <FAQAccordion items={filteredItems} />
              ) : (
                <div className="text-center py-16">
                  <HelpCircle className="w-12 h-12 text-white/10 mx-auto mb-4" />
                  <p className="text-white/30">No matching questions found. Try a different search or <Link href="/contact" className="text-amber-400 hover:underline">contact us</Link>.</p>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="grid lg:grid-cols-[240px_1fr] gap-10">
              <motion.div {...fadeUp} className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                {FAQ_DATA.map((cat, i) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.label}
                      onClick={() => setActiveCategory(i)}
                      data-testid={`button-faq-category-${cat.label.toLowerCase().replace(/\s+/g, "-")}`}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                        activeCategory === i
                          ? "bg-amber-500/10 border border-amber-500/20 text-amber-400"
                          : "bg-white/[0.02] border border-white/[0.06] text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {cat.label}
                    </button>
                  );
                })}
              </motion.div>

              <motion.div {...fadeUp}>
                <h2 className="text-xl font-heading font-bold text-white/80 mb-6 flex items-center gap-3">
                  {(() => { const Icon = FAQ_DATA[activeCategory].icon; return <Icon className="w-5 h-5 text-amber-400" />; })()}
                  {FAQ_DATA[activeCategory].label}
                </h2>
                <FAQAccordion items={FAQ_DATA[activeCategory].items} />
              </motion.div>
            </div>
          )}
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div {...fadeUp}>
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">Still Have </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">Questions?</span>
            </h2>
            <p className="text-white/40 mb-8 max-w-lg mx-auto">
              Our team is ready to help. Reach out and we'll get back to you within 24 hours.
            </p>
            <Link href="/contact">
              <Button
                size="lg"
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-8 py-6 text-base rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.3)] hover:shadow-[0_0_50px_rgba(245,158,11,0.5)] transition-all duration-300"
                data-testid="button-contact-cta"
              >
                Contact Us
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
