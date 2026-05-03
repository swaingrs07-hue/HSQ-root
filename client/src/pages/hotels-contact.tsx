import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Mail, Phone, MapPin, Clock, ArrowRight, Send, CheckCircle2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1920&q=80";

export default function HotelsContact() {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = "Contact | Hsquare Hotels";
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast({
        title: "Missing details",
        description: "Please share your name, email, and a short message.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          message: form.message.trim(),
          source: "hotel",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSent(true);
      setForm({ name: "", email: "", phone: "", message: "" });
      toast({
        title: "Message received",
        description: "Our concierge will be in touch within a few hours.",
      });
    } catch {
      toast({
        title: "Could not send",
        description: "Please try again, or email support@hsquareliving.com directly.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div data-testid="hotels-contact-page">
      {/* HERO */}
      <section
        className="relative min-h-[60vh] sm:min-h-[70vh] flex items-end overflow-hidden"
        data-testid="contact-hero"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.55) 0%, rgba(10,10,10,0.4) 30%, rgba(10,10,10,0.95) 100%)",
          }}
        />
        <div className="relative z-10 container mx-auto px-4 sm:px-6 pb-16 sm:pb-24 pt-32">
          <div className="max-w-3xl">
            <p
              className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-4 sm:mb-6"
              style={{ color: "#c5a059" }}
            >
              ◇ We're listening ◇
            </p>
            <h1 className="hotels-display text-white text-5xl sm:text-6xl md:text-7xl lg:text-8xl mb-5 sm:mb-7">
              Get in <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>touch</span>
            </h1>
            <p className="text-white/70 text-sm sm:text-base md:text-lg max-w-xl leading-relaxed font-light">
              Whether you're planning a long stay or a quiet weekend, our concierge team is available
              around the clock to help you craft the perfect experience.
            </p>
          </div>
        </div>
      </section>

      {/* CONTACT CARDS */}
      <section
        className="py-16 md:py-24 px-4 sm:px-6"
        style={{ backgroundColor: "var(--hotels-section-bg, #080808)" }}
        data-testid="contact-cards-section"
      >
        <div className="container mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
            <a
              href="mailto:support@hsquareliving.com"
              className="p-6 sm:p-8 border border-white/10 hover:border-amber-500/40 transition-colors group"
              style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
              data-testid="card-contact-email"
            >
              <Mail className="w-6 h-6 mb-4" style={{ color: "#c5a059" }} />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Email</p>
              <p className="text-white text-base sm:text-lg break-all group-hover:text-amber-300 transition-colors">
                support@hsquareliving.com
              </p>
              <p className="text-white/40 text-xs mt-2">Replies within a few hours</p>
            </a>

            <a
              href="tel:+919876543210"
              className="p-6 sm:p-8 border border-white/10 hover:border-amber-500/40 transition-colors group"
              style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
              data-testid="card-contact-phone"
            >
              <Phone className="w-6 h-6 mb-4" style={{ color: "#c5a059" }} />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Phone</p>
              <p className="text-white text-base sm:text-lg group-hover:text-amber-300 transition-colors">
                +91 98765 43210
              </p>
              <p className="text-white/40 text-xs mt-2 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> 24 / 7 concierge desk
              </p>
            </a>

            <div
              className="p-6 sm:p-8 border border-white/10 sm:col-span-2 lg:col-span-1"
              style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
              data-testid="card-contact-address"
            >
              <MapPin className="w-6 h-6 mb-4" style={{ color: "#c5a059" }} />
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">Visit</p>
              <p className="text-white text-base sm:text-lg leading-relaxed">
                Mumbai, India
              </p>
              <p className="text-white/50 text-xs mt-2">Goregaon · Juhu · Andheri</p>
            </div>
          </div>
        </div>
      </section>

      {/* FORM + DETAILS SPLIT */}
      <section
        className="py-16 md:py-24 lg:py-32 px-4 sm:px-6"
        data-testid="contact-form-section"
      >
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 items-start">
            {/* LEFT — narrative */}
            <div>
              <p
                className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-4 sm:mb-6"
                style={{ color: "#c5a059" }}
              >
                ◇ Reach our concierge ◇
              </p>
              <h2 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl mb-5 leading-[1.05]">
                Tell us how
                <br />
                <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>
                  we can help
                </span>
              </h2>
              <p className="text-white/55 leading-relaxed text-sm sm:text-base font-light mb-8 sm:mb-10">
                Share a few details and our team will personally reach out — to plan your stay,
                arrange transfers, design a private experience, or simply answer a question.
              </p>

              <ul className="space-y-4 sm:space-y-5">
                {[
                  { icon: Sparkles, text: "Tailored experience curation" },
                  { icon: Clock, text: "Around-the-clock support" },
                  { icon: CheckCircle2, text: "Personal response, never automated" },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3 text-white/70 text-sm">
                    <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#c5a059" }} />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* RIGHT — form */}
            <div
              className="p-6 sm:p-8 md:p-10 border border-white/10"
              style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
            >
              {sent ? (
                <div
                  className="flex flex-col items-center text-center py-8 sm:py-12"
                  data-testid="contact-form-success"
                >
                  <CheckCircle2 className="w-14 h-14 mb-5" style={{ color: "#c5a059" }} />
                  <h3 className="text-white text-2xl sm:text-3xl mb-3 hotels-display">
                    Message received
                  </h3>
                  <p className="text-white/60 text-sm sm:text-base max-w-md leading-relaxed mb-6">
                    Our concierge team will be in touch shortly. Meanwhile, feel free to explore
                    our rooms and suites.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSent(false)}
                    className="text-[11px] uppercase tracking-[0.25em] text-white/60 hover:text-white transition-colors"
                    data-testid="button-send-another"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="space-y-5" data-testid="form-contact">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Name *">
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Your full name"
                        className="w-full bg-transparent text-white text-sm py-3 border-b border-white/15 focus:border-amber-500/60 outline-none transition-colors placeholder:text-white/25"
                        data-testid="input-contact-name"
                        required
                      />
                    </Field>
                    <Field label="Email *">
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="you@example.com"
                        className="w-full bg-transparent text-white text-sm py-3 border-b border-white/15 focus:border-amber-500/60 outline-none transition-colors placeholder:text-white/25"
                        data-testid="input-contact-email"
                        required
                      />
                    </Field>
                  </div>
                  <Field label="Phone">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full bg-transparent text-white text-sm py-3 border-b border-white/15 focus:border-amber-500/60 outline-none transition-colors placeholder:text-white/25"
                      data-testid="input-contact-phone"
                    />
                  </Field>
                  <Field label="Message *">
                    <textarea
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Share your dates, preferences, or any question..."
                      rows={5}
                      className="w-full bg-transparent text-white text-sm py-3 border-b border-white/15 focus:border-amber-500/60 outline-none transition-colors placeholder:text-white/25 resize-none"
                      data-testid="input-contact-message"
                      required
                    />
                  </Field>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 sm:px-10 py-4 text-black uppercase text-xs tracking-[0.25em] font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      backgroundColor: "#c5a059",
                      boxShadow: "0 12px 36px rgba(197,160,89,0.3)",
                    }}
                    data-testid="button-contact-submit"
                  >
                    {submitting ? "Sending..." : "Send Message"}
                    {!submitting && <Send className="w-3.5 h-3.5" />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-16 md:py-24 px-4 sm:px-6 border-t border-white/5"
        style={{ backgroundColor: "var(--hotels-section-bg, #080808)" }}
        data-testid="contact-cta-section"
      >
        <div className="container mx-auto max-w-4xl text-center">
          <p
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] sm:tracking-[0.4em] mb-5 sm:mb-6"
            style={{ color: "#c5a059" }}
          >
            ◇ Ready to stay? ◇
          </p>
          <h2 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-8">
            Skip the form,{" "}
            <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>
              reserve directly
            </span>
          </h2>
          <Link
            href="/hotels/rooms"
            className="inline-flex items-center gap-3 px-8 sm:px-10 py-4 text-black uppercase text-xs tracking-[0.25em] font-semibold transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: "#c5a059",
              boxShadow: "0 16px 48px rgba(197,160,89,0.35)",
            }}
            data-testid="button-cta-browse-rooms"
          >
            Browse rooms <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
