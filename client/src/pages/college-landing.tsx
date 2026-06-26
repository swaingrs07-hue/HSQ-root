import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  GraduationCap, MapPin, Wifi, UtensilsCrossed, Shield,
  ArrowRight, Building2, Clock, Star, CheckCircle2, Navigation,
  Phone, Mail, Sparkles, Users, Dumbbell, ShirtIcon, Zap,
  Bus, BookOpen, Send, Loader2
} from "lucide-react";
import { ParticleBackground } from "@/components/particle-background";
import { useQuery } from "@tanstack/react-query";

interface CollegePageData {
  slug: string;
  collegeName: string;
  collegeFullName: string;
  area: string;
  distance: string;
  metaTitle: string;
  metaDescription: string;
  heroHeading: string;
  heroSubheading: string;
  aboutCollege: string;
  whyNearCollege: string;
  nearbyPlaces: string[];
  keywords: string[];
  propertyName: string;
  propertyArea: string;
  lat: string;
  lng: string;
  faqs: { q: string; a: string }[];
}

const COLLEGE_PAGES: Record<string, CollegePageData> = {
  "hostel-near-nmims": {
    slug: "hostel-near-nmims",
    collegeName: "NMIMS (SVKMs)",
    collegeFullName: "NMIMS University — SVKMs (Narsee Monjee Institute of Management Studies)",
    area: "Vile Parle West, Mumbai",
    distance: "5 min",
    metaTitle: "Best Hostel Near NMIMS SVKMs Mumbai | PG in Vile Parle | Hsquare",
    metaDescription: "Looking for a hostel near NMIMS (SVKMs) Mumbai? Hsquare Hostel is just 5 min walk from NMIMS University, Vile Parle West. Meals, WiFi, AC rooms, gym & 24/7 security. Book now!",
    heroHeading: "Premium Hostel Near NMIMS (SVKMs) University",
    heroSubheading: "Fully-furnished student accommodation just 5 minutes from NMIMS (SVKMs) campus in Vile Parle West, Mumbai. Meals, WiFi, AC, gym & 24/7 security included.",
    aboutCollege: "NMIMS (Narsee Monjee Institute of Management Studies), part of the SVKMs (Shri Vile Parle Kelavani Mandal) campus cluster, is one of India's top-ranked private universities in Vile Parle West, Mumbai. Known for its MBA, engineering (MPSTME), pharmacy, and commerce programs, SVKMs NMIMS attracts thousands of students from across India every year who need quality accommodation nearby.",
    whyNearCollege: "Finding safe, comfortable, and affordable accommodation near NMIMS SVKMs can be challenging. Hsquare Hostel is strategically located just 5 minutes from the NMIMS/SVKMs campus, making your daily commute effortless. Our premium student hostel offers everything you need — from nutritious meals and high-speed WiFi to AC rooms, 24/7 security, gym, and housekeeping — so you can focus on your studies.",
    nearbyPlaces: ["NMIMS (SVKMs) Campus - 5 min walk", "Mukesh Patel MPSTME - 5 min", "DJ Sanghvi College - 5 min", "Vile Parle Station - 8 min", "Mithibai College - 5 min", "NM College - 5 min", "Juhu Beach - 10 min", "Irla Market - 7 min"],
    keywords: ["hostel near NMIMS", "hostel near SVKMs NMIMS", "PG near SVKMs Mumbai", "PG near NMIMS Mumbai", "student hostel NMIMS Vile Parle", "accommodation near NMIMS university", "hostel near SVKMs Vile Parle", "boys hostel near NMIMS", "girls hostel near NMIMS", "paying guest near NMIMS Mumbai"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Juhu / Vile Parle",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "How far is Hsquare Hostel from NMIMS (SVKMs)?", a: "Hsquare Hostel is just 5 minutes walking distance from the NMIMS University (SVKMs) campus in Vile Parle West, Mumbai." },
      { q: "Does Hsquare Hostel provide meals?", a: "Yes, we provide 3 freshly prepared meals daily along with evening snacks. Special dietary options are available." },
      { q: "What is the monthly rent for a hostel near NMIMS?", a: "Our plans start from ₹5,25,000 per academic year for triple sharing rooms, which includes meals, WiFi, housekeeping, and all amenities." },
      { q: "Is there WiFi available at Hsquare Hostel?", a: "Yes, high-speed WiFi is available 24/7 throughout the hostel premises including study areas and common rooms." },
      { q: "Is Hsquare Hostel safe for students?", a: "Absolutely. We have 24/7 CCTV surveillance, security guards, biometric access, and strict visitor policies to ensure student safety." },
    ],
  },
  "hostel-near-svkms": {
    slug: "hostel-near-svkms",
    collegeName: "SVKMs",
    collegeFullName: "SVKMs Campus — NMIMS University, MPSTME (Mukesh Patel), DJ Sanghvi College",
    area: "Vile Parle West, Mumbai",
    distance: "5 min",
    metaTitle: "Best Hostel Near SVKMs Mumbai | PG near NMIMS, MPSTME, DJ Sanghvi | Hsquare",
    metaDescription: "Looking for a hostel near SVKMs campus (NMIMS, Mukesh Patel, DJ Sanghvi)? Hsquare is just 5 min walk from SVKMs Vile Parle West. Meals, WiFi, AC, gym & 24/7 security. Book now!",
    heroHeading: "Premium Hostel Near SVKMs Campus, Vile Parle",
    heroSubheading: "Fully-furnished student accommodation just 5 minutes from SVKMs campus (NMIMS, MPSTME & DJ Sanghvi) in Vile Parle West, Mumbai. Meals, WiFi, AC & 24/7 security included.",
    aboutCollege: "SVKMs (Shri Vile Parle Kelavani Mandal) is the educational trust that operates some of Mumbai's most prestigious colleges — NMIMS University (Narsee Monjee Institute of Management Studies), Mukesh Patel School of Technology Management & Engineering (MPSTME), and DJ Sanghvi College of Engineering — all located on the same campus cluster in Vile Parle West, Mumbai.",
    whyNearCollege: "The SVKMs campus in Vile Parle West houses three major colleges (NMIMS, MPSTME, and DJ Sanghvi), making the surrounding area one of Mumbai's most sought-after student accommodation zones. Hsquare Hostel, just 5 minutes away, gives you the perfect base — nutritious meals, high-speed WiFi, AC rooms, gym, 24/7 security, and a community of students from all three colleges.",
    nearbyPlaces: ["SVKMs NMIMS Campus - 5 min walk", "Mukesh Patel MPSTME - 5 min", "DJ Sanghvi College - 5 min", "Mithibai College - 5 min", "Vile Parle Station - 8 min", "NM College - 5 min", "Juhu Beach - 10 min", "Andheri Station - 15 min"],
    keywords: ["hostel near SVKMs", "hostel near SVKMs NMIMS", "PG near SVKMs Mumbai", "hostel near SVKMs Vile Parle", "student hostel SVKMs campus", "PG near NMIMS MPSTME DJ Sanghvi", "boys hostel SVKMs Mumbai", "girls hostel near SVKMs"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Juhu / Vile Parle",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "How far is Hsquare Hostel from SVKMs campus?", a: "Hsquare Hostel is just 5 minutes walking distance from the entire SVKMs campus cluster (NMIMS University, MPSTME, DJ Sanghvi College) in Vile Parle West." },
      { q: "What colleges are part of SVKMs campus?", a: "SVKMs (Shri Vile Parle Kelavani Mandal) operates NMIMS University, Mukesh Patel School of Technology (MPSTME), and DJ Sanghvi College of Engineering — all within the same campus in Vile Parle West, Mumbai." },
      { q: "Does Hsquare provide meals near SVKMs?", a: "Yes, we provide 3 freshly prepared meals daily (breakfast, lunch & dinner) along with evening snacks. Both veg and non-veg options are available." },
      { q: "Is there a girls hostel near SVKMs NMIMS?", a: "Yes, Hsquare has dedicated floors and sections for female students with additional biometric security, 24/7 CCTV, and strict visitor management." },
      { q: "What is the rent for a PG near SVKMs?", a: "Our plans start from ₹5,25,000 per academic year for triple sharing rooms, fully inclusive of meals, WiFi, AC, housekeeping, and security." },
    ],
  },
  "hostel-near-mithibai": {
    slug: "hostel-near-mithibai",
    collegeName: "Mithibai",
    collegeFullName: "Mithibai College of Arts, Science & Commerce",
    area: "Vile Parle West, Mumbai",
    distance: "5 min",
    metaTitle: "Hostel Near Mithibai College Mumbai | Best PG Near Mithibai | Hsquare",
    metaDescription: "Find the best hostel near Mithibai College, Vile Parle Mumbai. Hsquare offers fully-furnished PG with meals, WiFi, laundry, 24/7 security. Just 5 min from campus!",
    heroHeading: "Premium Hostel Near Mithibai College",
    heroSubheading: "Top-rated student accommodation just 5 minutes from Mithibai College in Vile Parle. All-inclusive living with meals, WiFi, and security.",
    aboutCollege: "Mithibai College, formally known as Shri Vile Parle Kelavani Mandal's Mithibai College of Arts, Chauhan Institute of Science & Amrutben Jivanlal College of Commerce and Economics, is one of Mumbai's most prestigious colleges. Located in Vile Parle West, it attracts students from across Maharashtra and India for its excellent arts, science, and commerce programs.",
    whyNearCollege: "Living close to Mithibai College means more time for academics and campus activities, and less time commuting. Hsquare Hostel provides a comfortable, fully-furnished living space just 5 minutes from campus with all the amenities a student needs — nutritious meals, fast WiFi, regular housekeeping, and a vibrant community of fellow students.",
    nearbyPlaces: ["Mithibai College - 5 min walk", "NMIMS University - 5 min", "Vile Parle Station - 8 min", "NM College - 3 min", "Juhu Beach - 10 min", "D-Mart Vile Parle - 5 min"],
    keywords: ["hostel near Mithibai College", "PG near Mithibai Mumbai", "student accommodation Mithibai College", "hostel Vile Parle West", "girls hostel near Mithibai", "boys PG near Mithibai College Mumbai"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Juhu / Vile Parle",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "How far is Hsquare Hostel from Mithibai College?", a: "Our hostel is just 5 minutes walking distance from the Mithibai College campus in Vile Parle West." },
      { q: "Do you provide food at the hostel?", a: "Yes, we provide 3 freshly cooked meals daily along with evening snacks. Both veg and non-veg options are available." },
      { q: "Can I visit the hostel before booking?", a: "Absolutely! We encourage campus visits. You can book a tour through our website or call us directly." },
      { q: "What amenities are included?", a: "Meals, WiFi, housekeeping, laundry, security, study areas, common rooms, and EV bike access are all included in our plans." },
      { q: "Is there a separate girls hostel?", a: "Yes, we have separate floors and sections dedicated to female students with additional security measures." },
    ],
  },
  "hostel-near-mukesh-patel": {
    slug: "hostel-near-mukesh-patel",
    collegeName: "Mukesh Patel",
    collegeFullName: "Mukesh Patel School of Technology Management & Engineering (MPSTME)",
    area: "Vile Parle West, Mumbai",
    distance: "5 min",
    metaTitle: "Hostel Near Mukesh Patel (MPSTME) Mumbai | PG for Students | Hsquare",
    metaDescription: "Best hostel near Mukesh Patel School of Technology (MPSTME) Mumbai. Premium PG with meals, WiFi, AC rooms, 24/7 security. 5 min from campus. Book now!",
    heroHeading: "Premium Hostel Near Mukesh Patel (MPSTME)",
    heroSubheading: "Modern student living just 5 minutes from MPSTME campus. Fully-furnished rooms with meals, WiFi, AC, and round-the-clock security.",
    aboutCollege: "Mukesh Patel School of Technology Management & Engineering (MPSTME) is part of NMIMS University and is one of Mumbai's leading engineering and technology institutes. Located in Vile Parle West, MPSTME is known for its BTech, MTech, and MBA Tech programs, attracting tech-savvy students who value modern living standards.",
    whyNearCollege: "Engineering students at MPSTME often have demanding schedules with labs, projects, and coding sessions running late into the evening. Living at Hsquare Hostel, just 5 minutes from campus, gives you the flexibility to access the campus anytime while enjoying a comfortable living space with high-speed WiFi, meals, and all essential amenities.",
    nearbyPlaces: ["MPSTME Campus - 5 min walk", "NMIMS Main Campus - 5 min", "Vile Parle Station - 8 min", "Mithibai College - 5 min", "Juhu Beach - 10 min", "Andheri Station - 15 min"],
    keywords: ["hostel near Mukesh Patel", "PG near MPSTME Mumbai", "student hostel near MPSTME", "accommodation near Mukesh Patel Vile Parle", "engineering hostel Mumbai", "hostel near NMIMS engineering"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Juhu / Vile Parle",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "How close is Hsquare to Mukesh Patel (MPSTME)?", a: "Hsquare Hostel is approximately 5 minutes walking distance from the MPSTME campus at NMIMS, Vile Parle West." },
      { q: "Is there high-speed WiFi for engineering students?", a: "Yes, we provide 24/7 high-speed WiFi throughout the hostel. We understand engineering students need reliable internet for projects and assignments." },
      { q: "Are there study rooms available?", a: "Yes, we have dedicated study lounges and common areas where you can study, collaborate on projects, and work on assignments." },
      { q: "What's the pricing for students near MPSTME?", a: "Our plans start from ₹5,25,000 per academic year for triple sharing rooms. All amenities including meals, WiFi, and housekeeping are included." },
      { q: "Can I stay during summer/winter breaks?", a: "Yes, we offer flexible stay options and our academic year plans typically cover the full duration of your academic term." },
    ],
  },
  "hostel-near-nm-college": {
    slug: "hostel-near-nm-college",
    collegeName: "NM College",
    collegeFullName: "NM College of Commerce & Economics (Narsee Monjee College)",
    area: "Vile Parle West, Mumbai",
    distance: "5 min",
    metaTitle: "Hostel Near NM College Mumbai | Best PG & Accommodation | Hsquare",
    metaDescription: "Premium hostel near NM College (Narsee Monjee College) Vile Parle, Mumbai. Fully-furnished rooms, daily meals, WiFi, security. Walk to campus in 5 minutes!",
    heroHeading: "Premium Hostel Near NM College",
    heroSubheading: "Comfortable student living just 5 minutes from NM College of Commerce in Vile Parle. Everything included — meals, WiFi, housekeeping.",
    aboutCollege: "NM College of Commerce & Economics, commonly known as Narsee Monjee College, is a prestigious commerce college affiliated with the University of Mumbai. Located in Vile Parle West, it is known for producing top CA, CS, and MBA aspirants. The college attracts students from across India seeking quality education in commerce and economics.",
    whyNearCollege: "Commerce students at NM College often need quiet study spaces for CA/CMA preparations and exam seasons. Hsquare Hostel, located just 5 minutes from NM College, offers the perfect blend of comfortable living and focused study environments with dedicated study areas, nutritious meals, and all daily needs taken care of.",
    nearbyPlaces: ["NM College - 5 min walk", "Mithibai College - 3 min", "NMIMS University - 5 min", "Vile Parle Station - 8 min", "Juhu Beach - 10 min", "Libraries nearby - 5 min"],
    keywords: ["hostel near NM College", "PG near Narsee Monjee College", "accommodation near NM College Mumbai", "hostel Vile Parle for NM College students", "girls hostel near NM College", "student PG NM College Mumbai"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Juhu / Vile Parle",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "How far is Hsquare Hostel from NM College?", a: "Our hostel is just 5 minutes walking distance from NM College of Commerce in Vile Parle West." },
      { q: "Are there quiet study areas for CA preparation?", a: "Yes, we have dedicated study lounges and quiet zones perfect for focused preparation for CA, CS, and other competitive exams." },
      { q: "Do you offer monthly payment options?", a: "We offer flexible payment plans including semester-wise and installment options. Contact our team for customized payment solutions." },
      { q: "What meals are provided?", a: "We serve 3 nutritious meals daily — breakfast, lunch/high tea, and dinner. Both vegetarian and non-vegetarian options are available." },
      { q: "Is laundry service included?", a: "Yes, laundry and cleaning services are included in our housing plans at no additional cost." },
    ],
  },
  "hostel-near-dj-sanghvi": {
    slug: "hostel-near-dj-sanghvi",
    collegeName: "DJ Sanghvi",
    collegeFullName: "DJ Sanghvi College of Engineering",
    area: "Vile Parle West, Mumbai",
    distance: "8 min",
    metaTitle: "Hostel Near DJ Sanghvi College Mumbai | Student PG & Accommodation | Hsquare",
    metaDescription: "Best hostel near DJ Sanghvi College of Engineering, Vile Parle. Premium student PG with meals, WiFi, AC, laundry, 24/7 security. Book your stay!",
    heroHeading: "Premium Hostel Near DJ Sanghvi College",
    heroSubheading: "Modern student accommodation just 8 minutes from DJ Sanghvi College of Engineering. All-inclusive plans with meals, WiFi, and security.",
    aboutCollege: "DJ Sanghvi College of Engineering is a well-respected engineering institution in Vile Parle West, affiliated with the University of Mumbai. Known for its strong computer science, IT, and electronics programs, it attracts engineering aspirants from across Maharashtra and India.",
    whyNearCollege: "Engineering college schedules can be unpredictable with labs, workshops, and project deadlines. Staying at Hsquare Hostel, just 8 minutes from DJ Sanghvi, ensures you're always close to campus while enjoying premium living with high-speed WiFi essential for coding and projects, nutritious meals, and a community of like-minded students.",
    nearbyPlaces: ["DJ Sanghvi College - 8 min walk", "NMIMS University - 5 min", "Vile Parle Station - 8 min", "Mithibai College - 5 min", "Juhu Beach - 10 min", "Food Street Vile Parle - 5 min"],
    keywords: ["hostel near DJ Sanghvi", "PG near DJ Sanghvi College Mumbai", "student hostel DJ Sanghvi Vile Parle", "engineering hostel Vile Parle", "accommodation near DJ Sanghvi College"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Juhu / Vile Parle",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "How far is Hsquare from DJ Sanghvi College?", a: "Hsquare Hostel is approximately 8 minutes walking distance from DJ Sanghvi College of Engineering in Vile Parle." },
      { q: "Is there good internet for engineering projects?", a: "Yes, we provide high-speed 24/7 WiFi ideal for coding, project work, and online learning." },
      { q: "Can I bring my laptop and study at the hostel?", a: "Absolutely. Each room has study desks, and we have common study areas with charging points and comfortable seating." },
      { q: "What security measures are in place?", a: "We have 24/7 CCTV surveillance, security personnel, biometric access, and strict entry policies to ensure student safety." },
      { q: "Do you offer short-term stays?", a: "We primarily offer academic year plans, but flexible duration options may be available. Contact our team for specific requirements." },
    ],
  },
  "hostel-near-whistling-woods": {
    slug: "hostel-near-whistling-woods",
    collegeName: "Whistling Woods",
    collegeFullName: "Whistling Woods International Film School",
    area: "Goregaon East, Mumbai",
    distance: "10 min",
    metaTitle: "Hostel Near Whistling Woods Mumbai | Student Accommodation Goregaon | Hsquare",
    metaDescription: "Premium hostel near Whistling Woods International, Goregaon East Mumbai. Fully-furnished rooms with meals, WiFi, 24/7 security. Perfect for film school students!",
    heroHeading: "Premium Hostel Near Whistling Woods International",
    heroSubheading: "Creative student living just 10 minutes from Whistling Woods in Goregaon East. Meals, WiFi, security — everything covered.",
    aboutCollege: "Whistling Woods International is Asia's largest film, communication, and creative arts institute, founded by Subhash Ghai. Located in Film City Complex, Goregaon East, it offers courses in filmmaking, acting, screenwriting, music, and media arts, attracting creative minds from across the globe.",
    whyNearCollege: "Film school schedules are unique — early morning shoots, late night edits, and weekend projects. Hsquare Hostel in Goregaon offers the perfect base for Whistling Woods students with comfortable rooms, reliable WiFi for editing, nutritious meals to fuel creativity, and a convenient location just 10 minutes from campus.",
    nearbyPlaces: ["Whistling Woods - 10 min", "Film City Complex - 10 min", "Goregaon Station - 12 min", "Oberoi Mall - 8 min", "Nesco Exhibition Centre - 5 min", "Aarey Colony - 15 min"],
    keywords: ["hostel near Whistling Woods", "PG near Whistling Woods Mumbai", "student accommodation Film City Goregaon", "hostel Goregaon East for students", "accommodation near Whistling Woods International"],
    propertyName: "Hsquare Hostel Goregaon",
    propertyArea: "Goregaon East",
    lat: "19.1663",
    lng: "72.8526",
    faqs: [
      { q: "How close is Hsquare to Whistling Woods?", a: "Our Goregaon hostel is approximately 10 minutes from the Whistling Woods International campus in Film City Complex." },
      { q: "Is the hostel suitable for film students' schedules?", a: "Yes, we understand creative schedules. Our 24/7 access, late-night meal options, and flexible common areas cater to film students' unique needs." },
      { q: "Is there space for equipment storage?", a: "Each room has secure storage space. We can also accommodate special requirements for equipment storage." },
      { q: "How do I commute to Film City?", a: "The hostel is well-connected to Film City via auto-rickshaw and bus routes. Many students use our EV bike service for convenient commutes." },
      { q: "What's the community like?", a: "Our hostel houses students from various colleges and backgrounds, creating a vibrant, diverse community perfect for networking and collaboration." },
    ],
  },
  "hostel-in-vile-parle": {
    slug: "hostel-in-vile-parle",
    collegeName: "Vile Parle",
    collegeFullName: "Student Hostels in Vile Parle, Mumbai",
    area: "Vile Parle, Mumbai",
    distance: "",
    metaTitle: "Best Hostel in Vile Parle Mumbai | Student PG & Co-Living | Hsquare",
    metaDescription: "Best student hostel in Vile Parle Mumbai near NMIMS, Mithibai, NM College. Fully-furnished rooms with meals, WiFi, AC, security. Premium co-living from Hsquare.",
    heroHeading: "Best Student Hostel in Vile Parle, Mumbai",
    heroSubheading: "Premium co-living in the heart of Mumbai's education hub. Walking distance from NMIMS, Mithibai, NM College, and DJ Sanghvi.",
    aboutCollege: "Vile Parle is Mumbai's premier education hub, home to NMIMS University, Mithibai College, NM College, Mukesh Patel School of Technology, DJ Sanghvi College, and several other prestigious institutions. Thousands of students flock to this area every year, creating huge demand for quality hostel accommodation.",
    whyNearCollege: "Vile Parle's central location, excellent rail and metro connectivity, and proximity to multiple colleges make it the ideal area for student living. Hsquare Hostel in Vile Parle offers premium accommodation with all amenities included — meals, WiFi, housekeeping, laundry, and security — at competitive prices.",
    nearbyPlaces: ["NMIMS University - 5 min", "Mithibai College - 5 min", "NM College - 5 min", "DJ Sanghvi College - 8 min", "Vile Parle Station - 8 min", "Juhu Beach - 10 min"],
    keywords: ["hostel in Vile Parle", "PG in Vile Parle Mumbai", "student hostel Vile Parle West", "co-living Vile Parle", "boys hostel Vile Parle", "girls PG Vile Parle Mumbai", "affordable hostel Vile Parle"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Vile Parle / Juhu",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "Which colleges are near Hsquare Hostel in Vile Parle?", a: "NMIMS University, Mithibai College, NM College, Mukesh Patel (MPSTME), and DJ Sanghvi College are all within 5-8 minutes walking distance." },
      { q: "How far is Vile Parle Station from the hostel?", a: "Vile Parle railway station (Western Line) is approximately 8 minutes walking distance from our hostel." },
      { q: "What's included in the rent?", a: "Our all-inclusive plans cover accommodation, 3 meals daily, WiFi, housekeeping, laundry, security, and access to all common amenities." },
      { q: "Is the hostel safe for female students?", a: "Yes, we have dedicated floors for female students with 24/7 CCTV, biometric access, security guards, and strict visitor policies." },
      { q: "Can parents visit?", a: "Yes, parents can visit during designated visiting hours. We have comfortable common areas for meetings." },
    ],
  },
  "hostel-in-goregaon": {
    slug: "hostel-in-goregaon",
    collegeName: "Goregaon",
    collegeFullName: "Student Hostels in Goregaon, Mumbai",
    area: "Goregaon East, Mumbai",
    distance: "",
    metaTitle: "Best Hostel in Goregaon Mumbai | Student PG & Co-Living | Hsquare",
    metaDescription: "Best student hostel in Goregaon East Mumbai near Whistling Woods, Film City, NESCO. Furnished rooms with meals, WiFi, security. Affordable co-living by Hsquare.",
    heroHeading: "Best Student Hostel in Goregaon, Mumbai",
    heroSubheading: "Premium co-living in Goregaon East near Whistling Woods, Film City, and Nesco. Meals, WiFi, 24/7 security included.",
    aboutCollege: "Goregaon East is a rapidly growing area in Mumbai known for Film City, Whistling Woods International, Nesco Exhibition Centre, and IT parks. It attracts students, creative professionals, and working individuals looking for convenient, well-connected accommodation.",
    whyNearCollege: "Goregaon's proximity to Film City, major studios, and IT hubs makes it perfect for creative and tech students. Hsquare Hostel in Goregaon provides comfortable, affordable living with modern amenities — meals, WiFi, gym, and security — in a vibrant community setting.",
    nearbyPlaces: ["Whistling Woods - 10 min", "Film City - 10 min", "Goregaon Station - 12 min", "Nesco Centre - 5 min", "Oberoi Mall - 8 min", "Western Express Highway - 5 min"],
    keywords: ["hostel in Goregaon", "PG in Goregaon East Mumbai", "student hostel Goregaon", "co-living Goregaon Mumbai", "affordable hostel near Film City", "hostel near Goregaon station"],
    propertyName: "Hsquare Hostel Goregaon",
    propertyArea: "Goregaon East",
    lat: "19.1663",
    lng: "72.8526",
    faqs: [
      { q: "What institutions are near Hsquare Hostel Goregaon?", a: "Whistling Woods International, Film City Complex, Nesco Exhibition Centre, and several IT parks are all within 5-12 minutes." },
      { q: "How far is Goregaon Station?", a: "Goregaon railway station (Western Line) is approximately 12 minutes from our hostel." },
      { q: "Is there a gym at the hostel?", a: "Yes, we have a fitness center and indoor gaming area available for all residents." },
      { q: "Do you offer working professional accommodation?", a: "Yes, our co-living spaces are suitable for both students and working professionals." },
      { q: "What's the rent for Goregaon hostel?", a: "Our plans are competitively priced. Contact us for current rates and available room types." },
    ],
  },
  "hostel-in-juhu": {
    slug: "hostel-in-juhu",
    collegeName: "Juhu",
    collegeFullName: "Student Hostels in Juhu, Mumbai",
    area: "Juhu / Vile Parle, Mumbai",
    distance: "",
    metaTitle: "Best Hostel in Juhu Mumbai | PG near NMIMS, Mithibai & Juhu Beach | Hsquare",
    metaDescription: "Premium student hostel in Juhu Mumbai. Walking distance from NMIMS, Mithibai, NM College & Juhu Beach. Fully-furnished rooms with meals, WiFi, gym, 24/7 security. Book now!",
    heroHeading: "Best Student Hostel in Juhu, Mumbai",
    heroSubheading: "Premium co-living in Juhu — steps from the beach and top colleges like NMIMS, Mithibai & NM College. Meals, WiFi, AC, 24/7 security included.",
    aboutCollege: "Juhu is one of Mumbai's most desirable neighbourhoods, combining beautiful beachside living with close proximity to some of the city's top educational institutions. NMIMS University, Mithibai College, NM College, and Mukesh Patel (MPSTME) are all within a 10-minute radius, making Juhu a top destination for students seeking quality accommodation in a lively area.",
    whyNearCollege: "Staying in Juhu means enjoying the best of both worlds — a vibrant, safe neighbourhood with Juhu Beach nearby for stress relief, and quick walking access to top colleges. Hsquare Hostel in Juhu provides premium, fully-furnished rooms with all amenities so students can focus entirely on academics while living comfortably.",
    nearbyPlaces: ["NMIMS University - 8 min", "Mithibai College - 8 min", "NM College - 8 min", "Juhu Beach - 10 min walk", "Vile Parle Station - 10 min", "Juhu Market - 5 min"],
    keywords: ["hostel in Juhu", "PG in Juhu Mumbai", "student hostel Juhu", "co-living Juhu Mumbai", "hostel near Juhu Beach", "accommodation Juhu student", "PG Juhu Vile Parle"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Juhu / Vile Parle",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "Is there a hostel in Juhu, Mumbai?", a: "Yes! Hsquare Hostel is located in the Juhu / Vile Parle area, just minutes from Juhu Beach and top colleges like NMIMS, Mithibai, and NM College." },
      { q: "How far is Juhu Beach from Hsquare Hostel?", a: "Juhu Beach is approximately 10 minutes walking distance from our hostel — perfect for evening walks and stress relief after classes." },
      { q: "What is the rent for a hostel in Juhu?", a: "Our plans start from ₹5,25,000 per academic year for triple sharing rooms, fully inclusive of meals, WiFi, housekeeping, and all amenities." },
      { q: "Is it safe to stay in Juhu as a student?", a: "Absolutely. Our hostel has 24/7 CCTV surveillance, biometric entry, security guards, and a strict visitor policy ensuring student safety." },
      { q: "Are there good transport links from Juhu?", a: "Yes, Vile Parle railway station (Western Line) is 8-10 minutes away, and auto-rickshaws and buses are readily available throughout the day." },
    ],
  },
  "hostel-in-andheri": {
    slug: "hostel-in-andheri",
    collegeName: "Andheri",
    collegeFullName: "Student Hostels in Andheri, Mumbai",
    area: "Andheri West, Mumbai",
    distance: "",
    metaTitle: "Best Hostel in Andheri Mumbai | Student PG & Co-Living | Hsquare",
    metaDescription: "Top student hostel in Andheri West, Mumbai. Near Andheri station, metro & top colleges. Fully furnished rooms, meals, WiFi, AC, housekeeping & 24/7 security. Book today!",
    heroHeading: "Best Student Hostel in Andheri, Mumbai",
    heroSubheading: "Premium co-living in Andheri West with excellent connectivity to all of Mumbai. Meals, WiFi, AC, housekeeping & 24/7 security included.",
    aboutCollege: "Andheri is Mumbai's largest suburb and a major commercial, entertainment, and educational hub. With excellent Western Railway and metro connectivity, Andheri West is a sought-after location for students and working professionals. Its proximity to BKC, the airport, and Mumbai's college belt makes it ideal for those who need to be well-connected across the city.",
    whyNearCollege: "Andheri's strategic central location means you can reach any part of Mumbai within 30-40 minutes. Hsquare Hostel in Andheri provides fully-furnished, secure co-living with all daily needs covered — meals, WiFi, housekeeping, and 24/7 security — so you can make the most of Mumbai's opportunities without worrying about your accommodation.",
    nearbyPlaces: ["Andheri Railway Station - 15 min", "Andheri Metro Station - 10 min", "Lokhandwala Market - 5 min", "Versova Beach - 10 min", "D-Y Patil College - 10 min", "Infiniti Mall - 5 min"],
    keywords: ["hostel in Andheri", "PG in Andheri West Mumbai", "student hostel Andheri", "co-living Andheri Mumbai", "hostel near Andheri station", "affordable PG Andheri West", "hostel Lokhandwala"],
    propertyName: "Hsquare Hostel Andheri",
    propertyArea: "Andheri West",
    lat: "19.1197",
    lng: "72.8464",
    faqs: [
      { q: "Is there a hostel near Andheri station?", a: "Yes, Hsquare has properties in Andheri West with convenient connectivity to Andheri railway station and metro via auto-rickshaw or bus routes." },
      { q: "How far is the hostel from Andheri railway station?", a: "Our Andheri properties are approximately 10-15 minutes from Andheri railway station by auto-rickshaw or a short bus ride." },
      { q: "What is the monthly rent for a hostel in Andheri?", a: "Our all-inclusive academic year plans cover accommodation, meals, WiFi, housekeeping, and security. Contact us or visit our website for current rates." },
      { q: "Are there colleges near the Andheri hostel?", a: "Yes, the Andheri area provides access to several colleges and is well-connected to Vile Parle's college cluster (NMIMS, Mithibai, NM College) just 15-20 minutes away." },
      { q: "Do you have AC rooms in Andheri?", a: "Yes, we offer both AC and non-AC room options. AC rooms come with split air conditioning units and are included in our premium plans." },
    ],
  },
  "hostel-in-mumbai": {
    slug: "hostel-in-mumbai",
    collegeName: "Mumbai",
    collegeFullName: "Best Student Hostels across Mumbai",
    area: "Mumbai, Maharashtra",
    distance: "",
    metaTitle: "Best Hostel in Mumbai | Premium Student PG & Co-Living | Hsquare Living",
    metaDescription: "Looking for the best hostel in Mumbai? Hsquare Living offers premium student accommodation in Goregaon, Juhu, Vile Parle & Andheri. Meals, WiFi, AC, 24/7 security. Book now!",
    heroHeading: "Best Student Hostels in Mumbai",
    heroSubheading: "Premium co-living across Mumbai's top areas — Goregaon, Juhu, Vile Parle & Andheri. Meals, WiFi, AC, gym & 24/7 security in every property.",
    aboutCollege: "Mumbai is India's financial capital and one of the country's most sought-after cities for higher education. Home to NMIMS, Mithibai College, NM College, DJ Sanghvi, Whistling Woods, and hundreds of other institutions, Mumbai attracts hundreds of thousands of students every year who need safe, comfortable, and well-connected accommodation.",
    whyNearCollege: "Hsquare Living operates premium student hostels across Mumbai's key residential and educational hubs — Goregaon East, Juhu, Vile Parle, and Andheri West. Each property is fully-furnished with modern amenities: 3 daily meals, high-speed WiFi, AC rooms, gym, laundry, housekeeping, and 24/7 security, all at competitive prices. We handle everything so you can focus on building your future.",
    nearbyPlaces: ["Goregaon East - Film City & Whistling Woods", "Juhu & Vile Parle - NMIMS, Mithibai, NM College", "Andheri West - Central connectivity & metro", "Goregaon Station & Vile Parle Station - Rail access", "Multiple Metro stations across properties", "Premium malls, beaches & market nearby"],
    keywords: ["hostel in Mumbai", "best student hostel Mumbai", "PG in Mumbai", "student accommodation Mumbai", "co-living Mumbai", "affordable hostel Mumbai", "premium hostel Mumbai student"],
    propertyName: "Hsquare Hostel Mumbai",
    propertyArea: "Goregaon, Juhu, Vile Parle & Andheri",
    lat: "19.1263",
    lng: "72.8422",
    faqs: [
      { q: "Which is the best hostel in Mumbai for students?", a: "Hsquare Living is rated among Mumbai's best student hostels with properties in Goregaon, Juhu, Vile Parle, and Andheri. Premium amenities, meals, WiFi, and 24/7 security." },
      { q: "What is the average cost of a student hostel in Mumbai?", a: "At Hsquare, our plans start from ₹5,25,000 per academic year for triple sharing rooms, fully inclusive of all amenities including meals, WiFi, and housekeeping." },
      { q: "Which areas in Mumbai are best for student hostels?", a: "Vile Parle and Juhu are ideal for NMIMS, Mithibai, and NM College students. Goregaon is great for Whistling Woods and IT professionals. Andheri provides excellent central connectivity." },
      { q: "Do Mumbai hostels provide meals?", a: "Yes, all Hsquare hostels provide 3 freshly prepared meals daily — breakfast, lunch, and dinner — along with evening snacks. Both veg and non-veg options are available." },
      { q: "Is it safe for female students to stay in Mumbai hostels?", a: "Yes, we have dedicated floors for female students with 24/7 CCTV surveillance, biometric access, security personnel, and strict visitor policies at every property." },
    ],
  },
};

const AMENITIES = [
  { icon: UtensilsCrossed, label: "3 Daily Meals", desc: "Nutritious veg & non-veg" },
  { icon: Wifi, label: "High-Speed WiFi", desc: "24/7 connectivity" },
  { icon: Shield, label: "24/7 Security", desc: "CCTV & biometric access" },
  { icon: Sparkles, label: "Housekeeping", desc: "Daily room cleaning" },
  { icon: ShirtIcon, label: "Laundry Service", desc: "Included in plan" },
  { icon: Dumbbell, label: "Fitness Centre", desc: "Modern gym equipment" },
  { icon: BookOpen, label: "Study Lounges", desc: "Quiet focused zones" },
  { icon: Bus, label: "H-Express Shuttle", desc: "Campus commute service" },
];

function EnquiryForm({ collegeName, slug }: { collegeName: string; slug: string }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/enquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          notes: `[Landing Page: ${slug}] ${form.message.trim() || `Enquiry from ${collegeName} landing page`}`,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again or call us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="p-10 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 text-center"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-2xl font-heading font-bold text-white mb-3" data-testid="enquiry-success-heading">Thank You!</h3>
        <p className="text-white/50 mb-6">Our team will contact you within 24 hours to help you find the perfect room near {collegeName}.</p>
        <Link href="/properties">
          <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-xl" data-testid="btn-explore-after-enquiry">
            Explore Properties <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-8 md:p-10 rounded-3xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm space-y-5" data-testid="enquiry-form">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="text-sm text-white/50 mb-2 block">Full Name *</label>
          <Input
            value={form.name}
            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Your full name"
            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 rounded-xl"
            data-testid="input-enquiry-name"
          />
        </div>
        <div>
          <label className="text-sm text-white/50 mb-2 block">Phone Number *</label>
          <Input
            value={form.phone}
            onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+91 98765 43210"
            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 rounded-xl"
            data-testid="input-enquiry-phone"
          />
        </div>
      </div>
      <div>
        <label className="text-sm text-white/50 mb-2 block">Email (optional)</label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
          placeholder="you@example.com"
          className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 h-12 rounded-xl"
          data-testid="input-enquiry-email"
        />
      </div>
      <div>
        <label className="text-sm text-white/50 mb-2 block">Message (optional)</label>
        <Textarea
          value={form.message}
          onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
          placeholder="Tell us about your requirements — room type, move-in date, budget, etc."
          rows={3}
          className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 rounded-xl resize-none"
          data-testid="input-enquiry-message"
        />
      </div>
      {error && <p className="text-red-400 text-sm" data-testid="enquiry-error">{error}</p>}
      <Button
        type="submit"
        disabled={submitting}
        size="lg"
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white py-6 text-base font-semibold rounded-xl shadow-lg shadow-cyan-500/20"
        data-testid="btn-submit-enquiry"
      >
        {submitting ? <><Loader2 className="mr-2 w-5 h-5 animate-spin" /> Submitting...</> : <>Send Enquiry <Send className="ml-2 w-5 h-5" /></>}
      </Button>
      <p className="text-white/20 text-xs text-center">By submitting, you agree to be contacted by our team. No spam, we promise.</p>
    </form>
  );
}

function CollegeLandingPage() {
  const [, params] = useRoute("/:slug");
  const slug = params?.slug || "";
  const pageData = COLLEGE_PAGES[slug];

  const { data: properties } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: () => fetch("/api/properties").then(r => r.json()),
  });

  useEffect(() => {
    if (pageData) {
      document.title = pageData.metaTitle;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute("content", pageData.metaDescription);
      const canonical = document.getElementById("canonical-link") as HTMLLinkElement;
      if (canonical) canonical.href = `https://hsquare.in/${pageData.slug}`;
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute("content", pageData.metaTitle);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute("content", pageData.metaDescription);
    }
    window.scrollTo(0, 0);
  }, [pageData]);

  if (!pageData) return null;

  return (
    <div className="min-h-screen bg-transparent text-white">
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        <ParticleBackground />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(6,182,212,0.08) 0%, transparent 60%)" }} />
        <div className="container mx-auto px-4 relative z-10 py-24 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 mb-8">
              <GraduationCap className="w-4 h-4 text-cyan-400" />
              <span className="text-cyan-400 text-sm font-medium">Near {pageData.collegeName}</span>
              {pageData.distance && (
                <>
                  <span className="text-white/20">•</span>
                  <Navigation className="w-3 h-3 text-cyan-400" />
                  <span className="text-cyan-400 text-sm">{pageData.distance}</span>
                </>
              )}
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-black tracking-tight leading-[1.1] mb-6">
              <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">{pageData.heroHeading}</span>
            </h1>
            <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto mb-10 leading-relaxed">
              {pageData.heroSubheading}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/properties">
                <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-8 py-6 text-base font-semibold rounded-xl shadow-lg shadow-cyan-500/20" data-testid="cta-explore-rooms">
                  Explore Rooms <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Button
                size="lg"
                className="bg-transparent border border-white/20 hover:bg-white/5 text-white px-8 py-6 text-base rounded-xl"
                data-testid="cta-enquire-now"
                onClick={() => document.getElementById("enquiry-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Enquire Now <Send className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 relative">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(139,92,246,0.04) 0%, transparent 50%)" }} />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-6">
                About <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{pageData.collegeFullName}</span>
              </h2>
              <p className="text-white/40 text-base md:text-lg leading-relaxed mb-8">{pageData.aboutCollege}</p>
              <h3 className="text-2xl font-heading font-bold mb-4 text-white/90">Why Stay Near {pageData.collegeName}?</h3>
              <p className="text-white/40 text-base md:text-lg leading-relaxed">{pageData.whyNearCollege}</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Nearby Properties */}
      {(() => {
        const allProps: any[] = Array.isArray(properties) ? properties : [];
        const areaKeywords = pageData.propertyArea
          .toLowerCase()
          .split(/[,/&]+/)
          .map((t: string) => t.trim())
          .filter((t: string) => t.length > 2);
        const nearby = allProps
          .filter((p: any) => {
            if (!p.location || p.status !== "published") return false;
            const loc = (p.location as string).toLowerCase();
            return areaKeywords.some((kw: string) => loc.includes(kw));
          })
          .slice(0, 3);
        if (nearby.length === 0) return null;
        return (
          <section className="py-20 relative">
            <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.03) 0%, transparent 50%)" }} />
            <div className="container mx-auto px-4 relative z-10">
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
                <p className="text-amber-400/80 text-xs tracking-[0.4em] uppercase font-medium mb-3">Available Now</p>
                <h2 className="text-3xl md:text-4xl font-heading font-bold">
                  Hsquare Properties Near {pageData.collegeName}
                </h2>
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto mb-10">
                {nearby.map((prop: any, i: number) => (
                  <motion.a
                    key={prop.id}
                    href={`/properties/${prop.slug}`}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="group block p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-300"
                    data-testid={`property-card-${i}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shrink-0">
                        <Building2 className="w-6 h-6 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white/90 text-sm mb-1 group-hover:text-amber-400 transition-colors truncate">
                          {prop.name}
                        </h3>
                        <p className="text-white/35 text-xs flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {prop.location}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-widest text-emerald-400/70 font-medium">Available</span>
                      <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.a>
                ))}
              </div>
              <div className="text-center">
                <Link href="/properties">
                  <Button variant="outline" className="border-white/15 text-white/60 hover:text-white hover:border-white/30 rounded-xl" data-testid="btn-view-all-properties">
                    View All Properties <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        );
      })()}

      <section className="py-20 relative">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 70% 50%, rgba(6,182,212,0.04) 0%, transparent 50%)" }} />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className="text-cyan-400/80 text-xs tracking-[0.4em] uppercase font-medium mb-3">What's Included</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold">Premium Amenities at Hsquare</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {AMENITIES.map((amenity, i) => (
              <motion.div
                key={amenity.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm hover:bg-white/[0.04] transition-all"
                data-testid={`amenity-${i}`}
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mb-3">
                  <amenity.icon className="w-5 h-5 text-cyan-400" />
                </div>
                <h3 className="font-semibold text-white text-sm mb-1">{amenity.label}</h3>
                <p className="text-white/30 text-xs">{amenity.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 relative">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="text-emerald-400/80 text-xs tracking-[0.4em] uppercase font-medium mb-3">Location</p>
              <h2 className="text-3xl font-heading font-bold mb-6">Nearby Landmarks</h2>
              <div className="space-y-3">
                {pageData.nearbyPlaces.map((place, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]" data-testid={`nearby-${i}`}>
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-white/60 text-sm">{place}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="text-violet-400/80 text-xs tracking-[0.4em] uppercase font-medium mb-3">Why Choose Us</p>
              <h2 className="text-3xl font-heading font-bold mb-6">The Hsquare Advantage</h2>
              <div className="space-y-4">
                {[
                  { icon: Building2, text: `Premium property in ${pageData.propertyArea}` },
                  { icon: Clock, text: `Just ${pageData.distance || "minutes"} from ${pageData.collegeName}` },
                  { icon: Star, text: "All-inclusive plans — no hidden charges" },
                  { icon: Users, text: "Vibrant student community" },
                  { icon: Zap, text: "24/7 power backup & WiFi" },
                  { icon: CheckCircle2, text: "Trusted by 500+ students" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-violet-400" />
                    </div>
                    <span className="text-white/60 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-20 relative">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.03) 0%, transparent 50%)" }} />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-12">
            <p className="text-amber-400/80 text-xs tracking-[0.4em] uppercase font-medium mb-3">Common Questions</p>
            <h2 className="text-3xl md:text-4xl font-heading font-bold">Frequently Asked Questions</h2>
          </motion.div>
          <div className="max-w-3xl mx-auto space-y-4">
            {pageData.faqs.map((faq, i) => (
              <motion.details
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="group p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] cursor-pointer"
                data-testid={`faq-${i}`}
              >
                <summary className="font-semibold text-white/80 text-sm md:text-base list-none flex items-center justify-between">
                  {faq.q}
                  <span className="text-white/20 group-open:rotate-45 transition-transform text-xl ml-4">+</span>
                </summary>
                <p className="mt-3 text-white/40 text-sm leading-relaxed">{faq.a}</p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 relative" id="enquiry-form">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(6,182,212,0.06) 0%, transparent 60%)" }} />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Get in Touch</h2>
              <p className="text-white/40 max-w-xl mx-auto">
                Interested in living near {pageData.collegeName}? Fill in your details and our team will reach out to you within 24 hours.
              </p>
            </div>
            <EnquiryForm collegeName={pageData.collegeName} slug={pageData.slug} />
          </motion.div>
        </div>
      </section>

      <section className="py-16 relative">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-white/20 text-xs leading-relaxed space-y-3">
            <p>
              <strong className="text-white/30">Hsquare Hostel</strong> is a premium student accommodation provider in Mumbai offering fully-furnished hostels and PG near {pageData.collegeFullName}. 
              Our {pageData.propertyName} in {pageData.propertyArea} is strategically located {pageData.distance ? `just ${pageData.distance}` : "close"} from {pageData.collegeName}, 
              making it the ideal choice for students seeking comfortable, secure, and affordable living.
            </p>
            <p>
              Keywords: {pageData.keywords.join(", ")}, premium student hostel Mumbai, best PG in Mumbai for students, 
              co-living space Mumbai, fully furnished hostel Mumbai, hostel with food and WiFi Mumbai, student accommodation Mumbai, 
              affordable hostel Mumbai, safe hostel for girls Mumbai, boys hostel Mumbai.
            </p>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Hostel",
            "name": `Hsquare Hostel - Near ${pageData.collegeName}`,
            "description": pageData.metaDescription,
            "url": `https://hsquare.in/${pageData.slug}`,
            "telephone": "+91-6372294625",
            "email": "support@hsquareliving.com",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": pageData.propertyArea,
              "addressLocality": "Mumbai",
              "addressRegion": "Maharashtra",
              "addressCountry": "IN"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": pageData.lat,
              "longitude": pageData.lng
            },
            "priceRange": "$$",
            "openingHours": "Mo-Su 00:00-23:59",
            "image": "https://hsquare.in/opengraph.jpg",
            "areaServed": [
              { "@type": "CollegeOrUniversity", "name": pageData.collegeFullName },
              { "@type": "Place", "name": pageData.area }
            ],
            "amenityFeature": AMENITIES.map(a => ({
              "@type": "LocationFeatureSpecification",
              "name": a.label,
              "value": true
            })),
            "keywords": pageData.keywords.join(", ")
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": pageData.faqs.map(f => ({
              "@type": "Question",
              "name": f.q,
              "acceptedAnswer": {
                "@type": "Answer",
                "text": f.a
              }
            }))
          })
        }}
      />
    </div>
  );
}

export default CollegeLandingPage;
export { COLLEGE_PAGES };
