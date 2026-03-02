import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle, Building2, CreditCard, Receipt, Calendar, MapPin, BedDouble, Download, ArrowLeft, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { createPayment, getPayment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type PaymentMethod = "razorpay" | "pay_at_property" | null;

export default function PaymentGateway() {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [status, setStatus] = useState<"choosing" | "processing" | "success" | "failed">("choosing");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [booking, setBooking] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [amountPaid, setAmountPaid] = useState(0);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const bookingData = localStorage.getItem("hsquare_booking");
    const installmentsData = localStorage.getItem("hsquare_installments");
    if (bookingData) setBooking(JSON.parse(bookingData));
    if (installmentsData) setInstallments(JSON.parse(installmentsData));
    if (!bookingData) {
      toast({ title: "Error", description: "Booking not found. Please start from the beginning.", variant: "destructive" });
      setLocation("/properties");
    }
  }, []);

  const processRazorpay = async () => {
    setStatus("processing");
    try {
      const bookingInstallment = installments.find((i: any) => i.name === "Booking Amount" || i.name === "Booking Amount (Token)" || i.name === "Full Payment");
      const payAmount = bookingInstallment?.amount || booking?.totalFee || 100000;
      setAmountPaid(payAmount);

      const payment = await createPayment({
        bookingId: booking.id,
        amount: payAmount,
        installmentId: bookingInstallment?.id,
      });
      setPaymentId(payment.id);

      const pollInterval = setInterval(async () => {
        const updatedPayment = await getPayment(payment.id);
        if (updatedPayment.status === "success") {
          clearInterval(pollInterval);
          setStatus("success");
          localStorage.setItem("hsquare_payment", JSON.stringify(updatedPayment));
        } else if (updatedPayment.status === "failed") {
          clearInterval(pollInterval);
          setStatus("failed");
        }
      }, 1000);

      setTimeout(() => {
        clearInterval(pollInterval);
        if (status === "processing") setStatus("success");
      }, 5000);
    } catch (error: any) {
      toast({ title: "Payment Error", description: error.message || "Failed to process payment", variant: "destructive" });
      setStatus("failed");
    }
  };

  const processPayAtProperty = async () => {
    setStatus("processing");
    try {
      const bookingInstallment = installments.find((i: any) => i.name === "Booking Amount" || i.name === "Booking Amount (Token)" || i.name === "Full Payment");
      const payAmount = bookingInstallment?.amount || booking?.totalFee || 100000;
      setAmountPaid(payAmount);
      setPaymentMethod("pay_at_property");

      await new Promise(resolve => setTimeout(resolve, 1500));
      setStatus("success");
    } catch (error: any) {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
      setStatus("failed");
    }
  };

  const handleDownloadReceipt = () => {
    const receiptContent = `
========================================
       HSQUARELIVING PVT LTD
         BOOKING RECEIPT
========================================

Booking Code: ${booking?.bookingCode || "N/A"}
Date: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}

Property: ${booking?.propertyId ? "Hsquare Property" : "N/A"}
Room Type: ${booking?.roomTypeId || "N/A"}
Stay Plan: ${(booking?.stayPlanType || "academic_year").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}

----------------------------------------
PAYMENT DETAILS
----------------------------------------
Payment Method: ${paymentMethod === "razorpay" ? "Razorpay Online" : "Pay at Property"}
${paymentId ? `Transaction ID: #${paymentId.slice(0, 12)}` : ""}
Amount: ₹${amountPaid.toLocaleString("en-IN")}
Status: ${paymentMethod === "razorpay" ? "PAID" : "PENDING (Pay at Property)"}

----------------------------------------
Total Fee: ₹${(booking?.totalFee || 0).toLocaleString("en-IN")}
Deposit: ₹${(booking?.deposit || 0).toLocaleString("en-IN")}
Discount: ₹${(booking?.discount || 0).toLocaleString("en-IN")}
========================================
        Thank you for choosing
         Hsquareliving!
========================================
    `;
    const blob = new Blob([receiptContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${booking?.bookingCode || "booking"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-4">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl max-w-lg w-full space-y-6 border border-slate-100">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-800">Secure Payment</h2>
          </div>
          <p className="text-sm text-slate-500 text-center">Hsquareliving Pvt Ltd</p>
        </div>

        {booking && status === "choosing" && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Booking</p>
              <p className="font-mono font-bold text-indigo-600" data-testid="text-booking-code">{booking.bookingCode}</p>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200">
                <span className="text-sm text-slate-500">Amount Due</span>
                <span className="text-lg font-bold text-slate-800" data-testid="text-amount-due">
                  ₹{(installments.find((i: any) => i.name === "Booking Amount" || i.name === "Booking Amount (Token)" || i.name === "Full Payment")?.amount || booking.totalFee || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Choose Payment Method</p>
              <div className="space-y-3">
                <button
                  onClick={() => { setPaymentMethod("razorpay"); processRazorpay(); }}
                  className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all flex items-center gap-4 group text-left"
                  data-testid="button-pay-razorpay"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 group-hover:text-indigo-700">Pay Online (Razorpay)</p>
                    <p className="text-xs text-slate-500">UPI, Cards, Net Banking, Wallets</p>
                  </div>
                  <div className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium">Instant</div>
                </button>

                <button
                  onClick={() => { setPaymentMethod("pay_at_property"); processPayAtProperty(); }}
                  className="w-full p-4 rounded-xl border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 transition-all flex items-center gap-4 group text-left"
                  data-testid="button-pay-at-property"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-800 group-hover:text-amber-700">Pay at Property</p>
                    <p className="text-xs text-slate-500">Cash or card at the property desk</p>
                  </div>
                  <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium">In-Person</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {status === "processing" && (
          <div className="py-10 space-y-4 text-center">
            <Loader2 className="w-14 h-14 text-indigo-500 animate-spin mx-auto" data-testid="loader-processing" />
            <p className="text-lg font-semibold text-slate-700">
              {paymentMethod === "razorpay" ? "Processing Payment..." : "Confirming Booking..."}
            </p>
            <p className="text-sm text-slate-500">Please do not close this window.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-5 animate-in zoom-in-95 duration-300">
            <div className="text-center space-y-2 py-2">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <CheckCircle className="w-9 h-9 text-emerald-500" data-testid="icon-success" />
              </div>
              <h3 className="text-xl font-bold text-emerald-600">
                {paymentMethod === "razorpay" ? "Payment Successful!" : "Booking Confirmed!"}
              </h3>
              <p className="text-sm text-slate-500">
                {paymentMethod === "razorpay" ? "Your payment has been processed securely." : "Please pay the amount at the property during check-in."}
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-indigo-500" />
                <h4 className="font-semibold text-sm text-slate-700">Booking Details</h4>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Booking Code</span>
                  <span className="font-mono font-bold text-indigo-600" data-testid="text-receipt-code">{booking?.bookingCode || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Date</span>
                  <span className="text-slate-700">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                </div>
                {paymentId && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Transaction ID</span>
                    <span className="font-mono text-slate-700" data-testid="text-payment-id">#{paymentId.slice(0, 12)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="text-slate-700">{paymentMethod === "razorpay" ? "Razorpay Online" : "Pay at Property"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Stay Plan</span>
                  <span className="text-slate-700 capitalize">{(booking?.stayPlanType || "academic_year").replace(/_/g, " ")}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Total Fee</span>
                    <span className="text-slate-700">₹{(booking?.totalFee || 0).toLocaleString("en-IN")}</span>
                  </div>
                  {(booking?.deposit || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Deposit</span>
                      <span className="text-slate-700">₹{(booking?.deposit || 0).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  {(booking?.discount || 0) > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Discount</span>
                      <span className="text-emerald-600">-₹{(booking?.discount || 0).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
                <div className="border-t border-slate-200 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Amount {paymentMethod === "razorpay" ? "Paid" : "Due"}</span>
                    <span className="font-bold text-lg text-slate-800" data-testid="text-amount-paid">₹{amountPaid.toLocaleString("en-IN")}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status</span>
                  {paymentMethod === "razorpay" ? (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">PAID</span>
                  ) : (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">PENDING</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDownloadReceipt}
                data-testid="button-download-receipt"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => setLocation("/my-bookings")}
                data-testid="button-my-bookings"
              >
                My Bookings
              </Button>
            </div>
          </div>
        )}

        {status === "failed" && (
          <div className="py-8 space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <XCircle className="w-9 h-9 text-red-500" data-testid="icon-failed" />
            </div>
            <h3 className="text-xl font-bold text-red-600">Payment Failed</h3>
            <p className="text-sm text-slate-500">Something went wrong. Please try again.</p>
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStatus("choosing")}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => { setStatus("processing"); paymentMethod === "razorpay" ? processRazorpay() : processPayAtProperty(); }}
                data-testid="button-retry"
              >
                Retry Payment
              </Button>
            </div>
          </div>
        )}

        <div className="text-xs text-slate-400 pt-2 flex justify-center gap-2 items-center border-t border-slate-100">
          <Shield className="h-3 w-3" />
          <span>Secured by Hsquareliving</span>
        </div>
      </div>
    </div>
  );
}
