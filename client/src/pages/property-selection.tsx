import { PROPERTIES } from "@/lib/mockData";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Wifi, Bed, Users } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { motion } from "framer-motion";

export default function PropertySelection() {
  const [, setLocation] = useLocation();
  const [selectedProp, setSelectedProp] = useState<string | null>(null);

  const handleSelectRoom = (propId: string, roomId: string, price: number, roomName: string, propName: string) => {
    // Store selection
    localStorage.setItem("selected_room", JSON.stringify({ propId, roomId, price, roomName, propName }));
    setLocation("/payment-plans");
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-heading font-bold text-primary mb-4">Select Your New Home</h1>
        <p className="text-muted-foreground text-lg">Browse our premium properties and choose the room that fits your style.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {PROPERTIES.map((prop, index) => (
          <motion.div
            key={prop.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="overflow-hidden border-none shadow-xl h-full flex flex-col group">
              <div className="relative h-64 overflow-hidden">
                <img 
                  src={prop.image} 
                  alt={prop.name} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 text-primary shadow-sm">
                  <MapPin className="w-4 h-4" /> {prop.location}
                </div>
              </div>

              <CardHeader>
                <CardTitle className="text-2xl font-bold flex justify-between items-center">
                  {prop.name}
                </CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  {prop.amenities.map((am) => (
                    <Badge key={am} variant="secondary" className="bg-muted text-muted-foreground font-normal">
                      {am}
                    </Badge>
                  ))}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 flex-1">
                <h4 className="font-semibold text-lg text-primary">Available Room Types:</h4>
                <div className="grid gap-4">
                  {prop.roomTypes.map((room) => (
                    <div 
                      key={room.id} 
                      className="border rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer bg-white"
                      onClick={() => handleSelectRoom(prop.id, room.id, room.basePrice, room.name, prop.name)}
                    >
                      <img src={room.image} alt={room.name} className="w-20 h-20 rounded-lg object-cover" />
                      <div className="flex-1 text-center sm:text-left">
                        <div className="font-bold text-lg flex items-center justify-center sm:justify-start gap-2">
                          {room.name === "Single" ? <Bed className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                          {room.name} Occupancy
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {room.available} beds left
                        </div>
                      </div>
                      <div className="text-right">
                         <div className="text-2xl font-bold text-primary">₹{(room.basePrice / 100000).toFixed(2)}L</div>
                         <div className="text-xs text-muted-foreground">/ academic year</div>
                      </div>
                      <Button size="sm" className="w-full sm:w-auto">Select</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
