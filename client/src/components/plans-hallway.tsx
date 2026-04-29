import { useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  AnimatePresence,
} from "framer-motion";
import { ArrowRight, Check, X, ChevronDown } from "lucide-react";
import hallwayLoopVideo from "@assets/Make_it_loop_smooth_202604291544_1777457674130.mp4";

interface PlanItem {
  id: string;
  label: string;
  featureValue?: string;
  includedQty?: number | string;
  unit?: string;
}

interface Plan {
  id: string;
  name: string;
  tagline?: string;
  basePrice?: number | string;
  occupancy?: string;
  isHighlighted?: boolean;
  tierLevel?: number;
  items?: PlanItem[];
  propertyId?: string;
  propertySlug?: string;
  propertyName?: string;
}

interface Property {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string | null;
}

interface PlansHallwayProps {
  plans: Plan[];
  properties: Property[];
  onExplore: (href: string) => void;
}

const GOLD = "rgb(212, 175, 55)";

// Each frame in the archive gets its own metallic palette so the cards
// don't all read as identical dark rectangles. The palettes cycle by
// frame index so a property's "Plan.01" and "Plan.02" always feel
// distinct from each other.
const TIER_PALETTES = [
  {
    label: "Champagne",
    accent: "#D4AF37", // gold
    accentSoft: "rgba(212,175,55,0.22)",
    glow: "rgba(212,175,55,0.32)",
    haloTop:
      "linear-gradient(160deg, rgba(212,175,55,0.45) 0%, rgba(80,55,10,0.65) 45%, rgba(0,0,0,0.95) 100%)",
    chip: "rgba(212,175,55,0.12)",
    chipBorder: "rgba(212,175,55,0.35)",
  },
  {
    label: "Copper",
    accent: "#C97B5C", // antique copper
    accentSoft: "rgba(201,123,92,0.22)",
    glow: "rgba(201,123,92,0.32)",
    haloTop:
      "linear-gradient(160deg, rgba(201,123,92,0.45) 0%, rgba(73,32,18,0.65) 45%, rgba(0,0,0,0.95) 100%)",
    chip: "rgba(201,123,92,0.12)",
    chipBorder: "rgba(201,123,92,0.35)",
  },
  {
    label: "Platinum",
    accent: "#A8B5C0", // pewter / silver
    accentSoft: "rgba(168,181,192,0.22)",
    glow: "rgba(168,181,192,0.32)",
    haloTop:
      "linear-gradient(160deg, rgba(168,181,192,0.45) 0%, rgba(34,42,52,0.65) 45%, rgba(0,0,0,0.95) 100%)",
    chip: "rgba(168,181,192,0.12)",
    chipBorder: "rgba(168,181,192,0.35)",
  },
  {
    label: "Bronze",
    accent: "#9A7B4F", // burnished bronze
    accentSoft: "rgba(154,123,79,0.22)",
    glow: "rgba(154,123,79,0.32)",
    haloTop:
      "linear-gradient(160deg, rgba(154,123,79,0.45) 0%, rgba(50,38,18,0.65) 45%, rgba(0,0,0,0.95) 100%)",
    chip: "rgba(154,123,79,0.12)",
    chipBorder: "rgba(154,123,79,0.35)",
  },
];

export function PlansHallway({
  plans,
  properties,
  onExplore,
}: PlansHallwayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  // Backdrop video gate: skip the loop video only on save-data (the
  // surrounding hallway is itself heavily motion-driven, so honoring
  // prefers-reduced-motion here would gate away the very effect the
  // user explicitly wants). The <video> also self-disables on error.
  const [showBackdropVideo, setShowBackdropVideo] = useState(() => {
    if (typeof window === "undefined") return false;
    const conn = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection || null;
    if (conn?.saveData) return false;
    return true;
  });

  const propertyImage = useMemo(() => {
    const m: Record<string, string> = {};
    properties.forEach((p) => {
      if (p.imageUrl) m[p.id] = p.imageUrl;
    });
    return m;
  }, [properties]);

  const frames = useMemo(() => {
    const byProp: Record<string, Plan[]> = {};
    plans.forEach((plan) => {
      const k = plan.propertyId || "_general";
      if (!byProp[k]) byProp[k] = [];
      byProp[k].push(plan);
    });
    const result: Array<{
      plan: Plan;
      image: string;
      side: "left" | "right";
      idx: number;
      zPos: number;
    }> = [];
    let i = 0;
    Object.values(byProp).forEach((propPlans) => {
      propPlans.slice(0, 2).forEach((plan) => {
        result.push({
          plan,
          image: propertyImage[plan.propertyId || ""] || "",
          side: i % 2 === 0 ? "left" : "right",
          idx: i,
          zPos: -i * 700,
        });
        i++;
      });
    });
    return result;
  }, [plans, propertyImage]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Cinematic camera walk — matches the reference design exactly.
  //
  // The viewport gets `perspective: 2400px` and the hallway track
  // gets `transform-style: preserve-3d`. Each card sits at its own
  // `translateZ(zPos)` depth so they form a real 3D corridor.
  //
  // As the user scrolls, the entire track translates forward in Z,
  // so the camera "walks" down the hallway and the cards approach.
  //
  // Cards do NOT rotate. Without rotation on 3D-positioned
  // siblings, Chrome's pointer hit-tester routes clicks correctly
  // to every card — that's why this exact reference layout is
  // both cinematic AND clickable.
  const lastZ = frames.length > 0 ? Math.abs(frames[frames.length - 1].zPos) : 0;
  const cameraZ = useTransform(scrollYProgress, [0, 1], [0, lastZ + 800]);
  const trackTransform = useMotionTemplate`translateZ(${cameraZ}px)`;
  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  // Outer container height: roughly one viewport per frame so the user has
  // enough scroll runway to walk through the entire archive.
  const outerVh = Math.max(1, frames.length) * 90 + 60;

  // Defensive guard: if `plans` shrinks while a modal is open and the
  // current `openIdx` no longer points at a valid frame, close the modal
  // so we don't end up with a body scroll-lock and no visible UI.
  useEffect(() => {
    if (openIdx !== null && !frames[openIdx]) {
      setOpenIdx(null);
    }
  }, [openIdx, frames]);

  useEffect(() => {
    if (openIdx === null) return;
    // Remember which element was focused so we can restore focus on close.
    lastTriggerRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    // Move focus into the modal once it has mounted.
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 60);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpenIdx(null);
        return;
      }
      if (e.key !== "Tab") return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusables = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !modal.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modal.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // Restore focus to the trigger that opened the modal.
      const target = lastTriggerRef.current;
      if (target && typeof target.focus === "function") {
        target.focus();
      }
    };
  }, [openIdx]);

  if (frames.length === 0) return null;

  const opened = openIdx !== null ? frames[openIdx] : null;
  const openedPrice = opened ? Number(opened.plan.basePrice || 0) : 0;

  return (
    <>
      <section
        ref={containerRef}
        className="relative w-full bg-black"
        style={{ height: `${outerVh}vh` }}
        data-testid="plans-hallway-section"
        aria-label="Housing plans archive — scroll to navigate the gallery"
      >
        <div
          className="sticky top-0 left-0 w-full h-screen overflow-hidden"
          style={{
            // Transparent base + soft vignette so the global
            // iridescent tubes layer (mounted in Layout at z-0)
            // shimmers through behind the cards. The vignette
            // keeps just enough darkness for text/cards to pop.
            background:
              "radial-gradient(circle at 50% 40%, rgba(13,13,13,0.55) 0%, rgba(0,0,0,0.85) 70%)",
            perspective: "2400px",
            perspectiveOrigin: "50% 50%",
            // Reference trick: viewport itself does NOT receive
            // pointer events. Only the .art-frame cards do (they
            // override with pointer-events: auto and a high z-index).
            // This isolates each card as an independent hit-test
            // target so Chrome routes clicks correctly even when the
            // cards are rotated and 3D-positioned siblings.
            pointerEvents: "none",
          }}
        >
          {/* Backdrop loop video — soft, blended layer behind the
              cards that gives the corridor a cinematic, in-motion
              feel matching the homepage hero. Sits at z-[1] above
              the tubes pass-through but below the vignette and
              cards. Skipped on prefers-reduced-motion / save-data
              for the same a11y/perf reasons as the hero. */}
          {showBackdropVideo && (
            <div
              className="absolute inset-0 pointer-events-none z-[1]"
              aria-hidden="true"
            >
              <video
                src={hallwayLoopVideo}
                muted
                autoPlay
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                disableRemotePlayback
                onError={() => setShowBackdropVideo(false)}
                data-testid="plans-hallway-backdrop-video"
                className="w-full h-full object-cover"
                style={{
                  opacity: 0.55,
                  mixBlendMode: "luminosity",
                  WebkitMaskImage:
                    "linear-gradient(180deg, transparent 0%, black 12%, black 88%, transparent 100%)",
                  maskImage:
                    "linear-gradient(180deg, transparent 0%, black 12%, black 88%, transparent 100%)",
                  transform: "translateZ(0)",
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                }}
              />
            </div>
          )}
          {/* Subtle radial vignette above the video to re-darken
              the corners so the cards still pop from the moving
              backdrop. Pointer-events disabled so it never blocks
              card clicks. */}
          <div
            className="absolute inset-0 pointer-events-none z-[2]"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.55) 80%)",
            }}
          />
          {/* hallway track — matches the reference exactly.
              perspective: 2400px on the wrapper above, this track
              has transform-style: preserve-3d, and its translateZ
              animates with scroll so the camera "walks" down the
              hallway. pointer-events: none here too — only the cards
              themselves are clickable. */}
          <motion.div
            className="absolute inset-0 w-full h-full"
            style={{
              transformStyle: "preserve-3d",
              transform: trackTransform,
              pointerEvents: "none",
            }}
          >
            {frames.map((frame, idx) => {
              const isLeft = frame.side === "left";
              const tier = TIER_PALETTES[idx % TIER_PALETTES.length];
              const price = Number(frame.plan.basePrice || 0);
              const monthly = price > 0 ? Math.round(price / 12) : 0;
              const features = (frame.plan.items || []).slice(0, 3);
              // Reference layout: each card sits at its own
              // translateZ depth inside the parent's perspective
              // camera, plus a rotateY tilt (left cards rotate +35°,
              // right cards rotate -35°) so they face the corridor
              // like art frames in a gallery. Clicks still work
              // because the parent has pointer-events: none and
              // each card explicitly opts in with pointer-events:auto
              // + a high z-index, so Chrome's hit-tester only
              // considers the cards themselves.
              const buttonTransform = `translateZ(${frame.zPos}px) rotateY(${
                isLeft ? "35deg" : "-35deg"
              })`;

              return (
                <button
                  key={frame.plan.id}
                  type="button"
                  onClick={() => setOpenIdx(idx)}
                  data-testid={`plan-frame-${frame.plan.id}`}
                  aria-label={`Open ${frame.plan.name}${
                    frame.plan.propertyName
                      ? " at " + frame.plan.propertyName
                      : ""
                  }`}
                  className="absolute text-left cursor-pointer block group focus:outline-none"
                  style={{
                    // Reference layout: 260x380 cards at top:27%,
                    // with left:20% or right:20%, and their own
                    // translateZ depth + rotateY tilt inside the
                    // parent's 3D perspective camera.
                    top: "27%",
                    [isLeft ? "left" : "right"]: "20%",
                    width: 260,
                    height: 380,
                    background: "rgba(10, 10, 10, 0.6)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: 4,
                    overflow: "hidden",
                    boxShadow: `0 30px 80px -20px rgba(0,0,0,0.9), 0 0 60px -10px ${tier.glow}`,
                    transition:
                      "filter 0.4s ease, transform 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease",
                    transform: buttonTransform,
                    transformStyle: "preserve-3d",
                    transformOrigin: "center center",
                    // Reference trick: parents are pointer-events:none;
                    // each card opts back in with auto + a high
                    // z-index so the browser's pointer hit-tester
                    // only considers the cards themselves.
                    pointerEvents: "auto",
                    zIndex: 20,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.filter = "brightness(1.18)";
                    el.style.borderColor = tier.accent;
                    el.style.boxShadow = `0 0 0 1px ${tier.accentSoft}, 0 30px 80px -20px rgba(0,0,0,0.9), 0 0 90px -5px ${tier.glow}`;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.filter = "";
                    el.style.borderColor = tier.chipBorder;
                    el.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.6), 0 30px 80px -20px rgba(0,0,0,0.9), 0 0 60px -10px ${tier.glow}`;
                  }}
                  onFocus={(e) => {
                    const el = e.currentTarget;
                    el.style.filter = "brightness(1.18)";
                    el.style.borderColor = tier.accent;
                    el.style.boxShadow = `0 0 0 2px ${tier.accentSoft}, 0 30px 80px -20px rgba(0,0,0,0.9), 0 0 90px -5px ${tier.glow}`;
                  }}
                  onBlur={(e) => {
                    const el = e.currentTarget;
                    el.style.filter = "";
                    el.style.borderColor = tier.chipBorder;
                    el.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.6), 0 30px 80px -20px rgba(0,0,0,0.9), 0 0 60px -10px ${tier.glow}`;
                  }}
                >
                    {/* photo region (top half) */}
                    <div
                      className="relative h-[180px] w-full overflow-hidden pointer-events-none"
                      style={{ background: tier.haloTop }}
                    >
                      {frame.image && (
                        <img
                          src={frame.image}
                          alt=""
                          className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500 mix-blend-luminosity"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      {/* tier accent wash */}
                      <div
                        className="absolute inset-0 pointer-events-none mix-blend-overlay"
                        style={{
                          background: `linear-gradient(180deg, ${tier.accentSoft} 0%, transparent 60%)`,
                        }}
                      />
                      {/* fade into card body */}
                      <div className="absolute inset-x-0 bottom-0 h-20 pointer-events-none bg-gradient-to-t from-[#050506] via-[#050506]/70 to-transparent" />
                      {/* tier label chip top-left */}
                      <div
                        className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2 py-1 text-[9px] tracking-[0.3em] uppercase font-semibold rounded-sm"
                        style={{
                          color: tier.accent,
                          background: tier.chip,
                          border: `1px solid ${tier.chipBorder}`,
                          backdropFilter: "blur(8px)",
                          WebkitBackdropFilter: "blur(8px)",
                        }}
                      >
                        <span
                          className="inline-block w-1 h-1 rounded-full"
                          style={{ background: tier.accent }}
                        />
                        {tier.label}
                      </div>
                      {/* plan number top-right */}
                      <div
                        className="absolute top-3 right-3 text-[10px] tracking-[0.45em] uppercase font-semibold"
                        style={{ color: tier.accent, opacity: 0.85 }}
                      >
                        Plan.{String(idx + 1).padStart(2, "0")}
                      </div>
                    </div>

                    {/* details */}
                    <div className="relative px-5 pt-3 pb-5 flex flex-col gap-3 pointer-events-none">
                      <div
                        className="text-[9px] tracking-[0.4em] uppercase font-medium"
                        style={{ color: tier.accent, opacity: 0.85 }}
                      >
                        {frame.plan.propertyName || ""}
                      </div>
                      <h3 className="font-heading font-bold text-[22px] leading-[1.1] text-white tracking-tight">
                        {frame.plan.name}
                      </h3>

                      {/* price + occupancy row */}
                      <div className="flex items-baseline gap-4 mt-1">
                        {price > 0 && (
                          <div className="flex flex-col">
                            <span className="text-[8px] tracking-[0.3em] uppercase text-white/45">
                              Yearly
                            </span>
                            <span
                              className="font-heading text-[18px] font-bold leading-none"
                              style={{ color: tier.accent }}
                            >
                              ₹{price.toLocaleString("en-IN")}
                            </span>
                            {monthly > 0 && (
                              <span className="text-[9px] text-white/45 mt-0.5">
                                ≈ ₹{monthly.toLocaleString("en-IN")}/mo
                              </span>
                            )}
                          </div>
                        )}
                        {frame.plan.occupancy && (
                          <div className="flex flex-col">
                            <span className="text-[8px] tracking-[0.3em] uppercase text-white/45">
                              Occupancy
                            </span>
                            <span className="font-heading text-[15px] font-semibold text-white leading-none mt-1">
                              {frame.plan.occupancy}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* feature inclusions */}
                      {features.length > 0 && (
                        <ul className="flex flex-col gap-1.5 mt-1">
                          {features.map((f) => {
                            const val =
                              f.featureValue ||
                              `${f.includedQty ?? ""} ${f.unit ?? ""}`.trim();
                            return (
                              <li
                                key={f.id}
                                className="flex items-start gap-2 text-[11px] text-white/70 leading-snug"
                              >
                                <Check
                                  className="w-3 h-3 mt-[1px] shrink-0"
                                  style={{ color: tier.accent }}
                                />
                                <span>
                                  {f.label}
                                  {val && (
                                    <span className="text-white/90 font-medium">
                                      {" "}
                                      {val}
                                    </span>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                          {(frame.plan.items || []).length > features.length && (
                            <li className="text-[9px] text-white/40 pl-5 tracking-wider">
                              +{(frame.plan.items || []).length - features.length}{" "}
                              more
                            </li>
                          )}
                        </ul>
                      )}

                      {/* divider + view CTA */}
                      <div
                        className="mt-2 pt-3 flex items-center justify-between"
                        style={{
                          borderTop: `1px solid ${tier.chipBorder}`,
                        }}
                      >
                        <span className="text-[9px] tracking-[0.4em] uppercase text-white/45">
                          Tap to explore
                        </span>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] tracking-[0.35em] uppercase font-semibold"
                          style={{ color: tier.accent }}
                        >
                          View
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                </button>
              );
            })}
          </motion.div>

          {/* floor glow */}
          <div
            className="absolute bottom-0 left-0 right-0 h-[30vh] pointer-events-none z-[5]"
            style={{
              background:
                "linear-gradient(to top, rgba(212,175,55,0.05), transparent)",
            }}
          />

          {/* top fade so the hero/header above bleeds gently into the archive */}
          <div
            className="absolute top-0 left-0 right-0 h-[12vh] pointer-events-none z-[5]"
            style={{
              background: "linear-gradient(to bottom, #000, transparent)",
            }}
          />

          {/* scroll indicator (fades after the user starts scrolling) */}
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-[20] pointer-events-none"
            style={{ opacity: indicatorOpacity }}
          >
            <div
              className="text-[10px] tracking-[0.4em] uppercase"
              style={{ color: GOLD, opacity: 0.7 }}
            >
              Scroll to walk the archive
            </div>
            <div
              className="w-[1px] h-12 opacity-50"
              style={{
                background: `linear-gradient(to bottom, ${GOLD}, transparent)`,
              }}
            />
            <ChevronDown
              className="w-4 h-4 -mt-2"
              style={{ color: GOLD, opacity: 0.6 }}
            />
          </motion.div>
        </div>
      </section>

      {/* Modal — portaled to document.body so it escapes the
          <main> element's z-10 stacking context and renders above
          the global fixed header. */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {opened && (
              <ModalContent
                opened={opened}
                openedIdx={openIdx as number}
                openedPrice={openedPrice}
                propertyImage={propertyImage}
                modalRef={modalRef}
                closeBtnRef={closeBtnRef}
                onClose={() => setOpenIdx(null)}
                onExplore={onExplore}
              />
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}

interface ModalContentProps {
  opened: {
    plan: any;
    side: "left" | "right";
    zPos: number;
    image: string | null;
  };
  openedIdx: number;
  openedPrice: number;
  propertyImage: Record<string, string>;
  modalRef: React.RefObject<HTMLDivElement | null>;
  closeBtnRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onExplore: (target: string) => void;
}

function ModalContent({
  opened,
  openedIdx,
  openedPrice,
  propertyImage,
  modalRef,
  closeBtnRef,
  onClose,
  onExplore,
}: ModalContentProps) {
  return (
          <motion.div
            key="plan-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
            style={{
              background: "rgba(0,0,0,0.92)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) onClose();
            }}
            data-testid="plan-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={opened.plan.name}
            ref={modalRef}
          >
            <button
              type="button"
              ref={closeBtnRef}
              className="absolute top-5 right-5 md:top-6 md:right-6 w-10 h-10 flex items-center justify-center text-white/60 hover:text-white transition-colors z-[120] rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-sm"
              onClick={onClose}
              data-testid="button-close-plan-modal"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.div
              initial={{ y: 30, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 30, scale: 0.96 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-[4px] min-h-[500px] max-h-[90vh] md:max-h-[80vh]"
              style={{
                background: "rgba(10,10,10,0.95)",
                border: "1px solid rgba(113,113,122,0.6)",
              }}
            >
              {/* content */}
              <div className="p-7 md:p-12 flex flex-col justify-center gap-5 overflow-y-auto">
                <span
                  className="inline-block self-start px-3 py-2 text-[10px] tracking-[0.4em] uppercase font-semibold border"
                  style={{
                    color: GOLD,
                    background: "rgba(212,175,55,0.1)",
                    borderColor: "rgba(212,175,55,0.2)",
                  }}
                >
                  {opened.plan.propertyName || "Featured"}
                </span>
                <h2 className="font-heading font-bold text-3xl md:text-5xl tracking-tight leading-[1.05] text-white">
                  {opened.plan.name}
                </h2>
                {opened.plan.tagline && (
                  <p className="text-zinc-400 leading-relaxed font-light text-sm md:text-base">
                    {opened.plan.tagline}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-8 gap-y-3 mt-1">
                  {openedPrice > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">
                        Yearly
                      </div>
                      <div className="text-base text-zinc-100 font-medium">
                        ₹{openedPrice.toLocaleString("en-IN")}
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        ≈ ₹{Math.round(openedPrice / 12).toLocaleString("en-IN")}/mo
                      </div>
                    </div>
                  )}
                  {opened.plan.occupancy && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mb-1">
                        Occupancy
                      </div>
                      <div className="text-base text-zinc-100 font-medium">
                        {opened.plan.occupancy}
                      </div>
                    </div>
                  )}
                </div>
                {(opened.plan.items || []).length > 0 && (
                  <ul className="space-y-2 mt-2">
                    {(opened.plan.items || []).slice(0, 6).map((item: any) => {
                      const val =
                        item.featureValue ||
                        `${item.includedQty ?? ""} ${item.unit ?? ""}`.trim();
                      return (
                        <li
                          key={item.id}
                          className="flex items-start gap-3 text-sm text-zinc-300"
                        >
                          <Check
                            className="w-4 h-4 mt-0.5 shrink-0"
                            style={{ color: GOLD }}
                          />
                          <span>
                            {item.label}{" "}
                            {val && (
                              <span className="text-white font-medium">
                                {val}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                    {(opened.plan.items || []).length > 6 && (
                      <li className="text-[10px] text-zinc-500 pl-7 tracking-widest uppercase">
                        +{(opened.plan.items || []).length - 6} more inclusions
                      </li>
                    )}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => {
                    const target = opened.plan.propertySlug
                      ? `/properties/${opened.plan.propertySlug}`
                      : opened.plan.propertyId
                        ? `/properties/${opened.plan.propertyId}`
                        : "/properties";
                    onExplore(target);
                  }}
                  className="mt-3 self-start inline-flex items-center gap-2 px-7 py-3 text-black text-xs font-bold tracking-[0.25em] uppercase transition-colors"
                  style={{ background: GOLD }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#b8962c";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = GOLD;
                  }}
                  data-testid={`button-explore-plan-modal-${opened.plan.id}`}
                >
                  Explore & Book
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* gallery */}
              <div className="relative bg-black min-h-[240px] md:min-h-0">
                {opened.image ? (
                  <img
                    src={opened.image}
                    alt={opened.plan.propertyName || ""}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(212,175,55,0.25) 0%, #1a1a1a 60%, #000 100%)",
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-l from-transparent via-transparent to-black/30 pointer-events-none" />
                <div className="absolute bottom-4 right-4 text-[10px] tracking-[0.4em] uppercase text-white/50">
                  Plan.{String(openedIdx + 1).padStart(2, "0")}
                </div>
              </div>
            </motion.div>
          </motion.div>
  );
}
