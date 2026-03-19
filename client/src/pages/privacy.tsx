import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowRight, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { ParticleBackground } from "@/components/particle-background";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
};

const SECTIONS = [
  {
    title: "1. Information We Collect",
    subsections: [
      {
        subtitle: "1.1 Personal Information",
        content: `We may collect the following personal details when you use our Platform:\n\n• Full Name\n• Phone Number\n• Email Address\n• Address (Permanent & Current)\n• Government ID (Aadhaar, PAN, Passport, etc.)\n• Date of Birth / Age / Gender\n• Payment Details (bank account, UPI, card details via secure gateways)\n• Employment / Educational Details`,
      },
      {
        subtitle: "1.2 User Activity Information",
        content: `We may collect:\n\n• Booking details and transaction history\n• Chat messages / support conversations\n• Feedback and reviews\n• Resident app usage data\n\nNote: Calls and chats may be recorded for security, quality, and dispute resolution purposes.`,
      },
      {
        subtitle: "1.3 Automatic Data (Cookies & Tracking)",
        content: `We automatically collect:\n\n• IP Address\n• Device Information\n• Browser Type\n• Pages visited and time spent\n\nWe use cookies to improve user experience, analyze traffic, and show relevant content. You can disable cookies from your browser settings at any time.`,
      },
      {
        subtitle: "1.4 Social Login Information",
        content: `If you log in via Google or social media accounts, we may collect your name, email address, and profile picture to create and manage your account.`,
      },
    ],
  },
  {
    title: "2. How We Use Your Information",
    content: `We use your data to:\n\n• Create and manage your account\n• Process bookings and payments\n• Verify identity (essential for hostel security)\n• Provide customer support\n• Improve our services and platform experience\n• Send notifications (booking confirmations, offers, updates)\n• Prevent fraud and misuse\n• Comply with legal and regulatory requirements`,
  },
  {
    title: "3. Communication Consent",
    content: `By registering with Hsquare, you agree to receive communications via:\n\n• Phone calls\n• SMS / WhatsApp messages\n• Email notifications\n\nThis consent applies even if your number is registered under DND (Do Not Disturb). Service-related communications are essential and cannot be opted out of.`,
  },
  {
    title: "4. Sharing of Information",
    subsections: [
      {
        subtitle: "4.1 Service Providers",
        content: `We may share your data with trusted third-party service providers, including:\n\n• Payment gateways (Razorpay)\n• CRM and property management systems\n• IT and cloud service providers\n• Email delivery services`,
      },
      {
        subtitle: "4.2 Legal Authorities",
        content: `We may disclose your information when required by law, court order, or government investigation.`,
      },
      {
        subtitle: "4.3 Business Transfers",
        content: `In the event of a merger, acquisition, or restructuring, your data may be transferred as part of the business assets. You will be notified of any such transfer.\n\nWe DO NOT sell your personal data to any third party.`,
      },
    ],
  },
  {
    title: "5. Data Security",
    content: `We employ industry-standard security measures to protect your data, including:\n\n• End-to-end encryption for sensitive data\n• Secure cloud servers with access controls\n• Regular security audits and vulnerability assessments\n• Role-based access control for internal systems\n\nHowever, no digital system is 100% secure. Users are responsible for protecting their login credentials and reporting any unauthorized access immediately.`,
  },
  {
    title: "6. Data Storage & Transfer",
    content: `Your data may be stored or processed:\n\n• Within India on secure cloud infrastructure\n• On servers maintained by our trusted cloud service providers\n\nWe ensure reasonable protection measures are in place even when data is transferred between systems or locations.`,
  },
  {
    title: "7. User Rights",
    content: `As a user, you have the right to:\n\n• Request access to your personal data\n• Correct inaccurate or incomplete information\n• Request deletion of your data (subject to legal retention requirements)\n• Withdraw consent for marketing communications\n\nTo exercise any of these rights, contact us at support@hsquareliving.com`,
  },
  {
    title: "8. Account & Data Deletion",
    content: `You may request account deletion at any time by contacting our support team. Upon deletion, we may retain certain information as required by law, including:\n\n• Legal and compliance records\n• Transaction and payment history\n• Fraud prevention data\n\nRetained data will be securely stored and not used for any other purpose.`,
  },
  {
    title: "9. Marketing & Communications",
    content: `You can:\n\n• Unsubscribe from marketing emails at any time using the link in any email\n• Opt out of promotional SMS and WhatsApp messages\n\nYou will continue to receive important service-related communications regarding your booking, payments, and account security.`,
  },
  {
    title: "10. Third-Party Links",
    content: `Our Platform may contain links to external websites and services. Hsquare is not responsible for the privacy practices, content, or security of these third-party sites. We recommend reviewing their privacy policies independently.`,
  },
  {
    title: "11. Password Security",
    content: `You are responsible for:\n\n• Keeping your password secure and confidential\n• Not sharing your login credentials with anyone\n• Using strong, unique passwords for your account\n• Logging out from shared or public devices\n\nHsquare will never ask for your password via email, phone, or chat.`,
  },
  {
    title: "12. User Content",
    content: `Any content you post on the Platform (reviews, comments, feedback, etc.) may be visible publicly. By posting content, you grant Hsquare a non-exclusive license to display, reproduce, and distribute such content on the Platform.`,
  },
  {
    title: "13. Legal Compliance",
    content: `Hsquare Harmony Living operates in compliance with:\n\n• Information Technology Act, 2000 (and amendments)\n• Information Technology (Reasonable Security Practices and Procedures) Rules, 2011\n• Applicable Indian data protection laws and regulations`,
  },
  {
    title: "14. Grievance Officer",
    content: `As per the Information Technology Act, 2000, the designated Grievance Officer for Hsquare is:\n\nName: Hsquare Support Team\nCompany: Hsquare Harmony Living\nEmail: support@hsquareliving.com\n\nWorking Hours: Monday – Saturday, 10:00 AM – 6:00 PM IST\n\nGrievances will be acknowledged within 24 hours and resolved within 30 days.`,
  },
  {
    title: "15. Policy Updates",
    content: `We may update this Privacy Policy from time to time to reflect changes in our practices, technology, or legal requirements. The updated policy will be posted on this page with a revised "Last Updated" date.\n\nWe encourage you to review this policy periodically. Continued use of the Platform after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "16. Consent",
    content: `By using the Hsquare Platform, you acknowledge and agree to:\n\n• This Privacy Policy\n• Our Terms & Conditions\n• The collection, processing, and storage of your data as described herein`,
  },
];

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      <section className="relative py-32 md:py-40 flex items-center justify-center overflow-hidden" data-testid="privacy-hero">
        <ParticleBackground preset="sparse" className="absolute inset-0 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />

        <motion.div
          className="relative z-10 text-center px-6 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm mb-8">
            <Lock className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-[0.25em] text-white/60 font-medium">Your Privacy Matters</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-black leading-[1.05] mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/60">
              Privacy{" "}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400">
              Policy
            </span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
            Hsquare Harmony Living is committed to protecting your personal information and being transparent about how we use it.
          </p>
          <p className="text-sm text-white/30 mt-4">Last Updated: 19 March 2026 | Effective Date: 19 March 2026</p>
        </motion.div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="space-y-12">
            {SECTIONS.map((section, i) => (
              <motion.div
                key={section.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: Math.min(i * 0.05, 0.3) }}
                className="group"
                data-testid={`privacy-section-${i + 1}`}
              >
                <h2 className="text-xl md:text-2xl font-heading font-bold text-white/90 mb-5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  {section.title}
                </h2>

                {"content" in section && section.content && (
                  <div className="pl-11 text-white/40 leading-relaxed text-sm md:text-base whitespace-pre-line">
                    {section.content}
                  </div>
                )}

                {"subsections" in section && section.subsections && (
                  <div className="pl-11 space-y-6">
                    {section.subsections.map((sub) => (
                      <div key={sub.subtitle}>
                        <h3 className="text-base md:text-lg font-heading font-semibold text-white/70 mb-3">{sub.subtitle}</h3>
                        <div className="text-white/40 leading-relaxed text-sm md:text-base whitespace-pre-line">{sub.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div {...fadeUp}>
            <p className="text-white/40 mb-8 max-w-lg mx-auto">
              By using Hsquare's Platform, you acknowledge that you have read, understood, and agreed to this Privacy Policy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/terms">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.06] font-medium px-8 py-6 text-base rounded-xl"
                  data-testid="button-terms-link"
                >
                  Terms & Conditions
                </Button>
              </Link>
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
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
