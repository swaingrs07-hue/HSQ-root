import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Users, Target, CreditCard, Building2, GraduationCap, Receipt, Loader2, Database, Layers, BedDouble } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportCategory {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
  countKey: string;
}

const EXPORT_CATEGORIES: ExportCategory[] = [
  { key: "bookings", label: "Bookings", description: "All booking records with customer, property, pricing and status details", icon: FileSpreadsheet, endpoint: "/api/admin/export/bookings", countKey: "bookings" },
  { key: "leads", label: "Leads / Enquiries", description: "CRM leads with source, status, assignment, follow-ups and deal info", icon: Target, endpoint: "/api/admin/export/leads", countKey: "leads" },
  { key: "students", label: "Students", description: "Registered student profiles with personal, academic and emergency contact details", icon: GraduationCap, endpoint: "/api/admin/export/students", countKey: "students" },
  { key: "payments", label: "Payments", description: "All payment transactions with gateway details and status", icon: CreditCard, endpoint: "/api/admin/export/payments", countKey: "payments" },
  { key: "installments", label: "Installments", description: "Payment installment schedules with due dates and payment status", icon: Receipt, endpoint: "/api/admin/export/installments", countKey: "installments" },
  { key: "users", label: "Users & Team", description: "User accounts including admins, sales executives and their roles", icon: Users, endpoint: "/api/admin/export/users", countKey: "users" },
  { key: "properties", label: "Properties", description: "Property listings with address, amenities and booking mode", icon: Building2, endpoint: "/api/admin/export/properties", countKey: "properties" },
  { key: "floors", label: "Floors", description: "Floor plan data with property, bed counts and availability", icon: Layers, endpoint: "/api/admin/export/floors", countKey: "floors" },
  { key: "beds", label: "Beds", description: "Individual bed records with room, floor, status and pricing", icon: BedDouble, endpoint: "/api/admin/export/beds", countKey: "beds" },
];

export default function AdminDataExport() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["/api/admin/export/summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/export/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
  });

  const handleDownload = async (category: ExportCategory) => {
    try {
      setDownloading(category.key);
      const res = await fetch(category.endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" }));
        throw new Error(err.error || "Download failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const filenameMatch = disposition.match(/filename=(.+)/);
      const filename = filenameMatch ? filenameMatch[1] : `${category.key}_export.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Download started", description: `${category.label} data exported successfully.` });
    } catch (error: any) {
      toast({ title: "Export failed", description: error.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const handleDownloadAll = async () => {
    for (const cat of EXPORT_CATEGORIES) {
      await handleDownload(cat);
      await new Promise(r => setTimeout(r, 500));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2" data-testid="text-export-title">
            <Database className="h-6 w-6 text-indigo-600" />
            Data Export
          </h1>
          <p className="text-slate-500 text-sm mt-1">Download all your CRM data as CSV files for reporting and backup</p>
        </div>
        <Button
          onClick={handleDownloadAll}
          disabled={!!downloading}
          className="bg-indigo-600 hover:bg-indigo-700"
          data-testid="button-download-all"
        >
          <Download className="h-4 w-4 mr-2" />
          Download All Data
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {EXPORT_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = summary?.[cat.countKey] ?? null;
          const isDownloading = downloading === cat.key;

          return (
            <Card key={cat.key} className="border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all" data-testid={`card-export-${cat.key}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{cat.label}</CardTitle>
                      {count !== null && (
                        <p className="text-xs text-indigo-600 font-medium mt-0.5" data-testid={`text-count-${cat.key}`}>
                          {count.toLocaleString()} records
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-xs mb-4">{cat.description}</CardDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleDownload(cat)}
                  disabled={!!downloading}
                  data-testid={`button-download-${cat.key}`}
                >
                  {isDownloading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Exporting...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" /> Download CSV</>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-slate-200 bg-amber-50/50">
        <CardContent className="py-4">
          <p className="text-xs text-amber-800">
            <strong>Note:</strong> Exported CSV files contain all records without any filters. Large datasets may take a moment to download. Files are generated in real-time from the database.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
