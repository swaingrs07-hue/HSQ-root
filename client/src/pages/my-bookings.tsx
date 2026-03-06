import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Building2, Calendar, CreditCard, BedDouble, FileText, ChevronRight, Download, ArrowLeft, Receipt, PlayCircle, Trash2, Clock, User, Phone, Mail, MapPin, Hash, Home, Layers } from "lucide-react";
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

const STEP_LABELS = ["Customer", "Property", "Resident", "Pricing", "Review"];

function formatLabel(s: string) {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

export default function MyBookings() {
  const { user, token } = useAuth();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [draft, setDraft] = useState<any>(null);
  const [, navigate] = useLocation();

  useEffect(() => {
    if (token) fetchBookings();
    try {
      const saved = localStorage.getItem("hsquare_booking_draft");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData?.propertyId) {
          setDraft(parsed);
        }
      }
    } catch (e) {}
  }, [token]);

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/my-bookings", {
        headers: { Authorization: `Bearer ${token}` },
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
    const ph = doc.internal.pageSize.getHeight();
    const m = 18;
    const cw = pw - m * 2;
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > ph - 30) {
        doc.addPage();
        y = 20;
      }
    };

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, pw, 45, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("HSQUARELIVING", pw / 2, 20, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Pvt Ltd | Premium Student Accommodation", pw / 2, 28, { align: "center" });
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("BOOKING RECEIPT", pw / 2, 40, { align: "center" });

    y = 58;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.5);
    doc.roundedRect(m, y - 6, cw, 26, 3, 3);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("BOOKING CODE", m + 6, y);
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text(b.bookingCode || "N/A", m + 6, y + 12);
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("DATE", pw - m - 6, y, { align: "right" });
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    const createdDate = b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "N/A";
    doc.text(createdDate, pw - m - 6, y + 12, { align: "right" });

    y += 36;

    const drawHeader = (title: string) => {
      checkPage(20);
      doc.setFillColor(245, 245, 250);
      doc.roundedRect(m, y - 4, cw, 10, 2, 2, "F");
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(title, m + 5, y + 3);
      y += 14;
    };
    const drawRow = (label: string, value: string, bold = false) => {
      if (!value || value === "N/A" || value === "") return;
      checkPage(12);
      doc.setTextColor(120, 120, 120);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(label, m + 5, y);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const maxW = cw - 80;
      const lines = doc.splitTextToSize(value, maxW);
      doc.text(lines, pw - m - 5, y, { align: "right" });
      y += 8 * Math.max(lines.length, 1);
    };

    drawHeader("BOOKING DETAILS");
    drawRow("Status", formatLabel(b.status || "draft"), true);
    drawRow("Property", b.property?.name || "N/A");
    drawRow("Location", b.property?.location || "");
    const rdAccom = b.residentDetails?.accommodationType;
    drawRow("Room Type", rdAccom || `${b.roomType?.name || "N/A"}${b.roomType?.customName ? ` (${b.roomType.customName})` : ""}`);
    drawRow("Stay Plan", b.stayPlanType === "academic_year" ? "Academic Year" : b.stayPlanType === "monthly" ? "Monthly" : b.stayPlanType ? formatLabel(b.stayPlanType) : "");
    if (b.academicYearPeriod) drawRow("Period", b.academicYearPeriod);
    drawRow("Duration", b.durationMonths ? `${b.durationMonths} months` : "");
    drawRow("Check-in", b.checkInDate ? new Date(b.checkInDate).toLocaleDateString("en-IN") : "");
    drawRow("Check-out", b.checkOutDate ? new Date(b.checkOutDate).toLocaleDateString("en-IN") : "");
    drawRow("Deposit", b.deposit ? `Rs. ${Number(b.deposit).toLocaleString("en-IN")}` : "");

    const rd = b.residentDetails;
    if (rd && (rd.name || rd.phone || rd.email)) {
      y += 4;
      drawHeader("RESIDENT DETAILS");
      drawRow("Name", rd.name || "");
      drawRow("Phone", rd.phone || "");
      drawRow("Email", rd.email || "");
      drawRow("Gender", formatLabel(rd.gender || ""));
      drawRow("Date of Birth", rd.dob || "");
      drawRow("Room No.", rd.roomNo || "");
      drawRow("Bed No.", rd.bedNo || "");
      drawRow("Move-in Date", rd.moveInDate || "");
      drawRow("Check-out Date", rd.checkOutDate || "");
      drawRow("Accommodation", formatLabel(rd.accommodationType || ""));
      drawRow("Dietary Preference", formatLabel(rd.dietaryPreference || ""));
      drawRow("Institute", rd.institute || "");
      drawRow("Course", rd.course || "");
    }

    if (rd && (rd.parentName || rd.parentPhone)) {
      y += 4;
      drawHeader("EMERGENCY CONTACT");
      drawRow("Name", rd.parentName || "");
      drawRow("Relation", formatLabel(rd.parentRelation || ""));
      drawRow("Phone", rd.parentPhone || "");
      drawRow("Email", rd.parentEmail || "");
    }

    y += 4;
    drawHeader("FEE BREAKDOWN");
    drawRow("Base Fee", `Rs. ${(b.baseFee || 0).toLocaleString("en-IN")}`);
    if ((b.deposit || 0) > 0) drawRow("Security Deposit", `Rs. ${b.deposit.toLocaleString("en-IN")}`);
    if ((b.discount || 0) > 0) drawRow("Discount", `- Rs. ${b.discount.toLocaleString("en-IN")}`);
    drawRow("Total Fee", `Rs. ${(b.totalFee || 0).toLocaleString("en-IN")}`, true);

    const totalPaid = (b.payments || []).filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + (p.amount || 0), 0);
    const balance = (b.totalFee || 0) - totalPaid;

    checkPage(30);
    y += 4;
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(0.8);
    doc.line(m + 5, y, pw - m - 5, y);
    y += 10;
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Amount Paid", m + 5, y);
    doc.setTextColor(16, 185, 129);
    doc.text(`Rs. ${totalPaid.toLocaleString("en-IN")}`, pw - m - 5, y, { align: "right" });
    if (balance > 0) {
      y += 10;
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.text("Balance Due", m + 5, y);
      doc.setTextColor(245, 158, 11);
      doc.text(`Rs. ${balance.toLocaleString("en-IN")}`, pw - m - 5, y, { align: "right" });
    }

    if ((b.installments || []).length > 0) {
      y += 10;
      drawHeader("INSTALLMENTS");
      b.installments.forEach((inst: any) => {
        const dueDateStr = inst.dueDate ? ` (Due: ${inst.dueDate})` : "";
        drawRow(`${inst.name}${dueDateStr}`, `Rs. ${(inst.amount || 0).toLocaleString("en-IN")} — ${inst.paid ? "PAID" : "PENDING"}`);
      });
    }

    if ((b.payments || []).length > 0) {
      y += 6;
      drawHeader("PAYMENT HISTORY");
      b.payments.forEach((p: any) => {
        const pDate = p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A";
        drawRow(`${pDate} (${(p.status || "pending").toUpperCase()})`, `Rs. ${(p.amount || 0).toLocaleString("en-IN")}`);
      });
    }

    y += 16;
    checkPage(20);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(m, y, pw - m, y);
    y += 10;
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Computer-generated receipt. No signature required.", pw / 2, y, { align: "center" });
    y += 7;
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
    const rd = b.residentDetails || {};

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
                  {formatLabel(b.status || "draft")}
                </Badge>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoCard icon={<Building2 className="h-3.5 w-3.5" />} label="Property" value={b.property?.name || "N/A"} sub={b.property?.location || ""} testId="text-detail-property" />
                <InfoCard icon={<BedDouble className="h-3.5 w-3.5" />} label="Room Type" value={b.residentDetails?.accommodationType || `${b.roomType?.name || "N/A"}${b.roomType?.customName ? ` (${b.roomType.customName})` : ""}`} sub={`${b.roomType?.size || ""} • ${b.roomType?.occupancy || ""}${b.roomType?.occupancy === 1 ? " person" : " persons"}`} testId="text-detail-room" />
                <InfoCard icon={<Layers className="h-3.5 w-3.5" />} label="Stay Plan" value={formatLabel(b.stayPlanType || "academic_year")} sub={b.durationMonths ? `${b.durationMonths} months` : ""} />
                <InfoCard icon={<CreditCard className="h-3.5 w-3.5" />} label="Payment Plan" value={formatLabel(b.paymentType || "full")} sub={b.paymentPlanId && b.paymentPlanId !== "custom" ? b.paymentPlanId : ""} />
                {(b.checkInDate || rd.moveInDate) && (
                  <InfoCard icon={<Calendar className="h-3.5 w-3.5" />} label="Check-in Date" value={b.checkInDate ? new Date(b.checkInDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : rd.moveInDate || "Not set"} />
                )}
                {(b.checkOutDate || rd.checkOutDate) && (
                  <InfoCard icon={<Calendar className="h-3.5 w-3.5" />} label="Check-out Date" value={b.checkOutDate ? new Date(b.checkOutDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : rd.checkOutDate || "Not set"} />
                )}
                <InfoCard icon={<Calendar className="h-3.5 w-3.5" />} label="Booking Date" value={b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"} />
                {(rd.roomNo || rd.bedNo) && (
                  <InfoCard icon={<Hash className="h-3.5 w-3.5" />} label="Room / Bed" value={`${rd.roomNo || "—"} / ${rd.bedNo || "—"}`} />
                )}
              </div>

              {(rd.name || rd.phone || rd.email) && (
                <DetailSection title="Resident Details" icon={<User className="h-4 w-4 text-indigo-500" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <DetailRow label="Full Name" value={rd.name} />
                    <DetailRow label="Phone" value={rd.phone} />
                    <DetailRow label="Email" value={rd.email} />
                    <DetailRow label="Gender" value={formatLabel(rd.gender || "")} />
                    <DetailRow label="Date of Birth" value={rd.dob} />
                    <DetailRow label="Accommodation" value={formatLabel(rd.accommodationType || "")} />
                    <DetailRow label="Dietary Preference" value={formatLabel(rd.dietaryPreference || "")} />
                    <DetailRow label="Move-in Date" value={rd.moveInDate} />
                    <DetailRow label="Room No." value={rd.roomNo} />
                    <DetailRow label="Bed No." value={rd.bedNo} />
                    {rd.institute && <DetailRow label="Institute" value={rd.institute} />}
                    {rd.course && <DetailRow label="Course" value={rd.course} />}
                  </div>
                </DetailSection>
              )}

              {(rd.parentName || rd.parentPhone) && (
                <DetailSection title="Emergency / Parent Contact" icon={<Phone className="h-4 w-4 text-indigo-500" />}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <DetailRow label="Name" value={rd.parentName} />
                    <DetailRow label="Relation" value={formatLabel(rd.parentRelation || "")} />
                    <DetailRow label="Phone" value={rd.parentPhone} />
                    <DetailRow label="Email" value={rd.parentEmail} />
                  </div>
                </DetailSection>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                  <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-indigo-500" /> Fee Summary
                  </h4>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Fee</span>
                    <span className="text-slate-800">₹{(b.baseFee || 0).toLocaleString("en-IN")}</span>
                  </div>
                  {(b.deposit || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Security Deposit</span>
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
                    <span className="font-semibold text-slate-700">Total Fee</span>
                    <span className="font-bold text-slate-800">₹{(b.totalFee || 0).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
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
                          <Badge variant="outline" className={`text-[10px] ${inst.paid ? "text-emerald-600 border-emerald-200" : "text-amber-600 border-amber-200"}`}>
                            {inst.paid ? "PAID" : "PENDING"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(b.payments || []).length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
                    <h4 className="font-semibold text-sm text-slate-700">Payment History</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {b.payments.map((p: any, idx: number) => (
                      <div key={p.id || idx} className="px-4 py-3 flex items-center justify-between text-sm gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-700">₹{(p.amount || 0).toLocaleString("en-IN")}</p>
                          <p className="text-xs text-slate-500">{p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}</p>
                          {(p.paymentMethod || p.razorpayPaymentId) && (
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {p.paymentMethod && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium uppercase">{p.paymentMethod}</span>
                              )}
                              {p.razorpayPaymentId && (
                                <span className="text-[10px] text-slate-500 font-mono">UTR: {p.razorpayPaymentId}</span>
                              )}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${p.status === "success" ? "text-emerald-600 border-emerald-200" : p.status === "failed" ? "text-red-600 border-red-200" : "text-amber-600 border-amber-200"}`}>
                          {(p.status || "pending").toUpperCase()}
                        </Badge>
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

        {draft && (
          <div className="mb-6 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 p-5 shadow-sm" data-testid="resume-booking-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm">Incomplete Booking</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    You have an unfinished booking — Step {draft.step || 1} of 5 ({STEP_LABELS[(draft.step || 1) - 1]})
                  </p>
                  {draft.savedAt && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Last saved {new Date(draft.savedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} at {new Date(draft.savedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <div
                          key={s}
                          className={`h-1.5 w-6 rounded-full ${s < (draft.step || 1) ? "bg-amber-500" : s === (draft.step || 1) ? "bg-amber-400" : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-400 hover:text-red-500 h-8 w-8 p-0"
                  onClick={() => { localStorage.removeItem("hsquare_booking_draft"); setDraft(null); }}
                  data-testid="button-discard-draft"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => navigate("/booking/generate")}
                  data-testid="button-resume-booking"
                >
                  <PlayCircle className="h-4 w-4 mr-1.5" />
                  Resume
                </Button>
              </div>
            </div>
          </div>
        )}

        {bookings.length === 0 && !draft ? (
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
        ) : bookings.length === 0 ? null : (
          <div className="space-y-4">
            {bookings.map((b: any) => {
              const totalPaid = (b.payments || []).filter((p: any) => p.status === "success").reduce((s: number, p: any) => s + (p.amount || 0), 0);
              const rd = b.residentDetails || {};
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
                          {formatLabel(b.status || "draft")}
                        </Badge>
                      </div>
                      <p className="font-semibold text-slate-800 truncate">{b.property?.name || "Property"}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {b.residentDetails?.accommodationType || b.roomType?.name || "Room"}</span>
                        {rd.roomNo && <span className="flex items-center gap-1"><Hash className="h-3 w-3" /> {rd.roomNo}</span>}
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</span>
                      </div>
                      {rd.name && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1"><User className="h-3 w-3" /> {rd.name}</p>
                      )}
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

function InfoCard({ icon, label, value, sub, testId }: { icon: React.ReactNode; label: string; value: string; sub?: string; testId?: string }) {
  return (
    <div className="p-4 bg-slate-50 rounded-xl">
      <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
        {icon} {label}
      </div>
      <p className="font-semibold text-slate-800" data-testid={testId}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function DetailSection({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
        <h4 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
          {icon} {title}
        </h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium text-right">{value}</span>
    </div>
  );
}
