import { useState } from "react";
import { FileText, Download, BookOpen, Shield, Users, Building2, Star, ChevronRight, ExternalLink } from "lucide-react";

const MANUAL_URL = "/hsquareliving-user-manual.pdf";
const MANUAL_VERSION = "v1.0 — May 2026";

const chapters = [
  {
    part: "Part 1",
    title: "Getting Started",
    desc: "Login, navigation, role redirects, and profile setup for all staff.",
    roles: ["All Roles"],
    color: "from-indigo-500 to-indigo-600",
    icon: BookOpen,
  },
  {
    part: "Part 2",
    title: "Admin & Superadmin Guide",
    desc: "Properties, bookings, payments, agreements, seasons, HMS sync, settings, users, and data export.",
    roles: ["Superadmin", "Admin", "Manager"],
    color: "from-violet-500 to-violet-600",
    icon: Shield,
  },
  {
    part: "Part 3",
    title: "Sales Executive Guide",
    desc: "Lead management, pipeline, Kanban requests board, activity logging, and iCal follow-ups.",
    roles: ["Sales Executive"],
    color: "from-orange-500 to-orange-600",
    icon: Star,
  },
  {
    part: "Part 4",
    title: "Frontdesk Guide",
    desc: "Registration approvals, visitor management, booking quick-reference, and scoped property access.",
    roles: ["Frontdesk"],
    color: "from-cyan-500 to-cyan-600",
    icon: Users,
  },
  {
    part: "Part 5",
    title: "Hotel Admin & Staff Guide",
    desc: "Hotels dashboard, housekeeping task management, staff shift view, and portal switching.",
    roles: ["Hotel Admin", "Hotel Staff"],
    color: "from-yellow-500 to-amber-600",
    icon: Building2,
  },
  {
    part: "Part 6",
    title: "Public & Student Flows",
    desc: "Reference guide: registration form, virtual tour, bed booking, Razorpay, and agreement signing.",
    roles: ["All Roles"],
    color: "from-emerald-500 to-emerald-600",
    icon: BookOpen,
  },
];

const roleBadgeStyle: Record<string, string> = {
  "All Roles":     "bg-emerald-100 text-emerald-700",
  "Superadmin":    "bg-violet-100 text-violet-700",
  "Admin":         "bg-indigo-100 text-indigo-700",
  "Manager":       "bg-blue-100 text-blue-700",
  "Sales Executive":"bg-orange-100 text-orange-700",
  "Frontdesk":     "bg-cyan-100 text-cyan-700",
  "Hotel Admin":   "bg-amber-100 text-amber-700",
  "Hotel Staff":   "bg-yellow-100 text-yellow-800",
};

export default function ManualPage() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    const a = document.createElement("a");
    a.href = MANUAL_URL;
    a.download = "Hsquareliving-Staff-User-Manual.pdf";
    a.click();
    setTimeout(() => setDownloading(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 text-white">
        <div className="max-w-5xl mx-auto px-6 py-14 md:py-20">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold tracking-wide text-amber-300 mb-5">
                <FileText className="h-3.5 w-3.5" />
                OFFICIAL STAFF DOCUMENTATION
              </div>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-3">
                Hsquareliving<br />
                <span className="text-amber-400">Staff User Manual</span>
              </h1>
              <p className="text-slate-300 text-base max-w-xl leading-relaxed">
                Complete operational guide for all roles — Admin, Sales, Frontdesk, and Hotel staff.
                Covers every feature from booking management to HMS sync.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <span className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded px-2 py-1">{MANUAL_VERSION}</span>
                <span className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded px-2 py-1">A4 PDF · Print-ready</span>
                <span className="text-xs text-slate-400 bg-white/5 border border-white/10 rounded px-2 py-1">Confidential</span>
              </div>
            </div>

            {/* Download card */}
            <div className="shrink-0 w-full md:w-64">
              <div className="bg-white/10 border border-white/20 rounded-2xl p-6 backdrop-blur-sm">
                <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-amber-400" />
                </div>
                <p className="font-semibold text-white mb-1">User Manual PDF</p>
                <p className="text-slate-400 text-xs mb-5">All 6 chapters · Quick reference included</p>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  data-testid="button-download-manual"
                  className="w-full flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-sm py-3 rounded-xl transition-colors disabled:opacity-70"
                >
                  <Download className="h-4 w-4" />
                  {downloading ? "Opening…" : "Download PDF"}
                </button>
                <a
                  href={MANUAL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="link-open-manual"
                  className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors py-2"
                >
                  <ExternalLink className="h-3 w-3" /> Open in browser
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chapters grid */}
      <div className="max-w-5xl mx-auto px-6 py-12">
        <h2 className="text-xl font-bold text-slate-900 mb-2">What's Inside</h2>
        <p className="text-slate-500 text-sm mb-8">Six comprehensive chapters covering every role and feature in the platform.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {chapters.map((ch) => {
            const Icon = ch.icon;
            return (
              <div
                key={ch.part}
                data-testid={`card-chapter-${ch.part.replace(" ", "-").toLowerCase()}`}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ch.color} flex items-center justify-center mb-4`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{ch.part}</div>
                <h3 className="font-bold text-slate-900 text-sm mb-2 leading-snug">{ch.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed mb-4">{ch.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {ch.roles.map((r) => (
                    <span
                      key={r}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleBadgeStyle[r] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick-access download banner */}
        <div className="mt-12 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 justify-between">
          <div>
            <p className="font-bold text-white text-base mb-1">Ready to download?</p>
            <p className="text-indigo-200 text-sm">The full manual is a single PDF — save it, print it, or share it with new team members.</p>
          </div>
          <button
            onClick={handleDownload}
            data-testid="button-download-manual-bottom"
            className="shrink-0 flex items-center gap-2 bg-white hover:bg-indigo-50 text-indigo-700 font-bold text-sm px-6 py-3 rounded-xl transition-colors whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            Download Manual
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-center text-xs text-slate-400">
          Hsquareliving Pvt Ltd — Confidential &nbsp;·&nbsp; {MANUAL_VERSION} &nbsp;·&nbsp;{" "}
          <a href="https://hsquare.in" className="hover:text-indigo-600 transition-colors">hsquare.in</a>
        </p>
      </div>
    </div>
  );
}
