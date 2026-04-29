import { useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { ArrowRight, Check, X, ChevronDown } from "lucide-react";

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

  const lastZ = frames.length > 0 ? Math.abs(frames[frames.length - 1].zPos) : 0;
  const trackZ = useTransform(scrollYProgress, [0, 1], [0, lastZ + 800]);
  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  // Outer container height: roughly one viewport per frame so the user has
  // enough scroll runway to walk through the entire archive.
  const outerVh = Math.max(1, frames.length) * 90 + 60;

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
            perspective: "2400px",
            perspectiveOrigin: "50% 50%",
            background:
              "radial-gradient(circle at 50% 40%, #0d0d0d 0%, #000 70%)",
          }}
        >
          {/* hallway track */}
          <motion.div
            className="absolute inset-0 w-full h-full"
            style={{ transformStyle: "preserve-3d", translateZ: trackZ }}
          >
            {frames.map((frame, idx) => {
              const isLeft = frame.side === "left";
              const baseTransform = `translate3d(0, 0, ${frame.zPos}px) rotateY(${
                isLeft ? "35deg" : "-35deg"
              })`;
              const hoverTransform = `translate3d(0, 0, ${
                frame.zPos + 20
              }px) rotateY(${isLeft ? "35deg" : "-35deg"}) scale(1.05)`;
              return (
                <button
                  key={frame.plan.id}
                  type="button"
                  className={`absolute top-[24%] sm:top-[27%] cursor-pointer group ${
                    isLeft ? "left-[10%] md:left-[20%]" : "right-[10%] md:right-[20%]"
                  }`}
                  style={{
                    width: 260,
                    height: 380,
                    transformStyle: "preserve-3d",
                    transform: baseTransform,
                    border: "1px solid rgba(255,255,255,0.04)",
                    background: "rgba(10,10,10,0.6)",
                    borderRadius: 4,
                    overflow: "hidden",
                    transition:
                      "filter 0.4s ease, transform 0.4s ease, box-shadow 0.4s ease",
                  }}
                  onClick={() => setOpenIdx(idx)}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.filter = "brightness(1.35)";
                    el.style.boxShadow = `0 0 40px ${GOLD.replace(
                      "rgb",
                      "rgba",
                    ).replace(")", ",0.18)")}`;
                    el.style.transform = hoverTransform;
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.filter = "";
                    el.style.boxShadow = "";
                    el.style.transform = baseTransform;
                  }}
                  onFocus={(e) => {
                    const el = e.currentTarget;
                    el.style.filter = "brightness(1.35)";
                    el.style.boxShadow = `0 0 40px ${GOLD.replace(
                      "rgb",
                      "rgba",
                    ).replace(")", ",0.18)")}`;
                  }}
                  onBlur={(e) => {
                    const el = e.currentTarget;
                    el.style.filter = "";
                    el.style.boxShadow = "";
                  }}
                  data-testid={`plan-frame-${frame.plan.id}`}
                  aria-label={`Open ${frame.plan.name}${
                    frame.plan.propertyName
                      ? " at " + frame.plan.propertyName
                      : ""
                  }`}
                >
                  {frame.image ? (
                    <img
                      src={frame.image}
                      alt=""
                      className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity duration-500"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{
                        background:
                          "linear-gradient(160deg, rgba(212,175,55,0.28) 0%, rgba(8,8,12,0.6) 60%, rgba(0,0,0,0.85) 100%)",
                      }}
                    />
                  )}
                  {/* dark scrim for legibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30 pointer-events-none" />
                  {/* tier glow accent at the top */}
                  <div
                    className="absolute inset-x-0 top-0 h-12 pointer-events-none opacity-70"
                    style={{
                      background:
                        "linear-gradient(to bottom, rgba(212,175,55,0.18), transparent)",
                    }}
                  />
                  {/* hover gold halo at top */}
                  <div
                    className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background:
                        "radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.25), transparent 60%)",
                    }}
                  />
                  {/* plan name overlay */}
                  <div className="absolute inset-x-5 bottom-16 pointer-events-none">
                    <div
                      className="text-[9px] tracking-[0.45em] uppercase mb-2"
                      style={{ color: GOLD, opacity: 0.9 }}
                    >
                      {frame.plan.propertyName || ""}
                    </div>
                    <div className="font-heading font-bold text-2xl leading-[1.1] text-white">
                      {frame.plan.name}
                    </div>
                  </div>
                  {/* bottom volume label */}
                  <div className="absolute bottom-0 left-0 right-0 px-5 py-5 flex items-end justify-between text-[10px] tracking-[0.4em] uppercase text-white/60">
                    <span>Plan.{String(idx + 1).padStart(2, "0")}</span>
                    <span style={{ color: GOLD, opacity: 0.7 }}>View →</span>
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
  opened: { plan: any; side: "left" | "right"; zPos: number };
  openedIdx: number;
  openedPrice: number;
  propertyImage: Record<string, string>;
  modalRef: React.RefObject<HTMLDivElement>;
  closeBtnRef: React.RefObject<HTMLButtonElement>;
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
                    {(opened.plan.items || []).slice(0, 6).map((item) => {
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
