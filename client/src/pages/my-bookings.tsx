import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2, Calendar, CreditCard, BedDouble, FileText, ChevronRight, Download, ArrowLeft, Receipt } from "lucide-react";
import { jsPDF } from "jspdf";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  pending_payment: "bg-amber-100 text-amber-700",
  pending_approval: "bg-orange-100 text-orange-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  active: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-indigo-100 text-indigo-700",
};

export default function MyBookings() {
  const { user, getAuthToken } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/my-bookings", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (e) {
      console.error("Error fetching bookings:", e);
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = (b: any) => {
    const doc = new jsPDF();
    const pw = doc.internal.pageSize.getWidth();
    const m = 20;
    const cw = pw - m * 2;
    let y = 20;

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pw, 50, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("HSQUARELIVING", pw / 2, 22, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Pvt Ltd", pw / 2, 30, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("BOOKING RECEIPT", pw / 2, 42, { align: "center" });

    y = 65;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.roundedRect(m, y - 8, cw, 30, 3, 3);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("BOOKING CODE", m + 8, y);
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(b.bookingCode || "N/A", m + 8, y + 12);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("DATE", pw - m - 8, y, { align: "right" });
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    const createdDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "N/A";
    doc.text(createdDate, pw - m - 8, y + 12, { align: "right" });

    y += 42;
    const drawHeader = (title: string, yPos: number) => {
      doc.setFillColor(245, 245, 250);
      doc.roundedRect(m, yPos - 5, cw, 10, 2, 2, "F");
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(title, m + 6, yPos + 2);
      return yPos + 16;
    };
    const drawRow = (label: string, value: string, yPos: number, bold = false) => {
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(label, m + 6, yPos);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(value, pw - m - 6, yPos, { align: "right" });
      return yPos + 10;
    };

    y = drawHeader("BOOKING DETAILS", y);
    y = drawRow("Property", b.property?.name || "N/A", y);
    y = drawRow("Room Type", b.roomType?.name || "N/A", y);
    y = drawRow("Stay Plan", (b.stayPlanType || "academic_year").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()), y);
    y = drawRow("Status", (b.status || "draft").replace(/_/g, " ").toUpperCase(), y, true);

    y += 6;
    y = drawHeader("FEE BREAKDOWN", y);
    y = drawRow("Total Fee", `Rs. ${(b.totalFee || 0).toLocaleString("en-IN")}`, y);
    if ((b.deposit || 0) > 0) y = drawRow("Security Deposit", `Rs. ${b.deposit.toLocaleString("en-IN")}`, y);
    if ((b.discount || 0) > 0) y = drawRow("Discount", `- Rs. ${b.discount.toLocaleString("en-IN")}`, y);

    const totalPaid = (b.payments || []).filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + (p.amount || 0), 0);
    y += 4;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.8);
    doc.line(m + 6, y, pw - m - 6, y);
    y += 10;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Amount Paid", m + 6, y);
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(14);
    doc.text(`Rs. ${totalPaid.toLocaleString("en-IN")}`, pw - m - 6, y, { align: "right" });

    y += 20;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(m, y, pw - m, y);
    y += 12;
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Computer-generated receipt. No signature required.", pw / 2, y, { align: "center" });
    y += 8;
    doc.text("Thank you for choosing Hsquareliving!", pw / 2, y, { align: "center" });

    doc.save(`receipt-${b.bookingCode || "booking"}.pdf`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (selectedBooking) {
    const b = selectedBooking;
    const totalPaid = (b.payments || []).filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const balance = (b.totalFee || 0) - totalPaid;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Button variant="ghost" onClick={() => setSelectedBooking(null)} className="mb-4 text-slate-600" data-testid="button-back-bookings">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Bookings
          </Button>

          <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-200 text-xs uppercase tracking-wide">Booking Code</p>
                  <p className="text-2xl font-bold font-mono mt-1" data-testid="text-detail-code">{b.bookingCode}</p>
                </div>
                <Badge className={`${STATUS_COLORS[b.status] || "bg-slate-100 text-slate-700"} text-xs px-3 py-1 capitalize`} data-testid="text-detail-status">
                  {(b.status || "draft").replace(/_/g, " ")}
                </Badge>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <Building2 className="h-3.5 w-3.5" /> Property
                  </div>
                  <p className="font-semibold text-slate-800" data-testid="text-detail-property">{b.property?.name || "N/A"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{b.property?.location || ""}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <BedDouble className="h-3.5 w-3.5" /> Room Type
                  </div>
                  <p className="font-semibold text-slate-800" data-testid="text-detail-room">{b.roomType?.name || "N/A"}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{(b.stayPlanType || "academic_year").replace(/_/g, " ")}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <Calendar className="h-3.5 w-3.5" /> Created
                  </div>
                  <p className="font-semibold text-slate-800">{b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
                    <CreditCard className="h-3.5 w-3.5" /> Payment
                  </div>
                  <p className="font-semibold text-slate-800">{(b.paymentType || "full").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-indigo-500" /> Fee Summary
                  </h4>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Fee</span>
                    <span className="text-slate-800">₹{(b.totalFee || 0).toLocaleString("en-IN")}</span>
                  </div>
                  {(b.deposit || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Deposit</span>
                      <span className="text-slate-800">₹{b.deposit.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {(b.discount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Discount</span>
                      <span className="text-emerald-600">-₹{b.discount.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-200 pt-3 flex justify-between">
                    <span className="font-semibold text-slate-700">Amount Paid</span>
                    <span className="font-bold text-emerald-600">₹{totalPaid.toLocaleString("en-IN")}</span>
                  </div>
                  {balance > 0 && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-slate-700">Balance Due</span>
                      <span className="font-bold text-amber-600">₹{balance.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
              </div>

              {(b.installments || []).length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <h4 className="font-semibold text-sm text-slate-700">Installments</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {b.installments.map((inst: any, idx: number) => (
                      <div key={inst.id || idx} className="px-4 py-3 flex items-center justify-between text-sm">
                        <div>
                          <p className="font-medium text-slate-700">{inst.name}</p>
                          <p className="text-xs text-slate-500">{inst.dueDate || "N/A"}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">₹{(inst.amount || 0).toLocaleString("en-IN")}</p>
                          <Badge variant="outline" className={`text-[10px] ${inst.status === "paid" ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"}`}>
                            {(inst.status || "pending").toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={() => downloadReceipt(b)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-download-receipt">
                <Download className="h-4 w-4 mr-2" /> Download Receipt (PDF)
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">My Bookings</h1>
          <p className="text-slate-500 text-sm mt-1">View and manage your room bookings</p>
        </div>

        {bookings.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-600 mb-2">No bookings yet</h3>
              <p className="text-slate-500 text-sm mb-4">Start by browsing properties and booking a room.</p>
              <Link href="/properties">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" data-testid="button-browse-properties">
                  Browse Properties
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((b: any) => {
              const totalPaid = (b.payments || []).filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + (p.amount || 0), 0);
              return (
                <button
                  key={b.id}
                  onClick={() => setSelectedBooking(b)}
                  className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all p-5"
                  data-testid={`booking-card-${b.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono font-bold text-indigo-600 text-sm" data-testid={`text-code-${b.id}`}>{b.bookingCode}</span>
                        <Badge className={`${STATUS_COLORS[b.status] || "bg-slate-100 text-slate-700"} text-[10px] px-2 py-0.5 capitalize`}>
                          {(b.status || "draft").replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="font-semibold text-slate-800 truncate">{b.property?.name || "Property"}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {b.roomType?.name || "Room"}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-slate-800">₹{(b.totalFee || 0).toLocaleString("en-IN")}</p>
                      {totalPaid > 0 && <p className="text-xs text-emerald-600 mt-0.5">Paid: ₹{totalPaid.toLocaleString("en-IN")}</p>}
                      <ChevronRight className="h-4 w-4 text-slate-400 mt-2 ml-auto" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
