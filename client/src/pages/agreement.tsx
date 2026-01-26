import { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Download, Check, ArrowLeft } from "lucide-react";
import { useLocation, Link } from "wouter";
import { generateAgreement } from "@/lib/api";

export default function Agreement() {
  const sigPad = useRef<any>(null);
  const [signed, setSigned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [studentData, setStudentData] = useState<any>(null);
  const [roomData, setRoomData] = useState<any>(null);
  const [bookingData, setBookingData] = useState<any>(null);

  useEffect(() => {
    const sData = localStorage.getItem("hsquare_student");
    const rData = localStorage.getItem("selected_room");
    const bData = localStorage.getItem("hsquare_booking");
    
    if (sData) setStudentData(JSON.parse(sData));
    if (rData) setRoomData(JSON.parse(rData));
    if (bData) setBookingData(JSON.parse(bData));
  }, []);

  const clearSig = () => {
    sigPad.current?.clear();
    setSigned(false);
  };

  const handleSign = async () => {
    if (sigPad.current?.isEmpty()) {
      toast({ title: "Error", description: "Please sign the document first", variant: "destructive" });
      return;
    }

    try {
      setProcessing(true);

      // Get signature data
      const signatureData = sigPad.current?.toDataURL();

      // Generate agreement
      await generateAgreement(bookingData.id, signatureData);

      setSigned(true);
      toast({ 
        title: "Agreement Signed", 
        description: "Your agreement has been generated. A copy has been emailed to you." 
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate agreement",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!studentData || !roomData || !bookingData) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading Agreement Data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex justify-between items-center mb-8 print:hidden">
        <h1 className="text-3xl font-heading font-bold text-primary">Lease Agreement</h1>
        <Button variant="outline" onClick={() => window.print()} data-testid="button-download">
          <Download className="w-4 h-4 mr-2" /> Download PDF
        </Button>
      </div>

      <Card className="p-12 shadow-xl bg-white text-sm leading-relaxed font-serif border-none" id="agreement-content">
        <div className="text-center mb-8 border-b pb-8">
          <h2 className="text-2xl font-bold uppercase tracking-widest mb-2">Student Living Agreement</h2>
          <p className="text-muted-foreground">Hsquareliving Pvt Ltd</p>
        </div>

        <div className="space-y-6">
          <p>
            This Lease Agreement is made on <strong>{new Date().toLocaleDateString()}</strong> between 
            <strong> Hsquareliving Pvt Ltd</strong> (Lessor) and 
            <strong> {studentData.fullName}</strong> (Lessee).
          </p>

          <div className="bg-muted/30 p-6 rounded-lg space-y-2">
            <h3 className="font-bold uppercase text-xs text-muted-foreground mb-2">Lessee Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <p><span className="font-semibold">Name:</span> {studentData.fullName}</p>
              <p><span className="font-semibold">Phone:</span> {studentData.phone}</p>
              <p><span className="font-semibold">Email:</span> {studentData.email}</p>
              <p><span className="font-semibold">College:</span> {studentData.collegeName}</p>
            </div>
          </div>

          <div className="bg-muted/30 p-6 rounded-lg space-y-2">
            <h3 className="font-bold uppercase text-xs text-muted-foreground mb-2">Property Details</h3>
            <p><span className="font-semibold">Property:</span> {roomData.propName}</p>
            <p><span className="font-semibold">Room Type:</span> {roomData.roomName}</p>
            <p><span className="font-semibold">Total Fee:</span> ₹{bookingData.totalFee.toLocaleString()}</p>
          </div>

          <div>
            <h3 className="font-bold text-lg mb-2">Terms & Conditions</h3>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              <li>The booking amount of ₹1,00,000 is non-refundable.</li>
              <li>The student agrees to abide by the hostel rules and regulations.</li>
              <li>Any damage to property will be charged to the student.</li>
              <li>Visitors are allowed only in common areas during visiting hours.</li>
              <li>Possession of illegal substances is strictly prohibited and grounds for immediate eviction.</li>
            </ul>
          </div>

          <div className="mt-12 pt-8 border-t break-inside-avoid">
            <div className="grid grid-cols-2 gap-12">
              <div>
                <p className="font-bold mb-4">Lessor Signature</p>
                <div className="h-20 border-b border-black flex items-end pb-2 font-cursive text-2xl">
                  Hsquare Admin
                </div>
                <p className="text-xs text-muted-foreground mt-1">Authorized Signatory</p>
              </div>
              
              <div>
                <p className="font-bold mb-4">Lessee Signature</p>
                <div className="border border-dashed border-gray-400 rounded bg-gray-50 relative">
                  {!signed ? (
                    <>
                      <SignatureCanvas 
                        ref={sigPad}
                        canvasProps={{className: "w-full h-32 cursor-crosshair"}}
                      />
                      <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-white px-2 py-1 rounded shadow-sm">Sign Here</div>
                    </>
                  ) : (
                    <div className="w-full h-32 flex items-center justify-center text-green-600 font-bold bg-green-50">
                      <Check className="w-6 h-6 mr-2" /> Digitally Signed
                    </div>
                  )}
                </div>
                {!signed && (
                  <div className="flex gap-2 mt-2">
                    <Button 
                      size="sm" 
                      onClick={handleSign} 
                      className="flex-1"
                      disabled={processing}
                      data-testid="button-sign"
                    >
                      {processing ? "Signing..." : "Confirm Signature"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSig} data-testid="button-clear">
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      <div className="mt-8 text-center print:hidden">
        <Link href="/">
           <a className="text-muted-foreground hover:text-primary text-sm flex items-center justify-center gap-2">
             <ArrowLeft className="w-4 h-4"/> Back to Home
           </a>
        </Link>
      </div>
    </div>
  );
}
