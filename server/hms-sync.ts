const PROPERTY_CODE_MAP: Record<string, string> = {
  "hsquare hostel juhu": "HSQ-MUM-01",
  "hsquare juhu": "HSQ-MUM-01",
  "hsquare hostel goregaon": "HSQ-MUM-02",
  "hsquare goregaon": "HSQ-MUM-02",
  "hsquare bayview": "HSQ-MUM-03",
  "hsquare hostel bayview": "HSQ-MUM-03",
  "hsquare bay view": "HSQ-MUM-03",
  "hsquare caledonia": "HSQ-MUM-04",
  "hsquare hostel caledonia": "HSQ-MUM-04",
};

const KEYWORD_MAP: Record<string, string> = {
  "juhu": "HSQ-MUM-01",
  "goregaon": "HSQ-MUM-02",
  "bayview": "HSQ-MUM-03",
  "bay view": "HSQ-MUM-03",
  "caledonia": "HSQ-MUM-04",
};

export function getPropertyCode(propertyName: string): string | null {
  if (!propertyName) return null;
  const lower = propertyName.toLowerCase().trim();

  const exact = PROPERTY_CODE_MAP[lower];
  if (exact) return exact;

  for (const [keyword, code] of Object.entries(KEYWORD_MAP)) {
    if (lower.includes(keyword)) return code;
  }

  console.warn(`[hms-sync] Unknown property name "${propertyName}" — cannot determine property code, skipping sync`);
  return null;
}

export function resolvePublicUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const baseUrl = (process.env.APP_PUBLIC_URL?.replace(/\/$/, "")) || "https://hsquare.in";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

// Map our internal meal names to HMS-expected names
const MEAL_NAME_MAP: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  evening_snacks: "Snacks",
  dinner: "Dinner",
};

/**
 * Derives HMS meal plan fields from a booking's effective services array.
 * Uses the meals service schedule to build mealPlan (tier string) and
 * allowedMeals (union of all meals across all days, mapped to HMS names).
 *
 * Returns an empty object if no active meals service is found.
 */
export function buildHmsMealFields(services: any[]): { mealPlan?: string; allowedMeals?: string[] } {
  if (!Array.isArray(services) || services.length === 0) return {};

  const mealsSvc = services.find((s: any) => s.type === "meals" && s.excluded !== true);
  if (!mealsSvc) return {};

  const schedule = mealsSvc.schedule as Record<string, { count?: number; meals?: string[] }> | null | undefined;
  if (!schedule || typeof schedule !== "object") return {};

  // Derive mealPlan tier from weekday count (fall back to max count across all days)
  const weekdayCount = schedule.weekday?.count;
  const allCounts = Object.values(schedule).map(d => d?.count ?? 0);
  const maxCount = allCounts.length > 0 ? Math.max(...allCounts) : 0;
  const tierCount = weekdayCount ?? maxCount;

  let mealPlan: string | undefined;
  if (tierCount >= 4) mealPlan = "4-meal";
  else if (tierCount === 3) mealPlan = "3-meal";
  else if (tierCount === 2) mealPlan = "2-meal";

  // Build allowedMeals as union of all meals across all day schedules
  const mealSet = new Set<string>();
  for (const daySchedule of Object.values(schedule)) {
    if (Array.isArray(daySchedule?.meals)) {
      for (const meal of daySchedule.meals) {
        const mapped = MEAL_NAME_MAP[meal as string];
        if (mapped) mealSet.add(mapped);
      }
    }
  }
  const allowedMeals = mealSet.size > 0 ? Array.from(mealSet) : undefined;

  return { mealPlan, allowedMeals };
}

interface HMSSyncData {
  name: string;
  email?: string;
  phone: string;
  room: string;
  propertyCode: string;
  dietary?: string;
  college?: string;
  instituteName?: string;
  courseName?: string;
  courseYear?: string;
  moveInDate?: string;
  checkOutDate?: string;
  accommodationType?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  parentRelation?: string;
  homeAddress?: string;
  gender?: string;
  dateOfBirth?: string;
  studentEmail?: string;
  bookingDate?: string;
  accessLevel?: string;
  idProofUrl?: string;
  photoUrl?: string;
  documentUrls?: string[];
  // Meal plan fields (HMS /sync/create-resident)
  mealPlan?: string;
  allowedMeals?: string[];
}

export interface HMSCancelData {
  phone: string;
  propertyCode: string;
  reason?: string;
  cancelledAt: string;
  refundAmount: number;
  refundStatus: "pending" | "processed";
  totalPaid: number;
}

export async function cancelResidentOnHMS(data: HMSCancelData): Promise<{
  success: boolean;
  notAvailable?: boolean;
  error?: string;
}> {
  const hmsUrl = process.env.HMS_API_URL;
  const hmsApiKey = process.env.HMS_API_KEY;

  if (!hmsUrl || !hmsApiKey) {
    console.error("[hms-sync] HMS_API_URL or HMS_API_KEY not configured");
    return { success: false, error: "HMS not configured" };
  }

  try {
    const response = await fetch(`${hmsUrl.replace(/\/+$/, "")}/sync/cancel-resident`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hmsApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 404 || response.status === 405) {
      console.warn(`[hms-sync] HMS cancel endpoint not yet available (${response.status}) — skipping cancel-resident sync`);
      return { success: false, notAvailable: true };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[hms-sync] HMS cancel-resident returned ${response.status}: ${text.substring(0, 300)}`);
      return { success: false, error: `HMS returned ${response.status}` };
    }

    const result = await response.json().catch(() => ({}));
    console.log(`[hms-sync] Sent cancel-resident to HMS for phone ${data.phone}: refund ₹${data.refundAmount} (${data.refundStatus})`);
    return { success: true };
  } catch (error: any) {
    console.error(`[hms-sync] Failed to send cancel-resident:`, error.message);
    return { success: false, error: error.message };
  }
}

export async function syncBookingToHMS(bookingData: HMSSyncData): Promise<{
  success: boolean;
  action?: "created" | "updated";
  error?: string;
}> {
  const hmsUrl = process.env.HMS_API_URL;
  const hmsApiKey = process.env.HMS_API_KEY;

  if (!hmsUrl || !hmsApiKey) {
    console.error("[hms-sync] HMS_API_URL or HMS_API_KEY not configured");
    return { success: false, error: "HMS not configured" };
  }

  try {
    const response = await fetch(`${hmsUrl.replace(/\/+$/, "")}/sync/create-resident`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hmsApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bookingData),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[hms-sync] HMS returned ${response.status}: ${text.substring(0, 300)}`);
      return { success: false, error: `HMS returned ${response.status}` };
    }

    const result = await response.json();
    console.log(`[hms-sync] Synced ${bookingData.name} to HMS: ${result.action} (id: ${result.resident?.id})`);
    return { success: true, action: result.action };
  } catch (error: any) {
    console.error(`[hms-sync] Failed to sync ${bookingData.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends non-meal services (laundry, shuttle, housekeeping, etc.) to HMS via
 * /sync/booking-complete. Silently skips if the endpoint returns 404/405
 * (not yet live on the HMS side).
 */
export async function syncBookingCompleteToHMS(data: {
  phone: string;
  propertyCode: string;
  bookingCode?: string;
  includedServices: any[];
}): Promise<{ success: boolean; notAvailable?: boolean; error?: string }> {
  const hmsUrl = process.env.HMS_API_URL;
  const hmsApiKey = process.env.HMS_API_KEY;

  if (!hmsUrl || !hmsApiKey) return { success: false, error: "HMS not configured" };

  try {
    const response = await fetch(`${hmsUrl.replace(/\/+$/, "")}/sync/booking-complete`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${hmsApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 404 || response.status === 405) {
      console.warn(`[hms-sync] /sync/booking-complete not yet available (${response.status}) — skipping`);
      return { success: false, notAvailable: true };
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error(`[hms-sync] booking-complete returned ${response.status}: ${text.substring(0, 300)}`);
      return { success: false, error: `HMS returned ${response.status}` };
    }

    console.log(`[hms-sync] booking-complete synced for ${data.bookingCode || data.phone}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[hms-sync] Failed to send booking-complete:`, error.message);
    return { success: false, error: error.message };
  }
}
