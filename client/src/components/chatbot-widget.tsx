import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X, Send, Loader2, User, Mic, Square, GripHorizontal, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import gyanAvatar from "@/assets/gyan-ai-avatar.png";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  isVoice?: boolean;
}

interface ChatbotSettings {
  enabled: boolean;
  botName: string;
  greetingMessage: string;
  tone: string;
  defaultLanguage: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  outsideHoursMessage: string;
}

// ── Voice recorder with VAD (Voice Activity Detection) ──────────────────────
function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [volume, setVolume] = useState(0); // 0–1, drives waveform bars

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const onSilenceCbRef = useRef<(() => void) | null>(null);

  const stopVAD = useCallback(() => {
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current = null;
    silenceStartRef.current = null;
    setVolume(0);
  }, []);

  const startRecording = useCallback(async (onSilence?: () => void): Promise<boolean> => {
    try {
      onSilenceCbRef.current = onSilence || null;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // VAD via AudioContext
      const audioCtx = new AudioContext();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      silenceStartRef.current = null;
      const dataArr = new Uint8Array(analyser.frequencyBinCount);

      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArr);
        let rms = 0;
        for (const v of dataArr) rms += (v - 128) ** 2;
        rms = Math.sqrt(rms / dataArr.length) / 128;
        setVolume(Math.min(rms * 5, 1));

        if (rms < 0.018) {
          if (!silenceStartRef.current) silenceStartRef.current = Date.now();
          else if (Date.now() - silenceStartRef.current > 1600 && onSilenceCbRef.current) {
            onSilenceCbRef.current();
            onSilenceCbRef.current = null;
            stopVAD();
          }
        } else {
          silenceStartRef.current = null;
        }
      }, 80);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      setIsRecording(true);
      return true;
    } catch {
      return false;
    }
  }, [stopVAD]);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    stopVAD();
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") { resolve(null); return; }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        resolve(blob);
      };
      recorder.stop();
    });
  }, [stopVAD]);

  return { isRecording, isProcessing, setIsProcessing, volume, startRecording, stopRecording };
}

// ── Gapless streaming audio queue ────────────────────────────────────────────
function useAudioQueue() {
  const queueRef = useRef<string[]>([]);
  const playingRef = useRef(false);
  const currentRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      playingRef.current = false;
      setIsPlaying(false);
      return;
    }
    const chunk = queueRef.current.shift()!;
    const audio = new Audio(`data:audio/mp3;base64,${chunk}`);
    currentRef.current = audio;
    audio.onended = playNext;
    audio.onerror = playNext;
    audio.play().catch(playNext);
  }, []);

  const enqueue = useCallback((base64: string) => {
    queueRef.current.push(base64);
    if (!playingRef.current) {
      playingRef.current = true;
      setIsPlaying(true);
      playNext();
    }
  }, [playNext]);

  const stop = useCallback(() => {
    queueRef.current = [];
    if (currentRef.current) { currentRef.current.pause(); currentRef.current = null; }
    playingRef.current = false;
    setIsPlaying(false);
  }, []);

  return { enqueue, stop, isPlaying };
}

// ── Waveform bars ─────────────────────────────────────────────────────────────
function WaveformBars({ volume, active, color = "#c5a059" }: { volume: number; active: boolean; color?: string }) {
  const heights = [0.35, 0.6, 1.0, 0.6, 0.35, 0.8, 0.45];
  return (
    <div className="flex items-center gap-[3px] h-8">
      {heights.map((base, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: color }}
          animate={active
            ? { height: `${Math.max(4, (base * 0.4 + volume * base * 0.6) * 28)}px`, opacity: 0.7 + volume * 0.3 }
            : { height: "4px", opacity: 0.25 }}
          transition={{ duration: 0.08, ease: "easeOut", delay: i * 0.012 }}
        />
      ))}
    </div>
  );
}

// ── Glass styles ──────────────────────────────────────────────────────────────
const glass = {
  panel: {
    background: "rgba(10, 10, 18, 0.78)",
    backdropFilter: "blur(40px) saturate(180%)",
    WebkitBackdropFilter: "blur(40px) saturate(180%)",
    border: "1px solid rgba(255,255,255,0.11)",
    boxShadow: "0 32px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)",
  } as React.CSSProperties,
  surface: {
    background: "rgba(255,255,255,0.055)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.12)",
  } as React.CSSProperties,
  user: {
    background: "rgba(197,160,89,0.11)",
    border: "1px solid rgba(197,160,89,0.22)",
  } as React.CSSProperties,
  divider: { borderTop: "1px solid rgba(255,255,255,0.07)" } as React.CSSProperties,
};
const SF = { fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display',system-ui,sans-serif" };

// ── Main widget ───────────────────────────────────────────────────────────────
export function ChatbotWidget() {
  const { data: settings } = useQuery<ChatbotSettings>({
    queryKey: ["/api/chatbot/settings"],
    staleTime: 5 * 60 * 1000,
  });

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"text" | "voice">("text");

  const defaultGreeting = () =>
    settings?.greetingMessage ||
    "Hi, I'm H Orbit.\n\nI manage your entire living experience — bookings, rooms, meals, security, and support.\n\nType a message or switch to Voice to speak.";

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "assistant", content: defaultGreeting() },
  ]);

  useEffect(() => {
    if (settings?.greetingMessage) {
      setMessages([{ id: "welcome", role: "assistant", content: settings.greetingMessage }]);
    }
  }, [settings?.greetingMessage]);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  const { isRecording, isProcessing, setIsProcessing, volume, startRecording, stopRecording } = useVoiceRecorder();
  const { enqueue, stop: stopAudio, isPlaying } = useAudioQueue();

  useEffect(() => {
    if (scrollAreaRef.current) {
      const sc = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (sc) sc.scrollTop = sc.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && mode === "text") setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen, mode]);

  // ── Text chat ─────────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: inputValue.trim() };
    const asstMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: "assistant", content: "", isStreaming: true };
    setMessages((prev) => [...prev, userMsg, asstMsg]);
    setInputValue("");
    setIsLoading(true);
    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      if (!res.ok) throw new Error();
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error();
      let acc = "", buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6).trim());
            if (data.content) {
              acc += data.content;
              setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, content: acc } : m));
            }
            if (data.done) setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, isStreaming: false } : m));
          } catch {}
        }
      }
      setMessages((prev) => prev.map((m) => m.id === asstMsg.id ? { ...m, isStreaming: false } : m));
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === asstMsg.id ? { ...m, content: "Sorry, something went wrong. Please try again.", isStreaming: false } : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Streaming voice pipeline ──────────────────────────────────────────────
  const processVoiceBlob = useCallback(async (blob: Blob) => {
    setIsProcessing(true);
    const base64 = await new Promise<string>((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve((fr.result as string).split(",")[1]);
      fr.readAsDataURL(blob);
    });

    const userMsgId = Date.now().toString();
    const asstMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: "🎤 …", isVoice: true },
      { id: asstMsgId, role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/chatbot/voice-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64, messages: history }),
      });
      if (!res.ok) throw new Error();

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let currentEvent = "";
      let fullText = "";
      let firstAudio = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === "transcript") {
                setMessages((prev) => prev.map((m) =>
                  m.id === userMsgId ? { ...m, content: data.text || "🎤 Voice message" } : m
                ));
                setIsProcessing(false);
              } else if (currentEvent === "chunk") {
                fullText += data.content;
                setMessages((prev) => prev.map((m) =>
                  m.id === asstMsgId ? { ...m, content: fullText } : m
                ));
                if (firstAudio) { firstAudio = false; }
              } else if (currentEvent === "audio") {
                enqueue(data.data);
              } else if (currentEvent === "done") {
                setMessages((prev) => prev.map((m) =>
                  m.id === asstMsgId ? { ...m, isStreaming: false } : m
                ));
              } else if (currentEvent === "error") {
                throw new Error(data.message);
              }
            } catch {}
          }
        }
      }
      setMessages((prev) => prev.map((m) => m.id === asstMsgId ? { ...m, isStreaming: false } : m));
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === asstMsgId ? { ...m, content: "Couldn't process voice. Please try again.", isStreaming: false } : m
      ));
    } finally {
      setIsProcessing(false);
    }
  }, [messages, enqueue, setIsProcessing]);

  const handleMicTap = useCallback(async () => {
    // If AI is speaking — interrupt it
    if (isPlaying) { stopAudio(); return; }

    if (isRecording) {
      // Manual stop — don't wait for VAD
      const blob = await stopRecording();
      if (blob && blob.size > 1000) await processVoiceBlob(blob);
    } else {
      // Start recording with auto-stop on silence
      await startRecording(async () => {
        const blob = await stopRecording();
        if (blob && blob.size > 1000) await processVoiceBlob(blob);
      });
    }
  }, [isPlaying, isRecording, stopAudio, startRecording, stopRecording, processVoiceBlob]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  if (settings?.enabled === false) return null;

  const voiceState = isRecording ? "listening" : isProcessing ? "thinking" : isPlaying ? "speaking" : "idle";
  const statusLabel = voiceState === "listening" ? "listening…" : voiceState === "thinking" ? "thinking…" : voiceState === "speaking" ? "speaking…" : "online";

  return (
    <>
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-40" />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag dragControls={dragControls} dragConstraints={constraintsRef}
            dragElastic={0.05} dragMomentum={false}
            initial={{ opacity: 0, y: 20, scale: 0.93 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.93 }}
            transition={{ type: "spring", damping: 28, stiffness: 380 }}
            className="fixed bottom-24 right-4 z-50 w-[390px] max-w-[calc(100vw-20px)] rounded-[28px] overflow-hidden"
            style={{ ...glass.panel, touchAction: "none" }}
            data-testid="chatbot-window"
          >
            {/* ── Header ── */}
            <div className="px-5 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing"
              style={glass.divider} onPointerDown={(e) => dragControls.start(e)}>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-2xl overflow-hidden flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,rgba(197,160,89,.18),rgba(100,160,255,.14))", border: "1px solid rgba(255,255,255,.14)" }}>
                  <img src={gyanAvatar} alt="H Orbit" className="w-full h-full object-cover" />
                  <span className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full ring-1 ring-black/60 transition-colors duration-500
                    ${isPlaying ? "bg-sky-400 animate-pulse" : isRecording ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold text-[14px] tracking-[-0.01em]" style={SF}>H Orbit</h3>
                    <span className="text-[9px] px-1.5 py-[2px] rounded-full text-[#c5a059]"
                      style={{ background: "rgba(197,160,89,.11)", border: "1px solid rgba(197,160,89,.22)" }}>AI</span>
                  </div>
                  <p className="text-white/35 text-[11px] flex items-center gap-1 mt-[-1px]" style={SF}>
                    <GripHorizontal className="w-2.5 h-2.5" />
                    {statusLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-[10px] p-0.5 gap-0.5"
                  style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.09)" }}>
                  {(["text", "voice"] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)}
                      className="px-2.5 py-[5px] rounded-[8px] text-[11px] font-medium capitalize transition-all duration-200"
                      style={{ ...SF, ...(mode === m ? { background: "rgba(255,255,255,.13)", color: "#fff" } : { color: "rgba(255,255,255,.38)" }) }}>
                      {m}
                    </button>
                  ))}
                </div>
                <button onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-xl flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                  style={glass.surface} data-testid="chatbot-close">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ── Messages ── */}
            <ScrollArea ref={scrollAreaRef} className="h-[340px] p-4" style={{ background: "rgba(0,0,0,.18)" }}>
              <div className="space-y-3">
                {messages.map((msg) => (
                  <motion.div key={msg.id}
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className="w-7 h-7 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden"
                      style={msg.role === "assistant"
                        ? { background: "rgba(197,160,89,.14)", border: "1px solid rgba(197,160,89,.22)" }
                        : { background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.11)" }}>
                      {msg.role === "assistant"
                        ? <img src={gyanAvatar} alt="H Orbit" className="w-full h-full object-cover" />
                        : <User className="w-3.5 h-3.5 text-white/60" />}
                    </div>
                    <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 ${msg.role === "user" ? "rounded-tr-[6px]" : "rounded-tl-[6px]"}`}
                      style={msg.role === "assistant" ? glass.surface : glass.user}>
                      <p className="text-[13.5px] text-white/88 leading-[1.55] whitespace-pre-wrap" style={SF}>
                        {msg.content}
                        {msg.isStreaming && <span className="inline-block w-[5px] h-[14px] ml-0.5 rounded-[2px] bg-[#c5a059] animate-pulse" />}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            {/* ── Input area ── */}
            <div className="p-3.5" style={glass.divider}>
              {mode === "text" ? (
                <div className="flex gap-2 items-center">
                  <Input
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Message H Orbit…"
                    className="flex-1 text-[13.5px] text-white rounded-[14px] px-4 border-0 outline-none placeholder:text-white/28 focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
                    style={{ ...glass.surface, ...SF }}
                    disabled={isLoading}
                    data-testid="chatbot-input"
                  />
                  <button onClick={sendMessage} disabled={!inputValue.trim() || isLoading}
                    className="w-10 h-10 rounded-[14px] flex items-center justify-center transition-all duration-200 disabled:opacity-35 shrink-0"
                    style={{ background: "rgba(197,160,89,.85)", border: "1px solid rgba(197,160,89,.5)" }}
                    data-testid="chatbot-send">
                    {isLoading
                      ? <Loader2 className="w-4 h-4 text-black animate-spin" />
                      : <Send className="w-4 h-4 text-black" />}
                  </button>
                </div>
              ) : (
                /* ── Voice mode ── */
                <div className="flex flex-col items-center gap-3 py-1">

                  {/* Waveform / status visual */}
                  <div className="h-8 flex items-center justify-center">
                    {voiceState === "idle" && (
                      <p className="text-[11px] text-white/28" style={SF}>tap to speak · auto-stops on silence</p>
                    )}
                    {voiceState === "listening" && (
                      <WaveformBars volume={volume} active={true} color="#ef4444" />
                    )}
                    {voiceState === "thinking" && (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-[#c5a059] animate-spin" />
                        <span className="text-[11px] text-white/40" style={SF}>H Orbit is thinking…</span>
                      </div>
                    )}
                    {voiceState === "speaking" && (
                      <div className="flex flex-col items-center gap-1.5">
                        <WaveformBars volume={0.5 + Math.sin(Date.now() / 200) * 0.3} active={true} color="#38bdf8" />
                      </div>
                    )}
                  </div>

                  {/* Mic / Stop button */}
                  <motion.button
                    onClick={handleMicTap}
                    disabled={isProcessing}
                    className="relative w-[68px] h-[68px] rounded-full flex items-center justify-center disabled:opacity-40"
                    style={{
                      background: isRecording
                        ? "rgba(239,68,68,.15)"
                        : isPlaying
                        ? "rgba(56,189,248,.12)"
                        : "rgba(197,160,89,.12)",
                      border: isRecording
                        ? "1px solid rgba(239,68,68,.45)"
                        : isPlaying
                        ? "1px solid rgba(56,189,248,.35)"
                        : "1px solid rgba(197,160,89,.32)",
                      backdropFilter: "blur(16px)",
                    }}
                    whileTap={{ scale: 0.88 }}
                    data-testid="chatbot-mic"
                  >
                    {/* Pulse rings while recording */}
                    {isRecording && (
                      <>
                        <motion.span className="absolute inset-0 rounded-full"
                          style={{ border: "1.5px solid rgba(239,68,68,.35)" }}
                          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 1.3, repeat: Infinity }} />
                        <motion.span className="absolute inset-[-12px] rounded-full"
                          style={{ border: "1px solid rgba(239,68,68,.18)" }}
                          animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{ duration: 1.3, repeat: Infinity, delay: 0.3 }} />
                      </>
                    )}
                    {/* Pulse rings while speaking */}
                    {isPlaying && (
                      <motion.span className="absolute inset-0 rounded-full"
                        style={{ border: "1.5px solid rgba(56,189,248,.3)" }}
                        animate={{ scale: [1, 1.45, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.6, repeat: Infinity }} />
                    )}

                    <AnimatePresence mode="wait">
                      {isProcessing ? (
                        <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Loader2 className="w-6 h-6 text-white/50 animate-spin" />
                        </motion.div>
                      ) : isRecording ? (
                        <motion.div key="stop" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
                          <Square className="w-5 h-5 text-red-400 fill-red-400" />
                        </motion.div>
                      ) : isPlaying ? (
                        <motion.div key="interrupt" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
                          <Square className="w-5 h-5 text-sky-400 fill-sky-400" />
                        </motion.div>
                      ) : (
                        <motion.div key="mic" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}>
                          <Mic className="w-6 h-6 text-[#c5a059]" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>

                  {/* Context label */}
                  <p className="text-[11px] text-white/30" style={SF}>
                    {isRecording
                      ? "tap to stop · auto-stops on silence"
                      : isPlaying
                      ? "tap to interrupt"
                      : isProcessing
                      ? ""
                      : ""}
                  </p>
                </div>
              )}
              <p className="text-[10px] text-white/18 text-center mt-2" style={SF}>
                H Orbit · powered by AI · end-to-end encrypted
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating button ── */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: "rgba(10,10,18,.88)",
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: "1px solid rgba(197,160,89,.32)",
          boxShadow: "0 12px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07), 0 0 0 1px rgba(197,160,89,.15)",
        }}
        data-testid="chatbot-toggle"
        aria-label={isOpen ? "Close H Orbit" : "Open H Orbit AI"}
      >
        {!isOpen && (
          <motion.span className="absolute inset-0 rounded-2xl"
            style={{ border: "1px solid rgba(197,160,89,.4)" }}
            animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.18, 1] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
        )}
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.14 }}>
              <X className="w-5 h-5 text-white/85" />
            </motion.div>
          ) : (
            <motion.div key="spark" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.14 }}>
              <Sparkles className="w-5 h-5 text-[#c5a059] drop-shadow-[0_0_8px_rgba(197,160,89,.65)]" />
            </motion.div>
          )}
        </AnimatePresence>
        {!isOpen && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center"
            style={{ background: "rgba(197,160,89,.9)", border: "2px solid rgba(10,10,18,.9)" }}>
            <span className="text-[9px] text-black font-bold leading-none">AI</span>
          </motion.span>
        )}
      </motion.button>
    </>
  );
}
