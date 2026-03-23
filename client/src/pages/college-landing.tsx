import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, MapPin, Wifi, UtensilsCrossed, Shield,
  ArrowRight, Building2, Clock, Star, CheckCircle2, Navigation,
  Phone, Mail, Sparkles, Users, Dumbbell, ShirtIcon, Zap,
  Bus, BookOpen
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
    collegeName: "NMIMS",
    collegeFullName: "NMIMS University (Narsee Monjee Institute of Management Studies)",
    area: "Vile Parle West, Mumbai",
    distance: "5 min",
    metaTitle: "Hostel Near NMIMS Mumbai | Best PG & Student Accommodation | Hsquare",
    metaDescription: "Looking for a hostel near NMIMS Mumbai? Hsquare Hostel offers premium fully-furnished rooms with meals, WiFi, security just 5 minutes from NMIMS University, Vile Parle.",
    heroHeading: "Premium Hostel Near NMIMS University",
    heroSubheading: "Fully-furnished student accommodation just 5 minutes from NMIMS campus in Vile Parle, Mumbai. Meals, WiFi, 24/7 security included.",
    aboutCollege: "NMIMS (Narsee Monjee Institute of Management Studies) is one of India's top-ranked private universities in Vile Parle West, Mumbai. Known for its MBA, engineering, pharmacy, and commerce programs, NMIMS attracts thousands of students from across India every year who need quality accommodation nearby.",
    whyNearCollege: "Finding safe, comfortable, and affordable accommodation near NMIMS can be challenging. Hsquare Hostel is strategically located just 5 minutes from the NMIMS campus, making your daily commute effortless. Our premium student hostel offers everything you need — from nutritious meals and high-speed WiFi to 24/7 security and housekeeping — so you can focus on your studies.",
    nearbyPlaces: ["NMIMS Campus - 5 min walk", "Vile Parle Station - 8 min", "Mithibai College - 5 min", "NM College - 5 min", "Juhu Beach - 10 min", "Irla Market - 7 min"],
    keywords: ["hostel near NMIMS", "PG near NMIMS Mumbai", "student hostel NMIMS Vile Parle", "accommodation near NMIMS university", "boys hostel near NMIMS", "girls hostel near NMIMS", "paying guest near NMIMS Mumbai"],
    propertyName: "Hsquare Hostel Juhu",
    propertyArea: "Juhu / Vile Parle",
    lat: "19.1075",
    lng: "72.8263",
    faqs: [
      { q: "How far is Hsquare Hostel from NMIMS?", a: "Hsquare Hostel is just 5 minutes walking distance from the NMIMS University campus in Vile Parle West." },
      { q: "Does Hsquare Hostel provide meals?", a: "Yes, we provide 3 freshly prepared meals daily along with evening snacks. Special dietary options are available." },
      { q: "What is the monthly rent for a hostel near NMIMS?", a: "Our plans start from ₹5,25,000 per academic year for triple sharing rooms, which includes meals, WiFi, housekeeping, and all amenities." },
      { q: "Is there WiFi available at Hsquare Hostel?", a: "Yes, high-speed WiFi is available 24/7 throughout the hostel premises including study areas and common rooms." },
      { q: "Is Hsquare Hostel safe for students?", a: "Absolutely. We have 24/7 CCTV surveillance, security guards, biometric access, and strict visitor policies to ensure student safety." },
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
    <div className="min-h-screen bg-[#050505] text-white">
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
              <Link href="/apply">
                <Button size="lg" className="bg-transparent border border-white/20 hover:bg-white/5 text-white px-8 py-6 text-base rounded-xl" data-testid="cta-apply-now">
                  Apply Now
                </Button>
              </Link>
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

      <section className="py-20 relative">
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center p-10 rounded-3xl border border-cyan-500/10 bg-gradient-to-b from-cyan-500/5 to-transparent"
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">Ready to Move In?</h2>
            <p className="text-white/40 mb-8 max-w-xl mx-auto">
              Join 500+ students living at Hsquare. Book your spot near {pageData.collegeName} today — limited beds available for the upcoming academic year.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/apply">
                <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white px-8 py-6 text-base font-semibold rounded-xl" data-testid="cta-bottom-apply">
                  Apply Now <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" className="bg-transparent border border-white/20 hover:bg-white/5 text-white px-8 py-6 text-base rounded-xl" data-testid="cta-bottom-contact">
                  <Phone className="mr-2 w-4 h-4" /> Contact Us
                </Button>
              </Link>
            </div>
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
