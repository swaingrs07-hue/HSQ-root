import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Building2, FileText, CreditCard, User } from "lucide-react";

export default function UserDashboard() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-bold text-foreground">
          Welcome, {user?.name || "User"}!
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your bookings and explore properties
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-lg">Browse Properties</CardTitle>
            <CardDescription>Explore our premium student accommodations</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/properties">
              <Button className="w-full" data-testid="button-browse-properties">
                View Properties
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-2">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-lg">My Bookings</CardTitle>
            <CardDescription>View and manage your room bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/my-bookings">
              <Button variant="outline" className="w-full" data-testid="button-my-bookings">
                View Bookings
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-lg">Payments</CardTitle>
            <CardDescription>Track your payment history and dues</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/my-bookings">
              <Button variant="outline" className="w-full" data-testid="button-payments">
                View Payments
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
              <User className="w-6 h-6 text-purple-600" />
            </div>
            <CardTitle className="text-lg">My Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/student/register">
              <Button variant="outline" className="w-full" data-testid="button-profile">
                Complete Profile
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <Link href="/student/register" className="flex-1">
              <Button size="lg" className="w-full" data-testid="button-register">
                Complete Registration
              </Button>
            </Link>
            <Link href="/properties" className="flex-1">
              <Button size="lg" variant="outline" className="w-full" data-testid="button-book-room">
                Book a Room
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
