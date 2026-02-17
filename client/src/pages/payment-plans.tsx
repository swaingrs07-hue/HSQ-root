import { PAYMENT_PLANS } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createBooking } from "@/lib/api";

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
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-primary">Choose Payment Plan</h1>
        <p className="text-muted-foreground">Flexible options designed for your convenience.</p>
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
                <div className="flex justify-between items-center text-lg font-bold text-primary mt-4 pt-4 border-t border-primary/10">
                  <p>Total Payable</p>
                  <p>
                    ₹{(
                      roomData.price + (roomData.deposit || 0) - (PAYMENT_PLANS.find(p => p.id === selectedPlanId)?.discount || 0)
                    ).toLocaleString()}
                  </p>
                </div>
                {PAYMENT_PLANS.find(p => p.id === selectedPlanId)?.discount ? (
                  <p className="text-xs text-green-600 text-right mt-1 font-medium">
                    (Includes ₹{PAYMENT_PLANS.find(p => p.id === selectedPlanId)?.discount?.toLocaleString()} Discount)
                  </p>
                ) : null}
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
  );
}
