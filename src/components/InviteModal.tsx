import { useState, useEffect } from "react";
import { Link2, Copy, Check, Users } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface InviteModalProps {
  tripId: string;
}

interface Collaborator {
  id: string;
  invited_email: string;
  role: string;
  accepted: boolean;
}

export default function InviteModal({ tripId }: InviteModalProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [linkRole, setLinkRole] = useState<string>("viewer");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);

  const shareUrl = `${window.location.origin}/trip/${tripId}`;

  useEffect(() => {
    if (!open) return;
    supabase
      .from("trip_collaborators")
      .select("id, invited_email, role, accepted")
      .eq("trip_id", tripId)
      .then(({ data }) => {
        if (data) setCollaborators(data as Collaborator[]);
      });
  }, [open, tripId]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast({ title: "Link copied!", description: "Share it with your travel companions." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-white/20 glass hover:bg-white/30">
          <Link2 className="w-4 h-4" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card rounded-3xl border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display italic">Share Trip</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Share Link Section */}
          <div className="space-y-3">
            <p className="text-sm font-body text-muted-foreground">
              Anyone with this link can access the trip:
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="rounded-xl glass border-white/20 flex-1 text-xs font-mono"
                onFocus={(e) => e.target.select()}
              />
              <Button
                size="icon"
                onClick={handleCopy}
                className="rounded-xl shrink-0"
                variant={copied ? "default" : "outline"}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-body whitespace-nowrap">
                Anyone with this link can:
              </span>
              <Select value={linkRole} onValueChange={setLinkRole}>
                <SelectTrigger className="w-[100px] rounded-xl glass border-white/20 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">View</SelectItem>
                  <SelectItem value="editor">Edit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Current Collaborators Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
              <Users className="w-3.5 h-3.5" />
              <span>Collaborators</span>
            </div>
            {collaborators.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 font-body italic py-2">
                Share the link above to invite collaborators
              </p>
            ) : (
              <div className="space-y-1.5">
                {collaborators.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between glass rounded-xl px-3 py-2 text-sm font-body"
                  >
                    <span className="text-foreground truncate">{c.invited_email}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground capitalize">{c.role}</span>
                      {c.accepted && (
                        <Check className="w-3 h-3 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
