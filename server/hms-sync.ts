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
