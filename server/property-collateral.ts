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
      if (!url.startsWith("/api/") && !url.startsWith("/uploads/") && !url.startsWith("/public/") && !url.startsWith("/objects/")) {
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
// ===== Editorial landscape brochure (Arvane-inspired) =====
//
// Each page follows the same luxury-real-estate layout language:
//   - Cream canvas with generous whitespace
//   - Tiny uppercase eyebrow + thin gold accent rule
//   - Large serif headline on the left, with one italic accent word
//   - Editorial photography on the right, rounded corners
//   - Floating "card" overlay with key facts at the bottom of the image
//
// We use jsPDF's bundled `times` family for the serif headlines and
// `helvetica` for UI text, since true custom fonts aren't bundled.

function splitItalicAccent(headline: string): { lead: string; accent: string; tail: string } {
  // Pick the most evocative word in the headline to italicise.
  // We bias toward emotive nouns; if none match we italicise the last word.
  const preferred = ["trust", "elegance", "comfort", "calm", "home", "harmony", "living", "luxury", "belonging", "ease", "style", "premium", "connected", "included", "pricing"];
  const words = headline.trim().split(/\s+/);
  if (words.length < 2) return { lead: headline, accent: "", tail: "" };
  // Prefer the LAST evocative word in the headline (Arvane convention).
  let idx = -1;
  for (let i = words.length - 1; i >= 0; i--) {
    if (preferred.includes(words[i].toLowerCase().replace(/[^a-z]/g, ""))) { idx = i; break; }
  }
  if (idx === -1) idx = words.length - 1;
  return {
    lead: words.slice(0, idx).join(" ") + (idx > 0 ? " " : ""),
    accent: words[idx],
    tail: idx < words.length - 1 ? " " + words.slice(idx + 1).join(" ") : "",
  };
}

export async function generatePropertyBrochurePdf(propertyId: string): Promise<Buffer | null> {
  const data = await gatherPropertyData(propertyId);
  if (!data) return null;
  const { property, roomTypes, nearbyLocs, images } = data;

  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pw = doc.internal.pageSize.getWidth();   // 842
  const ph = doc.internal.pageSize.getHeight();  // 595
  const m = 48;
  const gutter = 32;
  const colW = (pw - m * 2 - gutter) / 2;
  const leftX = m;
  const rightX = m + colW + gutter;

  const setFill = (hex: string) => {
    const h = hex.replace("#", "");
    doc.setFillColor(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  };
  const setText = (hex: string) => {
    const h = hex.replace("#", "");
    doc.setTextColor(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  };
  const setDraw = (hex: string) => {
    const h = hex.replace("#", "");
    doc.setDrawColor(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  };

  const paintBackground = () => {
    setFill(COLOR_CREAM);
    doc.rect(0, 0, pw, ph, "F");
  };

  const drawHeader = () => {
    // Brand mark (small)
    try {
      doc.addImage(`data:image/png;base64,${HSQUARE_LOGO_BASE64}`, "PNG", m, m - 8, 22, 22);
    } catch {}
    setText(COLOR_CHARCOAL);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text("Hsquare", m + 28, m + 6);
    setText(COLOR_TAUPE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("PREMIUM STUDENT RESIDENCES", m + 28, m + 16);

    // Top-right meta
    setText(COLOR_TAUPE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Property Brochure  ·  ${new Date().getFullYear()}`, pw - m, m + 8, { align: "right" });
  };

  const drawEyebrow = (text: string, x: number, y: number) => {
    setFill(COLOR_GOLD);
    doc.rect(x, y - 4, 24, 1.5, "F");
    setText(COLOR_TAUPE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(text, x + 32, y);
  };

  const drawHeadline = (headline: string, x: number, y: number, maxW: number, size = 36): number => {
    const { lead, accent, tail } = splitItalicAccent(headline);
    setText(COLOR_CHARCOAL);
    doc.setFontSize(size);
    // We render line by line, mixing roman + italic for the accent.
    // jsPDF doesn't have a true mixed-style line layout, so we render
    // the lead, then italic accent, then tail using cursor advance via getTextWidth.
    const lineH = size * 1.05;
    let cursorX = x;
    let cursorY = y;

    const writeWord = (word: string, italic: boolean) => {
      doc.setFont("times", italic ? "italic" : "bold");
      const w = doc.getTextWidth(word);
      if (cursorX + w > x + maxW) {
        cursorX = x;
        cursorY += lineH;
      }
      doc.text(word, cursorX, cursorY);
      cursorX += w;
    };

    const tokens: { word: string; italic: boolean }[] = [];
    if (lead) lead.trim().split(/\s+/).forEach(w => tokens.push({ word: w + " ", italic: false }));
    if (accent) tokens.push({ word: accent + (tail ? " " : ""), italic: true });
    if (tail) tail.trim().split(/\s+/).forEach(w => tokens.push({ word: " " + w, italic: false }));

    tokens.forEach(t => writeWord(t.word, t.italic));
    return cursorY + 6;
  };

  // Rounded image: clip subsequent drawing to a rounded rect path, draw the
  // image inside that clip, then restore graphics state. This gives true
  // rounded corners on all four sides without double-stamping the image.
  const drawEditorialImage = (imgData: string | undefined, x: number, y: number, w: number, h: number, radius = 16) => {
    doc.saveGraphicsState();
    // Build the rounded-rect clipping path. We use the lower-level path API
    // because doc.roundedRect would fill/stroke; we want to discard.
    doc.roundedRect(x, y, w, h, radius, radius, undefined as unknown as string);
    // jsPDF's clip() restricts subsequent drawing to the most-recent path.
    (doc as unknown as { clip: () => void }).clip();
    (doc as unknown as { discardPath: () => void }).discardPath();

    if (imgData) {
      try {
        doc.addImage(imgData, "JPEG", x, y, w, h, undefined, "FAST");
      } catch {
        setFill("#E5DED2");
        doc.rect(x, y, w, h, "F");
      }
    } else {
      setFill("#E5DED2");
      doc.rect(x, y, w, h, "F");
      setText(COLOR_TAUPE);
      doc.setFont("times", "italic");
      doc.setFontSize(13);
      doc.text("Photography coming soon", x + w / 2, y + h / 2, { align: "center" });
    }
    doc.restoreGraphicsState();
  };

  // Floating fact card (Arvane-style overlay at bottom of image)
  const drawFactCard = (cells: { label: string; value: string }[], cta: string | null, x: number, y: number, w: number, h: number) => {
    setFill(COLOR_CREAM);
    doc.roundedRect(x, y, w, h, 14, 14, "F");
    // Subtle hairline border
    setDraw("#E8E1D2");
    doc.setLineWidth(0.7);
    doc.roundedRect(x, y, w, h, 14, 14, "S");

    const innerPad = 16;
    const cellW = (w - innerPad * 2 - (cta ? 110 : 0)) / cells.length;
    cells.forEach((cell, i) => {
      const cx = x + innerPad + cellW * i;
      setText(COLOR_TAUPE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text(cell.label.toUpperCase(), cx, y + 18);
      setText(COLOR_CHARCOAL);
      doc.setFont("times", "bold");
      doc.setFontSize(13);
      const vLines = doc.splitTextToSize(cell.value, cellW - 6);
      doc.text(vLines.slice(0, 1), cx, y + 36);
    });
    if (cta) {
      const btnW = 92, btnH = 30;
      const btnX = x + w - innerPad - btnW;
      const btnY = y + (h - btnH) / 2;
      setFill(COLOR_CHARCOAL);
      doc.roundedRect(btnX, btnY, btnW, btnH, 14, 14, "F");
      setText(COLOR_CREAM);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(cta, btnX + btnW / 2, btnY + btnH / 2 + 3, { align: "center" });
    }
  };

  const drawFooter = (pageLabel: string) => {
    setText(COLOR_TAUPE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`hsquare.in  ·  ${property.phone || "+91 98205 71032"}`, m, ph - 22);
    doc.text(pageLabel, pw - m, ph - 22, { align: "right" });
    setFill(COLOR_GOLD);
    doc.rect(m, ph - 32, 16, 1, "F");
  };

  // ============================================================
  // PAGE 1 — Hero / Cover (Arvane signature layout)
  // ============================================================
  paintBackground();
  drawHeader();

  // Right: editorial image
  const heroImgX = pw / 2 + 12;
  const heroImgY = m + 36;
  const heroImgW = pw - m - heroImgX;
  const heroImgH = ph - heroImgY - 80;
  drawEditorialImage(images[0], heroImgX, heroImgY, heroImgW, heroImgH, 18);

  // Floating fact card overlapping the bottom of the image
  const cardW = heroImgW * 0.92;
  const cardH = 64;
  const cardX = heroImgX + (heroImgW - cardW) / 2;
  const cardY = heroImgY + heroImgH - cardH / 2 - 6;
  drawFactCard(
    [
      { label: "Location", value: property.location || "Mumbai" },
      { label: "Property Type", value: (property.category || "Co-Living").replace(/_/g, " ") },
      { label: "Starts From", value: roomTypes && roomTypes.length ? `₹${Math.min(...roomTypes.map(r => r.basePrice || Infinity)).toLocaleString("en-IN")}` : "On Request" },
    ],
    "Enquire",
    cardX,
    cardY,
    cardW,
    cardH,
  );

  // Left: eyebrow + headline + body + meta
  const heroLeftX = m;
  const heroLeftW = pw / 2 - m - 24;
  drawEyebrow("PREMIUM STUDENT RESIDENCE", heroLeftX, m + 60);

  const heroHeadline = `Discover a home built on ${["trust", "comfort", "harmony"][Math.floor((property.id?.charCodeAt(0) || 0) % 3)]} and elegance.`;
  let nextY = drawHeadline(heroHeadline, heroLeftX, m + 110, heroLeftW, 32);

  setText(COLOR_TAUPE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const intro = property.description ||
    `${property.displayName || property.name} blends modern student living with seamless experiences — a calm address designed for focus, community, and the rhythm of academic life in ${property.location || "Mumbai"}.`;
  const introLines = doc.splitTextToSize(intro, heroLeftW);
  doc.text(introLines.slice(0, 5), heroLeftX, nextY + 8);
  nextY = nextY + 8 + introLines.slice(0, 5).length * 13;

  // Property name as serif sub-headline
  setText(COLOR_CHARCOAL);
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  const nameLines = doc.splitTextToSize(property.displayName || property.name || "", heroLeftW);
  doc.text(nameLines, heroLeftX, nextY + 26);
  nextY += 26 + nameLines.length * 22;

  // Address line
  if (property.address) {
    setText(COLOR_TAUPE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const addr = doc.splitTextToSize(property.address, heroLeftW);
    doc.text(addr.slice(0, 2), heroLeftX, nextY + 6);
  }

  drawFooter("01");

  // ============================================================
  // PAGE 2 — Overview & Highlights (image left, content right)
  // ============================================================
  doc.addPage();
  paintBackground();
  drawHeader();

  // Left: editorial image
  const p2ImgY = m + 36;
  const p2ImgH = ph - p2ImgY - 80;
  drawEditorialImage(images[1] || images[0], leftX, p2ImgY, colW, p2ImgH, 16);

  // Right: copy stack
  drawEyebrow("OVERVIEW", rightX, m + 60);
  let y2 = drawHeadline("A residence crafted for student living.", rightX, m + 96, colW, 24);

  setText(COLOR_TAUPE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const overviewBody = property.description ||
    "Designed with intention — every detail of this residence supports rest, study, and connection. Curated common areas, considered amenities, and a service team obsessed with the small things.";
  const overviewLines = doc.splitTextToSize(overviewBody, colW);
  doc.text(overviewLines.slice(0, 6), rightX, y2 + 6);
  y2 = y2 + 6 + overviewLines.slice(0, 6).length * 13 + 16;

  // Highlights block
  const highlights = (property.highlights || []).filter(Boolean).slice(0, 6);
  if (highlights.length) {
    setText(COLOR_CHARCOAL);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text("Property highlights", rightX, y2);
    y2 += 18;
    setText(COLOR_TAUPE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const h of highlights) {
      if (y2 > ph - 100) break;
      // Gold dot bullet
      setFill(COLOR_GOLD);
      doc.circle(rightX + 3, y2 - 3, 1.6, "F");
      setText(COLOR_CHARCOAL);
      const lines = doc.splitTextToSize(h, colW - 14);
      doc.text(lines.slice(0, 2), rightX + 12, y2);
      y2 += lines.slice(0, 2).length * 13 + 4;
    }
  }

  // Contact strip
  const contactBits = [
    property.location ? `${property.location}` : null,
    property.phone ? `${property.phone}` : null,
    property.email ? `${property.email}` : null,
  ].filter(Boolean).join("   ·   ");
  if (contactBits) {
    setFill("#F2EBDD");
    doc.roundedRect(rightX, ph - 90, colW, 28, 10, 10, "F");
    setText(COLOR_CHARCOAL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(contactBits, rightX + 14, ph - 72);
  }

  drawFooter("02");

  // ============================================================
  // PAGE 3 — Amenities (left) + Room Types & Pricing (right)
  // ============================================================
  doc.addPage();
  paintBackground();
  drawHeader();

  drawEyebrow("AMENITIES & FACILITIES", leftX, m + 60);
  let y3 = drawHeadline("Everything you need, included.", leftX, m + 96, colW, 22);

  const amenities = (property.amenities || []).filter(Boolean);
  setText(COLOR_CHARCOAL);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const amenityColW = colW / 2 - 8;
  let aCol = 0;
  let aY = y3 + 16;
  for (const a of amenities) {
    if (aY > ph - 80) break;
    const ax = leftX + aCol * (amenityColW + 16);
    setFill(COLOR_GOLD);
    doc.circle(ax + 2, aY - 3, 1.4, "F");
    setText(COLOR_CHARCOAL);
    const lines = doc.splitTextToSize(a, amenityColW - 12);
    doc.text(lines.slice(0, 1), ax + 10, aY);
    aCol = 1 - aCol;
    if (aCol === 0) aY += 15;
  }

  // Right column — room types & pricing as editorial cards
  drawEyebrow("ACCOMMODATION", rightX, m + 60);
  let y3r = drawHeadline("Room types & pricing.", rightX, m + 96, colW, 22);
  y3r += 12;

  const showRooms = (roomTypes || []).slice(0, 5);
  for (const rt of showRooms) {
    if (y3r > ph - 90) break;
    const rowH = 56;
    setFill("#F6F0E2");
    doc.roundedRect(rightX, y3r, colW, rowH, 10, 10, "F");
    setText(COLOR_CHARCOAL);
    doc.setFont("times", "bold");
    doc.setFontSize(13);
    doc.text(rt.customName || (rt.name || "").toString().replace(/_/g, " "), rightX + 14, y3r + 22);

    setText(COLOR_TAUPE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const meta = [
      rt.size ? rt.size : null,
      rt.occupancy ? `Occupancy ${rt.occupancy}` : null,
      rt.availableBeds != null ? `${rt.availableBeds} beds available` : null,
    ].filter(Boolean).join("   ·   ");
    if (meta) doc.text(meta, rightX + 14, y3r + 38);

    setText(COLOR_GOLD);
    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.text(`₹${(rt.basePrice || 0).toLocaleString("en-IN")}`, rightX + colW - 14, y3r + 26, { align: "right" });
    setText(COLOR_TAUPE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("per month", rightX + colW - 14, y3r + 38, { align: "right" });

    y3r += rowH + 8;
  }

  drawFooter("03");

  // ============================================================
  // PAGE 4 — Location & Closing CTA (image hero + editorial card)
  // ============================================================
  doc.addPage();
  paintBackground();
  drawHeader();

  // Top hero band image
  const p4ImgY = m + 36;
  const p4ImgH = ph * 0.5;
  drawEditorialImage(images[2] || images[0], leftX, p4ImgY, pw - m * 2, p4ImgH, 18);

  // Below: two columns — left location text, right nearby list
  let y4 = p4ImgY + p4ImgH + 28;
  drawEyebrow("LOCATION & NEIGHBOURHOOD", leftX, y4);
  drawHeadline("Perfectly connected.", leftX, y4 + 28, colW, 20);

  setText(COLOR_TAUPE);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const locBody = property.address || `${property.location || "Mumbai"} — minutes from Mumbai's leading colleges, transit, and dining.`;
  const locLines = doc.splitTextToSize(locBody, colW);
  doc.text(locLines.slice(0, 3), leftX, y4 + 60);

  // Right: nearby list
  const nearby = (nearbyLocs || []).slice(0, 6);
  let yN = y4 + 16;
  for (const n of nearby) {
    if (yN > ph - 80) break;
    setText(COLOR_CHARCOAL);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(n.placeName, rightX, yN);
    setText(COLOR_GOLD);
    doc.setFont("helvetica", "normal");
    doc.text(n.distance || "", rightX + colW, yN, { align: "right" });
    setDraw("#E8E1D2");
    doc.setLineWidth(0.5);
    doc.line(rightX, yN + 4, rightX + colW, yN + 4);
    yN += 16;
  }

  // CTA strip across the bottom
  setFill(COLOR_CHARCOAL);
  doc.roundedRect(m, ph - 60, pw - m * 2, 32, 14, 14, "F");
  setText(COLOR_CREAM);
  doc.setFont("times", "bold");
  doc.setFontSize(13);
  doc.text("Reserve your residence today", m + 18, ph - 39);
  setText(COLOR_GOLD);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`hsquare.in   ·   ${property.phone || "+91 98205 71032"}   ·   ${property.email || "stay@hsquareliving.com"}`, pw - m - 18, ph - 39, { align: "right" });

  drawFooter("04");

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
