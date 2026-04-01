import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Users,
  Phone,
  Mail,
  Calendar,
  IndianRupee,
  BedDouble,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Loader2,
  UserPlus,
  FileText,
  CreditCard,
  ClipboardCheck,
  Sparkles,
  MapPin,
  User,
  ChevronRight,
  Receipt,
  Shield,
  Tag,
  Search,
  GraduationCap,
  ExternalLink,
  RefreshCw,
  Camera,
  Upload,
  X,
  Heart,
  ChevronDown,
  ChevronUp,
  DoorOpen,
  Bath,
  Ban,
  AlertCircle,
  Layers,
  Crown,
  Star,
  Gem,
} from "lucide-react";

interface Property {
  id: string;
  name: string;
  city: string;
  bookingMode: string;
  moveInCharges?: { serviceLegalCharges?: number; policeVerification?: number; agreement?: number } | null;
}

interface RoomType {
  id: string;
  name: string;
  customName: string | null;
  occupancy: number;
  basePrice: number;
  academicYearPrice: number | null;
  totalBeds: number;
  availableBeds: number;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  propertyId: string | null;
  propertyName: string | null;
}

interface RegisteredStudent {
  id: string;
  fullName?: string;
  name?: string;
  email?: string;
  studentEmail?: string;
  registeredEmail?: string;
  phone?: string;
  collegeName?: string;
  college?: string;
  instituteName?: string;
  course?: string;
  courseName?: string;
  courseYear?: string;
  year?: string;
  city?: string;
  room?: string;
  roomNumber?: string;
  propertyName?: string;
  dietary?: string;
  gender?: string;
  dateOfBirth?: string;
  moveInDate?: string;
  checkOutDate?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  parentRelation?: string;
  homeAddress?: string;
  accommodationType?: string;
  photo?: string;
  profileImageUrl?: string;
  hasActiveBooking?: boolean;
  activeBookingCode?: string | null;
  activeBookingPropertyId?: string | null;
}

const STEP_CONFIG = [
  { label: "Customer", icon: UserPlus, description: "Select customer type" },
  { label: "Property", icon: Building2, description: "Choose property & room" },
  { label: "Resident", icon: Heart, description: "Resident details & photo" },
  { label: "Pricing", icon: IndianRupee, description: "Set pricing & payment" },
  { label: "Confirm", icon: ClipboardCheck, description: "Review & submit" },
];

export default function BookingGeneration() {
  const { toast } = useToast();
  const { user, token, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!authLoading && !token && !user) {
      navigate("/login");
    }
  }, [token, user, authLoading, navigate]);

  const [step, setStep] = useState(1);
  const [prefilledFromProperty, setPrefilledFromProperty] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [registeredStudents, setRegisteredStudents] = useState<RegisteredStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSearchLoading, setStudentSearchLoading] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<RegisteredStudent | null>(null);
  const [availability, setAvailability] = useState<{ totalBeds: number; availableBeds: number; bookedBeds: number } | null>(null);
  const [residentPhotoUrl, setResidentPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [matchedLeadInfo, setMatchedLeadInfo] = useState<{
    matched: boolean;
    lead: any;
    booking: any;
    recentActivities: any[];
  } | null>(null);
  const [matchingLead, setMatchingLead] = useState(false);
  const matchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkLeadMatch = useCallback(async (phone: string, email: string) => {
    if (!phone && !email) {
      setMatchedLeadInfo(null);
      return;
    }
    if ((phone && phone.length >= 10) || (email && email.includes("@"))) {
      setMatchingLead(true);
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch("/api/leads/match", {
          method: "POST",
          headers,
          body: JSON.stringify({ phone, email }),
        });
        if (res.ok) {
          const data = await res.json();
          setMatchedLeadInfo(data);
        }
      } catch {
      } finally {
        setMatchingLead(false);
      }
    }
  }, [token]);

  const debouncedLeadMatch = useCallback((phone: string, email: string) => {
    if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
    matchTimeoutRef.current = setTimeout(() => checkLeadMatch(phone, email), 600);
  }, [checkLeadMatch]);

  const [floors, setFloors] = useState<any[]>([]);
  const [floorsLoading, setFloorsLoading] = useState(false);
  const [selectedFloorId, setSelectedFloorId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedBedId, setSelectedBedId] = useState("");
  const [selectedBedInfo, setSelectedBedInfo] = useState<any>(null);
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set());
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [selectedPlanPrice, setSelectedPlanPrice] = useState<number>(0);
  const [selectedPlanTier, setSelectedPlanTier] = useState<number | null>(null);
  const [selectedPlanItems, setSelectedPlanItems] = useState<any[]>([]);
  const [propertyPlans, setPropertyPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);

  const [formData, setFormData] = useState({
    customerType: "walk_in",
    studentId: "",
    leadId: "",
    walkInName: "",
    walkInPhone: "",
    walkInEmail: "",
    propertyId: "",
    roomTypeId: "",
    stayPlanType: "academic_year",
    academicYearPeriod: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
    checkInDate: "",
    checkOutDate: "",
    durationMonths: 11,
    baseFee: 0,
    deposit: 0,
    discount: 0,
    discountReason: "",
    paymentType: "full",
    paymentPlanId: "",
    tokenAmount: 100000,
    numberOfInstallments: 2,
    customBookingAmount: 0,
    installmentDueDates: [] as string[],
    residentName: "",
    residentRoomNo: "",
    residentBedNo: "",
    residentPhone: "",
    residentEmail: "",
    residentDietaryPreference: "",
    residentGender: "",
    residentDob: "",
    residentAccommodationType: "",
    residentInstitute: "",
    residentCourse: "",
    residentMoveInDate: "",
    residentCheckOutDate: "",
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    parentRelation: "",
    residentPhotoPath: "",
  });

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSalesExec = user?.role === "sales_executive";
  const isReceptionist = user?.role === "receptionist";
  const isRegularUser = user?.role === "user" || user?.role === "student";
  const maxDiscountPercent = isSalesExec ? 10 : 100;
  const getAuthToken = () => token || "";

  const getAccommodationLabel = (bed: any, room: any): string => {
    if (!bed || !room) return "";
    let name = "";
    if (bed.roomTypeId && roomTypes.length > 0) {
      const rt = roomTypes.find((r: any) => r.id === bed.roomTypeId);
      if (rt) name = rt.customName || rt.name || "";
    }
    if (!name) name = "";
    const typology = room.typology || "";
    const isCombo = typology.includes("+");
    if (isCombo) {
      const parts = typology.split("+").map((p: string) => parseInt(p.trim())).filter((n: number) => !isNaN(n));
      const maxSection = Math.max(...parts);
      const sectionLabels: Record<number, string> = { 1: "SINGLE", 2: "DOUBLE", 3: "TRIPLE", 4: "QUAD" };
      const comboName = sectionLabels[maxSection] || name || `${maxSection}-BED`;
      return `${comboName}(${typology})`;
    }
    if (name && typology && typology !== "1 Bed") {
      return `${name}(${typology})`;
    }
    return name || typology || "";
  };

  useEffect(() => {
    if (isRegularUser && user) {
      setFormData(prev => ({
        ...prev,
        customerType: "walk_in",
        walkInName: user.name || "",
        walkInPhone: user.phone || "",
        walkInEmail: user.email || "",
        residentName: user.name || "",
        residentPhone: user.phone || "",
        residentEmail: user.email || "",
      }));
    }
  }, [user, isRegularUser]);

  const registrationPrefillRef = useRef<{ regId: string; propertyId: string } | null>(null);
  const [registrationRequestId, setRegistrationRequestId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("prefill") !== "registration") return;
    const name = params.get("name") || "";
    const phone = params.get("phone") || "";
    const email = params.get("email") || "";
    const gender = params.get("gender") || "";
    const propertyId = params.get("propertyId") || "";
    const regId = params.get("regId") || "";

    if (regId) {
      registrationPrefillRef.current = { regId, propertyId };
      setRegistrationRequestId(regId);
    }

    setFormData(prev => ({
      ...prev,
      customerType: "walk_in",
      walkInName: name,
      walkInPhone: phone,
      walkInEmail: email,
      residentName: name,
      residentPhone: phone,
      residentEmail: email,
      residentGender: gender,
      residentDob: "",
      residentInstitute: "",
      residentCourse: "",
      residentMoveInDate: "",
      residentCheckOutDate: "",
      residentDietaryPreference: "",
      residentPhotoPath: "",
      parentName: "",
      parentPhone: "",
      parentEmail: "",
      parentRelation: "",
      ...(propertyId ? { propertyId } : {}),
    }));
    setResidentPhotoUrl(null);

    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    const prefill = registrationPrefillRef.current;
    if (!prefill || !token) return;
    registrationPrefillRef.current = null;

    const authHeaders = { Authorization: `Bearer ${token}` };

    fetch(`/api/admin/registration-requests/${prefill.regId}`, { headers: authHeaders })
      .then(r => r.ok ? r.json() : null)
      .then(reg => {
        if (!reg) {
          console.warn("Registration prefill: failed to load registration details");
          return;
        }
        setFormData(prev => ({
          ...prev,
          residentDob: reg.dob || "",
          residentDietaryPreference: reg.dietaryPreference || "",
          residentInstitute: reg.instituteName || "",
          residentCourse: reg.courseName || "",
          residentMoveInDate: reg.moveInDate || "",
          residentCheckOutDate: reg.checkOutDate || "",
          parentName: reg.parentName || "",
          parentPhone: reg.parentPhone || "",
          parentEmail: reg.parentEmail || "",
          parentRelation: reg.parentRelation || "",
          residentPhotoPath: reg.photoPath || "",
        }));
        if (reg.photoPath) {
          fetch(`/api/uploads/signed-url?path=${encodeURIComponent(reg.photoPath)}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.url) setResidentPhotoUrl(data.url); })
            .catch(err => console.warn("Registration prefill: failed to load photo", err));
        }

        const searchTerm = reg.phone || reg.email || reg.fullName || "";
        const normRegPhone = (reg.phone || "").replace(/\D/g, "").slice(-10);
        const normRegEmail = (reg.email || "").toLowerCase().trim();
        const normRegName = (reg.fullName || "").toLowerCase().trim();

        const findBestMatch = (students: any[]) => {
          if (!Array.isArray(students) || students.length === 0) return null;
          for (const s of students) {
            const sPhone = (s.phone || "").replace(/\D/g, "").slice(-10);
            const sEmail = (s.email || s.studentEmail || s.registeredEmail || "").toLowerCase().trim();
            const sName = (s.fullName || s.name || "").toLowerCase().trim();
            let fieldMatches = 0;
            if (normRegName && sName && normRegName === sName) fieldMatches++;
            if (normRegEmail && sEmail && normRegEmail === sEmail) fieldMatches++;
            if (normRegPhone && sPhone && normRegPhone === sPhone) fieldMatches++;
            if (fieldMatches >= 2) return s;
          }
          for (const s of students) {
            const sPhone = (s.phone || "").replace(/\D/g, "").slice(-10);
            const sEmail = (s.email || s.studentEmail || s.registeredEmail || "").toLowerCase().trim();
            if ((normRegPhone && sPhone && normRegPhone === sPhone) ||
                (normRegEmail && sEmail && normRegEmail === sEmail)) return s;
          }
          return null;
        };

        const applyStudentMatch = (match: any, students: any[]) => {
          const genderMap: Record<string, string> = { male: "male", female: "female", Male: "male", Female: "female", other: "other", Other: "other" };
          const dietaryMap: Record<string, string> = { Veg: "veg", "Non-Veg": "non_veg", Jain: "jain", Vegan: "vegan", veg: "veg", "non-veg": "non_veg", jain: "jain", vegan: "vegan" };
          const studentName = match.fullName || match.name || "";
          const studentEmail = match.email || match.studentEmail || match.registeredEmail || "";
          const studentCollege = match.collegeName || match.college || match.instituteName || "";
          const studentCourse = match.course || match.courseName || "";
          const studentRoom = match.roomNumber || match.room || "";
          setSelectedStudent(match);
          setRegisteredStudents(students);
          setFormData(prev => ({
            ...prev,
            customerType: "student",
            studentId: match.id,
            walkInName: studentName || prev.walkInName,
            walkInPhone: match.phone || prev.walkInPhone,
            walkInEmail: studentEmail || prev.walkInEmail,
            residentName: studentName || prev.residentName,
            residentPhone: match.phone || prev.residentPhone,
            residentEmail: studentEmail || prev.residentEmail,
            residentRoomNo: studentRoom || prev.residentRoomNo,
            residentInstitute: studentCollege || prev.residentInstitute,
            residentCourse: studentCourse || prev.residentCourse,
            residentGender: (match.gender ? genderMap[match.gender] || match.gender.toLowerCase() : "") || prev.residentGender,
            residentDietaryPreference: (match.dietaryPreference ? dietaryMap[match.dietaryPreference] || match.dietaryPreference : "") || prev.residentDietaryPreference,
          }));
        };

        if (searchTerm) {
          fetch(`/api/admin/registered-students?search=${encodeURIComponent(searchTerm)}`, { headers: authHeaders })
            .then(r => r.ok ? r.json() : null)
            .then(students => {
              const match = findBestMatch(students || []);
              if (match) {
                applyStudentMatch(match, students);
              }
            })
            .catch(err => console.warn("Registration prefill: student lookup failed", err));
        }
      })
      .catch(err => console.warn("Registration prefill: fetch error", err));
  }, [token]);

  useEffect(() => {
    if (isRegularUser) {
      const savedDraft = localStorage.getItem("hsquare_booking_draft");
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (draft.formData) {
            setFormData(prev => ({ ...prev, ...draft.formData }));
            setStep(draft.step || 1);
            if (draft.selectedBedId) setSelectedBedId(draft.selectedBedId);
            if (draft.selectedFloorId) setSelectedFloorId(draft.selectedFloorId);
            if (draft.selectedRoomId) setSelectedRoomId(draft.selectedRoomId);
            if (draft.selectedBedInfo) setSelectedBedInfo(draft.selectedBedInfo);
          }
        } catch (e) {
          console.error("Error restoring draft:", e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (isRegularUser && formData.propertyId) {
      const draft = {
        formData,
        step,
        selectedBedId,
        selectedFloorId,
        selectedRoomId,
        selectedBedInfo,
        savedAt: Date.now(),
      };
      localStorage.setItem("hsquare_booking_draft", JSON.stringify(draft));
    }
  }, [formData, step, selectedBedId, selectedFloorId, selectedRoomId, isRegularUser]);

  useEffect(() => {
    fetchProperties();
    if (isSalesExec && user?.id) {
      fetchAssignedLeads();
    } else if (isAdmin || isReceptionist) {
      fetchAllLeads();
    }
  }, [user]);

  const [bookingSessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [heldBedId, setHeldBedId] = useState<string | null>(null);

  const holdBedForBooking = async (bedId: string) => {
    try {
      const res = await fetch("/api/beds/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedId, sessionId: bookingSessionId }),
      });
      if (res.ok) {
        setHeldBedId(bedId);
      } else {
        const data = await res.json();
        if (res.status === 409) {
          toast({ title: "Bed Unavailable", description: data.error, variant: "destructive" });
        }
      }
    } catch (e) {
      console.error("Failed to hold bed:", e);
    }
  };

  const releaseBedHold = async (bedId: string) => {
    try {
      await fetch("/api/beds/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bedId, sessionId: bookingSessionId }),
      });
      setHeldBedId(null);
    } catch (e) {
      console.error("Failed to release bed:", e);
    }
  };

  useEffect(() => {
    const releaseOnUnload = () => {
      if (heldBedId) {
        const blob = new Blob([JSON.stringify({ bedId: heldBedId, sessionId: bookingSessionId })], { type: "application/json" });
        navigator.sendBeacon("/api/beds/release", blob);
      }
    };
    window.addEventListener("beforeunload", releaseOnUnload);
    return () => {
      window.removeEventListener("beforeunload", releaseOnUnload);
      releaseOnUnload();
    };
  }, [heldBedId, bookingSessionId]);

  useEffect(() => {
    if (properties.length > 0) {
      try {
        const saved = localStorage.getItem("selected_room");
        if (saved) {
          const data = JSON.parse(saved);
          if (data.propertyId) {
            const matchedProp = properties.find(p => p.id === data.propertyId);
            if (matchedProp) {
              setFormData(prev => ({
                ...prev,
                propertyId: data.propertyId,
                roomTypeId: data.roomTypeId || "",
                stayPlanType: (matchedProp as any).bookingMode === "monthly" ? "monthly" : "academic_year",
              }));
              if (data.bedId) {
                setSelectedBedId(data.bedId);
                holdBedForBooking(data.bedId);
                setPrefilledFromProperty(true);
              }
              if (data.floorId) {
                setSelectedFloorId(data.floorId);
              }
              if (data.roomId) {
                setSelectedRoomId(data.roomId);
              }
              if (data.selectedPlanId) {
                setSelectedPlanId(data.selectedPlanId);
                setSelectedPlanName(data.selectedPlanName || null);
                if (data.price && data.price > 0) {
                  setSelectedPlanPrice(data.price);
                }
                if (data.selectedPlanTier != null) {
                  setSelectedPlanTier(data.selectedPlanTier);
                }
                if (data.selectedPlanItems) {
                  setSelectedPlanItems(data.selectedPlanItems);
                }
              }
              if (data.roomNumber || data.bedNumber) {
                let accomType = "";
                if (data.roomTypeName && data.roomTypology && data.roomTypology !== "1 Bed") {
                  accomType = `${data.roomTypeName}(${data.roomTypology})`;
                } else if (data.bedNumber && data.roomTypology) {
                  accomType = getAccommodationLabel(
                    { bedNumber: data.bedNumber },
                    { typology: data.roomTypology }
                  );
                } else if (data.roomTypeName) {
                  accomType = data.roomTypeName;
                }
                setFormData(prev => ({
                  ...prev,
                  residentRoomNo: data.roomNumber || prev.residentRoomNo,
                  residentBedNo: data.bedNumber || prev.residentBedNo,
                  residentAccommodationType: accomType || prev.residentAccommodationType,
                }));
              }
            }
          }
          localStorage.removeItem("selected_room");
        }
      } catch (e) {
        console.error("Error reading selected_room:", e);
      }
    }
  }, [properties]);

  useEffect(() => {
    if (formData.propertyId) {
      fetchRoomTypes(formData.propertyId);
      setFloorsLoading(true);
      fetch(`/api/properties/${formData.propertyId}/floors`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
        .then(r => r.ok ? r.json() : [])
        .then(data => { setFloors(data || []); setFloorsLoading(false); })
        .catch(() => { setFloors([]); setFloorsLoading(false); });
      setPlansLoading(true);
      fetch(`/api/properties/${formData.propertyId}/plans`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setPropertyPlans(data || []); setPlansLoading(false); })
        .catch(() => { setPropertyPlans([]); setPlansLoading(false); });
    }
  }, [formData.propertyId, token]);

  useEffect(() => {
    if (selectedPlanId && selectedPlanTier == null && propertyPlans.length > 0) {
      const matched = propertyPlans.find((p: any) => p.id === selectedPlanId);
      if (matched) {
        setSelectedPlanTier(matched.tierLevel ?? 0);
        setSelectedPlanItems(matched.items || []);
        if (!selectedPlanName) setSelectedPlanName(matched.name);
      }
    }
  }, [selectedPlanId, selectedPlanTier, propertyPlans, selectedPlanName]);

  useEffect(() => {
    if (formData.roomTypeId) {
      fetchAvailability(formData.roomTypeId);
      calculateFee();
    }
  }, [formData.roomTypeId, formData.stayPlanType, formData.durationMonths, roomTypes, selectedPlanPrice]);

  const fetchProperties = async () => {
    try {
      const response = await fetch("/api/properties", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProperties(data);
      }
    } catch (error) {
      console.error("Error fetching properties:", error);
    }
  };

  const fetchRoomTypes = async (propertyId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRoomTypes(data.roomTypes || []);
      }
    } catch (error) {
      console.error("Error fetching room types:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async (roomTypeId: string) => {
    try {
      const response = await fetch(`/api/room-types/${roomTypeId}/availability`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAvailability(data);
      }
    } catch (error) {
      console.error("Error fetching availability:", error);
    }
  };

  const fetchAssignedLeads = async () => {
    try {
      const response = await fetch(`/api/sales-exec/${user?.id}/leads`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLeads(data.filter((l: any) => l.status !== "lost" && l.status !== "converted"));
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const fetchAllLeads = async () => {
    try {
      const response = await fetch("/api/leads", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setLeads(data.filter((l: any) => l.status !== "lost" && l.status !== "converted"));
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const calculateFee = () => {
    const selectedRoom = roomTypes.find(r => r.id === formData.roomTypeId);
    if (!selectedRoom) return;
    const property = properties.find(p => p.id === formData.propertyId);
    if (!property) return;

    let baseFee = 0;
    if (selectedPlanPrice > 0) {
      baseFee = selectedPlanPrice;
    } else if (property.bookingMode === "monthly" && formData.stayPlanType === "monthly") {
      baseFee = selectedRoom.basePrice * formData.durationMonths;
    } else {
      baseFee = selectedRoom.academicYearPrice || (selectedRoom.basePrice * 11);
    }
    const propDeposit = (property as any).deposit || (selectedRoom as any).deposit || 0;
    setFormData(prev => ({
      ...prev,
      baseFee,
      ...(isRegularUser ? { deposit: propDeposit, discount: 0 } : {}),
    }));
  };

  const getMoveInChargesTotal = () => {
    const mic = getSelectedProperty()?.moveInCharges;
    if (!mic) return 0;
    return (mic.serviceLegalCharges || 0) || ((mic.policeVerification || 0) + (mic.agreement || 0));
  };

  const calculateTotal = () => {
    return formData.baseFee - (formData.discount || 0) + (formData.deposit || 0) + getMoveInChargesTotal();
  };

  const getDiscountPercent = () => {
    if (formData.baseFee === 0) return 0;
    return (formData.discount / formData.baseFee) * 100;
  };

  const needsApproval = () => getDiscountPercent() > 10 && isSalesExec;

  const handlePropertyChange = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    setFormData(prev => ({
      ...prev,
      propertyId,
      roomTypeId: "",
      stayPlanType: property?.bookingMode === "monthly" ? "monthly" : "academic_year",
    }));
    setRoomTypes([]);
    setAvailability(null);
    setSelectedFloorId("");
    setSelectedRoomId("");
    setSelectedBedId("");
    setSelectedBedInfo(null);
    setExpandedFloors(new Set());
    setFloors([]);
    setSelectedPlanId(null);
    setSelectedPlanName(null);
    setSelectedPlanPrice(0);
    setSelectedPlanTier(null);
    setSelectedPlanItems([]);
  };

  const handleRoomTypeChange = (roomTypeId: string) => {
    const selectedRT = roomTypes.find((rt: any) => rt.id === roomTypeId);
    let accomType = "";
    if (selectedRT) {
      accomType = selectedRT.customName || selectedRT.name || "";
    }
    setFormData(prev => ({ ...prev, roomTypeId, residentAccommodationType: accomType }));
    setSelectedFloorId("");
    setSelectedRoomId("");
    setSelectedBedId("");
    setSelectedBedInfo(null);
    setExpandedFloors(new Set());
    setSelectedPlanId(null);
    setSelectedPlanName(null);
    setSelectedPlanPrice(0);
    setSelectedPlanTier(null);
    setSelectedPlanItems([]);
  };

  const fetchRegisteredStudents = async (search?: string) => {
    try {
      setStudentSearchLoading(true);
      setStudentSearchError(null);
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const response = await fetch(`/api/admin/registered-students${params}`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRegisteredStudents(Array.isArray(data) ? data : []);
      } else {
        const err = await response.json().catch(() => ({ error: "Connection failed" }));
        setStudentSearchError(err.details || err.error || "Failed to fetch students");
        setRegisteredStudents([]);
      }
    } catch (error) {
      console.error("Error fetching registered students:", error);
      setStudentSearchError("Unable to connect to external system");
      setRegisteredStudents([]);
    } finally {
      setStudentSearchLoading(false);
    }
  };

  const handleCustomerTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      customerType: type,
      studentId: "",
      leadId: "",
      walkInName: "",
      walkInPhone: "",
      walkInEmail: "",
    }));
    setSelectedStudent(null);
    setStudentSearch("");
    setStudentSearchError(null);
    if (type === "student") {
      fetchRegisteredStudents();
    }
  };

  const handleStudentSelect = (student: RegisteredStudent) => {
    const studentName = student.fullName || student.name || "";
    const studentEmail = student.email || student.studentEmail || student.registeredEmail || "";
    const studentCollege = student.collegeName || student.college || student.instituteName || "";
    const studentCourse = student.course || student.courseName || "";
    const studentRoom = student.roomNumber || student.room || "";
    const genderMap: Record<string, string> = { male: "male", female: "female", Male: "male", Female: "female", other: "other", Other: "other" };
    const dietaryMap: Record<string, string> = { Veg: "veg", "Non-Veg": "non_veg", Jain: "jain", Vegan: "vegan", veg: "veg", "non-veg": "non_veg", jain: "jain", vegan: "vegan" };
    setSelectedStudent(student);
    setFormData(prev => ({
      ...prev,
      studentId: student.id,
      walkInName: studentName,
      walkInPhone: student.phone || "",
      walkInEmail: studentEmail,
      residentName: studentName,
      residentPhone: student.phone || "",
      residentEmail: studentEmail,
      residentRoomNo: studentRoom,
      residentInstitute: studentCollege,
      residentCourse: studentCourse,
      residentGender: (student.gender ? genderMap[student.gender] || student.gender.toLowerCase() : "") || prev.residentGender,
      residentDob: student.dateOfBirth || prev.residentDob,
      residentDietaryPreference: (student.dietary ? dietaryMap[student.dietary] || student.dietary.toLowerCase() : "") || prev.residentDietaryPreference,
      residentMoveInDate: student.moveInDate || prev.residentMoveInDate,
      residentAccommodationType: student.accommodationType || prev.residentAccommodationType,
      parentName: student.parentName || prev.parentName,
      parentPhone: student.parentPhone || prev.parentPhone,
      parentEmail: (student.parentEmail && student.parentEmail !== "null@gmail.com") ? student.parentEmail : prev.parentEmail,
      parentRelation: student.parentRelation || prev.parentRelation,
    }));
    if (student.profileImageUrl || student.photo) {
      const imgUrl = student.profileImageUrl || student.photo || "";
      if (imgUrl && !imgUrl.includes("ui-avatars.com")) {
        setResidentPhotoUrl(imgUrl);
      }
    }
  };

  const handleLeadSelect = (leadId: string) => {
    const selectedLead = leads.find(l => l.id === leadId);
    if (selectedLead) {
      setFormData(prev => ({
        ...prev,
        leadId,
        walkInName: selectedLead.name,
        walkInPhone: selectedLead.phone || "",
        walkInEmail: selectedLead.email || "",
        propertyId: selectedLead.propertyId || prev.propertyId,
        residentName: selectedLead.name || "",
        residentPhone: selectedLead.phone || "",
        residentEmail: selectedLead.email || "",
      }));
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Photo must be under 5MB.", variant: "destructive" });
      return;
    }
    setPhotoUploading(true);
    try {
      const res = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await res.json();
      const uploadRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const photoUrl = `/api/uploads/public/${objectPath.split("/").pop()}`;
      setResidentPhotoUrl(URL.createObjectURL(file));
      setFormData(prev => ({ ...prev, residentPhotoPath: objectPath }));
      toast({ title: "Photo uploaded", description: "Resident photo uploaded successfully." });
    } catch (error) {
      console.error("Photo upload error:", error);
      toast({ title: "Upload failed", description: "Failed to upload photo. Please try again.", variant: "destructive" });
    } finally {
      setPhotoUploading(false);
    }
  };

  const validateStep = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        if (formData.customerType === "walk_in") {
          return !!(formData.walkInName.trim() && formData.walkInPhone.trim() && formData.walkInEmail.trim() && formData.walkInEmail.includes("@"));
        } else if (formData.customerType === "lead") {
          return !!formData.leadId;
        }
        return !!formData.studentId;
      case 2:
        return !!(formData.propertyId && formData.roomTypeId && availability && availability.availableBeds > 0);
      case 3:
        return !!(formData.residentName.trim() && formData.residentPhone.trim() && formData.residentGender && formData.residentEmail.trim() && formData.residentEmail.includes("@"));
      case 4:
        return formData.baseFee > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      if (step === 2 && !formData.residentName) {
        setFormData(prev => ({
          ...prev,
          residentName: prev.residentName || getCustomerName() || "",
          residentPhone: prev.residentPhone || getCustomerPhone() || "",
          residentEmail: prev.residentEmail || getCustomerEmail() || "",
        }));
      }
      let nextStep = step + 1;
      if (step === 1 && prefilledFromProperty && formData.propertyId && formData.roomTypeId) {
        setFormData(prev => ({
          ...prev,
          residentName: prev.residentName || getCustomerName() || "",
          residentPhone: prev.residentPhone || getCustomerPhone() || "",
          residentEmail: prev.residentEmail || getCustomerEmail() || "",
        }));
        nextStep = 3;
      }
      setStep(nextStep);
    } else {
      toast({
        title: "Incomplete Information",
        description: "Please fill in all required fields before proceeding.",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => {
    let prevStep = step - 1;
    if (step === 3 && prefilledFromProperty) {
      prevStep = 1;
    }
    if (step === 5) setTermsAccepted(false);
    setStep(prevStep);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/bookings/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          customerType: formData.customerType,
          studentId: formData.customerType === "student" ? formData.studentId : null,
          leadId: formData.customerType === "lead" ? formData.leadId : null,
          walkInName: formData.walkInName || null,
          walkInPhone: formData.walkInPhone || null,
          walkInEmail: formData.walkInEmail || null,
          propertyId: formData.propertyId,
          roomTypeId: formData.roomTypeId,
          bedId: selectedBedId || null,
          floorId: selectedFloorId || null,
          selectedPlanId: selectedPlanId || null,
          stayPlanType: formData.stayPlanType,
          academicYearPeriod: formData.stayPlanType === "academic_year" ? formData.academicYearPeriod : null,
          checkInDate: formData.checkInDate || null,
          checkOutDate: formData.checkOutDate || null,
          durationMonths: formData.durationMonths,
          baseFee: formData.baseFee,
          deposit: formData.deposit,
          discount: formData.discount,
          discountReason: formData.discountReason,
          paymentType: formData.paymentType,
          tokenAmount: formData.paymentType === "partial" ? formData.tokenAmount : null,
          numberOfInstallments: formData.paymentType === "installments" ? formData.numberOfInstallments : null,
          customBookingAmount: formData.paymentType === "installments" && formData.customBookingAmount > 0 ? formData.customBookingAmount : null,
          installmentAmounts: formData.paymentType === "installments" && (formData as any).installmentAmounts?.length > 0 ? (formData as any).installmentAmounts : null,
          installmentDueDates: formData.paymentType === "installments" ? formData.installmentDueDates : null,
          paymentPlanId: formData.paymentPlanId || null,
          residentDetails: {
            name: formData.residentName,
            roomNo: selectedRoomId ? (floors.flatMap((f: any) => f.rooms || []).find((r: any) => r.id === selectedRoomId)?.roomNumber || formData.residentRoomNo) : formData.residentRoomNo,
            bedNo: formData.residentBedNo,
            phone: formData.residentPhone,
            email: formData.residentEmail,
            dietaryPreference: formData.residentDietaryPreference,
            gender: formData.residentGender,
            dob: formData.residentDob,
            accommodationType: formData.residentAccommodationType,
            institute: formData.residentInstitute,
            course: formData.residentCourse,
            moveInDate: formData.residentMoveInDate,
            checkOutDate: formData.residentCheckOutDate,
            parentName: formData.parentName,
            parentPhone: formData.parentPhone,
            parentEmail: formData.parentEmail,
            parentRelation: formData.parentRelation,
            photoPath: formData.residentPhotoPath,
          },
          createdBy: user?.id,
          assignedSalesExecId: isSalesExec ? user?.id : null,
          registrationRequestId: registrationRequestId || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBookingResult(data);
        localStorage.removeItem("hsquare_booking_draft");
        if (data.booking) {
          const bookingWithExtras = { ...data.booking, moveInCharges: getSelectedProperty()?.moveInCharges || null };
          localStorage.setItem("hsquare_booking", JSON.stringify(bookingWithExtras));
          if (data.installments) {
            localStorage.setItem("hsquare_installments", JSON.stringify(data.installments));
          }
        }
        setConfirmDialogOpen(true);
        toast({
          title: "Booking Created",
          description: data.requiresApproval
            ? "Booking created and sent for admin approval."
            : `Booking ${data.booking.bookingCode} created successfully!`,
        });
        if (data.registrationUpdateWarning) {
          toast({
            title: "Registration Update Warning",
            description: data.registrationUpdateWarning,
            variant: "destructive",
          });
        }
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to create booking",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error creating booking:", error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedProperty = () => properties.find(p => p.id === formData.propertyId);
  const getSelectedRoomType = () => roomTypes.find(r => r.id === formData.roomTypeId);
  const getSelectedLead = () => leads.find(l => l.id === formData.leadId);

  const getCustomerName = () => {
    if (formData.customerType === "lead") return getSelectedLead()?.name || "";
    if (formData.customerType === "student") return selectedStudent?.fullName || selectedStudent?.name || formData.walkInName;
    return formData.walkInName;
  };
  const getCustomerPhone = () => {
    if (formData.customerType === "lead") return getSelectedLead()?.phone || "";
    if (formData.customerType === "student") return selectedStudent?.phone || formData.walkInPhone;
    return formData.walkInPhone;
  };
  const getCustomerEmail = () => {
    if (formData.customerType === "lead") return getSelectedLead()?.email || "";
    if (formData.customerType === "student") return selectedStudent?.email || formData.walkInEmail;
    return formData.walkInEmail;
  };

  const tierLabel = (t: number | null) => t != null && t >= 2 ? "PREMIUM" : t != null && t >= 1 ? "CLASSIC" : t === 0 ? "ESSENTIAL" : null;
  const tierGradient = (t: number | null) => {
    if (t == null) return "";
    if (t >= 2) return "from-amber-500 via-yellow-400 to-orange-500";
    if (t >= 1) return "from-slate-400 via-gray-300 to-slate-500";
    return "from-violet-500 via-purple-400 to-indigo-500";
  };
  const tierBorder = (t: number | null) => {
    if (t == null) return "border-slate-200";
    if (t >= 2) return "border-amber-300";
    if (t >= 1) return "border-slate-300";
    return "border-violet-300";
  };
  const tierAccent = (t: number | null) => {
    if (t == null) return "text-indigo-600";
    if (t >= 2) return "text-amber-600";
    if (t >= 1) return "text-slate-600";
    return "text-violet-600";
  };
  const tierBg = (t: number | null) => {
    if (t == null) return "bg-indigo-50";
    if (t >= 2) return "bg-gradient-to-br from-amber-50 via-yellow-50/50 to-orange-50";
    if (t >= 1) return "bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100";
    return "bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50";
  };
  const tierIcon = (t: number | null) => {
    if (t == null) return null;
    if (t >= 2) return Crown;
    if (t >= 1) return Gem;
    return Star;
  };
  const tierBadgeBg = (t: number | null) => {
    if (t == null) return "";
    if (t >= 2) return "bg-gradient-to-r from-amber-500 to-yellow-500 text-white";
    if (t >= 1) return "bg-gradient-to-r from-slate-500 to-gray-500 text-white";
    return "bg-gradient-to-r from-violet-500 to-purple-500 text-white";
  };
  const hasPlan = selectedPlanId != null && selectedPlanTier != null;
  const TierIconComponent = tierIcon(selectedPlanTier);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2" data-testid="text-booking-title">
            <FileText className="w-7 h-7 text-indigo-500" />
            Generate New Booking
          </h1>
          <p className="text-sm text-slate-500 mt-1">Create a booking for walk-in customer, lead, or registered student</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2 px-4">
        {STEP_CONFIG.map((s, idx) => {
          const stepNum = idx + 1;
          const isActive = step === stepNum;
          const isCompleted = step > stepNum;
          const StepIcon = s.icon;
          return (
            <div key={stepNum} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isCompleted
                      ? "bg-green-500 text-white shadow-md shadow-green-200"
                      : isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-100"
                        : "bg-slate-100 text-slate-400 border-2 border-slate-200"
                  }`}
                  data-testid={`step-indicator-${stepNum}`}
                >
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                </div>
                <span className={`text-xs mt-1.5 font-medium ${isActive ? "text-indigo-600" : isCompleted ? "text-green-600" : "text-slate-400"}`}>
                  {s.label}
                </span>
              </div>
              {idx < 4 && (
                <div className={`flex-1 h-0.5 mx-3 mt-[-14px] rounded-full transition-all duration-500 ${step > stepNum ? "bg-green-400" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          <Card className="border shadow-sm">
            <CardContent className="pt-6">
              {step === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-1">
                    <UserPlus className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-800">
                      {isRegularUser ? "Your Details" : "Customer Information"}
                    </h3>
                  </div>

                  {isRegularUser ? (
                    <div className="space-y-4">
                      <div className="p-5 bg-indigo-50 rounded-xl border border-indigo-200">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center ring-2 ring-indigo-200">
                            <User className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800" data-testid="text-profile-name">{user?.name || "—"}</p>
                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                              {user?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>}
                              {user?.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone}</span>}
                            </div>
                          </div>
                          <Badge className="ml-auto bg-indigo-100 text-indigo-700 border-indigo-200">Profile</Badge>
                        </div>
                        <p className="text-xs text-indigo-600">Your profile details will be used for this booking. You can update them below if needed.</p>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="walkInName" className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                id="walkInName"
                                value={formData.walkInName}
                                onChange={(e) => setFormData(prev => ({ ...prev, walkInName: e.target.value, residentName: e.target.value }))}
                                className="pl-10 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                                placeholder="Your full name"
                                data-testid="input-user-name"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="walkInPhone" className="text-sm font-medium text-slate-700">Phone <span className="text-red-500">*</span></Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                id="walkInPhone"
                                value={formData.walkInPhone}
                                onChange={(e) => setFormData(prev => ({ ...prev, walkInPhone: e.target.value, residentPhone: e.target.value }))}
                                className="pl-10 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                                placeholder="Your phone number"
                                data-testid="input-user-phone"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="walkInEmail" className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              id="walkInEmail"
                              type="email"
                              required
                              value={formData.walkInEmail}
                              onChange={(e) => setFormData(prev => ({ ...prev, walkInEmail: e.target.value, residentEmail: e.target.value }))}
                              className="pl-10 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                              placeholder="Your email address"
                              data-testid="input-user-email"
                            />
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  ) : (
                  <>
                  <div>
                    <Label className="text-sm font-medium text-slate-600 mb-3 block">Customer Type</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: "walk_in", label: "Walk-in Customer", desc: "New walk-in visitor", icon: User },
                        ...((isAdmin || isSalesExec || isReceptionist) ? [{ value: "lead", label: "Convert Lead", desc: "Existing lead from CRM", icon: Users }] : []),
                        ...((isAdmin || isReceptionist) ? [{ value: "student", label: "Registered Student", desc: "Already registered", icon: Shield }] : []),
                      ].map(opt => {
                        const OptIcon = opt.icon;
                        const selected = formData.customerType === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => handleCustomerTypeChange(opt.value)}
                            className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                              selected
                                ? "border-indigo-500 bg-indigo-50 shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            }`}
                            data-testid={`radio-${opt.value}`}
                          >
                            {selected && (
                              <div className="absolute top-2 right-2">
                                <CheckCircle className="h-4 w-4 text-indigo-600" />
                              </div>
                            )}
                            <OptIcon className={`h-6 w-6 mb-2 ${selected ? "text-indigo-600" : "text-slate-400"}`} />
                            <p className={`font-semibold text-sm ${selected ? "text-indigo-700" : "text-slate-700"}`}>{opt.label}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formData.customerType === "walk_in" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="walkInName" className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></Label>
                          <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              id="walkInName"
                              value={formData.walkInName}
                              onChange={(e) => setFormData(prev => ({ ...prev, walkInName: e.target.value }))}
                              className="pl-10 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                              placeholder="Enter customer name"
                              data-testid="input-walkin-name"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="walkInPhone" className="text-sm font-medium text-slate-700">Phone <span className="text-red-500">*</span></Label>
                          <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                              id="walkInPhone"
                              value={formData.walkInPhone}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, walkInPhone: val }));
                                debouncedLeadMatch(val, formData.walkInEmail);
                              }}
                              className="pl-10 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                              placeholder="Enter phone number"
                              data-testid="input-walkin-phone"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="walkInEmail" className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            id="walkInEmail"
                            type="email"
                            required
                            value={formData.walkInEmail}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => ({ ...prev, walkInEmail: val }));
                              debouncedLeadMatch(formData.walkInPhone, val);
                            }}
                            className="pl-10 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Enter email address"
                            data-testid="input-walkin-email"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {formData.customerType === "walk_in" && matchedLeadInfo?.matched && matchedLeadInfo.lead && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 shadow-sm"
                      data-testid="matched-lead-card"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Users className="h-5 w-5 text-amber-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-amber-900 text-sm">Existing Lead Found</h4>
                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                              {matchedLeadInfo.lead.status?.replace(/_/g, " ")}
                            </Badge>
                            {matchedLeadInfo.lead.priority && (
                              <Badge variant="outline" className={`text-xs ${
                                matchedLeadInfo.lead.priority === "hot" ? "bg-red-100 text-red-800 border-red-300" :
                                matchedLeadInfo.lead.priority === "warm" ? "bg-orange-100 text-orange-800 border-orange-300" :
                                "bg-blue-100 text-blue-800 border-blue-300"
                              }`}>
                                {matchedLeadInfo.lead.priority}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-amber-800 mt-1">
                            <span className="font-medium">{matchedLeadInfo.lead.name}</span>
                            {matchedLeadInfo.lead.phone && <span className="ml-2 text-amber-600">{matchedLeadInfo.lead.phone}</span>}
                          </p>
                          <div className="mt-2 space-y-1">
                            {matchedLeadInfo.lead.createdByName && (
                              <p className="text-xs text-amber-700">
                                <span className="font-medium">Lead created by:</span> {matchedLeadInfo.lead.createdByName}
                              </p>
                            )}
                            {matchedLeadInfo.lead.assignedToName && (
                              <p className="text-xs text-amber-700">
                                <span className="font-medium">Assigned to:</span> {matchedLeadInfo.lead.assignedToName}
                              </p>
                            )}
                            {matchedLeadInfo.lead.convertedByName && (
                              <p className="text-xs text-green-700">
                                <span className="font-medium">Booking completed by:</span> {matchedLeadInfo.lead.convertedByName}
                              </p>
                            )}
                            {matchedLeadInfo.lead.source && (
                              <p className="text-xs text-amber-600">
                                <span className="font-medium">Source:</span> {matchedLeadInfo.lead.source}
                              </p>
                            )}
                          </div>
                          {matchedLeadInfo.booking && (
                            <div className="mt-2 p-2 bg-white/60 rounded-lg border border-amber-200/50">
                              <p className="text-xs font-medium text-amber-900">Linked Booking</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {matchedLeadInfo.booking.status}
                                </Badge>
                                {matchedLeadInfo.booking.confirmedBy && (
                                  <span className="text-xs text-green-700">Confirmed by {matchedLeadInfo.booking.confirmedBy}</span>
                                )}
                              </div>
                            </div>
                          )}
                          {matchedLeadInfo.recentActivities?.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-amber-200/50">
                              <p className="text-xs font-medium text-amber-800 mb-1">Recent Activity</p>
                              {matchedLeadInfo.recentActivities.slice(0, 3).map((act: any, idx: number) => (
                                <p key={idx} className="text-xs text-amber-600 truncate">
                                  {act.type?.replace(/_/g, " ")} — {act.notes || act.description || ""}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {matchingLead && formData.customerType === "walk_in" && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 px-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Checking for existing lead...
                    </div>
                  )}

                  {formData.customerType === "lead" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Select Lead <span className="text-red-500">*</span></Label>
                        <Select value={formData.leadId} onValueChange={handleLeadSelect}>
                          <SelectTrigger className="bg-white border-slate-300" data-testid="select-lead">
                            <SelectValue placeholder="Search and select a lead..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {leads.length === 0 ? (
                              <div className="p-3 text-sm text-slate-500 text-center">No active leads available</div>
                            ) : (
                              leads.map((lead) => (
                                <SelectItem key={lead.id} value={lead.id}>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{lead.name}</span>
                                    <span className="text-slate-400">·</span>
                                    <span className="text-slate-500">{lead.phone}</span>
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      {getSelectedLead() && (
                        <div className="p-4 bg-white rounded-lg border border-indigo-100 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                              <User className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{getSelectedLead()?.name}</p>
                              <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                                <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{getSelectedLead()?.phone}</span>
                                {getSelectedLead()?.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{getSelectedLead()?.email}</span>}
                              </div>
                            </div>
                          </div>
                          {getSelectedLead()?.propertyName && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-indigo-600">
                              <MapPin className="h-3 w-3" />
                              <span>Interested in: {getSelectedLead()?.propertyName}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {formData.customerType === "student" && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5 text-indigo-500" />
                          <Label className="text-sm font-medium text-slate-700">Search Registered Students</Label>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => fetchRegisteredStudents(studentSearch || undefined)}
                          disabled={studentSearchLoading}
                          className="text-xs text-indigo-600 hover:text-indigo-700"
                          data-testid="button-refresh-students"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${studentSearchLoading ? "animate-spin" : ""}`} />
                          Refresh
                        </Button>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Search by name, phone, or email..."
                          value={studentSearch}
                          onChange={(e) => {
                            setStudentSearch(e.target.value);
                            const val = e.target.value;
                            if (val.length >= 2 || val.length === 0) {
                              fetchRegisteredStudents(val || undefined);
                            }
                          }}
                          className="pl-10 bg-white border-slate-300 focus:border-indigo-500"
                          data-testid="input-student-search"
                        />
                      </div>

                      {studentSearchError && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-800">Connection Issue</p>
                            <p className="text-xs text-amber-600 mt-0.5">{studentSearchError}</p>
                          </div>
                        </div>
                      )}

                      {studentSearchLoading && (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="h-5 w-5 text-indigo-500 animate-spin mr-2" />
                          <span className="text-sm text-slate-500">Fetching registered students...</span>
                        </div>
                      )}

                      {!studentSearchLoading && !studentSearchError && registeredStudents.length === 0 && (
                        <div className="text-center py-6">
                          <GraduationCap className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">
                            {studentSearch ? "No students found matching your search" : "No registered students found"}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">Try searching by name, phone number, or email</p>
                        </div>
                      )}

                      {!studentSearchLoading && registeredStudents.length > 0 && (
                        <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                          {registeredStudents.map((student) => {
                            const isSelected = selectedStudent?.id === student.id;
                            const displayName = student.fullName || student.name || "Unknown";
                            const hasBooking = student.hasActiveBooking;
                            return (
                              <button
                                key={student.id}
                                type="button"
                                onClick={() => {
                                  if (hasBooking) {
                                    toast({
                                      title: "Already Booked",
                                      description: `${displayName} already has an active booking${student.activeBookingCode ? ` (${student.activeBookingCode})` : ""}. Cannot create a duplicate booking.`,
                                      variant: "destructive",
                                    });
                                    return;
                                  }
                                  handleStudentSelect(student);
                                }}
                                className={`w-full p-3 rounded-lg border-2 text-left transition-all duration-200 ${
                                  hasBooking
                                    ? "border-orange-200 bg-orange-50/50 opacity-70 cursor-not-allowed"
                                    : isSelected
                                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                                }`}
                                data-testid={`student-card-${student.id}`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                                    hasBooking ? "bg-orange-100 text-orange-600" : isSelected ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600"
                                  }`}>
                                    {displayName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className={`font-semibold text-sm truncate ${hasBooking ? "text-orange-700" : isSelected ? "text-indigo-700" : "text-slate-800"}`}>
                                        {displayName}
                                      </p>
                                      {hasBooking && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                                          <AlertCircle className="h-3 w-3" />
                                          Active Booking
                                        </span>
                                      )}
                                      {isSelected && !hasBooking && <CheckCircle className="h-4 w-4 text-indigo-600 shrink-0" />}
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                                      {student.phone && (
                                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{student.phone}</span>
                                      )}
                                      {student.email && (
                                        <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{student.email}</span>
                                      )}
                                    </div>
                                    {hasBooking && student.activeBookingCode && (
                                      <p className="text-[11px] text-orange-600 mt-1 font-medium">
                                        Booking: {student.activeBookingCode}
                                      </p>
                                    )}
                                    {(student.collegeName || student.college || student.instituteName || student.course || student.courseName) && (
                                      <p className="text-xs text-slate-400 mt-1 truncate">
                                        {[student.collegeName || student.college || student.instituteName, student.course || student.courseName, student.courseYear || student.year].filter(Boolean).join(" · ")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {selectedStudent && (
                        <div className="p-4 bg-white rounded-lg border border-indigo-100 shadow-sm mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-sm font-semibold text-slate-700">Selected Student</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-slate-400 text-xs">Name</span>
                              <p className="font-medium text-slate-800">{selectedStudent.fullName || selectedStudent.name}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-xs">Phone</span>
                              <p className="font-medium text-slate-800">{selectedStudent.phone || "—"}</p>
                            </div>
                            {(selectedStudent.email || selectedStudent.studentEmail) && (
                              <div>
                                <span className="text-slate-400 text-xs">Email</span>
                                <p className="font-medium text-slate-800">{selectedStudent.email || selectedStudent.studentEmail}</p>
                              </div>
                            )}
                            {(selectedStudent.collegeName || selectedStudent.college || selectedStudent.instituteName) && (
                              <div>
                                <span className="text-slate-400 text-xs">College</span>
                                <p className="font-medium text-slate-800">{selectedStudent.collegeName || selectedStudent.college || selectedStudent.instituteName}</p>
                              </div>
                            )}
                            {(selectedStudent.course || selectedStudent.courseName) && (
                              <div>
                                <span className="text-slate-400 text-xs">Course</span>
                                <p className="font-medium text-slate-800">{[selectedStudent.course || selectedStudent.courseName, selectedStudent.courseYear || selectedStudent.year].filter(Boolean).join(" · ")}</p>
                              </div>
                            )}
                            {selectedStudent.dietary && (
                              <div>
                                <span className="text-slate-400 text-xs">Dietary</span>
                                <p className="font-medium text-slate-800">{selectedStudent.dietary}</p>
                              </div>
                            )}
                            {selectedStudent.parentName && (
                              <div>
                                <span className="text-slate-400 text-xs">Parent</span>
                                <p className="font-medium text-slate-800">{selectedStudent.parentName}{selectedStudent.parentPhone ? ` (${selectedStudent.parentPhone})` : ""}</p>
                              </div>
                            )}
                            {selectedStudent.room && (
                              <div>
                                <span className="text-slate-400 text-xs">HMS Room</span>
                                <p className="font-medium text-slate-800">{selectedStudent.room}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg">
                        <ExternalLink className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <p className="text-xs text-indigo-600">
                          Students are fetched from the Hostel Flow registration system
                        </p>
                      </div>
                    </motion.div>
                  )}
                  </>
                  )}
                  </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  {prefilledFromProperty && formData.propertyId && formData.roomTypeId && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800">Property & bed auto-selected from property page</p>
                        <p className="text-xs text-green-600 mt-0.5">
                          {properties.find(p => p.id === formData.propertyId)?.name} · Bed #{formData.residentBedNo || selectedBedId}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Property & Room Selection</h3>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-slate-700">Select Property <span className="text-red-500">*</span></Label>
                    <Select value={formData.propertyId} onValueChange={handlePropertyChange}>
                      <SelectTrigger className="bg-white border-slate-300 h-12" data-testid="select-property">
                        <SelectValue placeholder="Choose a property..." />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-indigo-500" />
                              <span className="font-medium">{property.name}</span>
                              {property.city && (
                                <>
                                  <span className="text-slate-400">·</span>
                                  <span className="text-slate-500">{property.city}</span>
                                </>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.propertyId && roomTypes.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-slate-700">Select Room Type <span className="text-red-500">*</span></Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {roomTypes.map((room) => {
                          const selected = formData.roomTypeId === room.id;
                          const soldOut = room.availableBeds === 0;
                          return (
                            <button
                              key={room.id}
                              type="button"
                              disabled={soldOut}
                              onClick={() => !soldOut && handleRoomTypeChange(room.id)}
                              className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                                soldOut
                                  ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50"
                                  : selected
                                    ? "border-indigo-500 bg-indigo-50 shadow-sm"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                              data-testid={`room-type-${room.id}`}
                            >
                              {selected && (
                                <div className="absolute top-3 right-3">
                                  <CheckCircle className="h-4 w-4 text-indigo-600" />
                                </div>
                              )}
                              <div className="flex items-center gap-2 mb-2">
                                <BedDouble className={`h-5 w-5 ${selected ? "text-indigo-600" : "text-slate-400"}`} />
                                <span className={`font-semibold ${selected ? "text-indigo-700" : "text-slate-700"}`}>{room.customName || room.name}</span>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-slate-500">{room.occupancy}-sharing</span>
                                <Badge variant={soldOut ? "destructive" : "secondary"} className="text-xs">
                                  {soldOut ? "Sold Out" : `${room.availableBeds} beds left`}
                                </Badge>
                              </div>
                              {(() => {
                                const prop = getSelectedProperty();
                                const isAcademic = prop?.bookingMode === "academic_year";
                                if (isAcademic) {
                                  const annualPrice = room.academicYearPrice || (room.basePrice ? room.basePrice * 11 : 0);
                                  return (
                                    <>
                                      <p className="text-lg font-bold text-indigo-600 mt-2">
                                        {annualPrice > 0 ? `₹${annualPrice.toLocaleString("en-IN")}` : "—"}<span className="text-xs font-normal text-slate-400">/year</span>
                                      </p>
                                      {room.basePrice > 0 && (
                                        <p className="text-xs text-slate-500">
                                          ≈ ₹{(room.academicYearPrice ? Math.round(room.academicYearPrice / 11) : room.basePrice).toLocaleString("en-IN")}/month
                                        </p>
                                      )}
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <p className="text-lg font-bold text-indigo-600 mt-2">
                                      {room.basePrice > 0 ? `₹${room.basePrice.toLocaleString("en-IN")}` : "—"}<span className="text-xs font-normal text-slate-400">/month</span>
                                    </p>
                                    {room.academicYearPrice && room.academicYearPrice > 0 && (
                                      <p className="text-xs text-slate-500">
                                        ₹{room.academicYearPrice.toLocaleString("en-IN")}/year
                                      </p>
                                    )}
                                  </>
                                );
                              })()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {formData.propertyId && formData.roomTypeId && floors.length > 0 && (
                    <div className="space-y-4 p-5 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 rounded-xl border border-indigo-100">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-indigo-500" />
                        <Label className="text-sm font-semibold text-slate-700">Select Floor, Room & Bed <span className="text-slate-400 font-normal">(optional)</span></Label>
                      </div>
                      <p className="text-xs text-slate-500 -mt-2">Click a floor to expand it, then select an available bed.</p>

                      {selectedBedInfo && (
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border-2 border-indigo-300 shadow-sm">
                          <CheckCircle className="h-5 w-5 text-indigo-600 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-slate-800">Bed {selectedBedInfo.bedNumber} selected</p>
                            <p className="text-xs text-slate-500">
                              {floors.find((f: any) => f.id === selectedFloorId)?.name || "Floor"} ·
                              {selectedBedInfo.monthlyPrice ? ` ₹${selectedBedInfo.monthlyPrice.toLocaleString()}/mo` : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setSelectedBedId(""); setSelectedBedInfo(null); setSelectedFloorId(""); setSelectedRoomId(""); setFormData(prev => ({ ...prev, residentRoomNo: "", residentBedNo: "" })); }}
                            className="ml-auto text-xs text-slate-400 hover:text-red-500"
                            data-testid="button-clear-bed"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      <div className="space-y-3">
                        {(() => {
                          const selectedRT = roomTypes.find((rt: any) => rt.id === formData.roomTypeId);
                          const selectedOccupancy = selectedRT?.occupancy || 1;
                          const hasAnyMatchingBeds = floors.some((floor: any) => {
                            const checkBedMatch = (bed: any, room: any) => {
                              if (bed.roomTypeId === formData.roomTypeId) return true;
                              if (room?.typology?.includes("+")) {
                                const parts = room.typology.split("+").map((p: string) => parseInt(p));
                                const sectionIdx = parts.indexOf(selectedOccupancy);
                                if (sectionIdx >= 0) {
                                  const sectionLetter = String.fromCharCode(65 + sectionIdx);
                                  return bed.bedNumber?.includes(`${room.roomNumber}${sectionLetter}`);
                                }
                              }
                              return false;
                            };
                            const matchedRoomBeds = (floor.rooms || []).flatMap((r: any) => (r.beds || []).filter((b: any) => checkBedMatch(b, r)));
                            const matchedOrphanBeds = (floor.beds || []).filter((b: any) => b.roomTypeId === formData.roomTypeId);
                            return matchedRoomBeds.length > 0 || matchedOrphanBeds.length > 0;
                          });
                          if (!hasAnyMatchingBeds) {
                            return (
                              <div className="text-center py-4 text-slate-400 text-sm border-2 border-dashed rounded-lg" data-testid="no-matching-beds-message">
                                No beds available for the selected room type on any floor. Bed assignment can be done later.
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {floors.map((floor: any) => {
                          const selectedRT = roomTypes.find((rt: any) => rt.id === formData.roomTypeId);
                          const selectedOccupancy = selectedRT?.occupancy || 1;

                          const bedMatchesSelectedType = (bed: any, room: any) => {
                            if (bed.roomTypeId === formData.roomTypeId) return true;
                            if (room?.typology?.includes("+")) {
                              const parts = room.typology.split("+").map((p: string) => parseInt(p));
                              const sectionIdx = parts.indexOf(selectedOccupancy);
                              if (sectionIdx >= 0) {
                                const sectionLetter = String.fromCharCode(65 + sectionIdx);
                                return bed.bedNumber?.includes(`${room.roomNumber}${sectionLetter}`);
                              }
                            }
                            return false;
                          };

                          const roomMatchesSelectedType = (room: any) => {
                            if (room.roomTypeId === formData.roomTypeId) return true;
                            if ((room.beds || []).some((b: any) => b.roomTypeId === formData.roomTypeId)) return true;
                            if (room.typology?.includes("+")) {
                              const parts = room.typology.split("+").map((p: string) => parseInt(p));
                              return parts.includes(selectedOccupancy);
                            }
                            return false;
                          };

                          const floorRooms = (floor.rooms || []).filter((r: any) => roomMatchesSelectedType(r));
                          const roomBedIds = new Set(floorRooms.flatMap((r: any) => (r.beds || []).map((b: any) => b.id)));
                          const allFloorBeds = floorRooms.flatMap((r: any) => (r.beds || []).filter((b: any) => bedMatchesSelectedType(b, r)))
                            .concat((floor.beds || []).filter((b: any) => b.roomTypeId === formData.roomTypeId && !roomBedIds.has(b.id)));
                          const availBedCount = allFloorBeds.filter((b: any) => b.status === "available" && !b.held).length;
                          const totalBedCount = allFloorBeds.length;
                          if (totalBedCount === 0) return null;
                          const isExpanded = expandedFloors.has(floor.id);
                          const orphanBeds = (floor.beds || []).filter((b: any) => b.roomTypeId === formData.roomTypeId && !roomBedIds.has(b.id));

                          return (
                            <div key={floor.id} className="border-2 border-slate-200 rounded-xl overflow-hidden bg-white" data-testid={`booking-floor-${floor.id}`}>
                              <button
                                type="button"
                                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
                                onClick={() => {
                                  setExpandedFloors(prev => {
                                    const next = new Set(prev);
                                    if (next.has(floor.id)) next.delete(floor.id);
                                    else next.add(floor.id);
                                    return next;
                                  });
                                }}
                                data-testid={`button-expand-floor-${floor.id}`}
                              >
                                <div className="w-10 h-10 rounded-full border-2 border-amber-400 flex items-center justify-center text-sm font-bold text-slate-700">
                                  {floor.floorNumber}
                                </div>
                                <div className="flex-1">
                                  <p className="font-semibold text-sm text-slate-800">{floor.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {floorRooms.length} room{floorRooms.length !== 1 ? "s" : ""} · <span className="font-semibold text-emerald-600">{availBedCount}</span> of {totalBedCount} beds available
                                  </p>
                                </div>
                                <Badge variant="outline" className={`text-xs px-2.5 py-1 ${availBedCount > 0 ? "border-emerald-300 text-emerald-700 bg-emerald-50" : "border-slate-300 text-slate-500"}`}>
                                  {availBedCount} open
                                </Badge>
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                              </button>

                              {isExpanded && (
                                <div className="px-4 pb-4 space-y-3">
                                  {floorRooms.length === 0 && orphanBeds.length === 0 && (
                                    <div className="text-center py-4 text-slate-400 text-sm border-2 border-dashed rounded-lg">
                                      No rooms on this floor
                                    </div>
                                  )}

                                  {floorRooms.map((room: any) => {
                                    const roomBeds = (room.beds || []).filter((b: any) => bedMatchesSelectedType(b, room));
                                    if (roomBeds.length === 0) return null;
                                    const isCombo = room.typology?.includes("+");
                                    const allAvail = roomBeds.every((b: any) => b.status === "available");
                                    const allOccupied = roomBeds.every((b: any) => b.status === "occupied");
                                    const roomBorderColor = allOccupied ? "border-rose-200 bg-rose-50/30" : allAvail ? "border-emerald-200 bg-emerald-50/20" : "border-amber-200 bg-amber-50/20";

                                    const sections = isCombo ? room.typology.split("+").map((p: string, i: number) => ({
                                      label: String.fromCharCode(65 + i),
                                      bedCount: parseInt(p),
                                      beds: roomBeds.filter((b: any) => b.bedNumber.includes(`${room.roomNumber}${String.fromCharCode(65 + i)}`)),
                                    })) : null;

                                    const renderBedCell = (bed: any) => {
                                      const isHeld = bed.held && selectedBedId !== bed.id;
                                      const isAvail = bed.status === "available" && !isHeld;
                                      const isSelected = selectedBedId === bed.id;
                                      const isBlocked = bed.status === "blocked";
                                      const statusColor = isSelected
                                        ? "bg-indigo-500 ring-2 ring-indigo-300 ring-offset-1"
                                        : isHeld ? "bg-orange-400"
                                        : isAvail ? "bg-emerald-500 hover:bg-emerald-600 cursor-pointer"
                                        : bed.status === "occupied" ? "bg-rose-500"
                                        : bed.status === "reserved" ? "bg-amber-400"
                                        : isBlocked ? "bg-red-700"
                                        : "bg-slate-400";

                                      return (
                                        <button
                                          key={bed.id}
                                          type="button"
                                          disabled={!isAvail && !isSelected}
                                          title={isHeld ? "Booking in progress by another user" : undefined}
                                          onClick={() => {
                                            if (isSelected) {
                                              if (heldBedId === bed.id) releaseBedHold(bed.id);
                                              setSelectedBedId(""); setSelectedBedInfo(null); setSelectedFloorId(""); setSelectedRoomId("");
                                              setFormData(prev => ({ ...prev, residentRoomNo: "", residentBedNo: "", residentAccommodationType: "" }));
                                            } else if (isAvail) {
                                              if (heldBedId) releaseBedHold(heldBedId);
                                              setSelectedBedId(bed.id); setSelectedBedInfo(bed);
                                              setSelectedFloorId(floor.id); setSelectedRoomId(room.id);
                                              holdBedForBooking(bed.id);
                                              const accomType = getAccommodationLabel(bed, room);
                                              setFormData(prev => ({ ...prev, residentRoomNo: room.roomNumber, residentBedNo: bed.bedNumber, residentAccommodationType: accomType }));
                                            }
                                          }}
                                          className={`rounded-lg w-14 h-14 flex flex-col items-center justify-center text-white text-xs font-medium transition-all ${statusColor} ${!isAvail && !isSelected ? "opacity-60 cursor-not-allowed" : ""}`}
                                          data-testid={`bed-select-${bed.id}`}
                                        >
                                          {isBlocked ? <Ban className="w-4 h-4 mb-0.5" /> : <BedDouble className="w-4 h-4 mb-0.5" />}
                                          <span className="text-[9px] leading-tight truncate max-w-full px-0.5">{bed.bedNumber}</span>
                                        </button>
                                      );
                                    };

                                    return (
                                      <div key={room.id} className={`border rounded-lg p-3 transition-colors ${roomBorderColor}`} data-testid={`booking-room-${room.id}`}>
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                          <DoorOpen className="w-4 h-4 text-indigo-600" />
                                          <span className="font-semibold text-sm text-slate-800">Room {room.roomNumber}</span>
                                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{room.typology}</Badge>
                                          {room.hasSharedWashroom && (
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-600 gap-0.5">
                                              <Bath className="w-2.5 h-2.5" />Shared WC
                                            </Badge>
                                          )}
                                        </div>

                                        {isCombo && sections ? (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {sections.filter((section: any) => section.beds.length > 0).map((section: any) => (
                                              <div key={section.label} className="bg-white/80 rounded border border-slate-200 p-2">
                                                <p className="text-[10px] font-medium text-slate-500 mb-1.5">
                                                  {room.roomNumber}{section.label} — {section.bedCount} bed{section.bedCount > 1 ? "s" : ""}
                                                </p>
                                                <div className="flex gap-1.5 flex-wrap">
                                                  {section.beds.map(renderBedCell)}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        ) : (
                                          <div className="flex gap-1.5 flex-wrap">
                                            {roomBeds.map(renderBedCell)}
                                            {roomBeds.length === 0 && <span className="text-xs text-slate-400 py-2">No beds</span>}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {orphanBeds.length > 0 && (
                                    <div className="border border-slate-200 rounded-lg p-3">
                                      <p className="text-xs font-medium text-slate-500 mb-2">Unassigned Beds ({orphanBeds.length})</p>
                                      <div className="flex gap-1.5 flex-wrap">
                                        {orphanBeds.map((bed: any) => {
                                          const isOrphanHeld = bed.held && selectedBedId !== bed.id;
                                          const isAvail = bed.status === "available" && !isOrphanHeld;
                                          const isSelected = selectedBedId === bed.id;
                                          const statusColor = isSelected
                                            ? "bg-indigo-500 ring-2 ring-indigo-300 ring-offset-1"
                                            : isOrphanHeld ? "bg-orange-400"
                                            : isAvail ? "bg-emerald-500 hover:bg-emerald-600 cursor-pointer"
                                            : "bg-slate-400";
                                          return (
                                            <button
                                              key={bed.id}
                                              type="button"
                                              disabled={!isAvail && !isSelected}
                                              title={isOrphanHeld ? "Booking in progress by another user" : undefined}
                                              onClick={() => {
                                                if (isSelected) {
                                                  if (heldBedId === bed.id) releaseBedHold(bed.id);
                                                  setSelectedBedId(""); setSelectedBedInfo(null); setSelectedFloorId(""); setSelectedRoomId("");
                                                  setFormData(prev => ({ ...prev, residentRoomNo: "", residentAccommodationType: "" }));
                                                } else if (isAvail) {
                                                  if (heldBedId) releaseBedHold(heldBedId);
                                                  setSelectedBedId(bed.id); setSelectedBedInfo(bed);
                                                  setSelectedFloorId(floor.id); setSelectedRoomId("");
                                                  holdBedForBooking(bed.id);
                                                  setFormData(prev => ({ ...prev, residentRoomNo: bed.bedNumber, residentAccommodationType: "single" }));
                                                }
                                              }}
                                              className={`rounded-lg w-14 h-14 flex flex-col items-center justify-center text-white text-xs font-medium transition-all ${statusColor} ${!isAvail && !isSelected ? "opacity-60 cursor-not-allowed" : ""}`}
                                              data-testid={`bed-select-${bed.id}`}
                                            >
                                              <BedDouble className="w-4 h-4 mb-0.5" />
                                              <span className="text-[9px] leading-tight truncate max-w-full px-0.5">{bed.bedNumber}</span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {formData.propertyId && formData.roomTypeId && floorsLoading && (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                      <span className="ml-2 text-xs text-slate-500">Loading floors & beds...</span>
                    </div>
                  )}

                  {formData.propertyId && formData.roomTypeId && !floorsLoading && floors.length === 0 && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-sm text-amber-700">No floors configured for this property yet. Bed assignment can be done later from the admin panel.</p>
                    </div>
                  )}

                  {formData.propertyId && loading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      <span className="ml-2 text-sm text-slate-500">Loading room types...</span>
                    </div>
                  )}

                  {getSelectedProperty()?.bookingMode === "academic_year" && formData.roomTypeId && (
                    <div className="space-y-4 p-5 bg-purple-50 rounded-xl border border-purple-200">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-purple-600" />
                        <Label className="text-sm font-medium text-purple-700">Academic Year Booking</Label>
                      </div>
                      <p className="text-xs text-purple-600">This property uses fixed annual pricing (11 months).</p>
                      <div>
                        <Label className="text-sm text-slate-600">Academic Year Period</Label>
                        <select
                          value={formData.academicYearPeriod}
                          onChange={(e) => setFormData(prev => ({ ...prev, academicYearPeriod: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                          data-testid="select-academic-year-fixed"
                        >
                          {(() => {
                            const currentYear = new Date().getFullYear();
                            return [0, 1, 2].map(offset => {
                              const startYear = currentYear + offset;
                              const label = `${startYear}-${startYear + 1}`;
                              return <option key={label} value={label}>{label}</option>;
                            });
                          })()}
                        </select>
                      </div>
                    </div>
                  )}

                  {getSelectedProperty()?.bookingMode === "monthly" && formData.roomTypeId && (
                    <div className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
                      <Label className="text-sm font-medium text-slate-700">Stay Plan</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: "academic_year", label: "Full Academic Year", desc: "11 months" },
                          { value: "monthly", label: "Monthly Booking", desc: "Custom duration" },
                        ].map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, stayPlanType: opt.value }))}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              formData.stayPlanType === opt.value
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            }`}
                            data-testid={`radio-${opt.value}`}
                          >
                            <p className={`font-medium text-sm ${formData.stayPlanType === opt.value ? "text-indigo-700" : "text-slate-700"}`}>{opt.label}</p>
                            <p className="text-xs text-slate-500">{opt.desc}</p>
                          </button>
                        ))}
                      </div>

                      {formData.stayPlanType === "academic_year" && (
                        <div className="mt-3">
                          <Label className="text-sm text-slate-600">Academic Year</Label>
                          <select
                            value={formData.academicYearPeriod}
                            onChange={(e) => setFormData(prev => ({ ...prev, academicYearPeriod: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            data-testid="select-academic-year"
                          >
                            {(() => {
                              const currentYear = new Date().getFullYear();
                              return [0, 1, 2].map(offset => {
                                const startYear = currentYear + offset;
                                const label = `${startYear}-${startYear + 1}`;
                                return <option key={label} value={label}>{label}</option>;
                              });
                            })()}
                          </select>
                        </div>
                      )}

                      {formData.stayPlanType === "monthly" && (
                        <div className="grid grid-cols-3 gap-4 mt-3">
                          <div className="space-y-2">
                            <Label className="text-sm text-slate-600">Check-in Date</Label>
                            <Input
                              type="date"
                              value={formData.checkInDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, checkInDate: e.target.value }))}
                              className="bg-white border-slate-300"
                              data-testid="input-checkin-date"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-slate-600">Duration (Months)</Label>
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              value={formData.durationMonths}
                              onChange={(e) => setFormData(prev => ({ ...prev, durationMonths: parseInt(e.target.value) || 1 }))}
                              className="bg-white border-slate-300"
                              data-testid="input-duration"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-slate-600">Check-out Date</Label>
                            <Input
                              type="date"
                              value={formData.checkOutDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, checkOutDate: e.target.value }))}
                              className="bg-white border-slate-300"
                              data-testid="input-checkout-date"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {availability && (
                    <div className={`p-4 rounded-xl border flex items-center gap-3 ${
                      availability.availableBeds > 0
                        ? "bg-emerald-50 border-emerald-200"
                        : "bg-red-50 border-red-200"
                    }`}>
                      <BedDouble className={`h-5 w-5 ${availability.availableBeds > 0 ? "text-emerald-500" : "text-red-500"}`} />
                      <div>
                        <p className={`font-medium text-sm ${availability.availableBeds > 0 ? "text-emerald-700" : "text-red-700"}`}>
                          {availability.availableBeds > 0
                            ? `${availability.availableBeds} of ${availability.totalBeds} beds available`
                            : "No beds available for this room type"}
                        </p>
                        <p className="text-xs text-slate-500">{availability.bookedBeds} beds currently booked</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Resident Details</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-5">
                      <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                        <h4 className="font-semibold text-sm text-slate-600 uppercase tracking-wide flex items-center gap-2">
                          <User className="h-4 w-4" /> Personal Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Full Name <span className="text-red-500">*</span></Label>
                            <Input value={formData.residentName} onChange={(e) => setFormData(prev => ({ ...prev, residentName: e.target.value }))} placeholder="Resident full name" className="bg-white" data-testid="input-resident-name" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Room No</Label>
                            <div className="relative">
                              <DoorOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input value={selectedRoomId ? (floors.flatMap((f: any) => f.rooms || []).find((r: any) => r.id === selectedRoomId)?.roomNumber || "") : formData.residentRoomNo} readOnly={!!selectedRoomId} className={`pl-10 bg-white ${selectedRoomId ? "bg-slate-50 text-slate-600" : ""}`} placeholder="Auto-filled from selection" data-testid="input-resident-room" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Bed No</Label>
                            <div className="relative">
                              <BedDouble className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input value={formData.residentBedNo} readOnly={!!selectedBedId} className={`pl-10 bg-white ${selectedBedId ? "bg-slate-50 text-slate-600" : ""}`} placeholder="Auto-filled from selection" data-testid="input-resident-bed" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Phone Number <span className="text-red-500">*</span></Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input value={formData.residentPhone} onChange={(e) => setFormData(prev => ({ ...prev, residentPhone: e.target.value }))} placeholder="Phone number" className="pl-10 bg-white" data-testid="input-resident-phone" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Email ID <span className="text-red-500">*</span></Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input type="email" required value={formData.residentEmail} onChange={(e) => setFormData(prev => ({ ...prev, residentEmail: e.target.value }))} placeholder="Resident email" className="pl-10 bg-white" data-testid="input-resident-email" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Gender <span className="text-red-500">*</span></Label>
                            <Select value={formData.residentGender} onValueChange={(v) => setFormData(prev => ({ ...prev, residentGender: v }))}>
                              <SelectTrigger className="bg-white" data-testid="select-resident-gender">
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Date of Birth</Label>
                            <Input type="date" value={formData.residentDob} onChange={(e) => setFormData(prev => ({ ...prev, residentDob: e.target.value }))} className="bg-white" data-testid="input-resident-dob" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Dietary Preference</Label>
                            <Select value={formData.residentDietaryPreference} onValueChange={(v) => setFormData(prev => ({ ...prev, residentDietaryPreference: v }))}>
                              <SelectTrigger className="bg-white" data-testid="select-dietary-preference">
                                <SelectValue placeholder="Select preference" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="veg">Veg</SelectItem>
                                <SelectItem value="non_veg">Non Veg</SelectItem>
                                <SelectItem value="jain">Jain</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Accommodation Type</Label>
                            <Input
                              readOnly
                              value={formData.residentAccommodationType || ""}
                              placeholder="Auto-detected from room type"
                              className="bg-slate-50 cursor-default"
                              data-testid="input-accommodation-type"
                            />
                            {!formData.residentAccommodationType && (
                              <p className="text-xs text-slate-400 mt-1">Select a room type or bed to auto-fill</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const matchingPlans = propertyPlans.filter((plan: any) => {
                          if (!formData.roomTypeId) return true;
                          const linkedRooms: string[] = Array.isArray(plan.linkedRoomIds) ? plan.linkedRoomIds : [];
                          if (linkedRooms.length > 0) {
                            return selectedRoomId ? linkedRooms.includes(selectedRoomId) : false;
                          }
                          const linked: string[] = Array.isArray(plan.linkedRoomTypeIds) ? plan.linkedRoomTypeIds : [];
                          return linked.includes(formData.roomTypeId) || plan.roomTypeId === formData.roomTypeId;
                        });
                        if (matchingPlans.length === 0 && !plansLoading) return null;
                        const getPlanIcon = (tierLevel: number) => {
                          if (tierLevel >= 2) return Crown;
                          if (tierLevel >= 1) return Gem;
                          return Star;
                        };
                        const getPlanStyle = (tierLevel: number, isSelected: boolean) => {
                          const base = isSelected ? "ring-2 scale-[1.02]" : "hover:scale-[1.01]";
                          if (tierLevel >= 2) return `${base} ${isSelected ? "ring-amber-400 border-amber-400 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50" : "border-amber-200/60 bg-gradient-to-br from-amber-50/30 to-yellow-50/20 hover:border-amber-300"}`;
                          if (tierLevel >= 1) return `${base} ${isSelected ? "ring-slate-400 border-slate-400 bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100" : "border-slate-200/60 bg-gradient-to-br from-slate-50/30 to-gray-50/20 hover:border-slate-300"}`;
                          return `${base} ${isSelected ? "ring-violet-400 border-violet-400 bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50" : "border-violet-200/60 bg-gradient-to-br from-violet-50/30 to-purple-50/20 hover:border-violet-300"}`;
                        };
                        const getBadgeStyle = (tierLevel: number) => {
                          if (tierLevel >= 2) return "bg-gradient-to-r from-amber-500 to-yellow-500 text-white";
                          if (tierLevel >= 1) return "bg-gradient-to-r from-slate-500 to-gray-500 text-white";
                          return "bg-gradient-to-r from-violet-500 to-purple-500 text-white";
                        };
                        const getAccentColor = (tierLevel: number) => {
                          if (tierLevel >= 2) return "text-amber-600";
                          if (tierLevel >= 1) return "text-slate-600";
                          return "text-violet-600";
                        };
                        return (
                          <div className="p-5 rounded-xl border border-slate-200 space-y-4 bg-gradient-to-br from-white via-slate-50/50 to-white" data-testid="plan-picker-section">
                            <h4 className="font-semibold text-sm text-slate-600 uppercase tracking-wide flex items-center gap-2">
                              <Crown className="h-4 w-4 text-amber-500" /> Select Housing Plan
                            </h4>
                            {plansLoading ? (
                              <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading plans...
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {matchingPlans.map((plan: any) => {
                                  const tier = plan.tierLevel ?? 0;
                                  const isSelected = selectedPlanId === plan.id;
                                  const PlanIcon = getPlanIcon(tier);
                                  const price = plan.basePrice || plan.price || 0;
                                  const selectedProp = properties.find(p => p.id === formData.propertyId);
                                  const isAcademic = selectedProp?.bookingMode === "academic_year";
                                  return (
                                    <motion.div
                                      key={plan.id}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => {
                                        setSelectedPlanId(plan.id);
                                        setSelectedPlanName(plan.name);
                                        setSelectedPlanPrice(price);
                                        setSelectedPlanTier(tier);
                                        setSelectedPlanItems(plan.items || []);
                                        toast({ title: `${plan.name} selected`, description: "Plan applied to your booking." });
                                      }}
                                      className={`relative cursor-pointer rounded-xl border p-4 transition-all duration-200 ${getPlanStyle(tier, isSelected)} overflow-hidden`}
                                      data-testid={`plan-card-${plan.id}`}
                                    >
                                      {isSelected && (
                                        <div className="absolute top-2 right-2">
                                          <CheckCircle className={`h-5 w-5 ${getAccentColor(tier)}`} />
                                        </div>
                                      )}
                                      <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg ${isSelected ? getBadgeStyle(tier) : "bg-slate-100"}`}>
                                          <PlanIcon className={`h-4 w-4 ${isSelected ? "text-white" : getAccentColor(tier)}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-sm text-slate-800 truncate">{plan.name}</span>
                                            <Badge className={`text-[10px] px-1.5 py-0 font-semibold border-0 shrink-0 ${getBadgeStyle(tier)}`}>
                                              {tier >= 2 ? "PREMIUM" : tier >= 1 ? "CLASSIC" : "ESSENTIAL"}
                                            </Badge>
                                          </div>
                                          {price > 0 && (
                                            <div className="mt-1.5">
                                              <span className={`text-lg font-bold ${getAccentColor(tier)}`}>
                                                ₹{price.toLocaleString("en-IN")}
                                              </span>
                                              <span className="text-xs text-slate-400 ml-1">
                                                {isAcademic ? "/year" : "/mo"}
                                              </span>
                                            </div>
                                          )}
                                          {plan.items && plan.items.length > 0 && (
                                            <div className="mt-2 space-y-0.5">
                                              {plan.items.slice(0, 3).map((item: any) => (
                                                <div key={item.id} className="flex items-center gap-1.5 text-xs text-slate-500">
                                                  <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                                                  <span className="truncate">{item.name}</span>
                                                </div>
                                              ))}
                                              {plan.items.length > 3 && (
                                                <div className="text-[10px] text-slate-400 pl-4.5">+{plan.items.length - 3} more</div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })}
                              </div>
                            )}
                            {!selectedPlanId && matchingPlans.length > 0 && (
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> Select a plan to apply tier pricing to your booking
                              </p>
                            )}
                          </div>
                        );
                      })()}

                      <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                        <h4 className="font-semibold text-sm text-slate-600 uppercase tracking-wide flex items-center gap-2">
                          <GraduationCap className="h-4 w-4" /> Academic / Professional Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Institute / Company Name</Label>
                            <Input value={formData.residentInstitute} onChange={(e) => setFormData(prev => ({ ...prev, residentInstitute: e.target.value }))} placeholder="University or company name" className="bg-white" data-testid="input-resident-institute" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Course Name / Job Title</Label>
                            <Input value={formData.residentCourse} onChange={(e) => setFormData(prev => ({ ...prev, residentCourse: e.target.value }))} placeholder="e.g. B.Tech CSE / Software Engineer" className="bg-white" data-testid="input-resident-course" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Move-in Date</Label>
                            <Input type="date" value={formData.residentMoveInDate} onChange={(e) => setFormData(prev => ({ ...prev, residentMoveInDate: e.target.value }))} className="bg-white" data-testid="input-resident-movein" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Check-out Date</Label>
                            <Input type="date" value={formData.residentCheckOutDate} onChange={(e) => setFormData(prev => ({ ...prev, residentCheckOutDate: e.target.value }))} className="bg-white" data-testid="input-resident-checkout" />
                          </div>
                        </div>
                      </div>

                      <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                        <h4 className="font-semibold text-sm text-slate-600 uppercase tracking-wide flex items-center gap-2">
                          <Users className="h-4 w-4" /> Parent / Guardian Details
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Parent / Guardian Name</Label>
                            <Input value={formData.parentName} onChange={(e) => setFormData(prev => ({ ...prev, parentName: e.target.value }))} placeholder="Full name" className="bg-white" data-testid="input-parent-name" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Relation</Label>
                            <Select value={formData.parentRelation} onValueChange={(v) => setFormData(prev => ({ ...prev, parentRelation: v }))}>
                              <SelectTrigger className="bg-white" data-testid="select-parent-relation">
                                <SelectValue placeholder="Select relation" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="father">Father</SelectItem>
                                <SelectItem value="mother">Mother</SelectItem>
                                <SelectItem value="guardian">Guardian</SelectItem>
                                <SelectItem value="sibling">Sibling</SelectItem>
                                <SelectItem value="spouse">Spouse</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Parent Phone</Label>
                            <div className="relative">
                              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input value={formData.parentPhone} onChange={(e) => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))} placeholder="Parent phone number" className="pl-10 bg-white" data-testid="input-parent-phone" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-700">Parent Email</Label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input type="email" value={formData.parentEmail} onChange={(e) => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))} placeholder="Parent email" className="pl-10 bg-white" data-testid="input-parent-email" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <motion.div
                        className={`p-5 rounded-xl border-2 space-y-4 relative overflow-hidden ${hasPlan ? tierBorder(selectedPlanTier) : "border-slate-200"} ${hasPlan ? tierBg(selectedPlanTier) : "bg-slate-50"}`}
                        animate={hasPlan ? { borderColor: ["rgba(0,0,0,0.1)", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.1)"] } : {}}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                      >
                        {hasPlan && (
                          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tierGradient(selectedPlanTier)}`} />
                        )}
                        <h4 className="font-semibold text-sm text-slate-600 uppercase tracking-wide flex items-center gap-2">
                          <Camera className="h-4 w-4" /> Resident Photo
                          {hasPlan && (
                            <Badge className={`text-[9px] px-1.5 py-0 font-bold border-0 ml-auto ${tierBadgeBg(selectedPlanTier)}`}>
                              {tierLabel(selectedPlanTier)}
                            </Badge>
                          )}
                        </h4>
                        <div className="flex flex-col items-center gap-3">
                          {residentPhotoUrl ? (
                            <motion.div
                              className="relative"
                              initial={{ scale: 0.9, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 200 }}
                            >
                              <div className={`p-1 rounded-xl ${hasPlan ? `bg-gradient-to-br ${tierGradient(selectedPlanTier)} shadow-lg` : "bg-indigo-100"}`}>
                                <img src={residentPhotoUrl} alt="Resident" className="w-36 h-36 rounded-lg object-cover bg-white" data-testid="img-resident-photo" />
                              </div>
                              {hasPlan && TierIconComponent && (
                                <motion.div
                                  className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-lg bg-gradient-to-br ${tierGradient(selectedPlanTier)}`}
                                  animate={{ rotate: [0, 10, -10, 0] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                >
                                  <TierIconComponent className="h-3.5 w-3.5 text-white" />
                                </motion.div>
                              )}
                              <button
                                type="button"
                                onClick={() => { setResidentPhotoUrl(null); setFormData(prev => ({ ...prev, residentPhotoPath: "" })); }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors z-10"
                                data-testid="button-remove-photo"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </motion.div>
                          ) : (
                            <div className={`w-36 h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 ${hasPlan ? `${tierBorder(selectedPlanTier)} ${tierBg(selectedPlanTier)}` : "border-slate-300 bg-white text-slate-400"}`}>
                              <Camera className={`h-8 w-8 ${hasPlan ? tierAccent(selectedPlanTier) : ""}`} />
                              <span className="text-xs">No photo</span>
                            </div>
                          )}
                          <label className="cursor-pointer">
                            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={photoUploading} data-testid="input-photo-upload" />
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${photoUploading ? "bg-slate-100 text-slate-400 border-slate-200" : hasPlan ? `${tierBg(selectedPlanTier)} ${tierAccent(selectedPlanTier)} ${tierBorder(selectedPlanTier)} hover:opacity-80` : "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100"}`}>
                              {photoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                              {photoUploading ? "Uploading..." : "Upload Photo"}
                            </div>
                          </label>
                          <p className="text-xs text-slate-400 text-center">JPG, PNG under 5MB</p>
                        </div>
                      </motion.div>

                      <motion.div
                        className={`p-4 rounded-xl border relative overflow-hidden ${hasPlan ? `${tierBorder(selectedPlanTier)} ${tierBg(selectedPlanTier)}` : "bg-indigo-50 border-indigo-100"}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                      >
                        {hasPlan && (
                          <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${tierGradient(selectedPlanTier)}`} />
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`text-sm font-semibold ${hasPlan ? tierAccent(selectedPlanTier) : "text-indigo-700"}`}>Quick Summary</h4>
                          {hasPlan && TierIconComponent && (
                            <div className="flex items-center gap-1.5">
                              <TierIconComponent className={`h-3.5 w-3.5 ${tierAccent(selectedPlanTier)}`} />
                              <span className={`text-[10px] font-bold ${tierAccent(selectedPlanTier)}`}>{selectedPlanName}</span>
                            </div>
                          )}
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-600">
                          {formData.residentName && <p><span className="font-medium">Name:</span> {formData.residentName}</p>}
                          {formData.residentRoomNo && <p><span className="font-medium">Room:</span> {formData.residentRoomNo}</p>}
                          {formData.residentBedNo && <p><span className="font-medium">Bed:</span> {formData.residentBedNo}</p>}
                          {formData.residentGender && <p><span className="font-medium">Gender:</span> {formData.residentGender}</p>}
                          {formData.residentInstitute && <p><span className="font-medium">Institute:</span> {formData.residentInstitute}</p>}
                          {formData.residentMoveInDate && <p><span className="font-medium">Move-in:</span> {formData.residentMoveInDate}</p>}
                        </div>
                        {hasPlan && selectedPlanItems.length > 0 && (
                          <div className={`mt-3 pt-3 border-t ${tierBorder(selectedPlanTier)}`}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${tierAccent(selectedPlanTier)}`}>Plan Features</p>
                            <div className="grid grid-cols-2 gap-1">
                              {selectedPlanItems.slice(0, 4).map((item: any) => (
                                <div key={item.id} className="flex items-center gap-1 text-[10px] text-slate-500">
                                  <CheckCircle className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                                  <span className="truncate">{item.name}</span>
                                </div>
                              ))}
                              {selectedPlanItems.length > 4 && (
                                <span className="text-[10px] text-slate-400">+{selectedPlanItems.length - 4} more</span>
                              )}
                            </div>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-1">
                    <IndianRupee className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Pricing & Payment</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <div className="p-5 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Receipt className="h-4 w-4 text-indigo-500" />
                          <span className="text-sm font-medium text-indigo-600">Base Fee</span>
                          {selectedPlanName && (
                            <span className="ml-auto text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full" data-testid="badge-plan-pricing">
                              {selectedPlanName} Plan
                            </span>
                          )}
                        </div>
                        <p className="text-3xl font-bold text-slate-800" data-testid="text-base-fee">
                          ₹{formData.baseFee.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {getSelectedProperty()?.name} · {selectedPlanName || getSelectedRoomType()?.name}
                        </p>
                      </div>

                      {(() => {
                        const propDeposit = getSelectedProperty()?.deposit || getSelectedRoomType()?.deposit || 0;
                        return (
                          <>
                            {(propDeposit > 0 || !isRegularUser) && (
                              <div className="space-y-2">
                                <Label className="text-sm font-medium text-slate-700">Security Deposit</Label>
                                <div className="relative">
                                  <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                  {isRegularUser ? (
                                    <Input
                                      type="number"
                                      value={propDeposit}
                                      readOnly
                                      className="pl-10 bg-slate-50 border-slate-200 text-slate-600 cursor-not-allowed"
                                      data-testid="input-deposit"
                                    />
                                  ) : (
                                    <Input
                                      type="number"
                                      value={formData.deposit || ""}
                                      onChange={(e) => setFormData(prev => ({ ...prev, deposit: parseInt(e.target.value) || 0 }))}
                                      className="pl-10 bg-white border-slate-300"
                                      placeholder="Enter deposit amount"
                                      data-testid="input-deposit"
                                    />
                                  )}
                                </div>
                                {isRegularUser && propDeposit > 0 && (
                                  <p className="text-xs text-slate-500">Set by property</p>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {!isRegularUser && (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                                <Tag className="h-3.5 w-3.5" />
                                Discount
                              </Label>
                              {isSalesExec && (
                                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Max 10% without approval</span>
                              )}
                            </div>
                            <div className="relative">
                              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input
                                type="number"
                                value={formData.discount || ""}
                                onChange={(e) => setFormData(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
                                className="pl-10 bg-white border-slate-300"
                                placeholder="Enter discount amount"
                                data-testid="input-discount"
                              />
                            </div>
                            {getDiscountPercent() > 0 && (
                              <p className={`text-xs flex items-center gap-1 ${needsApproval() ? "text-amber-600" : "text-slate-500"}`}>
                                {getDiscountPercent().toFixed(1)}% discount
                                {needsApproval() && (
                                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 ml-1">Requires Approval</Badge>
                                )}
                              </p>
                            )}
                          </div>
                        </>
                      )}

                      {!isRegularUser && formData.discount > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium text-slate-700">Discount Reason</Label>
                          <Textarea
                            value={formData.discountReason}
                            onChange={(e) => setFormData(prev => ({ ...prev, discountReason: e.target.value }))}
                            className="bg-white border-slate-300 resize-none"
                            placeholder="Explain the reason for discount..."
                            rows={2}
                            data-testid="input-discount-reason"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-5">
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-slate-700">Payment Type</Label>
                        <div className="space-y-2">
                          {[
                            { value: "full", label: "Full Payment", desc: "Pay entire amount at once", icon: CreditCard },
                            { value: "partial", label: "Partial (Token + Balance)", desc: "Pay booking amount now, rest later", icon: Receipt },
                            { value: "installments", label: "Installment Plan", desc: "Split into scheduled payments", icon: Calendar },
                          ].map(opt => {
                            const OptIcon = opt.icon;
                            const selected = formData.paymentType === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, paymentType: opt.value }))}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                                  selected
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                }`}
                                data-testid={`radio-payment-${opt.value}`}
                              >
                                <OptIcon className={`h-5 w-5 ${selected ? "text-indigo-600" : "text-slate-400"}`} />
                                <div>
                                  <p className={`font-medium text-sm ${selected ? "text-indigo-700" : "text-slate-700"}`}>{opt.label}</p>
                                  <p className="text-xs text-slate-500">{opt.desc}</p>
                                </div>
                                {selected && <CheckCircle className="h-4 w-4 text-indigo-600 ml-auto" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {formData.paymentType === "partial" && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-3">
                          <Label className="text-sm font-semibold text-blue-800">Token / Booking Amount</Label>
                          <p className="text-xs text-blue-600">Amount to be paid upfront to confirm the booking</p>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 font-medium">₹</span>
                            <Input
                              type="number"
                              value={formData.tokenAmount}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(calculateTotal(), parseInt(e.target.value) || 0));
                                setFormData(prev => ({ ...prev, tokenAmount: val }));
                              }}
                              className="pl-7 bg-white border-blue-300 font-medium"
                              data-testid="input-token-amount"
                            />
                          </div>
                          <div className="flex justify-between text-xs text-blue-600">
                            <span>Balance due later: ₹{(calculateTotal() - formData.tokenAmount).toLocaleString()}</span>
                          </div>
                        </div>
                      )}

                      {formData.paymentType === "installments" && (
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
                          <Label className="text-sm font-semibold text-purple-800">Installment Plan</Label>
                          <p className="text-xs text-purple-600">Split the total into equal scheduled payments</p>
                          <div className="grid grid-cols-3 gap-2">
                            {[2, 3, 4].map(num => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => {
                                  const today = new Date().toISOString().split("T")[0];
                                  const defaultDates = [today];
                                  for (let j = 1; j < num; j++) {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() + j);
                                    defaultDates.push(d.toISOString().split("T")[0]);
                                  }
                                  setFormData((prev: any) => ({ ...prev, numberOfInstallments: num, customBookingAmount: 0, installmentAmounts: [], installmentDueDates: defaultDates }));
                                }}
                                className={`p-3 rounded-lg border-2 text-center transition-all ${
                                  formData.numberOfInstallments === num
                                    ? "border-purple-500 bg-purple-100 text-purple-700"
                                    : "border-purple-200 bg-white text-slate-600 hover:border-purple-300"
                                }`}
                                data-testid={`btn-installments-${num}`}
                              >
                                <p className="text-lg font-bold">{num}</p>
                                <p className="text-xs">parts</p>
                              </button>
                            ))}
                          </div>
                          <div className="space-y-2 mt-2">
                            {(() => {
                              const total = calculateTotal();
                              const n = formData.numberOfInstallments;
                              const customAmounts: number[] = (formData as any).installmentAmounts || [];
                              const amounts: number[] = [];
                              let usedByCustom = 0;
                              const customIndices: number[] = [];
                              for (let i = 0; i < n; i++) {
                                if (customAmounts[i] !== undefined && customAmounts[i] > 0) {
                                  amounts.push(customAmounts[i]);
                                  usedByCustom += customAmounts[i];
                                  customIndices.push(i);
                                } else {
                                  amounts.push(0);
                                }
                              }
                              const autoIndices = Array.from({ length: n }, (_, i) => i).filter(i => !customIndices.includes(i));
                              if (autoIndices.length > 0) {
                                const remaining = total - usedByCustom;
                                const perAuto = Math.round(remaining / autoIndices.length);
                                autoIndices.forEach((idx, j) => {
                                  amounts[idx] = j === autoIndices.length - 1
                                    ? remaining - perAuto * (autoIndices.length - 1)
                                    : perAuto;
                                });
                              }
                              return amounts.map((amount, i) => {
                                const dueDate = formData.installmentDueDates[i] || "";
                                const isCustom = customIndices.includes(i);
                                return (
                                  <div key={i} className="bg-white px-3 py-2.5 rounded-md border border-purple-100 space-y-1.5">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium text-purple-700">{i === 0 ? "Booking Amount" : `Installment ${i}`}</span>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-purple-500">₹</span>
                                        <input
                                          type="number"
                                          value={isCustom ? customAmounts[i] : amount}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            const maxAllowed = total - (n - 1) * 100;
                                            const clamped = Math.max(0, Math.min(val, maxAllowed));
                                            setFormData((prev: any) => {
                                              const newAmounts = [...(prev.installmentAmounts || [])];
                                              while (newAmounts.length < n) newAmounts.push(0);
                                              newAmounts[i] = clamped;
                                              return { ...prev, installmentAmounts: newAmounts, customBookingAmount: newAmounts[0] || 0 };
                                            });
                                          }}
                                          className={`w-28 text-right text-sm font-semibold border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-purple-400 ${isCustom ? "text-purple-700 border-purple-300 bg-purple-50" : "text-purple-700 border-purple-200"}`}
                                          data-testid={`input-installment-amount-${i}`}
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-3 h-3 text-purple-400" />
                                      <input
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => {
                                          setFormData((prev: any) => {
                                            const dates = [...prev.installmentDueDates];
                                            while (dates.length <= i) dates.push("");
                                            dates[i] = e.target.value;
                                            return { ...prev, installmentDueDates: dates };
                                          });
                                        }}
                                        className="text-xs text-purple-600 border border-purple-100 rounded px-2 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-purple-400"
                                        placeholder="Select due date"
                                        data-testid={`input-due-date-${i}`}
                                      />
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      <motion.div
                        className={`p-5 rounded-xl border-2 relative overflow-hidden ${hasPlan ? `${tierBorder(selectedPlanTier)} ${tierBg(selectedPlanTier)}` : "bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200"}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        {hasPlan && (
                          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tierGradient(selectedPlanTier)}`} />
                        )}
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-slate-600">Payment Summary</h4>
                          {hasPlan && (
                            <Badge className={`text-[9px] px-1.5 py-0 font-bold border-0 ${tierBadgeBg(selectedPlanTier)}`}>
                              {selectedPlanName}
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Base Fee {selectedPlanName && <span className={`text-[10px] ${tierAccent(selectedPlanTier)}`}>({selectedPlanName})</span>}</span>
                            <span className="font-medium text-slate-700">₹{formData.baseFee.toLocaleString()}</span>
                          </div>
                          {formData.discount > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Discount</span>
                              <span className="font-medium text-green-600">-₹{formData.discount.toLocaleString()}</span>
                            </div>
                          )}
                          {formData.deposit > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Security Deposit</span>
                              <span className="font-medium text-slate-700">+₹{formData.deposit.toLocaleString()}</span>
                            </div>
                          )}
                          <Separator className="my-2" />
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-slate-700">Total Amount</span>
                            <span className={`text-2xl font-bold ${hasPlan ? tierAccent(selectedPlanTier) : "text-indigo-600"}`} data-testid="text-total-amount">
                              ₹{calculateTotal().toLocaleString()}
                            </span>
                          </div>
                          {formData.paymentType === "partial" && (
                            <>
                              <Separator className="my-2" />
                              <div className="flex justify-between text-sm">
                                <span className="text-blue-600 font-medium">Pay Now (Token)</span>
                                <span className="font-bold text-blue-700">₹{formData.tokenAmount.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Balance Due</span>
                                <span className="font-medium text-slate-600">₹{(calculateTotal() - formData.tokenAmount).toLocaleString()}</span>
                              </div>
                            </>
                          )}
                          {formData.paymentType === "installments" && (
                            <>
                              <Separator className="my-2" />
                              <div className="flex justify-between text-sm">
                                <span className="text-purple-600 font-medium">Booking Amount</span>
                                <span className="font-bold text-purple-700">₹{(formData.customBookingAmount > 0 ? formData.customBookingAmount : Math.round(calculateTotal() / formData.numberOfInstallments)).toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Payment Plan</span>
                                <span className="font-medium text-slate-600">{formData.numberOfInstallments} installments</span>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>

                      {needsApproval() && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <p className="text-sm text-amber-700">
                            This booking requires admin approval due to discount exceeding 10%.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {step === 5 && (
                <motion.div
                  className="space-y-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardCheck className={`h-5 w-5 ${hasPlan ? tierAccent(selectedPlanTier) : "text-indigo-500"}`} />
                    <h3 className="text-lg font-semibold text-slate-800">Review & Confirm</h3>
                    {hasPlan && (
                      <Badge className={`text-[9px] px-2 py-0.5 font-bold border-0 ml-auto ${tierBadgeBg(selectedPlanTier)}`}>
                        {tierLabel(selectedPlanTier)} PLAN
                      </Badge>
                    )}
                  </div>

                  {hasPlan && (
                    <motion.div
                      className={`p-4 rounded-xl border-2 relative overflow-hidden ${tierBorder(selectedPlanTier)} ${tierBg(selectedPlanTier)}`}
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 150, delay: 0.1 }}
                    >
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tierGradient(selectedPlanTier)}`} />
                      <div className="flex items-center gap-3">
                        <motion.div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${tierGradient(selectedPlanTier)} shadow-md`}
                          animate={{ rotate: [0, 5, -5, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        >
                          {TierIconComponent && <TierIconComponent className="h-5 w-5 text-white" />}
                        </motion.div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800">{selectedPlanName}</p>
                            <Badge className={`text-[9px] px-1.5 py-0 font-bold border-0 ${tierBadgeBg(selectedPlanTier)}`}>
                              {tierLabel(selectedPlanTier)}
                            </Badge>
                          </div>
                          <p className={`text-sm font-semibold ${tierAccent(selectedPlanTier)}`}>
                            ₹{selectedPlanPrice.toLocaleString("en-IN")}
                            <span className="text-xs text-slate-400 ml-1 font-normal">
                              {getSelectedProperty()?.bookingMode === "academic_year" ? "/year" : "/mo"}
                            </span>
                          </p>
                        </div>
                      </div>
                      {selectedPlanItems.length > 0 && (
                        <div className={`mt-3 pt-3 border-t ${tierBorder(selectedPlanTier)} grid grid-cols-2 sm:grid-cols-3 gap-1.5`}>
                          {selectedPlanItems.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-1.5 text-xs text-slate-600">
                              <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                              <span className="truncate">{item.name || item.label}</span>
                              {item.featureValue && <span className="text-[10px] text-slate-400 truncate">· {item.featureValue}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <motion.div
                      className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-indigo-600" />
                        </div>
                        <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Customer</h4>
                      </div>
                      <p className="font-bold text-slate-800 text-lg" data-testid="review-customer-name">{getCustomerName()}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-slate-500 flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />{getCustomerPhone()}
                        </p>
                        {getCustomerEmail() && (
                          <p className="text-sm text-slate-500 flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" />{getCustomerEmail()}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="mt-3 capitalize">
                        {isRegularUser ? "Profile Booking" : formData.customerType.replace("_", " ")}
                      </Badge>
                    </motion.div>

                    <motion.div
                      className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Property & Room</h4>
                      </div>
                      <p className="font-bold text-slate-800 text-lg" data-testid="review-property">{getSelectedProperty()?.name}</p>
                      <p className="text-sm text-slate-500 mt-1">{getSelectedRoomType()?.customName || getSelectedRoomType()?.name} · {getSelectedRoomType()?.occupancy}-sharing</p>
                      {selectedBedInfo && (
                        <p className="text-sm text-indigo-600 mt-1 font-medium">Bed: {selectedBedInfo.bedNumber} · {floors.find((f: any) => f.id === selectedFloorId)?.name || "Floor"}</p>
                      )}
                      <div className="mt-2 flex items-center gap-1 text-sm text-indigo-600">
                        <Calendar className="h-3.5 w-3.5" />
                        {formData.stayPlanType === "monthly" ? `${formData.durationMonths} months` : `Academic Year ${formData.academicYearPeriod}`}
                      </div>
                    </motion.div>
                  </div>

                  {formData.residentName && (
                    <motion.div
                      className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center">
                          <Heart className="h-4 w-4 text-pink-600" />
                        </div>
                        <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Resident Details</h4>
                      </div>
                      <div className="flex gap-4">
                        {residentPhotoUrl && (
                          <div className={`p-0.5 rounded-lg ${hasPlan ? `bg-gradient-to-br ${tierGradient(selectedPlanTier)}` : ""}`}>
                            <img src={residentPhotoUrl} alt="Resident" className="w-16 h-16 rounded-md object-cover bg-white" />
                          </div>
                        )}
                        <div className="space-y-1 text-sm">
                          <p className="font-bold text-slate-800">{formData.residentName}</p>
                          {formData.residentRoomNo && <p className="text-slate-500">Room: {formData.residentRoomNo}</p>}
                          {formData.residentBedNo && <p className="text-slate-500">Bed: {formData.residentBedNo}</p>}
                          {formData.residentGender && <p className="text-slate-500 capitalize">Gender: {formData.residentGender}</p>}
                          {formData.residentInstitute && <p className="text-slate-500">{formData.residentInstitute}</p>}
                          {formData.residentMoveInDate && <p className="text-slate-500">Move-in: {formData.residentMoveInDate}</p>}
                          {formData.parentName && <p className="text-slate-500">Parent: {formData.parentName} ({formData.parentRelation})</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <motion.div
                    className={`p-5 rounded-xl border-2 relative overflow-hidden ${hasPlan ? `${tierBorder(selectedPlanTier)} ${tierBg(selectedPlanTier)}` : "bg-gradient-to-r from-indigo-50 to-violet-50 border-indigo-100"}`}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {hasPlan && (
                      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tierGradient(selectedPlanTier)}`} />
                    )}
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasPlan ? `bg-gradient-to-br ${tierGradient(selectedPlanTier)}` : "bg-indigo-100"}`}>
                        <CreditCard className={`h-4 w-4 ${hasPlan ? "text-white" : "text-indigo-600"}`} />
                      </div>
                      <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Payment Summary</h4>
                      {hasPlan && (
                        <Badge className={`text-[9px] px-1.5 py-0 font-bold border-0 ml-auto ${tierBadgeBg(selectedPlanTier)}`}>
                          {selectedPlanName}
                        </Badge>
                      )}
                    </div>
                    <div className={`grid grid-cols-2 ${getMoveInChargesTotal() > 0 ? "sm:grid-cols-3" : "sm:grid-cols-4"} gap-4`}>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Base Fee</p>
                        <p className="font-bold text-slate-800">₹{formData.baseFee.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Discount</p>
                        <p className="font-bold text-green-600">{formData.discount > 0 ? `-₹${formData.discount.toLocaleString()}` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Deposit</p>
                        <p className="font-bold text-slate-800">{formData.deposit > 0 ? `₹${formData.deposit.toLocaleString()}` : "—"}</p>
                      </div>
                      {getMoveInChargesTotal() > 0 && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Service & Legal</p>
                          <p className="font-bold text-slate-800">₹{getMoveInChargesTotal().toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Total</p>
                        <p className={`font-bold text-2xl ${hasPlan ? tierAccent(selectedPlanTier) : "text-indigo-600"}`} data-testid="review-total">₹{calculateTotal().toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{formData.paymentType} payment</Badge>
                      {formData.paymentType === "partial" && formData.tokenAmount > 0 && (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                          Token: ₹{formData.tokenAmount.toLocaleString()} + Balance: ₹{(calculateTotal() - formData.tokenAmount).toLocaleString()}
                        </Badge>
                      )}
                      {formData.paymentType === "installments" && formData.numberOfInstallments > 0 && (
                        <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
                          {formData.numberOfInstallments} installments · Booking ₹{(formData.customBookingAmount > 0 ? formData.customBookingAmount : Math.round(calculateTotal() / formData.numberOfInstallments)).toLocaleString()}
                        </Badge>
                      )}
                      {needsApproval() && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Requires Approval
                        </Badge>
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    className="mt-6 p-4 rounded-xl border border-blue-200 bg-blue-50/60"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-slate-800">Service & Legal Charges</h4>
                    </div>
                    <p className="text-sm text-slate-600 mb-2">Covers police verification, agreement, and other mandatory formalities.</p>
                    {getMoveInChargesTotal() > 0 && (
                      <div className="flex flex-wrap gap-3 mt-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-blue-100">
                          <span className="text-xs text-slate-500">Service & Legal Charges:</span>
                          <span className="text-sm font-semibold text-slate-800" data-testid="text-service-legal-charges">₹{getMoveInChargesTotal().toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-blue-500 mt-2">Included in total booking amount</p>
                  </motion.div>

                  <motion.div
                    className="mt-6 p-5 rounded-xl border border-amber-200 bg-amber-50/60"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-5 w-5 text-amber-600" />
                      <h4 className="font-semibold text-slate-800">Key Terms & Conditions</h4>
                    </div>
                    <div className="space-y-3 text-sm text-slate-700">
                      <div>
                        <p className="font-medium text-slate-800">1. Booking Confirmation</p>
                        <ul className="ml-4 mt-1 space-y-0.5 text-slate-600 list-disc">
                          <li>A booking is considered confirmed upon receipt of the booking amount.</li>
                          <li>Confirmation will be sent to the email address provided in the booking form.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">2. Booking Amount</p>
                        <ul className="ml-4 mt-1 space-y-0.5 text-slate-600 list-disc">
                          <li>The booking amount is a non-refundable deposit that secures your reservation.</li>
                          <li>This amount will be deducted from your total stay charges upon check-in.</li>
                          <li>In case of cancellation or no-show, the booking amount will be forfeited.</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">3. Payment</p>
                        <ul className="ml-4 mt-1 space-y-0.5 text-slate-600 list-disc">
                          <li>The remaining balance of your stay is payable upon check-in.</li>
                          <li>Accepted payment methods will be communicated during the booking process or upon arrival.</li>
                          <li>No refund of rent in case you move out abruptly without completion of your tenure.</li>
                        </ul>
                      </div>
                    </div>
                    <label className="flex items-center gap-3 mt-4 pt-3 border-t border-amber-200 cursor-pointer" data-testid="checkbox-terms-accepted">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                        className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm font-medium text-slate-700">I have read and agree to the Terms & Conditions</span>
                    </label>
                  </motion.div>
                </motion.div>
              )}

              <div className="flex justify-between mt-8 pt-5 border-t border-slate-200">
                {step > 1 ? (
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="gap-2"
                    data-testid="button-back-step"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                ) : (
                  <div />
                )}

                {step < 5 ? (
                  <Button
                    onClick={handleNext}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 px-6"
                    data-testid="button-next-step"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || !termsAccepted}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6 disabled:opacity-50"
                    data-testid="button-submit-booking"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating Booking...
                      </>
                    ) : needsApproval() ? (
                      <>
                        <Shield className="h-4 w-4" />
                        Submit for Approval
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Create Booking
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-800">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
              Booking Created Successfully
            </DialogTitle>
            <DialogDescription>
              {bookingResult?.requiresApproval
                ? "Your booking has been submitted for admin approval."
                : "The booking has been created and is ready for payment."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {bookingResult?.booking && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-500">Booking Code</span>
                  <span className="font-mono font-bold text-lg text-indigo-600" data-testid="text-booking-code">
                    {bookingResult.booking.bookingCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Status</span>
                  <Badge variant={bookingResult.requiresApproval ? "destructive" : "default"} className="capitalize">
                    {bookingResult.booking.status?.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false);
                navigate(isRegularUser ? "/my-bookings" : (isAdmin ? "/admin" : "/sales"));
              }}
              data-testid="button-done"
            >
              {isRegularUser ? "My Bookings" : "Back to Dashboard"}
            </Button>
            {!bookingResult?.requiresApproval && (
              <Button
                onClick={() => {
                  setConfirmDialogOpen(false);
                  navigate(`/payment-gateway?bookingId=${bookingResult?.booking?.id}`);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="button-proceed-payment"
              >
                Proceed to Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
