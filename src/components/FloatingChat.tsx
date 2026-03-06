import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage, TripPlan } from "@/types/itinerary";
import { ActivityOption } from "@/types/intake";
import { streamChat, createMessageId, suggestActivities, modifyItinerary } from "@/lib/chat";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const PROMPTS_COLLABORATIVE = [
  "I want to explore temples on Day 3",
  "Find a sunset dinner spot",
  "Add a day trip on Thursday",
];

const PROMPTS_AUTO = [
  "Add ski après on Wednesday afternoon",
  "Move the onsen back two hours",
  "Find a cheaper hotel option",
  "Swap Day 2 lunch for ramen",
];

interface FloatingChatProps {
  conversationHistory: { role: string; content: string }[];
  currentPlan?: TripPlan | null;
  onPlanUpdate?: (plan: TripPlan) => void;
  onSuggestionsReady?: (options: ActivityOption[], followUp: string) => void;
  collaborative?: boolean;
  intakeContext?: string;
}

export default function FloatingChat({
  conversationHistory,
  currentPlan,
  onPlanUpdate,
  onSuggestionsReady,
  collaborative,
  intakeContext,
}: FloatingChatProps) {
  const [state, setState] = useState<"closed" | "open" | "minimized">("closed");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isStreaming) return;
    const userMsg: ChatMessage = { id: createMessageId(), role: "user", content: msg, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);

    const apiMessages = [
      ...conversationHistory,
      ...(intakeContext ? [{ role: "system" as const, content: intakeContext }] : []),
      ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Collaborative mode: suggest activities
    if (collaborative && onSuggestionsReady) {
      try {
        const result = await suggestActivities(apiMessages, msg);
        if (result.suggestions && result.suggestions.length > 0) {
          onSuggestionsReady(result.suggestions, result.followUp || "");
          const assistantMsg: ChatMessage = { id: createMessageId(), role: "assistant", content: result.followUp || "Here are some options. Pick one to add it.", timestamp: new Date() };
          setMessages((prev) => [...prev, assistantMsg]);
          if (state !== "open") setUnread((n) => n + 1);
          setIsStreaming(false);
          return;
        }
      } catch { /* Fall through */ }
    }

    // Auto mode: modify itinerary
    if (!collaborative && currentPlan && onPlanUpdate) {
      try {
        const chatHistory = updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
        const result = await modifyItinerary(currentPlan, msg, chatHistory);
        if (result.plan) {
          onPlanUpdate(result.plan);
          const assistantMsg: ChatMessage = { id: createMessageId(), role: "assistant", content: result.message || "Done — itinerary updated.", timestamp: new Date() };
          setMessages((prev) => [...prev, assistantMsg]);
          if (state !== "open") setUnread((n) => n + 1);
          setIsStreaming(false);
          return;
        }
      } catch { /* Fall through */ }
    }

    // Fallback: stream chat
    const assistantMsg: ChatMessage = { id: createMessageId(), role: "assistant", content: "", timestamp: new Date() };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      let fullContent = "";
      await streamChat(
        apiMessages,
        (chunk) => {
          fullContent += chunk;
          setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m)));
        },
        () => {
          setIsStreaming(false);
          if (state !== "open") setUnread((n) => n + 1);
        }
      );
    } catch {
      setMessages((prev) => prev.map((m) => m.id === assistantMsg.id ? { ...m, content: "Connection issue. Please try again." } : m));
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const openChat = () => { setState("open"); setUnread(0); };
  const minimizeChat = () => setState("minimized");
  const closeChat = () => setState("closed");

  const prompts = collaborative ? PROMPTS_COLLABORATIVE : PROMPTS_AUTO;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {state === "open" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-16 right-0 w-[380px] h-[500px] glass-card rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/15">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="font-display font-semibold text-sm text-foreground">
                  {collaborative ? "Plan Together" : "Edit Your Plan"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/20" onClick={minimizeChat} title="Minimize">
                  <Minus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white/20" onClick={closeChat}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-xs text-muted-foreground text-center font-body px-2">
                    {collaborative
                      ? "Tell me what you want to do each day and I'll find the best options."
                      : "Ask me to adjust your itinerary — add activities, move things around, or swap options."}
                  </p>
                  <div className="space-y-1 px-2">
                    {prompts.map((p) => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        className="text-xs text-primary/70 hover:text-primary font-body block w-full text-left rounded-lg px-2 py-1.5 hover:bg-primary/5 transition-colors"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-body",
                      msg.role === "user"
                        ? "bg-primary/90 text-primary-foreground"
                        : "bg-white/60 text-foreground border border-white/30 backdrop-blur-sm"
                    )}
                  >
                    <div className="prose prose-sm max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0">
                      <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-white/60 backdrop-blur-sm border border-white/30 rounded-2xl px-3 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-white/15 p-2">
              <div className="flex gap-1.5">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={collaborative ? "What do you want to do?" : "Adjust your plan..."}
                  className="min-h-[36px] max-h-[72px] resize-none text-xs rounded-xl border-white/20 bg-white/40 backdrop-blur-sm font-body focus:bg-white/60 transition-all"
                  rows={1}
                  disabled={isStreaming}
                />
                <Button
                  size="icon"
                  className="h-[36px] w-[36px] rounded-xl shrink-0"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isStreaming}
                >
                  {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Minimized bar */}
        {state === "minimized" && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={openChat}
            className="absolute bottom-16 right-0 glass-card rounded-2xl px-4 py-2.5 flex items-center gap-2.5 shadow-lg hover:shadow-xl transition-all"
          >
            <MessageCircle className="w-4 h-4 text-primary" />
            <span className="font-body text-xs font-medium text-foreground">
              {isStreaming ? "AI is typing..." : "Chat minimized"}
            </span>
            {unread > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => state === "closed" ? openChat() : state === "open" ? closeChat() : openChat()}
        className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-sm text-primary-foreground shadow-lg shadow-primary/20 flex items-center justify-center hover:shadow-xl transition-all border border-primary/30 relative"
      >
        {state === "open" ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {unread > 0 && state !== "open" && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </motion.button>
    </div>
  );
}
