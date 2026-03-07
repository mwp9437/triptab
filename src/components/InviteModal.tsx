import { useState } from "react";
import { UserPlus, X, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface InviteModalProps {
  tripId: string;
}

export default function InviteModal({ tripId }: InviteModalProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("viewer");
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([]);

  const handleInvite = async () => {
    if (!email.trim()) return;
    setSending(true);

    // Look up user by email to set user_id if they exist
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("display_name", email.trim());

    const { error } = await supabase.from("trip_collaborators").insert({
      trip_id: tripId,
      invited_email: email.trim(),
      role: role as any,
      user_id: profiles?.[0]?.user_id || null,
      accepted: false,
    } as any);

    setSending(false);

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already invited", description: "This person has already been invited." });
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      setInvites([...invites, { email: email.trim(), role }]);
      setEmail("");
      toast({ title: "Invited!", description: `${email.trim()} has been invited as ${role}.` });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl border-white/20 glass hover:bg-white/30">
          <UserPlus className="w-4 h-4" /> Invite
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card rounded-3xl border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display italic">Invite Collaborators</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl glass border-white/20 flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-[100px] rounded-xl glass border-white/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="editor">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" onClick={handleInvite} disabled={sending || !email.trim()} className="rounded-xl shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {invites.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-body">Invited this session:</p>
              {invites.map((inv, i) => (
                <div key={i} className="flex items-center justify-between glass rounded-xl px-3 py-2 text-sm font-body">
                  <span className="text-foreground">{inv.email}</span>
                  <span className="text-xs text-muted-foreground capitalize">{inv.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
