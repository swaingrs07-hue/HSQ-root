import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useLocation } from "wouter";
import heroImage from "@/assets/hero-student-living.png";
import { ArrowRight, Wifi, Shield, Coffee, Users, Play } from "lucide-react";
import { motion } from "framer-motion";
import { PropertyTourModal } from "@/components/property-tour-modal";
import { SmartSearch } from "@/components/smart-search";

export default function Home() {
  const [tourModalOpen, setTourModalOpen] = useState(false);
  const [, setLocation] = useLocation();

  const handleSearchResults = (results: any) => {
    if (results.totalResults > 0 || results.interpretation) {
      sessionStorage.setItem("searchResults", JSON.stringify(results));
      setLocation("/properties");
    }
  };

  return (
    <div className="flex flex-col gap-16 pb-20">
      {/* Hero Section */}
      <section className="relative w-full h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/40 z-10" />
        <img 
          src={heroImage} 
          alt="Student Living" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        <div className="container mx-auto px-4 relative z-20 pt-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl text-white space-y-6"
          >
            <h1 className="text-5xl md:text-7xl font-heading font-extrabold leading-tight tracking-tight">
              More Than Just <br/>
              <span className="text-accent">A Room.</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-light max-w-lg">
              Experience premium student living with world-class amenities, vibrant community, and strict safety standards.
            </p>
            <div className="mt-6 max-w-xl">
              <SmartSearch 
                onSearchResults={handleSearchResults}
                placeholder="Search with AI... 'rooms under 15000 near Juhu'"
                className="[&_input]:bg-white/95 [&_input]:text-gray-900 [&_input]:placeholder-gray-500"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link href="/properties">
                <Button size="lg" className="bg-accent hover:bg-accent/90 text-white border-none text-lg px-8 h-14 rounded-full font-bold shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
                  Find Your Room
                </Button>
              </Link>
              <Button 
                  size="lg" 
                  variant="outline" 
                  className="bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20 text-lg px-8 h-14 rounded-full font-semibold group"
                  onClick={() => setTourModalOpen(true)}
                  data-testid="button-take-tour"
                >
                  <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                  Take a Tour
                </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl font-heading font-bold text-primary">Why Choose Hsquare?</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We provide an ecosystem designed for students to thrive, study, and connect.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { icon: Wifi, title: "High-Speed WiFi", desc: "Seamless connectivity for your studies and entertainment." },
            { icon: Shield, title: "24/7 Security", desc: "Biometric access, CCTV surveillance, and secure premises." },
            { icon: Coffee, title: "Healthy Meals", desc: "Nutritious, home-style food served daily." },
            { icon: Users, title: "Community", desc: "Events, workshops, and spaces to connect with peers." },
          ].map((feature, i) => (
            <Card key={i} className="border-none shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 bg-card">
              <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
                  <feature.icon className="w-8 h-8" />
                </div>
                <h3 className="font-heading font-bold text-xl">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4">
        <div className="bg-primary rounded-3xl p-12 md:p-24 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 space-y-8 max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-heading font-bold">Ready to Move In?</h2>
            <p className="text-xl text-primary-foreground/80">
              Booking takes less than 5 minutes. Secure your spot today before they run out.
            </p>
            <Link href="/properties">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 text-lg px-10 h-16 rounded-full font-bold shadow-lg hover:scale-105 transition-all">
                Book Your Stay <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <PropertyTourModal 
        isOpen={tourModalOpen} 
        onClose={() => setTourModalOpen(false)} 
      />
    </div>
  );
}
