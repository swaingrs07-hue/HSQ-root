import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

const THRESHOLD = 80;
const MAX_PULL = 120;

interface PullToRefreshProps {
  children: React.ReactNode;
  scrollRef?: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function PullToRefresh({ children, scrollRef, className }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isPulling = useRef(false);

  const getScrollTop = useCallback(() => {
    if (scrollRef?.current) {
      return scrollRef.current.scrollTop;
    }
    return window.scrollY || document.documentElement.scrollTop;
  }, [scrollRef]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (refreshing) return;
    if (getScrollTop() > 5) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = false;
  }, [refreshing, getScrollTop]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (refreshing) return;
    if (getScrollTop() > 5) {
      if (isPulling.current) {
        isPulling.current = false;
        setPulling(false);
        setPullDistance(0);
      }
      return;
    }

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;

    if (diff > 10) {
      isPulling.current = true;
      setPulling(true);
      const distance = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(distance);
      if (diff > 20) {
        e.preventDefault();
      }
    }
  }, [refreshing, getScrollTop]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await queryClient.invalidateQueries();
        await new Promise((resolve) => setTimeout(resolve, 600));
      } finally {
        setRefreshing(false);
        setPullDistance(0);
        setPulling(false);
      }
    } else {
      setPullDistance(0);
      setPulling(false);
    }
  }, [pullDistance]);

  useEffect(() => {
    const target = scrollRef?.current || document;
    const opts: AddEventListenerOptions = { passive: false };
    const passiveOpts: AddEventListenerOptions = { passive: true };

    target.addEventListener("touchstart", handleTouchStart as EventListener, passiveOpts);
    target.addEventListener("touchmove", handleTouchMove as EventListener, opts);
    target.addEventListener("touchend", handleTouchEnd as EventListener, passiveOpts);

    return () => {
      target.removeEventListener("touchstart", handleTouchStart as EventListener);
      target.removeEventListener("touchmove", handleTouchMove as EventListener);
      target.removeEventListener("touchend", handleTouchEnd as EventListener);
    };
  }, [scrollRef, handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const showIndicator = pulling || refreshing;

  return (
    <div className={className}>
      <div
        className="flex items-center justify-center overflow-hidden transition-all"
        style={{
          height: showIndicator ? `${pullDistance}px` : 0,
          opacity: showIndicator ? 1 : 0,
          transition: !isPulling.current ? "all 0.3s ease" : "none",
        }}
        data-testid="pull-to-refresh-indicator"
      >
        <div className="flex flex-col items-center gap-1 py-2">
          {refreshing ? (
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          ) : (
            <div
              className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent"
              style={{
                transform: `rotate(${progress * 360}deg)`,
                opacity: 0.4 + progress * 0.6,
                transition: !isPulling.current ? "transform 0.3s ease" : "none",
              }}
            />
          )}
          <span className="text-xs text-slate-400">
            {refreshing ? "Refreshing..." : progress >= 1 ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>
      {children}
    </div>
  );
}
