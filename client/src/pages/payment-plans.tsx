import { PAYMENT_PLANS } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle, Tag, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createBooking, validateCoupon } from "@/lib/api";

interface SelectedRoom {
  propId: string;
  roomId: string;
  price: number;
  roomName: string;
  propName: string;
  bookingMode?: string;
  deposit?: number;
}

export default function PaymentPlans() {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(PAYMENT_PLANS[0].id);
  const [roomData, setRoomData] = useState<SelectedRoom | null>(null);
  const [processing, setProcessing] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponApplying, setCouponApplying] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    name?: string;
    discount: number;
  } | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const data = localStorage.getItem("selected_room");
    if (data) {
      setRoomData(JSON.parse(data));
    } else {
      setLocation("/properties");
    }
  }, []);

  if (!roomData) return null;

  const handleApplyCoupon = async () => {
    if (!roomData) return;
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError("Enter a coupon code");
      return;
    }
    setCouponApplying(true);
    setCouponError(null);
    try {
      const studentRaw = localStorage.getItem("hsquare_student");
      const student = studentRaw ? JSON.parse(studentRaw) : null;
      const result = await validateCoupon({
        code,
        bookingValue: roomData.price,
        propertyId: roomData.propId,
        roomTypeId: roomData.roomId,
        userId: student?.userId || student?.id,
      });
      if (!result.valid) {
        setAppliedCoupon(null);
        setCouponError(result.error || "Invalid coupon");
        return;
      }
      setAppliedCoupon({
        code: result.coupon!.code,
        name: result.coupon!.name,
        discount: result.discount || 0,
      });
      toast({
        title: "Coupon applied",
        description: `${result.coupon!.code} — you save ₹${(result.discount || 0).toLocaleString("en-IN")}`,
      });
    } catch (err: any) {
      setCouponError(err?.message || "Could not validate coupon");
    } finally {
      setCouponApplying(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  const handleProceed = async () => {
    try {
      setProcessing(true);

      // Get student data
      const studentData = localStorage.getItem("hsquare_student");
      if (!studentData) {
        toast({
          title: "Error",
          description: "Student registration not found. Please register first.",
          variant: "destructive",
        });
        setLocation("/register");
        return;
      }

      const student = JSON.parse(studentData);
      const plan = PAYMENT_PLANS.find(p => p.id === selectedPlanId);

      // Create booking
      const result = await createBooking({
        studentId: student.id,
        propertyId: roomData.propId,
        roomTypeId: roomData.roomId,
        baseFee: roomData.price,
        paymentPlanId: selectedPlanId,
        discount: plan?.discount || 0,
        couponCode: appliedCoupon?.code,
      });

      // Store booking info
      localStorage.setItem("hsquare_booking", JSON.stringify(result.booking));
      localStorage.setItem("hsquare_installments", JSON.stringify(result.installments));

      // Navigate to payment gateway
      setLocation("/payment-gateway");
    } catch (error: any) {
      toast({
        title: "Booking Failed",
        description: error.message || "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const calculateInstallments = (plan: typeof PAYMENT_PLANS[0]) => {
    let total = roomData.price;
    if (plan.discount) total -= plan.discount;

    const bookingAmount = Math.min(100000, total);
    const remaining = Math.max(0, total - bookingAmount);

    return plan.installments
      .map(inst => {
        let amount = inst.fixed > 0 ? Math.min(inst.fixed, total) : 0;
        if (inst.percentage > 0) {
          amount = remaining * (inst.percentage / 100);
        }
        return { ...inst, amount: Math.round(amount) };
      })
      .filter(inst => inst.amount > 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30 relative overflow-hidden">
      <style>{`
        @keyframes ppFloat1 { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-16px) rotate(4deg); } }
        @keyframes ppFloat2 { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-12px) rotate(-5deg); } }
      `}</style>
      <div className="absolute top-12 right-[8%] w-16 h-16 md:w-24 md:h-24 opacity-40 pointer-events-none" style={{ animation: "ppFloat1 7s ease-in-out infinite" }}>
        <svg viewBox="0 0 100 100" fill="none"><defs><linearGradient id="pp1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35"/><stop offset="100%" stopColor="#f97316" stopOpacity="0.15"/></linearGradient></defs><path d="M50 5 L90 30 L90 70 L50 95 L10 70 L10 30 Z" fill="url(#pp1)" stroke="#f59e0b" strokeWidth="1" strokeOpacity="0.25"/></svg>
      </div>
      <div className="absolute bottom-20 left-[6%] w-14 h-14 md:w-20 md:h-20 opacity-35 pointer-events-none" style={{ animation: "ppFloat2 8s ease-in-out infinite 1s" }}>
        <svg viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="40" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeOpacity="0.15"/></svg>
      </div>
      <div className="absolute top-1/2 left-[45%] w-10 h-10 opacity-25 pointer-events-none" style={{ animation: "ppFloat1 10s ease-in-out infinite 2s" }}>
        <svg viewBox="0 0 100 100" fill="none"><rect x="15" y="15" width="70" height="70" rx="18" fill="none" stroke="#ec4899" strokeWidth="2" strokeOpacity="0.15" transform="rotate(15 50 50)"/></svg>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100/80 text-amber-700 text-sm font-semibold tracking-wider uppercase mb-4 border border-amber-200/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Payment
        </span>
        <h1 className="text-3xl md:text-4xl font-heading font-bold text-gray-900">Choose Payment Plan</h1>
        <div className="w-12 h-1 bg-gradient-to-r from-amber-400 to-amber-600 mx-auto mt-4 mb-3 rounded-full" />
        <p className="text-gray-500">Flexible options designed for your convenience.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Summary */}
        <div className="lg:col-span-1 order-2 lg:order-1">
          <Card className="sticky top-24 border-primary/10 shadow-lg bg-primary/5">
            <CardHeader>
              <CardTitle className="text-xl">Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Property</p>
                <p className="font-bold text-lg">{roomData.propName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Room Type</p>
                <p className="font-bold">{roomData.roomName} Occupancy</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Booking Type</p>
                <p className={`font-bold ${roomData.bookingMode === "academic_year" ? "text-purple-600" : "text-blue-600"}`}>
                  {roomData.bookingMode === "academic_year" ? "Academic Year" : "Monthly"}
                </p>
              </div>
              <div className="pt-4 border-t border-primary/10">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-muted-foreground">
                    {roomData.bookingMode === "academic_year" ? "Annual Fee" : "Monthly Fee"}
                  </p>
                  <p className="font-medium">₹{roomData.price.toLocaleString()}</p>
                </div>
                {(roomData.deposit || 0) > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm text-muted-foreground">Deposit (Refundable)</p>
                    <p className="font-medium">₹{roomData.deposit?.toLocaleString()}</p>
                  </div>
                )}
                {appliedCoupon && (
                  <div className="flex justify-between items-center mb-2" data-testid="row-coupon-discount">
                    <p className="text-sm text-emerald-700 flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Coupon ({appliedCoupon.code})
                    </p>
                    <p className="font-medium text-emerald-700">- ₹{appliedCoupon.discount.toLocaleString("en-IN")}</p>
                  </div>
                )}
                <div className="flex justify-between items-center text-lg font-bold text-primary mt-4 pt-4 border-t border-primary/10">
                  <p>Total Payable</p>
                  <p data-testid="text-total-payable">
                    ₹{Math.max(0, (
                      roomData.price + (roomData.deposit || 0)
                      - (PAYMENT_PLANS.find(p => p.id === selectedPlanId)?.discount || 0)
                      - (appliedCoupon?.discount || 0)
                    )).toLocaleString()}
                  </p>
                </div>
                {(PAYMENT_PLANS.find(p => p.id === selectedPlanId)?.discount || appliedCoupon) ? (
                  <p className="text-xs text-green-600 text-right mt-1 font-medium">
                    (Includes ₹{(
                      (PAYMENT_PLANS.find(p => p.id === selectedPlanId)?.discount || 0)
                      + (appliedCoupon?.discount || 0)
                    ).toLocaleString()} Discount)
                  </p>
                ) : null}
              </div>

              {/* Coupon entry */}
              <div className="pt-4 border-t border-primary/10">
                <p className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  Have a coupon?
                </p>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg p-3" data-testid="card-applied-coupon">
                    <div>
                      <p className="font-mono text-sm font-bold text-emerald-700" data-testid="text-applied-coupon-code">{appliedCoupon.code}</p>
                      {appliedCoupon.name && (
                        <p className="text-xs text-emerald-600">{appliedCoupon.name}</p>
                      )}
                      <p className="text-xs text-emerald-700 mt-0.5">You save ₹{appliedCoupon.discount.toLocaleString("en-IN")}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveCoupon}
                      className="text-emerald-700 hover:text-emerald-900 p-1 rounded"
                      aria-label="Remove coupon"
                      data-testid="button-remove-coupon"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code (e.g. HSQ100)"
                        value={couponInput}
                        onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleApplyCoupon(); } }}
                        className="h-9 uppercase"
                        disabled={couponApplying}
                        data-testid="input-coupon-code"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleApplyCoupon}
                        disabled={couponApplying || !couponInput.trim()}
                        data-testid="button-apply-coupon"
                      >
                        {couponApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                    {couponError && (
                      <p className="text-xs text-red-600 mt-1.5" data-testid="text-coupon-error">{couponError}</p>
                    )}
                  </>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700" 
                onClick={handleProceed}
                disabled={processing}
                data-testid="button-proceed-payment"
              >
                {processing ? "Creating Booking..." : `Proceed to Pay ₹${Math.min(100000, roomData.price).toLocaleString("en-IN")}`}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Plans Selection */}
        <div className="lg:col-span-2 order-1 lg:order-2 space-y-6">
          <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId} className="grid gap-6">
            {PAYMENT_PLANS.map((plan) => {
              const installments = calculateInstallments(plan);
              const isSelected = selectedPlanId === plan.id;
              
              return (
                <div key={plan.id} className={`relative`}>
                  <RadioGroupItem value={plan.id} id={plan.id} className="peer sr-only" />
                  <Label 
                    htmlFor={plan.id}
                    className={`flex flex-col p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${isSelected ? "border-primary bg-primary/5 shadow-lg" : "border-muted bg-card hover:border-primary/50"}`}
                    data-testid={`plan-card-${plan.id}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-heading font-bold text-xl flex items-center gap-2">
                          {plan.name}
                          {plan.discount > 0 && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-bold">Save ₹{plan.discount.toLocaleString()}</span>}
                        </h3>
                        <p className="text-muted-foreground text-sm mt-1">{plan.description}</p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-6 h-6 text-primary" />}
                    </div>

                    <div className="space-y-3 bg-white p-4 rounded-lg border">
                      {installments.map((inst, i) => (
                        <div key={i} className="flex justify-between text-sm items-center">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent/50"></span>
                            {inst.name}
                            <span className="text-xs bg-muted px-1.5 rounded text-muted-foreground">{inst.due}</span>
                          </span>
                          <span className="font-bold font-mono">₹{inst.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
             <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
             <div className="text-sm text-amber-800">
               <p className="font-bold">Important Note:</p>
               <p>A mandatory booking amount of ₹1,00,000 is required to secure your room. The remaining balance will be scheduled according to your selected plan.</p>
             </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
