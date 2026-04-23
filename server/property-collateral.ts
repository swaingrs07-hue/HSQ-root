import { jsPDF } from "jspdf";
import PptxGenJS from "pptxgenjs";

type PptxCell = { text: string; options: Record<string, unknown> };
type PptxRow = PptxCell[];

const PptxCtor: typeof PptxGenJS =
  (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default || PptxGenJS;
import { storage } from "./storage";
import { HSQUARE_LOGO_BASE64 } from "./logo-base64";
import type { Property } from "@shared/schema";

// Luxury palette
const COLOR_CHARCOAL = "#1A1A1A";
const COLOR_CREAM = "#FDFCF9";
const COLOR_TAUPE = "#8B7D6B";
const COLOR_GOLD = "#D4AF37";

function parseImages(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter(s => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function pickImages(p: Property): string[] {
  const all: string[] = [];
  if (p.imageUrl) all.push(p.imageUrl);
  all.push(...parseImages(p.tourOverviewImages));
  all.push(...parseImages(p.tourRoomsImages));
  all.push(...parseImages(p.tourAmenitiesImages));
  all.push(...parseImages(p.tourLocationImages));
  return Array.from(new Set(all)).slice(0, 8);
}

const ALLOWED_IMAGE_HOSTS = new Set([
  "storage.googleapis.com",
  "lh3.googleusercontent.com",
  "images.unsplash.com",
  "res.cloudinary.com",
  "hsquare.in",
  "www.hsquare.in",
]);

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^::1$|^fe80:|^fc00:|^fd00:/i.test(h)) return true;
  return false;
}

async function loadImageAsDataUrl(url: string): Promise<string | null> {
  try {
    if (!url || typeof url !== "string") return null;
    let target: URL;
    if (/^https?:\/\//i.test(url)) {
      target = new URL(url);
      if (!ALLOWED_IMAGE_HOSTS.has(target.hostname.toLowerCase()) || isPrivateHost(target.hostname)) {
        return null;
      }
    } else {
      // Relative path: only allow internal /api/uploads/* or /uploads/* references.
      // Always resolve against loopback (this same server) — never trust caller-provided
      // baseUrl/x-forwarded-host headers which could redirect us to attacker-controlled hosts.
      if (!url.startsWith("/api/") && !url.startsWith("/uploads/") && !url.startsWith("/public/")) {
        return null;
      }
      const port = process.env.PORT || "5000";
      target = new URL(url, `http://127.0.0.1:${port}`);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(target.toString(), { signal: controller.signal, redirect: "error" });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength > 8 * 1024 * 1024) return null;
    return `data:${ct};base64,${Buffer.from(ab).toString("base64")}`;
  } catch {
    return null;
  }
}

async function gatherPropertyData(propertyId: string) {
  const property = await storage.getPropertyByIdOrSlug(propertyId);
  if (!property) return null;

  const [roomTypes, nearbyLocs] = await Promise.all([
    storage.getRoomTypesByProperty(property.id),
    storage.getNearbyLocationsByProperty(property.id),
  ]);

  const imageUrls = pickImages(property);
  const images = (await Promise.all(imageUrls.map(u => loadImageAsDataUrl(u))))
    .filter((s): s is string => !!s);

  return { property, roomTypes, nearbyLocs, images };
}

// ----- PDF -----
export async function generatePropertyBrochurePdf(propertyId: string): Promise<Buffer | null> {
  const data = await gatherPropertyData(propertyId);
  if (!data) return null;
  const { property, roomTypes, nearbyLocs, images } = data;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 40;

  const setRgb = (hex: string, fn: (r: number, g: number, b: number) => void) => {
    const h = hex.replace("#", "");
    fn(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  };

  // ========== Cover Page ==========
  setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(0, 0, pw, ph, "F");

  if (images[0]) {
    try {
      doc.addImage(images[0], "JPEG", 0, 0, pw, ph * 0.65, undefined, "FAST");
    } catch {}
  }

  // Dark gradient overlay simulation
  setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(0, ph * 0.55, pw, ph * 0.45, "F");

  // Gold accent line
  setRgb(COLOR_GOLD, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(m, ph * 0.62, 60, 2, "F");

  // Brand mark
  try {
    doc.addImage(`data:image/png;base64,${HSQUARE_LOGO_BASE64}`, "PNG", m, ph * 0.66, 36, 36);
  } catch {}

  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("HSQUARE LIVING  ·  PREMIUM STUDENT RESIDENCES", m + 48, ph * 0.685);

  setRgb(COLOR_CREAM, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(34);
  doc.setFont("helvetica", "bold");
  const title = (property.displayName || property.name || "").toUpperCase();
  const titleLines = doc.splitTextToSize(title, pw - m * 2);
  doc.text(titleLines, m, ph * 0.78);

  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(property.location || "", m, ph * 0.82 + titleLines.length * 12);
  if (property.address) {
    doc.text(doc.splitTextToSize(property.address, pw - m * 2), m, ph * 0.84 + titleLines.length * 12);
  }

  setRgb(COLOR_GOLD, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(8);
  doc.text("PROPERTY BROCHURE  ·  " + new Date().getFullYear(), m, ph - m);

  // ========== Page 2: Overview ==========
  doc.addPage();
  setRgb(COLOR_CREAM, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(0, 0, pw, ph, "F");

  let y = m + 10;
  setRgb(COLOR_GOLD, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(m, y, 40, 2, "F");
  y += 18;

  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("OVERVIEW", m, y);
  y += 16;

  setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  const heading = doc.splitTextToSize(property.displayName || property.name || "", pw - m * 2);
  doc.text(heading, m, y);
  y += heading.length * 22 + 6;

  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (property.location) { doc.text(`Location  ·  ${property.location}`, m, y); y += 14; }
  if (property.address) {
    const addr = doc.splitTextToSize(`Address  ·  ${property.address}`, pw - m * 2);
    doc.text(addr, m, y); y += addr.length * 12 + 2;
  }
  if (property.phone) { doc.text(`Contact  ·  ${property.phone}`, m, y); y += 14; }
  if (property.email) { doc.text(`Email  ·  ${property.email}`, m, y); y += 14; }
  y += 10;

  // Highlights
  const highlights = (property.highlights || []).filter(Boolean);
  if (highlights.length) {
    setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setTextColor(r, g, b));
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("Property Highlights", m, y); y += 16;
    setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    for (const h of highlights.slice(0, 8)) {
      const lines = doc.splitTextToSize(`•  ${h}`, pw - m * 2);
      doc.text(lines, m, y);
      y += lines.length * 13;
    }
    y += 8;
  }

  // Hero image
  if (images[1] && y < ph - 220) {
    try {
      doc.addImage(images[1], "JPEG", m, y, pw - m * 2, 200, undefined, "FAST");
    } catch {}
    y += 210;
  }

  // ========== Page 3: Amenities & Room Types ==========
  doc.addPage();
  setRgb(COLOR_CREAM, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(0, 0, pw, ph, "F");

  y = m + 10;
  setRgb(COLOR_GOLD, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(m, y, 40, 2, "F");
  y += 18;
  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(9);
  doc.text("AMENITIES & FACILITIES", m, y);
  y += 18;

  setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("What's Included", m, y); y += 22;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  const amenities = (property.amenities || []).filter(Boolean);
  const colW = (pw - m * 2 - 20) / 2;
  let col = 0; let yA = y;
  for (const a of amenities) {
    const x = m + col * (colW + 20);
    doc.text(`•  ${a}`, x, yA);
    col = 1 - col;
    if (col === 0) yA += 14;
    if (yA > ph - 180) break;
  }
  y = yA + 24;

  if (roomTypes && roomTypes.length) {
    setRgb(COLOR_GOLD, (r, g, b) => doc.setFillColor(r, g, b));
    doc.rect(m, y, 40, 2, "F");
    y += 18;
    setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
    doc.setFontSize(9);
    doc.text("ACCOMMODATION OPTIONS", m, y); y += 18;
    setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setTextColor(r, g, b));
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Room Types & Pricing", m, y); y += 22;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    for (const rt of roomTypes.slice(0, 6)) {
      if (y > ph - m - 30) { doc.addPage(); y = m + 10; setRgb(COLOR_CREAM, (r,g,b)=>doc.setFillColor(r,g,b)); doc.rect(0,0,pw,ph,"F"); }
      setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setTextColor(r, g, b));
      doc.setFont("helvetica", "bold");
      doc.text(rt.customName || (rt.name || "").toString().replace(/_/g, " "), m, y);
      setRgb(COLOR_GOLD, (r, g, b) => doc.setTextColor(r, g, b));
      doc.text(`₹${(rt.basePrice || 0).toLocaleString("en-IN")} / month`, pw - m, y, { align: "right" });
      y += 14;
      setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const meta = [
        rt.size ? `Size: ${rt.size}` : null,
        rt.occupancy ? `Occupancy: ${rt.occupancy}` : null,
        rt.availableBeds != null ? `Available beds: ${rt.availableBeds}` : null,
      ].filter(Boolean).join("   ·   ");
      if (meta) { doc.text(meta, m, y); y += 14; }
      doc.setFontSize(11);
      y += 4;
    }
  }

  // ========== Page 4: Location & Closing ==========
  doc.addPage();
  setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(0, 0, pw, ph, "F");

  if (images[2]) {
    try { doc.addImage(images[2], "JPEG", 0, 0, pw, 280, undefined, "FAST"); } catch {}
  }
  setRgb(COLOR_CHARCOAL, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(0, 240, pw, ph - 240, "F");

  y = 320;
  setRgb(COLOR_GOLD, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(m, y, 40, 2, "F");
  y += 18;
  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(9);
  doc.text("LOCATION & NEIGHBOURHOOD", m, y);
  y += 18;
  setRgb(COLOR_CREAM, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Perfectly Connected", m, y); y += 22;

  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const n of (nearbyLocs || []).slice(0, 10)) {
    if (y > ph - 120) break;
    doc.text(`•  ${n.placeName}`, m, y);
    setRgb(COLOR_GOLD, (r, g, b) => doc.setTextColor(r, g, b));
    doc.text(n.distance || "", pw - m, y, { align: "right" });
    setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
    y += 14;
  }

  // Footer CTA
  setRgb(COLOR_GOLD, (r, g, b) => doc.setFillColor(r, g, b));
  doc.rect(m, ph - 80, pw - m * 2, 1, "F");
  setRgb(COLOR_CREAM, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Reserve your residence today", m, ph - 56);
  setRgb(COLOR_TAUPE, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Visit hsquare.in  ·  " + (property.phone || "+91 9876543210") + "  ·  " + (property.email || "stay@hsquareliving.com"), m, ph - 40);
  setRgb(COLOR_GOLD, (r, g, b) => doc.setTextColor(r, g, b));
  doc.setFontSize(8);
  doc.text("© Hsquareliving Pvt Ltd  ·  Generated " + new Date().toLocaleDateString("en-IN"), m, ph - 22);

  return Buffer.from(doc.output("arraybuffer"));
}

// ----- PPT -----
export async function generatePropertyBrochurePpt(propertyId: string): Promise<Buffer | null> {
  const data = await gatherPropertyData(propertyId);
  if (!data) return null;
  const { property, roomTypes, nearbyLocs, images } = data;

  const pres = new PptxCtor();
  pres.layout = "LAYOUT_WIDE";
  pres.title = property.displayName || property.name || "Hsquare Property";
  pres.company = "Hsquareliving";

  const SLIDE_W = 13.333;
  const SLIDE_H = 7.5;

  // Slide 1 — Cover
  const s1 = pres.addSlide();
  s1.background = { color: COLOR_CHARCOAL.replace("#", "") };
  if (images[0]) {
    s1.addImage({ data: images[0], x: 0, y: 0, w: SLIDE_W, h: SLIDE_H * 0.62, sizing: { type: "cover", w: SLIDE_W, h: SLIDE_H * 0.62 } });
  }
  s1.addShape(pres.ShapeType.rect, { x: 0, y: SLIDE_H * 0.55, w: SLIDE_W, h: SLIDE_H * 0.45, fill: { color: COLOR_CHARCOAL.replace("#", "") }, line: { color: COLOR_CHARCOAL.replace("#", ""), width: 0 } });
  s1.addShape(pres.ShapeType.rect, { x: 0.6, y: SLIDE_H * 0.6, w: 0.7, h: 0.04, fill: { color: COLOR_GOLD.replace("#", "") }, line: { color: COLOR_GOLD.replace("#", ""), width: 0 } });
  s1.addText("HSQUARE LIVING  ·  PREMIUM STUDENT RESIDENCES", {
    x: 0.6, y: SLIDE_H * 0.62, w: 12, h: 0.3, fontSize: 11, color: COLOR_TAUPE.replace("#", ""), fontFace: "Helvetica",
  });
  s1.addText((property.displayName || property.name || "").toUpperCase(), {
    x: 0.6, y: SLIDE_H * 0.68, w: 12, h: 1.2, fontSize: 44, bold: true, color: COLOR_CREAM.replace("#", ""), fontFace: "Helvetica",
  });
  s1.addText(property.location || "", {
    x: 0.6, y: SLIDE_H * 0.86, w: 12, h: 0.4, fontSize: 14, color: COLOR_TAUPE.replace("#", ""), fontFace: "Helvetica",
  });
  s1.addText("PROPERTY BROCHURE  ·  " + new Date().getFullYear(), {
    x: 0.6, y: SLIDE_H - 0.4, w: 6, h: 0.3, fontSize: 9, color: COLOR_GOLD.replace("#", ""),
  });

  // Slide 2 — Overview
  const s2 = pres.addSlide();
  s2.background = { color: COLOR_CREAM.replace("#", "") };
  s2.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.55, w: 0.6, h: 0.04, fill: { color: COLOR_GOLD.replace("#", "") }, line: { color: COLOR_GOLD.replace("#", ""), width: 0 } });
  s2.addText("OVERVIEW", { x: 0.6, y: 0.65, w: 6, h: 0.3, fontSize: 11, color: COLOR_TAUPE.replace("#", ""), bold: false });
  s2.addText(property.displayName || property.name || "", { x: 0.6, y: 0.95, w: 8.5, h: 0.9, fontSize: 32, bold: true, color: COLOR_CHARCOAL.replace("#", "") });
  const overviewLines: string[] = [];
  if (property.location) overviewLines.push(`Location · ${property.location}`);
  if (property.address) overviewLines.push(`Address · ${property.address}`);
  if (property.phone) overviewLines.push(`Phone · ${property.phone}`);
  if (property.email) overviewLines.push(`Email · ${property.email}`);
  s2.addText(overviewLines.join("\n"), { x: 0.6, y: 2.0, w: 8.5, h: 1.5, fontSize: 13, color: COLOR_TAUPE.replace("#", ""), valign: "top", lineSpacingMultiple: 1.4 });

  const highlights = (property.highlights || []).filter(Boolean).slice(0, 6);
  if (highlights.length) {
    s2.addText("Property Highlights", { x: 0.6, y: 3.6, w: 8.5, h: 0.5, fontSize: 16, bold: true, color: COLOR_CHARCOAL.replace("#", "") });
    s2.addText(highlights.map(h => ({ text: h, options: { bullet: { code: "25CF" }, color: COLOR_CHARCOAL.replace("#", ""), fontSize: 12 } })),
      { x: 0.6, y: 4.1, w: 8.5, h: 3, color: COLOR_TAUPE.replace("#", ""), fontSize: 12, valign: "top" });
  }

  if (images[1]) {
    s2.addImage({ data: images[1], x: 9.4, y: 0.95, w: 3.4, h: 5.6, sizing: { type: "cover", w: 3.4, h: 5.6 } });
  }

  // Slide 3 — Amenities
  const s3 = pres.addSlide();
  s3.background = { color: COLOR_CREAM.replace("#", "") };
  s3.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.55, w: 0.6, h: 0.04, fill: { color: COLOR_GOLD.replace("#", "") }, line: { color: COLOR_GOLD.replace("#", ""), width: 0 } });
  s3.addText("AMENITIES & FACILITIES", { x: 0.6, y: 0.65, w: 8, h: 0.3, fontSize: 11, color: COLOR_TAUPE.replace("#", "") });
  s3.addText("What's Included", { x: 0.6, y: 0.95, w: 12, h: 0.9, fontSize: 32, bold: true, color: COLOR_CHARCOAL.replace("#", "") });

  const amenities = (property.amenities || []).filter(Boolean);
  const half = Math.ceil(amenities.length / 2);
  const left = amenities.slice(0, half);
  const right = amenities.slice(half);
  s3.addText(left.map(a => ({ text: a, options: { bullet: { code: "25CF" }, color: COLOR_GOLD.replace("#", ""), fontSize: 13 } })),
    { x: 0.6, y: 2.1, w: 6, h: 4.8, color: COLOR_CHARCOAL.replace("#", ""), fontSize: 13, valign: "top", lineSpacingMultiple: 1.5 });
  if (right.length) {
    s3.addText(right.map(a => ({ text: a, options: { bullet: { code: "25CF" }, color: COLOR_GOLD.replace("#", ""), fontSize: 13 } })),
      { x: 7, y: 2.1, w: 6, h: 4.8, color: COLOR_CHARCOAL.replace("#", ""), fontSize: 13, valign: "top", lineSpacingMultiple: 1.5 });
  }

  // Slide 4 — Room types
  if (roomTypes && roomTypes.length) {
    const s4 = pres.addSlide();
    s4.background = { color: COLOR_CHARCOAL.replace("#", "") };
    s4.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.55, w: 0.6, h: 0.04, fill: { color: COLOR_GOLD.replace("#", "") }, line: { color: COLOR_GOLD.replace("#", ""), width: 0 } });
    s4.addText("ACCOMMODATION", { x: 0.6, y: 0.65, w: 8, h: 0.3, fontSize: 11, color: COLOR_TAUPE.replace("#", "") });
    s4.addText("Room Types & Pricing", { x: 0.6, y: 0.95, w: 12, h: 0.9, fontSize: 32, bold: true, color: COLOR_CREAM.replace("#", "") });

    const rows: PptxRow[] = [[
      { text: "ROOM TYPE", options: { bold: true, color: COLOR_GOLD.replace("#", ""), fontSize: 11, fill: { color: "0F0F0F" } } },
      { text: "OCCUPANCY", options: { bold: true, color: COLOR_GOLD.replace("#", ""), fontSize: 11, fill: { color: "0F0F0F" } } },
      { text: "SIZE", options: { bold: true, color: COLOR_GOLD.replace("#", ""), fontSize: 11, fill: { color: "0F0F0F" } } },
      { text: "AVAILABLE", options: { bold: true, color: COLOR_GOLD.replace("#", ""), fontSize: 11, fill: { color: "0F0F0F" } } },
      { text: "PRICE / MONTH", options: { bold: true, color: COLOR_GOLD.replace("#", ""), fontSize: 11, fill: { color: "0F0F0F" } } },
    ]];
    for (const rt of roomTypes.slice(0, 8)) {
      rows.push([
        { text: rt.customName || (rt.name || "").toString().replace(/_/g, " "), options: { color: COLOR_CREAM.replace("#", ""), fontSize: 12, bold: true } },
        { text: String(rt.occupancy ?? "—"), options: { color: COLOR_TAUPE.replace("#", ""), fontSize: 12 } },
        { text: rt.size || "—", options: { color: COLOR_TAUPE.replace("#", ""), fontSize: 12 } },
        { text: String(rt.availableBeds ?? "—"), options: { color: COLOR_TAUPE.replace("#", ""), fontSize: 12 } },
        { text: `₹${(rt.basePrice || 0).toLocaleString("en-IN")}`, options: { color: COLOR_GOLD.replace("#", ""), fontSize: 12, bold: true } },
      ]);
    }
    s4.addTable(rows, {
      x: 0.6, y: 2.1, w: 12.1, colW: [3.4, 1.8, 2.3, 2.0, 2.6],
      border: { type: "solid", color: "1F1F1F", pt: 1 },
      rowH: 0.5,
    });
  }

  // Slide 5 — Location
  const s5 = pres.addSlide();
  s5.background = { color: COLOR_CREAM.replace("#", "") };
  if (images[2]) {
    s5.addImage({ data: images[2], x: 6.6, y: 0, w: 6.733, h: SLIDE_H, sizing: { type: "cover", w: 6.733, h: SLIDE_H } });
  }
  s5.addShape(pres.ShapeType.rect, { x: 0.6, y: 0.55, w: 0.6, h: 0.04, fill: { color: COLOR_GOLD.replace("#", "") }, line: { color: COLOR_GOLD.replace("#", ""), width: 0 } });
  s5.addText("LOCATION", { x: 0.6, y: 0.65, w: 5, h: 0.3, fontSize: 11, color: COLOR_TAUPE.replace("#", "") });
  s5.addText("Perfectly Connected", { x: 0.6, y: 0.95, w: 5.8, h: 0.9, fontSize: 28, bold: true, color: COLOR_CHARCOAL.replace("#", "") });
  const nearby = (nearbyLocs || []).slice(0, 8);
  s5.addText(
    nearby.length
      ? nearby.map(n => ({ text: `${n.placeName}   —   ${n.distance || ""}`, options: { color: COLOR_CHARCOAL.replace("#", ""), fontSize: 12, bullet: { code: "25CF" } } }))
      : [{ text: property.address || "Premium location", options: { color: COLOR_CHARCOAL.replace("#", ""), fontSize: 12 } }],
    { x: 0.6, y: 2.1, w: 5.8, h: 4.8, color: COLOR_TAUPE.replace("#", ""), fontSize: 12, valign: "top", lineSpacingMultiple: 1.5 }
  );

  // Slide 6 — CTA
  const s6 = pres.addSlide();
  s6.background = { color: COLOR_CHARCOAL.replace("#", "") };
  s6.addShape(pres.ShapeType.rect, { x: SLIDE_W / 2 - 0.4, y: 2.4, w: 0.8, h: 0.04, fill: { color: COLOR_GOLD.replace("#", "") }, line: { color: COLOR_GOLD.replace("#", ""), width: 0 } });
  s6.addText("Reserve Your Residence", { x: 0, y: 2.7, w: SLIDE_W, h: 1.0, fontSize: 40, bold: true, color: COLOR_CREAM.replace("#", ""), align: "center" });
  s6.addText(property.displayName || property.name || "", { x: 0, y: 3.7, w: SLIDE_W, h: 0.5, fontSize: 16, color: COLOR_TAUPE.replace("#", ""), align: "center" });
  s6.addText(`hsquare.in   ·   ${property.phone || "+91 9876543210"}   ·   ${property.email || "stay@hsquareliving.com"}`, {
    x: 0, y: 4.5, w: SLIDE_W, h: 0.5, fontSize: 14, color: COLOR_GOLD.replace("#", ""), align: "center",
  });
  s6.addText("© Hsquareliving Pvt Ltd", { x: 0, y: SLIDE_H - 0.5, w: SLIDE_W, h: 0.3, fontSize: 9, color: COLOR_TAUPE.replace("#", ""), align: "center" });

  const out = await pres.write({ outputType: "nodebuffer" });
  return out as Buffer;
}

export function getPropertyDownloadFilename(property: Property, format: "pdf" | "pptx"): string {
  const safe = (property.displayName || property.name || "property")
    .replace(/[^a-zA-Z0-9\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return `hsquare-${safe}-brochure.${format}`;
}
