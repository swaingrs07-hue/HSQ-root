import { Resend } from "resend";
import crypto from "crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { bookingPackages, packages, packageItems } from "@shared/schema";
import { storage } from "./storage";
import { logActivity } from "./activityLogger";
import { generateBookingReceiptPdf } from "./receipt-pdf";
import type { Booking } from "@shared/schema";

// ── Meal plan helpers ──────────────────────────────────────────────────────
const EMAIL_MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  evening_snacks: "Evening Snacks",
  dinner: "Dinner",
};
const EMAIL_MEAL_ORDER = ["breakfast", "lunch", "evening_snacks", "dinner"];

function resolveEmailMeals(dayRules: any, mealCount: number): { count: number; sortKey: string; label: string } {
  if (!dayRules) return { count: mealCount || 0, sortKey: "", label: "" };
  if (typeof dayRules === "number") {
    const count = Math.max(dayRules, mealCount);
    return { count, sortKey: `__numeric_${count}`, label: `${count} meals` };
  }
  const raw: string[] = Array.isArray(dayRules.meals) ? [...dayRules.meals] : [];
  const rawCount = dayRules.count ?? raw.length;
  if (mealCount > 0 && mealCount > rawCount) {
    const missing = EMAIL_MEAL_ORDER.filter(x => !raw.includes(x));
    raw.push(...missing.slice(0, mealCount - rawCount));
  }
  raw.sort((a, b) => EMAIL_MEAL_ORDER.indexOf(a) - EMAIL_MEAL_ORDER.indexOf(b));
  const count = Math.max(rawCount, mealCount > 0 ? mealCount : rawCount);
  const names = raw.map(m => EMAIL_MEAL_LABELS[m] || m).join(", ");
  return { count, sortKey: raw.join(","), label: `${count} meals${names ? ` (${names})` : ""}` };
}

function emailMealDaysAllMatch(
  wd: ReturnType<typeof resolveEmailMeals>,
  sat: ReturnType<typeof resolveEmailMeals>,
  sun: ReturnType<typeof resolveEmailMeals>,
) {
  return wd.sortKey === sat.sortKey && wd.sortKey === sun.sortKey && wd.count === sat.count && wd.count === sun.count;
}

async function buildIncludedServicesHtml(bookingId: string, propertyIncludedServices: any[]): Promise<string> {
  if (!propertyIncludedServices || propertyIncludedServices.length === 0) return "";

  // Fetch booking packages to compute pkgMealCount
  const rawBps = await db.select().from(bookingPackages).where(eq(bookingPackages.bookingId, bookingId));
  const pkgIds = [...new Set(rawBps.map(bp => bp.packageId))];
  const pkgRows = pkgIds.length > 0 ? await db.select().from(packages).where(inArray(packages.id, pkgIds)) : [];
  const itemRows = pkgIds.length > 0 ? await db.select().from(packageItems).where(inArray(packageItems.packageId, pkgIds)) : [];

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

  // pkgMealCount: housing plan base, overridden upward by add-on
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

  const rows: string[] = [];
  for (const svc of propertyIncludedServices) {
    if (svc.type === "meals" && svc.schedule) {
      const wd  = resolveEmailMeals(svc.schedule.weekday,  pkgMealCount);
      const sat = resolveEmailMeals(svc.schedule.saturday, pkgMealCount);
      const sun = resolveEmailMeals(svc.schedule.sunday,   pkgMealCount);
      const label = svc.label || "Meals";
      if (emailMealDaysAllMatch(wd, sat, sun)) {
        rows.push(serviceRow(label, `Daily: ${wd.label}`));
      } else {
        rows.push(serviceRow(label, `Mon–Fri: ${wd.label}`));
        if (sat.sortKey !== wd.sortKey || sat.count !== wd.count) rows.push(serviceRow("", `Saturday: ${sat.label}`));
        if (sun.sortKey !== wd.sortKey || sun.count !== wd.count) rows.push(serviceRow("", `Sunday: ${sun.label}`));
      }
    } else {
      rows.push(serviceRow(svc.label || "Service", svc.description || "Included"));
    }
  }

  if (rows.length === 0) return "";
  return `
<tr>
  <td style="background-color:#111111;padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px 12px;">
          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">What's Included</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${rows.join("")}
          </table>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function serviceRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:rgba(255,255,255,0.5);font-size:13px;width:40%;">${escHtml(label)}</td>
          <td style="color:#ffffff;font-size:13px;font-weight:600;text-align:right;">${escHtml(value)}</td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function generateReceiptToken(bookingId: string): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("FATAL: JWT_SECRET or SESSION_SECRET must be set");
  return crypto.createHmac("sha256", secret).update(`receipt:${bookingId}`).digest("hex").substring(0, 32);
}

function getReceiptUrl(bookingId: string): string {
  const baseUrl = (process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || "https://hsquare.in";
  const token = generateReceiptToken(bookingId);
  return `${baseUrl}/api/receipt/${bookingId}?token=${token}`;
}

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = "Hsquare Living <noreply@hsquarehostels.com>";

interface BookingEmailData {
  residentName: string;
  residentEmail: string;
  propertyName: string;
  roomNumber: string | null;
  bedNumber: string | null;
  checkInDate: string;
  bookingId: string;
  bookingCode: string;
  totalFee: string;
  depositAmount?: string;
  depositStatus?: string;
  includedServicesHtml: string;
}

function buildConfirmationEmailHtml(data: BookingEmailData): string {
  const checkInFormatted = data.checkInDate
    ? new Date(data.checkInDate).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - Hsquare Living</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;">HSQUARE LIVING</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:2px;text-transform:uppercase;">Harmony in Living</p>
            </td>
          </tr>

          <!-- Success Badge -->
          <tr>
            <td style="background-color:#111111;padding:32px 40px 24px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.1));border:1px solid rgba(16,185,129,0.3);border-radius:50px;padding:10px 28px;margin-bottom:16px;">
                <span style="color:#10b981;font-size:14px;font-weight:600;letter-spacing:0.5px;">&#10003; BOOKING CONFIRMED</span>
              </div>
              <h2 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Welcome, ${data.residentName}!</h2>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">Your accommodation has been confirmed. We're excited to have you as part of the Hsquare Living community.</p>
            </td>
          </tr>

          <!-- Booking Details -->
          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px 12px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Booking Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Booking ID</span><br>
                          <span style="color:#f59e0b;font-size:15px;font-weight:700;letter-spacing:0.5px;">${data.bookingCode}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Property</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.propertyName}</span>
                        </td>
                      </tr>
                      ${data.roomNumber ? `<tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Room / Bed</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">Room ${data.roomNumber}${data.bedNumber ? ` &middot; Bed ${data.bedNumber}` : ""}</span>
                        </td>
                      </tr>` : ""}
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Check-in Date</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${checkInFormatted}</span>
                        </td>
                      </tr>
                      ${data.depositAmount ? `<tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Security Deposit</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.depositAmount}</span>
                          <span style="display:inline-block;margin-left:10px;background:${data.depositStatus === 'RECEIVED' ? 'rgba(16,185,129,0.15)' : data.depositStatus === 'WAIVED' ? 'rgba(148,163,184,0.15)' : 'rgba(245,158,11,0.15)'};color:${data.depositStatus === 'RECEIVED' ? '#10b981' : data.depositStatus === 'WAIVED' ? '#94a3b8' : '#f59e0b'};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;vertical-align:middle;">${data.depositStatus}</span>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:10px 0;">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Total Fee</span><br>
                          <span style="color:#10b981;font-size:18px;font-weight:700;">${data.totalFee}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.includedServicesHtml}

          <!-- What's Next -->
          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(6,182,212,0.05));border:1px solid rgba(245,158,11,0.15);border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">What's Next?</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                          <span style="color:#f59e0b;margin-right:8px;">1.</span> Complete any remaining payment installments on time
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                          <span style="color:#f59e0b;margin-right:8px;">2.</span> Review and sign your digital agreement when available
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                          <span style="color:#f59e0b;margin-right:8px;">3.</span> Arrive on your check-in date with valid ID proof
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0d0d0d;border-top:1px solid rgba(255,255,255,0.06);border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);">Need help? Contact us at</p>
              <a href="mailto:support@hsquareliving.com" style="color:#f59e0b;font-size:14px;font-weight:600;text-decoration:none;">support@hsquareliving.com</a>
              <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
                  Hsquareliving Pvt Ltd<br>
                  Mumbai, India<br><br>
                  This is an automated confirmation email. Please do not reply directly to this message.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendBookingConfirmationEmail(booking: Booking): Promise<{ success: boolean; error?: string }> {
  try {
    if (booking.status === "cancelled") {
      console.log(`[Email] Skipping email for cancelled booking ${booking.id}`);
      await logActivity({
        actor: { name: "System", role: "SYSTEM" },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: booking.id,
        entityLabel: booking.bookingCode || booking.id,
        metadata: { emailEvent: "confirmation_skipped_cancelled" },
      });
      return { success: false, error: "Booking is cancelled" };
    }

    let residentName = booking.walkInName || "Resident";
    let residentEmail = booking.walkInEmail || "";

    if (booking.studentId) {
      const student = await storage.getStudent(booking.studentId);
      if (student) {
        residentName = student.fullName || residentName;
        const user = await storage.getUser(student.userId);
        if (user?.email) {
          residentEmail = user.email;
        }
      }
    }

    if (!residentEmail) {
      console.log(`[Email] No email address found for booking ${booking.bookingCode || booking.id}`);
      await logActivity({
        actor: { name: "System", role: "SYSTEM" },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: booking.id,
        entityLabel: booking.bookingCode || booking.id,
        metadata: { emailEvent: "confirmation_skipped_no_email" },
      });
      return { success: false, error: "No resident email address found" };
    }

    const property = await storage.getProperty(booking.propertyId);
    const propertyName = property?.name || "Hsquare Living Property";

    let roomNumber: string | null = null;
    let bedNumber: string | null = null;

    if (booking.bedId) {
      const bed = await storage.getBed(booking.bedId);
      if (bed) {
        bedNumber = bed.bedNumber;
        if (bed.roomId) {
          const rooms = await storage.getRoomsByFloor(bed.floorId);
          const room = rooms.find(r => r.id === bed.roomId);
          if (room) roomNumber = room.roomNumber;
        }
      }
    }

    const totalFee = booking.totalFee
      ? `₹${Number(booking.totalFee).toLocaleString("en-IN")}`
      : "As per agreement";

    const propertyIncludedServices: any[] = (Array.isArray((booking as any).bookingServices)
      ? ((booking as any).bookingServices as any[])
      : Array.isArray(property?.includedServices)
        ? (property!.includedServices as any[])
        : []).filter((s: any) => s.excluded !== true);
    const includedServicesHtml = await buildIncludedServicesHtml(booking.id, propertyIncludedServices);

    const depositAmt = Number(booking.deposit || 0);
    const emailData: BookingEmailData = {
      residentName,
      residentEmail,
      propertyName,
      roomNumber,
      bedNumber,
      checkInDate: booking.checkInDate ? String(booking.checkInDate) : "",
      bookingId: booking.id,
      bookingCode: booking.bookingCode || booking.id,
      totalFee,
      depositAmount: depositAmt > 0 ? `₹${depositAmt.toLocaleString("en-IN")}` : undefined,
      depositStatus: depositAmt > 0
        ? (booking.depositType === "waived" ? "WAIVED" : (booking.depositReceived ? "RECEIVED" : "PENDING"))
        : undefined,
      includedServicesHtml,
    };

    const html = buildConfirmationEmailHtml(emailData);

    let receiptPdf: Buffer | null = null;
    try {
      receiptPdf = await generateBookingReceiptPdf(booking);
    } catch (pdfErr) {
      console.error(`[Email] Failed to generate receipt PDF for ${emailData.bookingCode}:`, pdfErr);
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: residentEmail,
      subject: `Booking Confirmed - ${emailData.bookingCode} | Hsquare Living`,
      html,
      attachments: receiptPdf ? [{
        content: receiptPdf,
        filename: `Booking-Receipt-${emailData.bookingCode}.pdf`,
        contentType: "application/pdf",
      }] : undefined,
    });

    if (error) {
      console.error(`[Email] Failed to send confirmation for ${emailData.bookingCode}:`, error);

      await logActivity({
        actor: { name: "System", role: "SYSTEM" },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: booking.id,
        entityLabel: emailData.bookingCode,
        propertyId: booking.propertyId,
        propertyName: propertyName,
        metadata: {
          emailEvent: "confirmation_failed",
          recipientEmail: residentEmail,
          error: error.message || String(error),
        },
      });

      return { success: false, error: error.message || "Email send failed" };
    }

    console.log(`[Email] Confirmation sent to ${residentEmail} for booking ${emailData.bookingCode} (messageId: ${data?.id})`);

    await logActivity({
      actor: { name: "System", role: "SYSTEM" },
      actionType: "UPDATE",
      entityType: "BOOKING",
      entityId: booking.id,
      entityLabel: emailData.bookingCode,
      propertyId: booking.propertyId,
      propertyName: propertyName,
      metadata: {
        emailEvent: "confirmation_sent",
        recipientEmail: residentEmail,
        recipientName: residentName,
        resendMessageId: data?.id,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[Email] Error sending booking confirmation:`, error);

    await logActivity({
      actor: { name: "System", role: "SYSTEM" },
      actionType: "UPDATE",
      entityType: "BOOKING",
      entityId: booking.id,
      entityLabel: booking.bookingCode || booking.id,
      metadata: {
        emailEvent: "confirmation_error",
        error: error.message || String(error),
      },
    });

    return { success: false, error: error.message || "Unexpected error" };
  }
}

interface InstallmentInfo {
  name: string;
  amount: number;
  dueDate: string;
  paid: boolean;
}

interface ParentEmailData {
  parentName: string;
  parentEmail: string;
  residentName: string;
  propertyName: string;
  roomNumber: string | null;
  bedNumber: string | null;
  checkInDate: string;
  bookingCode: string;
  totalFee: string;
  depositAmount?: string;
  depositStatus?: string;
  amountPaid: string;
  receiptUrl: string;
  installments: InstallmentInfo[];
  includedServicesHtml: string;
}

function buildParentConfirmationEmailHtml(data: ParentEmailData): string {
  const checkInFormatted = data.checkInDate
    ? new Date(data.checkInDate).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Confirmation - Hsquare Living</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;">HSQUARE LIVING</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:2px;text-transform:uppercase;">Harmony in Living</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:32px 40px 24px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.1));border:1px solid rgba(16,185,129,0.3);border-radius:50px;padding:10px 28px;margin-bottom:16px;">
                <span style="color:#10b981;font-size:14px;font-weight:600;letter-spacing:0.5px;">&#10003; PAYMENT RECEIVED &amp; BOOKING CONFIRMED</span>
              </div>
              <h2 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Dear ${data.parentName},</h2>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">We are pleased to confirm that payment has been received and the booking for <strong style="color:#ffffff;">${data.residentName}</strong> has been confirmed at Hsquare Living.</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px 12px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Booking Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Booking ID</span><br>
                          <span style="color:#f59e0b;font-size:15px;font-weight:700;letter-spacing:0.5px;">${data.bookingCode}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Resident Name</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.residentName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Property</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.propertyName}</span>
                        </td>
                      </tr>
                      ${data.roomNumber ? `<tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Room / Bed</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">Room ${data.roomNumber}${data.bedNumber ? ` &middot; Bed ${data.bedNumber}` : ""}</span>
                        </td>
                      </tr>` : ""}
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Check-in Date</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${checkInFormatted}</span>
                        </td>
                      </tr>
                      ${data.depositAmount ? `<tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Security Deposit</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.depositAmount}</span>
                          <span style="display:inline-block;margin-left:10px;background:${data.depositStatus === 'RECEIVED' ? 'rgba(16,185,129,0.15)' : data.depositStatus === 'WAIVED' ? 'rgba(148,163,184,0.15)' : 'rgba(245,158,11,0.15)'};color:${data.depositStatus === 'RECEIVED' ? '#10b981' : data.depositStatus === 'WAIVED' ? '#94a3b8' : '#f59e0b'};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;vertical-align:middle;">${data.depositStatus}</span>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Total Fee</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.totalFee}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Amount Paid</span><br>
                          <span style="color:#10b981;font-size:18px;font-weight:700;">${data.amountPaid}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.includedServicesHtml}

          ${data.installments.length > 0 ? `<tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px 12px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">EMI / Installment Plan</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${data.installments.map(inst => `<tr>
                        <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#ffffff;font-size:14px;font-weight:600;">${inst.name}</td>
                              <td style="text-align:right;color:${inst.paid ? '#10b981' : '#f59e0b'};font-size:14px;font-weight:700;">₹${inst.amount.toLocaleString("en-IN")}</td>
                            </tr>
                            <tr>
                              <td style="color:rgba(255,255,255,0.4);font-size:12px;padding-top:2px;">Due: ${inst.dueDate}</td>
                              <td style="text-align:right;padding-top:2px;"><span style="display:inline-block;background:${inst.paid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};color:${inst.paid ? '#10b981' : '#f59e0b'};font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;">${inst.paid ? 'PAID' : 'PENDING'}</span></td>
                            </tr>
                          </table>
                        </td>
                      </tr>`).join("")}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;text-align:center;">
              <a href="${data.receiptUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.5px;">Download Booking Receipt</a>
              <p style="margin:12px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">Click the button above to view and download the booking receipt</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(6,182,212,0.05));border:1px solid rgba(245,158,11,0.15);border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1px;">What's Next?</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                          <span style="color:#f59e0b;margin-right:8px;">1.</span> Complete any remaining payment installments on time
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                          <span style="color:#f59e0b;margin-right:8px;">2.</span> Review and sign the digital agreement when available
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;color:rgba(255,255,255,0.7);font-size:14px;line-height:1.6;">
                          <span style="color:#f59e0b;margin-right:8px;">3.</span> Arrive on the check-in date with valid ID proof
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0d0d0d;border-top:1px solid rgba(255,255,255,0.06);border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);">Need help? Contact us at</p>
              <a href="mailto:support@hsquareliving.com" style="color:#f59e0b;font-size:14px;font-weight:600;text-decoration:none;">support@hsquareliving.com</a>
              <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
                  Hsquareliving Pvt Ltd<br>
                  Mumbai, India<br><br>
                  This is an automated confirmation email. Please do not reply directly to this message.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendParentBookingConfirmationEmail(
  booking: Booking,
  paymentAmount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const rd = booking.residentDetails as Record<string, any> | null;
    const parentEmail = rd?.parentEmail || rd?.guardianEmail;
    const parentName = rd?.parentName || rd?.guardianName;

    if (!parentEmail) {
      console.log(`[Email] No parent email found for booking ${booking.bookingCode || booking.id}`);
      return { success: false, error: "No parent email address found" };
    }

    let residentName = rd?.name || booking.walkInName || "Resident";

    const property = await storage.getProperty(booking.propertyId);
    const propertyName = property?.name || "Hsquare Living Property";

    let roomNumber: string | null = null;
    let bedNumber: string | null = null;

    if (booking.bedId) {
      const bed = await storage.getBed(booking.bedId);
      if (bed) {
        bedNumber = bed.bedNumber;
        if (bed.roomId) {
          const rooms = await storage.getRoomsByFloor(bed.floorId);
          const room = rooms.find(r => r.id === bed.roomId);
          if (room) roomNumber = room.roomNumber;
        }
      }
    }

    const totalFee = booking.totalFee
      ? `₹${Number(booking.totalFee).toLocaleString("en-IN")}`
      : "As per agreement";

    const amountPaid = `₹${Number(paymentAmount).toLocaleString("en-IN")}`;

    const receiptUrl = getReceiptUrl(booking.id);

    const installmentsList = await storage.getInstallmentsByBooking(booking.id);
    const installments: InstallmentInfo[] = installmentsList.map(inst => ({
      name: inst.name,
      amount: inst.amount || 0,
      dueDate: inst.dueDate || "",
      paid: inst.paid,
    }));

    const parentPropertyIncludedServices: any[] = (Array.isArray((booking as any).bookingServices)
      ? ((booking as any).bookingServices as any[])
      : Array.isArray(property?.includedServices)
        ? (property!.includedServices as any[])
        : []).filter((s: any) => s.excluded !== true);
    const parentIncludedServicesHtml = await buildIncludedServicesHtml(booking.id, parentPropertyIncludedServices);

    const depositAmtParent = Number(booking.deposit || 0);
    const emailData: ParentEmailData = {
      parentName: parentName || "Parent / Guardian",
      parentEmail,
      residentName,
      propertyName,
      roomNumber,
      bedNumber,
      checkInDate: booking.checkInDate ? String(booking.checkInDate) : "",
      bookingCode: booking.bookingCode || booking.id,
      totalFee,
      depositAmount: depositAmtParent > 0 ? `₹${depositAmtParent.toLocaleString("en-IN")}` : undefined,
      depositStatus: depositAmtParent > 0
        ? (booking.depositType === "waived" ? "WAIVED" : (booking.depositReceived ? "RECEIVED" : "PENDING"))
        : undefined,
      amountPaid,
      receiptUrl,
      installments,
      includedServicesHtml: parentIncludedServicesHtml,
    };

    const html = buildParentConfirmationEmailHtml(emailData);

    let receiptPdf: Buffer | null = null;
    try {
      receiptPdf = await generateBookingReceiptPdf(booking);
    } catch (pdfErr) {
      console.error(`[Email] Failed to generate receipt PDF for parent email ${emailData.bookingCode}:`, pdfErr);
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: parentEmail,
      subject: `Booking Confirmed for ${residentName} - ${emailData.bookingCode} | Hsquare Living`,
      html,
      attachments: receiptPdf ? [{
        content: receiptPdf,
        filename: `Booking-Receipt-${emailData.bookingCode}.pdf`,
        contentType: "application/pdf",
      }] : undefined,
    });

    if (error) {
      console.error(`[Email] Failed to send parent confirmation for ${emailData.bookingCode}:`, error);
      await logActivity({
        actor: { name: "System", role: "SYSTEM" },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: booking.id,
        entityLabel: emailData.bookingCode,
        propertyId: booking.propertyId,
        propertyName,
        metadata: {
          emailEvent: "parent_confirmation_failed",
          recipientEmail: parentEmail,
          recipientName: parentName,
          error: error.message || String(error),
        },
      });
      return { success: false, error: error.message || "Email send failed" };
    }

    console.log(`[Email] Parent confirmation sent to ${parentEmail} for booking ${emailData.bookingCode} (messageId: ${data?.id})`);
    await logActivity({
      actor: { name: "System", role: "SYSTEM" },
      actionType: "UPDATE",
      entityType: "BOOKING",
      entityId: booking.id,
      entityLabel: emailData.bookingCode,
      propertyId: booking.propertyId,
      propertyName,
      metadata: {
        emailEvent: "parent_confirmation_sent",
        recipientEmail: parentEmail,
        recipientName: parentName || "Parent/Guardian",
        resendMessageId: data?.id,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[Email] Error sending parent booking confirmation:`, error);
    await logActivity({
      actor: { name: "System", role: "SYSTEM" },
      actionType: "UPDATE",
      entityType: "BOOKING",
      entityId: booking.id,
      entityLabel: booking.bookingCode || booking.id,
      metadata: {
        emailEvent: "parent_confirmation_error",
        error: error.message || String(error),
      },
    });
    return { success: false, error: error.message || "Unexpected error" };
  }
}

interface PaymentReceivedEmailData {
  parentName: string;
  parentEmail: string;
  residentName: string;
  propertyName: string;
  bookingCode: string;
  amountPaid: string;
  totalFee: string;
  totalPaidSoFar: string;
  remainingBalance: string;
  receiptUrl: string;
  installments: InstallmentInfo[];
  depositAmount?: string;
  depositStatus?: string;
}

function buildPaymentReceivedEmailHtml(data: PaymentReceivedEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Received - Hsquare Living</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;">HSQUARE LIVING</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:2px;text-transform:uppercase;">Harmony in Living</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:32px 40px 24px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(6,182,212,0.1));border:1px solid rgba(59,130,246,0.3);border-radius:50px;padding:10px 28px;margin-bottom:16px;">
                <span style="color:#3b82f6;font-size:14px;font-weight:600;letter-spacing:0.5px;">&#10003; PAYMENT RECEIVED</span>
              </div>
              <h2 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Dear ${data.parentName},</h2>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">We have received a payment of <strong style="color:#10b981;">${data.amountPaid}</strong> for <strong style="color:#ffffff;">${data.residentName}</strong>'s booking at Hsquare Living.</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px 12px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Payment Summary</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Booking ID</span><br>
                          <span style="color:#f59e0b;font-size:15px;font-weight:700;letter-spacing:0.5px;">${data.bookingCode}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Property</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.propertyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">This Payment</span><br>
                          <span style="color:#10b981;font-size:18px;font-weight:700;">${data.amountPaid}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Total Paid So Far</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.totalPaidSoFar}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Total Fee</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.totalFee}</span>
                        </td>
                      </tr>
                      ${data.depositAmount ? `<tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Security Deposit</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${data.depositAmount}</span>
                          <span style="display:inline-block;margin-left:10px;background:${data.depositStatus === 'RECEIVED' ? 'rgba(16,185,129,0.15)' : data.depositStatus === 'WAIVED' ? 'rgba(148,163,184,0.15)' : 'rgba(245,158,11,0.15)'};color:${data.depositStatus === 'RECEIVED' ? '#10b981' : data.depositStatus === 'WAIVED' ? '#94a3b8' : '#f59e0b'};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;vertical-align:middle;">${data.depositStatus}</span>
                        </td>
                      </tr>` : ''}
                      <tr>
                        <td style="padding:10px 0;">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Remaining Balance</span><br>
                          <span style="color:#f59e0b;font-size:16px;font-weight:700;">${data.remainingBalance}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${data.installments.length > 0 ? `<tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px 12px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">EMI / Installment Status</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${data.installments.map(inst => `<tr>
                        <td style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="color:#ffffff;font-size:14px;font-weight:600;">${inst.name}</td>
                              <td style="text-align:right;color:${inst.paid ? '#10b981' : '#f59e0b'};font-size:14px;font-weight:700;">₹${inst.amount.toLocaleString("en-IN")}</td>
                            </tr>
                            <tr>
                              <td style="color:rgba(255,255,255,0.4);font-size:12px;padding-top:2px;">Due: ${inst.dueDate}</td>
                              <td style="text-align:right;padding-top:2px;"><span style="display:inline-block;background:${inst.paid ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'};color:${inst.paid ? '#10b981' : '#f59e0b'};font-size:11px;font-weight:600;padding:2px 10px;border-radius:20px;">${inst.paid ? 'PAID' : 'PENDING'}</span></td>
                            </tr>
                          </table>
                        </td>
                      </tr>`).join("")}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;text-align:center;">
              <a href="${data.receiptUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.5px;">Download Payment Receipt</a>
              <p style="margin:12px 0 0;font-size:12px;color:rgba(255,255,255,0.4);">Click the button above to view and download the payment receipt</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0d0d0d;border-top:1px solid rgba(255,255,255,0.06);border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);">Need help? Contact us at</p>
              <a href="mailto:support@hsquareliving.com" style="color:#f59e0b;font-size:14px;font-weight:600;text-decoration:none;">support@hsquareliving.com</a>
              <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
                  Hsquareliving Pvt Ltd<br>
                  Mumbai, India<br><br>
                  This is an automated payment notification. Please do not reply directly to this message.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPaymentReceivedEmail(
  booking: Booking,
  paymentAmount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const rd = booking.residentDetails as Record<string, any> | null;
    const parentEmail = rd?.parentEmail || rd?.guardianEmail;
    const parentName = rd?.parentName || rd?.guardianName;

    if (!parentEmail) {
      console.log(`[Email] No parent email found for booking ${booking.bookingCode || booking.id}`);
      return { success: false, error: "No parent email address found" };
    }

    let residentName = rd?.name || booking.walkInName || "Resident";

    const property = await storage.getProperty(booking.propertyId);
    const propertyName = property?.name || "Hsquare Living Property";

    const totalFee = booking.totalFee
      ? `₹${Number(booking.totalFee).toLocaleString("en-IN")}`
      : "As per agreement";

    const amountPaid = `₹${Number(paymentAmount).toLocaleString("en-IN")}`;

    const allPayments = await storage.getPaymentsByBooking(booking.id);
    const totalPaidNum = allPayments
      .filter(p => p.status === "success")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalPaidSoFar = `₹${totalPaidNum.toLocaleString("en-IN")}`;

    const totalFeeNum = Number(booking.totalFee || 0);
    const remainingNum = Math.max(0, totalFeeNum - totalPaidNum);
    const remainingBalance = remainingNum > 0
      ? `₹${remainingNum.toLocaleString("en-IN")}`
      : "Fully Paid";

    const receiptUrl = getReceiptUrl(booking.id);

    const installmentsList = await storage.getInstallmentsByBooking(booking.id);
    const installments: InstallmentInfo[] = installmentsList.map(inst => ({
      name: inst.name,
      amount: inst.amount || 0,
      dueDate: inst.dueDate || "",
      paid: inst.paid,
    }));

    const depositAmtReceived = Number(booking.deposit || 0);
    const emailData: PaymentReceivedEmailData = {
      parentName: parentName || "Parent / Guardian",
      parentEmail,
      residentName,
      propertyName,
      bookingCode: booking.bookingCode || booking.id,
      amountPaid,
      totalFee,
      totalPaidSoFar,
      remainingBalance,
      receiptUrl,
      installments,
      depositAmount: depositAmtReceived > 0 ? `₹${depositAmtReceived.toLocaleString("en-IN")}` : undefined,
      depositStatus: depositAmtReceived > 0
        ? (booking.depositType === "waived" ? "WAIVED" : (booking.depositReceived ? "RECEIVED" : "PENDING"))
        : undefined,
    };

    const html = buildPaymentReceivedEmailHtml(emailData);

    let receiptPdf: Buffer | null = null;
    try {
      receiptPdf = await generateBookingReceiptPdf(booking);
    } catch (pdfErr) {
      console.error(`[Email] Failed to generate receipt PDF for payment received email ${emailData.bookingCode}:`, pdfErr);
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: parentEmail,
      subject: `Payment Received for ${residentName} - ${emailData.bookingCode} | Hsquare Living`,
      html,
      attachments: receiptPdf ? [{
        content: receiptPdf,
        filename: `Payment-Receipt-${emailData.bookingCode}.pdf`,
        contentType: "application/pdf",
      }] : undefined,
    });

    if (error) {
      console.error(`[Email] Failed to send payment received email for ${emailData.bookingCode}:`, error);
      await logActivity({
        actor: { name: "System", role: "SYSTEM" },
        actionType: "UPDATE",
        entityType: "BOOKING",
        entityId: booking.id,
        entityLabel: emailData.bookingCode,
        propertyId: booking.propertyId,
        propertyName,
        metadata: {
          emailEvent: "payment_received_email_failed",
          recipientEmail: parentEmail,
          recipientName: parentName,
          error: error.message || String(error),
        },
      });
      return { success: false, error: error.message || "Email send failed" };
    }

    console.log(`[Email] Payment received email sent to ${parentEmail} for booking ${emailData.bookingCode} (messageId: ${data?.id})`);
    await logActivity({
      actor: { name: "System", role: "SYSTEM" },
      actionType: "UPDATE",
      entityType: "BOOKING",
      entityId: booking.id,
      entityLabel: emailData.bookingCode,
      propertyId: booking.propertyId,
      propertyName,
      metadata: {
        emailEvent: "payment_received_email_sent",
        recipientEmail: parentEmail,
        recipientName: parentName || "Parent/Guardian",
        resendMessageId: data?.id,
        paymentAmount: amountPaid,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error(`[Email] Error sending payment received email:`, error);
    await logActivity({
      actor: { name: "System", role: "SYSTEM" },
      actionType: "UPDATE",
      entityType: "BOOKING",
      entityId: booking.id,
      entityLabel: booking.bookingCode || booking.id,
      metadata: {
        emailEvent: "payment_received_email_error",
        error: error.message || String(error),
      },
    });
    return { success: false, error: error.message || "Unexpected error" };
  }
}

interface WelcomeEmailData {
  residentName: string;
  residentEmail: string;
  propertyName: string;
  propertyPhone: string | null;
  roomNumber: string | null;
  moveInDate: string;
  checkOutDate: string;
  bookingCode: string;
  baseUrl: string;
}

function buildWelcomeEmailHtml(data: WelcomeEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Hsquare Living</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;">HSQUARE LIVING</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:2px;text-transform:uppercase;">Welcome to ${data.propertyName}</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:32px 40px 24px;text-align:center;">
              <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;">Hi ${data.residentName},</h2>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">Your booking has been confirmed! Welcome to <strong style="color:#ffffff;">${data.propertyName}</strong>. Here are your booking details.</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px 12px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Booking Details</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:rgba(255,255,255,0.5);font-size:13px;">Name</span><br><span style="color:#ffffff;font-size:15px;font-weight:600;">${data.residentName}</span></td></tr>
                      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:rgba(255,255,255,0.5);font-size:13px;">Email</span><br><span style="color:#ffffff;font-size:15px;font-weight:600;">${data.residentEmail}</span></td></tr>
                      ${data.roomNumber ? `<tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:rgba(255,255,255,0.5);font-size:13px;">Room</span><br><span style="color:#ffffff;font-size:15px;font-weight:600;">${data.roomNumber}</span></td></tr>` : ""}
                      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:rgba(255,255,255,0.5);font-size:13px;">Property</span><br><span style="color:#ffffff;font-size:15px;font-weight:600;">${data.propertyName}</span></td></tr>
                      <tr><td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:rgba(255,255,255,0.5);font-size:13px;">Move-in</span><br><span style="color:#ffffff;font-size:15px;font-weight:600;">${data.moveInDate || "To be confirmed"}</span></td></tr>
                      <tr><td style="padding:10px 0;"><span style="color:rgba(255,255,255,0.5);font-size:13px;">Check-out</span><br><span style="color:#ffffff;font-size:15px;font-weight:600;">${data.checkOutDate || "To be confirmed"}</span></td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,rgba(245,158,11,0.08),rgba(217,119,6,0.05));border:1px solid rgba(245,158,11,0.2);border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h3 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#f59e0b;">How to get started:</h3>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:6px 0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.6;"><span style="color:#f59e0b;font-weight:700;">Step 1:</span> Download the HsquareConnect app (available on App Store &amp; Android)</td></tr>
                      <tr><td style="padding:6px 0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.6;"><span style="color:#f59e0b;font-weight:700;">Step 2:</span> Tap &ldquo;Create Account&rdquo; and enter your email: <strong style="color:#ffffff;">${data.residentEmail}</strong></td></tr>
                      <tr><td style="padding:6px 0;font-size:14px;color:rgba(255,255,255,0.7);line-height:1.6;"><span style="color:#f59e0b;font-weight:700;">Step 3:</span> Set your password and you&rsquo;re all set!</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h3 style="margin:0 0 12px;font-size:15px;font-weight:700;color:#10b981;">Download the App</h3>
                    <p style="margin:0 0 16px;font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6;">Get HsquareConnect to manage your hostel experience — meals, gate QR, leave management, and more.</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right:8px;" width="50%">
                          <a href="https://apps.apple.com/in/app/hsquareconnect-app/id6759179340" target="_blank" style="display:block;text-align:center;background:#ffffff;color:#000000;text-decoration:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:700;">&#63743; App Store</a>
                        </td>
                        <td style="padding-left:8px;" width="50%">
                          <a href="https://play.google.com/store/apps/details?id=com.hsquareconnect.app" target="_blank" style="display:block;text-align:center;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;text-decoration:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:700;">&#9654; Google Play</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <h3 style="margin:0 0 8px;font-size:15px;font-weight:700;color:#10b981;">Create Your Account</h3>
                    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.6;">Use your registered email (<strong style="color:#ffffff;">${data.residentEmail}</strong>) to create your account. You will be able to access the app from your move-in date (${data.moveInDate || "TBC"}). Once logged in, you can access meal services, gate QR, leave management, and more during your stay.</p>
                    <p style="margin:12px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">&#128203; If there are any changes in your move-in date, please let us know in advance.</p>
                    ${data.propertyPhone ? `<p style="margin:10px 0 0;font-size:14px;color:rgba(255,255,255,0.6);">Contact ${data.propertyName}: <strong style="color:#f59e0b;">${data.propertyPhone}</strong></p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;text-align:center;">
              <a href="${data.baseUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.5px;">Visit Our Website</a>
              <p style="margin:10px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">${data.baseUrl}</p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0d0d0d;border-top:1px solid rgba(255,255,255,0.06);border-radius:0 0 16px 16px;padding:24px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">Hsquareliving Pvt Ltd &bull; Premium Student Accommodation</p>
              <p style="margin:6px 0 0;font-size:11px;color:rgba(255,255,255,0.2);">This is an automated email. Please do not reply directly.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail(data: {
  name: string;
  email: string;
  phone?: string;
  room?: string;
  propertyCode?: string;
  moveInDate?: string;
  checkOutDate?: string;
  bookingCode: string;
  amountPaid?: number;
  paymentDate?: string;
}, booking?: Booking | null): Promise<{ success: boolean; error?: string }> {
  try {
    if (!data.email) {
      console.log(`[Email] No resident email for welcome mail, booking ${data.bookingCode}`);
      return { success: false, error: "No resident email address provided" };
    }

    let propertyName = data.propertyCode || "Hsquare Living Property";
    let propertyPhone: string | null = null;
    if (booking?.propertyId) {
      const property = await storage.getProperty(booking.propertyId);
      if (property?.name) propertyName = property.name;
      if (property?.phone) propertyPhone = property.phone;
    }

    const baseUrl = (process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || "https://hsquare.in";
    const emailData: WelcomeEmailData = {
      residentName: data.name || "Resident",
      residentEmail: data.email,
      propertyName,
      propertyPhone,
      roomNumber: data.room || null,
      moveInDate: data.moveInDate || "",
      checkOutDate: data.checkOutDate || "",
      bookingCode: data.bookingCode,
      baseUrl,
    };

    const html = buildWelcomeEmailHtml(emailData);

    const { data: resendData, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      subject: `Welcome to ${propertyName} - Hsquare Living`,
      html,
    });

    if (error) {
      console.error(`[Email] Failed to send welcome email for ${data.bookingCode}:`, error);
      return { success: false, error: String(error.message || error) };
    }

    console.log(`[Email] Welcome email sent to ${data.email} for ${data.bookingCode}, id: ${resendData?.id}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Email] Welcome email error for ${data.bookingCode}:`, error.message);
    return { success: false, error: error.message || "Unexpected error" };
  }
}

export async function sendWelcomeEmailForBooking(booking: Booking): Promise<{ success: boolean; error?: string }> {
  if (booking.welcomeEmailSent) {
    console.log(`[Email] Welcome email already sent for booking ${booking.bookingCode || booking.id}, skipping`);
    return { success: false, error: "Welcome email already sent" };
  }

  const rd = booking.residentDetails as Record<string, any> | null;
  let residentName = rd?.name || booking.walkInName || "Resident";
  let residentEmail = rd?.email || booking.walkInEmail || "";

  if (booking.studentId) {
    const student = await storage.getStudent(booking.studentId);
    if (student) {
      residentName = student.fullName || residentName;
      const user = await storage.getUser(student.userId);
      if (user?.email) residentEmail = user.email;
    }
  }

  if (!residentEmail) {
    console.log(`[Email] No email for welcome mail, booking ${booking.bookingCode || booking.id}`);
    return { success: false, error: "No resident email address found" };
  }

  let roomNumber: string | null = rd?.roomNo || null;
  if (!roomNumber && booking.bedId) {
    const bed = await storage.getBed(booking.bedId);
    if (bed?.roomId) {
      const rooms = await storage.getRoomsByFloor(bed.floorId);
      const room = rooms.find(r => r.id === bed.roomId);
      if (room) roomNumber = room.roomNumber;
    }
  }

  const result = await sendWelcomeEmail({
    name: residentName,
    email: residentEmail,
    room: roomNumber || undefined,
    moveInDate: booking.checkInDate || rd?.moveInDate || "",
    checkOutDate: booking.checkOutDate || rd?.checkOutDate || "",
    bookingCode: booking.bookingCode || booking.id,
  }, booking);

  if (result.success) {
    await storage.updateBooking(booking.id, { welcomeEmailSent: true });
    console.log(`[Email] Marked welcomeEmailSent=true for booking ${booking.bookingCode || booking.id}`);
  }

  return result;
}

export async function sendFollowUpReminderEmail(
  user: { name: string; email: string },
  leads: Array<{ name: string; phone: string; followUpAt: Date | string | null; followUpNotes: string | null; propertyName: string | null }>
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  const leadRows = leads.map(lead => {
    const time = lead.followUpAt
      ? new Date(lead.followUpAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
      : "Not set";
    return `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${lead.name}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${lead.phone || '-'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${time}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px;">${lead.propertyName || '-'}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">${lead.followUpNotes || '-'}</td>
      </tr>`;
  }).join("");

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0;">
      <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 24px 30px;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Upcoming Follow-ups</h1>
        <p style="color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 14px;">You have ${leads.length} follow-up${leads.length > 1 ? 's' : ''} scheduled within the next hour</p>
      </div>
      <div style="padding: 24px 30px;">
        <p style="color: #334155; margin: 0 0 16px; font-size: 15px;">Hi ${user.name},</p>
        <p style="color: #475569; margin: 0 0 20px; font-size: 14px;">Here are your upcoming follow-ups that need attention:</p>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background: #f8fafc;">
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Lead</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Phone</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Time</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Property</th>
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Notes</th>
            </tr>
          </thead>
          <tbody>${leadRows}</tbody>
        </table>
        <div style="margin-top: 24px; text-align: center;">
          <a href="${(process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || "https://hsquare.in"}/sales/calendar" style="display: inline-block; padding: 10px 24px; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">View Calendar</a>
        </div>
      </div>
      <div style="background: #f8fafc; padding: 16px 30px; text-align: center;">
        <p style="color: #94a3b8; margin: 0; font-size: 12px;">Hsquare Living - Student Accommodation Management</p>
      </div>
    </div>`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email,
      subject: `Reminder: ${leads.length} follow-up${leads.length > 1 ? 's' : ''} coming up soon`,
      html,
    });
    console.log(`[Email] Follow-up reminder sent to ${user.email}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Email] Failed to send follow-up reminder to ${user.email}:`, error);
    return { success: false, error: error.message };
  }
}

// ===========================================================================
// Lead assignment notifications
// ===========================================================================
//
// Fired every time a lead is assigned (or reassigned) to a sales executive
// from any of the assignment trigger paths (web lead, tour enquiry, manual
// sales create, admin auto-assign, admin reassign, admin generic assign,
// and admin bulk assign — bulk uses the summary variant below).
//
// We always CC `gyan@hsquareliving.com` so leadership has full visibility
// into the lead routing — except when the assignee themselves is Gyan, in
// which case CC'ing him would be redundant.

const LEAD_OWNERSHIP_CC_EMAIL = "gyan@hsquareliving.com";

function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatBudgetRange(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  return `up to ${fmt(max!)}`;
}

export interface LeadAssignmentEmailLead {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  propertyName?: string | null;
  source?: string | null;
  notes?: string | null;
  message?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  score?: number | null;
  priority?: string | null;
}

export function buildLeadAssignmentEmailPayload(lead: {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  propertyName?: string | null;
  source?: string | null;
  notes?: string | null;
  message?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  score?: number | null;
  priority?: string | null;
}): LeadAssignmentEmailLead {
  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone ?? null,
    email: lead.email ?? null,
    propertyName: lead.propertyName ?? null,
    source: lead.source ?? null,
    notes: lead.notes ?? null,
    message: lead.message ?? null,
    budgetMin: lead.budgetMin ?? null,
    budgetMax: lead.budgetMax ?? null,
    score: lead.score ?? null,
    priority: lead.priority ?? null,
  };
}

export async function sendLeadAssignmentEmail(
  lead: LeadAssignmentEmailLead,
  assignee: { id?: string; name: string; email: string },
  options?: {
    assignerName?: string | null;
    assignerId?: string | null;
    isReassign?: boolean;
    assignmentType?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  if (!assignee.email) {
    return { success: false, error: "Assignee has no email" };
  }
  // Skip the assignment email when the person creating/assigning the lead
  // is the same person being notified — they already know about it.
  if (
    options?.assignerId &&
    assignee.id &&
    options.assignerId === assignee.id
  ) {
    return { success: true };
  }

  const isReassign = !!options?.isReassign;
  const assignerName = options?.assignerName?.trim() || null;
  const assignmentType = options?.assignmentType || null;
  const baseUrl = (process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || "https://hsquare.in";
  const ctaUrl = `${baseUrl}/sales/requests`;
  const budget = formatBudgetRange(lead.budgetMin, lead.budgetMax);
  const propertyForSubject = lead.propertyName?.trim() || "No property";
  const propertyLabel = lead.propertyName?.trim() || "No specific property";

  const detailRow = (label: string, value: string | null | undefined) => {
    if (!value) return "";
    return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;width:140px;">${escapeHtml(label)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:500;">${escapeHtml(value)}</td>
      </tr>`;
  };

  const sourceLabel = lead.source
    ? lead.source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const priorityLabel = lead.priority
    ? lead.priority.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const scoreLine = (() => {
    if (lead.score == null && !priorityLabel) return null;
    const parts: string[] = [];
    if (lead.score != null) parts.push(`${lead.score}`);
    if (priorityLabel) parts.push(`(${priorityLabel})`);
    return parts.join(" ");
  })();

  const assignedByLine = assignerName
    ? `Assigned by ${assignerName}`
    : "Auto-assigned";

  const assignmentTypeLabel = (() => {
    switch (assignmentType) {
      case "property_auto": return "Property round-robin";
      case "admin_manual": return "Manual assignment by admin";
      case "fallback_default": return "Fallback (no property mapping)";
      default: return null;
    }
  })();

  const headerTitle = isReassign ? "Lead Reassigned to You" : "New Lead Assigned";
  const intro = isReassign
    ? `A lead has been reassigned to you${assignerName ? ` by ${escapeHtml(assignerName)}` : ""}.`
    : `A new lead has been assigned to you${assignerName ? ` by ${escapeHtml(assignerName)}` : ""}. Please reach out as soon as possible.`;

  const html = `
    <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%);padding:32px 40px;text-align:center;">
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;">HSQUARE LIVING</h1>
        <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:2px;text-transform:uppercase;">Harmony in Living</p>
      </div>
      <div style="background:#0a0a0a;padding:24px 30px;text-align:center;">
        <h2 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">${headerTitle}</h2>
        <p style="color:#f59e0b;margin:6px 0 0;font-size:14px;">${escapeHtml(propertyLabel)}</p>
      </div>
      <div style="padding:24px 30px;">
        <p style="color:#334155;margin:0 0 12px;font-size:15px;">Hi ${escapeHtml(assignee.name)},</p>
        <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.5;">${intro}</p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <tbody>
            ${detailRow("Lead Name", lead.name)}
            ${detailRow("Phone", lead.phone || null)}
            ${detailRow("Email", lead.email || null)}
            ${detailRow("Property", lead.propertyName || null)}
            ${detailRow("Source", sourceLabel)}
            ${detailRow("Budget", budget)}
            ${detailRow("Score", scoreLine)}
            ${detailRow("Notes", lead.notes || lead.message || null)}
            ${detailRow("Assigned By", assignedByLine)}
            ${detailRow("Routing", assignmentTypeLabel)}
          </tbody>
        </table>
        <div style="margin-top:24px;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open Lead in CRM</a>
        </div>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;text-align:center;">
          You're receiving this email because the lead was routed to your queue.
        </p>
      </div>
      <div style="background:#0a0a0a;padding:16px 30px;text-align:center;">
        <p style="color:#94a3b8;margin:0;font-size:12px;">Hsquareliving Pvt Ltd &mdash; Sales CRM</p>
      </div>
    </div>`;

  const subject = `New lead assigned: ${lead.name} (${propertyForSubject})`;

  const cc = assignee.email.toLowerCase() === LEAD_OWNERSHIP_CC_EMAIL.toLowerCase()
    ? undefined
    : [LEAD_OWNERSHIP_CC_EMAIL];

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: assignee.email,
      ...(cc ? { cc } : {}),
      subject,
      html,
    });
    console.log(`[Email] Lead assignment sent to ${assignee.email}${cc ? ` (cc ${cc.join(", ")})` : ""}`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Email] Failed to send lead assignment to ${assignee.email}:`, error);
    return { success: false, error: error?.message || String(error) };
  }
}

export async function sendLeadAssignmentBulkSummaryEmail(
  assignee: { id?: string; name: string; email: string },
  leads: LeadAssignmentEmailLead[],
  options?: { assignerName?: string | null; assignerId?: string | null }
): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  if (!assignee.email || leads.length === 0) {
    return { success: false, error: "Nothing to send" };
  }
  // Same self-assignment guard as the single-lead variant.
  if (
    options?.assignerId &&
    assignee.id &&
    options.assignerId === assignee.id
  ) {
    return { success: true };
  }

  const baseUrl = (process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || "https://hsquare.in";
  const ctaUrl = `${baseUrl}/sales/requests`;
  const assignerName = options?.assignerName?.trim() || null;

  const rows = leads.map((lead) => {
    const budget = formatBudgetRange(lead.budgetMin, lead.budgetMax);
    return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:500;">${escapeHtml(lead.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${escapeHtml(lead.phone || "-")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${escapeHtml(lead.propertyName || "-")}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${escapeHtml(budget || "-")}</td>
      </tr>`;
  }).join("");

  const html = `
    <div style="font-family:'Segoe UI',Tahoma,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:24px 30px;">
        <h1 style="color:#ffffff;margin:0;font-size:20px;">${leads.length} Lead${leads.length > 1 ? "s" : ""} Assigned to You</h1>
        <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;font-size:14px;">Bulk assignment${assignerName ? ` by ${escapeHtml(assignerName)}` : ""}</p>
      </div>
      <div style="padding:24px 30px;">
        <p style="color:#334155;margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(assignee.name)},</p>
        <p style="color:#475569;margin:0 0 20px;font-size:14px;line-height:1.5;">
          You have been assigned ${leads.length} new lead${leads.length > 1 ? "s" : ""}. Please review and follow up.
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Lead</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Phone</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Property</th>
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Budget</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:24px;text-align:center;">
          <a href="${ctaUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open Sales CRM</a>
        </div>
      </div>
      <div style="background:#f8fafc;padding:16px 30px;text-align:center;">
        <p style="color:#94a3b8;margin:0;font-size:12px;">Hsquare Living &mdash; Sales CRM</p>
      </div>
    </div>`;

  const cc = assignee.email.toLowerCase() === LEAD_OWNERSHIP_CC_EMAIL.toLowerCase()
    ? undefined
    : [LEAD_OWNERSHIP_CC_EMAIL];

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: assignee.email,
      ...(cc ? { cc } : {}),
      subject: `${leads.length} lead${leads.length > 1 ? "s" : ""} assigned to you`,
      html,
    });
    console.log(`[Email] Bulk lead assignment summary sent to ${assignee.email} (${leads.length} leads)${cc ? ` (cc ${cc.join(", ")})` : ""}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[Email] Failed to send bulk assignment summary to ${assignee.email}:`, error);
    return { success: false, error: error?.message || String(error) };
  }
}

interface BedReconciliationSummaryData {
  runAt: Date;
  totalCorrected: number;
  totalBedsScanned: number;
  perProperty: Array<{
    propertyId: string;
    propertyName: string;
    corrected: number;
    toAvailable: number;
    toOccupied: number;
    toReserved: number;
  }>;
}

function buildBedReconciliationSummaryHtml(data: BedReconciliationSummaryData, adminLink: string): string {
  const runAtFormatted = data.runAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });

  const rows = data.perProperty
    .sort((a, b) => b.corrected - a.corrected)
    .map((p) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;font-weight:600;">${p.propertyName}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:center;color:#0f172a;font-weight:700;">${p.corrected}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:center;color:#10b981;">${p.toAvailable}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:center;color:#ef4444;">${p.toOccupied}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:center;color:#f59e0b;">${p.toReserved}</td>
      </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Bed Status Reconciliation Summary</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Tahoma,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:32px 16px;">
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);padding:24px 28px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">Bed Status Reconciliation Summary</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,0.9);font-size:13px;">${runAtFormatted}</p>
      </div>
      <div style="padding:24px 28px;">
        <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.6;">
          The nightly bed status reconciliation job corrected
          <strong style="color:#0f172a;">${data.totalCorrected}</strong> bed${data.totalCorrected === 1 ? "" : "s"}
          across <strong style="color:#0f172a;">${data.perProperty.length}</strong> propert${data.perProperty.length === 1 ? "y" : "ies"}
          (scanned ${data.totalBedsScanned} bed${data.totalBedsScanned === 1 ? "" : "s"}).
        </p>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-top:8px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Property</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">Corrected</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">→ Available</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">→ Occupied</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#64748b;text-transform:uppercase;">→ Reserved</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="margin-top:24px;text-align:center;">
          <a href="${adminLink}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Open Floors, Rooms & Beds</a>
        </div>
        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;line-height:1.5;">
          Recurring drift in the same property may indicate a buggy HMS sync or stale booking states. If counts are unusually high, please investigate.
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBedReconciliationSummary(
  data: BedReconciliationSummaryData,
): Promise<{ success: boolean; error?: string; recipients?: number }> {
  if (data.totalCorrected <= 0 || data.perProperty.length === 0) {
    return { success: true, recipients: 0 };
  }

  const baseUrl = (process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || "https://hsquare.in";
  const adminLink = `${baseUrl}/admin/floors-beds`;

  let superadmins: Awaited<ReturnType<typeof storage.getUsersByRole>> = [];
  try {
    superadmins = await storage.getUsersByRole(["superadmin"]);
  } catch (err) {
    console.error("[BedReconcileSummary] Failed to fetch superadmins:", err);
    return { success: false, error: "Failed to fetch superadmins" };
  }

  if (superadmins.length === 0) {
    console.log("[BedReconcileSummary] No superadmins found; skipping summary delivery");
    return { success: true, recipients: 0 };
  }

  const subject = `Bed status: ${data.totalCorrected} correction${data.totalCorrected === 1 ? "" : "s"} across ${data.perProperty.length} propert${data.perProperty.length === 1 ? "y" : "ies"}`;
  const html = buildBedReconciliationSummaryHtml(data, adminLink);

  const propertyLine = data.perProperty
    .sort((a, b) => b.corrected - a.corrected)
    .slice(0, 5)
    .map((p) => `${p.propertyName}: ${p.corrected}`)
    .join(", ");
  const notificationMessage = `Corrected ${data.totalCorrected} bed${data.totalCorrected === 1 ? "" : "s"} across ${data.perProperty.length} propert${data.perProperty.length === 1 ? "y" : "ies"}${propertyLine ? ` (${propertyLine}${data.perProperty.length > 5 ? ", …" : ""})` : ""}.`;

  const recipientEmails = superadmins.map((u) => u.email).filter((e): e is string => !!e);

  if (recipientEmails.length > 0) {
    try {
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipientEmails,
        subject,
        html,
      });
      if (error) {
        console.error("[BedReconcileSummary] Resend error:", error);
      } else {
        console.log(`[BedReconcileSummary] Email sent to ${recipientEmails.length} superadmin(s)`);
      }
    } catch (err: any) {
      console.error("[BedReconcileSummary] Failed to send summary email:", err);
    }
  }

  for (const admin of superadmins) {
    try {
      await storage.createNotification({
        userId: admin.id,
        title: "Bed status reconciliation summary",
        message: notificationMessage,
        type: "info",
        actionUrl: "/admin/floors-beds",
      });
    } catch (err) {
      console.error(`[BedReconcileSummary] Failed to create notification for ${admin.id}:`, err);
    }
  }

  return { success: true, recipients: superadmins.length };
}

// ══════════════════════════════════════════════════════════════════════════════
// EMI REMINDER EMAIL (to parent/guardian — 1 day before installment due)
// ══════════════════════════════════════════════════════════════════════════════

export interface EmiReminderParams {
  parentName: string;
  parentEmail: string;
  residentName: string;
  propertyName: string;
  bookingCode: string;
  installmentName: string;
  amount: number;
  dueDate: string;
  remainingInstallments?: number;
}

function buildEmiReminderHtml(p: EmiReminderParams): string {
  const amountFormatted = `₹${p.amount.toLocaleString("en-IN")}`;
  const baseUrl = (process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || "https://hsquare.in";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EMI Due Tomorrow – Hsquare Living</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;letter-spacing:1px;">HSQUARE LIVING</h1>
              <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.85);letter-spacing:2px;text-transform:uppercase;">Harmony in Living</p>
            </td>
          </tr>

          <!-- Alert Badge -->
          <tr>
            <td style="background-color:#111111;padding:32px 40px 24px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(217,119,6,0.1));border:1px solid rgba(245,158,11,0.35);border-radius:50px;padding:10px 28px;margin-bottom:16px;">
                <span style="color:#f59e0b;font-size:14px;font-weight:600;letter-spacing:0.5px;">&#9888; PAYMENT DUE TOMORROW</span>
              </div>
              <h2 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#ffffff;">Dear ${p.parentName},</h2>
              <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">This is a friendly reminder that the next instalment for <strong style="color:#ffffff;">${p.residentName}</strong>'s accommodation at <strong style="color:#ffffff;">${p.propertyName}</strong> is due <strong style="color:#f59e0b;">tomorrow</strong>.</p>
            </td>
          </tr>

          <!-- Instalment Details -->
          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.2);border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:20px 24px 12px;">
                    <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Instalment Due</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 24px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Booking ID</span><br>
                          <span style="color:#f59e0b;font-size:15px;font-weight:700;">${p.bookingCode}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Resident</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${p.residentName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Property</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${p.propertyName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Instalment</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${p.installmentName}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Due Date</span><br>
                          <span style="color:#ffffff;font-size:15px;font-weight:600;">${p.dueDate}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 0 4px;">
                          <span style="color:rgba(255,255,255,0.5);font-size:13px;">Amount Due</span><br>
                          <span style="color:#10b981;font-size:26px;font-weight:800;">${amountFormatted}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="background-color:#111111;padding:0 40px 32px;text-align:center;">
              <a href="${baseUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#f59e0b 0%,#d97706 100%);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:0.5px;">Pay Now on Portal</a>
              <p style="margin:14px 0 0;font-size:13px;color:rgba(255,255,255,0.35);">Timely payment avoids late fees and keeps ${p.residentName}'s booking in good standing.</p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0d0d0d;border-top:1px solid rgba(255,255,255,0.06);border-radius:0 0 16px 16px;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);">Questions? Contact us at</p>
              <a href="mailto:support@hsquareliving.com" style="color:#f59e0b;font-size:14px;font-weight:600;text-decoration:none;">support@hsquareliving.com</a>
              <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.06);">
                <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.5;">
                  Hsquareliving Pvt Ltd · Mumbai, India<br>
                  This is an automated reminder. Please do not reply directly to this message.
                </p>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmiReminderToParent(
  params: EmiReminderParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = buildEmiReminderHtml(params);
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.parentEmail,
      subject: `EMI Due Tomorrow – ${params.installmentName} (${params.bookingCode}) | Hsquare Living`,
      html,
    });
    if (error) {
      console.error(`[Email] EMI reminder failed for ${params.bookingCode}:`, error);
      return { success: false, error: error.message || "Email send failed" };
    }
    console.log(`[Email] EMI reminder sent to ${params.parentEmail} for ${params.bookingCode} (${data?.id})`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Email] EMI reminder error:`, err);
    return { success: false, error: err.message || "Unexpected error" };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CANCELLATION EMAILS
// ══════════════════════════════════════════════════════════════════════════════

function formatCurrency(amount: number) {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function cancellationEmailWrapper(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <span style="color:#c5a059;font-size:22px;font-weight:700;letter-spacing:1px;">HSQUARE LIVING</span>
          </td>
        </tr>
        <tr><td style="padding:32px;">${body}</td></tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Hsquare Living Pvt Ltd · noreply@hsquarehostels.com</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Student receives email when their cancellation request is received */
export async function sendCancellationRequestReceivedEmail(booking: any, cancelReq: any, estimate: any) {
  try {
    const student = booking.studentId ? await storage.getStudent(booking.studentId) : null;
    const studentEmail = student?.email || booking.walkInEmail;
    if (!studentEmail) return;
    const studentName = student?.fullName || booking.walkInName || "Resident";
    const refundable = estimate?.refundable ?? 0;

    const body = `
      <h2 style="margin-top:0;color:#0f172a;">Cancellation Request Received</h2>
      <p style="color:#475569;">Hi ${studentName},</p>
      <p style="color:#475569;">We have received your request to cancel booking <strong>${booking.bookingCode}</strong>. Our team will review it within 2-3 business days.</p>
      <table cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;width:100%;margin:20px 0;">
        <tr><td style="color:#64748b;width:50%;">Booking Code</td><td style="font-weight:600;">${booking.bookingCode}</td></tr>
        <tr><td style="color:#64748b;">Your Reason</td><td style="font-weight:600;">${cancelReq.reason}</td></tr>
        <tr><td style="color:#64748b;">Estimated Refund</td><td style="font-weight:600;color:#16a34a;">${formatCurrency(refundable)}</td></tr>
        <tr><td style="color:#64748b;">Policy Applied</td><td style="font-weight:600;">${estimate?.policyLabel || "Standard Policy"}</td></tr>
      </table>
      <p style="color:#64748b;font-size:14px;">The final refund amount may be adjusted during review. You will be notified once a decision is made.</p>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: studentEmail,
      subject: `Cancellation Request Received — ${booking.bookingCode}`,
      html: cancellationEmailWrapper("Cancellation Request Received", body),
    });
  } catch (err) {
    console.error("[sendCancellationRequestReceivedEmail]", err);
  }
}

/** Admin receives alert when a student submits a cancellation request */
export async function sendAdminCancellationAlertEmail(booking: any, cancelReq: any, estimate: any) {
  try {
    const admins = await storage.getUsersByRole(["admin", "superadmin"]);
    const adminEmails = admins.map(a => a.email).filter(Boolean) as string[];
    if (!adminEmails.length) return;

    const student = booking.studentId ? await storage.getStudent(booking.studentId) : null;
    const studentName = student?.fullName || booking.walkInName || "Walk-in";
    const property = booking.propertyId ? await storage.getProperty(booking.propertyId) : null;

    const body = `
      <h2 style="margin-top:0;color:#0f172a;">New Cancellation Request</h2>
      <p style="color:#475569;">A student has submitted a cancellation request. Please review it in the admin panel.</p>
      <table cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;width:100%;margin:20px 0;">
        <tr><td style="color:#64748b;width:50%;">Booking Code</td><td style="font-weight:600;">${booking.bookingCode}</td></tr>
        <tr><td style="color:#64748b;">Student</td><td style="font-weight:600;">${studentName}</td></tr>
        <tr><td style="color:#64748b;">Property</td><td style="font-weight:600;">${property?.name || "—"}</td></tr>
        <tr><td style="color:#64748b;">Reason</td><td style="font-weight:600;">${cancelReq.reason}</td></tr>
        <tr><td style="color:#64748b;">Estimated Refund</td><td style="font-weight:600;color:#16a34a;">${formatCurrency(estimate?.refundable ?? 0)}</td></tr>
      </table>
      <p style="text-align:center;margin-top:28px;"><a href="${(process.env.APP_PUBLIC_URL || "https://hsquare.in").replace(/\/$/, "")}/admin/completed-bookings?tab=cancellations" style="background:#0f172a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;">Review Request</a></p>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmails[0],
      ...(adminEmails.length > 1 ? { cc: adminEmails.slice(1) } : {}),
      subject: `Cancellation Request — ${booking.bookingCode} (${studentName})`,
      html: cancellationEmailWrapper("New Cancellation Request", body),
    });
  } catch (err) {
    console.error("[sendAdminCancellationAlertEmail]", err);
  }
}

/** Student receives email when admin cancels their booking directly */
export async function sendAdminInitiatedCancellationEmail(booking: any, cancelReq: any, estimate: any, refundAmount: number) {
  try {
    const student = booking.studentId ? await storage.getStudent(booking.studentId) : null;
    const studentEmail = student?.email || booking.walkInEmail;
    if (!studentEmail) return;
    const studentName = student?.fullName || booking.walkInName || "Resident";

    const body = `
      <h2 style="margin-top:0;color:#0f172a;">Your Booking Has Been Cancelled</h2>
      <p style="color:#475569;">Hi ${studentName},</p>
      <p style="color:#475569;">Your booking <strong>${booking.bookingCode}</strong> has been cancelled by our team. We regret the inconvenience.</p>
      <table cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;width:100%;margin:20px 0;">
        <tr><td style="color:#64748b;width:50%;">Booking Code</td><td style="font-weight:600;">${booking.bookingCode}</td></tr>
        <tr><td style="color:#64748b;">Reason</td><td style="font-weight:600;">${cancelReq.reason}</td></tr>
        <tr><td style="color:#64748b;">Refund Amount</td><td style="font-weight:600;color:#16a34a;">${formatCurrency(refundAmount)}</td></tr>
      </table>
      ${refundAmount > 0 ? '<p style="color:#475569;">Your refund will be processed within 5-7 business days.</p>' : '<p style="color:#475569;">Unfortunately, no refund is applicable per our cancellation policy.</p>'}
      <p style="color:#475569;">If you have questions, please contact our support team.</p>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: studentEmail,
      subject: `Booking Cancelled — ${booking.bookingCode}`,
      html: cancellationEmailWrapper("Booking Cancelled", body),
    });
  } catch (err) {
    console.error("[sendAdminInitiatedCancellationEmail]", err);
  }
}

/** Student receives email when admin approves their cancellation request */
export async function sendCancellationApprovedEmail(booking: any, cancelReq: any, refundAmount: number) {
  try {
    const student = booking.studentId ? await storage.getStudent(booking.studentId) : null;
    const studentEmail = student?.email || booking.walkInEmail;
    if (!studentEmail) return;
    const studentName = student?.fullName || booking.walkInName || "Resident";

    const body = `
      <h2 style="margin-top:0;color:#0f172a;">Cancellation Approved</h2>
      <p style="color:#475569;">Hi ${studentName},</p>
      <p style="color:#475569;">Your cancellation request for booking <strong>${booking.bookingCode}</strong> has been <strong style="color:#16a34a;">approved</strong>.</p>
      <table cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;width:100%;margin:20px 0;">
        <tr><td style="color:#64748b;width:50%;">Booking Code</td><td style="font-weight:600;">${booking.bookingCode}</td></tr>
        <tr><td style="color:#64748b;">Refund Amount</td><td style="font-weight:600;color:#16a34a;">${formatCurrency(refundAmount)}</td></tr>
      </table>
      ${refundAmount > 0 ? '<p style="color:#475569;">Your refund will be credited within 5-7 business days. Please ensure your bank details are updated in our records.</p>' : '<p style="color:#475569;">No refund is applicable per our cancellation policy for this booking.</p>'}`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: studentEmail,
      subject: `Cancellation Approved — ${booking.bookingCode}`,
      html: cancellationEmailWrapper("Cancellation Approved", body),
    });
  } catch (err) {
    console.error("[sendCancellationApprovedEmail]", err);
  }
}

/** Student receives email when admin marks the refund as physically sent */
export async function sendRefundSentEmail(booking: any, cancelReq: any, refundAmount: number, note?: string) {
  try {
    const student = booking.studentId ? await storage.getStudent(booking.studentId) : null;
    const studentEmail = student?.email || booking.walkInEmail;
    if (!studentEmail) return;
    const studentName = student?.fullName || booking.walkInName || "Resident";

    const body = `
      <h2 style="margin-top:0;color:#0f172a;">Refund Transferred</h2>
      <p style="color:#475569;">Hi ${studentName},</p>
      <p style="color:#475569;">Great news! Your refund for booking <strong>${booking.bookingCode}</strong> has been transferred to you.</p>
      <table cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;width:100%;margin:20px 0;">
        <tr><td style="color:#64748b;width:50%;">Booking Code</td><td style="font-weight:600;">${booking.bookingCode}</td></tr>
        <tr><td style="color:#64748b;">Refund Amount</td><td style="font-weight:600;color:#16a34a;">${formatCurrency(refundAmount)}</td></tr>
        ${note ? `<tr><td style="color:#64748b;">Note</td><td style="font-weight:600;">${note}</td></tr>` : ""}
      </table>
      <p style="color:#475569;">Please allow 1-3 business days for the amount to reflect in your account. If you have not received it within this time, please contact our support team.</p>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: studentEmail,
      subject: `Refund Transferred — ${booking.bookingCode}`,
      html: cancellationEmailWrapper("Refund Transferred", body),
    });
  } catch (err) {
    console.error("[sendRefundSentEmail]", err);
  }
}

/** Student receives email when admin rejects their cancellation request */
export async function sendCancellationRejectedEmail(booking: any, cancelReq: any, rejectionReason: string) {
  try {
    const student = booking.studentId ? await storage.getStudent(booking.studentId) : null;
    const studentEmail = student?.email || booking.walkInEmail;
    if (!studentEmail) return;
    const studentName = student?.fullName || booking.walkInName || "Resident";

    const body = `
      <h2 style="margin-top:0;color:#0f172a;">Cancellation Request Rejected</h2>
      <p style="color:#475569;">Hi ${studentName},</p>
      <p style="color:#475569;">We have reviewed your cancellation request for booking <strong>${booking.bookingCode}</strong> and unfortunately it has been <strong style="color:#dc2626;">rejected</strong>.</p>
      <table cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;width:100%;margin:20px 0;">
        <tr><td style="color:#64748b;width:50%;">Booking Code</td><td style="font-weight:600;">${booking.bookingCode}</td></tr>
        <tr><td style="color:#64748b;">Reason for Rejection</td><td style="font-weight:600;">${rejectionReason}</td></tr>
      </table>
      <p style="color:#475569;">Your booking remains active. If you believe this decision is incorrect, please contact our support team.</p>`;

    await resend.emails.send({
      from: FROM_EMAIL,
      to: studentEmail,
      subject: `Cancellation Request Rejected — ${booking.bookingCode}`,
      html: cancellationEmailWrapper("Cancellation Request Rejected", body),
    });
  } catch (err) {
    console.error("[sendCancellationRejectedEmail]", err);
  }
}
