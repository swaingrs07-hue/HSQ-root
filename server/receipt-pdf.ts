import { jsPDF } from "jspdf";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { storage } from "./storage";
import { bookingPackages, packages, packageItems } from "@shared/schema";
import { HSQUARE_LOGO_BASE64 } from "./logo-base64";
import type { Booking } from "@shared/schema";

const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  evening_snacks: "Evening Snacks",
  dinner: "Dinner",
};
const MEAL_ORDER = ["breakfast", "lunch", "evening_snacks", "dinner"];

function resolveMeals(dayRules: any, mealCount: number): { count: number; sortKey: string; label: string } {
  if (!dayRules) return { count: mealCount || 0, sortKey: "", label: "" };
  if (typeof dayRules === "number") {
    const count = Math.max(dayRules, mealCount);
    return { count, sortKey: `__numeric_${count}`, label: `${count} meals` };
  }
  const raw: string[] = Array.isArray(dayRules.meals) ? [...dayRules.meals] : [];
  const rawCount = dayRules.count ?? raw.length;
  if (mealCount > 0 && mealCount > rawCount) {
    const missing = MEAL_ORDER.filter(x => !raw.includes(x));
    raw.push(...missing.slice(0, mealCount - rawCount));
  }
  raw.sort((a, b) => MEAL_ORDER.indexOf(a) - MEAL_ORDER.indexOf(b));
  const count = Math.max(rawCount, mealCount > 0 ? mealCount : rawCount);
  const names = raw.map(m => MEAL_LABELS[m] || m).join(", ");
  return { count, sortKey: raw.join(","), label: `${count} meals${names ? ` (${names})` : ""}` };
}

function mealDaysAllMatch(
  wd: ReturnType<typeof resolveMeals>,
  sat: ReturnType<typeof resolveMeals>,
  sun: ReturnType<typeof resolveMeals>,
) {
  return wd.sortKey === sat.sortKey && wd.sortKey === sun.sortKey && wd.count === sat.count && wd.count === sun.count;
}

function fmtLabel(s: string) {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatDateLong(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${String(date.getDate()).padStart(2, "0")} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export async function generateBookingReceiptPdf(booking: Booking): Promise<Buffer> {
  const doc = new jsPDF();
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 18;
  const cw = pw - m * 2;
  let y = 20;

  const addWatermark = () => {
    const wmW = 80;
    const wmH = 80;
    const wmX = (pw - wmW) / 2;
    const wmY = (ph - wmH) / 2;
    doc.saveGraphicsState();
    (doc as any).setGState(new (doc as any).GState({ opacity: 0.04 }));
    doc.addImage(`data:image/png;base64,${HSQUARE_LOGO_BASE64}`, "PNG", wmX, wmY, wmW, wmH);
    doc.restoreGraphicsState();
  };

  const checkPage = (needed: number) => {
    if (y + needed > ph - 30) {
      doc.addPage();
      y = 20;
      addWatermark();
    }
  };

  addWatermark();

  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pw, 50, "F");

  const logoW = 22;
  const logoH = 22;
  const logoX = (pw - logoW) / 2;
  doc.saveGraphicsState();
  doc.addImage(`data:image/png;base64,${HSQUARE_LOGO_BASE64}`, "PNG", logoX, 4, logoW, logoH);
  doc.restoreGraphicsState();

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("HSQUARE LIVING", pw / 2, 34, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Harmony in Living | Premium Student Accommodation", pw / 2, 40, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("BOOKING RECEIPT", pw / 2, 48, { align: "center" });

  y = 62;
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
  doc.text(booking.bookingCode || "N/A", m + 6, y + 12);
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("DATE", pw - m - 6, y, { align: "right" });
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  const createdDate = booking.createdAt ? formatDateLong(booking.createdAt) : "N/A";
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
    if (!value || value === "N/A" || value === "" || value === "undefined") return;
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

  const property = await storage.getProperty(booking.propertyId);
  const propertyName = property?.name || "N/A";
  const propertyLocation = property?.location || "";

  const rd = booking.residentDetails as Record<string, any> | null;
  const customerName = rd?.name || booking.walkInName || "N/A";

  drawHeader("BOOKING DETAILS");
  drawRow("Status", fmtLabel(booking.status || "draft"), true);
  drawRow("Customer", customerName);
  drawRow("Property", propertyName);
  if (propertyLocation) drawRow("Location", propertyLocation);
  drawRow("Room Type", rd?.accommodationType || "");
  drawRow("Stay Plan", booking.stayPlanType === "academic_year" ? "Academic Year" : booking.stayPlanType === "monthly" ? "Monthly" : booking.stayPlanType ? fmtLabel(booking.stayPlanType) : "");
  if ((booking as any).academicYearPeriod) drawRow("Period", (booking as any).academicYearPeriod);
  drawRow("Duration", booking.durationMonths ? `${booking.durationMonths} months` : "");
  drawRow("Check-in", booking.checkInDate ? formatDate(booking.checkInDate) : "");
  drawRow("Check-out", booking.checkOutDate ? formatDate(booking.checkOutDate) : "");
  drawRow("Deposit", booking.deposit ? `Rs. ${Number(booking.deposit).toLocaleString("en-IN")}` : "");

  if (rd && (rd.name || rd.phone || rd.email)) {
    y += 4;
    drawHeader("RESIDENT DETAILS");
    drawRow("Name", rd.name || "");
    drawRow("Phone", rd.phone || "");
    drawRow("Email", rd.email || "");
    drawRow("Gender", fmtLabel(rd.gender || ""));
    drawRow("Date of Birth", rd.dob || "");
    drawRow("Room No.", rd.roomNo || "");
    drawRow("Bed No.", rd.bedNo || "");
    drawRow("Move-in Date", rd.moveInDate || "");
    drawRow("Check-out Date", rd.checkOutDate || "");
    drawRow("Accommodation", fmtLabel(rd.accommodationType || ""));
    drawRow("Dietary Preference", fmtLabel(rd.dietaryPreference || ""));
    drawRow("Institute", rd.institute || "");
    drawRow("Course", rd.course || "");
  }

  if (rd && (rd.parentName || rd.parentPhone)) {
    y += 4;
    drawHeader("PARENT / GUARDIAN DETAILS");
    drawRow("Name", rd.parentName || rd.guardianName || "");
    drawRow("Relation", fmtLabel(rd.parentRelation || ""));
    drawRow("Phone", rd.parentPhone || rd.guardianPhone || "");
    drawRow("Email", rd.parentEmail || rd.guardianEmail || "");
  }

  y += 4;
  drawHeader("FEE BREAKDOWN");
  drawRow("Base Fee", `Rs. ${(booking.baseFee || 0).toLocaleString("en-IN")}`);
  if ((booking.deposit || 0) > 0) {
    const sdStatus = (booking as any).depositType === "waived" ? "WAIVED" : ((booking as any).depositReceived ? "RECEIVED" : "PENDING");
    drawRow("Security Deposit", `Rs. ${Number(booking.deposit).toLocaleString("en-IN")}`);
    drawRow("SD Status", sdStatus);
  }
  if ((booking.discount || 0) > 0) drawRow("Discount", `- Rs. ${Number(booking.discount).toLocaleString("en-IN")}`);

  const mic = property?.moveInCharges as { serviceLegalCharges?: number; policeVerification?: number; agreement?: number } | null;
  const micTotal = mic ? ((mic.serviceLegalCharges || 0) || ((mic.policeVerification || 0) + (mic.agreement || 0))) : 0;
  if (micTotal > 0) {
    drawRow("Service & Legal Charges", `Rs. ${micTotal.toLocaleString("en-IN")}`);
  }

  drawRow("Total Fee", `Rs. ${(booking.totalFee || 0).toLocaleString("en-IN")}`, true);

  const payments = await storage.getPaymentsByBooking(booking.id);
  const totalPaid = payments.filter(p => p.status === "success").reduce((s, p) => s + (p.amount || 0), 0);
  const balance = (booking.totalFee || 0) - totalPaid;

  checkPage(20);
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

  if (payments.length > 0) {
    y += 10;
    drawHeader("PAYMENT HISTORY");
    for (const p of payments.filter(p => p.status === "success")) {
      const pDate = p.createdAt ? formatDate(p.createdAt) : "N/A";
      const methodLabel = p.paymentMethod ? ` via ${p.paymentMethod.toUpperCase()}` : "";
      drawRow(`${pDate} (${(p.status || "pending").toUpperCase()})${methodLabel}`, `Rs. ${(p.amount || 0).toLocaleString("en-IN")}`);
      if (p.razorpayPaymentId) {
        drawRow(`  UTR/Txn: ${p.razorpayPaymentId}`, "");
      }
    }
  }

  const installmentsList = await storage.getInstallmentsByBooking(booking.id);
  if (installmentsList.length > 0) {
    y += 10;
    drawHeader("EMI / INSTALLMENT PLAN");
    for (const inst of installmentsList) {
      const dueDateStr = inst.dueDate ? ` (Due: ${inst.dueDate})` : "";
      drawRow(`${inst.name}${dueDateStr}`, `Rs. ${(inst.amount || 0).toLocaleString("en-IN")} — ${inst.paid ? "PAID" : "PENDING"}`);
    }
  }

  // ── Included Services & Add-Ons (with correct pkgMealCount augmentation) ──
  const rawBps = await db
    .select()
    .from(bookingPackages)
    .where(eq(bookingPackages.bookingId, booking.id));

  const pkgIds = [...new Set(rawBps.map(bp => bp.packageId))];
  const pkgRows = pkgIds.length > 0
    ? await db.select().from(packages).where(inArray(packages.id, pkgIds))
    : [];
  const itemRows = pkgIds.length > 0
    ? await db.select().from(packageItems).where(inArray(packageItems.packageId, pkgIds))
    : [];

  const pkgMap = new Map(pkgRows.map(p => [p.id, p]));
  const itemsByPkg = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    if (!itemsByPkg.has(item.packageId)) itemsByPkg.set(item.packageId, []);
    itemsByPkg.get(item.packageId)!.push(item);
  }

  const enrichedBps = rawBps.map(bp => ({
    ...bp,
    package: pkgMap.has(bp.packageId)
      ? { ...pkgMap.get(bp.packageId)!, items: itemsByPkg.get(bp.packageId) || [] }
      : null,
  }));

  const activeBps = enrichedBps.filter(bp => bp.status === "ACTIVE");

  // Compute pkgMealCount — housing plan meals, overridden upward by any add-on
  const housingBp = activeBps.find(bp => bp.package?.category === "housing_plan");
  const housingMealItem = housingBp?.package?.items?.find((i: any) => i.type === "meals");
  let pkgMealCount = housingMealItem ? (housingMealItem.includedQty || 0) : 0;
  for (const bp of activeBps.filter(bp => bp.package?.category === "addon_service")) {
    const ai = bp.package?.items?.find((i: any) => i.type === "meals");
    if (ai) {
      const ac = ai.includedQty || 0;
      if (ac > pkgMealCount) pkgMealCount = ac;
    }
  }

  const propertyIncludedServices: any[] = Array.isArray(property?.includedServices)
    ? (property!.includedServices as any[])
    : [];

  if (propertyIncludedServices.length > 0) {
    y += 6;
    drawHeader("INCLUDED SERVICES");
    for (const svc of propertyIncludedServices) {
      if (svc.type === "meals" && svc.schedule) {
        const wd  = resolveMeals(svc.schedule.weekday,  pkgMealCount);
        const sat = resolveMeals(svc.schedule.saturday, pkgMealCount);
        const sun = resolveMeals(svc.schedule.sunday,   pkgMealCount);
        if (mealDaysAllMatch(wd, sat, sun)) {
          drawRow(svc.label || "Meals", `Daily: ${wd.label}`);
        } else {
          drawRow(svc.label || "Meals", `Mon-Fri: ${wd.label}`);
          if (sat.sortKey !== wd.sortKey || sat.count !== wd.count) drawRow("", `Saturday: ${sat.label}`);
          if (sun.sortKey !== wd.sortKey || sun.count !== wd.count) drawRow("", `Sunday: ${sun.label}`);
        }
      } else {
        drawRow(svc.label || "Service", svc.description || "Included");
      }
    }
  }

  const addonBps = activeBps.filter(bp => bp.package?.category === "addon_service");
  if (addonBps.length > 0) {
    y += 6;
    drawHeader("ADD-ON SERVICES");
    for (const bp of addonBps) {
      const pkg = bp.package!;
      const addonPrice = (bp.priceSnapshot as any)?.totalPrice || pkg.basePrice;
      const priceStr = addonPrice ? `Rs. ${Number(addonPrice).toLocaleString("en-IN")}` : "";
      drawRow(pkg.name || "Add-On", priceStr ? `${priceStr} — Active` : "Active");
      const mealItem = pkg.items?.find((i: any) => i.type === "meals" && i.rules);
      if (mealItem) {
        const r = mealItem.rules as any;
        const wd  = resolveMeals(r.weekday,  0);
        const sat = resolveMeals(r.saturday, 0);
        const sun = resolveMeals(r.sunday,   0);
        if (mealDaysAllMatch(wd, sat, sun)) {
          drawRow("  Schedule", `Daily: ${wd.label}`);
        } else {
          drawRow("  Schedule", `Mon-Fri: ${wd.label}`);
          if (sat.sortKey !== wd.sortKey || sat.count !== wd.count) drawRow("", `Saturday: ${sat.label}`);
          if (sun.sortKey !== wd.sortKey || sun.count !== wd.count) drawRow("", `Sunday: ${sun.label}`);
        }
      }
    }
  }

  y += 6;
  checkPage(80);
  drawHeader("TERMS & CONDITIONS");
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("1. Booking Confirmation", m + 5, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("- A booking is considered confirmed upon receipt of the booking amount.", m + 8, y); y += 4.5;
  doc.text("- Confirmation will be sent to the email address provided in the booking form.", m + 8, y); y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("2. Booking Amount", m + 5, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("- The booking amount is a non-refundable deposit that secures your reservation.", m + 8, y); y += 4.5;
  doc.text("- This amount will be deducted from your total stay charges upon check-in.", m + 8, y); y += 4.5;
  doc.text("- In case of cancellation or no-show, the booking amount will be forfeited.", m + 8, y); y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("3. Payment", m + 5, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text("- The remaining balance of your stay is payable upon check-in.", m + 8, y); y += 4.5;
  doc.text("- Accepted payment methods will be communicated during the booking process or upon arrival.", m + 8, y); y += 4.5;
  doc.text("- No refund of rent in case you move out abruptly without completion of your tenure.", m + 8, y); y += 8;

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

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
