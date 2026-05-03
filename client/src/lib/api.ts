import { type Property, type Student, type Booking, type Installment, type Payment } from "@shared/schema";

const API_BASE = "/api";

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// Properties
export async function getProperties(): Promise<Property[]> {
  return fetchAPI<Property[]>("/properties");
}

export async function getProperty(id: string): Promise<Property> {
  return fetchAPI<Property>(`/properties/${id}`);
}

// Students
export async function registerStudent(data: {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  emergencyName: string;
  emergencyRelation: string;
  emergencyPhone: string;
  collegeName: string;
  course: string;
  year: string;
  userId: string;
}): Promise<{ user: any; student: Student }> {
  return fetchAPI("/students/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getStudent(userId: string): Promise<Student> {
  return fetchAPI<Student>(`/students/by-user/${userId}`);
}

// Bookings
export async function createBooking(data: {
  studentId: string;
  propertyId: string;
  roomTypeId: string;
  baseFee: number;
  paymentPlanId: string;
  discount?: number;
  discountReason?: string;
  couponCode?: string;
}): Promise<{ booking: Booking; installments: Installment[] }> {
  return fetchAPI("/bookings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function validateCoupon(data: {
  code: string;
  bookingValue: number;
  propertyId?: string;
  roomTypeId?: string;
  userId?: string;
}): Promise<{
  valid: boolean;
  error?: string;
  coupon?: { id: string; code: string; name: string; description?: string };
  discount?: number;
  finalAmount?: number;
}> {
  // Use fetchAPI for consistent non-2xx handling (e.g. 404 "Coupon not found"
  // becomes a thrown Error). The endpoint also returns 200 with {valid:false}
  // for soft-fail cases (targeting / per-user / first-booking), which the
  // caller handles via the `valid` flag.
  return fetchAPI("/coupons/validate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getBooking(id: string): Promise<{
  booking: Booking;
  student: Student;
  property: Property;
  roomType: any;
  installments: Installment[];
  payments: Payment[];
}> {
  return fetchAPI(`/bookings/${id}`);
}

// Payments
export async function createPayment(data: {
  bookingId: string;
  amount: number;
  installmentId?: string;
}): Promise<Payment> {
  return fetchAPI("/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPayment(id: string): Promise<Payment> {
  return fetchAPI<Payment>(`/payments/${id}`);
}

// Agreement
export async function generateAgreement(bookingId: string, signatureData?: string): Promise<Booking> {
  return fetchAPI(`/bookings/${bookingId}/agreement`, {
    method: "POST",
    body: JSON.stringify({ signatureData }),
  });
}

// Admin
export async function applyDiscount(data: {
  bookingId: string;
  discount: number;
  reason: string;
  adminId: string;
}): Promise<Booking> {
  return fetchAPI("/admin/discount", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getAdminStats(propertyId?: string | null): Promise<{
  totalStudents: number;
  totalBookings: number;
  totalRevenue: number;
  pendingPayments: number;
  occupiedBeds: number;
  totalBeds: number;
  occupancyRate: number;
  studentsThisMonth: number;
  studentsPrevMonth: number;
  bookingsThisMonth: number;
  bookingsPrevMonth: number;
  revenueThisMonth: number;
  revenuePrevMonth: number;
  pendingDueThisWeek: number;
}> {
  const qs = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : "";
  return fetchAPI(`/admin/stats${qs}`);
}
