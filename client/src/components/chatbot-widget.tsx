import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { X, Send, Loader2, User, Minimize2, GripHorizontal, Sparkles, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import gyanAvatar from "@/assets/gyan-ai-avatar.png";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
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

export function ChatbotWidget() {
  const { data: settings } = useQuery<ChatbotSettings>({
    queryKey: ["/api/chatbot/settings"],
    staleTime: 5 * 60 * 1000,
  });

  const [isOpen, setIsOpen] = useState(false);
  const getDefaultMessage = () => {
    if (settings?.greetingMessage) {
      return settings.greetingMessage;
    }
    return "Hello, I'm Gyan AI.\n\nI manage everything around your living experience — from bookings and rooms to meals, security, and support.\n\nThink of me as the central intelligence of Hsquareliving, keeping your stay smooth, smart, and stress-free.";
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: getDefaultMessage(),
    },
  ]);

  useEffect(() => {
    if (settings?.greetingMessage) {
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: settings.greetingMessage,
      }]);
    }
  }, [settings?.greetingMessage]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
    };

    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const chatHistory = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistory }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let accumulatedContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              const data = JSON.parse(jsonStr);

              if (data.content) {
                accumulatedContent += data.content;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessage.id
                      ? { ...m, content: accumulatedContent }
                      : m
                  )
                );
              }

              if (data.done) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessage.id
                      ? { ...m, isStreaming: false }
                      : m
                  )
                );
              }

              if (data.leadCreated) {
                console.log("Lead created:", data.leadId);
              }
            } catch {
              // Skip malformed JSON - will be completed in next chunk
            }
          }
        }
      }

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? { ...m, isStreaming: false }
            : m
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessage.id
            ? { ...m, content: "Sorry, I encountered an error. Please try again.", isStreaming: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (settings?.enabled === false) {
    return null;
  }

  return (
    <>
      {/* Drag constraints boundary - full viewport */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-40" />

      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragControls={dragControls}
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            dragMomentum={false}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-4 z-50 w-[380px] max-w-[calc(100vw-32px)] rounded-2xl shadow-2xl overflow-hidden bg-[#0a0a0a] border border-white/10"
            style={{ touchAction: "none" }}
            data-testid="chatbot-window"
          >
            {/* Pro-developer header — deep black with gold accent */}
            <div
              className="px-4 py-3 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-white/10 bg-gradient-to-b from-[#111] to-[#0a0a0a]"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl bg-black/60 ring-1 ring-[#c5a059]/40 overflow-hidden flex items-center justify-center">
                  <img src={gyanAvatar} alt="Gyan AI" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-[#0a0a0a]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-white font-mono font-semibold text-sm tracking-tight">gyan.ai</h3>
                    <span className="text-[10px] font-mono text-[#c5a059]">v1.0</span>
                  </div>
                  <p className="text-white/50 text-[11px] flex items-center gap-1 font-mono">
                    <GripHorizontal className="w-3 h-3" />
                    drag • online
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setIsOpen(false)}
                  data-testid="chatbot-minimize"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setIsOpen(false)}
                  data-testid="chatbot-close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <ScrollArea ref={scrollAreaRef} className="h-[350px] p-4 bg-[#070707]">
              <div className="space-y-4">
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden ${
                        message.role === "assistant"
                          ? "bg-black/60 ring-1 ring-[#c5a059]/30"
                          : "bg-white/10 ring-1 ring-white/10"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <img src={gyanAvatar} alt="Gyan AI" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-4 h-4 text-white/70" />
                      )}
                    </div>
                    <div
                      className={`max-w-[75%] rounded-xl px-4 py-2.5 ${
                        message.role === "assistant"
                          ? "bg-white/[0.04] border border-white/10 text-white/90 rounded-tl-sm"
                          : "bg-[#c5a059]/15 border border-[#c5a059]/30 text-white rounded-tr-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                        {message.isStreaming && (
                          <span className="inline-block w-1.5 h-4 ml-0.5 bg-[#c5a059] animate-pulse" />
                        )}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>

            <div className="p-3 border-t border-white/10 bg-[#0a0a0a]">
              <div className="flex gap-2 items-center">
                <TerminalSquare className="w-4 h-4 text-[#c5a059]/70 shrink-0" />
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ask gyan anything…"
                  className="flex-1 bg-black/60 border-white/10 text-white placeholder:text-white/40 focus:border-[#c5a059]/50 focus:ring-[#c5a059]/20 font-mono text-sm"
                  disabled={isLoading}
                  data-testid="chatbot-input"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-[#c5a059] hover:bg-[#d4b070] text-black h-9 w-9 p-0 shrink-0"
                  data-testid="chatbot-send"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-[10px] text-white/30 text-center mt-2 font-mono">
                powered by gpt-4o-mini · end-to-end encrypted
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pro-developer floating button: deep glass + gold ring + sparkles icon */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-2xl flex items-center justify-center group"
        style={{
          background:
            "linear-gradient(135deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.95) 100%)",
          boxShadow:
            "0 10px 40px rgba(197,160,89,0.25), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(197,160,89,0.4)",
          backdropFilter: "blur(12px)",
        }}
        data-testid="chatbot-toggle"
        aria-label={isOpen ? "Close chat" : "Open Gyan AI chat"}
      >
        {/* Animated outer ring */}
        {!isOpen && (
          <motion.span
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ boxShadow: "0 0 0 0 rgba(197,160,89,0.6)" }}
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(197,160,89,0.5)",
                "0 0 0 12px rgba(197,160,89,0)",
                "0 0 0 0 rgba(197,160,89,0)",
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
          />
        )}
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-5 h-5 text-white/90" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="relative"
            >
              <Sparkles className="w-5 h-5 text-[#c5a059] drop-shadow-[0_0_8px_rgba(197,160,89,0.6)]" />
            </motion.div>
          )}
        </AnimatePresence>

        {!isOpen && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#c5a059] rounded-full flex items-center justify-center ring-2 ring-[#0a0a0a]"
          >
            <span className="text-[10px] text-black font-mono font-bold leading-none">AI</span>
          </motion.span>
        )}
      </motion.button>
    </>
  );
}
