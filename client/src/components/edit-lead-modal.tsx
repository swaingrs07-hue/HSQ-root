import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import {
  User,
  Phone,
  Mail,
  Building2,
  IndianRupee,
  Calendar as CalendarIcon,
  Clock,
  Save,
  Loader2,
  Bell,
  CheckCircle2,
  AlertCircle,
  X,
  MessageSquare,
  UserCheck,
  Zap,
  ShieldCheck,
  CalendarPlus,
  Download,
  UserX,
} from "lucide-react";
import { format, addHours, addDays, setHours, setMinutes } from "date-fns";
import { buildGoogleCalendarUrl, downloadICS } from "@/lib/calendar-utils";
import type { Lead } from "@shared/schema";

interface EditLeadModalProps {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onSave?: (lead: Lead) => void;
}

const FOLLOW_UP_PRESETS = [
  { label: "In 1 hour", hours: 1 },
  { label: "In 3 hours", hours: 3 },
  { label: "Tomorrow 10 AM", tomorrow: true, hour: 10 },
  { label: "Tomorrow 2 PM", tomorrow: true, hour: 14 },
  { label: "In 2 days", days: 2 },
  { label: "In 1 week", days: 7 },
];

export function EditLeadModal({ lead, open, onClose, onSave }: EditLeadModalProps) {
  const { token, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
    budgetMin: "",
    budgetMax: "",
    followUpAt: null as Date | null,
    followUpStatus: "" as string,
    followUpNotes: "",
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("10:00");

  useEffect(() => {
    if (lead) {
      setFormData({
        name: lead.name || "",
        email: lead.email || "",
        phone: lead.phone || "",
        notes: lead.notes || "",
        budgetMin: lead.budgetMin?.toString() || "",
        budgetMax: lead.budgetMax?.toString() || "",
        followUpAt: lead.followUpAt ? new Date(lead.followUpAt) : null,
        followUpStatus: lead.followUpStatus || "",
        followUpNotes: lead.followUpNotes || "",
      });
      if (lead.followUpAt) {
        const date = new Date(lead.followUpAt);
        setSelectedDate(date);
        setSelectedTime(format(date, "HH:mm"));
      } else {
        setSelectedDate(undefined);
        setSelectedTime("10:00");
      }
    }
  }, [lead]);

  const updateLeadMutation = useMutation({
    mutationFn: async (data: Partial<Lead>) => {
      const res = await fetch(`/api/leads/${lead?.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update lead");
      return res.json();
    },
    onSuccess: (updatedLead) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/my-leads"] });
      toast({
        title: "Lead Updated",
        description: "Lead information has been saved successfully.",
      });
      onSave?.(updatedLead);
      onClose();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update lead. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateFollowUpMutation = useMutation({
    mutationFn: async (data: { followUpAt: string | null; followUpStatus: string; followUpNotes: string }) => {
      const res = await fetch(`/api/leads/${lead?.id}/follow-up`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update follow-up");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "Follow-up Updated",
        description: "Follow-up has been scheduled successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update follow-up. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const updates: Partial<Lead> = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      notes: formData.notes || null,
      budgetMin: formData.budgetMin ? parseInt(formData.budgetMin) : null,
      budgetMax: formData.budgetMax ? parseInt(formData.budgetMax) : null,
    };
    updateLeadMutation.mutate(updates);
  };

  const handleFollowUpSave = () => {
    let followUpDateTime: Date | null = null;
    
    if (selectedDate) {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      followUpDateTime = setMinutes(setHours(selectedDate, hours), minutes);
    }

    updateFollowUpMutation.mutate({
      followUpAt: followUpDateTime ? followUpDateTime.toISOString() : null,
      followUpStatus: followUpDateTime ? "pending" : "",
      followUpNotes: formData.followUpNotes,
    });
  };

  const handleMarkCompleted = () => {
    updateFollowUpMutation.mutate({
      followUpAt: formData.followUpAt?.toISOString() || null,
      followUpStatus: "completed",
      followUpNotes: formData.followUpNotes,
    });
  };

  const handlePresetClick = (preset: typeof FOLLOW_UP_PRESETS[0]) => {
    let newDate: Date;
    const now = new Date();

    if (preset.hours) {
      newDate = addHours(now, preset.hours);
    } else if (preset.tomorrow && preset.hour !== undefined) {
      newDate = setHours(setMinutes(addDays(now, 1), 0), preset.hour);
    } else if (preset.days) {
      newDate = setHours(setMinutes(addDays(now, preset.days), 0), 10);
    } else {
      newDate = now;
    }

    setSelectedDate(newDate);
    setSelectedTime(format(newDate, "HH:mm"));
  };

  const clearFollowUp = () => {
    setSelectedDate(undefined);
    setSelectedTime("10:00");
    setFormData((prev) => ({ ...prev, followUpNotes: "" }));
  };

  if (!lead) return null;

  const getStatusBadge = () => {
    if (!formData.followUpStatus || !formData.followUpAt) {
      return <Badge variant="outline" className="bg-slate-50">No Follow-up</Badge>;
    }
    switch (formData.followUpStatus) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "completed":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "overdue":
        return <Badge className="bg-red-100 text-red-700 border-red-200"><AlertCircle className="w-3 h-3 mr-1" />Overdue</Badge>;
      default:
        return null;
    }
  };

  const isLoading = updateLeadMutation.isPending || updateFollowUpMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
              {lead.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">{lead.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                {lead.propertyName && (
                  <span className="flex items-center gap-1 text-sm">
                    <Building2 className="w-3.5 h-3.5" />
                    {lead.propertyName}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Lead Details
            </TabsTrigger>
            <TabsTrigger value="followup" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Follow-up
              {formData.followUpStatus === "overdue" && (
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-6">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-500" />
                  Full Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter lead name"
                  data-testid="input-edit-lead-name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-slate-500" />
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    data-testid="input-edit-lead-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    data-testid="input-edit-lead-email"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budgetMin" className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-slate-500" />
                    Min Budget
                  </Label>
                  <Input
                    id="budgetMin"
                    type="number"
                    value={formData.budgetMin}
                    onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                    placeholder="10000"
                    data-testid="input-edit-lead-budget-min"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetMax" className="flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-slate-500" />
                    Max Budget
                  </Label>
                  <Input
                    id="budgetMax"
                    type="number"
                    value={formData.budgetMax}
                    onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                    placeholder="25000"
                    data-testid="input-edit-lead-budget-max"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add notes about this lead..."
                  rows={3}
                  data-testid="input-edit-lead-notes"
                />
              </div>

              {/* Assignment Info Section */}
              <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50/50 rounded-xl border space-y-3">
                <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  Assignment Info
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Assigned To</p>
                    <p className="font-medium">
                      {lead?.assignedToId ? (lead as any)?.assignedToName || "Sales Executive" : "Unassigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Assignment Type</p>
                    <div className="mt-0.5">
                      {lead?.assignmentType === "property_auto" && (
                        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                          <Zap className="w-3 h-3 mr-1" />
                          Auto (Property)
                        </Badge>
                      )}
                      {lead?.assignmentType === "admin_manual" && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Manual (Admin)
                        </Badge>
                      )}
                      {lead?.assignmentType === "unassigned" && (
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                          <UserX className="w-3 h-3 mr-1" />
                          Unassigned
                        </Badge>
                      )}
                      {!lead?.assignmentType && lead?.assignedToId && (
                        <Badge variant="outline">Legacy Assignment</Badge>
                      )}
                      {!lead?.assignmentType && !lead?.assignedToId && (
                        <Badge variant="secondary">Not Assigned</Badge>
                      )}
                    </div>
                  </div>
                  {lead?.assignedAt && (
                    <div className="col-span-2">
                      <p className="text-slate-500">Assigned On</p>
                      <p className="font-medium">{format(new Date(lead.assignedAt), "MMM d, yyyy 'at' h:mm a")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading || !formData.name.trim()}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                {updateLeadMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="followup" className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-indigo-50/50 rounded-xl border">
              <div>
                <p className="text-sm font-medium text-slate-700">Current Status</p>
                <div className="mt-1">{getStatusBadge()}</div>
              </div>
              {formData.followUpAt && (
                <div className="text-right space-y-1">
                  <p className="text-xs text-slate-500">Scheduled for</p>
                  <p className="text-sm font-medium text-slate-700">
                    {format(new Date(formData.followUpAt), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  <div className="flex items-center gap-1.5 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="button-google-calendar-edit-modal"
                      className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-50"
                      onClick={() => {
                        const start = new Date(formData.followUpAt!);
                        const end = new Date(start.getTime() + 30 * 60000);
                        const url = buildGoogleCalendarUrl(
                          `Follow-up: ${lead?.name || ''}`,
                          start.toISOString(),
                          end.toISOString(),
                          `Follow-up with ${lead?.name || ''}\nNotes: ${formData.followUpNotes || ''}`
                        );
                        window.open(url, '_blank');
                      }}
                    >
                      <CalendarPlus className="w-3 h-3 mr-1" />
                      Google
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="button-ics-edit-modal"
                      className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-50"
                      onClick={() => lead && downloadICS('follow_up', lead.id)}
                    >
                      <Download className="w-3 h-3 mr-1" />
                      .ics
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-slate-500" />
                Schedule Next Follow-up
              </Label>
              
              <div className="flex flex-wrap gap-2">
                {FOLLOW_UP_PRESETS.map((preset, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePresetClick(preset)}
                    className="text-xs hover:bg-indigo-50 hover:border-indigo-300"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        initialFocus
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Time</Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger>
                      <Clock className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, "0");
                        return [
                          <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                            {format(setHours(new Date(), i), "h:00 a")}
                          </SelectItem>,
                          <SelectItem key={`${hour}:30`} value={`${hour}:30`}>
                            {format(setMinutes(setHours(new Date(), i), 30), "h:30 a")}
                          </SelectItem>,
                        ];
                      }).flat()}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="followUpNotes" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-slate-500" />
                  Follow-up Notes
                </Label>
                <Textarea
                  id="followUpNotes"
                  value={formData.followUpNotes}
                  onChange={(e) => setFormData({ ...formData, followUpNotes: e.target.value })}
                  placeholder="Add notes for this follow-up..."
                  rows={2}
                  data-testid="input-followup-notes"
                />
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-4 border-t">
              <div className="flex gap-2">
                {selectedDate && (
                  <Button variant="ghost" size="sm" onClick={clearFollowUp}>
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
                {formData.followUpStatus === "pending" && formData.followUpAt && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkCompleted}
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Mark Completed
                  </Button>
                )}
              </div>
              <Button
                onClick={handleFollowUpSave}
                disabled={updateFollowUpMutation.isPending}
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
              >
                {updateFollowUpMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Bell className="w-4 h-4 mr-2" />
                )}
                {selectedDate ? "Schedule Follow-up" : "Save Notes"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
