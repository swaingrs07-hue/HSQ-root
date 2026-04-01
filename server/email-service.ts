import { Resend } from "resend";
import crypto from "crypto";
import { storage } from "./storage";
import { logActivity } from "./activityLogger";
import { generateBookingReceiptPdf } from "./receipt-pdf";
import type { Booking } from "@shared/schema";

function generateReceiptToken(bookingId: string): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET || "hsquareliving-dev-secret-key-for-development-only";
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
  amountPaid: string;
  receiptUrl: string;
  installments: InstallmentInfo[];
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
      amountPaid,
      receiptUrl,
      installments,
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
                          <a href="${data.baseUrl}/download/android" target="_blank" style="display:block;text-align:center;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;text-decoration:none;padding:12px 16px;border-radius:10px;font-size:14px;font-weight:700;">&#9660; Android</a>
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
