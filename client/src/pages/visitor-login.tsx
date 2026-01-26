import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { Phone, Mail, Lock, User, ArrowRight } from "lucide-react";

export default function VisitorLogin() {
  const { loginVisitor } = useAuth();
  const { toast } = useToast();
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailName, setEmailName] = useState("");

  const handleSendOtp = async () => {
    if (!name || !phone) {
      toast({
        title: "Required Fields",
        description: "Please enter your name and phone number",
        variant: "destructive",
      });
      return;
    }

    if (phone.length < 10) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid 10-digit phone number",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/visitor/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send OTP");
      }

      setOtpSent(true);
      toast({
        title: "OTP Sent",
        description: "Please enter the 4-digit code sent to your phone",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 4) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 4-digit OTP",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/visitor/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      toast({
        title: "Welcome!",
        description: `Hello ${data.lead.name}, let's find your perfect room`,
      });

      loginVisitor(data.lead);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailName || !email || !password) {
      toast({
        title: "Required Fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/auth/visitor/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: emailName }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login failed");
      }

      toast({
        title: "Welcome!",
        description: `Hello ${data.lead.name}, let's find your perfect room`,
      });

      loginVisitor(data.lead);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-white to-primary/10 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-heading font-bold text-2xl">
              H²
            </div>
          </div>
          <h1 className="text-3xl font-heading font-bold text-primary">
            Hsquare<span className="text-foreground">living</span>
          </h1>
          <p className="text-muted-foreground mt-2">Premium Student Accommodation</p>
        </div>

        <Card className="shadow-2xl border-none">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Welcome</CardTitle>
            <CardDescription>Sign in to explore our properties</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="phone" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="phone" className="gap-2" data-testid="tab-phone">
                  <Phone className="w-4 h-4" /> Mobile
                </TabsTrigger>
                <TabsTrigger value="email" className="gap-2" data-testid="tab-email">
                  <Mail className="w-4 h-4" /> Email
                </TabsTrigger>
              </TabsList>

              <TabsContent value="phone" className="space-y-4">
                {!otpSent ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Your Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="name"
                          placeholder="Enter your full name"
                          className="pl-10"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          data-testid="input-name"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="10-digit mobile number"
                          className="pl-10"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          data-testid="input-phone"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handleSendOtp} 
                      className="w-full h-12 text-lg font-bold"
                      disabled={loading}
                      data-testid="button-send-otp"
                    >
                      {loading ? "Sending..." : "Send OTP"}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="text-center text-sm text-muted-foreground mb-4">
                      OTP sent to <span className="font-semibold text-foreground">+91 {phone}</span>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="otp">Enter OTP</Label>
                      <Input
                        id="otp"
                        type="text"
                        placeholder="4-digit OTP"
                        className="text-center text-2xl tracking-[0.5em] font-bold"
                        maxLength={4}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        data-testid="input-otp"
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        For testing, use OTP: <span className="font-mono font-bold">1234</span>
                      </p>
                    </div>
                    <Button 
                      onClick={handleVerifyOtp} 
                      className="w-full h-12 text-lg font-bold"
                      disabled={loading}
                      data-testid="button-verify-otp"
                    >
                      {loading ? "Verifying..." : "Verify & Continue"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="w-full"
                      onClick={() => { setOtpSent(false); setOtp(""); }}
                      data-testid="button-change-number"
                    >
                      Change Number
                    </Button>
                  </>
                )}
              </TabsContent>

              <TabsContent value="email">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailName">Your Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="emailName"
                        placeholder="Enter your full name"
                        className="pl-10"
                        value={emailName}
                        onChange={(e) => setEmailName(e.target.value)}
                        data-testid="input-email-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        data-testid="input-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Create a password"
                        className="pl-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        data-testid="input-password"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-12 text-lg font-bold"
                    disabled={loading}
                    data-testid="button-email-login"
                  >
                    {loading ? "Signing in..." : "Continue"}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
