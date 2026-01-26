import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { createPayment, getPayment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function PaymentGateway() {
  const [status, setStatus] = useState<"processing" | "success" | "failed">("processing");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    processPayment();
  }, []);

  const processPayment = async () => {
    try {
      // Get booking and installment data
      const bookingData = localStorage.getItem("hsquare_booking");
      const installmentsData = localStorage.getItem("hsquare_installments");

      if (!bookingData || !installmentsData) {
        toast({
          title: "Error",
          description: "Booking not found. Please start from the beginning.",
          variant: "destructive",
        });
        setLocation("/properties");
        return;
      }

      const booking = JSON.parse(bookingData);
      const installments = JSON.parse(installmentsData);
      const bookingInstallment = installments.find((i: any) => i.name === "Booking Amount");

      // Create payment
      const payment = await createPayment({
        bookingId: booking.id,
        amount: 100000,
        installmentId: bookingInstallment?.id,
      });

      setPaymentId(payment.id);

      // Poll payment status
      const pollInterval = setInterval(async () => {
        const updatedPayment = await getPayment(payment.id);
        
        if (updatedPayment.status === "success") {
          clearInterval(pollInterval);
          setStatus("success");
          
          // Store payment details
          localStorage.setItem("hsquare_payment", JSON.stringify(updatedPayment));
        } else if (updatedPayment.status === "failed") {
          clearInterval(pollInterval);
          setStatus("failed");
        }
      }, 1000);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        if (status === "processing") {
          setStatus("failed");
        }
      }, 10000);

    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
      setStatus("failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-6">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-xl font-heading font-bold text-gray-800">Razorpay Secure</h2>
          <p className="text-sm text-gray-500">Hsquareliving Pvt Ltd</p>
        </div>

        {status === "processing" && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" data-testid="loader-processing" />
            <p className="text-lg font-medium text-gray-700">Processing Payment...</p>
            <p className="text-sm text-gray-500">Do not close this window.</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8 space-y-4 animate-in zoom-in-50 duration-300">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" data-testid="icon-success" />
            <h3 className="text-2xl font-bold text-green-600">Payment Successful!</h3>
            {paymentId && (
              <p className="text-gray-600" data-testid="text-payment-id">Transaction ID: #{paymentId.slice(0, 12)}</p>
            )}
            <p className="text-sm text-gray-500">Amount Paid: ₹1,00,000</p>
            <Button 
              className="w-full mt-4 bg-primary text-white" 
              onClick={() => setLocation("/agreement")}
              data-testid="button-generate-agreement"
            >
              Generate Agreement
            </Button>
          </div>
        )}

        {status === "failed" && (
          <div className="py-8 space-y-4">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" data-testid="icon-failed" />
            <h3 className="text-2xl font-bold text-red-600">Payment Failed</h3>
            <p className="text-gray-600">Please try again.</p>
            <Button 
              variant="outline" 
              onClick={() => { setStatus("processing"); processPayment(); }}
              data-testid="button-retry"
            >
              Retry
            </Button>
          </div>
        )}

        <div className="text-xs text-gray-400 pt-4 flex justify-center gap-2 items-center">
          <span>Secured by Razorpay</span>
        </div>
      </div>
    </div>
  );
}
