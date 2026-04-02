import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "feature" | "general";

const PLACEHOLDERS: Record<FeedbackType, string> = {
  bug: "What went wrong? What did you expect to happen?",
  feature: "What would you like to see added?",
  general: "Any thoughts or feedback?",
};

const TYPE_LABELS: { value: FeedbackType; label: string }[] = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "general", label: "General" },
];

interface FeedbackModalProps {
  tripId?: string | null;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export default function FeedbackModal({ tripId, externalOpen, onExternalOpenChange }: FeedbackModalProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    setInternalOpen(v);
  };
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFeedbackType("bug");
    setMessage("");
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) resetForm();
    setOpen(v);
  };

  const handleSubmit = async () => {
    if (!user || message.trim().length < 10) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).from("feedback").insert({
        user_id: user.id,
        user_email: user.email,
        trip_id: tripId ?? null,
        feedback_type: feedbackType,
        message: message.trim(),
        page_url: window.location.href,
      });
      if (error) throw error;
      toast({ title: "Thanks for the feedback!" });
      resetForm();
      setOpen(false);
    } catch {
      toast({ title: "Failed to submit feedback", variant: "destructive" });
    }
    setSubmitting(false);
  };

  const isValid = message.trim().length >= 10;
  const hasExternalControl = externalOpen !== undefined;

  const triggerButton = (
    <>
      <Button
        variant="outline"
        size="icon"
        className="rounded-xl border-white/20 glass hover:bg-white/30 sm:hidden h-8 w-8"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="w-4 h-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30 hidden sm:flex"
        onClick={() => setOpen(true)}
      >
        <MessageSquarePlus className="w-4 h-4" /> <span className="hidden md:inline">Feedback</span>
      </Button>
    </>
  );

  if (!user) {
    if (hasExternalControl) return null;
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          className="rounded-xl border-white/20 glass hover:bg-white/30 sm:hidden h-8 w-8"
          onClick={() => toast({ title: "Sign in to submit feedback" })}
        >
          <MessageSquarePlus className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30 hidden sm:flex"
          onClick={() => toast({ title: "Sign in to submit feedback" })}
        >
          <MessageSquarePlus className="w-4 h-4" /> <span className="hidden md:inline">Feedback</span>
        </Button>
      </>
    );
  }

  const formContent = (
    <div className="space-y-4 px-1">
      {/* Feedback type pills */}
      <div className="flex gap-1 glass rounded-xl p-1">
        {TYPE_LABELS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFeedbackType(opt.value)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-body font-medium transition-all",
              feedbackType === opt.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Message */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={PLACEHOLDERS[feedbackType]}
        rows={5}
        className="w-full bg-white/10 rounded-xl px-4 py-3 text-sm text-foreground outline-none border border-white/15 focus:border-primary/50 placeholder:text-muted-foreground/50 resize-none font-body"
      />
      <p className="text-xs text-muted-foreground font-body">
        {message.trim().length < 10
          ? `${10 - message.trim().length} more characters needed`
          : "Ready to submit"}
      </p>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className="w-full rounded-xl h-11 font-display font-semibold text-sm"
      >
        {submitting ? "Submitting..." : "Submit Feedback"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {!hasExternalControl && triggerButton}
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent className="glass-card-readable border-white/15 max-h-[85vh] flex flex-col">
            <DrawerHeader>
              <DrawerTitle className="font-display text-lg">Send Feedback</DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {formContent}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {!hasExternalControl && triggerButton}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="glass-card-readable border-white/15 sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Send Feedback</DialogTitle>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>
    </>
  );
}
