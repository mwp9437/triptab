import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Home, Copy, ExternalLink, Plus, Trash2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Traveler } from "@/types/expenses";

/* ─── Types ─── */
export interface AccommodationDetails {
  propertyName?: string;
  address?: string;
  checkInTime?: string;
  checkOutTime?: string;
  doorCode?: string;
  wifiName?: string;
  wifiPassword?: string;
  houseRules?: string;
  parkingInstructions?: string;
  hostName?: string;
  hostContact?: string;
}

export interface BedroomAssignment {
  id: string;
  name: string;
  description: string;
  assignedTravelerIds: string[];
}

interface AccommodationHubProps {
  accommodationDetails?: AccommodationDetails;
  bedroomAssignments?: BedroomAssignment[];
  onUpdate: (details: AccommodationDetails, bedrooms: BedroomAssignment[]) => void;
  canEdit: boolean;
  travelers: Traveler[];
}

/* ─── Helpers ─── */
function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* ─── Component ─── */
export default function AccommodationHub({
  accommodationDetails,
  bedroomAssignments,
  onUpdate,
  canEdit,
  travelers,
}: AccommodationHubProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"details" | "rooms">("details");
  const [details, setDetails] = useState<AccommodationDetails>(accommodationDetails || {});
  const [bedrooms, setBedrooms] = useState<BedroomAssignment[]>(bedroomAssignments || []);
  const [copiedWifi, setCopiedWifi] = useState(false);

  // Sync from props when dialog opens
  useEffect(() => {
    if (open) {
      setDetails(accommodationDetails || {});
      setBedrooms(bedroomAssignments || []);
    }
  }, [open]);

  const handleSave = () => {
    onUpdate(details, bedrooms);
    toast({ title: "Lodging updated" });
    setOpen(false);
  };

  const copyWifi = async () => {
    if (!details.wifiPassword) return;
    await navigator.clipboard.writeText(details.wifiPassword);
    setCopiedWifi(true);
    toast({ title: "Copied!", description: "WiFi password copied to clipboard." });
    setTimeout(() => setCopiedWifi(false), 2000);
  };

  const set = (key: keyof AccommodationDetails, value: string) =>
    setDetails((d) => ({ ...d, [key]: value }));

  /* Bedroom helpers */
  const addRoom = () => {
    setBedrooms((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", description: "", assignedTravelerIds: [] },
    ]);
  };

  const updateRoom = (id: string, patch: Partial<BedroomAssignment>) => {
    setBedrooms((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRoom = (id: string) => {
    setBedrooms((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleTravelerInRoom = (roomId: string, travelerId: string) => {
    setBedrooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r;
        const has = r.assignedTravelerIds.includes(travelerId);
        return {
          ...r,
          assignedTravelerIds: has
            ? r.assignedTravelerIds.filter((t) => t !== travelerId)
            : [...r.assignedTravelerIds, travelerId],
        };
      })
    );
  };

  /* ─── Render ─── */
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl border-white/20 glass hover:bg-white/30"
        >
          <Home className="w-4 h-4" />
          <span className="hidden sm:inline">Lodging</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="glass-card border-white/15 sm:max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="font-display text-lg">Lodging</DialogTitle>
        </DialogHeader>

        {/* Tab toggle */}
        <div className="flex gap-1 mx-5 mt-3 glass rounded-xl p-1">
          <button
            className={`flex-1 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${
              tab === "details" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("details")}
          >
            Details
          </button>
          <button
            className={`flex-1 py-1.5 rounded-lg text-xs font-display font-semibold transition-all ${
              tab === "rooms" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("rooms")}
          >
            Rooms ({bedrooms.length})
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tab === "details" && (
            <>
              <Field label="Property Name" value={details.propertyName} onChange={(v) => set("propertyName", v)} readOnly={!canEdit} />

              {/* Address with Maps link */}
              <div className="space-y-1">
                <label className="text-xs font-body font-medium text-muted-foreground">Address</label>
                <div className="flex gap-2">
                  <Input
                    value={details.address || ""}
                    onChange={(e) => set("address", e.target.value)}
                    readOnly={!canEdit}
                    className="glass border-white/20 rounded-xl h-9 text-sm flex-1"
                    placeholder="123 Main St…"
                  />
                  {details.address && (
                    <a href={mapsUrl(details.address)} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl glass border-white/20 shrink-0">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Check-in Time" value={details.checkInTime} onChange={(v) => set("checkInTime", v)} readOnly={!canEdit} type="time" />
                <Field label="Check-out Time" value={details.checkOutTime} onChange={(v) => set("checkOutTime", v)} readOnly={!canEdit} type="time" />
              </div>

              <Field label="Door Code / Lockbox" value={details.doorCode} onChange={(v) => set("doorCode", v)} readOnly={!canEdit} />

              <Field label="WiFi Network" value={details.wifiName} onChange={(v) => set("wifiName", v)} readOnly={!canEdit} />

              {/* WiFi password with copy */}
              <div className="space-y-1">
                <label className="text-xs font-body font-medium text-muted-foreground">WiFi Password</label>
                <div className="flex gap-2">
                  <Input
                    value={details.wifiPassword || ""}
                    onChange={(e) => set("wifiPassword", e.target.value)}
                    readOnly={!canEdit}
                    className="glass border-white/20 rounded-xl h-9 text-sm flex-1"
                  />
                  {details.wifiPassword && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 rounded-xl glass border-white/20 shrink-0"
                      onClick={copyWifi}
                    >
                      {copiedWifi ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </Button>
                  )}
                </div>
              </div>

              <AreaField label="House Rules" value={details.houseRules} onChange={(v) => set("houseRules", v)} readOnly={!canEdit} />
              <AreaField label="Parking Instructions" value={details.parkingInstructions} onChange={(v) => set("parkingInstructions", v)} readOnly={!canEdit} />

              <Field label="Host Name" value={details.hostName} onChange={(v) => set("hostName", v)} readOnly={!canEdit} />
              <Field label="Host Contact" value={details.hostContact} onChange={(v) => set("hostContact", v)} readOnly={!canEdit} />
            </>
          )}

          {tab === "rooms" && (
            <>
              {bedrooms.length === 0 && (
                <p className="text-sm text-muted-foreground font-body text-center py-6">
                  No rooms added yet.
                </p>
              )}

              <div className="grid gap-3">
                {bedrooms.map((room) => (
                  <div key={room.id} className="glass-card-solid rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-2">
                        <Input
                          value={room.name}
                          onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                          readOnly={!canEdit}
                          placeholder="Room name (e.g. Master Bedroom)"
                          className="glass border-white/20 rounded-xl h-9 text-sm font-semibold"
                        />
                        <Input
                          value={room.description}
                          onChange={(e) => updateRoom(room.id, { description: e.target.value })}
                          readOnly={!canEdit}
                          placeholder="Description (e.g. King bed, en-suite)"
                          className="glass border-white/20 rounded-xl h-9 text-sm"
                        />
                      </div>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-destructive/15 hover:text-destructive" onClick={() => removeRoom(room.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Traveler assignment */}
                    <div>
                      <p className="text-xs text-muted-foreground font-body mb-1.5">Assigned</p>
                      <div className="flex flex-wrap gap-1.5">
                        {travelers.map((t) => {
                          const assigned = room.assignedTravelerIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              disabled={!canEdit}
                              onClick={() => toggleTravelerInRoom(room.id, t.id)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-body transition-all ${
                                assigned
                                  ? "bg-primary/20 text-primary border border-primary/30"
                                  : "glass border-white/15 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {initials(t.name)} {t.name.split(" ")[0]}
                            </button>
                          );
                        })}
                        {travelers.length === 0 && (
                          <span className="text-xs text-muted-foreground">Add travelers first</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {canEdit && (
                <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl glass border-white/20" onClick={addRoom}>
                  <Plus className="w-4 h-4" /> Add Room
                </Button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {canEdit && (
          <div className="px-5 pb-5 pt-2">
            <Button onClick={handleSave} className="w-full rounded-xl h-10 font-display font-semibold">
              Save
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Reusable field helpers ─── */
function Field({
  label, value, onChange, readOnly, type = "text",
}: {
  label: string; value?: string; onChange: (v: string) => void; readOnly: boolean; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-body font-medium text-muted-foreground">{label}</label>
      <Input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="glass border-white/20 rounded-xl h-9 text-sm"
      />
    </div>
  );
}

function AreaField({
  label, value, onChange, readOnly,
}: {
  label: string; value?: string; onChange: (v: string) => void; readOnly: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-body font-medium text-muted-foreground">{label}</label>
      <Textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className="glass border-white/20 rounded-xl text-sm min-h-[60px] resize-none"
        rows={2}
      />
    </div>
  );
}
