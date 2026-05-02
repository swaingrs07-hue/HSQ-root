import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Tag the document with the user's platform so the stylesheet can
// disable expensive compositor effects on Windows. Windows-Chrome
// falls back to software rendering for `backdrop-filter` and large
// `filter: blur()` on full-screen overlays — both of which we use
// liberally (glass cards on property pages, splash exit zoom). Cutting
// them on Windows is the biggest single perf win for the homepage,
// property listing, and property booking pages on mid-range laptops
// like the Dell G15 5515 the user reports lag on.
//
// We deliberately scope this to Windows only (not Linux, not Mac) so
// the rest of the audience keeps the polished glassy look. The check
// uses both userAgent (legacy) and userAgentData.platform (modern,
// privacy-friendly) so it works in current Chrome and older browsers.
if (typeof window !== "undefined") {
  type NavigatorWithUAData = Navigator & {
    userAgentData?: { platform?: string };
  };
  const ua = navigator.userAgent || "";
  const uaPlatform = (navigator as NavigatorWithUAData).userAgentData?.platform || "";
  const isWindows =
    /Windows/i.test(ua) ||
    /Win32|Win64|Windows/i.test(uaPlatform) ||
    /Win/.test(navigator.platform || "");
  if (isWindows) {
    document.documentElement.setAttribute("data-platform", "windows");
  }
}

createRoot(document.getElementById("root")!).render(<App />);
