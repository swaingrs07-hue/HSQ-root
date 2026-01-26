import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export default function PaymentGateway() {
  const [status, setStatus] = useState<"processing" | "success" | "failed">("processing");
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Simulate Payment Processing
    const timer = setTimeout(() => {
      setStatus("success");
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-6">
        <div className="border-b pb-4 mb-4">
          <h2 className="text-xl font-heading font-bold text-gray-800">Razorpay Secure</h2>
          <p className="text-sm text-gray-500">Hsquareliving Pvt Ltd</p>
        </div>

        {status === "processing" && (
          <div className="py-8 space-y-4">
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto" />
            <p className="text-lg font-medium text-gray-700">Processing Payment...</p>
            <p className="text-sm text-gray-500">Do not close this window.</p>
          </div>
        )}

        {status === "success" && (
          <div className="py-8 space-y-4 animate-in zoom-in-50 duration-300">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h3 className="text-2xl font-bold text-green-600">Payment Successful!</h3>
            <p className="text-gray-600">Transaction ID: #RZP-88349201</p>
            <p className="text-sm text-gray-500">Amount Paid: ₹1,00,000</p>
            <Button 
              className="w-full mt-4 bg-primary text-white" 
              onClick={() => setLocation("/agreement")}
            >
              Generate Agreement
            </Button>
          </div>
        )}

        {status === "failed" && (
          <div className="py-8 space-y-4">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h3 className="text-2xl font-bold text-red-600">Payment Failed</h3>
            <p className="text-gray-600">Please try again.</p>
            <Button variant="outline" onClick={() => setStatus("processing")}>Retry</Button>
          </div>
        )}

        <div className="text-xs text-gray-400 pt-4 flex justify-center gap-2 items-center">
          <span>Secured by Razorpay</span>
        </div>
      </div>
    </div>
  );
}
