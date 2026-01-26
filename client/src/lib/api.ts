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
}): Promise<{ booking: Booking; installments: Installment[] }> {
  return fetchAPI("/bookings", {
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

export async function getAdminStats(): Promise<{
  totalStudents: number;
  totalBookings: number;
  totalRevenue: number;
  pendingPayments: number;
}> {
  return fetchAPI("/admin/stats");
}
