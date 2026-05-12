/**
 * scripts/generate-manual.ts
 * Run:  npx tsx scripts/generate-manual.ts
 * Output: public/hsquareliving-user-manual.pdf
 */
import { jsPDF } from "jspdf";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

// ─── Colours ──────────────────────────────────────────────────────────────────
type RGB = [number, number, number];
const GOLD: RGB     = [197, 160,  89];
const DARK: RGB     = [  5,   5,   5];
const DARK2: RGB    = [ 18,  22,  32];
const WHITE: RGB    = [255, 255, 255];
const S100: RGB     = [241, 245, 249];
const S200: RGB     = [226, 232, 240];
const S400: RGB     = [148, 163, 184];
const S500: RGB     = [100, 116, 139];
const S700: RGB     = [ 51,  65,  85];
const S900: RGB     = [ 15,  23,  42];
const INDIGO: RGB   = [ 79,  70, 229];
const GREEN: RGB    = [ 22, 163,  74];
const AMBER: RGB    = [180,  83,   9];
const RED: RGB      = [185,  28,  28];
const TIP_BG: RGB   = [255, 251, 235];
const WARN_BG: RGB  = [254, 242, 242];
const INFO_BG: RGB  = [238, 242, 255];
const TIP_BD: RGB   = [217, 119,   6];
const WARN_BD: RGB  = [220,  38,  38];
const INFO_BD: RGB  = [ 99, 102, 241];
const NOTE_BG: RGB  = [240, 253, 244];
const NOTE_BD: RGB  = [ 22, 163,  74];

// ─── Page geometry ─────────────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const ML = 18;
const MR = 18;
const CW = PAGE_W - ML - MR;  // 174 mm content width
const MT = 24;
const MB = 16;
const FOOTER_Y = PAGE_H - 10;
const BOTTOM_LIMIT = PAGE_H - MB - 18; // leave room for footer

// ─── State ─────────────────────────────────────────────────────────────────────
let doc: jsPDF;
let y = MT;
let logoB64 = "";

interface TocEntry { label: string; level: number; page: number; }
const toc: TocEntry[] = [];
let tocPageStart = 2;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function rgb(c: RGB) { doc.setTextColor(c[0], c[1], c[2]); }
function fill(c: RGB) { doc.setFillColor(c[0], c[1], c[2]); }
function draw(c: RGB) { doc.setDrawColor(c[0], c[1], c[2]); }

function addPage() {
  doc.addPage("a4");
  y = MT;
  drawPageFooter();
}

function drawPageFooter() {
  const p = doc.getCurrentPageInfo().pageNumber;
  // thin gold rule
  fill(GOLD);  draw(GOLD);
  doc.rect(ML, FOOTER_Y - 2, CW, 0.4, "F");
  // left label
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  rgb(S400);
  doc.text("Hsquareliving Pvt Ltd — Confidential", ML, FOOTER_Y + 2);
  // right page number
  doc.text(`Page ${p}`, PAGE_W - MR, FOOTER_Y + 2, { align: "right" });
}

function checkPageBreak(needed = 12) {
  if (y + needed > BOTTOM_LIMIT) { addPage(); }
}

/** Thin gold horizontal divider line */
function rule(marginV = 4) {
  y += marginV;
  fill(GOLD); draw(GOLD);
  doc.rect(ML, y, CW, 0.3, "F");
  y += marginV;
}

/** Full-width dark section divider page */
function sectionDivider(
  partNum: string,
  title: string,
  subtitle: string,
  roles: string[],
  svgLines: (xBase: number, yBase: number) => void
) {
  addPage();
  const p = doc.getCurrentPageInfo().pageNumber;
  toc.push({ label: `${partNum} — ${title}`, level: 0, page: p });

  // dark bg
  fill(DARK2); draw(DARK2);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // gold top accent bar
  fill(GOLD);
  doc.rect(0, 0, PAGE_W, 3, "F");

  // left accent stripe
  fill(GOLD);
  doc.rect(0, 0, 6, PAGE_H, "F");

  // inline SVG illustration area (top-right quadrant)
  svgLines(PAGE_W - 65, 40);

  // Part label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(partNum.toUpperCase(), ML + 10, 55, { charSpace: 2 });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  const titleLines = doc.splitTextToSize(title, 120);
  doc.text(titleLines, ML + 10, 70);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(S400[0], S400[1], S400[2]);
  const subLines = doc.splitTextToSize(subtitle, 130);
  doc.text(subLines, ML + 10, 70 + titleLines.length * 11 + 6);

  // Role pills
  if (roles.length) {
    let rx = ML + 10;
    const ry = PAGE_H - 42;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    roles.forEach((r) => {
      const tw = doc.getTextWidth(r) + 8;
      fill(GOLD); draw(GOLD);
      doc.roundedRect(rx, ry, tw, 7, 2, 2, "F");
      doc.setTextColor(DARK[0], DARK[1], DARK[2]);
      doc.text(r, rx + 4, ry + 5.2);
      rx += tw + 4;
    });
  }

  // Bottom subtitle bar
  fill(DARK); draw(DARK);
  doc.rect(0, PAGE_H - 22, PAGE_W, 22, "F");
  fill(GOLD);
  doc.rect(0, PAGE_H - 22, PAGE_W, 0.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(S400[0], S400[1], S400[2]);
  doc.text("Hsquareliving Staff User Manual  ·  v1.0  ·  May 2026", ML + 10, PAGE_H - 10);
}

function heading1(text: string, tocEntry = true) {
  checkPageBreak(16);
  if (tocEntry) {
    const p = doc.getCurrentPageInfo().pageNumber;
    toc.push({ label: text, level: 1, page: p });
  }
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  rgb(S900);
  doc.text(text, ML, y);
  y += 2;
  fill(GOLD); draw(GOLD);
  doc.rect(ML, y, CW, 0.5, "F");
  y += 5;
}

function heading2(text: string, tocEntry = true) {
  checkPageBreak(14);
  if (tocEntry) {
    const p = doc.getCurrentPageInfo().pageNumber;
    toc.push({ label: `  ${text}`, level: 2, page: p });
  }
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  rgb(S700);
  doc.text(text, ML, y);
  y += 5;
}

function heading3(text: string) {
  checkPageBreak(10);
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  rgb(S700);
  doc.text(text, ML, y);
  y += 4;
}

function body(text: string, indent = 0) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  rgb(S700);
  const lines = doc.splitTextToSize(text, CW - indent);
  lines.forEach((line: string) => {
    checkPageBreak(6);
    doc.text(line, ML + indent, y);
    y += 5;
  });
  y += 1;
}

function bullet(text: string, indent = 4) {
  checkPageBreak(6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  rgb(S700);
  const maxW = CW - indent - 5;
  const lines = doc.splitTextToSize(text, maxW);
  // gold bullet dot
  fill(GOLD);
  doc.circle(ML + indent, y - 1.2, 1, "F");
  doc.text(lines[0], ML + indent + 4, y);
  lines.slice(1).forEach((l: string) => {
    y += 5;
    checkPageBreak(6);
    doc.text(l, ML + indent + 4, y);
  });
  y += 5;
}

function numberedStep(num: number, title: string, desc: string) {
  checkPageBreak(18);
  y += 1;
  // circle
  fill(INDIGO); draw(INDIGO);
  doc.circle(ML + 5, y - 1, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(String(num), ML + 5, y + 0.8, { align: "center" });
  // title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  rgb(S900);
  doc.text(title, ML + 13, y);
  y += 5;
  // desc
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  rgb(S500);
  const dl = doc.splitTextToSize(desc, CW - 13);
  dl.forEach((l: string) => { checkPageBreak(6); doc.text(l, ML + 13, y); y += 4.5; });
  y += 2;
}

function callout(type: "tip" | "warn" | "info" | "note", text: string) {
  const configs = {
    tip:  { bg: TIP_BG,  bd: TIP_BD,  label: "TIP",     labelC: AMBER },
    warn: { bg: WARN_BG, bd: WARN_BD,  label: "WARNING", labelC: RED   },
    info: { bg: INFO_BG, bd: INFO_BD,  label: "INFO",    labelC: INDIGO },
    note: { bg: NOTE_BG, bd: NOTE_BD,  label: "NOTE",    labelC: GREEN  },
  };
  const cfg = configs[type];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(text, CW - 22);
  const boxH = lines.length * 4.8 + 10;
  checkPageBreak(boxH + 4);
  y += 2;
  fill(cfg.bg); draw(cfg.bd);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, CW, boxH, 2, 2, "FD");
  // left accent
  fill(cfg.bd);
  doc.rect(ML, y, 2.5, boxH, "F");
  // label
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(cfg.labelC[0], cfg.labelC[1], cfg.labelC[2]);
  doc.text(`▶ ${cfg.label}`, ML + 6, y + 5.5);
  // text
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  rgb(S700);
  lines.forEach((l: string, i: number) => doc.text(l, ML + 6, y + 10 + i * 4.8));
  y += boxH + 4;
}

function roleBadges(roles: string[]) {
  y += 1;
  let rx = ML;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  roles.forEach((r) => {
    const tw = doc.getTextWidth(r) + 7;
    if (r === "All Staff" || r === "All Roles") {
      fill(GREEN); draw(GREEN);
    } else if (r === "Superadmin" || r === "Admin") {
      fill(INDIGO); draw(INDIGO);
    } else if (r === "Sales Executive") {
      fill([234, 88, 12]); draw([234, 88, 12]);
    } else if (r === "Frontdesk") {
      fill([14, 116, 144]); draw([14, 116, 144]);
    } else if (r.startsWith("Hotel")) {
      fill(GOLD); draw(GOLD);
    } else {
      fill(S500); draw(S500);
    }
    doc.roundedRect(rx, y, tw, 5.5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    if (r === "Hotel Admin" || r === "Hotel Staff") doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.text(r, rx + 3.5, y + 4);
    rx += tw + 3;
  });
  y += 9;
}

function twoCol(leftLabel: string, leftVal: string, rightLabel: string, rightVal: string) {
  checkPageBreak(12);
  const col = CW / 2 - 4;
  fill(S100); draw(S200);
  doc.setLineWidth(0.2);
  doc.roundedRect(ML, y, col, 10, 1.5, 1.5, "FD");
  doc.roundedRect(ML + col + 8, y, col, 10, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); rgb(S500);
  doc.text(leftLabel, ML + 4, y + 4);
  doc.text(rightLabel, ML + col + 12, y + 4);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); rgb(S900);
  doc.text(leftVal, ML + 4, y + 9);
  doc.text(rightVal, ML + col + 12, y + 9);
  y += 14;
}

// ─── SVG-style illustrations ───────────────────────────────────────────────────
function iconHouse(x: number, yp: number) {
  draw([197, 160, 89]); fill([230, 210, 160]);
  doc.setLineWidth(0.8);
  // roof
  doc.lines([[15, -10], [15, 10]], x, yp + 10, [1, 1], "S");
  doc.lines([[15, 10], [30, 0]], x - 15, yp, [1, 1], "S");
  doc.lines([[-15, 0]], x + 15, yp, [1, 1], "S");
  // body
  doc.rect(x - 8, yp + 10, 31, 20, "S");
  // door
  doc.rect(x + 5, yp + 20, 8, 10, "S");
  // windows
  doc.rect(x - 5, yp + 13, 7, 5, "S");
}

function iconCalendar(x: number, yp: number) {
  draw(GOLD); doc.setLineWidth(0.7);
  doc.roundedRect(x, yp, 30, 28, 2, 2, "S");
  doc.line(x, yp + 8, x + 30, yp + 8);
  for (let col = 0; col < 5; col++) for (let row = 0; row < 3; row++) {
    fill(GOLD);
    doc.circle(x + 4 + col * 5.5, yp + 13 + row * 5, 1, "F");
  }
  doc.rect(x + 5, yp + 2, 2, 6, "S");
  doc.rect(x + 22, yp + 2, 2, 6, "S");
}

function iconFunnel(x: number, yp: number) {
  draw(GOLD); doc.setLineWidth(0.7);
  [[30, 3], [22, 8], [16, 13], [8, 5]].forEach(([w, dy], i) => {
    doc.rect(x + (30 - w) / 2, yp + i * 8, w, 5, "S");
  });
}

function iconBed(x: number, yp: number) {
  draw(GOLD); doc.setLineWidth(0.7);
  doc.rect(x, yp + 8, 35, 18, "S");
  doc.rect(x, yp, 10, 10, "S");
  doc.line(x, yp + 8, x + 35, yp + 8);
  doc.circle(x + 5, yp + 5, 2, "S");
}

function iconBookOpen(x: number, yp: number) {
  draw(GOLD); doc.setLineWidth(0.7);
  doc.rect(x, yp, 15, 28, "S");
  doc.rect(x + 16, yp, 15, 28, "S");
  doc.line(x + 15, yp, x + 16, yp);
  doc.line(x + 15, yp + 28, x + 16, yp + 28);
  for (let i = 1; i <= 5; i++) { doc.line(x + 2, yp + i * 4, x + 13, yp + i * 4); }
  for (let i = 1; i <= 5; i++) { doc.line(x + 18, yp + i * 4, x + 29, yp + i * 4); }
}

// ─── Cover Page ───────────────────────────────────────────────────────────────
function buildCover() {
  // dark bg
  fill(DARK2); draw(DARK2);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  // top gold stripe
  fill(GOLD);
  doc.rect(0, 0, PAGE_W, 4, "F");

  // left vertical stripe
  fill(GOLD);
  doc.rect(0, 0, 3, PAGE_H, "F");

  // bottom dark band
  fill(DARK);
  doc.rect(0, PAGE_H - 28, PAGE_W, 28, "F");
  fill(GOLD);
  doc.rect(0, PAGE_H - 28, PAGE_W, 0.5, "F");

  // geometric decorative circles
  draw([GOLD[0], GOLD[1], GOLD[2]]);
  doc.setLineWidth(0.4);
  doc.circle(PAGE_W - 18, 90, 55, "S");
  doc.circle(PAGE_W - 18, 90, 40, "S");
  doc.circle(PAGE_W - 18, 90, 22, "S");
  fill(GOLD);
  doc.circle(PAGE_W - 18, 90, 6, "F");

  // Logo
  if (logoB64) {
    try { doc.addImage(logoB64, "JPEG", ML + 3, 14, 22, 22); } catch (_) {}
  }

  // Hsquareliving brand text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text("HSQUARELIVING", ML + 28, 22);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(S400[0], S400[1], S400[2]);
  doc.text("HARMONY IN LIVING", ML + 28, 27.5, { charSpace: 1 });

  // thin separator
  fill(S400); draw(S400);
  doc.setLineWidth(0.2);
  doc.line(ML + 3, 40, PAGE_W * 0.65, 40);

  // Main title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text("Staff User", ML + 3, 75);
  doc.setFontSize(32);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text("Manual", ML + 3, 90);

  // edition tag
  fill(INDIGO); draw(INDIGO);
  doc.roundedRect(ML + 3, 97, 38, 7, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text("ADMIN & STAFF EDITION", ML + 7, 102);

  // Subtitle block
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(S400[0], S400[1], S400[2]);
  const sub = "Complete operational guide for Superadmin, Admin, Manager, Sales Executive, Frontdesk, Hotel Admin and Hotel Staff roles.";
  const subLines = doc.splitTextToSize(sub, 120);
  doc.text(subLines, ML + 3, 114);

  // Feature highlights
  const features = [
    "Booking & Payment Management",
    "Lead & Sales Pipeline",
    "Hotels Module & Housekeeping",
    "HMS Sync & Settings",
    "Registration & Frontdesk Ops",
    "AI Chatbot (Gyan) Management",
  ];
  let fy = 136;
  features.forEach((f) => {
    fill(GOLD);
    doc.circle(ML + 7, fy - 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text(f, ML + 12, fy);
    fy += 7;
  });

  // Large geometric watermark text
  doc.setFont("helvetica", "bold");
  doc.setFontSize(80);
  doc.setTextColor(30, 35, 48);
  doc.text("H2", PAGE_W - 22, PAGE_H - 35, { align: "right" });

  // Bottom bar info
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(S400[0], S400[1], S400[2]);
  doc.text("Hsquareliving Pvt Ltd  ·  Version 1.0  ·  May 2026  ·  CONFIDENTIAL", ML + 3, PAGE_H - 13);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text("hsquare.in", PAGE_W - MR, PAGE_H - 13, { align: "right" });

  // Roles covered strip above bottom bar
  const rolesText = "Covers: Superadmin · Admin · Manager · Sales Executive · Frontdesk · Hotel Admin · Hotel Staff";
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(S400[0], S400[1], S400[2]);
  doc.text(rolesText, ML + 3, PAGE_H - 20);
}

// ─── Table of Contents ─────────────────────────────────────────────────────────
function buildToc() {
  // We call this AFTER all content is rendered, on a pre-reserved page
  const tocPage = tocPageStart;
  doc.setPage(tocPage);

  fill(WHITE); draw(WHITE);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");

  fill(GOLD);
  doc.rect(0, 0, PAGE_W, 3, "F");
  doc.rect(0, 0, 3, PAGE_H, "F");

  fill(DARK2);
  doc.rect(0, PAGE_H - 20, PAGE_W, 20, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  rgb(S900);
  doc.text("Table of Contents", ML + 5, 28);
  fill(GOLD); draw(GOLD);
  doc.rect(ML + 5, 31, CW - 5, 0.5, "F");

  let ty = 42;
  toc.forEach((entry) => {
    if (ty > PAGE_H - 30) return; // don't overflow
    const isSection = entry.level === 0;
    doc.setFont("helvetica", isSection ? "bold" : "normal");
    doc.setFontSize(isSection ? 10 : 9);
    rgb(isSection ? S900 : S700);

    const label = entry.label;
    const pageStr = String(entry.page);
    const labelX = ML + 5 + (entry.level === 2 ? 5 : 0);
    const labelW = CW - 20;
    const dotW = doc.getTextWidth(".");

    doc.text(label, labelX, ty);
    doc.text(pageStr, PAGE_W - MR, ty, { align: "right" });

    // dotted leader
    const labelEnd = labelX + doc.getTextWidth(label) + 2;
    const dotEnd = PAGE_W - MR - doc.getTextWidth(pageStr) - 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    rgb(S400);
    let dx = labelEnd;
    while (dx + dotW < dotEnd) { doc.text(".", dx, ty); dx += 2.2; }

    ty += isSection ? 8 : 6;
    if (isSection && ty > 42) { // add rule before each section
      fill(S200); draw(S200);
      doc.rect(ML + 5, ty - 4, CW - 5, 0.2, "F");
    }
  });

  // footer
  drawPageFooter();
}

// ─── CONTENT SECTIONS ─────────────────────────────────────────────────────────

function buildPart1() {
  sectionDivider("Part One", "Getting Started", "Essential guide for all staff — login, navigation, and first steps in the Hsquareliving platform.", ["All Roles"], iconBookOpen);
  addPage();

  heading1("1.1  What Is Hsquareliving");
  body("Hsquareliving is a full-stack property and student accommodation management platform built for Hsquareliving Pvt Ltd. It manages the entire lifecycle from property discovery and room booking through payment collection, digital agreement signing, and ongoing resident management.");
  body("The platform has two major portals:");
  bullet("Hostel Portal — the primary admin, sales, and student-facing product accessible at hsquare.in");
  bullet("Hotels Portal — a luxury guest experience under /hotels/* for managing hotel-category properties");

  callout("info", "You are reading the staff manual. Students and guests interact with a separate booking flow and do not have access to the admin panel.");

  heading1("1.2  Supported Devices & Browsers");
  body("The platform is optimised for desktop and tablet use in the admin panel. For the best experience:");
  bullet("Use Google Chrome or Safari (latest version)");
  bullet("Minimum screen width: 768px (iPad or wider)");
  bullet("JavaScript must be enabled");
  callout("tip", "On iPad, tap any number input (e.g. Deposit Amount) and the action button will automatically scroll into view when the keyboard opens.");

  heading1("1.3  Logging In");
  roleBadges(["All Roles"]);
  body("Open hsquare.in/admin/login in your browser. Enter your username or email and password, then press Sign In.");
  numberedStep(1, "Open the Login Page", "Navigate to https://hsquare.in/admin/login");
  numberedStep(2, "Enter Credentials", "Type your email address (or username) and password into the respective fields.");
  numberedStep(3, "Sign In", "Click the Sign In button. You will be redirected based on your assigned role (see table below).");
  numberedStep(4, "Property Selector", "If you manage multiple properties, choose your working property from the dropdown in the top navbar at any time.");

  heading2("Role-Based Redirects After Login");
  const roleTable = [
    ["Superadmin", "Admin Dashboard (/admin)"],
    ["Admin", "Admin Dashboard (/admin)"],
    ["Manager", "Admin Dashboard (/admin)"],
    ["Staff", "Admin Dashboard (/admin)"],
    ["Sales Executive", "Sales Dashboard (/sales)"],
    ["Frontdesk", "All Bookings (/admin/bookings/completed)"],
    ["Hotel Admin", "Hotels Dashboard (/hotels/dashboard)"],
    ["Hotel Staff", "Hotels Dashboard — Shift View (/hotels/dashboard)"],
  ];
  roleTable.forEach(([role, dest]) => {
    checkPageBreak(8);
    fill(S100); draw(S200);
    doc.setLineWidth(0.15);
    doc.rect(ML, y, CW, 7, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); rgb(S900);
    doc.text(role, ML + 3, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); rgb(S500);
    doc.text(dest, ML + 60, y + 5);
    y += 7;
  });
  y += 4;

  callout("warn", "If you see a blank screen after login, contact your Superadmin — your account may not have a property assignment yet.");

  heading1("1.4  Navigating the Dashboard");
  body("The left sidebar (Admin Layout) contains all navigation links grouped by area. Click any item to navigate. Use the top navbar property selector to switch between properties you are assigned to.");
  bullet("Dashboard — KPI overview for your selected property");
  bullet("Requests — Kanban board for booking/registration requests");
  bullet("Registrations — pre-registration applications from the /apply page");
  bullet("Bookings → All Bookings — complete booking management panel");
  bullet("Leads — student lead pipeline (Sales Executive and Admin)");
  bullet("Sales Management — staff assignment, targets, frontdesk users");
  bullet("Floors & Beds — room and bed inventory");
  bullet("Settings — system configuration (Superadmin)");
  callout("tip", "The sidebar can be collapsed by clicking the 'Collapse' button at the bottom. This gives more horizontal space on tablets.");

  heading1("1.5  Your Profile & Password");
  roleBadges(["All Roles"]);
  numberedStep(1, "Open Profile", "Click your avatar (top-right) and select Profile, or navigate to /profile.");
  numberedStep(2, "Update Information", "Edit your name, phone, or profile photo and click Save.");
  numberedStep(3, "Change Password", "Scroll to the Change Password section, enter your current password, then the new one twice, and click Update Password.");
  callout("tip", "Use a strong password (minimum 8 characters mixing letters, numbers, and symbols). Passwords are never stored in plain text.");
}

function buildPart2() {
  sectionDivider("Part Two", "Admin & Superadmin Guide", "Complete reference for managing properties, bookings, students, payments, seasons, HMS sync, settings, users, and data export.", ["Superadmin", "Admin", "Manager"], iconHouse);

  addPage();
  heading1("2.1  Dashboard Overview");
  roleBadges(["Superadmin", "Admin", "Manager"]);
  body("The Admin Dashboard at /admin shows live KPI cards and a summary of activity across your selected property. Key metrics displayed:");
  bullet("Total Bookings — count and total booking value");
  bullet("Active Residents — currently checked-in students");
  bullet("Pending Payments — outstanding amount due");
  bullet("New Leads (7 days) — recent lead activity");
  bullet("Registration Requests — pending pre-registrations");
  callout("info", "All stats are scoped to the property you selected in the navbar dropdown. Switch properties to see data for other locations.");

  heading1("2.2  Property Management");
  roleBadges(["Superadmin", "Admin"]);
  heading2("Adding a New Property");
  numberedStep(1, "Navigate", "Go to Admin → Add Property.");
  numberedStep(2, "Fill Details", "Enter the property name, address, description, location pin, category (hostel/hotel), and upload photos.");
  numberedStep(3, "Set Capacity", "Define total beds. Floors and individual beds are configured separately in Floors & Beds.");
  numberedStep(4, "Save", "Click Create Property. The new property is immediately available in the navbar selector.");

  heading2("Editing an Existing Property");
  body("Navigate to Add Property, then use the property selector to load an existing property and modify its fields. Changes take effect immediately.");
  callout("tip", "The property slug (used in public URLs and SEO) is auto-generated from the name. Contact your Superadmin if you need to change a slug.");

  heading2("Virtual Tour & Photos");
  body("Go to Admin → Tour Images to upload floor-by-floor tour photos. Go to Admin → 3D Virtual Tour to manage the 360° virtual tour URL and embed code. These appear on the public property page for prospective students.");

  heading1("2.3  Floors & Bed Management");
  roleBadges(["Superadmin", "Admin", "Manager"]);
  body("Navigate to Admin → Floors & Beds. This is where you set up the complete room and bed inventory for a property.");
  numberedStep(1, "Create Floors", "Click Add Floor, enter the floor name (e.g. Ground Floor, Floor 1), and set gender restriction (Male / Female / Mixed).");
  numberedStep(2, "Add Rooms / Sections", "Within each floor, add room sections with a name and optional pricing override.");
  numberedStep(3, "Add Beds", "Within each room, add individual beds. Each bed has a bed number, status, and optional per-bed price override.");
  numberedStep(4, "Check the Tree View", "Use Admin → Booking Tree for a visual hierarchy of all floors → rooms → beds and which are occupied.");
  callout("warn", "Do not delete a bed that is currently allocated to an active booking. Reassign or cancel the booking first.");

  heading1("2.4  All Bookings — Main Panel");
  roleBadges(["Superadmin", "Admin", "Manager", "Frontdesk"]);
  body("Navigate to Admin → Bookings → All Bookings (or /admin/bookings/completed). This is the central hub for every booking in the system.");

  heading2("Finding a Booking");
  bullet("Use the search bar to find by name, booking code, phone, or email.");
  bullet("Use All Status and All Bookings filters to narrow by status or booking type.");
  bullet("Sort by Date or Amount using the Sort buttons.");
  bullet("Click a row to open the full booking detail panel on the right.");

  heading2("Booking Detail Panel — Overview");
  body("Clicking a booking row opens the full detail panel. This panel is divided into sections accessed by the sidebar anchors: Resident, Property, Payments, Security Deposit, Agreement, Add-ons, and (if applicable) Package.");

  heading2("Editing a Booking");
  numberedStep(1, "Open Booking", "Click the booking row to open its detail panel.");
  numberedStep(2, "Click Edit", "Click the Edit Booking button in the top-right of the detail panel.");
  numberedStep(3, "Make Changes", "Update any fields — resident info, room assignment, dates, package.");
  numberedStep(4, "Save", "Click Save Changes. An audit log entry is created automatically.");
  callout("tip", "The Edit form supports full resident information including emergency contact, college, course year, and ID proof upload.");

  heading1("2.5  Recording Payments & EMI Instalments");
  roleBadges(["Superadmin", "Admin", "Manager", "Frontdesk"]);
  body("The Payments section of the booking detail panel shows all payment instalments, their due dates, amounts, and collection status.");

  heading2("Marking an Instalment as Paid");
  numberedStep(1, "Open Booking Detail", "Click the booking in All Bookings to open its panel.");
  numberedStep(2, "Scroll to Payments", "Click the Payments anchor in the left sidebar of the detail panel, or scroll down to the Payments section.");
  numberedStep(3, "Click Pay on an Instalment", "Each unpaid instalment has a green Pay button. Click it to open the Mark Payment Done dialog.");
  numberedStep(4, "Enter Payment Details", "Select Payment Method (Cash / UPI / Bank Transfer / Cheque / Card). For non-cash methods, enter the Transaction ID / UTR. Upload a payment screenshot or receipt photo.");
  numberedStep(5, "Confirm", "Click Confirm Payment. The instalment is marked paid and payment history is updated.");
  callout("tip", "On iPad, tap the Amount field — the Confirm Payment button will automatically scroll into view above the keyboard.");
  callout("warn", "Cash payments require a photo of the cash receipt. The Confirm Payment button will remain disabled until a receipt photo is uploaded.");
  callout("info", "The 'Paid in Last Year' option records a deposit carried forward from the previous academic year — no fresh payment required.");

  heading1("2.6  Security Deposit Management");
  roleBadges(["Superadmin", "Admin", "Manager"]);
  body("The Security Deposit (SD) section manages collection and eventual refund of the security deposit for each booking.");

  heading2("Recording a Security Deposit");
  numberedStep(1, "Open Booking → Security Deposit section", "Scroll to the Security Deposit card in the booking detail panel.");
  numberedStep(2, "Choose Deposit Type", "Select Collected, Waived, or Paid in Last Year.");
  numberedStep(3, "Enter Amount", "Type the deposit amount in rupees.");
  numberedStep(4, "Upload Proof (optional)", "Attach a payment screenshot or receipt.");
  numberedStep(5, "Click Mark Security Deposit as Received", "The deposit status updates immediately.");
  callout("tip", "If the student's deposit was waived (e.g. scholarship or special arrangement), select 'Waived' as the deposit type. No amount entry is required.");

  heading2("Confirming a Pending Deposit (HMS flow)");
  body("If the booking was synced from HMS and shows a pending deposit confirmation prompt, use the Confirm Receipt workflow: select the deposit method, optionally enter the UTR reference, and click Confirm Receipt.");

  heading2("Processing a Refund");
  numberedStep(1, "Open the Security Deposit card", "Look for the Process Refund button (visible after the deposit is marked received).");
  numberedStep(2, "Enter Refund Details", "Specify the refund date, amount, method, and any notes.");
  numberedStep(3, "Confirm", "Click Record Refund. A refund entry is created in the payment history.");

  heading1("2.7  Digital Agreement Signing");
  roleBadges(["Superadmin", "Admin", "Manager"]);
  body("The Agreement section of the booking detail panel manages the tenancy agreement.");
  bullet("Upload Agreement — attach a signed PDF agreement document.");
  bullet("Generate Agreement — auto-generate a standard agreement from the booking data.");
  bullet("Student Signature — capture or upload the student's digital signature.");
  bullet("View Signed Agreement — download or preview the complete signed agreement.");
  callout("note", "Students can also sign agreements themselves via the public booking flow. Admin upload is available for in-person or paper-first signings.");

  heading1("2.8  Package Upgrades");
  roleBadges(["Superadmin", "Admin"]);
  body("A booking's housing plan (package) can be upgraded post-check-in from the Package section of the booking detail.");
  numberedStep(1, "Open Package section", "Scroll to the Package card in the booking detail panel.");
  numberedStep(2, "View Available Upgrades", "Available upgrade packages are listed with the price difference.");
  numberedStep(3, "Select & Confirm", "Choose the new package and click Upgrade. A pro-rated price adjustment entry is created.");
  callout("warn", "Package downgrades are not supported. Contact Superadmin for exceptional cases requiring a manual adjustment.");

  heading1("2.9  Housing Plans & Packages");
  roleBadges(["Superadmin", "Admin"]);
  body("Go to Admin → Packages to manage available housing plans for each property. Each package defines:");
  bullet("Plan name and description");
  bullet("Duration (days / months)");
  bullet("Price and instalment schedule");
  bullet("Included amenities and services");
  body("Packages can be marked Active or Inactive. Only active packages appear in the booking generation flow.");

  heading1("2.10  Coupon & Discount Management");
  roleBadges(["Superadmin", "Admin"]);
  body("Go to Admin → Coupons to create promotional discount codes that students can apply during online booking.");
  bullet("Fixed Amount — e.g. ₹2,000 off");
  bullet("Percentage — e.g. 10% off");
  bullet("Set usage limit and expiry date per coupon");
  bullet("Track redemption count in the coupon list");

  heading1("2.11  Season / Batch CRM");
  roleBadges(["Superadmin", "Admin", "Manager"]);
  body("Navigate to Admin → Seasons. This module manages academic batches (seasons) and tracks resident status within each season.");
  numberedStep(1, "Create a Season", "Click New Season. Enter name (e.g. AY 2025-26), start date, end date, and the associated property.");
  numberedStep(2, "Assign Students", "From the season detail page, assign active bookings/residents to this season.");
  numberedStep(3, "Track Status", "The season dashboard shows how many residents are Active, Checked Out, or Transferred.");
  numberedStep(4, "Close a Season", "Mark the season as Completed at the end of the academic year.");

  heading1("2.12  HMS Sync");
  roleBadges(["Superadmin", "Admin"]);
  body("The Hostel Management System (HMS) Sync keeps Hsquareliving in sync with the external HMS. Navigate to Admin → HMS Sync.");
  heading2("Triggering a Sync");
  numberedStep(1, "Navigate to HMS Sync", "Go to Admin → HMS Sync.");
  numberedStep(2, "Select Sync Type", "Choose Full Sync (all data) or Delta Sync (changes since last sync).");
  numberedStep(3, "Start Sync", "Click Sync Now. A progress indicator shows sync status.");
  numberedStep(4, "Review Results", "The sync result panel shows added, updated, and skipped records.");
  callout("tip", "Run HMS Sync at least once per day during active booking periods to keep data current between systems.");
  heading2("HMS Health Check");
  body("Go to Admin → HMS Health to verify that the HMS API connection is live. The health dashboard shows response time, last sync timestamp, and any error details.");
  callout("warn", "If HMS Health shows a red status, booking data may be out of sync. Contact the system administrator immediately.");

  heading1("2.13  Settings");
  roleBadges(["Superadmin"]);
  body("Go to Admin → Settings. This section is restricted to Superadmin users.");
  bullet("General — site name, contact email, address, business details");
  bullet("Hotels Module — toggle the Hotels portal on/off for public visitors (Hotels public flag)");
  bullet("Logo — upload and manage the site logo (displayed in the navbar and PDF exports)");
  bullet("Hero Slides — manage the homepage hero carousel images and copy");
  bullet("Footer — edit footer links, social media URLs, and contact info");
  bullet("Map — update the embedded map design and location pin");
  callout("warn", "The Hotels Module toggle controls public visibility. When OFF, only hotel_admin and hotel_staff can see the Hotels portal — public visitors see a Coming Soon page.");

  heading1("2.14  User Management");
  roleBadges(["Superadmin", "Admin"]);
  body("Navigate to Admin → Users to create and manage staff accounts.");
  heading2("Creating a New User");
  numberedStep(1, "Click Add User", "Click the New User button.");
  numberedStep(2, "Fill Details", "Enter name, email, phone, and assign a role.");
  numberedStep(3, "Assign Properties", "Select which properties this user can access.");
  numberedStep(4, "Set Initial Password", "Set an initial password. The user should change it on first login.");
  numberedStep(5, "Save", "Click Create. The user can now log in.");
  callout("info", "Approval Access is a special flag for Frontdesk users. When enabled, the Frontdesk user can approve registration requests for their assigned properties.");
  heading2("Roles Reference");
  const roles = [
    ["superadmin", "Full access to all settings, users, and all properties."],
    ["admin", "Full booking and property access, cannot manage other superadmins."],
    ["manager", "Booking and reporting access, no settings or user management."],
    ["staff", "Limited operational access."],
    ["sales_executive", "Lead management, sales dashboard, scoped to assigned properties."],
    ["frontdesk", "Booking view and registration approval, scoped to assigned properties."],
    ["hotel_admin", "Full access to Hotels dashboard and housekeeping management."],
    ["hotel_staff", "Personal shift view in Hotels dashboard, own housekeeping tasks only."],
  ];
  roles.forEach(([r, d]) => {
    checkPageBreak(10);
    fill(S100); draw(S200);
    doc.setLineWidth(0.15);
    doc.rect(ML, y, CW, 9, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); rgb(S900);
    doc.text(r, ML + 3, y + 5.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); rgb(S500);
    const dl = doc.splitTextToSize(d, CW - 50);
    doc.text(dl[0], ML + 55, y + 5.5);
    y += 9;
  });
  y += 3;

  heading1("2.15  Activity Logs");
  roleBadges(["Superadmin", "Admin"]);
  body("Go to Admin → Activity Logs. Every significant action — booking edits, payment recordings, user changes — is recorded with the actor's name, timestamp, and a description. Use the date filter and search to find specific entries.");
  callout("tip", "Activity logs cannot be deleted or modified. They are your audit trail and are essential for dispute resolution.");

  heading1("2.16  Data Export");
  roleBadges(["Superadmin", "Admin", "Manager"]);
  body("Go to Admin → Data Export. Export booking, payment, student, or lead data as CSV or Excel files.");
  bullet("Choose the data type and date range");
  bullet("Apply optional filters (property, status, season)");
  bullet("Click Export CSV or Export Excel");
  body("Downloaded files are compatible with Google Sheets, Microsoft Excel, and any standard spreadsheet application.");

  heading1("2.17  Gyan AI Chatbot");
  roleBadges(["Superadmin", "Admin"]);
  body("Go to Admin → AI Chatbot to configure the Gyan chatbot that appears on the public website.");
  bullet("Enable or disable the chatbot widget");
  bullet("Set the chatbot's greeting message and persona name");
  bullet("View recent conversation logs");
  body("Gyan uses OpenAI GPT-4o-mini and has live access to property and pricing data so it can answer student queries accurately.");
  callout("note", "Chatbot conversations are not stored permanently. Logs are retained for 30 days for moderation purposes.");
}

function buildPart3() {
  sectionDivider("Part Three", "Sales Executive Guide", "Lead management, pipeline tracking, activity logging, follow-up scheduling, and the Kanban Requests Board for Sales Executives.", ["Sales Executive", "Admin"], iconFunnel);
  addPage();

  heading1("3.1  Sales Dashboard");
  roleBadges(["Sales Executive", "Admin"]);
  body("After login, Sales Executives land on the Sales Dashboard (/sales). This overview shows:");
  bullet("Your assigned leads and their pipeline stage");
  bullet("Today's follow-ups and overdue items");
  bullet("Recent activity feed");
  bullet("Target vs. actual booking conversion rate");
  callout("info", "Sales Executives only see leads and bookings for their assigned properties. If a property is missing, contact your Admin to update your assignment.");

  heading1("3.2  Lead Management");
  heading2("Adding a New Lead");
  numberedStep(1, "Navigate to Leads", "Go to Leads in the sidebar (or /admin/leads from the Sales Dashboard).");
  numberedStep(2, "Click New Lead", "Click the Add Lead button.");
  numberedStep(3, "Fill Lead Details", "Enter the student's name, phone, email, source (Walk-in / Website / Referral / Social Media / Other), college, and interest notes.");
  numberedStep(4, "Assign Property", "Select the property the lead is interested in.");
  numberedStep(5, "Save", "Click Create Lead. The lead appears in your pipeline with status New.");

  heading2("Lead Stages & Pipeline");
  const stages = ["New", "Contacted", "Site Visit Scheduled", "Site Visit Done", "Proposal Sent", "Negotiation", "Won", "Lost"];
  stages.forEach((s) => bullet(s));
  body("Drag-and-drop leads between stages on the Kanban view, or update the stage from the lead detail panel.");

  heading2("Lead Scoring");
  body("Each lead has an automated score (0–100) based on engagement signals: phone verified, email replied, site visit completed, proposal viewed. Higher scores indicate higher conversion likelihood. Use the score to prioritise your follow-up queue.");

  heading1("3.3  Kanban Requests Board");
  roleBadges(["Sales Executive", "Admin", "Frontdesk"]);
  body("Navigate to Requests (or /admin/requests). This Kanban board shows all registration requests and booking enquiries, grouped by stage.");
  numberedStep(1, "View Cards", "Each card shows student name, contact, interested property, and current stage.");
  numberedStep(2, "Move Cards", "Drag a card to a new column to update its stage.");
  numberedStep(3, "Open Detail", "Click a card to see full details, add notes, or trigger the booking generation flow.");
  numberedStep(4, "Filter", "Use the property and stage filters at the top to focus on your queue.");

  heading1("3.4  Logging Activities & Follow-ups");
  body("From any lead's detail panel, click Log Activity to record a touchpoint.");
  bullet("Activity Types: Call, Email, WhatsApp, Site Visit, Meeting, Other");
  bullet("Enter outcome notes and whether the lead was responsive");
  bullet("Set a Follow-up Date to schedule the next touchpoint");
  body("Leads with overdue follow-ups appear highlighted in red on the Sales Dashboard.");

  heading1("3.5  Calendar Subscription (iCal)");
  body("Your follow-up schedule is available as a live calendar feed. In your Sales Dashboard, click Subscribe to Calendar to get a personal iCal URL. Add this URL to Google Calendar, Apple Calendar, or Outlook to see your follow-ups alongside your other meetings.");
  callout("tip", "The iCal feed updates automatically when you add or modify follow-ups. No manual sync needed.");

  heading1("3.6  Email Reminders");
  body("When you schedule a follow-up, an automated reminder email is sent to your registered email address 1 hour before the follow-up time. You can also receive a daily digest of today's follow-ups at 8:00 AM.");
  callout("note", "Email reminders require your email address to be correctly set in your profile. Check Admin → Profile to confirm.");
}

function buildPart4() {
  sectionDivider("Part Four", "Frontdesk Guide", "Registration approval, visitor management, booking quick-reference, and scoped property access for Frontdesk staff.", ["Frontdesk", "Admin"], iconCalendar);
  addPage();

  heading1("4.1  Frontdesk Overview");
  roleBadges(["Frontdesk"]);
  body("Frontdesk users have a focused view of the platform scoped to their assigned properties. After login, they land directly on the All Bookings page. They can view bookings, approve registrations, and manage visitor logins.");
  callout("info", "Frontdesk users cannot create new users, access Settings, or modify system configuration. If you need any of these, ask your Admin.");

  heading1("4.2  Reviewing Registration Requests");
  body("New students can pre-register via the public /apply form. These registrations appear in Admin → Registrations.");
  numberedStep(1, "Open Registrations", "Go to Registrations in the sidebar.");
  numberedStep(2, "Review Application", "Click a registration to see the student's details, college, requested room type, and move-in date.");
  numberedStep(3, "Approve or Reject", "Click Approve to move the student to the booking generation queue, or Reject with a reason.");
  numberedStep(4, "Notify Student", "An automatic email is sent to the student upon approval or rejection.");
  callout("tip", "If Approval Access is enabled for your account (by your Admin), you can approve registrations. If the Approve button is greyed out, contact your Admin to enable this flag for your account.");

  heading1("4.3  Visitor Login Management");
  body("The Visitor Login feature lets guests check in temporarily via the /visitor-login page. From the Visitor Login section, Frontdesk can:");
  bullet("See active visitor sessions");
  bullet("Manually check in a visitor");
  bullet("End a visitor session");
  callout("note", "Visitor logins are separate from student bookings and are not recorded in the main booking system.");

  heading1("4.4  Booking Quick-Reference");
  body("Frontdesk users have read-only access to the All Bookings panel with the ability to record payments (if permitted by their Admin). Key tasks:");
  bullet("Find a student by name, phone, or booking code using the search bar");
  bullet("View booking details, room assignment, and payment status");
  bullet("Record a payment if the Mark Payment Done button is visible");
  bullet("Print or download the agreement from the Agreement section");
  callout("warn", "Frontdesk users cannot delete bookings, change room assignments, or modify agreements. These actions require Admin access.");

  heading1("4.5  Scoped Property Visibility");
  body("You will only see bookings, leads, and registrations for the properties assigned to your account. If a student tells you they have a booking but it's not visible, their booking may be under a different property. Ask your Admin to check all properties.");
}

function buildPart5() {
  sectionDivider("Part Five", "Hotel Admin & Staff Guide", "Managing the Hotels portal — dashboard overview, bookings, rooms, housekeeping tasks, and staff shift view.", ["Hotel Admin", "Hotel Staff"], iconBed);
  addPage();

  heading1("5.1  Accessing the Hotels Portal");
  roleBadges(["Hotel Admin", "Hotel Staff"]);
  body("Hotel-role users are redirected automatically to /hotels/dashboard on login. You can also navigate to it from the main app navbar using the gold 'Switch to Hotels →' pill, or from the Hotels navbar using 'Switch to Hostel ←'.");
  callout("info", "The Hotels portal has its own luxury design and three themes: Dark (default), Light, and Studio. Toggle themes using the Sun/Moon/Sparkles pill in the Hotels navbar. Your preference is saved automatically.");

  heading1("5.2  Hotels Dashboard — Admin View");
  roleBadges(["Hotel Admin", "Admin", "Superadmin"]);
  body("The Hotels Dashboard (/hotels/dashboard) has four tabs:");
  bullet("Overview — stat cards: today's check-ins, occupancy %, 30-day revenue, pending housekeeping tasks");
  bullet("Bookings — all hotel bookings with status and guest details");
  bullet("Rooms — room type inventory and availability");
  bullet("Housekeeping — task management board");

  heading2("Stat Cards");
  body("The four overview stat cards update in real time:");
  bullet("Today's Check-ins — guests with a check-in date of today");
  bullet("Occupancy % — occupied beds as a percentage of total hotel beds");
  bullet("30-Day Revenue — payments received in the last 30 days from hotel-category properties");
  bullet("Pending Housekeeping — tasks not yet marked Complete");

  heading1("5.3  Managing Housekeeping Tasks");
  roleBadges(["Hotel Admin", "Admin"]);
  heading2("Creating a Task");
  numberedStep(1, "Open Housekeeping Tab", "Click the Housekeeping tab on the Hotels Dashboard.");
  numberedStep(2, "Click New Task", "Click the New Task button (top right).");
  numberedStep(3, "Fill Task Details", "Enter title, task type (Cleaning / Linen Change / Maintenance / Inspection / Other), priority (Low / Normal / High / Urgent), the assigned staff member, and an optional due date/notes.");
  numberedStep(4, "Save", "Click Create Task. The task appears in the list and is immediately visible to the assigned staff member.");

  heading2("Updating Task Status");
  body("Hotel Admin (and the assigned staff member) can update task status from Pending → In Progress → Completed. Click the task row to edit its status and add completion notes.");
  callout("tip", "Mark tasks as In Progress when a staff member starts working on a room, and Completed as soon as they finish. This keeps the Pending Housekeeping count on the Overview accurate.");

  heading2("Filtering & Searching Tasks");
  bullet("Filter by status, type, or priority using the dropdowns");
  bullet("Search by room number or task title");
  bullet("Sort by due date or priority");

  heading1("5.4  Hotel Staff — Shift View");
  roleBadges(["Hotel Staff"]);
  body("Hotel Staff users see a simplified shift view that shows only tasks assigned to them and their own check-in/check-out counts for the day. This view is intentionally limited to reduce distraction and ensure staff focus on their specific duties.");
  bullet("My Tasks — tasks assigned to you, ordered by priority then due time");
  bullet("Today's Count — number of check-ins/check-outs you have managed today");
  callout("note", "You cannot create tasks or view other staff members' tasks. If you believe a task is missing or incorrectly assigned, contact your Hotel Admin.");

  heading1("5.5  Hotels Portal — Rooms & Booking Flow");
  roleBadges(["Hotel Admin", "Superadmin"]);
  body("The Hotels portal reuses the hostel system's properties (filtered by category='hotel'), room types, bookings, and payments tables — there are no duplicate entities.");
  body("The public booking flow for hotel guests:");
  numberedStep(1, "Guest browses /hotels/rooms", "Filterable grid of hotel-category properties.");
  numberedStep(2, "Guest visits /hotels/rooms/:slug", "Property detail with selectable room types and a Reserve CTA.");
  numberedStep(3, "Reserve hands off to /properties/:slug", "The standard booking flow with Razorpay payment and digital agreement signing.");
  callout("tip", "Hotel properties are managed under Admin → Add Property with category set to 'hotel'. All the same property management tools apply.");
}

function buildPart6() {
  sectionDivider("Part Six", "Public & Student-Facing Flows", "Reference guide for the public registration form, virtual property tour, bed booking, payment gateway, and agreement signing as experienced by students.", ["All Roles"], iconBookOpen);
  addPage();

  heading1("6.1  Public Registration Form (/apply)");
  body("The /apply page is a shareable pre-registration form for prospective students. It does not require a student to create an account. The student fills in personal details, college, preferred room type, and submits.");
  body("After submission:");
  bullet("A registration entry appears in Admin → Registrations");
  bullet("An acknowledgement email is sent to the student");
  bullet("Frontdesk or Admin reviews and approves or rejects the application");
  callout("tip", "Share the /apply link on social media, WhatsApp, or email campaigns. It is public and mobile-friendly.");

  heading1("6.2  Virtual Property Tour");
  body("Prospective students can take a self-guided tour of a property at /properties/:slug. The tour includes:");
  bullet("Photo gallery of each floor and room type");
  bullet("Interactive floor plan showing bed availability (colour-coded: available / occupied)");
  bullet("3D Virtual Tour button (if a 360° tour has been configured in Admin → 3D Virtual Tour)");

  heading1("6.3  Bed Booking — Floor → Room → Bed Selection");
  body("After browsing properties, students select a specific bed through a three-level hierarchy:");
  numberedStep(1, "Choose Floor", "Select from available floors. Floors with gender restrictions show the restriction label.");
  numberedStep(2, "Choose Room", "Select a room section. Occupied or reserved beds are shown in grey.");
  numberedStep(3, "Choose Bed", "Click an available (green) bed to select it. Duplicate booking prevention is enforced server-side.");
  numberedStep(4, "Proceed to Booking", "Click Book Now to start the booking flow with the chosen bed pre-selected.");
  callout("warn", "A bed is not reserved until the booking is completed and payment is made. Two students selecting the same bed simultaneously are handled by server-side conflict detection — the first to complete payment wins.");

  heading1("6.4  Payment Gateway (Razorpay)");
  body("Hsquareliving uses Razorpay for online payments. Supported methods:");
  bullet("UPI (Google Pay, PhonePe, Paytm, BHIM, etc.)");
  bullet("Debit Card / Credit Card");
  bullet("Net Banking");
  bullet("Razorpay Wallet");
  body("After payment success, the student is redirected to the confirmation page and receives a payment receipt email.");
  callout("note", "Failed payments do not create a booking. The student can retry the payment. Contact Admin if a payment was deducted but the booking was not confirmed.");

  heading1("6.5  Digital Agreement Signing");
  body("After payment, the student is prompted to review and sign the tenancy agreement. The flow:");
  numberedStep(1, "Review Agreement", "The auto-generated agreement is displayed with all booking details pre-filled.");
  numberedStep(2, "Sign", "The student draws their signature using the on-screen signature pad (touchscreen or mouse).");
  numberedStep(3, "Submit", "The signed agreement is stored and is available for download by both the student and Admin.");
  callout("tip", "If a student is signing on a mobile device, the signature pad works with touch input. Landscape mode gives more room for the signature.");
  body("Admins can view and download the signed agreement from the Agreement section of the booking detail panel in All Bookings.");
}

// ─── Quick Reference Cards ─────────────────────────────────────────────────────
function buildQuickRef() {
  addPage();
  const p = doc.getCurrentPageInfo().pageNumber;
  toc.push({ label: "Quick Reference — Key URLs & Shortcuts", level: 0, page: p });

  heading1("Quick Reference", false);
  heading2("Key URLs", false);
  const urls = [
    ["/admin", "Admin Dashboard"],
    ["/admin/bookings/completed", "All Bookings"],
    ["/admin/leads", "Lead Management"],
    ["/admin/requests", "Kanban Requests Board"],
    ["/admin/registrations", "Registration Requests"],
    ["/admin/floors-beds", "Floors & Beds"],
    ["/admin/packages", "Housing Packages"],
    ["/admin/seasons", "Season / Batch CRM"],
    ["/admin/hms-sync", "HMS Sync"],
    ["/admin/hms-health", "HMS Health Check"],
    ["/admin/settings", "System Settings"],
    ["/admin/users", "User Management"],
    ["/admin/activity-logs", "Activity Audit Logs"],
    ["/admin/data-export", "Data Export (CSV/Excel)"],
    ["/admin/ai-chatbot", "Gyan Chatbot Config"],
    ["/sales", "Sales Dashboard"],
    ["/hotels/dashboard", "Hotels Dashboard"],
    ["/apply", "Public Registration Form"],
  ];
  urls.forEach(([url, label]) => {
    checkPageBreak(7);
    fill(S100); draw(S200);
    doc.setLineWidth(0.15);
    doc.rect(ML, y, CW, 6.5, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); rgb(INDIGO);
    doc.text(url, ML + 3, y + 4.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); rgb(S700);
    doc.text(label, ML + 70, y + 4.5);
    y += 6.5;
  });
  y += 4;

  heading2("Common Troubleshooting", false);
  const issues = [
    ["Booking not visible in All Bookings", "Check that the correct property is selected in the navbar dropdown. The booking may be under a different property."],
    ["Payment dialog Confirm button not reachable on iPad", "Tap the Amount field — the button scrolls into view automatically. Alternatively, scroll down inside the dialog."],
    ["Stat card amounts showing as ₹10.28L etc.", "This is the compact Indian number format (Lakh/Crore). Hover over the card to see the full amount. This is by design to prevent truncation on smaller screens."],
    ["HMS Health shows red status", "The external HMS API is unreachable. Contact the system administrator. Do not manually create duplicate records — wait for sync to resume."],
    ["'Switch to Hotels' pill not visible", "The Hotels Module is disabled. A Superadmin must enable it in Admin → Settings → General → Hotels Module."],
    ["Can't approve registrations (button greyed out)", "Your account needs Approval Access enabled. Ask your Admin to go to Admin → Sales Management → Frontdesk tab and toggle Approval Access for your account."],
  ];
  issues.forEach(([issue, fix]) => {
    checkPageBreak(20);
    y += 2;
    fill(WARN_BG); draw(WARN_BD);
    doc.setLineWidth(0.3);
    const issueLines = doc.splitTextToSize(issue, CW - 10);
    const fixLines = doc.splitTextToSize(fix, CW - 14);
    const boxH = issueLines.length * 4.5 + fixLines.length * 4.5 + 12;
    doc.roundedRect(ML, y, CW, boxH, 2, 2, "FD");
    fill(WARN_BD);
    doc.rect(ML, y, 2.5, boxH, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); rgb(RED);
    doc.text(issueLines, ML + 6, y + 5.5);
    const iy = y + issueLines.length * 4.5 + 7;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); rgb(S700);
    doc.text(fixLines, ML + 8, iy);
    y += boxH + 4;
  });

  y += 6;
  callout("note", "For technical support, contact your Superadmin or email support@hsquare.in. Include a screenshot and the exact URL where the issue occurred.");
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("📄  Generating Hsquareliving Staff User Manual…");

  // Load logo
  try {
    const logoBuf = readFileSync(join(ROOT, "public", "hsquare-logo.jpg"));
    logoB64 = logoBuf.toString("base64");
    console.log("  ✓  Logo loaded");
  } catch (e) {
    console.warn("  ⚠  Logo not found — skipping");
  }

  doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

  // ── Page 1: Cover ──
  buildCover();
  drawPageFooter();

  // ── Page 2: TOC placeholder ──
  doc.addPage("a4");
  tocPageStart = doc.getCurrentPageInfo().pageNumber;
  drawPageFooter();

  // ── Content ──
  buildPart1();
  buildPart2();
  buildPart3();
  buildPart4();
  buildPart5();
  buildPart6();
  buildQuickRef();

  // ── Now fill in the TOC on page 2 ──
  buildToc();

  // ── Output ──
  const outPath = join(ROOT, "public", "hsquareliving-user-manual.pdf");
  const buf = doc.output("arraybuffer");
  writeFileSync(outPath, Buffer.from(buf));

  const pages = doc.getNumberOfPages();
  const sizeKb = Math.round(Buffer.from(buf).length / 1024);
  console.log(`  ✓  PDF written → ${outPath}`);
  console.log(`  ✓  Pages: ${pages}   Size: ${sizeKb} KB`);
  console.log("✅  Done!");
}

main().catch((e) => { console.error(e); process.exit(1); });
