import { useState } from "react";
import { FileText, Presentation, Download, Loader2, Tag, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { useAuthGuard } from "@/contexts/auth-guard-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Format = "pdf" | "pptx";
type PriceMode = "with" | "without";

function getCurrentToken(fallback: string | null): string | null {
  try {
    const stored = localStorage.getItem("hsquare_auth");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.token) return parsed.token as string;
    }
  } catch {}
  return fallback;
}

async function fetchBrochure(propertyId: string, format: Format, price: PriceMode, fallbackToken: string | null) {
  const token = getCurrentToken(fallbackToken);
  const res = await fetch(`/api/properties/${propertyId}/download/${format}?price=${price}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = `Failed to download (${res.status})`;
    try { const d = await res.json(); if (d?.error) msg = d.error; } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename="?([^"]+)"?/i.exec(cd);
  const filename = m ? m[1] : `hsquare-property.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatLastUpdated(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function PropertyBrochureButtons({
  propertyId,
  propertyName,
  lastUpdated,
  downloadCount,
  variant = "panel",
  className,
}: {
  propertyId: string;
  propertyName?: string;
  lastUpdated?: string | Date | null;
  downloadCount?: number | null;
  variant?: "panel" | "compact" | "row";
  className?: string;
}) {
  const { token, user } = useAuth();
  const { requireAuth } = useAuthGuard();
  const { toast } = useToast();
  const [loading, setLoading] = useState<Format | null>(null);
  const [chooserFormat, setChooserFormat] = useState<Format | null>(null);

  // Both PDF and PPTX require login. PPT is additionally staff-only.
  const STAFF_ROLES = ["admin", "superadmin", "manager", "staff", "sales_executive", "receptionist"];
  const isStaff = !!user && STAFF_ROLES.includes(user.role);

  const openChooser = (format: Format) => {
    // All formats require login — gate behind auth modal if not signed in.
    requireAuth(() => {
      setChooserFormat(format);
    }, format === "pptx" ? "download the brochure deck" : "download the brochure");
  };

  const startDownload = async (price: PriceMode) => {
    const format = chooserFormat;
    if (!format) return;
    setChooserFormat(null);
    try {
      setLoading(format);
      await fetchBrochure(propertyId, format, price, token);
      toast({
        title: "Brochure ready",
        description: `Your ${format.toUpperCase()} download has started${price === "without" ? " (without prices)" : ""}.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again.";
      toast({
        title: "Download failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const chooserDialog = (
    <Dialog open={chooserFormat !== null} onOpenChange={(open) => { if (!open) setChooserFormat(null); }}>
      <DialogContent className="sm:max-w-md" data-testid={`dialog-brochure-price-${propertyId}`}>
        <DialogHeader>
          <DialogTitle>Choose brochure format</DialogTitle>
          <DialogDescription>
            Pick whether to include pricing in the {chooserFormat ? chooserFormat.toUpperCase() : ""} brochure.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2 pt-2">
          <button
            type="button"
            onClick={() => startDownload("with")}
            className="group flex flex-col items-start gap-2 p-4 rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/5 hover:bg-[#D4AF37]/15 hover:border-[#D4AF37] text-left transition-all"
            data-testid={`button-brochure-with-price-${propertyId}`}
          >
            <div className="flex items-center gap-2 text-[#D4AF37]">
              <Tag className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">With Price</span>
            </div>
            <div className="text-sm font-semibold text-foreground">Include room pricing</div>
            <div className="text-xs text-muted-foreground">Standard brochure with rates per room type.</div>
          </button>
          <button
            type="button"
            onClick={() => startDownload("without")}
            className="group flex flex-col items-start gap-2 p-4 rounded-xl border border-border hover:border-foreground/40 hover:bg-muted/40 text-left transition-all"
            data-testid={`button-brochure-without-price-${propertyId}`}
          >
            <div className="flex items-center gap-2 text-foreground/80">
              <EyeOff className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Without Price</span>
            </div>
            <div className="text-sm font-semibold text-foreground">Hide all pricing</div>
            <div className="text-xs text-muted-foreground">Quote pricing separately. Shows "On request" instead.</div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (variant === "compact" || variant === "row") {
    return (
      <>
        <div
          className={cn(
            "flex gap-2",
            variant === "row" ? "flex-row" : "flex-col sm:flex-row",
            className,
          )}
          data-testid={`brochure-buttons-${propertyId}`}
        >
          <button
            onClick={() => openChooser("pdf")}
            disabled={loading !== null}
            className="group inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#c79f2c] text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60 disabled:cursor-wait shadow-[0_8px_24px_-8px_rgba(212,175,55,0.6)]"
            data-testid={`button-download-pdf-${propertyId}`}
          >
            {loading === "pdf" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            PDF
          </button>
          {isStaff && (
            <button
              onClick={() => openChooser("pptx")}
              disabled={loading !== null}
              className="group inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl border border-[#D4AF37]/40 bg-transparent text-[#FDFCF9] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/70 text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-60 disabled:cursor-wait"
              data-testid={`button-download-pptx-${propertyId}`}
            >
              {loading === "pptx" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />}
              PPT
            </button>
          )}
        </div>
        {chooserDialog}
      </>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-[#D4AF37]/20 p-6 md:p-8",
          "bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-[#1A1A1A] dark:via-[#1A1A1A] dark:to-[#0F0F0F]",
          className,
        )}
        data-testid={`brochure-panel-${propertyId}`}
      >
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-[#D4AF37]/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-[2px] bg-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-[0.3em] text-amber-700 dark:text-[#8B7D6B] font-medium">Property Resources</span>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-[#FDFCF9] tracking-tight">
                Take this residence with you
              </h3>
              <p className="text-sm text-gray-500 dark:text-[#8B7D6B] mt-2 leading-relaxed">
                {propertyName ? `Download the curated brochure for ${propertyName}` : "Download the curated brochure"} — full amenities, room types, pricing, and location details, ready to share.
              </p>
            </div>
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-[#D4AF37]/15 items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-[#D4AF37]" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => openChooser("pdf")}
              disabled={loading !== null}
              className="flex-1 group flex items-center justify-center gap-2.5 px-5 h-12 rounded-xl bg-[#D4AF37] text-[#1A1A1A] hover:bg-[#c79f2c] font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-60 disabled:cursor-wait shadow-[0_10px_30px_-10px_rgba(212,175,55,0.7)]"
              data-testid={`button-download-pdf-panel-${propertyId}`}
            >
              {loading === "pdf" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Download PDF
            </button>
            {isStaff && (
              <button
                onClick={() => openChooser("pptx")}
                disabled={loading !== null}
                className="flex-1 group flex items-center justify-center gap-2.5 px-5 h-12 rounded-xl border border-[#D4AF37]/40 bg-transparent text-gray-800 dark:text-[#FDFCF9] hover:bg-[#D4AF37]/10 hover:border-[#D4AF37]/70 font-bold uppercase tracking-wider text-sm transition-all disabled:opacity-60 disabled:cursor-wait"
                data-testid={`button-download-pptx-panel-${propertyId}`}
              >
                {loading === "pptx" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
                Download PPT
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 dark:text-[#8B7D6B]/80 mt-3.5 tracking-wide" data-testid={`brochure-meta-${propertyId}`}>
            <span>Free PDF · Generated fresh from live property data</span>
            {formatLastUpdated(lastUpdated) && (
              <span data-testid={`brochure-last-updated-${propertyId}`}>
                · Last updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
            {typeof downloadCount === "number" && downloadCount > 0 && (
              <span data-testid={`brochure-download-count-${propertyId}`}>
                · {downloadCount.toLocaleString("en-IN")} download{downloadCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>
      {chooserDialog}
    </>
  );
}
