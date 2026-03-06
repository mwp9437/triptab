import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Plane, MapPin, CalendarDays, Users, DollarSign, Sparkles, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TripIntake, BudgetTier, TravelerType, MobilityLevel, VIBE_OPTIONS, DIETARY_OPTIONS, BUDGET_LABELS, PlanningMode } from "@/types/intake";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface WizardContainerProps {
  intake: TripIntake;
  onUpdate: (intake: TripIntake) => void;
  onComplete: (intake: TripIntake) => void;
  onBack: () => void;
}

const STEPS = ["Destination & Dates", "Budget", "Preferences", "Planning Mode"];

export default function WizardContainer({ intake, onUpdate, onComplete, onBack }: WizardContainerProps) {
  const [step, setStep] = useState(0);

  const update = (partial: Partial<TripIntake>) => {
    onUpdate({ ...intake, ...partial });
  };

  const canProceed = () => {
    if (step === 0) return intake.destination.trim().length > 0;
    return true;
  };

  const next = () => {
    if (step < 3) setStep(step + 1);
    else onComplete(intake);
  };

  const back = () => {
    if (step > 0) setStep(step - 1);
    else onBack();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Plane className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">TripCraft</h1>
            <p className="text-xs text-muted-foreground font-body">Plan your trip</p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="px-6 py-4 border-b border-border">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                  i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {i + 1}
                </div>
                <span className={cn(
                  "text-xs font-body hidden sm:block",
                  i <= step ? "text-foreground" : "text-muted-foreground"
                )}>
                  {label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 rounded-full",
                    i < step ? "bg-primary" : "bg-border"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && <StepDestination intake={intake} onUpdate={update} />}
              {step === 1 && <StepBudget intake={intake} onUpdate={update} />}
              {step === 2 && <StepPreferences intake={intake} onUpdate={update} />}
              {step === 3 && <StepPlanningMode intake={intake} onUpdate={update} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-6 py-4">
        <div className="max-w-2xl mx-auto flex justify-between">
          <Button variant="ghost" onClick={back} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Button onClick={next} disabled={!canProceed()} className="gap-2">
            {step === 3 ? "Build My Trip" : "Next"} <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1: Destination & Dates ─── */
function StepDestination({ intake, onUpdate }: { intake: TripIntake; onUpdate: (p: Partial<TripIntake>) => void }) {
  const startDate = intake.startDate ? new Date(intake.startDate + "T00:00:00") : undefined;
  const endDate = intake.endDate ? new Date(intake.endDate + "T00:00:00") : undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-1">Where are you headed?</h2>
        <p className="text-sm text-muted-foreground font-body">We've pre-filled what we could from your input.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
            <MapPin className="w-4 h-4 inline mr-1.5" />Destination
          </label>
          <Input
            value={intake.destination}
            onChange={(e) => onUpdate({ destination: e.target.value })}
            placeholder="e.g., Hokkaido, Japan"
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
              <CalendarDays className="w-4 h-4 inline mr-1.5" />Start Date
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left rounded-xl", !startDate && "text-muted-foreground")}>
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(d) => d && onUpdate({ startDate: format(d, "yyyy-MM-dd") })}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <label className="text-sm font-body font-medium text-foreground mb-1.5 block">End Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left rounded-xl", !endDate && "text-muted-foreground")}>
                  {endDate ? format(endDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(d) => d && onUpdate({ endDate: format(d, "yyyy-MM-dd") })}
                  disabled={(d) => startDate ? d < startDate : false}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-body font-medium text-foreground mb-1.5 block">
              <Users className="w-4 h-4 inline mr-1.5" />Traveling as
            </label>
            <Select value={intake.travelerType} onValueChange={(v) => {
              const type = v as TravelerType;
              const count = type === "solo" ? 1 : type === "couple" ? 2 : intake.travelerCount;
              onUpdate({ travelerType: type, travelerCount: count });
            }}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="solo">Solo</SelectItem>
                <SelectItem value="couple">Couple</SelectItem>
                <SelectItem value="family">Family</SelectItem>
                <SelectItem value="friends">Friend Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-body font-medium text-foreground mb-1.5 block">Group Size</label>
            <div className="flex items-center gap-3">
              <Button
                variant="outline" size="icon" className="rounded-xl h-10 w-10"
                onClick={() => onUpdate({ travelerCount: Math.max(1, intake.travelerCount - 1) })}
              >-</Button>
              <span className="text-lg font-semibold font-body w-8 text-center">{intake.travelerCount}</span>
              <Button
                variant="outline" size="icon" className="rounded-xl h-10 w-10"
                onClick={() => onUpdate({ travelerCount: intake.travelerCount + 1 })}
              >+</Button>
            </div>
          </div>
        </div>

        {intake.travelerType === "family" && (
          <div>
            <label className="text-sm font-body font-medium text-foreground mb-1.5 block">Children's ages (comma-separated)</label>
            <Input
              value={intake.childAges.join(", ")}
              onChange={(e) => onUpdate({ childAges: e.target.value.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)) })}
              placeholder="e.g., 5, 8, 12"
              className="rounded-xl"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Step 2: Budget ─── */
function StepBudget({ intake, onUpdate }: { intake: TripIntake; onUpdate: (p: Partial<TripIntake>) => void }) {
  const categories = ["accommodation", "meals", "activities", "transportation"] as const;
  const tierLabels = ["$", "$$", "$$$", "$$$$"];

  const setBudgetTier = (cat: string, tier: BudgetTier) => {
    onUpdate({ budget: { ...intake.budget, [cat]: tier } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-1">Set your budget</h2>
        <p className="text-sm text-muted-foreground font-body">Pick a tier for each category. This guides our recommendations.</p>
      </div>

      {/* Total budget input */}
      <div className="bg-card border border-border rounded-xl p-4">
        <label className="text-sm font-body font-semibold text-foreground mb-1.5 block">
          <DollarSign className="w-4 h-4 inline mr-1.5" />Budget Per Person <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <p className="text-xs text-muted-foreground font-body mb-3">Set a per-person budget cap and we'll keep recommendations within range.</p>
        <Input
          type="number"
          value={intake.budget.totalBudget || ""}
          onChange={(e) => onUpdate({ budget: { ...intake.budget, totalBudget: e.target.value ? Number(e.target.value) : undefined } })}
          placeholder="e.g., 5000"
          className="rounded-xl max-w-[200px]"
          min={0}
        />
      </div>

      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat} className="bg-card border border-border rounded-xl p-4">
            <label className="text-sm font-body font-semibold text-foreground capitalize mb-3 block">
              {cat}
            </label>
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as BudgetTier[]).map((tier) => {
                const isSelected = intake.budget[cat] === tier;
                return (
                  <button
                    key={tier}
                    onClick={() => setBudgetTier(cat, tier)}
                    className={cn(
                      "rounded-xl py-2.5 px-3 text-center transition-all border font-body text-sm",
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    )}
                  >
                    <div className="font-semibold">{tierLabels[tier - 1]}</div>
                    <div className="text-xs mt-0.5 opacity-80 leading-tight">
                      {BUDGET_LABELS[tier][cat]}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Step 3: Preferences ─── */
function StepPreferences({ intake, onUpdate }: { intake: TripIntake; onUpdate: (p: Partial<TripIntake>) => void }) {
  const toggleVibe = (v: string) => {
    const vibes = intake.vibes.includes(v) ? intake.vibes.filter(x => x !== v) : [...intake.vibes, v];
    onUpdate({ vibes });
  };

  const toggleDietary = (d: string) => {
    const dietary = intake.dietary.includes(d) ? intake.dietary.filter(x => x !== d) : [...intake.dietary, d];
    onUpdate({ dietary });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-1">Your preferences</h2>
        <p className="text-sm text-muted-foreground font-body">Help us tailor the experience to you.</p>
      </div>

      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-2 block">Trip Vibe</label>
        <div className="flex flex-wrap gap-2">
          {VIBE_OPTIONS.map((v) => (
            <button
              key={v}
              onClick={() => toggleVibe(v)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-body border transition-all",
                intake.vibes.includes(v)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-2 block">Dietary Restrictions</label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => toggleDietary(d)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-body border transition-all",
                intake.dietary.includes(d)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-1.5 block">Mobility</label>
        <Select value={intake.mobility} onValueChange={(v) => onUpdate({ mobility: v as MobilityLevel })}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No limitations</SelectItem>
            <SelectItem value="limited">Limited walking</SelectItem>
            <SelectItem value="wheelchair">Wheelchair accessible</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-1.5 block">
          Anything you absolutely want to do? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          value={intake.mustDos}
          onChange={(e) => onUpdate({ mustDos: e.target.value })}
          placeholder="e.g., Visit the fish market, try onsen, ski Niseko..."
          className="rounded-xl resize-none"
          rows={2}
        />
      </div>

      <div>
        <label className="text-sm font-body font-semibold text-foreground mb-1.5 block">
          Anything you want to avoid? <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          value={intake.avoids}
          onChange={(e) => onUpdate({ avoids: e.target.value })}
          placeholder="e.g., Tourist traps, long bus rides..."
          className="rounded-xl resize-none"
          rows={2}
        />
      </div>
    </div>
  );
}

/* ─── Step 4: Planning Mode ─── */
function StepPlanningMode({ intake, onUpdate }: { intake: TripIntake; onUpdate: (p: Partial<TripIntake>) => void }) {
  const modes: { id: PlanningMode; icon: typeof Sparkles; title: string; desc: string; sub: string }[] = [
    {
      id: "auto",
      icon: Sparkles,
      title: "Plan It For Me",
      desc: "AI generates a complete itinerary based on your inputs. You can edit, swap, and refine afterward.",
      sub: "Best if you want a starting point fast.",
    },
    {
      id: "collaborative",
      icon: Compass,
      title: "Plan Together",
      desc: "Start with an empty itinerary and build it step by step with AI assistance. Tell it what you want each day and it finds the best options.",
      sub: "Best if you want full control.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground mb-1">How do you want to plan?</h2>
        <p className="text-sm text-muted-foreground font-body">You can switch modes anytime during planning.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const selected = intake.planningMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onUpdate({ planningMode: mode.id })}
              className={cn(
                "text-left rounded-xl border-2 p-6 transition-all",
                selected
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card hover:border-primary/30"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">{mode.title}</h3>
              <p className="text-sm font-body text-muted-foreground mb-2">{mode.desc}</p>
              <p className="text-xs font-body text-primary font-medium">{mode.sub}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
