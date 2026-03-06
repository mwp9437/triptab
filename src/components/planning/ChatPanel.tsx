import { useState, useRef, useEffect } from "react";
import { Send, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/types/itinerary";
import { TripPlan } from "@/types/itinerary";
import { ActivityOption } from "@/types/intake";
import { streamChat, createMessageId, suggestActivities, modifyItinerary } from "@/lib/chat";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

const PROMPTS_COLLABORATIVE = [
  "Try: 'I want to explore temples on Day 3'",
  "Try: 'Find a sunset dinner spot'",
  "Try: 'Add a day trip on Thursday'",
];

const PROMPTS_AUTO = [
  "Try: 'Add ski après on Wednesday afternoon'",
  "Try: 'Move the onsen back two hours'",
  "Try: 'Find a cheaper hotel option'",
  "Try: 'Swap Day 2 lunch for ramen'",
];

interface ChatPanelProps {
  conversationHistory: { role: string; content: string }[];
  collapsed?: boolean;
  onToggle?: () => void;
  onSuggestionsReady?: (options: ActivityOption[], followUp: string) => void;
  onPlanUpdate?: (plan: TripPlan) => void;
  currentPlan?: TripPlan | null;
  collaborative?: boolean;
  intakeContext?: string;
}

export default function ChatPanel({
  conversationHistory,
  collapsed,
  onToggle,
  onSuggestionsReady,
  onPlanUpdate,
  currentPlan,
  collaborative,
  intakeContext,
}: ChatPanelProps) {
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

    const apiMessages = [
      ...conversationHistory,
      ...(intakeContext ? [{ role: "system" as const, content: intakeContext }] : []),
      ...updatedMessages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // In collaborative mode, try to get structured suggestions
    if (collaborative && onSuggestionsReady) {
      try {
        const result = await suggestActivities(apiMessages, userRequest);
        if (result.suggestions && result.suggestions.length > 0) {
          onSuggestionsReady(result.suggestions, result.followUp || "");
          const assistantMsg: ChatMessage = {
            id: createMessageId(),
            role: "assistant",
            content: result.followUp || `Here are some options. Pick one to add it to your itinerary.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, assistantMsg]);
          setIsStreaming(false);
          return;
        }
      } catch {
        // Fall through
      }
    }

    // In auto mode with a current plan, use modify-itinerary
    if (!collaborative && currentPlan && onPlanUpdate) {
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

    // Regular streaming chat fallback
    const assistantMsg: ChatMessage = {
      id: createMessageId(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
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
          m.id === assistantMsg.id ? { ...m, content: "Connection issue. Please try again." } : m
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

  if (collapsed) {
    return (
      <button
        onClick={onToggle}
        className="h-full w-10 bg-card border-r border-border flex items-center justify-center hover:bg-muted transition-colors"
      >
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  const prompts = collaborative ? PROMPTS_COLLABORATIVE : PROMPTS_AUTO;

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="font-display font-semibold text-sm text-card-foreground">Chat</span>
        {onToggle && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
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
            <div className="space-y-1.5 px-2">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => { setInput(p.replace("Try: '", "").replace("'", "")); }}
                  className="text-xs text-primary/70 hover:text-primary font-body block w-full text-left"
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
                "max-w-[85%] rounded-xl px-3 py-2 text-xs font-body",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
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
            <div className="bg-muted rounded-xl px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-2">
        <div className="flex gap-1.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={collaborative ? "What do you want to do?" : "Adjust your plan..."}
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
    </div>
  );
}
