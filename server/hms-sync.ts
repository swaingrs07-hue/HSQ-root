const PROPERTY_CODE_MAP: Record<string, string> = {
    "Hsquare Hostel Juhu": "HSQ-MUM-01",
    "Hsquare Hostel Goregaon": "HSQ-MUM-02",
    "Hsquare Goregaon": "HSQ-MUM-02",
    "Hsquare Bayview": "HSQ-MUM-03",
    "Hsquare Hostel Bayview": "HSQ-MUM-03",
  };

  export function getPropertyCode(propertyName: string): string {
    return PROPERTY_CODE_MAP[propertyName] || "HSQ-MUM-01";
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
    const hmsUrl = process.env.HMS_API_URL || "https://hsquarehostels.com";
    const hmsApiKey = process.env.HMS_API_KEY || process.env.HSQUARE_API_KEY;

    if (!hmsApiKey) {
      console.error("[hms-sync] HMS_API_KEY or HSQUARE_API_KEY not configured");
      return { success: false, error: "HMS API key not configured" };
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