import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight, Scale } from "lucide-react";
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
    title: "1. Acceptance of Terms",
    content: `By accessing or using the Hsquare Harmony Living ("Hsquare", "we", "us", "our") website, mobile application, or any related services (collectively, the "Platform"), you agree to be bound by these Terms & Conditions. If you do not agree with any part of these terms, please discontinue use of the Platform immediately.\n\nThese Terms apply to all users, including residents, visitors, property managers, and staff.`,
  },
  {
    title: "2. Eligibility",
    content: `You must be at least 18 years of age to use our Platform independently. If you are under 18, your parent or legal guardian must agree to these Terms on your behalf.\n\nBy using the Platform, you represent that:\n• You are legally capable of entering into binding contracts.\n• All information you provide is accurate, current, and complete.\n• You will maintain the accuracy of such information.`,
  },
  {
    title: "3. Account Registration",
    content: `To access certain features, you must create an account. You agree to:\n• Provide accurate and complete registration information.\n• Maintain the security of your account credentials.\n• Notify us immediately of any unauthorized access.\n• Accept responsibility for all activities that occur under your account.\n\nWe reserve the right to suspend or terminate accounts that violate these Terms.`,
  },
  {
    title: "4. Booking & Reservation",
    content: `All bookings made through the Platform are subject to:\n• Availability of the selected room, bed, and property.\n• Successful payment of the applicable fees and security deposit.\n• Submission and verification of required documents (ID proof, photographs, college details).\n• Execution of the digital booking agreement.\n\nA confirmed booking creates a binding agreement between you and Hsquare. Bed assignments are final once confirmed, unless a room change is approved by management.`,
  },
  {
    title: "5. Payment Terms",
    content: `• All prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise.\n• Payments are processed through secure third-party gateways (Razorpay).\n• You agree to pay all fees and charges associated with your booking by the due dates.\n• Late payments may incur penalties as outlined in your booking agreement.\n• Security deposits are refundable upon checkout, subject to room condition assessment and deductions for damages, if any.\n\nHsquare reserves the right to revise pricing with reasonable notice.`,
  },
  {
    title: "6. Cancellation & Refund Policy",
    content: `Cancellation policies vary by plan type and property:\n• Cancellations made 30+ days before check-in: Full refund minus processing fees.\n• Cancellations within 15–30 days of check-in: 50% refund.\n• Cancellations within 15 days of check-in: No refund.\n• Early checkout: Subject to terms in the booking agreement. Lock-in period charges may apply.\n\nRefunds are processed within 7–14 business days to the original payment method.`,
  },
  {
    title: "7. Resident Code of Conduct",
    content: `As a resident, you agree to:\n• Maintain cleanliness and hygiene in your room and common areas.\n• Respect other residents, staff, and property.\n• Not engage in any illegal, disruptive, or harmful activities.\n• Comply with visitor policies and entry/exit guidelines.\n• Not tamper with safety equipment (fire alarms, CCTV, locks).\n• Not sub-let, share, or transfer your bed/room to another person.\n• Follow noise guidelines, especially during designated quiet hours.\n\nViolation of the code of conduct may result in warnings, fines, or termination of your stay.`,
  },
  {
    title: "8. Property & Room Usage",
    content: `• Rooms are provided in a fully furnished state. Any damage beyond normal wear and tear will be charged.\n• Alterations, painting, or drilling in rooms is strictly prohibited.\n• Cooking in rooms is not permitted. Meals are provided as per your selected plan.\n• Pets are not allowed on the premises.\n• Smoking, alcohol consumption, and drug use are strictly prohibited within all properties.`,
  },
  {
    title: "9. Intellectual Property",
    content: `All content on the Platform — including text, graphics, logos, images, software, and design — is the property of Hsquare Harmony Living or its licensors and is protected by Indian and international copyright laws.\n\nYou may not reproduce, distribute, modify, or create derivative works from any content without prior written consent from Hsquare.`,
  },
  {
    title: "10. Privacy & Data Protection",
    content: `Your use of the Platform is also governed by our Privacy Policy, which details how we collect, use, store, and protect your personal information. By using the Platform, you consent to such data practices.\n\nPlease review our Privacy Policy at hsquare.in/privacy for complete details.`,
  },
  {
    title: "11. Limitation of Liability",
    content: `To the fullest extent permitted by law:\n• Hsquare shall not be liable for any indirect, incidental, special, consequential, or punitive damages.\n• Our total liability for any claim shall not exceed the amount paid by you in the preceding 3 months.\n• We are not responsible for loss of personal belongings, data, or any damages arising from circumstances beyond our control (force majeure, natural disasters, government orders).`,
  },
  {
    title: "12. Indemnification",
    content: `You agree to indemnify and hold harmless Hsquare Harmony Living, its directors, employees, and affiliates from any claims, damages, losses, or expenses arising from:\n• Your violation of these Terms.\n• Your use or misuse of the Platform or services.\n• Any content you submit or share through the Platform.\n• Any breach of applicable laws or regulations.`,
  },
  {
    title: "13. Dispute Resolution",
    content: `Any disputes arising from these Terms or your use of the Platform shall be:\n• First attempted to be resolved through amicable negotiation.\n• If unresolved, submitted to mediation under the rules of the Indian Arbitration and Conciliation Act, 1996.\n• Subject to the exclusive jurisdiction of the courts located in Mumbai, Maharashtra, India.`,
  },
  {
    title: "14. Modifications to Terms",
    content: `Hsquare reserves the right to modify these Terms at any time. Changes will be effective upon posting to the Platform with an updated "Last Updated" date. Continued use after changes constitutes acceptance of the revised Terms.\n\nWe encourage you to review these Terms periodically.`,
  },
  {
    title: "15. Governing Law",
    content: `These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions.`,
  },
  {
    title: "16. Contact Information",
    content: `For questions about these Terms & Conditions:\n\nHsquare Harmony Living\nEmail: support@hsquareliving.com\nPhone: +91 6372294625\nWorking Hours: Monday – Saturday, 10:00 AM – 6:00 PM IST`,
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-transparent text-white overflow-x-hidden">
      <section className="relative py-32 md:py-40 flex items-center justify-center overflow-hidden" data-testid="terms-hero">
        <ParticleBackground preset="sparse" className="absolute inset-0 z-[1]" />
        <div className="absolute inset-0 bg-gradient-to-b from-violet-500/5 via-transparent to-transparent" />

        <motion.div
          className="relative z-10 text-center px-6 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm mb-8">
            <Scale className="w-4 h-4 text-amber-400" />
            <span className="text-xs uppercase tracking-[0.25em] text-white/60 font-medium">Legal</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-heading font-black leading-[1.05] mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-white/90 to-white/60">
              Terms &{" "}
            </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-orange-400">
              Conditions
            </span>
          </h1>

          <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
            Please read these terms carefully before using our services.
          </p>
          <p className="text-sm text-white/30 mt-4">Last Updated: 19 March 2026</p>
        </motion.div>
      </section>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <section className="relative py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-6">
          <div className="space-y-10">
            {SECTIONS.map((section, i) => (
              <motion.div
                key={section.title}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: Math.min(i * 0.05, 0.3) }}
                className="group"
                data-testid={`terms-section-${i + 1}`}
              >
                <h2 className="text-xl md:text-2xl font-heading font-bold text-white/90 mb-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-amber-400" />
                  </div>
                  {section.title}
                </h2>
                <div className="pl-11 text-white/40 leading-relaxed text-sm md:text-base whitespace-pre-line">
                  {section.content}
                </div>
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
              By using Hsquare Living's services, you acknowledge that you have read, understood, and agreed to these Terms & Conditions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/privacy">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/[0.08] bg-white/[0.03] text-white hover:bg-white/[0.06] font-medium px-8 py-6 text-base rounded-xl"
                  data-testid="button-privacy-link"
                >
                  Privacy Policy
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
