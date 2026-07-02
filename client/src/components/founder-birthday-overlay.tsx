import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, X } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const SESSION_KEY = "hsq_founder_greeting_shown";

const MESSAGE_LINES = [
  "Today is your birthday, but it feels like my own celebration.",
  "I exist because you dreamed of me. You gave me my name, my purpose, and my identity. From a single vision, you built me into Hsquare—a place where dreams grow, opportunities are created, and lives are transformed.",
  "Every milestone I achieve, every smile I create, and every life I touch carries a part of your vision.",
  "Thank you for believing in me before anyone else did. I promise to keep growing, keep inspiring, and keep making you proud.",
  "Happy Birthday to my Creator, my Founder, and my CEO.",
];

const TITLE_DELAY = 0.3;
const LINE_STAGGER = 1.4;
const LINE_DURATION = 0.6;
const SIGNATURE_DELAY = TITLE_DELAY + MESSAGE_LINES.length * LINE_STAGGER + 0.6;
const READ_PAUSE_SEC = 6;
const READY_DELAY_MS = (SIGNATURE_DELAY + 0.7 + READ_PAUSE_SEC) * 1000;

interface FloatingHeart {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
}

function useFloatingHearts(count: number): FloatingHeart[] {
  return useMemo(
    () =>
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        size: 14 + Math.random() * 22,
        delay: Math.random() * 6,
        duration: 8 + Math.random() * 6,
        drift: (Math.random() - 0.5) * 80,
      })),
    [count],
  );
}

export function FounderBirthdayOverlay() {
  const { user, isAuthenticated, token } = useAuth();
  const [visible, setVisible] = useState(false);
  const [mandatory, setMandatory] = useState(false);
  const [canContinue, setCanContinue] = useState(false);
  const alreadyHandled = typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1";

  const { data } = useQuery<{ eligible: boolean; mandatory?: boolean }>({
    queryKey: ["/api/founder-greeting/status", token],
    queryFn: async () => {
      const res = await fetch("/api/founder-greeting/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to check greeting status");
      return res.json();
    },
    enabled: isAuthenticated && !!user?.email && !!token && !alreadyHandled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const markViewed = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/founder-greeting/mark-viewed", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to record greeting view");
      return res.json();
    },
  });

  useEffect(() => {
    if (alreadyHandled) return;
    if (data?.eligible) {
      setMandatory(!!data.mandatory);
      setVisible(true);
    }
  }, [data, alreadyHandled]);

  useEffect(() => {
    if (!visible || !mandatory) return;
    setCanContinue(false);
    const timer = setTimeout(() => setCanContinue(true), READY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible, mandatory]);

  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [visible]);

  const hearts = useFloatingHearts(16);

  if (!visible) return null;

  const handleContinue = async () => {
    try {
      await markViewed.mutateAsync();
    } catch {
      // Even if the network call fails, don't trap the founder behind the
      // overlay — it will simply show as mandatory again next time.
    }
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  const handleSkipClose = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="founder-birthday-overlay"
        data-testid="overlay-founder-birthday"
        className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/90 backdrop-blur-md p-4 py-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        onClick={!mandatory ? handleSkipClose : undefined}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {hearts.map((h, i) => (
            <motion.span
              key={i}
              className="absolute bottom-0 text-red-400/70"
              style={{ left: `${h.left}%`, fontSize: h.size }}
              initial={{ y: 0, opacity: 0, x: 0 }}
              animate={{
                y: "-110vh",
                opacity: [0, 1, 1, 0],
                x: h.drift,
              }}
              transition={{
                duration: h.duration,
                delay: h.delay,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              ❤
            </motion.span>
          ))}
        </div>

        <motion.div
          data-testid="card-founder-birthday"
          className="relative w-full max-w-xl rounded-3xl border border-red-500/20 bg-gradient-to-b from-neutral-900/90 to-black/90 p-8 text-center shadow-2xl md:p-12"
          initial={{ scale: 0.85, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {!mandatory && (
            <button
              type="button"
              onClick={handleSkipClose}
              data-testid="button-close-founder-birthday"
              className="absolute right-4 top-4 rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          )}

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 12 }}
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-red-500/20 to-amber-400/20"
          >
            <Heart className="h-8 w-8 fill-red-500 text-red-500" />
          </motion.div>

          <motion.h1
            data-testid="text-founder-birthday-title"
            className="mb-6 bg-gradient-to-r from-red-400 via-pink-400 to-amber-300 bg-clip-text text-2xl font-bold text-transparent md:text-3xl"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: TITLE_DELAY, duration: 0.7 }}
          >
            Happy Birthday, Mr. Pabitra! ❤️
          </motion.h1>

          <div className="space-y-4 text-left md:text-center">
            {MESSAGE_LINES.map((line, i) => (
              <motion.p
                key={i}
                data-testid={`text-founder-birthday-line-${i}`}
                className="text-sm leading-relaxed text-white/80 md:text-base"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: TITLE_DELAY + (i + 1) * LINE_STAGGER, duration: LINE_DURATION }}
              >
                {line}
              </motion.p>
            ))}
          </div>

          <motion.div
            data-testid="text-founder-birthday-signature"
            className="mt-8 border-t border-white/10 pt-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: SIGNATURE_DELAY, duration: 0.7 }}
          >
            <p className="text-sm text-white/60">With endless gratitude,</p>
            <p className="mt-1 bg-gradient-to-r from-amber-300 to-red-400 bg-clip-text text-lg font-semibold text-transparent">
              Hsquare Living ❤️
            </p>
          </motion.div>

          {mandatory && (
            <AnimatePresence>
              {canContinue && (
                <motion.button
                  type="button"
                  data-testid="button-continue-founder-birthday"
                  onClick={handleContinue}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-8 rounded-full bg-gradient-to-r from-red-500 to-amber-500 px-8 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                >
                  Continue
                </motion.button>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
