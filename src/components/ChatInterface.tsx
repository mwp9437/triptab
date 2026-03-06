import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Plane, Sparkles, Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/types/itinerary";
import { streamChat, createMessageId } from "@/lib/chat";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "🏖️ Plan a beach getaway for 2",
  "🏔️ Adventure trip with friends",
  "🍕 European food tour",
  "🎌 Two weeks in Japan",
];

interface ChatInterfaceProps {
  onGenerateItinerary: (messages: { role: string; content: string }[]) => void;
  isGenerating: boolean;
}

export default function ChatInterface({ onGenerateItinerary, isGenerating }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setShowWelcome(false);

    const userMsg: ChatMessage = {
      id: createMessageId(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");

    const assistantMsg: ChatMessage = {
      id: createMessageId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsStreaming(true);

    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let fullContent = "";
      await streamChat(
        apiMessages,
        (chunk) => {
          fullContent += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: fullContent } : m))
          );
        },
        () => {
          setIsStreaming(false);
          if (fullContent.includes("[READY_TO_GENERATE]")) {
            const cleanContent = fullContent.replace("[READY_TO_GENERATE]", "").trim();
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: cleanContent } : m))
            );
            const allMessages = [
              ...apiMessages,
              { role: "assistant", content: cleanContent },
            ];
            onGenerateItinerary(allMessages);
          }
        }
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "Sorry, I had trouble connecting. Please try again! 🌊" }
            : m
        )
      );
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Plane className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">TripCraft</h1>
            <p className="text-xs text-muted-foreground font-body">AI Travel Planner</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <AnimatePresence>
            {showWelcome && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-16"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-block mb-6"
                >
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Plane className="w-10 h-10 text-primary" />
                  </div>
                </motion.div>
                <h2 className="text-3xl font-display font-bold text-foreground mb-3">
                  Where to next?
                </h2>
                <p className="text-muted-foreground font-body mb-8 max-w-md mx-auto">
                  Tell me about your dream trip — or paste your messy notes. I'll turn them into a perfect itinerary.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button
                      key={s}
                      variant="outline"
                      size="sm"
                      className="rounded-full border-border hover:bg-secondary hover:text-secondary-foreground"
                      onClick={() => sendMessage(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Supports brain dumps — paste anything!</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-card-foreground"
                }`}
              >
                <div className="font-body text-sm prose prose-sm max-w-none [&_p]:m-0 [&_ul]:my-1 [&_li]:my-0">
                  <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}

          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-card border border-border rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground font-body">
                  Crafting your itinerary...
                </span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me about your trip plans..."
            className="min-h-[44px] max-h-[120px] resize-none rounded-xl border-border bg-card font-body"
            rows={1}
            disabled={isStreaming || isGenerating}
          />
          <Button
            size="icon"
            className="h-[44px] w-[44px] rounded-xl shrink-0 bg-primary hover:bg-primary/90"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming || isGenerating}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
