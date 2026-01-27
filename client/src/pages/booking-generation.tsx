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
import { format } from "date-fns";
import { 
  Building2, 
  Users, 
  Phone, 
  Mail, 
  Calendar, 
  IndianRupee, 
  Percent, 
  BedDouble,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Loader2,
  UserPlus,
  FileText
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
  occupancy: number;
  annualFee: number;
  monthlyFee: number;
  totalBeds: number;
  availableBeds: number;
}

interface Lead {
  id: string;
  studentName: string;
  email: string;
  phone: string;
  status: string;
  propertyId: string | null;
}

interface Student {
  id: string;
  name: string;
  email: string;
  phone: string;
}

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
  const canApplyUnlimitedDiscount = isAdmin;
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
      const response = await fetch(`/api/properties/${propertyId}/room-types`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRoomTypes(data);
      }
    } catch (error) {
      console.error("Error fetching room types:", error);
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
        setLeads(data.filter((l: Lead) => l.status !== "closed" && l.status !== "lost"));
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
        setLeads(data.filter((l: Lead) => l.status !== "closed" && l.status !== "lost"));
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
      baseFee = selectedRoom.monthlyFee * formData.durationMonths;
    } else {
      baseFee = selectedRoom.annualFee;
    }

    setFormData(prev => ({ ...prev, baseFee }));
  };

  const calculateTotal = () => {
    const discountAmount = formData.discount || 0;
    return formData.baseFee - discountAmount + formData.deposit;
  };

  const getDiscountPercent = () => {
    if (formData.baseFee === 0) return 0;
    return (formData.discount / formData.baseFee) * 100;
  };

  const needsApproval = () => {
    return getDiscountPercent() > 10 && isSalesExec;
  };

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
        walkInName: selectedLead.studentName,
        walkInPhone: selectedLead.phone,
        walkInEmail: selectedLead.email,
        propertyId: selectedLead.propertyId || prev.propertyId,
      }));
    }
  };

  const validateStep = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        if (formData.customerType === "walk_in") {
          return formData.walkInName && formData.walkInPhone;
        } else if (formData.customerType === "lead") {
          return formData.leadId;
        }
        return formData.studentId;
      case 2:
        return formData.propertyId && formData.roomTypeId && availability && availability.availableBeds > 0;
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

  const handleBack = () => {
    setStep(step - 1);
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
        description: "Failed to create booking",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getSelectedProperty = () => properties.find(p => p.id === formData.propertyId);
  const getSelectedRoomType = () => roomTypes.find(r => r.id === formData.roomTypeId);
  const getSelectedLead = () => leads.find(l => l.id === formData.leadId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(isAdmin ? "/admin" : "/sales")}
            className="text-slate-300 hover:text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-2xl text-white flex items-center gap-2">
              <FileText className="h-6 w-6 text-orange-500" />
              Generate New Booking
            </CardTitle>
            <CardDescription className="text-slate-400">
              Create a booking for walk-in customer, lead, or registered student
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-8">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= s
                        ? "bg-orange-500 text-white"
                        : "bg-slate-700 text-slate-400"
                    }`}
                    data-testid={`step-indicator-${s}`}
                  >
                    {step > s ? <CheckCircle className="h-5 w-5" /> : s}
                  </div>
                  {s < 4 && (
                    <div
                      className={`w-24 h-1 mx-2 ${
                        step > s ? "bg-orange-500" : "bg-slate-700"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-orange-500" />
                  Customer Information
                </h3>

                <div className="space-y-4">
                  <Label className="text-slate-300">Customer Type</Label>
                  <RadioGroup
                    value={formData.customerType}
                    onValueChange={handleCustomerTypeChange}
                    className="grid grid-cols-3 gap-4"
                  >
                    <div
                      className={`flex items-center space-x-2 p-4 rounded-lg border cursor-pointer ${
                        formData.customerType === "walk_in"
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-slate-600 bg-slate-700/50"
                      }`}
                      onClick={() => handleCustomerTypeChange("walk_in")}
                    >
                      <RadioGroupItem value="walk_in" id="walk_in" data-testid="radio-walk-in" />
                      <Label htmlFor="walk_in" className="cursor-pointer text-slate-200">
                        Walk-in Customer
                      </Label>
                    </div>
                    <div
                      className={`flex items-center space-x-2 p-4 rounded-lg border cursor-pointer ${
                        formData.customerType === "lead"
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-slate-600 bg-slate-700/50"
                      }`}
                      onClick={() => handleCustomerTypeChange("lead")}
                    >
                      <RadioGroupItem value="lead" id="lead" data-testid="radio-lead" />
                      <Label htmlFor="lead" className="cursor-pointer text-slate-200">
                        Convert Lead
                      </Label>
                    </div>
                    <div
                      className={`flex items-center space-x-2 p-4 rounded-lg border cursor-pointer ${
                        formData.customerType === "student"
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-slate-600 bg-slate-700/50"
                      }`}
                      onClick={() => handleCustomerTypeChange("student")}
                    >
                      <RadioGroupItem value="student" id="student" data-testid="radio-student" />
                      <Label htmlFor="student" className="cursor-pointer text-slate-200">
                        Registered Student
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {formData.customerType === "walk_in" && (
                  <div className="space-y-4 p-4 bg-slate-700/30 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="walkInName" className="text-slate-300">Full Name *</Label>
                        <Input
                          id="walkInName"
                          value={formData.walkInName}
                          onChange={(e) => setFormData(prev => ({ ...prev, walkInName: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Enter customer name"
                          data-testid="input-walkin-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="walkInPhone" className="text-slate-300">Phone *</Label>
                        <Input
                          id="walkInPhone"
                          value={formData.walkInPhone}
                          onChange={(e) => setFormData(prev => ({ ...prev, walkInPhone: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Enter phone number"
                          data-testid="input-walkin-phone"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="walkInEmail" className="text-slate-300">Email (Optional)</Label>
                      <Input
                        id="walkInEmail"
                        type="email"
                        value={formData.walkInEmail}
                        onChange={(e) => setFormData(prev => ({ ...prev, walkInEmail: e.target.value }))}
                        className="bg-slate-700 border-slate-600 text-white"
                        placeholder="Enter email address"
                        data-testid="input-walkin-email"
                      />
                    </div>
                  </div>
                )}

                {formData.customerType === "lead" && (
                  <div className="space-y-4 p-4 bg-slate-700/30 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Select Lead *</Label>
                      <Select value={formData.leadId} onValueChange={handleLeadSelect}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-lead">
                          <SelectValue placeholder="Select a lead to convert" />
                        </SelectTrigger>
                        <SelectContent>
                          {leads.map((lead) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.studentName} - {lead.phone}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {getSelectedLead() && (
                      <div className="p-3 bg-slate-600/50 rounded-lg">
                        <div className="flex items-center gap-2 text-slate-300 text-sm">
                          <Users className="h-4 w-4" />
                          <span>{getSelectedLead()?.studentName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
                          <Phone className="h-4 w-4" />
                          <span>{getSelectedLead()?.phone}</span>
                          <Mail className="h-4 w-4 ml-3" />
                          <span>{getSelectedLead()?.email}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {formData.customerType === "student" && (
                  <div className="space-y-4 p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-slate-400 text-sm">
                      Student registration is handled through the student portal.
                      For existing students, please use the lead conversion flow.
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-orange-500" />
                  Property & Room Selection
                </h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Select Property *</Label>
                    <Select value={formData.propertyId} onValueChange={handlePropertyChange}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white" data-testid="select-property">
                        <SelectValue placeholder="Choose a property" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((property) => (
                          <SelectItem key={property.id} value={property.id}>
                            {property.name} - {property.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.propertyId && roomTypes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-slate-300">Select Room Type *</Label>
                      <div className="grid grid-cols-2 gap-3">
                        {roomTypes.map((room) => (
                          <div
                            key={room.id}
                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                              formData.roomTypeId === room.id
                                ? "border-orange-500 bg-orange-500/10"
                                : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                            } ${room.availableBeds === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                            onClick={() => room.availableBeds > 0 && handleRoomTypeChange(room.id)}
                            data-testid={`room-type-${room.id}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="font-medium text-white">{room.name}</span>
                              <Badge variant={room.availableBeds > 0 ? "default" : "destructive"}>
                                {room.availableBeds} beds left
                              </Badge>
                            </div>
                            <div className="text-sm text-slate-400">
                              <p>{room.occupancy}-sharing</p>
                              <p className="text-orange-400 font-medium">
                                ₹{room.annualFee.toLocaleString()}/year
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {getSelectedProperty()?.bookingMode === "monthly" && formData.roomTypeId && (
                    <div className="space-y-4 p-4 bg-slate-700/30 rounded-lg">
                      <Label className="text-slate-300">Stay Plan Type</Label>
                      <RadioGroup
                        value={formData.stayPlanType}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, stayPlanType: v }))}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="academic_year" id="academic_year" data-testid="radio-academic" />
                          <Label htmlFor="academic_year" className="text-slate-200">
                            Full Academic Year
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="monthly" id="monthly" data-testid="radio-monthly" />
                          <Label htmlFor="monthly" className="text-slate-200">
                            Monthly Booking
                          </Label>
                        </div>
                      </RadioGroup>

                      {formData.stayPlanType === "monthly" && (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-slate-300">Check-in Date</Label>
                            <Input
                              type="date"
                              value={formData.checkInDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, checkInDate: e.target.value }))}
                              className="bg-slate-700 border-slate-600 text-white"
                              data-testid="input-checkin-date"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-300">Duration (Months)</Label>
                            <Input
                              type="number"
                              min="1"
                              max="12"
                              value={formData.durationMonths}
                              onChange={(e) => setFormData(prev => ({ ...prev, durationMonths: parseInt(e.target.value) || 1 }))}
                              className="bg-slate-700 border-slate-600 text-white"
                              data-testid="input-duration"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-slate-300">Check-out Date</Label>
                            <Input
                              type="date"
                              value={formData.checkOutDate}
                              onChange={(e) => setFormData(prev => ({ ...prev, checkOutDate: e.target.value }))}
                              className="bg-slate-700 border-slate-600 text-white"
                              data-testid="input-checkout-date"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {availability && (
                    <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2 text-green-400">
                        <BedDouble className="h-5 w-5" />
                        <span className="font-medium">
                          {availability.availableBeds} of {availability.totalBeds} beds available
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <IndianRupee className="h-5 w-5 text-orange-500" />
                  Pricing & Payment
                </h3>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-700/30 rounded-lg">
                      <Label className="text-slate-400 text-sm">Base Fee</Label>
                      <p className="text-2xl font-bold text-white">
                        ₹{formData.baseFee.toLocaleString()}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Security Deposit</Label>
                      <Input
                        type="number"
                        value={formData.deposit}
                        onChange={(e) => setFormData(prev => ({ ...prev, deposit: parseInt(e.target.value) || 0 }))}
                        className="bg-slate-700 border-slate-600 text-white"
                        placeholder="Enter deposit amount"
                        data-testid="input-deposit"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-slate-300">Discount</Label>
                        {isSalesExec && (
                          <span className="text-xs text-yellow-400">Max 10% without approval</span>
                        )}
                      </div>
                      <Input
                        type="number"
                        value={formData.discount}
                        onChange={(e) => setFormData(prev => ({ ...prev, discount: parseInt(e.target.value) || 0 }))}
                        className="bg-slate-700 border-slate-600 text-white"
                        placeholder="Enter discount amount"
                        data-testid="input-discount"
                      />
                      {getDiscountPercent() > 0 && (
                        <p className={`text-sm ${needsApproval() ? "text-yellow-400" : "text-slate-400"}`}>
                          {getDiscountPercent().toFixed(1)}% discount
                          {needsApproval() && " - Requires admin approval"}
                        </p>
                      )}
                    </div>

                    {formData.discount > 0 && (
                      <div className="space-y-2">
                        <Label className="text-slate-300">Discount Reason</Label>
                        <Textarea
                          value={formData.discountReason}
                          onChange={(e) => setFormData(prev => ({ ...prev, discountReason: e.target.value }))}
                          className="bg-slate-700 border-slate-600 text-white"
                          placeholder="Explain the reason for discount"
                          data-testid="input-discount-reason"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Payment Type</Label>
                      <RadioGroup
                        value={formData.paymentType}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, paymentType: v }))}
                        className="space-y-2"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="full" id="payment-full" data-testid="radio-payment-full" />
                          <Label htmlFor="payment-full" className="text-slate-200">
                            Full Payment
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="partial" id="payment-partial" data-testid="radio-payment-partial" />
                          <Label htmlFor="payment-partial" className="text-slate-200">
                            Partial (Token + Balance)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="installments" id="payment-installments" data-testid="radio-payment-installments" />
                          <Label htmlFor="payment-installments" className="text-slate-200">
                            Installment Plan
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    <Separator className="bg-slate-600" />

                    <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-slate-300">Base Fee</span>
                        <span className="text-white">₹{formData.baseFee.toLocaleString()}</span>
                      </div>
                      {formData.discount > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300">Discount</span>
                          <span className="text-green-400">-₹{formData.discount.toLocaleString()}</span>
                        </div>
                      )}
                      {formData.deposit > 0 && (
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-300">Security Deposit</span>
                          <span className="text-white">₹{formData.deposit.toLocaleString()}</span>
                        </div>
                      )}
                      <Separator className="bg-slate-600 my-2" />
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-white">Total Amount</span>
                        <span className="text-xl font-bold text-orange-400">
                          ₹{calculateTotal().toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {needsApproval() && (
                      <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-400">
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
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-orange-500" />
                  Review & Confirm
                </h3>

                <div className="grid grid-cols-2 gap-6">
                  <Card className="bg-slate-700/30 border-slate-600">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-400">Customer Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium text-white">
                        {formData.customerType === "lead"
                          ? getSelectedLead()?.studentName
                          : formData.walkInName}
                      </p>
                      <p className="text-sm text-slate-400">
                        {formData.customerType === "lead"
                          ? getSelectedLead()?.phone
                          : formData.walkInPhone}
                      </p>
                      <Badge className="mt-2" variant="outline">
                        {formData.customerType.replace("_", " ")}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-700/30 border-slate-600">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-400">Property & Room</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium text-white">{getSelectedProperty()?.name}</p>
                      <p className="text-sm text-slate-400">{getSelectedRoomType()?.name}</p>
                      <p className="text-sm text-orange-400 mt-1">
                        {formData.stayPlanType === "monthly"
                          ? `${formData.durationMonths} months`
                          : "Full Academic Year"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-700/30 border-slate-600 col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-slate-400">Payment Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-slate-400">Base Fee</p>
                          <p className="font-medium text-white">₹{formData.baseFee.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Discount</p>
                          <p className="font-medium text-green-400">-₹{formData.discount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Deposit</p>
                          <p className="font-medium text-white">₹{formData.deposit.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Total</p>
                          <p className="font-bold text-orange-400">₹{calculateTotal().toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <Badge variant="outline">{formData.paymentType} payment</Badge>
                        {needsApproval() && (
                          <Badge variant="destructive">Requires Approval</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-slate-700">
              {step > 1 ? (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="border-slate-600 text-slate-300"
                  data-testid="button-back-step"
                >
                  Back
                </Button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <Button
                  onClick={handleNext}
                  className="bg-orange-500 hover:bg-orange-600 text-white"
                  data-testid="button-next-step"
                >
                  Continue
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-submit-booking"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Booking...
                    </>
                  ) : needsApproval() ? (
                    "Submit for Approval"
                  ) : (
                    "Create Booking"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-500" />
              Booking Created Successfully
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {bookingResult?.requiresApproval
                ? "Your booking has been submitted for admin approval."
                : "The booking has been created and is ready for payment."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {bookingResult?.booking && (
              <div className="p-4 bg-slate-700/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400">Booking Code</span>
                  <span className="font-mono font-bold text-orange-400">
                    {bookingResult.booking.bookingCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Status</span>
                  <Badge variant={bookingResult.requiresApproval ? "destructive" : "default"}>
                    {bookingResult.booking.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false);
                navigate(isAdmin ? "/admin" : "/sales");
              }}
              className="border-slate-600 text-slate-300"
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
                className="bg-orange-500 hover:bg-orange-600 text-white"
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
