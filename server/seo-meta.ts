const SITE_URL = process.env.APP_PUBLIC_URL || "https://hsquare.in";

interface PageMeta {
  title: string;
  description: string;
  canonical: string;
  ogTitle?: string;
  ogDescription?: string;
}

const PAGE_META: Record<string, PageMeta> = {
  "/": {
    title: "Hsquare Hostel Mumbai | Hostel & Co-Living in Goregaon, Juhu & Andheri near NMIMS, Mithibai",
    description: "Hsquare Hostel — premium hostel & co-living in Goregaon, Juhu & Andheri Mumbai. Near NMIMS, Mithibai, Mukesh Patel. Meals, WiFi, 24/7 security. Book today!",
    canonical: `${SITE_URL}/`,
  },
  "/properties": {
    title: "Explore Properties - Student Hostels & PG in Mumbai | Hsquareliving",
    description: "Browse all Hsquare Living properties across Mumbai. Find fully furnished student hostels and PG near NMIMS, Mithibai, Mukesh Patel colleges. Compare rooms, prices & amenities.",
    canonical: `${SITE_URL}/properties`,
  },
  "/about": {
    title: "About Us - HSquare Living | Premium Student Accommodation Mumbai",
    description: "Learn about Hsquare Living — Mumbai's trusted student accommodation brand. Our mission is to provide safe, comfortable, and modern hostels near top colleges. Discover our story and values.",
    canonical: `${SITE_URL}/about`,
  },
  "/contact": {
    title: "Contact Us - Hsquare Hostel Mumbai | Get In Touch",
    description: "Get in touch with Hsquare Living for hostel bookings, queries, or support. Visit our offices in Goregaon, Juhu & Andheri Mumbai. Call +91-6372294625 or fill our contact form.",
    canonical: `${SITE_URL}/contact`,
  },
  "/faq": {
    title: "FAQs - Hsquare Living | Frequently Asked Questions",
    description: "Find answers to common questions about Hsquare Living hostels — booking process, payment options, meals, WiFi, security, check-in/check-out, and more.",
    canonical: `${SITE_URL}/faq`,
  },
  "/terms": {
    title: "Terms & Conditions - Hsquare Living",
    description: "Read the terms and conditions for booking and staying at Hsquare Living hostels in Mumbai. Understand our policies on payments, cancellations, house rules, and more.",
    canonical: `${SITE_URL}/terms`,
  },
  "/privacy": {
    title: "Privacy Policy - Hsquare Living",
    description: "Hsquare Living privacy policy. Learn how we collect, use, and protect your personal information when you use our hostel booking platform and services.",
    canonical: `${SITE_URL}/privacy`,
  },
  "/apply": {
    title: "Pre-Registration | Hsquare Hostel Mumbai - Student Accommodation",
    description: "Apply for student accommodation at Hsquare Living Mumbai. Fill out the pre-registration form to secure your hostel room near NMIMS, Mithibai, Mukesh Patel colleges.",
    canonical: `${SITE_URL}/apply`,
  },
  "/hostel-near-nmims": {
    title: "Hostel Near NMIMS Mumbai | Hsquare Living - Student PG & Accommodation",
    description: "Best hostel near NMIMS University Mumbai. Hsquare Living offers fully furnished PG accommodation with meals, WiFi, gym & 24/7 security. Walking distance from NMIMS campus.",
    canonical: `${SITE_URL}/hostel-near-nmims`,
  },
  "/hostel-near-mithibai": {
    title: "Hostel Near Mithibai College Mumbai | Hsquare Living - Student PG",
    description: "Affordable hostel near Mithibai College Mumbai. Hsquare Living provides premium student PG with meals, WiFi, laundry & security near Vile Parle campus.",
    canonical: `${SITE_URL}/hostel-near-mithibai`,
  },
  "/hostel-near-mukesh-patel": {
    title: "Hostel Near Mukesh Patel Mumbai | Hsquare Living - Student Accommodation",
    description: "Top-rated hostel near Mukesh Patel School of Technology Mumbai. Fully furnished rooms with meals, WiFi, gym. Safe student accommodation by Hsquare Living.",
    canonical: `${SITE_URL}/hostel-near-mukesh-patel`,
  },
  "/hostel-near-nm-college": {
    title: "Hostel Near NM College Mumbai | Hsquare Living - Student PG",
    description: "Premium hostel near NM College of Commerce Mumbai. Hsquare Living offers comfortable student PG with food, WiFi & 24/7 security in Vile Parle.",
    canonical: `${SITE_URL}/hostel-near-nm-college`,
  },
  "/hostel-near-dj-sanghvi": {
    title: "Hostel Near DJ Sanghvi College Mumbai | Hsquare Living - Student PG",
    description: "Best hostel near DJ Sanghvi College of Engineering Mumbai. Furnished rooms with meals, WiFi, gym & security. Book your student PG at Hsquare Living.",
    canonical: `${SITE_URL}/hostel-near-dj-sanghvi`,
  },
  "/hostel-near-whistling-woods": {
    title: "Hostel Near Whistling Woods Mumbai | Hsquare Living - Student PG",
    description: "Affordable hostel near Whistling Woods International Mumbai. Hsquare Living provides modern co-living spaces with meals, WiFi & amenities for film students.",
    canonical: `${SITE_URL}/hostel-near-whistling-woods`,
  },
  "/hostel-in-vile-parle": {
    title: "Best Hostel in Vile Parle Mumbai | Hsquare Living - Student Accommodation",
    description: "Best student hostel in Vile Parle Mumbai near Mithibai, NM College & Whistling Woods. Fully furnished rooms, meals, WiFi & 24/7 security by Hsquare Living.",
    canonical: `${SITE_URL}/hostel-in-vile-parle`,
  },
  "/hostel-in-goregaon": {
    title: "Best Hostel in Goregaon Mumbai | Hsquare Living - Student PG",
    description: "Top hostel in Goregaon East Mumbai near NMIMS & Mukesh Patel. Hsquare Living offers premium PG accommodation with meals, WiFi, gym & security.",
    canonical: `${SITE_URL}/hostel-in-goregaon`,
  },
};

function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function injectMetaTags(html: string, requestUrl: string): string {
  const pathname = requestUrl.split("?")[0].split("#")[0];

  const meta = PAGE_META[pathname];
  if (!meta) {
    if (pathname.startsWith("/properties/") && pathname !== "/properties") {
      const propMeta: PageMeta = {
        title: "Property Details | Hsquare Living - Student Hostel Mumbai",
        description: "View detailed information about this Hsquare Living property — room types, pricing, amenities, photos and availability. Book your student hostel in Mumbai.",
        canonical: `${SITE_URL}${pathname}`,
      };
      return applyMeta(html, propMeta);
    }
    return html;
  }

  return applyMeta(html, meta);
}

function applyMeta(html: string, meta: PageMeta): string {
  const title = escapeAttr(meta.title);
  const desc = escapeAttr(meta.description);
  const ogTitle = escapeAttr(meta.ogTitle || meta.title);
  const ogDesc = escapeAttr(meta.ogDescription || meta.description);
  const canonical = escapeAttr(meta.canonical);

  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${title}</title>`
  );

  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${desc}" />`
  );

  html = html.replace(
    /<link rel="canonical" href="[^"]*"[^>]*>/,
    `<link rel="canonical" href="${canonical}" id="canonical-link" />`
  );

  html = html.replace(
    /<meta property="og:title" content="[^"]*"\s*\/?>/,
    `<meta property="og:title" content="${ogTitle}" />`
  );

  html = html.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/,
    `<meta property="og:description" content="${ogDesc}" />`
  );

  html = html.replace(
    /<meta property="og:url" content="[^"]*"\s*\/?>/,
    `<meta property="og:url" content="${canonical}" />`
  );

  html = html.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:title" content="${ogTitle}" />`
  );

  html = html.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/?>/,
    `<meta name="twitter:description" content="${ogDesc}" />`
  );

  return html;
}
