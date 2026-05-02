import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Play, ArrowRight, Sparkles } from "lucide-react";

type Chapter = {
  number: string;
  eyebrow: string;
  title: string;
  italic: string;
  body: string;
  videoSrc?: string;
  posterSrc?: string;
};

const CHAPTERS: Chapter[] = [
  {
    number: "01",
    eyebrow: "Arrival",
    title: "A welcome",
    italic: "without ceremony",
    body:
      "Step out of the city and into a quieter rhythm. Personal greetings replace front desks, and your suite is already breathing in your preferences — temperature, scent, music, light.",
    posterSrc:
      "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1600&q=80",
  },
  {
    number: "02",
    eyebrow: "The Suites",
    title: "Spaces designed for",
    italic: "stillness",
    body:
      "Every suite is composed around natural light, considered materials, and an outlook on the city. From the linen on the bed to the mineral in the bath, nothing is borrowed and nothing is loud.",
    posterSrc:
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1600&q=80",
  },
  {
    number: "03",
    eyebrow: "The Table",
    title: "Cuisine, written",
    italic: "by season",
    body:
      "Our chefs cook from the coast and the hills, refusing nothing seasonal and nothing local. Tasting menus, candlelit private dining, and a quiet bar that never raises its voice.",
    posterSrc:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80",
  },
  {
    number: "04",
    eyebrow: "Wellness",
    title: "A sanctuary",
    italic: "by design",
    body:
      "A spa carved out of warm stone, a quiet pool that holds the morning light, treatments built around old practices and new science. Recover the version of yourself you remember.",
    posterSrc:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1600&q=80",
  },
  {
    number: "05",
    eyebrow: "Departure",
    title: "A goodbye that",
    italic: "lingers",
    body:
      "Late check-outs, tailored transfers, and small rituals that turn departure into an invitation back. You leave a guest, you return a familiar face.",
    posterSrc:
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1600&q=80",
  },
];

export default function HotelsExperience() {
  useEffect(() => {
    document.title = "Experience | Hsquare Hotels";
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  return (
    <div data-testid="hotels-experience-page">
      {/* HERO with aurora lights */}
      <section
        className="relative min-h-[88vh] flex items-center overflow-hidden"
        data-testid="experience-hero"
      >
        {/* Aurora gradient field */}
        <div className="absolute inset-0" style={{ backgroundColor: "var(--hotels-section-bg, #050505)" }} />
        <Aurora />

        <div className="relative z-10 container mx-auto px-4 sm:px-6 py-32 sm:py-40">
          <div className="max-w-5xl mx-auto text-center">
            <p
              className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] sm:tracking-[0.5em] mb-6 sm:mb-8"
              style={{ color: "#c5a059" }}
              data-testid="hero-eyebrow"
            >
              ◇ The Hsquare Experience ◇
            </p>
            <h1
              className="hotels-display text-white text-5xl sm:text-7xl md:text-8xl lg:text-[140px] leading-[0.95] mb-8"
              data-testid="hero-title"
            >
              Five chapters
              <br />
              of{" "}
              <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>
                quiet luxury
              </span>
            </h1>
            <p className="text-white/55 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-light mb-10">
              Not a brochure. Not a list of amenities. A short film about how a stay
              should actually feel — written, shot, and lived from arrival to farewell.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <a
                href="#chapter-01"
                className="inline-flex items-center gap-3 px-8 py-4 text-black uppercase text-xs tracking-[0.25em] font-semibold transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: "#c5a059",
                  boxShadow: "0 16px 48px rgba(197,160,89,0.35)",
                }}
                data-testid="button-begin"
              >
                Begin the story <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                href="/hotels/rooms"
                className="inline-flex items-center gap-3 px-8 py-4 text-white uppercase text-xs tracking-[0.25em] font-semibold border border-white/20 hover:border-white/40 transition-all"
                data-testid="button-rooms"
              >
                Explore rooms
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom fade into chapters */}
        <div
          className="absolute bottom-0 inset-x-0 h-32 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent, var(--hotels-section-bg, #050505))",
          }}
        />
      </section>

      {/* CHAPTERS */}
      {CHAPTERS.map((c, i) => (
        <ChapterSection key={c.number} chapter={c} index={i} />
      ))}

      {/* CLOSING CTA */}
      <section
        className="relative py-24 md:py-32 px-4 sm:px-6 overflow-hidden"
        style={{ backgroundColor: "var(--hotels-section-bg, #080808)" }}
        data-testid="experience-cta"
      >
        <h2
          className="hotels-display absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-white/[0.03] pointer-events-none select-none"
          style={{ fontSize: "clamp(60px, 18vw, 280px)", lineHeight: 0.8 }}
          aria-hidden
        >
          STAY
        </h2>
        <div className="relative z-10 container mx-auto max-w-3xl text-center">
          <p
            className="text-[10px] sm:text-[11px] uppercase tracking-[0.4em] mb-6"
            style={{ color: "#c5a059" }}
          >
            ◇ Ready to write yours? ◇
          </p>
          <h2 className="hotels-display text-white text-4xl sm:text-5xl md:text-6xl lg:text-7xl mb-10 leading-[1.05]">
            Begin your own
            <br />
            <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>
              chapter
            </span>
          </h2>
          <Link
            href="/hotels/rooms"
            className="inline-flex items-center gap-3 px-10 py-5 text-black uppercase text-xs tracking-[0.3em] font-semibold transition-all hover:scale-[1.02]"
            style={{
              backgroundColor: "#c5a059",
              boxShadow: "0 16px 48px rgba(197,160,89,0.4)",
            }}
            data-testid="button-cta-reserve"
          >
            Reserve your stay <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ───────── Chapter section ───────── */

function ChapterSection({ chapter, index }: { chapter: Chapter; index: number }) {
  const isOdd = index % 2 === 1;
  return (
    <section
      id={`chapter-${chapter.number}`}
      className="relative py-20 md:py-28 lg:py-36 px-4 sm:px-6 overflow-hidden"
      style={{
        backgroundColor:
          index % 2 === 0
            ? "var(--hotels-section-bg, #050505)"
            : "var(--hotels-alt-bg, #080808)",
      }}
      data-testid={`chapter-section-${chapter.number}`}
    >
      <div className="container mx-auto max-w-7xl">
        <div
          className={`grid lg:grid-cols-12 gap-10 lg:gap-16 items-center ${
            isOdd ? "lg:[direction:rtl]" : ""
          }`}
        >
          {/* Video / poster */}
          <div className={`lg:col-span-7 ${isOdd ? "lg:[direction:ltr]" : ""}`}>
            <ChapterMedia chapter={chapter} />
          </div>

          {/* Copy */}
          <div className={`lg:col-span-5 ${isOdd ? "lg:[direction:ltr]" : ""}`}>
            <div className="flex items-center gap-4 mb-6">
              <span
                className="hotels-display text-5xl sm:text-6xl"
                style={{ color: "#c5a059", fontWeight: 300 }}
              >
                {chapter.number}
              </span>
              <div className="h-px flex-1" style={{ backgroundColor: "rgba(197,160,89,0.3)" }} />
              <span
                className="text-[10px] sm:text-[11px] uppercase tracking-[0.35em]"
                style={{ color: "#c5a059" }}
              >
                {chapter.eyebrow}
              </span>
            </div>

            <h2 className="hotels-display text-white text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.05] mb-6">
              {chapter.title}
              <br />
              <span style={{ fontStyle: "italic", color: "#c5a059", fontWeight: 300 }}>
                {chapter.italic}
              </span>
            </h2>

            <p className="text-white/55 text-sm sm:text-base md:text-lg leading-relaxed font-light max-w-lg">
              {chapter.body}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────── Media tile ─────────
   - When `videoSrc` is set: real <video> with hover/click controls.
   - When only `posterSrc` is set: shows the still with a "Film coming soon"
     overlay so the layout is final before the user uploads videos.
*/
function ChapterMedia({ chapter }: { chapter: Chapter }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  return (
    <div
      className="relative aspect-[16/10] sm:aspect-[16/9] overflow-hidden border border-white/10 group"
      style={{ background: "var(--hotels-glass-bg, rgba(255,255,255,0.02))" }}
      data-testid={`chapter-media-${chapter.number}`}
    >
      {/* Background — poster always present so the slot looks polished
          even before videos are uploaded. */}
      {chapter.posterSrc && (
        <div
          className="absolute inset-0 transition-transform duration-[2000ms] group-hover:scale-105"
          style={{
            backgroundImage: `url(${chapter.posterSrc})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Real video, only rendered if a source is provided */}
      {chapter.videoSrc && (
        <video
          ref={videoRef}
          src={chapter.videoSrc}
          poster={chapter.posterSrc}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          loop
          onClick={togglePlay}
          data-testid={`chapter-video-${chapter.number}`}
        />
      )}

      {/* Soft veil for legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {/* Center play / placeholder badge */}
      {chapter.videoSrc ? (
        <button
          type="button"
          onClick={togglePlay}
          className={`absolute inset-0 flex items-center justify-center transition-opacity ${
            playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          }`}
          aria-label={playing ? "Pause film" : "Play film"}
          data-testid={`button-play-${chapter.number}`}
        >
          <span
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center backdrop-blur-md transition-transform group-hover:scale-110"
            style={{
              background: "rgba(197,160,89,0.95)",
              boxShadow: "0 16px 48px rgba(197,160,89,0.45)",
            }}
          >
            <Play className="w-6 h-6 sm:w-7 sm:h-7 text-black ml-1" fill="currentColor" />
          </span>
        </button>
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-end justify-end p-5 sm:p-7"
          data-testid={`placeholder-${chapter.number}`}
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 backdrop-blur-md border border-white/15"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <Sparkles className="w-3 h-3" style={{ color: "#c5a059" }} />
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/80">
              Film coming soon
            </span>
          </div>
        </div>
      )}

      {/* Top-left chapter tag */}
      <div className="absolute top-4 left-4 sm:top-5 sm:left-5">
        <span
          className="text-[10px] uppercase tracking-[0.3em] px-3 py-1.5 backdrop-blur-md border border-white/15"
          style={{ background: "rgba(0,0,0,0.4)", color: "#c5a059" }}
        >
          Chapter {chapter.number}
        </span>
      </div>
    </div>
  );
}

/* ───────── Aurora gradient lights for the hero ───────── */

function Aurora() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Soft amber field */}
      <div
        className="absolute -top-1/4 -left-1/4 w-[80vw] h-[80vw] rounded-full blur-[140px] opacity-40"
        style={{
          background:
            "radial-gradient(circle at center, rgba(197,160,89,0.6) 0%, rgba(197,160,89,0) 70%)",
        }}
      />
      {/* Cool teal counter-light */}
      <div
        className="absolute top-1/3 -right-1/4 w-[70vw] h-[70vw] rounded-full blur-[140px] opacity-30"
        style={{
          background:
            "radial-gradient(circle at center, rgba(80,140,180,0.55) 0%, rgba(80,140,180,0) 70%)",
        }}
      />
      {/* Warm magenta lower wash */}
      <div
        className="absolute -bottom-1/4 left-1/4 w-[90vw] h-[60vw] rounded-full blur-[160px] opacity-25"
        style={{
          background:
            "radial-gradient(circle at center, rgba(180,90,120,0.5) 0%, rgba(180,90,120,0) 70%)",
        }}
      />
      {/* Subtle grain via repeating gradient for filmic feel */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />
    </div>
  );
}
