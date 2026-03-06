import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage, TripPlan } from "@/types/itinerary";
import { streamChat, createMessageId, modifyItinerary } from "@/lib/chat";
import ReactMarkdown from "react-markdown";

interface FloatingChatProps {
  conversationHistory: { role: string; content: string }[];
  currentPlan?: TripPlan | null;
  onPlanUpdate?: (plan: TripPlan) => void;
}

export default function FloatingChat({ conversationHistory, currentPlan, onPlanUpdate }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    const userRequest = input.trim();
    setInput("");
    setIsStreaming(true);

    // If we have a plan, use modify-itinerary
    if (currentPlan && onPlanUpdate) {
      try {
        const chatHistory = updatedMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
        const result = await modifyItinerary(currentPlan, userRequest, chatHistory);
        if (result.plan) {
          onPlanUpdate(result.plan);
          const assistantMsg: ChatMessage = {
            id: createMessageId(),
            role: "assistant",
            content: result.message || "Done — itinerary updated.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsStreaming(false);
          return;
        }
      } catch {
        // Fall through to regular chat
      }
    }

    // Regular streaming chat
    const assistantMsg: ChatMessage = {
      id: createMessageId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const apiMessages = [
        ...conversationHistory,
        ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
      ];

      let fullContent = "";
      await streamChat(
        apiMessages,
        (chunk) => {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m))
          );
        },
        () => setIsStreaming(false)
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: "Connection issue. Try again." } : m
        )
      );
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-16 right-0 w-[360px] h-[480px] bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="font-display font-semibold text-sm text-card-foreground">Edit your plan</span>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-8 font-body">
                  Ask me to adjust your itinerary — add activities, move things, swap options, or find alternatives.
                </p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs font-body ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border p-2">
              <div className="flex gap-1.5">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Adjust your plan..."
                  className="min-h-[36px] max-h-[72px] resize-none text-xs rounded-lg border-border bg-background font-body"
                  rows={1}
                  disabled={isStreaming}
                />
                <Button
                  size="icon"
                  className="h-[36px] w-[36px] rounded-lg shrink-0"
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                >
                  {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </motion.button>
    </div>
  );
}
