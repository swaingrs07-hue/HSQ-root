import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { ParticleBackground } from "@/components/particle-background";

const TubesCursorBackground = lazy(() => import("@/components/tubes-cursor-background"));

function TubesLayer({ enabled, onFailure }: { enabled: boolean; onFailure?: () => void }) {
  if (!enabled) return null;
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      data-testid="tubes-fullpage-layer"
      style={{
        transform: "translateZ(0)",
        willChange: "transform",
        contain: "strict",
        isolation: "isolate",
      }}
    >
      <Suspense fallback={null}>
        <TubesCursorBackground enabled={enabled} onFailure={onFailure} />
      </Suspense>
    </div>
  );
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  User, Phone, Mail, Calendar, GraduationCap, Building2,
  Heart, Camera, CheckCircle2, Shield, ArrowRight, Users,
  BookOpen, Utensils, FileText
} from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 40, filter: "blur(8px)" },
  whileInView: { opacity: 1, y: 0, filter: "blur(0px)" },
  viewport: { once: true, margin: "-50px" },
  transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
};

interface Property {
  id: string;
  name: string;
  displayName: string | null;
  location: string;
}

export default function Apply() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [tubesActive, setTubesActive] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData === true;
    if (!reduceMotion && !saveData) setTubesActive(true);
  }, []);
  const handleTubesFailure = useCallback(() => setTubesActive(false), []);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    gender: "",
    dob: "",
    dietaryPreference: "",
    instituteName: "",
    courseName: "",
    moveInDate: "",
    checkOutDate: "",
    parentName: "",
    parentRelation: "",
    parentPhone: "",
    parentEmail: "",
    photoPath: "",
    propertyId: "",
    propertyName: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/registration-requests/properties")
      .then(r => r.json())
      .then(setProperties)
      .catch(() => {});
  }, []);

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePropertyChange = (propertyId: string) => {
    const prop = properties.find(p => p.id === propertyId);
    setForm(prev => ({
      ...prev,
      propertyId,
      propertyName: prop ? (prop.displayName || prop.name) : "",
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Photo must be under 5MB", variant: "destructive" });
      return;
    }
    setUploadingPhoto(true);
    try {
      const res = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!res.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await res.json();
      const uploadRes = await fetch(uploadURL, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!uploadRes.ok) throw new Error("Upload failed");
      updateField("photoPath", objectPath);
      setPhotoPreview(URL.createObjectURL(file));
      toast({ title: "Photo uploaded" });
    } catch {
      toast({ title: "Failed to upload photo", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: string[] = [];
    if (!form.fullName) missing.push("Full Name");
    if (!form.phone) missing.push("Phone Number");
    if (!form.email) missing.push("Email");
    if (!form.gender) missing.push("Gender");
    if (!form.dob) missing.push("Date of Birth");
    if (!form.dietaryPreference) missing.push("Dietary Preference");
    if (!form.instituteName) missing.push("Institute / Company Name");
    if (!form.courseName) missing.push("Course / Job Title");
    if (!form.moveInDate) missing.push("Move-in Date");
    if (!form.checkOutDate) missing.push("Check-out Date");
    if (!form.parentName) missing.push("Parent / Guardian Name");
    if (!form.parentRelation) missing.push("Relation");
    if (!form.parentPhone) missing.push("Parent Phone");
    if (!form.parentEmail) missing.push("Parent Email");
    if (!form.propertyId) missing.push("Preferred Property");
    if (!form.photoPath) missing.push("Resident Photo");
    if (missing.length > 0) {
      toast({ title: `Please fill: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}`, variant: "destructive" });
      return;
    }
    if (!form.email.includes("@")) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }
    if (form.parentEmail && !form.parentEmail.includes("@")) {
      toast({ title: "Please enter a valid parent email", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/registration-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast({ title: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#050505] relative overflow-hidden flex items-center justify-center">
        <TubesLayer enabled={tubesActive} onFailure={handleTubesFailure} />
        <ParticleBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center max-w-lg mx-auto px-6"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3" data-testid="text-success-title">
            Registration Submitted!
          </h1>
          <p className="text-white/60 text-lg mb-8">
            Thank you, <span className="text-white font-medium">{form.fullName}</span>. Your details have been received. Our team will review your application and contact you shortly.
          </p>
          <div className="bg-[#0a0a0a]/85 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-6 text-left space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-violet-400" />
              <span className="text-white/60 text-sm">Need help?</span>
              <a href="tel:+919820571030" className="text-white text-sm font-medium">+91 98205 71030</a>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-violet-400" />
              <span className="text-white/60 text-sm">Email</span>
              <a href="mailto:support@hsquareliving.com" className="text-white text-sm font-medium">support@hsquareliving.com</a>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] relative overflow-hidden">
      <TubesLayer enabled={tubesActive} onFailure={handleTubesFailure} />
      <ParticleBackground />

      <div className="relative z-10 pt-28 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div {...fadeUp} className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
              <FileText className="w-4 h-4 text-violet-400" />
              <span className="text-violet-300 text-sm font-medium">Pre-Registration Form</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3" data-testid="text-page-title">
              Register for <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Accommodation</span>
            </h1>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              Fill in your details below. Our team will review and get back to you with the next steps.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <motion.div {...fadeUp} className="bg-[#0a0a0a]/85 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg">Personal Information</h2>
                  <p className="text-white/40 text-sm">Basic details about the resident</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Full Name <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-fullName"
                    placeholder="Enter full name"
                    value={form.fullName}
                    onChange={e => updateField("fullName", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Phone Number <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-phone"
                    placeholder="+91 XXXXX XXXXX"
                    value={form.phone}
                    onChange={e => updateField("phone", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Email ID <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-email"
                    type="email"
                    placeholder="email@example.com"
                    value={form.email}
                    onChange={e => updateField("email", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Gender <span className="text-red-400">*</span></label>
                  <Select value={form.gender} onValueChange={v => updateField("gender", v)}>
                    <SelectTrigger data-testid="select-gender" className="bg-black/40 border-white/[0.15] text-white h-12">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Date of Birth <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-dob"
                    type="date"
                    value={form.dob}
                    onChange={e => updateField("dob", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Dietary Preference <span className="text-red-400">*</span></label>
                  <Select value={form.dietaryPreference} onValueChange={v => updateField("dietaryPreference", v)}>
                    <SelectTrigger data-testid="select-dietary" className="bg-black/40 border-white/[0.15] text-white h-12">
                      <SelectValue placeholder="Select preference" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="veg">Vegetarian</SelectItem>
                      <SelectItem value="non-veg">Non-Vegetarian</SelectItem>
                      <SelectItem value="jain">Jain</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6">
                <label className="text-white/70 text-sm font-medium mb-2 block">Resident Photo <span className="text-red-400">*</span></label>
                <div className="flex items-center gap-4">
                  {photoPreview ? (
                    <div className="w-20 h-20 rounded-xl overflow-hidden border border-white/[0.1]">
                      <img src={photoPreview} alt="Photo" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-center justify-center">
                      <Camera className="w-6 h-6 text-white/20" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <div className="px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm font-medium hover:bg-violet-500/20 transition-colors">
                      {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                      disabled={uploadingPhoto}
                    />
                  </label>
                  <span className="text-white/30 text-xs">JPG, PNG under 5MB</span>
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp} className="bg-[#0a0a0a]/85 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg">Academic / Professional Details</h2>
                  <p className="text-white/40 text-sm">College or workplace information</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Institute / Company Name <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-institute"
                    placeholder="e.g. NMIMS, Mithibai College"
                    value={form.instituteName}
                    onChange={e => updateField("instituteName", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Course / Job Title <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-course"
                    placeholder="e.g. B.Tech, MBA"
                    value={form.courseName}
                    onChange={e => updateField("courseName", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Move-in Date <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-moveIn"
                    type="date"
                    value={form.moveInDate}
                    onChange={e => updateField("moveInDate", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Check-out Date <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-checkOut"
                    type="date"
                    value={form.checkOutDate}
                    onChange={e => updateField("checkOutDate", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white h-12"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp} className="bg-[#0a0a0a]/85 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg">Parent / Guardian Details</h2>
                  <p className="text-white/40 text-sm">Emergency contact information</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Parent / Guardian Name <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-parentName"
                    placeholder="Full name"
                    value={form.parentName}
                    onChange={e => updateField("parentName", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Relation <span className="text-red-400">*</span></label>
                  <Select value={form.parentRelation} onValueChange={v => updateField("parentRelation", v)}>
                    <SelectTrigger data-testid="select-parentRelation" className="bg-black/40 border-white/[0.15] text-white h-12">
                      <SelectValue placeholder="Select relation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="guardian">Guardian</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Parent Phone Number <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-parentPhone"
                    placeholder="+91 XXXXX XXXXX"
                    value={form.parentPhone}
                    onChange={e => updateField("parentPhone", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 h-12"
                  />
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Parent Email <span className="text-red-400">*</span></label>
                  <Input
                    data-testid="input-parentEmail"
                    type="email"
                    placeholder="parent@email.com"
                    value={form.parentEmail}
                    onChange={e => updateField("parentEmail", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 h-12"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp} className="bg-[#0a0a0a]/85 backdrop-blur-xl border border-white/[0.12] rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-white font-semibold text-lg">Property Preference</h2>
                  <p className="text-white/40 text-sm">Choose your preferred location</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Preferred Property <span className="text-red-400">*</span></label>
                  <Select value={form.propertyId} onValueChange={handlePropertyChange}>
                    <SelectTrigger data-testid="select-property" className="bg-black/40 border-white/[0.15] text-white h-12">
                      <SelectValue placeholder="Select a property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.displayName || p.name} — {p.location}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-white/70 text-sm font-medium mb-2 block">Additional Notes / Requirements</label>
                  <Textarea
                    data-testid="input-notes"
                    placeholder="Any special requirements, questions, or preferences..."
                    value={form.notes}
                    onChange={e => updateField("notes", e.target.value)}
                    className="bg-black/40 border-white/[0.15] text-white placeholder:text-white/30 focus:border-violet-500/50 min-h-[100px]"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div {...fadeUp} className="flex flex-col items-center gap-4 pt-2">
              <Button
                type="submit"
                disabled={submitting}
                data-testid="button-submit"
                className="w-full md:w-auto px-10 py-6 text-base font-semibold rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 transition-all"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Submit Registration <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
              <p className="text-white/30 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Your information is secure and will only be used for accommodation purposes
              </p>
            </motion.div>
          </form>
        </div>
      </div>
    </div>
  );
}