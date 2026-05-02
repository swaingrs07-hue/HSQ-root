import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Bell, Mail, Shield, Database, Palette, Save, Globe, Hotel, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth-context";
import { useFeatureFlags, useSetFeatureFlag } from "@/hooks/use-feature-flags";

export default function AdminSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const { flags, isLoading: flagsLoading } = useFeatureFlags();
  const setFlagMutation = useSetFeatureFlag();
  const hotelsPublic = !!flags.hotels_public;

  const handleHotelsToggle = async (enabled: boolean) => {
    try {
      await setFlagMutation.mutateAsync({ key: "hotels_public", enabled });
      toast({
        title: enabled ? "Hotels are now LIVE" : "Hotels hidden from public",
        description: enabled
          ? "Public visitors can now access /hotels and see the Switch to Hotels link."
          : "Only admins and hotel staff can preview /hotels. The public switcher is hidden.",
      });
    } catch (e: any) {
      toast({
        title: "Failed to update",
        description: e?.message || "Could not save the setting. Please try again.",
        variant: "destructive",
      });
    }
  };
  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    leadAssignment: true,
    paymentAlerts: true,
    bookingConfirmations: true,
    dailyDigest: false,
  });

  const [company, setCompany] = useState({
    name: "Hsquareliving Pvt Ltd",
    email: "info@hsquareliving.com",
    phone: "+91 98765 43210",
    address: "Mumbai, Maharashtra, India",
  });

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: "Your settings have been updated successfully.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your application settings</p>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[500px]">
          <TabsTrigger value="general" data-testid="tab-general">General</TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security" data-testid="tab-security">Security</TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          {isSuperadmin && (
            <Card data-testid="card-hotels-visibility">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hotel className="w-5 h-5" />
                  Hotels Module
                </CardTitle>
                <CardDescription>
                  Control whether the luxury Hotels portal (/hotels) is visible to the public.
                  Admins and hotel staff always have preview access regardless of this setting.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="flex items-center justify-between p-4 rounded-lg border"
                  style={{
                    background: hotelsPublic ? "rgb(254 252 232)" : "rgb(248 250 252)",
                    borderColor: hotelsPublic ? "rgb(234 179 8 / 0.3)" : "rgb(226 232 240)",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: hotelsPublic ? "rgb(254 240 138)" : "rgb(226 232 240)",
                      }}
                    >
                      {hotelsPublic ? (
                        <Eye className="w-5 h-5" style={{ color: "rgb(161 98 7)" }} />
                      ) : (
                        <EyeOff className="w-5 h-5" style={{ color: "rgb(71 85 105)" }} />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">
                        {hotelsPublic ? "Hotels are LIVE for the public" : "Hotels are hidden from the public"}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {hotelsPublic
                          ? "Anyone can visit /hotels and the gold \"Switch to Hotels\" pill is shown to all visitors."
                          : "Public visitors see a \"Coming Soon\" page on /hotels. The switcher pill is hidden from non-staff."}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={hotelsPublic}
                    disabled={flagsLoading || setFlagMutation.isPending}
                    onCheckedChange={handleHotelsToggle}
                    data-testid="switch-hotels-public"
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Tip: Use this to soft-launch the Hotels portal — keep it OFF while
                  you finalize rooms and pricing, then flip ON when ready to announce.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Company Information
              </CardTitle>
              <CardDescription>Manage your company details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Company Name</Label>
                  <Input
                    id="company-name"
                    value={company.name}
                    onChange={(e) => setCompany({ ...company, name: e.target.value })}
                    data-testid="input-company-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-email">Contact Email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={company.email}
                    onChange={(e) => setCompany({ ...company, email: e.target.value })}
                    data-testid="input-company-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-phone">Phone Number</Label>
                  <Input
                    id="company-phone"
                    value={company.phone}
                    onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                    data-testid="input-company-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company-address">Address</Label>
                  <Input
                    id="company-address"
                    value={company.address}
                    onChange={(e) => setCompany({ ...company, address: e.target.value })}
                    data-testid="input-company-address"
                  />
                </div>
              </div>
              <Button onClick={handleSave} className="mt-4" data-testid="button-save-company">
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Appearance
              </CardTitle>
              <CardDescription>Customize the look and feel</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Dark Mode</p>
                  <p className="text-sm text-slate-500">Enable dark theme for the dashboard</p>
                </div>
                <Switch data-testid="switch-dark-mode" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Compact View</p>
                  <p className="text-sm text-slate-500">Use smaller spacing and fonts</p>
                </div>
                <Switch data-testid="switch-compact-view" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Email Alerts</p>
                  <p className="text-sm text-slate-500">Receive important alerts via email</p>
                </div>
                <Switch
                  checked={notifications.emailAlerts}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, emailAlerts: checked })}
                  data-testid="switch-email-alerts"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Lead Assignment</p>
                  <p className="text-sm text-slate-500">Notify when leads are assigned</p>
                </div>
                <Switch
                  checked={notifications.leadAssignment}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, leadAssignment: checked })}
                  data-testid="switch-lead-assignment"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Payment Alerts</p>
                  <p className="text-sm text-slate-500">Get notified about payment updates</p>
                </div>
                <Switch
                  checked={notifications.paymentAlerts}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, paymentAlerts: checked })}
                  data-testid="switch-payment-alerts"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Booking Confirmations</p>
                  <p className="text-sm text-slate-500">Notify on new bookings</p>
                </div>
                <Switch
                  checked={notifications.bookingConfirmations}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, bookingConfirmations: checked })}
                  data-testid="switch-booking-confirmations"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Daily Digest</p>
                  <p className="text-sm text-slate-500">Receive a daily summary email</p>
                </div>
                <Switch
                  checked={notifications.dailyDigest}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, dailyDigest: checked })}
                  data-testid="switch-daily-digest"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage security and access controls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-slate-500">Add an extra layer of security</p>
                </div>
                <Button variant="outline" data-testid="button-enable-2fa">Enable 2FA</Button>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Session Timeout</p>
                  <p className="text-sm text-slate-500">Auto-logout after inactivity</p>
                </div>
                <select className="border rounded-md px-3 py-2 text-sm" data-testid="select-session-timeout">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="120">2 hours</option>
                </select>
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="font-medium">Login History</p>
                  <p className="text-sm text-slate-500">View recent login activity</p>
                </div>
                <Button variant="outline" data-testid="button-view-login-history">View History</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                System Information
              </CardTitle>
              <CardDescription>View system details and manage data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Application Version</p>
                  <p className="font-medium">v1.0.0</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Database Status</p>
                  <p className="font-medium text-emerald-600">Connected</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Total Properties</p>
                  <p className="font-medium">15</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500">Total Users</p>
                  <p className="font-medium">128</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Integrations
              </CardTitle>
              <CardDescription>Manage external service connections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Email Service</p>
                    <p className="text-sm text-slate-500">Send transactional emails</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" data-testid="button-configure-email">Configure</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">Razorpay</p>
                    <p className="text-sm text-slate-500">Payment gateway integration</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" data-testid="button-configure-razorpay">Configure</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
