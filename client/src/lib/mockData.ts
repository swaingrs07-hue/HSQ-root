import propertyExterior from "@/assets/property-exterior.png";
import roomSingle from "@/assets/room-single.png";
import roomShared from "@/assets/room-shared.png";

export interface RoomType {
  id: string;
  name: "Single" | "Shared";
  basePrice: number;
  available: number;
  image: string;
}

export interface Property {
  id: string;
  name: string;
  location: string;
  amenities: string[];
  image: string;
  roomTypes: RoomType[];
}

export const PROPERTIES: Property[] = [
  {
    id: "prop-1",
    name: "Hsquare Heights",
    location: "Koramangala, Bangalore",
    amenities: ["WiFi", "AC", "Gym", "Meals", "Laundry"],
    image: propertyExterior,
    roomTypes: [
      {
        id: "rt-1-s",
        name: "Single",
        basePrice: 180000, // Total year fee example
        available: 5,
        image: roomSingle,
      },
      {
        id: "rt-1-d",
        name: "Shared",
        basePrice: 120000,
        available: 12,
        image: roomShared,
      },
    ],
  },
  {
    id: "prop-2",
    name: "Hsquare Residency",
    location: "Indiranagar, Bangalore",
    amenities: ["WiFi", "AC", "Library", "Meals"],
    image: propertyExterior,
    roomTypes: [
      {
        id: "rt-2-s",
        name: "Single",
        basePrice: 200000,
        available: 2,
        image: roomSingle,
      },
      {
        id: "rt-2-d",
        name: "Shared",
        basePrice: 140000,
        available: 8,
        image: roomShared,
      },
    ],
  },
];

export const PAYMENT_PLANS = [
  {
    id: "plan-1",
    name: "Full Settlement",
    description: "Pay everything upfront and get a discount.",
    discount: 5000, // Example flat discount
    installments: [
      { name: "Booking Amount", percentage: 0, fixed: 100000, due: "Immediate" },
      { name: "Remaining Balance", percentage: 100, fixed: 0, due: "Before Move-in" },
    ],
  },
  {
    id: "plan-2",
    name: "Two Installments",
    description: "Pay 50% at move-in and 50% in October.",
    discount: 0,
    installments: [
      { name: "Booking Amount", percentage: 0, fixed: 100000, due: "Immediate" },
      { name: "1st Installment", percentage: 50, fixed: 0, due: "Move-in Date" },
      { name: "2nd Installment", percentage: 50, fixed: 0, due: "October 1st" },
    ],
  },
  {
    id: "plan-3",
    name: "Three Installments",
    description: "Pay in 3 parts: Move-in, Oct, Dec.",
    discount: 0,
    installments: [
      { name: "Booking Amount", percentage: 0, fixed: 100000, due: "Immediate" },
      { name: "1st Installment", percentage: 33.3, fixed: 0, due: "Move-in Date" },
      { name: "2nd Installment", percentage: 33.3, fixed: 0, due: "October 1st" },
      { name: "3rd Installment", percentage: 33.4, fixed: 0, due: "December 1st" }, // Adjust rounding
    ],
  },
];
