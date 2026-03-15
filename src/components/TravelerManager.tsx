import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Trash2, UserCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Traveler, Expense } from "@/types/expenses";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

interface TravelerManagerProps {
  travelers: Traveler[];
  expenses: Expense[];
  travelerCount?: number;
  tripId?: string | null;
  onAddTraveler: (name: string, email?: string) => Promise<void>;
  onRemoveTraveler: (id: string) => Promise<void>;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export default function TravelerManager({
  travelers,
  expenses,
  travelerCount = 1,
  tripId,
  onAddTraveler,
  onRemoveTraveler,
  externalOpen,
  onExternalOpenChange,
}: TravelerManagerProps) {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    setInternalOpen(v);
  };
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);

  // Auto-add current user on first open if no travelers exist
  useEffect(() => {
    if (!open || !user || !tripId || travelers.length > 0) return;

    (async () => {
      // Check DB to avoid duplicate "you" entries
      const { data: existing } = await supabase
        .from("trip_travelers")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) return;

      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();

      const displayName = (data as any)?.display_name || user.email || "Me";
      await onAddTraveler(displayName, user.email);
    })();
  }, [open, user, tripId, travelers.length]);

  const referencedTravelerIds = new Set(
    expenses.flatMap((e) => [e.paidBy, ...e.participants.map((p) => p.travelerId)])
  );

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    await onAddTraveler(name.trim(), email.trim() || undefined);
    setName("");
    setEmail("");
    setAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30"
    >
      <Users className="w-4 h-4" />
      <span className="hidden sm:inline">{travelers.length || travelerCount}</span>
      <span className="sm:hidden">👥</span>
    </Button>
  );

  const bodyContent = (
    <>
      {travelerCount > 1 && travelers.length < travelerCount && (
        <p className="text-sm text-muted-foreground font-body bg-primary/10 rounded-xl px-3 py-2">
          You have {travelerCount} travelers — add their names so you can split expenses
        </p>
      )}

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {travelers.map((t) => {
          const isReferenced = referencedTravelerIds.has(t.id);
          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 glass rounded-xl px-3 py-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                {t.isCurrentUser && <UserCheck className="w-4 h-4 text-primary shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-body font-medium text-foreground truncate">
                    {t.name} {t.isCurrentUser && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  {t.email && (
                    <p className="text-[11px] text-muted-foreground truncate">{t.email}</p>
                  )}
                </div>
              </div>
              {!t.isCurrentUser && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 hover:bg-destructive/15 hover:text-destructive"
                        disabled={isReferenced}
                        onClick={() => onRemoveTraveler(t.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TooltipTrigger>
                    {isReferenced && (
                      <TooltipContent>
                        <p>Can't remove — referenced in expenses</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        })}
      </div>

      {/* Add traveler row */}
      <div className="flex gap-2 items-end pt-1">
        <div className="flex-1 space-y-1">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="glass border-white/20 rounded-xl h-9 text-sm"
          />
        </div>
        <div className="flex-1 space-y-1">
          <Input
            placeholder="Email (optional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            className="glass border-white/20 rounded-xl h-9 text-sm"
          />
        </div>
        <Button
          size="icon"
          className="h-9 w-9 rounded-xl shrink-0"
          onClick={handleAdd}
          disabled={!name.trim() || adding}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent className="glass-card border-white/15 max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle className="font-display text-lg">Travelers</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6 space-y-3">
            {bodyContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
      <DialogContent className="glass-card border-white/15 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">Travelers</DialogTitle>
        </DialogHeader>
        {bodyContent}
      </DialogContent>
    </Dialog>
  );
}
