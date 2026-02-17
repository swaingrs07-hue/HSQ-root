import { useState, useEffect } from "react";
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
} from "lucide-react";

interface Property {
  id: string;
  name: string;
  city: string;
  bookingMode: string;
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

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const STEP_CONFIG = [
  { label: "Customer", icon: UserPlus, description: "Select customer type" },
  { label: "Property", icon: Building2, description: "Choose property & room" },
  { label: "Pricing", icon: IndianRupee, description: "Set pricing & payment" },
  { label: "Confirm", icon: ClipboardCheck, description: "Review & submit" },
];

export default function BookingGeneration() {
  const { toast } = useToast();
  const { user, token } = useAuth();
  const [, navigate] = useLocation();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [availability, setAvailability] = useState<{ totalBeds: number; availableBeds: number; bookedBeds: number } | null>(null);

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
    checkInDate: "",
    checkOutDate: "",
    durationMonths: 12,
    baseFee: 0,
    deposit: 0,
    discount: 0,
    discountReason: "",
    paymentType: "full",
    paymentPlanId: "",
  });

  const isAdmin = user?.role === "admin";
  const isSalesExec = user?.role === "sales_executive";
  const maxDiscountPercent = isSalesExec ? 10 : 100;
  const getAuthToken = () => token || "";

  useEffect(() => {
    fetchProperties();
    if (isSalesExec && user?.id) {
      fetchAssignedLeads();
    } else if (isAdmin) {
      fetchAllLeads();
    }
  }, [user]);

  useEffect(() => {
    if (formData.propertyId) {
      fetchRoomTypes(formData.propertyId);
    }
  }, [formData.propertyId]);

  useEffect(() => {
    if (formData.roomTypeId) {
      fetchAvailability(formData.roomTypeId);
      calculateFee();
    }
  }, [formData.roomTypeId, formData.stayPlanType, formData.durationMonths]);

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
        setLeads(data.filter((l: any) => l.status !== "closed" && l.status !== "lost" && l.status !== "deal_closed"));
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
        setLeads(data.filter((l: any) => l.status !== "closed" && l.status !== "lost" && l.status !== "deal_closed"));
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
    if (property.bookingMode === "monthly" && formData.stayPlanType === "monthly") {
      baseFee = selectedRoom.basePrice * formData.durationMonths;
    } else {
      baseFee = selectedRoom.academicYearPrice || (selectedRoom.basePrice * 12);
    }
    setFormData(prev => ({ ...prev, baseFee }));
  };

  const calculateTotal = () => {
    return formData.baseFee - (formData.discount || 0) + (formData.deposit || 0);
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
  };

  const handleRoomTypeChange = (roomTypeId: string) => {
    setFormData(prev => ({ ...prev, roomTypeId }));
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
      }));
    }
  };

  const validateStep = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        if (formData.customerType === "walk_in") {
          return !!(formData.walkInName.trim() && formData.walkInPhone.trim());
        } else if (formData.customerType === "lead") {
          return !!formData.leadId;
        }
        return !!formData.studentId;
      case 2:
        return !!(formData.propertyId && formData.roomTypeId && availability && availability.availableBeds > 0);
      case 3:
        return formData.baseFee > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    } else {
      toast({
        title: "Incomplete Information",
        description: "Please fill in all required fields before proceeding.",
        variant: "destructive",
      });
    }
  };

  const handleBack = () => setStep(step - 1);

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
          walkInName: formData.customerType === "walk_in" ? formData.walkInName : null,
          walkInPhone: formData.customerType === "walk_in" ? formData.walkInPhone : null,
          walkInEmail: formData.customerType === "walk_in" ? formData.walkInEmail : null,
          propertyId: formData.propertyId,
          roomTypeId: formData.roomTypeId,
          stayPlanType: formData.stayPlanType,
          checkInDate: formData.checkInDate || null,
          checkOutDate: formData.checkOutDate || null,
          durationMonths: formData.durationMonths,
          baseFee: formData.baseFee,
          deposit: formData.deposit,
          discount: formData.discount,
          discountReason: formData.discountReason,
          paymentType: formData.paymentType,
          paymentPlanId: formData.paymentPlanId || null,
          createdBy: user?.id,
          assignedSalesExecId: isSalesExec ? user?.id : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setBookingResult(data);
        setConfirmDialogOpen(true);
        toast({
          title: "Booking Created",
          description: data.requiresApproval
            ? "Booking created and sent for admin approval."
            : `Booking ${data.booking.bookingCode} created successfully!`,
        });
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
    return formData.walkInName;
  };
  const getCustomerPhone = () => {
    if (formData.customerType === "lead") return getSelectedLead()?.phone || "";
    return formData.walkInPhone;
  };
  const getCustomerEmail = () => {
    if (formData.customerType === "lead") return getSelectedLead()?.email || "";
    return formData.walkInEmail;
  };

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
              {idx < 3 && (
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
                    <h3 className="text-lg font-semibold text-slate-800">Customer Information</h3>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-slate-600 mb-3 block">Customer Type</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: "walk_in", label: "Walk-in Customer", desc: "New walk-in visitor", icon: User },
                        { value: "lead", label: "Convert Lead", desc: "Existing lead from CRM", icon: Users },
                        { value: "student", label: "Registered Student", desc: "Already registered", icon: Shield },
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
                              onChange={(e) => setFormData(prev => ({ ...prev, walkInPhone: e.target.value }))}
                              className="pl-10 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                              placeholder="Enter phone number"
                              data-testid="input-walkin-phone"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="walkInEmail" className="text-sm font-medium text-slate-700">Email <span className="text-slate-400 font-normal">(Optional)</span></Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            id="walkInEmail"
                            type="email"
                            value={formData.walkInEmail}
                            onChange={(e) => setFormData(prev => ({ ...prev, walkInEmail: e.target.value }))}
                            className="pl-10 bg-white border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="Enter email address"
                            data-testid="input-walkin-email"
                          />
                        </div>
                      </div>
                    </motion.div>
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
                          <SelectContent>
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
                      className="p-5 bg-blue-50 rounded-xl border border-blue-100"
                    >
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-800">Student Registration</p>
                          <p className="text-sm text-blue-600 mt-1">
                            Student registration is handled through the student portal. For existing students, please use the "Convert Lead" option instead.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
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
                              <p className="text-lg font-bold text-indigo-600 mt-2">
                                ₹{(room.academicYearPrice || room.basePrice * 12).toLocaleString()}<span className="text-xs font-normal text-slate-400">/year</span>
                              </p>
                              {room.basePrice > 0 && (
                                <p className="text-xs text-slate-500">
                                  or ₹{room.basePrice.toLocaleString()}/month
                                </p>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {formData.propertyId && loading && (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                      <span className="ml-2 text-sm text-slate-500">Loading room types...</span>
                    </div>
                  )}

                  {getSelectedProperty()?.bookingMode === "monthly" && formData.roomTypeId && (
                    <div className="space-y-4 p-5 bg-slate-50 rounded-xl border border-slate-200">
                      <Label className="text-sm font-medium text-slate-700">Stay Plan</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { value: "academic_year", label: "Full Academic Year", desc: "12 months" },
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
                    <IndianRupee className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Pricing & Payment</h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <div className="p-5 bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl border border-indigo-100">
                        <div className="flex items-center gap-2 mb-1">
                          <Receipt className="h-4 w-4 text-indigo-500" />
                          <span className="text-sm font-medium text-indigo-600">Base Fee</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800" data-testid="text-base-fee">
                          ₹{formData.baseFee.toLocaleString()}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {getSelectedProperty()?.name} · {getSelectedRoomType()?.name}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-slate-700">Security Deposit</Label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input
                            type="number"
                            value={formData.deposit || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, deposit: parseInt(e.target.value) || 0 }))}
                            className="pl-10 bg-white border-slate-300"
                            placeholder="Enter deposit amount"
                            data-testid="input-deposit"
                          />
                        </div>
                      </div>

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

                      {formData.discount > 0 && (
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

                      <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                        <h4 className="text-sm font-semibold text-slate-600 mb-3">Payment Summary</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Base Fee</span>
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
                            <span className="text-2xl font-bold text-indigo-600" data-testid="text-total-amount">
                              ₹{calculateTotal().toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

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

              {step === 4 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardCheck className="h-5 w-5 text-indigo-500" />
                    <h3 className="text-lg font-semibold text-slate-800">Review & Confirm</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
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
                        {formData.customerType.replace("_", " ")}
                      </Badge>
                    </div>

                    <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                          <Building2 className="h-4 w-4 text-emerald-600" />
                        </div>
                        <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Property & Room</h4>
                      </div>
                      <p className="font-bold text-slate-800 text-lg" data-testid="review-property">{getSelectedProperty()?.name}</p>
                      <p className="text-sm text-slate-500 mt-1">{getSelectedRoomType()?.customName || getSelectedRoomType()?.name} · {getSelectedRoomType()?.occupancy}-sharing</p>
                      <div className="mt-2 flex items-center gap-1 text-sm text-indigo-600">
                        <Calendar className="h-3.5 w-3.5" />
                        {formData.stayPlanType === "monthly" ? `${formData.durationMonths} months` : "Full Academic Year"}
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl border border-indigo-100">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <CreditCard className="h-4 w-4 text-indigo-600" />
                      </div>
                      <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">Payment Summary</h4>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Total</p>
                        <p className="font-bold text-2xl text-indigo-600" data-testid="review-total">₹{calculateTotal().toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="capitalize">{formData.paymentType} payment</Badge>
                      {needsApproval() && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Requires Approval
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
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

                {step < 4 ? (
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
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-6"
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
                navigate(isAdmin ? "/admin" : "/sales");
              }}
              data-testid="button-done"
            >
              Back to Dashboard
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
