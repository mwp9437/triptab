import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";

interface AuthPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: () => void;
}

export default function AuthPromptDialog({ open, onOpenChange, onAuthenticated }: AuthPromptDialogProps) {
  const isMobile = useIsMobile();
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isLogin) {
      const { error } = await signIn(email, password);
      setSubmitting(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        onOpenChange(false);
        onAuthenticated();
      }
    } else {
      const { error, needsConfirmation } = await signUp(email, password, displayName);
      setSubmitting(false);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else if (needsConfirmation) {
        setConfirmationMessage("Check your email to confirm your account, or sign in if you already have one.");
      } else {
        onOpenChange(false);
        onAuthenticated();
      }
    }
  };

  const formContent = (
    <>
      {confirmationMessage && (
        <p className="text-sm font-body bg-primary/10 rounded-xl px-3 py-2 text-foreground">
          {confirmationMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 mt-2">
        {!isLogin && (
          <div className="space-y-1.5">
            <Label className="font-body text-xs">Display Name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="rounded-xl"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="font-body text-xs">Email</Label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="font-body text-xs">Password</Label>
          <Input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-xl"
          />
        </div>
        <Button type="submit" disabled={submitting} className="w-full rounded-xl">
          {submitting ? "Loading..." : isLogin ? "Sign In & Save" : "Create Account & Save"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground font-body">
        {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-primary hover:underline font-medium"
        >
          {isLogin ? "Sign up" : "Sign in"}
        </button>
      </p>
    </>
  );

  const titleText = isLogin ? "Sign in to save" : "Create account to save";
  const descText = "Your itinerary is ready! Sign in to save it to your trips.";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="glass-card-readable border-white/15 max-h-[85vh] px-4 pb-6">
          <DrawerHeader>
            <DrawerTitle className="font-display text-xl italic">{titleText}</DrawerTitle>
            <DrawerDescription className="font-body text-sm">{descText}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto max-h-[70vh] pt-2">
            {formContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl italic">{titleText}</DialogTitle>
          <DialogDescription className="font-body text-sm">{descText}</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
