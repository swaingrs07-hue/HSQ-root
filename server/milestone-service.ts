import { Resend } from "resend";
import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = "Hsquare Living <booking@hsquarehostels.com>";

interface MilestoneMessages {
  headlines: string[];
  bodies: string[];
  emoji: string;
  accentColor: string;
  badgeText: string;
}

const BOOKING_MILESTONES: Record<number, MilestoneMessages> = {
  100: {
    headlines: [
      "Century Unlocked!",
      "The First Hundred — A Golden Start",
      "100 Lives, One Vision",
      "Triple Digits Achieved!",
      "The Centennial Milestone",
      "100 Dreams Under One Roof",
    ],
    bodies: [
      "A hundred students have chosen Hsquare Living — a testament to the trust, quality, and community you've built. This is just the beginning of an extraordinary journey.",
      "From zero to one hundred — every booking represents a life transformed, a dream supported. Your dedication to excellence has made this possible.",
      "One hundred bookings. One hundred stories. One hundred reasons to celebrate. The foundation of something truly remarkable has been laid.",
    ],
    emoji: "🏆",
    accentColor: "#f59e0b",
    badgeText: "CENTURY MILESTONE",
  },
  200: {
    headlines: [
      "Double Century!",
      "200 Strong — Unstoppable Momentum",
      "The 200 Club — Elite Territory",
      "Two Hundred & Counting",
      "200 Residents, Infinite Possibilities",
      "Twice the Century, Twice the Impact",
    ],
    bodies: [
      "Two hundred bookings — your property has entered elite territory. This momentum is a reflection of relentless commitment to student living excellence.",
      "Double century achieved! Every room tells a story, every resident is a testament to the premium experience you deliver day after day.",
      "200 bookings strong. The word is spreading, the reputation is growing, and the community you've built is thriving beyond expectations.",
    ],
    emoji: "⚡",
    accentColor: "#8b5cf6",
    badgeText: "DOUBLE CENTURY",
  },
  300: {
    headlines: [
      "Triple Crown Achievement!",
      "300 Lives Transformed",
      "The 300 — Legendary Status",
      "Three Hundred Milestones of Excellence",
      "300 Bookings — A Legacy in the Making",
      "The Spartan Milestone — 300 Strong",
    ],
    bodies: [
      "Three hundred bookings — this isn't just a number, it's a legacy. Your property stands as a beacon of premium student accommodation in the city.",
      "300 students have found their home with you. That's 300 families who trusted Hsquare Living with their most precious — and you delivered.",
      "From the first booking to the 300th, the journey has been nothing short of extraordinary. This milestone cements your position at the very top.",
    ],
    emoji: "👑",
    accentColor: "#ec4899",
    badgeText: "TRIPLE CROWN",
  },
  400: {
    headlines: [
      "400 — The Powerhouse Milestone!",
      "Four Hundred & Fearless",
      "Quadruple Century — Unmatched Excellence",
      "400 Bookings — Redefining Hospitality",
      "The 400 Mark — Beyond Extraordinary",
    ],
    bodies: [
      "Four hundred bookings — a feat that puts your property in a league of its own. The standards you've set are being spoken about across the student community.",
      "400 students, 400 success stories. Your property has become synonymous with premium student living. The impact you're making is immeasurable.",
    ],
    emoji: "🔥",
    accentColor: "#ef4444",
    badgeText: "POWERHOUSE MILESTONE",
  },
  500: {
    headlines: [
      "Half a Thousand — Legendary!",
      "500 — The Gold Standard",
      "Five Hundred Bookings of Brilliance",
      "The 500 Club — True Excellence",
      "Half a Millennium of Bookings!",
    ],
    bodies: [
      "Five hundred bookings — half a thousand lives enriched. Your property has achieved what very few ever do. This is the gold standard of student accommodation.",
      "500 bookings. Let that sink in. Five hundred students chose your property as their home. This is the definition of market dominance.",
    ],
    emoji: "💎",
    accentColor: "#06b6d4",
    badgeText: "HALF-THOUSAND LEGEND",
  },
};

const OCCUPANCY_MILESTONE: MilestoneMessages = {
  headlines: [
    "Near Full House!",
    "99% Occupancy — Maximum Capacity Imminent!",
    "Almost Sold Out — Demand at Its Peak!",
    "Standing Room Only!",
    "The Final Beds — Going, Going...",
    "Premium Demand — 99% Occupied!",
  ],
  bodies: [
    "Your property has reached 99%+ occupancy — a clear signal that demand for Hsquare Living is at an all-time high. Consider expansion planning.",
    "Nearly every bed is booked. This extraordinary demand validates the premium experience you deliver. Time to think about what's next.",
    "99% occupancy means your property is the most sought-after student accommodation in the area. The market has spoken — Hsquare Living is the gold standard.",
  ],
  emoji: "🏠",
  accentColor: "#10b981",
  badgeText: "NEAR-FULL HOUSE",
};

function getDefaultMilestoneMessages(value: number): MilestoneMessages {
  const hundreds = Math.floor(value / 100) * 100;
  return {
    headlines: [
      `${value} Bookings — Another Milestone Conquered!`,
      `${value} & Counting — The Journey Continues!`,
      `${value} Residents Strong!`,
    ],
    bodies: [
      `${value} bookings achieved! Every milestone is a testament to the exceptional standards you maintain. Onward and upward!`,
      `Your property has reached ${value} bookings — a remarkable achievement that showcases the growing demand for Hsquare Living.`,
    ],
    emoji: "🎯",
    accentColor: "#f59e0b",
    badgeText: `${hundreds}+ MILESTONE`,
  };
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildMilestoneEmailHtml(data: {
  propertyName: string;
  milestoneType: "booking_count" | "occupancy_percent";
  milestoneValue: number;
  totalBookings: number;
  occupancyPercent: number;
  totalBeds: number;
  messages: MilestoneMessages;
}): string {
  const headline = escapeHtml(pickRandom(data.messages.headlines));
  const body = escapeHtml(pickRandom(data.messages.bodies));
  const accent = data.messages.accentColor;
  const emoji = data.messages.emoji;
  const badge = data.messages.badgeText;
  data.propertyName = escapeHtml(data.propertyName);

  const milestoneNumber = data.milestoneType === "booking_count"
    ? data.milestoneValue.toString()
    : `${data.occupancyPercent}%`;

  const nextMilestone = data.milestoneType === "booking_count"
    ? `${data.milestoneValue + 100} bookings`
    : "100% Full House";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Milestone Celebration - Hsquare Living</title>
  <style>
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 20px ${accent}40, 0 0 40px ${accent}20; }
      50% { box-shadow: 0 0 40px ${accent}60, 0 0 80px ${accent}30; }
    }
    @keyframes float-up {
      0% { transform: translateY(10px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }
    @keyframes border-dance {
      0% { border-color: ${accent}40; }
      25% { border-color: ${accent}80; }
      50% { border-color: ${accent}40; }
      75% { border-color: ${accent}60; }
      100% { border-color: ${accent}40; }
    }
    @keyframes confetti-fall-1 { 0% { transform: translateY(-20px) rotate(0deg); opacity: 1; } 100% { transform: translateY(60px) rotate(360deg); opacity: 0; } }
    @keyframes confetti-fall-2 { 0% { transform: translateY(-10px) rotate(0deg); opacity: 1; } 100% { transform: translateY(50px) rotate(-270deg); opacity: 0; } }
    @keyframes confetti-fall-3 { 0% { transform: translateY(-15px) rotate(45deg); opacity: 1; } 100% { transform: translateY(55px) rotate(405deg); opacity: 0; } }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#050505;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#050505;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

          <!-- Confetti decorations -->
          <tr>
            <td style="height:40px;position:relative;overflow:hidden;">
              <div style="position:absolute;left:10%;top:0;width:8px;height:8px;background:${accent};border-radius:50%;animation:confetti-fall-1 2s ease-in-out infinite;"></div>
              <div style="position:absolute;left:30%;top:5px;width:6px;height:6px;background:#f59e0b;border-radius:2px;animation:confetti-fall-2 2.5s ease-in-out infinite 0.3s;"></div>
              <div style="position:absolute;left:50%;top:0;width:10px;height:4px;background:#ec4899;border-radius:1px;animation:confetti-fall-3 1.8s ease-in-out infinite 0.6s;"></div>
              <div style="position:absolute;left:70%;top:8px;width:6px;height:6px;background:#8b5cf6;border-radius:50%;animation:confetti-fall-1 2.2s ease-in-out infinite 0.9s;"></div>
              <div style="position:absolute;left:90%;top:0;width:8px;height:4px;background:#06b6d4;border-radius:1px;animation:confetti-fall-2 2s ease-in-out infinite 0.4s;"></div>
            </td>
          </tr>

          <!-- Header with gradient -->
          <tr>
            <td style="background:linear-gradient(135deg,${accent} 0%,${accent}cc 50%,${accent}99 100%);border-radius:20px 20px 0 0;padding:36px 44px;text-align:center;position:relative;overflow:hidden;">
              <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(45deg,transparent 30%,rgba(255,255,255,0.1) 50%,transparent 70%);background-size:200% 100%;animation:shimmer 3s ease-in-out infinite;"></div>
              <h1 style="margin:0;font-size:30px;font-weight:900;color:#ffffff;letter-spacing:2px;text-transform:uppercase;position:relative;">HSQUARE LIVING</h1>
              <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.9);letter-spacing:3px;text-transform:uppercase;position:relative;">Harmony in Living</p>
            </td>
          </tr>

          <!-- Milestone Badge -->
          <tr>
            <td style="background-color:#0a0a0a;padding:40px 44px 20px;text-align:center;">
              <div style="display:inline-block;background:linear-gradient(135deg,${accent}20,${accent}10);border:2px solid ${accent}50;border-radius:50px;padding:10px 32px;animation:border-dance 3s ease-in-out infinite;">
                <span style="color:${accent};font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">${emoji} ${badge}</span>
              </div>
            </td>
          </tr>

          <!-- Giant Milestone Number -->
          <tr>
            <td style="background-color:#0a0a0a;padding:10px 44px 10px;text-align:center;">
              <div style="display:inline-block;animation:pulse-glow 2s ease-in-out infinite;border-radius:24px;padding:20px 40px;">
                <span style="font-size:80px;font-weight:900;background:linear-gradient(135deg,${accent},#ffffff,${accent});-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;background-size:200% auto;animation:shimmer 3s linear infinite;letter-spacing:2px;line-height:1;">${milestoneNumber}</span>
              </div>
              <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:3px;font-weight:600;">${data.milestoneType === "booking_count" ? "Bookings Achieved" : "Occupancy Rate"}</p>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="background-color:#0a0a0a;padding:24px 44px 12px;text-align:center;">
              <h2 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.3;letter-spacing:0.5px;">${headline}</h2>
            </td>
          </tr>

          <!-- Property Name -->
          <tr>
            <td style="background-color:#0a0a0a;padding:0 44px 24px;text-align:center;">
              <div style="display:inline-block;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 24px;">
                <span style="color:rgba(255,255,255,0.5);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">Property</span>
                <br>
                <span style="color:#ffffff;font-size:17px;font-weight:700;">${data.propertyName}</span>
              </div>
            </td>
          </tr>

          <!-- Body Message -->
          <tr>
            <td style="background-color:#0a0a0a;padding:0 44px 32px;text-align:center;">
              <p style="margin:0;font-size:16px;color:rgba(255,255,255,0.65);line-height:1.8;max-width:500px;display:inline-block;">${body}</p>
            </td>
          </tr>

          <!-- Stats Cards -->
          <tr>
            <td style="background-color:#0a0a0a;padding:0 44px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48%" style="background:linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px 20px;text-align:center;animation:float-up 0.6s ease-out;">
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px;font-weight:600;">Total Bookings</p>
                    <p style="margin:8px 0 0;font-size:36px;font-weight:900;color:${accent};letter-spacing:1px;">${data.totalBookings}</p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:linear-gradient(135deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px 20px;text-align:center;animation:float-up 0.6s ease-out 0.2s;">
                    <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:2px;font-weight:600;">Occupancy</p>
                    <p style="margin:8px 0 0;font-size:36px;font-weight:900;color:#10b981;letter-spacing:1px;">${data.occupancyPercent}%</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Capacity Bar -->
          <tr>
            <td style="background-color:#0a0a0a;padding:0 44px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px 24px;">
                <tr>
                  <td>
                    <p style="margin:0 0 12px;font-size:12px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Bed Capacity</p>
                    <div style="background:rgba(255,255,255,0.06);border-radius:8px;height:12px;overflow:hidden;">
                      <div style="background:linear-gradient(90deg,${accent},#10b981);width:${Math.min(data.occupancyPercent, 100)}%;height:100%;border-radius:8px;"></div>
                    </div>
                    <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.5);">
                      <span style="color:#ffffff;font-weight:700;">${data.totalBeds - Math.round(data.totalBeds * (1 - data.occupancyPercent / 100))}</span> of <span style="color:#ffffff;font-weight:700;">${data.totalBeds}</span> beds occupied
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Next Milestone -->
          <tr>
            <td style="background-color:#0a0a0a;padding:0 44px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,${accent}10,${accent}05);border:1px solid ${accent}25;border-radius:14px;">
                <tr>
                  <td style="padding:24px 28px;text-align:center;">
                    <p style="margin:0;font-size:12px;color:${accent};text-transform:uppercase;letter-spacing:2px;font-weight:700;">Next Milestone</p>
                    <p style="margin:8px 0 0;font-size:22px;font-weight:800;color:#ffffff;">${nextMilestone}</p>
                    <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.4);">Keep the momentum going — every booking counts!</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#070707;border-top:1px solid rgba(255,255,255,0.06);border-radius:0 0 20px 20px;padding:28px 44px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:rgba(255,255,255,0.35);">This is an automated milestone notification</p>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.6;">
                Hsquareliving Pvt Ltd &middot; Mumbai, India<br>
                Sent exclusively to Hsquare Living administrators
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function checkAndSendMilestone(propertyId: string): Promise<void> {
  try {
    const [bookingCountResult] = await db.select({
      count: sql<number>`count(*)::int`,
    }).from(schema.bookings).where(
      and(
        eq(schema.bookings.propertyId, propertyId),
        inArray(schema.bookings.status, ["confirmed", "active", "completed"])
      )
    );
    const totalBookings = bookingCountResult?.count || 0;

    const property = await db.select().from(schema.properties).where(eq(schema.properties.id, propertyId));
    if (!property.length) return;
    const propertyName = property[0].name;

    const roomTypesList = await db.select().from(schema.roomTypes).where(eq(schema.roomTypes.propertyId, propertyId));
    const totalBeds = roomTypesList.reduce((sum, rt) => sum + (rt.totalBeds || 0), 0);
    const availableBeds = roomTypesList.reduce((sum, rt) => sum + (rt.availableBeds || 0), 0);
    const occupiedBeds = totalBeds - availableBeds;
    const occupancyPercent = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    const milestonesToCheck: { type: "booking_count" | "occupancy_percent"; value: number }[] = [];

    const bookingMilestone = Math.floor(totalBookings / 100) * 100;
    if (bookingMilestone >= 100) {
      milestonesToCheck.push({ type: "booking_count", value: bookingMilestone });
    }

    if (occupancyPercent >= 99 && totalBeds > 0) {
      milestonesToCheck.push({ type: "occupancy_percent", value: 99 });
    }

    if (milestonesToCheck.length === 0) return;

    const adminUsers = await db.select().from(schema.users).where(eq(schema.users.role, "admin"));
    if (adminUsers.length === 0) return;
    const adminEmails = adminUsers.map(u => u.email).filter(Boolean);
    if (adminEmails.length === 0) return;

    for (const milestone of milestonesToCheck) {
      const existing = await db.select().from(schema.propertyMilestones).where(
        and(
          eq(schema.propertyMilestones.propertyId, propertyId),
          eq(schema.propertyMilestones.milestoneType, milestone.type),
          eq(schema.propertyMilestones.milestoneValue, milestone.value)
        )
      );

      if (existing.length > 0) continue;

      const messages = milestone.type === "occupancy_percent"
        ? OCCUPANCY_MILESTONE
        : (BOOKING_MILESTONES[milestone.value] || getDefaultMilestoneMessages(milestone.value));

      const html = buildMilestoneEmailHtml({
        propertyName,
        milestoneType: milestone.type,
        milestoneValue: milestone.value,
        totalBookings,
        occupancyPercent,
        totalBeds,
        messages,
      });

      const subject = milestone.type === "booking_count"
        ? `${messages.emoji} ${milestone.value} Bookings — ${propertyName} | Hsquare Living`
        : `${messages.emoji} ${occupancyPercent}% Occupancy — ${propertyName} | Hsquare Living`;

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: adminEmails,
          subject,
          html,
        });
        console.log(`[Milestone] Sent ${milestone.type}=${milestone.value} email for ${propertyName} to ${adminEmails.length} admin(s)`);
      } catch (emailErr) {
        console.error(`[Milestone] Failed to send email for ${propertyName}:`, emailErr);
        continue;
      }

      try {
        await db.insert(schema.propertyMilestones).values({
          propertyId,
          milestoneType: milestone.type,
          milestoneValue: milestone.value,
          totalBookings,
          occupancyPercent,
        });
      } catch (insertErr: any) {
        if (insertErr?.code === "23505") {
          console.log(`[Milestone] Duplicate detected for ${propertyName} ${milestone.type}=${milestone.value}, skipping`);
          continue;
        }
        throw insertErr;
      }
    }
  } catch (err) {
    console.error("[Milestone] Error checking milestones:", err);
  }
}
