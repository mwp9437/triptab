import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CalendarDays, Plus, Trash2, Lock, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Traveler } from "@/types/expenses";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

/* ─── Types ─── */
export interface DatePollOption {
  id: string;
  startDate: string;
  endDate: string;
}

export interface DatePollData {
  options: DatePollOption[];
  votes: Record<string, string[]>; // optionId → travelerId[]
  locked?: boolean;
  lockedOptionId?: string;
}

interface DatePollProps {
  datePoll?: DatePollData;
  onUpdate: (poll: DatePollData) => void;
  onLock: (startDate: string, endDate: string) => void;
  isOwner: boolean;
  currentTravelerId?: string;
  travelers: Traveler[];
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

/* ─── Helpers ─── */
function fmtRange(start: string, end: string) {
  try {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    return `${format(s, "MMM d")} – ${format(e, "MMM d, yyyy")}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function nightCount(start: string, end: string) {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/* ─── Component ─── */
export default function DatePoll({
  datePoll,
  onUpdate,
  onLock,
  isOwner,
  currentTravelerId,
  travelers,
  externalOpen,
  onExternalOpenChange,
}: DatePollProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (onExternalOpenChange) onExternalOpenChange(v);
    setInternalOpen(v);
  };
  const [poll, setPoll] = useState<DatePollData>(
    datePoll || { options: [], votes: {} }
  );

  useEffect(() => {
    if (open) {
      setPoll(datePoll || { options: [], votes: {} });
    }
  }, [open]);

  const save = (next: DatePollData) => {
    setPoll(next);
    onUpdate(next);
  };

  /* Options management (owner only) */
  const addOption = () => {
    if (poll.options.length >= 5) {
      toast({ title: "Max 5 options", variant: "destructive" });
      return;
    }
    const id = crypto.randomUUID();
    save({ ...poll, options: [...poll.options, { id, startDate: "", endDate: "" }] });
  };

  const updateOption = (id: string, patch: Partial<DatePollOption>) => {
    save({
      ...poll,
      options: poll.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    });
  };

  const removeOption = (id: string) => {
    const { [id]: _, ...remainingVotes } = poll.votes;
    save({
      ...poll,
      options: poll.options.filter((o) => o.id !== id),
      votes: remainingVotes,
    });
  };

  /* Voting */
  const toggleVote = (optionId: string) => {
    if (!currentTravelerId || poll.locked) return;
    const voters = poll.votes[optionId] || [];
    const has = voters.includes(currentTravelerId);
    const next = has
      ? voters.filter((v) => v !== currentTravelerId)
      : [...voters, currentTravelerId];
    save({ ...poll, votes: { ...poll.votes, [optionId]: next } });
  };

  /* Lock */
  const handleLock = (option: DatePollOption) => {
    const locked = { ...poll, locked: true, lockedOptionId: option.id };
    save(locked);
    onLock(option.startDate, option.endDate);
    toast({ title: "Dates locked!", description: `Trip dates set to ${fmtRange(option.startDate, option.endDate)}` });
    setOpen(false);
  };

  const travelerName = (id: string) => travelers.find((t) => t.id === id)?.name || "Unknown";

  const hasPoll = poll.options.length > 0;

  const triggerButton = (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30"
    >
      <CalendarDays className="w-4 h-4" />
      <span className="hidden sm:inline">Date Poll</span>
    </Button>
  );

  const titleContent = (
    <>Date Poll {poll.locked && <span className="text-xs text-green-500 ml-2">Locked</span>}</>
  );

  const bodyContent = (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
      {!hasPoll && !isOwner && (
        <p className="text-sm text-muted-foreground font-body text-center py-6">
          No date poll created yet.
        </p>
      )}

      {!hasPoll && isOwner && (
        <div className="text-center py-6 space-y-3">
          <p className="text-sm text-muted-foreground font-body">
            Create a poll so collaborators can vote on trip dates.
          </p>
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl glass border-white/20" onClick={addOption}>
            <Plus className="w-4 h-4" /> Add Date Option
          </Button>
        </div>
      )}

      {poll.options.map((opt, i) => {
        const voters = poll.votes[opt.id] || [];
        const myVote = currentTravelerId ? voters.includes(currentTravelerId) : false;
        const isWinner = poll.locked && poll.lockedOptionId === opt.id;

        return (
          <div
            key={opt.id}
            className={`glass-card-solid rounded-2xl p-4 space-y-2 transition-all ${
              isWinner ? "ring-2 ring-green-500/50" : ""
            }`}
          >
            {/* Date inputs (owner) or display */}
            {isOwner && !poll.locked ? (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <span className="text-xs text-muted-foreground font-body w-5">{i + 1}.</span>
                <input
                  type="date"
                  value={opt.startDate}
                  onChange={(e) => updateOption(opt.id, { startDate: e.target.value })}
                  className="flex-1 min-w-0 glass border-white/20 rounded-xl h-9 px-3 text-sm bg-transparent"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={opt.endDate}
                  onChange={(e) => updateOption(opt.id, { endDate: e.target.value })}
                  className="flex-1 min-w-0 glass border-white/20 rounded-xl h-9 px-3 text-sm bg-transparent"
                />
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-destructive/15 hover:text-destructive" onClick={() => removeOption(opt.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-body font-semibold text-foreground">
                    {opt.startDate && opt.endDate ? fmtRange(opt.startDate, opt.endDate) : "Dates not set"}
                  </p>
                  {opt.startDate && opt.endDate && (
                    <p className="text-xs text-muted-foreground">{nightCount(opt.startDate, opt.endDate)} nights</p>
                  )}
                </div>
                {isWinner && <span className="text-xs bg-green-500/20 text-green-600 px-2 py-0.5 rounded-full font-semibold">Winner</span>}
              </div>
            )}

            {/* Vote bar */}
            {opt.startDate && opt.endDate && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-muted-foreground font-body">{voters.length} vote{voters.length !== 1 ? "s" : ""}</span>
                  {voters.map((vid) => (
                    <span key={vid} className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">
                      {travelerName(vid).split(" ")[0]}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Vote button - min 44px touch target */}
                  {!poll.locked && currentTravelerId && (
                    <Button
                      variant={myVote ? "default" : "outline"}
                      size="sm"
                      className={`h-8 min-w-[44px] rounded-lg text-xs gap-1 ${!myVote ? "glass border-white/20" : ""}`}
                      onClick={() => toggleVote(opt.id)}
                    >
                      {myVote ? <Check className="w-3 h-3" /> : null}
                      {myVote ? "Voted" : "Vote"}
                    </Button>
                  )}

                  {/* Lock button (owner only) */}
                  {isOwner && !poll.locked && opt.startDate && opt.endDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 min-w-[44px] rounded-lg text-xs gap-1 glass border-white/20"
                      onClick={() => handleLock(opt)}
                    >
                      <Lock className="w-3 h-3" /> Lock
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add more options */}
      {isOwner && hasPoll && !poll.locked && poll.options.length < 5 && (
        <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl glass border-white/20" onClick={addOption}>
          <Plus className="w-4 h-4" /> Add Option
        </Button>
      )}
    </div>
  );

  const hasExternalControl = externalOpen !== undefined;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        {!hasExternalControl && <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>}
        <DrawerContent className="glass-card-readable border-white/15 max-h-[85vh] flex flex-col p-0 overflow-hidden">
          <DrawerHeader className="px-5 pt-4 pb-0">
            <DrawerTitle className="font-display text-lg">{titleContent}</DrawerTitle>
          </DrawerHeader>
          {bodyContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hasExternalControl && <DialogTrigger asChild>{triggerButton}</DialogTrigger>}
      <DialogContent className="glass-card-readable border-white/15 sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-display text-lg">{titleContent}</DialogTitle>
        </DialogHeader>
        {bodyContent}
      </DialogContent>
    </Dialog>
  );
}
