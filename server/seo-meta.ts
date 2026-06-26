import { db } from "./db";
import * as schema from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import { buildPropertyHeroFallback } from "./hero-slides";

const SITE_URL = process.env.APP_PUBLIC_URL || "https://hsquare.in";

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogImageAlt?: string;
  breadcrumbs?: { name: string; url: string }[];
  jsonLd?: object[];
}

const FAQ_ITEMS = [
  { q: "What types of rooms are available?", a: "We offer single occupancy, twin sharing, triple sharing, and quad sharing rooms. All rooms are fully furnished with beds, wardrobes, study desks, and attached/shared bathrooms." },
  { q: "Are meals included in the rent?", a: "Yes, most housing plans include 3 freshly prepared meals daily along with evening snacks. Veg and non-veg options available." },
  { q: "What amenities are included?", a: "All properties include free high-speed WiFi, 24/7 security with CCTV, daily housekeeping, laundry service, study lounges, common areas, and fully furnished rooms." },
  { q: "What are the payment options?", a: "We accept payments via UPI, credit/debit cards, net banking, and bank transfers through Razorpay. Monthly, quarterly, or semester-wise instalment plans available." },
  { q: "Is there a security deposit?", a: "Yes, a refundable security deposit is required at booking. It is fully refundable upon checkout, subject to room condition." },
  { q: "How do I book a room?", a: "Browse properties on our website, select your preferred room and plan, complete registration with ID documents, sign the digital agreement, and make payment online." },
  { q: "What documents are required for booking?", a: "Valid government ID (Aadhaar/PAN/Passport), recent passport-sized photographs, college admission letter or ID card, and parent/guardian contact details." },
  { q: "What security measures are in place?", a: "All properties feature 24/7 CCTV surveillance, biometric/card access entry, security guards, visitor management systems, and emergency protocols." },
  { q: "Can I visit the property before booking?", a: "Absolutely! We encourage in-person visits. You can also take a virtual property tour on our website to explore rooms and facilities." },
  { q: "Is there WiFi available?", a: "Yes, high-speed WiFi is available 24/7 throughout all hostel premises including study areas and common rooms." },
  { q: "Can I pay in instalments?", a: "Yes, we offer flexible instalment plans. You can choose monthly, quarterly, or semester-wise payment options based on your housing plan." },
  { q: "What is the cancellation and refund policy?", a: "Cancellations 30+ days before check-in receive a full refund minus processing fees. Within 30 days, partial refunds may apply per your booking agreement." },
  { q: "Is there a minimum stay duration?", a: "Typical bookings run for an academic year (approximately 11 months). Shorter stays may be accommodated depending on availability." },
  { q: "How far are Hsquare hostels from NMIMS?", a: "Our Juhu/Vile Parle property is just 5 minutes walking distance from NMIMS University campus." },
  { q: "Do you have separate hostels for boys and girls?", a: "Yes, we offer both boys and girls hostels with separate floors/buildings and additional security measures for female students." },
];

const COLLEGE_FAQ_MAP: Record<string, { q: string; a: string }[]> = {
  "/hostel-near-nmims": [
    { q: "How far is Hsquare Hostel from NMIMS?", a: "Hsquare Hostel is just 5 minutes walking distance from the NMIMS University campus in Vile Parle West." },
    { q: "Does Hsquare Hostel provide meals?", a: "Yes, we provide 3 freshly prepared meals daily along with evening snacks. Special dietary options are available." },
    { q: "What is the monthly rent for a hostel near NMIMS?", a: "Our plans start from ₹5,25,000 per academic year for triple sharing rooms, which includes meals, WiFi, housekeeping, and all amenities." },
    { q: "Is there WiFi available at Hsquare Hostel?", a: "Yes, high-speed WiFi is available 24/7 throughout the hostel premises including study areas and common rooms." },
    { q: "Is Hsquare Hostel safe for students?", a: "Absolutely. We have 24/7 CCTV surveillance, security guards, biometric access, and strict visitor policies to ensure student safety." },
  ],
  "/hostel-near-mithibai": [
    { q: "How far is Hsquare Hostel from Mithibai College?", a: "Our hostel is just 5 minutes walking distance from the Mithibai College campus in Vile Parle West." },
    { q: "Do you provide food at the hostel?", a: "Yes, we provide 3 freshly cooked meals daily along with evening snacks. Both veg and non-veg options are available." },
    { q: "Can I visit the hostel before booking?", a: "Absolutely! We encourage campus visits. You can book a tour through our website or call us directly." },
    { q: "What amenities are included?", a: "Meals, WiFi, housekeeping, laundry, security, study areas, common rooms, and EV bike access are all included in our plans." },
    { q: "Is there a separate girls hostel?", a: "Yes, we have separate floors and sections dedicated to female students with additional security measures." },
  ],
  "/hostel-near-mukesh-patel": [
    { q: "How close is Hsquare to MPSTME?", a: "Hsquare Hostel is just 5 minutes away from the Mukesh Patel School of Technology campus in Vile Parle." },
    { q: "Are AC rooms available?", a: "Yes, we offer both AC and non-AC room options. AC rooms come with split air conditioning units." },
    { q: "Is gym access included?", a: "Yes, our properties include gym and fitness center access as part of all housing plans." },
    { q: "What sharing options are available?", a: "We offer single, twin, triple, and quad sharing rooms — all fully furnished with study desks, wardrobes, and beds." },
    { q: "How do I book a room near MPSTME?", a: "Visit hsquare.in, browse our properties, select your room and plan, register with your documents, and pay online." },
  ],
  "/hostel-near-nm-college": [
    { q: "How far is Hsquare from NM College?", a: "Our Juhu/Vile Parle hostel is approximately 5 minutes walking distance from NM College of Commerce." },
    { q: "Do you provide meals?", a: "Yes, all plans include 3 meals daily plus evening snacks with veg and non-veg options." },
    { q: "Is laundry included?", a: "Yes, laundry services are included in our plans with a set number of washes per month." },
    { q: "What is the check-in process?", a: "On your check-in date, visit with original ID documents. Staff will verify your booking, provide orientation, and guide you to your room." },
    { q: "Can I pay in instalments?", a: "Yes, we offer monthly, quarterly, and semester-wise payment options through our secure payment gateway." },
  ],
  "/hostel-near-dj-sanghvi": [
    { q: "How far is Hsquare from DJ Sanghvi?", a: "Our Vile Parle property is conveniently located near DJ Sanghvi College, just minutes away by walk." },
    { q: "What amenities are included?", a: "WiFi, meals, gym, housekeeping, laundry, 24/7 security with CCTV, and study lounges are all included." },
    { q: "Is there a gym?", a: "Yes, our properties include a fully equipped gym and fitness center." },
    { q: "Are there study areas?", a: "Yes, dedicated study lounges with comfortable seating and good lighting are available 24/7." },
    { q: "How do I book?", a: "Visit hsquare.in, browse properties, select your room, complete registration, and make payment online." },
  ],
  "/hostel-near-whistling-woods": [
    { q: "How close is Hsquare to Whistling Woods?", a: "Our Goregaon property provides convenient access to Whistling Woods International film school." },
    { q: "Do you have creative spaces?", a: "Yes, our common areas and study lounges can be used as creative workspaces for film and media students." },
    { q: "Are meals included?", a: "Yes, 3 freshly prepared meals daily plus evening snacks are included in all plans." },
    { q: "Is WiFi fast enough for video editing?", a: "Yes, we provide high-speed WiFi throughout the premises, suitable for media work and streaming." },
    { q: "What are the payment options?", a: "UPI, cards, net banking, and bank transfers via Razorpay. Flexible instalment plans available." },
  ],
  "/hostel-in-juhu": [
    { q: "Is there a hostel in Juhu Mumbai?", a: "Yes! Hsquare Hostel is located in Juhu / Vile Parle area, just minutes from Juhu Beach and top colleges like NMIMS, Mithibai, and NM College." },
    { q: "How far is Juhu Beach from Hsquare Hostel?", a: "Juhu Beach is approximately 10 minutes walking distance from our hostel — perfect for evening walks after classes." },
    { q: "What is the rent for a hostel in Juhu?", a: "Our plans start from ₹5,25,000 per academic year for triple sharing rooms, fully inclusive of meals, WiFi, and housekeeping." },
    { q: "Is it safe to stay in Juhu as a student?", a: "Absolutely. Our hostel has 24/7 CCTV, biometric entry, security guards, and a strict visitor policy." },
    { q: "Are there good transport links from Juhu?", a: "Yes, Vile Parle railway station is 8 minutes away and auto-rickshaws/buses are readily available throughout the day." },
  ],
  "/hostel-in-andheri": [
    { q: "Is there a hostel near Andheri station?", a: "Yes, Hsquare has properties conveniently accessible from Andheri West with multiple transport options to Andheri station." },
    { q: "How far is the hostel from Andheri station?", a: "Our properties are well-connected to Andheri railway station and metro via auto-rickshaw or bus routes." },
    { q: "What is the monthly rent for a hostel in Andheri?", a: "Our all-inclusive academic year plans cover accommodation, meals, WiFi, housekeeping, and security. Contact us for the latest pricing." },
    { q: "Are there colleges near Hsquare in Andheri?", a: "Yes, the Andheri area provides access to several colleges and is well-connected to Vile Parle's college hub via public transport." },
    { q: "Do you have AC rooms in Andheri?", a: "Yes, we offer both AC and non-AC room options. AC rooms come with split air conditioning units included in the plan." },
  ],
  "/hostel-in-mumbai": [
    { q: "Which is the best hostel in Mumbai for students?", a: "Hsquare Living is rated among Mumbai's best student hostels with properties in Goregaon, Juhu, Vile Parle, and Andheri. Premium amenities, meals, WiFi, and 24/7 security." },
    { q: "What is the average cost of a student hostel in Mumbai?", a: "At Hsquare, our plans start from ₹5,25,000 per academic year for triple sharing rooms, fully inclusive of all amenities including meals, WiFi, and housekeeping." },
    { q: "Which areas in Mumbai are best for student hostels?", a: "Vile Parle and Juhu are ideal for students at NMIMS, Mithibai, and NM College. Goregaon is great for Whistling Woods and IT professionals. Andheri provides central connectivity." },
    { q: "Do Mumbai hostels provide meals?", a: "Yes, Hsquare hostels provide 3 freshly prepared meals daily — breakfast, lunch, and dinner — along with evening snacks." },
    { q: "Is it safe for female students to stay in Mumbai hostels?", a: "Yes, we have dedicated floors for female students with 24/7 CCTV, biometric access, security personnel, and strict visitor policies." },
  ],
  "/hostel-near-svkms": [
    { q: "How far is Hsquare Hostel from SVKMs NMIMS?", a: "Hsquare Hostel is just 5 minutes walking distance from the SVKMs campus (NMIMS University, Mukesh Patel School of Technology, DJ Sanghvi College) in Vile Parle West, Mumbai." },
    { q: "What does SVKMs stand for?", a: "SVKMs stands for Shri Vile Parle Kelavani Mandal's — the trust that runs NMIMS University, Mukesh Patel School of Technology (MPSTME), and DJ Sanghvi College of Engineering, all on the same Vile Parle West campus." },
    { q: "Which hostel is closest to SVKMs campus in Vile Parle?", a: "Hsquare Hostel is one of the closest PG accommodations to the entire SVKMs campus cluster (NMIMS, MPSTME, DJ Sanghvi) in Vile Parle West — just a 5-minute walk from all three colleges." },
    { q: "Does Hsquare provide meals near SVKMs campus?", a: "Yes, we provide 3 freshly prepared meals daily (breakfast, lunch & dinner) along with evening snacks. Both veg and non-veg options are available." },
    { q: "Is there a girls hostel near SVKMs NMIMS?", a: "Yes, Hsquare has dedicated floors and sections for female students with additional biometric security, 24/7 CCTV, and strict visitor management near the SVKMs campus in Vile Parle." },
  ],
};

// Shared amenity list used by all Vile Parle / Juhu schemas
const VP_AMENITIES = [
  { "@type": "LocationFeatureSpecification", "name": "Free High-Speed WiFi", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "3 Meals Daily (Breakfast, Lunch & Dinner)", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "24/7 Security & CCTV Surveillance", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "Gym & Fitness Center", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "Daily Housekeeping", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "Laundry Service", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "Study Lounge", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "Biometric Access Entry", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "Air Conditioning (select rooms)", "value": true },
  { "@type": "LocationFeatureSpecification", "name": "Fully Furnished Rooms", "value": true },
];

// Shared reviews for Vile Parle / Juhu area
const VP_REVIEWS = [
  {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Aryan Mehta" },
    "datePublished": "2025-02-10",
    "description": "Best hostel near NMIMS! Clean rooms, great food, and the staff is super helpful. Just 5 minutes walk from campus — made my daily commute so easy.",
    "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
  },
  {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Priya Sharma" },
    "datePublished": "2025-01-18",
    "description": "Excellent PG for NMIMS students. The food quality is consistently good, WiFi is fast, and the security makes parents feel at ease. Highly recommend Hsquare.",
    "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
  },
  {
    "@type": "Review",
    "author": { "@type": "Person", "name": "Rohan Kapoor" },
    "datePublished": "2024-12-05",
    "description": "Stayed here during my MBA at SVKMs NMIMS. The facilities are top notch — AC rooms, gym, study room. Worth every rupee for the convenience and comfort.",
    "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
  },
];

// Direct booking action used in all schemas
const RESERVE_ACTION = {
  "@type": "ReserveAction",
  "target": {
    "@type": "EntryPoint",
    "urlTemplate": `${SITE_URL}/properties`,
    "actionPlatform": [
      "http://schema.org/DesktopWebPlatform",
      "http://schema.org/MobileWebPlatform",
    ],
  },
  "result": { "@type": "LodgingReservation", "name": "Student Hostel Booking" },
};

const COLLEGE_HOSTEL_LD: Record<string, object> = {
  "/hostel-near-nmims": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Near NMIMS (SVKMs) Vile Parle",
    "alternateName": ["Hsquare Living Near NMIMS", "Best PG near SVKMs NMIMS Mumbai", "Hostel near SVKMs NMIMS"],
    "description": "Best hostel near NMIMS (SVKMs) Mumbai. Hsquare Living offers fully furnished PG accommodation just 5 minutes walking distance from NMIMS University, Vile Parle West. Meals, WiFi, gym, AC rooms & 24/7 security included.",
    "url": `${SITE_URL}/hostel-near-nmims`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Vile Parle West",
      "addressLocality": "Mumbai",
      "addressRegion": "Maharashtra",
      "addressCountry": "IN",
      "postalCode": "400049",
    },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1075", "longitude": "72.8263" },
    "hasMap": "https://maps.app.goo.gl/hsquare-vile-parle",
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": {
      "@type": "ImageObject",
      "url": `${SITE_URL}/opengraph.jpg`,
      "width": 1200,
      "height": 630,
      "caption": "Hsquare Hostel near NMIMS Vile Parle Mumbai",
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.7",
      "reviewCount": "143",
      "bestRating": "5",
      "worstRating": "1",
    },
    "review": VP_REVIEWS,
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "CollegeOrUniversity", "name": "NMIMS University (Narsee Monjee Institute of Management Studies)", "address": "Vile Parle West, Mumbai, Maharashtra 400056" },
      { "@type": "CollegeOrUniversity", "name": "SVKMs NMIMS Mumbai" },
      { "@type": "Place", "name": "Vile Parle West, Mumbai" },
    ],
    "amenityFeature": VP_AMENITIES,
    "sameAs": [
      "https://www.instagram.com/hsquareliving",
      "https://www.facebook.com/hsquareliving",
    ],
  },
  "/hostel-near-svkms": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Near SVKMs NMIMS Mumbai",
    "alternateName": ["Hsquare Living near SVKMs", "Best PG near SVKMs Mumbai", "Hostel near SVKM Vile Parle"],
    "description": "Best hostel near SVKMs NMIMS Mumbai. Hsquare Living is just 5 minutes walking distance from SVKMs campus (NMIMS University, Mukesh Patel, DJ Sanghvi) in Vile Parle West. Fully furnished PG with meals, WiFi, gym & 24/7 security.",
    "url": `${SITE_URL}/hostel-near-svkms`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Vile Parle West",
      "addressLocality": "Mumbai",
      "addressRegion": "Maharashtra",
      "addressCountry": "IN",
      "postalCode": "400049",
    },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1075", "longitude": "72.8263" },
    "hasMap": "https://maps.app.goo.gl/hsquare-vile-parle",
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": {
      "@type": "ImageObject",
      "url": `${SITE_URL}/opengraph.jpg`,
      "width": 1200,
      "height": 630,
      "caption": "Hsquare Hostel near SVKMs NMIMS Vile Parle Mumbai",
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.7",
      "reviewCount": "143",
      "bestRating": "5",
      "worstRating": "1",
    },
    "review": VP_REVIEWS,
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "CollegeOrUniversity", "name": "SVKMs NMIMS University Mumbai" },
      { "@type": "CollegeOrUniversity", "name": "Mukesh Patel School of Technology Management & Engineering" },
      { "@type": "CollegeOrUniversity", "name": "DJ Sanghvi College of Engineering" },
      { "@type": "Place", "name": "Vile Parle West, Mumbai" },
    ],
    "amenityFeature": VP_AMENITIES,
    "sameAs": [
      "https://www.instagram.com/hsquareliving",
      "https://www.facebook.com/hsquareliving",
    ],
  },
  "/hostel-near-mithibai": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Near Mithibai College Vile Parle",
    "alternateName": ["PG near Mithibai College", "Hostel near Mithibai Mumbai"],
    "description": "Premium hostel near Mithibai College, Vile Parle Mumbai. Fully-furnished PG with meals, WiFi, laundry, 24/7 security. Just 5 min from campus!",
    "url": `${SITE_URL}/hostel-near-mithibai`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Vile Parle West", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400049" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1075", "longitude": "72.8263" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "98", "bestRating": "5", "worstRating": "1" },
    "review": [VP_REVIEWS[0], VP_REVIEWS[1]],
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "CollegeOrUniversity", "name": "Mithibai College of Arts, Science & Commerce" },
      { "@type": "Place", "name": "Vile Parle West, Mumbai" },
    ],
    "amenityFeature": VP_AMENITIES,
  },
  "/hostel-near-mukesh-patel": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Near Mukesh Patel MPSTME Vile Parle",
    "alternateName": ["PG near MPSTME", "Hostel near Mukesh Patel School of Technology"],
    "description": "Best hostel near Mukesh Patel School of Technology (MPSTME), Vile Parle Mumbai. Premium PG with meals, WiFi, AC rooms, gym, 24/7 security. 5 min from campus.",
    "url": `${SITE_URL}/hostel-near-mukesh-patel`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Vile Parle West", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400049" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1075", "longitude": "72.8263" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "89", "bestRating": "5", "worstRating": "1" },
    "review": [VP_REVIEWS[2]],
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "CollegeOrUniversity", "name": "Mukesh Patel School of Technology Management & Engineering (MPSTME)" },
      { "@type": "Place", "name": "Vile Parle West, Mumbai" },
    ],
    "amenityFeature": VP_AMENITIES,
  },
  "/hostel-near-nm-college": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Near NM College Vile Parle",
    "alternateName": ["PG near NM College Mumbai", "Hostel near NM College of Commerce"],
    "description": "Premium hostel near NM College of Commerce Mumbai. Comfortable student PG with food, WiFi & 24/7 security in Vile Parle. Fully furnished, 5 min from campus.",
    "url": `${SITE_URL}/hostel-near-nm-college`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Vile Parle West", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400049" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1075", "longitude": "72.8263" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "76", "bestRating": "5", "worstRating": "1" },
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "CollegeOrUniversity", "name": "NM College of Commerce and Economics" },
      { "@type": "Place", "name": "Vile Parle, Mumbai" },
    ],
    "amenityFeature": VP_AMENITIES,
  },
  "/hostel-near-dj-sanghvi": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Near DJ Sanghvi College Vile Parle",
    "alternateName": ["PG near DJ Sanghvi", "Hostel near DJSCE Mumbai"],
    "description": "Best hostel near DJ Sanghvi College of Engineering, Vile Parle Mumbai. Furnished rooms with meals, WiFi, gym, laundry & 24/7 security by Hsquare Living.",
    "url": `${SITE_URL}/hostel-near-dj-sanghvi`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Vile Parle West", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400049" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1075", "longitude": "72.8263" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "65", "bestRating": "5", "worstRating": "1" },
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "CollegeOrUniversity", "name": "DJ Sanghvi College of Engineering" },
      { "@type": "Place", "name": "Vile Parle, Mumbai" },
    ],
    "amenityFeature": VP_AMENITIES,
  },
  "/hostel-near-whistling-woods": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Near Whistling Woods Goregaon",
    "alternateName": ["PG near Whistling Woods International", "Hostel for film students Goregaon"],
    "description": "Affordable hostel near Whistling Woods International Mumbai. Modern co-living spaces in Goregaon East with meals, WiFi, creative workspaces & amenities for film and media students.",
    "url": `${SITE_URL}/hostel-near-whistling-woods`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Goregaon East", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400063" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1663", "longitude": "72.8526" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "54", "bestRating": "5", "worstRating": "1" },
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "CollegeOrUniversity", "name": "Whistling Woods International" },
      { "@type": "Place", "name": "Goregaon, Mumbai" },
    ],
    "amenityFeature": [
      { "@type": "LocationFeatureSpecification", "name": "Free High-Speed WiFi", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "3 Meals Daily", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "24/7 Security & CCTV", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "Gym & Fitness Center", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "Study & Creative Lounge", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "Fully Furnished Rooms", "value": true },
    ],
  },
  "/hostel-in-vile-parle": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Vile Parle Mumbai",
    "alternateName": ["Best PG in Vile Parle", "Student hostel Vile Parle West"],
    "description": "Best student hostel in Vile Parle Mumbai near NMIMS, Mukesh Patel, DJ Sanghvi, Mithibai & NM College. Fully furnished rooms, meals, WiFi & 24/7 security.",
    "url": `${SITE_URL}/hostel-in-vile-parle`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Vile Parle West", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400049" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1075", "longitude": "72.8263" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "112", "bestRating": "5", "worstRating": "1" },
    "potentialAction": RESERVE_ACTION,
    "amenityFeature": VP_AMENITIES,
  },
  "/hostel-in-goregaon": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Goregaon East Mumbai",
    "alternateName": ["Best PG in Goregaon", "Student hostel Goregaon East"],
    "description": "Top hostel in Goregaon East Mumbai near Whistling Woods International, Film City & Nesco. Premium PG accommodation with meals, WiFi, gym, laundry & 24/7 security.",
    "url": `${SITE_URL}/hostel-in-goregaon`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Goregaon East", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400063" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1663", "longitude": "72.8526" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "61", "bestRating": "5", "worstRating": "1" },
    "potentialAction": RESERVE_ACTION,
  },
  "/hostel-in-juhu": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Juhu Mumbai",
    "alternateName": ["Best PG in Juhu", "Student hostel Juhu near NMIMS"],
    "description": "Best student hostel in Juhu Mumbai near NMIMS, Mithibai, NM College & Juhu Beach. Premium PG with meals, WiFi, gym & 24/7 security.",
    "url": `${SITE_URL}/hostel-in-juhu`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Juhu / Vile Parle", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400049" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1075", "longitude": "72.8263" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "103", "bestRating": "5", "worstRating": "1" },
    "review": [VP_REVIEWS[0]],
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "Place", "name": "Juhu, Mumbai" },
      { "@type": "Place", "name": "Vile Parle, Mumbai" },
      { "@type": "CollegeOrUniversity", "name": "NMIMS University" },
      { "@type": "CollegeOrUniversity", "name": "Mithibai College" },
      { "@type": "CollegeOrUniversity", "name": "NM College of Commerce" },
    ],
    "amenityFeature": VP_AMENITIES,
  },
  "/hostel-in-andheri": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Andheri West Mumbai",
    "alternateName": ["Best PG in Andheri West", "Student hostel near Andheri station"],
    "description": "Top student hostel in Andheri West, Mumbai. Furnished PG near Andheri station, metro & top colleges. Meals, WiFi, housekeeping, AC & 24/7 security included.",
    "url": `${SITE_URL}/hostel-in-andheri`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "streetAddress": "Andheri West", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN", "postalCode": "400058" },
    "geo": { "@type": "GeoCoordinates", "latitude": "19.1197", "longitude": "72.8464" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.5", "reviewCount": "72", "bestRating": "5", "worstRating": "1" },
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "Place", "name": "Andheri West, Mumbai" },
      { "@type": "Place", "name": "Lokhandwala, Mumbai" },
    ],
    "amenityFeature": [
      { "@type": "LocationFeatureSpecification", "name": "Free WiFi", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "Meals Included", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "24/7 Security & CCTV", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "Air Conditioning", "value": true },
      { "@type": "LocationFeatureSpecification", "name": "Fully Furnished Rooms", "value": true },
    ],
  },
  "/hostel-in-mumbai": {
    "@context": "https://schema.org",
    "@type": ["Hostel", "LocalBusiness"],
    "name": "Hsquare Hostel - Mumbai",
    "alternateName": ["Best student hostel Mumbai", "Best PG in Mumbai for students"],
    "description": "Best student hostel in Mumbai. Premium PG across Goregaon, Juhu, Vile Parle & Andheri with meals, WiFi, AC, gym & 24/7 security. Book online!",
    "url": `${SITE_URL}/hostel-in-mumbai`,
    "telephone": "+91-6372294625",
    "email": "support@hsquareliving.com",
    "address": { "@type": "PostalAddress", "addressLocality": "Mumbai", "addressRegion": "Maharashtra", "addressCountry": "IN" },
    "priceRange": "₹₹",
    "openingHours": "Mo-Su 00:00-23:59",
    "checkinTime": "11:00",
    "checkoutTime": "10:00",
    "image": { "@type": "ImageObject", "url": `${SITE_URL}/opengraph.jpg`, "width": 1200, "height": 630 },
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "195", "bestRating": "5", "worstRating": "1" },
    "potentialAction": RESERVE_ACTION,
    "areaServed": [
      { "@type": "City", "name": "Mumbai" },
      { "@type": "Place", "name": "Goregaon" },
      { "@type": "Place", "name": "Juhu" },
      { "@type": "Place", "name": "Vile Parle" },
      { "@type": "Place", "name": "Andheri" },
    ],
    "amenityFeature": VP_AMENITIES,
  },
};

const PAGE_META: Record<string, PageMeta> = {
  "/": {
    title: "Hsquare Hostel Mumbai | Best Hostel & PG near NMIMS, Mithibai, Mukesh Patel | Co-Living Goregaon, Juhu, Andheri",
    description: "Hsquare Hostel — premium hostel & co-living in Goregaon, Juhu & Andheri Mumbai. Near NMIMS, Mithibai, Mukesh Patel. Fully furnished rooms with meals, WiFi, gym, 24/7 security. Book today!",
    canonical: `${SITE_URL}/`,
    breadcrumbs: [{ name: "Home", url: `${SITE_URL}/` }],
  },
  "/properties": {
    title: "Student Hostels & PG in Mumbai | Browse All Properties | Hsquare Living",
    description: "Browse all Hsquare Living properties across Mumbai. Find fully furnished student hostels and PG near NMIMS, Mithibai, Mukesh Patel, DJ Sanghvi colleges. Compare rooms, prices, amenities & book online.",
    canonical: `${SITE_URL}/properties`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
    ],
  },
  "/about": {
    title: "About Hsquare Living | Premium Student Hostel Brand in Mumbai Since 2020",
    description: "Learn about Hsquare Living — Mumbai's trusted student accommodation brand near NMIMS, Mithibai & Mukesh Patel. Our mission: safe, comfortable, modern hostels with meals, WiFi & 24/7 security.",
    canonical: `${SITE_URL}/about`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "About Us", url: `${SITE_URL}/about` },
    ],
  },
  "/contact": {
    title: "Contact Hsquare Hostel Mumbai | Book a Visit | Call +91-6372294625",
    description: "Get in touch with Hsquare Living for hostel bookings near NMIMS, Mithibai, Mukesh Patel. Visit our properties in Goregaon, Juhu, Andheri. Call +91-6372294625 or fill our contact form.",
    canonical: `${SITE_URL}/contact`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Contact Us", url: `${SITE_URL}/contact` },
    ],
  },
  "/faq": {
    title: "FAQs | Hsquare Hostel Mumbai — Rooms, Meals, Pricing, Safety & Booking",
    description: "Find answers about Hsquare Living hostels — room types, meal plans, pricing, WiFi, security, booking process, payment options, check-in/check-out. Student hostel FAQ Mumbai.",
    canonical: `${SITE_URL}/faq`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "FAQ", url: `${SITE_URL}/faq` },
    ],
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": FAQ_ITEMS.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": { "@type": "Answer", "text": f.a },
        })),
      },
    ],
  },
  "/terms": {
    title: "Terms & Conditions | Hsquare Living Student Hostel Mumbai",
    description: "Read the terms and conditions for booking and staying at Hsquare Living hostels in Mumbai. Policies on payments, cancellations, house rules, security deposits and more.",
    canonical: `${SITE_URL}/terms`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Terms & Conditions", url: `${SITE_URL}/terms` },
    ],
  },
  "/privacy": {
    title: "Privacy Policy | Hsquare Living Student Hostel Mumbai",
    description: "Hsquare Living privacy policy. Learn how we collect, use, and protect your personal information when you use our hostel booking platform and services.",
    canonical: `${SITE_URL}/privacy`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Privacy Policy", url: `${SITE_URL}/privacy` },
    ],
  },
  "/apply": {
    title: "Apply for Hostel Room | Pre-Registration | Hsquare Living Mumbai",
    description: "Apply for student accommodation at Hsquare Living Mumbai. Pre-register online to secure your hostel room near NMIMS, Mithibai, Mukesh Patel colleges. Quick & easy process.",
    canonical: `${SITE_URL}/apply`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Apply", url: `${SITE_URL}/apply` },
    ],
  },
  "/hostel-near-nmims": {
    title: "Best Hostel Near NMIMS SVKMs Mumbai | PG in Vile Parle | Hsquare Living",
    description: "Looking for a hostel near NMIMS (SVKMs) Mumbai? Hsquare Hostel is just 5 min walk from NMIMS University, Vile Parle West. Fully furnished PG with meals, WiFi, AC, gym & 24/7 security. Book now!",
    canonical: `${SITE_URL}/hostel-near-nmims`,
    ogTitle: "Best Hostel Near NMIMS SVKMs Mumbai | Hsquare Living",
    ogDescription: "5 min walk from NMIMS (SVKMs) campus, Vile Parle. Premium PG with meals, WiFi, AC rooms, gym & 24/7 security. Book online!",
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel Near NMIMS (SVKMs)", url: `${SITE_URL}/hostel-near-nmims` },
    ],
  },
  "/hostel-near-svkms": {
    title: "Best Hostel Near SVKMs Mumbai | PG near NMIMS, MPSTME, DJ Sanghvi | Hsquare Living",
    description: "Looking for a hostel near SVKMs campus (NMIMS, Mukesh Patel, DJ Sanghvi)? Hsquare Hostel is just 5 min walk from SVKMs Vile Parle West. Fully furnished PG with meals, WiFi, gym & 24/7 security. Book now!",
    canonical: `${SITE_URL}/hostel-near-svkms`,
    ogTitle: "Best Hostel Near SVKMs Mumbai | Hsquare Living",
    ogDescription: "5 min walk from SVKMs campus (NMIMS, MPSTME, DJ Sanghvi), Vile Parle. Premium PG with meals, WiFi, AC rooms & 24/7 security.",
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel Near SVKMs Mumbai", url: `${SITE_URL}/hostel-near-svkms` },
    ],
  },
  "/hostel-near-mithibai": {
    title: "Best Hostel Near Mithibai College Mumbai | PG Near Mithibai | Hsquare Living",
    description: "Find the best hostel near Mithibai College, Vile Parle Mumbai. Hsquare offers fully-furnished PG with meals, WiFi, laundry, 24/7 security. Just 5 min from campus! Book your room today.",
    canonical: `${SITE_URL}/hostel-near-mithibai`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel Near Mithibai", url: `${SITE_URL}/hostel-near-mithibai` },
    ],
  },
  "/hostel-near-mukesh-patel": {
    title: "Best Hostel Near Mukesh Patel (MPSTME) Mumbai | PG for Engineering Students | Hsquare",
    description: "Best hostel near Mukesh Patel School of Technology (MPSTME) Mumbai. Premium PG with meals, WiFi, AC rooms, gym, 24/7 security. 5 min from campus. Book now!",
    canonical: `${SITE_URL}/hostel-near-mukesh-patel`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel Near Mukesh Patel", url: `${SITE_URL}/hostel-near-mukesh-patel` },
    ],
  },
  "/hostel-near-nm-college": {
    title: "Best Hostel Near NM College Mumbai | Student PG Vile Parle | Hsquare Living",
    description: "Premium hostel near NM College of Commerce Mumbai. Hsquare Living offers comfortable student PG with food, WiFi, laundry & 24/7 security in Vile Parle. Book now!",
    canonical: `${SITE_URL}/hostel-near-nm-college`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel Near NM College", url: `${SITE_URL}/hostel-near-nm-college` },
    ],
  },
  "/hostel-near-dj-sanghvi": {
    title: "Best Hostel Near DJ Sanghvi College Mumbai | Student PG Goregaon | Hsquare",
    description: "Best hostel near DJ Sanghvi College of Engineering Mumbai. Furnished rooms with meals, WiFi, gym, laundry & 24/7 security by Hsquare Living. Book your student PG!",
    canonical: `${SITE_URL}/hostel-near-dj-sanghvi`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel Near DJ Sanghvi", url: `${SITE_URL}/hostel-near-dj-sanghvi` },
    ],
  },
  "/hostel-near-whistling-woods": {
    title: "Best Hostel Near Whistling Woods Mumbai | PG for Film Students | Hsquare",
    description: "Affordable hostel near Whistling Woods International Mumbai. Hsquare Living provides modern co-living spaces with meals, WiFi, creative workspaces & amenities for film students.",
    canonical: `${SITE_URL}/hostel-near-whistling-woods`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel Near Whistling Woods", url: `${SITE_URL}/hostel-near-whistling-woods` },
    ],
  },
  "/hostel-in-vile-parle": {
    title: "Best Hostel in Vile Parle Mumbai | Student PG Near Colleges | Hsquare Living",
    description: "Best student hostel in Vile Parle Mumbai near Mithibai, NM College, NMIMS & Whistling Woods. Fully furnished rooms, meals, WiFi, gym & 24/7 security by Hsquare Living.",
    canonical: `${SITE_URL}/hostel-in-vile-parle`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel in Vile Parle", url: `${SITE_URL}/hostel-in-vile-parle` },
    ],
  },
  "/hostel-in-goregaon": {
    title: "Best Hostel in Goregaon Mumbai | Student PG Near Whistling Woods | Hsquare Living",
    description: "Top hostel in Goregaon East Mumbai near Whistling Woods, Film City & Nesco. Hsquare Living offers premium PG accommodation with meals, WiFi, gym, laundry & 24/7 security.",
    canonical: `${SITE_URL}/hostel-in-goregaon`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel in Goregaon", url: `${SITE_URL}/hostel-in-goregaon` },
    ],
  },
  "/hostel-in-juhu": {
    title: "Best Hostel in Juhu Mumbai | Student PG near NMIMS & Mithibai | Hsquare Living",
    description: "Premium student hostel in Juhu, Mumbai. Fully furnished rooms with meals, WiFi, AC, gym & 24/7 security. Walking distance from NMIMS, Mithibai, NM College. Book now!",
    canonical: `${SITE_URL}/hostel-in-juhu`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel in Juhu", url: `${SITE_URL}/hostel-in-juhu` },
    ],
  },
  "/hostel-in-andheri": {
    title: "Best Hostel in Andheri Mumbai | Student PG & Co-Living | Hsquare Living",
    description: "Top student hostel in Andheri West, Mumbai. Fully furnished PG near Andheri station, metro & top colleges. Meals, WiFi, housekeeping, 24/7 security included. Book today!",
    canonical: `${SITE_URL}/hostel-in-andheri`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel in Andheri", url: `${SITE_URL}/hostel-in-andheri` },
    ],
  },
  "/hostel-in-mumbai": {
    title: "Best Hostel in Mumbai | Premium Student PG & Co-Living | Hsquare Living",
    description: "Looking for a hostel in Mumbai? Hsquare Living offers premium student accommodation across Goregaon, Juhu, Vile Parle & Andheri. Meals, WiFi, AC, 24/7 security. Book now!",
    canonical: `${SITE_URL}/hostel-in-mumbai`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Hostel in Mumbai", url: `${SITE_URL}/hostel-in-mumbai` },
    ],
  },
};

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeJsonLd(obj: object): string {
  return JSON.stringify(obj).replace(/<\//g, "<\\/").replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

function buildBreadcrumbLd(crumbs: { name: string; url: string }[]): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((c, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": c.name,
      "item": c.url,
    })),
  };
}

const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Hsquare Living",
  "alternateName": ["Hsquare Hostel", "Hsquareliving"],
  "url": SITE_URL,
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": `${SITE_URL}/properties?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

async function getInitialHeroSlides(): Promise<Array<{
  imageUrl: string;
  title: string;
  subtitle: string;
  caption: string;
  videoUrl: string | null;
}>> {
  try {
    const adminSlides = await db
      .select()
      .from(schema.heroSlides)
      .where(eq(schema.heroSlides.isActive, true))
      .orderBy(asc(schema.heroSlides.sortOrder))
      .limit(8);
    if (adminSlides.length > 0) {
      return adminSlides.map((s) => ({
        imageUrl: s.imageUrl,
        title: s.title,
        subtitle: s.subtitle || "",
        caption: s.caption || "",
        videoUrl: s.videoUrl || null,
      }));
    }
    const fallback = await buildPropertyHeroFallback();
    return fallback.map((s) => ({
      imageUrl: s.imageUrl,
      title: s.title,
      subtitle: s.subtitle,
      caption: s.caption,
      videoUrl: null,
    }));
  } catch {
    return [];
  }
}

function injectHeroPreload(html: string, slides: Array<{ imageUrl: string }>): string {
  if (slides.length === 0) return html;
  const firstUrl = slides[0].imageUrl;
  const preload = `<link rel="preload" as="image" href="${escapeAttr(firstUrl)}" fetchpriority="high" />`;
  const initialJson = safeJsonLd(slides);
  const script = `<script>window.__INITIAL_HERO_SLIDES__=${initialJson};</script>`;
  return html.replace("</head>", `${preload}\n${script}\n</head>`);
}

export async function injectMetaTags(html: string, requestUrl: string): Promise<string> {
  const pathname = requestUrl.split("?")[0].split("#")[0];

  // For the homepage, inject the first real hero image as a preload hint
  // plus a window-scoped initial slides array so React can render the
  // correct LCP image immediately, without an API roundtrip.
  if (pathname === "/" || pathname === "") {
    const slides = await getInitialHeroSlides();
    html = injectHeroPreload(html, slides);
  }

  const meta = PAGE_META[pathname];
  if (!meta) {
    if (pathname.startsWith("/properties/") && pathname !== "/properties") {
      const propSlug = pathname.replace("/properties/", "");
      const propMeta = await buildPropertyMeta(propSlug, pathname);
      return applyMeta(html, propMeta);
    }
    return html;
  }

  return applyMeta(html, meta);
}

async function buildPropertyMeta(propSlug: string, pathname: string): Promise<PageMeta> {
  const fallback: PageMeta = {
    title: "Property Details | Hsquare Living - Student Hostel Mumbai",
    description: "View detailed information about this Hsquare Living property — room types, pricing, amenities, photos and availability. Book your student hostel in Mumbai.",
    canonical: `${SITE_URL}${pathname}`,
    breadcrumbs: [
      { name: "Home", url: `${SITE_URL}/` },
      { name: "Properties", url: `${SITE_URL}/properties` },
      { name: "Property Details", url: `${SITE_URL}${pathname}` },
    ],
  };

  if (!propSlug) return fallback;

  try {
    const [prop] = await db
      .select({
        id: schema.properties.id,
        name: schema.properties.name,
        slug: schema.properties.slug,
        city: schema.properties.city,
        location: schema.properties.location,
        address: schema.properties.address,
        amenities: schema.properties.amenities,
        phone: schema.properties.phone,
        email: schema.properties.email,
        category: schema.properties.category,
        mapsUrl: schema.properties.mapsUrl,
        imageUrl: schema.properties.imageUrl,
      })
      .from(schema.properties)
      .where(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(propSlug)
          ? eq(schema.properties.id, propSlug)
          : eq(schema.properties.slug, propSlug)
      )
      .limit(1);

    if (!prop) return fallback;

    const propName = prop.name || "Hsquare Hostel";
    const area = prop.location || prop.city || "Mumbai";
    const catLabel = prop.category === "boys" ? "Boys Hostel" : prop.category === "girls" ? "Girls Hostel" : "Student Hostel";
    const amenList = (prop.amenities as string[] || []).slice(0, 4).join(", ");
    const amenText = amenList ? ` ${amenList} included.` : "";

    const title = `${propName} | ${catLabel} in ${area} | Hsquare Living Mumbai`;
    const desc = `${propName} — premium ${catLabel.toLowerCase()} in ${area}, Mumbai.${amenText} Fully furnished rooms with meals, WiFi & 24/7 security. Book online!`;

    const jsonLdObj: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": "LodgingBusiness",
      "name": propName,
      "description": desc,
      "url": `${SITE_URL}/properties/${prop.slug || prop.id}`,
      "telephone": prop.phone || "+91-6372294625",
      "email": prop.email || "support@hsquareliving.com",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": prop.address || area,
        "addressLocality": prop.city || "Mumbai",
        "addressRegion": "Maharashtra",
        "addressCountry": "IN",
      },
      "priceRange": "₹₹",
      "openingHours": "Mo-Su 00:00-23:59",
      "image": prop.imageUrl || `${SITE_URL}/opengraph.jpg`,
    };

    if (prop.mapsUrl) {
      const latMatch = prop.mapsUrl.match(/@(-?\d+\.\d+)/);
      const lngMatch = prop.mapsUrl.match(/@-?\d+\.\d+,(-?\d+\.\d+)/);
      if (latMatch?.[1] && lngMatch?.[1]) {
        jsonLdObj.geo = {
          "@type": "GeoCoordinates",
          "latitude": latMatch[1],
          "longitude": lngMatch[1],
        };
      }
    }

    if (prop.amenities && Array.isArray(prop.amenities)) {
      jsonLdObj.amenityFeature = (prop.amenities as string[]).map((am: string) => ({
        "@type": "LocationFeatureSpecification",
        "name": am,
        "value": true,
      }));
    }

    jsonLdObj.checkinTime = "11:00";
    jsonLdObj.checkoutTime = "10:00";
    jsonLdObj.starRating = { "@type": "Rating", "ratingValue": "4", "bestRating": "5" };
    if (prop.mapsUrl) jsonLdObj.hasMap = prop.mapsUrl;

    const ogImage = (prop.imageUrl && prop.imageUrl.startsWith("http")) ? prop.imageUrl : `${SITE_URL}/opengraph.jpg`;
    const ogImageAlt = `${propName} — ${catLabel} in ${area}`;

    return {
      title: title.length > 70 ? title.slice(0, 67) + "..." : title,
      description: desc.length > 160 ? desc.slice(0, 157) + "..." : desc,
      canonical: `${SITE_URL}/properties/${prop.slug || prop.id}`,
      ogImage,
      ogImageAlt,
      breadcrumbs: [
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Properties", url: `${SITE_URL}/properties` },
        { name: propName, url: `${SITE_URL}/properties/${prop.slug || prop.id}` },
      ],
      jsonLd: [jsonLdObj],
    };
  } catch {
    return fallback;
  }
}

function applyMeta(html: string, meta: PageMeta): string {
  const title = escapeAttr(meta.title);
  const desc = escapeAttr(meta.description);
  const ogTitle = escapeAttr(meta.ogTitle || meta.title);
  const ogDesc = escapeAttr(meta.ogDescription || meta.description);
  const canonical = escapeAttr(meta.canonical);
  const ogImage = escapeAttr(meta.ogImage || `${SITE_URL}/opengraph.jpg`);
  const ogImageAlt = escapeAttr(meta.ogImageAlt || meta.title);

  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${desc}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"[^>]*>/, `<link rel="canonical" href="${canonical}" id="canonical-link" />`);
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${ogTitle}" />`);
  html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${ogDesc}" />`);
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/, `<meta property="og:url" content="${canonical}" />`);
  html = html.replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${ogImage}" />`);
  html = html.replace(/<meta property="og:image:alt" content="[^"]*"\s*\/?>/, `<meta property="og:image:alt" content="${ogImageAlt}" />`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/, `<meta name="twitter:title" content="${ogTitle}" />`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/, `<meta name="twitter:description" content="${ogDesc}" />`);
  html = html.replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${ogImage}" />`);
  html = html.replace(/<meta name="twitter:image:alt" content="[^"]*"\s*\/?>/, `<meta name="twitter:image:alt" content="${ogImageAlt}" />`);

  const jsonLdScripts: string[] = [];

  jsonLdScripts.push(`<script type="application/ld+json">${safeJsonLd(WEBSITE_LD)}</script>`);

  if (meta.breadcrumbs && meta.breadcrumbs.length > 0) {
    jsonLdScripts.push(`<script type="application/ld+json">${safeJsonLd(buildBreadcrumbLd(meta.breadcrumbs))}</script>`);
  }

  const pathname = meta.canonical.replace(SITE_URL, "");
  const collegeFaqs = COLLEGE_FAQ_MAP[pathname];
  if (collegeFaqs) {
    jsonLdScripts.push(`<script type="application/ld+json">${safeJsonLd({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": collegeFaqs.map(f => ({
        "@type": "Question",
        "name": f.q,
        "acceptedAnswer": { "@type": "Answer", "text": f.a },
      })),
    })}</script>`);
  }

  const collegeHostelLd = COLLEGE_HOSTEL_LD[pathname];
  if (collegeHostelLd) {
    jsonLdScripts.push(`<script type="application/ld+json">${safeJsonLd(collegeHostelLd)}</script>`);
  }

  if (meta.jsonLd) {
    for (const ld of meta.jsonLd) {
      jsonLdScripts.push(`<script type="application/ld+json">${safeJsonLd(ld)}</script>`);
    }
  }

  if (jsonLdScripts.length > 0) {
    html = html.replace("</head>", `${jsonLdScripts.join("\n")}\n</head>`);
  }

  return html;
}
